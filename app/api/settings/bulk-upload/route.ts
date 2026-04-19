import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import * as XLSX from 'xlsx'
import { Decimal } from "@prisma/client/runtime/library"
import * as fs from 'fs'
import * as path from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const module = formData.get('module') as string
    const submodule = formData.get('submodule') as string

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an Excel file (.xlsx or .xls)" },
        { status: 400 }
      )
    }

    // Read Excel file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    // Load plan categories for validation
    const categoriesPath = path.join(process.cwd(), 'public', 'plan_categories.json')
    const categoriesData = fs.readFileSync(categoriesPath, 'utf8')
    const planCategories = JSON.parse(categoriesData)
    const validCategoryIds = planCategories.map((cat: any) => cat.id)
    const validCategoryNames = planCategories.map((cat: any) => cat.name)

    if (!jsonData || jsonData.length === 0) {
      return NextResponse.json(
        { error: "File is empty or contains no data" },
        { status: 400 }
      )
    }

    let processedCount = 0
    let errors: string[] = []
    const createdRecords: any[] = []

    // Process based on module and submodule
    if (module === "settings" && submodule === "service-types") {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any
        const rowNumber = i + 2 // +2 because Excel is 1-indexed and we skip header

        try {
          // Validate required fields
          // Note: Service Type is optional (defaults to Secondary if blank)
          if (!row["Service Name"] || !row["Service Category"]) {
            errors.push(`Row ${rowNumber}: Missing required fields (Service Name, Service Category)`)
            continue
          }

          // Parse Service Type
          // User Requirement: 1 -> PRIMARY, Blank -> SECONDARY
          let serviceType = "SECONDARY_SERVICE" // Default
          const serviceTypeRaw = row["Service Type"] || row["Service Type (Optional)"]

          if (serviceTypeRaw) {
            const val = serviceTypeRaw.toString().trim()
            if (val === "1" || val.toUpperCase() === "PRIMARY" || val.toUpperCase() === "PRIMARY_SERVICE") {
              serviceType = "PRIMARY_SERVICE"
            }
            // Any other value or blank keeps it as SECONDARY_SERVICE
          }

          // Parse NHIA Price
          // Parse NHIA Price
          let nhiaPrice = 0
          const priceRaw = row["NHIA Price"] || row["Tariff Price"]
          if (priceRaw) {
            const priceVal = parseFloat(priceRaw.toString())
            if (!isNaN(priceVal)) {
              nhiaPrice = priceVal
            }
          }

          // Validate service category - expects category ID, but we'll convert to name for storage
          const serviceCategory = row["Service Category"].toString().trim()
          let validatedCategory = serviceCategory

          // Check if category is a valid ID
          if (validCategoryIds.includes(serviceCategory)) {
            // Convert category ID to category name for storage in database
            const categoryObj = planCategories.find((cat: any) => cat.id === serviceCategory)
            if (categoryObj) {
              validatedCategory = categoryObj.name
            } else {
              errors.push(`Row ${rowNumber}: Category ID "${serviceCategory}" found but name not found in categories list`)
              continue
            }
          }
          // Check if it's already a valid category name (for backward compatibility)
          else if (validCategoryNames.includes(serviceCategory)) {
            validatedCategory = serviceCategory
          }
          // If not a valid ID or name, add error
          else {
            errors.push(`Row ${rowNumber}: Invalid service category "${serviceCategory}". Valid category IDs: ${validCategoryIds.join(', ')}`)
            continue
          }

          // Check if service type already exists
          const existingService = await prisma.serviceType.findFirst({
            where: {
              service_name: row["Service Name"].toString().trim(),
              // service_category: validatedCategory, // Allow same name in diff category? Typically service name should be unique globally or per category.
              // Let's stick to name + category uniqueness to be safe, or just name?
              // Existing logic used name + category + type.
              service_category: validatedCategory
            }
          })

          if (existingService) {
            // If it exists, maybe update it? 
            // Requirement says "Delete all existing", so we assume new uploads are fresh.
            // But if user uploads duplicates in same file or subsequent files, we should probably SKIP or UPDATE.
            // Current logic SKIPS.
            // errors.push(`Row ${rowNumber}: Service type already exists`)

            // Let's UPDATE it to strictly follow "upload... in this Service Types module" implying management.
            // But safe default is SKIP with error.
            errors.push(`Row ${rowNumber}: Service already exists`)
            continue
          }

          // Generate a unique service_id using timestamp + random number
          const generateServiceId = () => {
            const timestamp = Date.now().toString()
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
            return `${timestamp}${random}`
          }

          // Create service type with unique service_id
          const serviceTypeRecord = await prisma.serviceType.create({
            data: {
              service_id: generateServiceId(),
              service_name: row["Service Name"].toString().trim(),
              service_category: validatedCategory,
              service_type: serviceType,
              nhia_price: nhiaPrice,
              is_nhia_service: true // Always true for this upload
            }
          })

          createdRecords.push(serviceTypeRecord)
          processedCount++

        } catch (error: any) {
          // Check for Prisma unique constraint error
          if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            const target = error.meta?.target
            if (target && target.includes('service_id')) {
              errors.push(`Row ${rowNumber}: Service ID already exists. Please try again.`)
            } else if (target && target.includes('service_name')) {
              errors.push(`Row ${rowNumber}: Service name already exists. Please choose a different name.`)
            } else {
              errors.push(`Row ${rowNumber}: Duplicate entry found. Please check your data.`)
            }
          } else {
            errors.push(`Row ${rowNumber}: ${error.message}`)
          }
        }
      }
    } else if (module === "settings" && submodule === "plans") {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any
        const rowNumber = i + 2 // +2 because Excel is 1-indexed and we skip header

        try {
          // Validate required fields
          if (!row["Plan Name"] || !row["Plan Type"] || !row["Premium Amount"] || !row["Annual Limit"]) {
            errors.push(`Row ${rowNumber}: Missing required fields`)
            continue
          }

          // Check if plan name already exists
          const existingPlan = await prisma.plan.findFirst({
            where: { name: row["Plan Name"].toString().trim() }
          })

          if (existingPlan) {
            errors.push(`Row ${rowNumber}: Plan name already exists`)
            continue
          }

          // Validate plan type
          const validPlanTypes = ["INDIVIDUAL", "FAMILY", "CORPORATE"]
          if (!validPlanTypes.includes(row["Plan Type"].toString().trim().toUpperCase())) {
            errors.push(`Row ${rowNumber}: Invalid plan type. Must be INDIVIDUAL, FAMILY, or CORPORATE`)
            continue
          }

          // Parse assigned bands from the "Assigned Bands" column
          let assignedBands: string[] = []
          if (row["Assigned Bands"]) {
            const bandsString = row["Assigned Bands"].toString().trim()
            if (bandsString) {
              // Split by comma and clean up each band
              assignedBands = bandsString.split(',').map((band: string) => band.trim()).filter((band: string) => band.length > 0)
            }
          }

          // Generate unique plan_id
          const lastPlan = await prisma.plan.findFirst({
            orderBy: { plan_id: 'desc' }
          })

          const nextPlanId = lastPlan
            ? (parseInt(lastPlan.plan_id) + 1).toString()
            : '1'

          // Create plan
          const plan = await prisma.plan.create({
            data: {
              plan_id: nextPlanId,
              name: row["Plan Name"].toString().trim(),
              description: row["Description"]?.toString().trim() || null,
              plan_type: row["Plan Type"].toString().trim().toUpperCase() as any,
              premium_amount: parseFloat(row["Premium Amount"].toString()),
              annual_limit: parseFloat(row["Annual Limit"].toString()),
              band_type: null, // Remove legacy band_type field
              assigned_bands: assignedBands, // Use new assigned_bands field
              created_by_id: session.user.id,
            }
          })

          createdRecords.push(plan)
          processedCount++

        } catch (error: any) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      }
    } else if (module === "underwriting" && submodule === "organizations") {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any
        const rowNumber = i + 2

        try {
          // Validate required fields
          if (!row["Organization Name"] || !row["Organization Initials"] || !row["Organization Type"]) {
            errors.push(`Row ${rowNumber}: Missing required fields (Organization Name, Organization Initials, Organization Type)`)
            continue
          }

          // Check if organization already exists
          const existingOrg = await prisma.organization.findFirst({
            where: {
              OR: [
                { name: row["Organization Name"].toString().trim() },
                { code: row["Organization Initials"].toString().trim() }
              ]
            }
          })

          if (existingOrg) {
            errors.push(`Row ${rowNumber}: Organization already exists`)
            continue
          }

          // Validate organization type
          const validTypes = ["CORPORATE", "GOVERNMENT", "NGO", "INDIVIDUAL"]
          if (!validTypes.includes(row["Organization Type"].toString().trim().toUpperCase())) {
            errors.push(`Row ${rowNumber}: Invalid organization type. Must be CORPORATE, GOVERNMENT, NGO, or INDIVIDUAL`)
            continue
          }

          // Generate unique organization_id
          const lastOrganization = await prisma.organization.findFirst({
            orderBy: { organization_id: 'desc' }
          })

          const nextOrganizationId = lastOrganization
            ? (parseInt(lastOrganization.organization_id) + 1).toString()
            : '1'

          // Create organization
          const organization = await prisma.organization.create({
            data: {
              organization_id: nextOrganizationId,
              name: row["Organization Name"].toString().trim(),
              code: row["Organization Initials"].toString().trim(),
              type: row["Organization Type"].toString().trim().toUpperCase() as any,
              contact_info: {
                address: row["Address"]?.toString().trim() || "",
                phone: row["Phone"]?.toString().trim() || "",
                email: row["Email"]?.toString().trim() || "",
                contact_person: row["Contact Person"]?.toString().trim() || "",
                registration_number: row["Registration Number"]?.toString().trim() || ""
              },
              status: "ACTIVE"
            }
          })

          createdRecords.push(organization)
          processedCount++

        } catch (error: any) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      }
    } else if (module === "underwriting" && submodule === "principals") {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any
        const rowNumber = i + 2

        try {
          // Validate required fields
          if (!row["Principal ID"] || !row["First Name"] || !row["Last Name"] || !row["Email"] || !row["Organization"]) {
            errors.push(`Row ${rowNumber}: Missing required fields (Principal ID, First Name, Last Name, Email, Organization)`)
            continue
          }

          // Find organization
          const organization = await prisma.organization.findFirst({
            where: {
              name: { contains: row["Organization"].toString().trim(), mode: 'insensitive' }
            }
          })

          if (!organization) {
            errors.push(`Row ${rowNumber}: Organization not found`)
            continue
          }

          // Check if principal already exists
          const existingPrincipal = await prisma.principal.findFirst({
            where: {
              OR: [
                { principal_id: row["Principal ID"].toString().trim() },
                { email: row["Email"].toString().trim() }
              ]
            }
          })

          if (existingPrincipal) {
            errors.push(`Row ${rowNumber}: Principal already exists`)
            continue
          }

          // Create principal
          const principal = await prisma.principal.create({
            data: {
              principal_id: row["Principal ID"].toString().trim(),
              first_name: row["First Name"].toString().trim(),
              last_name: row["Last Name"].toString().trim(),
              email: row["Email"].toString().trim(),
              phone_number: row["Phone Number"]?.toString().trim() || null,
              date_of_birth: row["Date of Birth"] ? new Date(row["Date of Birth"]) : null,
              gender: row["Gender"]?.toString().trim().toUpperCase() || null,
              address: row["Address"]?.toString().trim() || null,
              organization_id: organization.id,
              status: "ACTIVE"
            }
          })

          createdRecords.push(principal)
          processedCount++

        } catch (error: any) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      }
    } else if (module === "underwriting" && submodule === "dependents") {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any
        const rowNumber = i + 2

        try {
          // Validate required fields
          if (!row["Dependent ID"] || !row["First Name"] || !row["Last Name"] || !row["Principal ID"]) {
            errors.push(`Row ${rowNumber}: Missing required fields (Dependent ID, First Name, Last Name, Principal ID)`)
            continue
          }

          // Find principal
          const principal = await prisma.principal.findFirst({
            where: {
              principal_id: row["Principal ID"].toString().trim()
            }
          })

          if (!principal) {
            errors.push(`Row ${rowNumber}: Principal not found`)
            continue
          }

          // Check if dependent already exists
          const existingDependent = await prisma.dependent.findFirst({
            where: {
              dependent_id: row["Dependent ID"].toString().trim()
            }
          })

          if (existingDependent) {
            errors.push(`Row ${rowNumber}: Dependent already exists`)
            continue
          }

          // Validate relationship
          const validRelationships = ["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"]
          if (row["Relationship"] && !validRelationships.includes(row["Relationship"].toString().trim().toUpperCase())) {
            errors.push(`Row ${rowNumber}: Invalid relationship. Must be SPOUSE, CHILD, PARENT, SIBLING, or OTHER`)
            continue
          }

          // Create dependent
          const dependent = await prisma.dependent.create({
            data: {
              dependent_id: row["Dependent ID"].toString().trim(),
              first_name: row["First Name"].toString().trim(),
              last_name: row["Last Name"].toString().trim(),
              date_of_birth: row["Date of Birth"] ? new Date(row["Date of Birth"]) : new Date(),
              relationship: row["Relationship"]?.toString().trim().toUpperCase() || "OTHER",
              principal_id: principal.id,
              status: "ACTIVE"
            }
          })

          createdRecords.push(dependent)
          processedCount++

        } catch (error: any) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      }
    } else if (module === "settings" && submodule === "covered-services") {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any
        const rowNumber = i + 2

        try {
          // Validate required fields
          if (!row["Plan Name"] || !row["Facility Name"] || !row["Service Name"] || !row["Facility Price"]) {
            errors.push(`Row ${rowNumber}: Missing required fields (Plan Name, Facility Name, Service Name, Facility Price)`)
            continue
          }

          // Validate Facility Price
          const facilityPrice = parseFloat(row["Facility Price"].toString())
          if (isNaN(facilityPrice) || facilityPrice < 0) {
            errors.push(`Row ${rowNumber}: Facility Price must be a valid positive number`)
            continue
          }

          // Validate Limit Count if provided
          let limitCount = null
          if (row["Limit Count"]) {
            const limitCountValue = parseInt(row["Limit Count"].toString())
            if (isNaN(limitCountValue) || limitCountValue < 1) {
              errors.push(`Row ${rowNumber}: Limit Count must be a positive number`)
              continue
            }
            limitCount = limitCountValue
          }

          // Find plan - support both name and ID lookup
          let plan = null
          const planInput = row["Plan Name"].toString().trim()

          // Try to find by ID first (if input is numeric)
          if (/^\d+$/.test(planInput)) {
            plan = await prisma.plan.findFirst({
              where: {
                plan_id: planInput
              }
            })
          }

          // If not found by ID or input is not numeric, try by name
          if (!plan) {
            plan = await prisma.plan.findFirst({
              where: {
                name: { equals: planInput, mode: 'insensitive' }
              }
            })
          }

          if (!plan) {
            // Get available plans to help user
            const availablePlans = await prisma.plan.findMany({
              select: { name: true, plan_id: true },
              take: 5
            })
            const planInfo = availablePlans.map(p => `${p.name} (ID: ${p.plan_id})`).join(', ')
            errors.push(`Row ${rowNumber}: Plan "${planInput}" not found. Available plans: ${planInfo}`)
            continue
          }

          // Find facility - support both name and ID lookup
          let facility = null
          const facilityInput = row["Facility Name"].toString().trim()

          // Try to find by ID first (if input is numeric)
          if (/^\d+$/.test(facilityInput)) {
            facility = await prisma.provider.findFirst({
              where: {
                provider_id: facilityInput
              }
            })
          }

          // If not found by ID or input is not numeric, try by name
          if (!facility) {
            facility = await prisma.provider.findFirst({
              where: {
                facility_name: { equals: facilityInput, mode: 'insensitive' }
              }
            })
          }

          if (!facility) {
            // Get available facilities to help user
            const availableFacilities = await prisma.provider.findMany({
              select: { facility_name: true, provider_id: true },
              take: 5
            })
            const facilityInfo = availableFacilities.map(f => `${f.facility_name} (ID: ${f.provider_id})`).join(', ')
            errors.push(`Row ${rowNumber}: Facility "${facilityInput}" not found. Available facilities: ${facilityInfo}`)
            continue
          }

          // Find service type - support both name and ID lookup
          let serviceType = null
          const serviceInput = row["Service Name"].toString().trim()

          // Try to find by ID first (if input is numeric)
          if (/^\d+$/.test(serviceInput)) {
            serviceType = await prisma.serviceType.findFirst({
              where: {
                service_id: serviceInput
              }
            })
          }

          // If not found by ID or input is not numeric, try by name
          if (!serviceType) {
            serviceType = await prisma.serviceType.findFirst({
              where: {
                service_name: { equals: serviceInput, mode: 'insensitive' }
              }
            })
          }

          if (!serviceType) {
            // Get available service types to help user
            const availableServices = await prisma.serviceType.findMany({
              select: { service_name: true, service_id: true },
              take: 5
            })
            const serviceInfo = availableServices.map(s => `${s.service_name} (ID: ${s.service_id})`).join(', ')
            errors.push(`Row ${rowNumber}: Service type "${serviceInput}" not found. Available services: ${serviceInfo}`)
            continue
          }

          // Check if covered service already exists
          const existingCoveredService = await prisma.coveredService.findFirst({
            where: {
              plan_id: plan.id,
              facility_id: facility.id,
              service_type_id: serviceType.id
            }
          })

          if (existingCoveredService) {
            errors.push(`Row ${rowNumber}: Covered service already exists for this plan and facility`)
            continue
          }

          // Create covered service
          const coveredService = await prisma.coveredService.create({
            data: {
              plan_id: plan.id,
              facility_id: facility.id,
              service_type_id: serviceType.id,
              facility_price: facilityPrice,
              limit_count: limitCount,
              status: "ACTIVE"
            }
          })

          createdRecords.push(coveredService)
          processedCount++

        } catch (error: any) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      }
    } else if (module === "settings" && submodule === "provider-plans") {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any
        const rowNumber = i + 2

        try {
          // Validate required fields
          if (!row["Plan Name"] || !row["Provider Name"] || !row["Band Type"]) {
            errors.push(`Row ${rowNumber}: Missing required fields (Plan Name, Provider Name, Band Type)`)
            continue
          }

          // Find plan
          const plan = await prisma.plan.findFirst({
            where: {
              name: { contains: row["Plan Name"].toString().trim(), mode: 'insensitive' }
            }
          })

          if (!plan) {
            errors.push(`Row ${rowNumber}: Plan not found`)
            continue
          }

          // Find provider
          const provider = await prisma.provider.findFirst({
            where: {
              facility_name: { contains: row["Provider Name"].toString().trim(), mode: 'insensitive' }
            }
          })

          if (!provider) {
            errors.push(`Row ${rowNumber}: Provider not found`)
            continue
          }

          // Check if plan band already exists
          const existingPlanBand = await prisma.planBand.findFirst({
            where: {
              plan_id: plan.id,
              provider_id: provider.id
            }
          })

          if (existingPlanBand) {
            errors.push(`Row ${rowNumber}: Provider already assigned to this plan`)
            continue
          }

          // Create plan band
          const planBand = await prisma.planBand.create({
            data: {
              plan_id: plan.id,
              provider_id: provider.id,
              band_type: row["Band Type"].toString().trim(),
              status: "ACTIVE"
            }
          })

          createdRecords.push(planBand)
          processedCount++

        } catch (error: any) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      }
    } else if (module === "settings" && submodule === "package-limits") {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any
        const rowNumber = i + 2

        try {
          // Validate required fields
          if (!row["Plan Name"] || !row["Package Type"] || !row["Limit Type"] || !row["Time Frame Value"] || !row["Time Frame Unit"]) {
            errors.push(`Row ${rowNumber}: Missing required fields (Plan Name, Package Type, Limit Type, Time Frame Value, Time Frame Unit)`)
            continue
          }

          // Validate limit type
          const validLimitTypes = ["duration", "count"]
          if (!validLimitTypes.includes(row["Limit Type"].toString().trim().toLowerCase())) {
            errors.push(`Row ${rowNumber}: Invalid limit type. Must be 'duration' or 'count'`)
            continue
          }

          // Validate limit type specific fields
          if (row["Limit Type"].toString().trim().toLowerCase() === "duration" && !row["Amount"]) {
            errors.push(`Row ${rowNumber}: Missing required field for duration limit type (Amount)`)
            continue
          }
          if (row["Limit Type"].toString().trim().toLowerCase() === "count" && (!row["Limit Count"] || isNaN(parseInt(row["Limit Count"].toString())))) {
            errors.push(`Row ${rowNumber}: Missing required field for count limit type (Limit Count)`)
            continue
          }

          // Find plan
          const plan = await prisma.plan.findFirst({
            where: {
              name: { contains: row["Plan Name"].toString().trim(), mode: 'insensitive' }
            }
          })

          if (!plan) {
            errors.push(`Row ${rowNumber}: Plan not found`)
            continue
          }

          // Check if package limit already exists
          const existingPackageLimit = await prisma.packageLimit.findFirst({
            where: {
              plan_id: plan.id,
              package_type: row["Package Type"].toString().trim()
            }
          })

          if (existingPackageLimit) {
            errors.push(`Row ${rowNumber}: Package limit already exists for this plan and package type`)
            continue
          }

          // Prepare data based on limit type
          const limitType = row["Limit Type"].toString().trim().toLowerCase()
          const packageData: any = {
            plan_id: plan.id,
            package_type: row["Package Type"].toString().trim(),
            amount: limitType === "duration" ? (row["Amount"] ? new Decimal(parseFloat(row["Amount"].toString())) : null) : null,
            limit_count: limitType === "count" ? (row["Limit Count"] ? parseInt(row["Limit Count"].toString()) : null) : null,
            time_frame: `${row["Time Frame Value"].toString()} ${row["Time Frame Unit"].toString()}`,
            time_frame_unit: row["Time Frame Unit"].toString().trim(),
            status: "ACTIVE"
          };

          // Create package limit
          const packageLimit = await prisma.packageLimit.create({
            data: packageData
          })

          createdRecords.push(packageLimit)
          processedCount++

        } catch (error: any) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported module or submodule" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      processedCount,
      totalRows: jsonData.length,
      errors,
      data: createdRecords,
      message: `Successfully processed ${processedCount} out of ${jsonData.length} rows`
    })

  } catch (error) {
    console.error("Error processing bulk upload:", error)
    return NextResponse.json(
      { error: "Failed to process bulk upload" },
      { status: 500 }
    )
  }
}
