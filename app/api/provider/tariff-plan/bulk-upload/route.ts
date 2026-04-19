import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import * as XLSX from 'xlsx'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

type ParsedTariffService = {
  service_id: string
  service_name: string
  category_id: string
  category_name: string
  price: number
  service_type: number | null
  status: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const providerIdRaw = formData.get('provider_id')
    const providerId = typeof providerIdRaw === "string" ? providerIdRaw.trim() : ""
    const isUniversalUpload = !providerId

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()
    const parsed = parseTariffWorkbook(buffer)
    if (parsed.error) {
      return NextResponse.json(parsed.error, { status: 400 })
    }

    const services = parsed.services

    if (services.length === 0) {
      return NextResponse.json(
        { error: "No valid services found in file" },
        { status: 400 }
      )
    }

    if (isUniversalUpload) {
      const uploadDir = path.join(process.cwd(), 'uploads', 'tariff-files', 'cjhmo-universal')
      await mkdir(uploadDir, { recursive: true })

      const timestamp = Date.now()
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const versionedXlsxPath = path.join(uploadDir, `${timestamp}_${sanitizedFileName}`)
      const currentXlsxPath = path.join(uploadDir, 'current.xlsx')
      const currentJsonPath = path.join(uploadDir, 'current.json')

      await writeFile(versionedXlsxPath, Buffer.from(buffer))
      await writeFile(currentXlsxPath, Buffer.from(buffer))
      await writeFile(
        currentJsonPath,
        JSON.stringify(
          {
            uploaded_at: new Date().toISOString(),
            uploaded_by: session.user.id,
            file_name: file.name,
            services,
          },
          null,
          2
        )
      )

      // Seed providers that do not yet have a tariff service list.
      const providersWithoutTariff = await prisma.provider.findMany({
        where: {
          tariff_plan_services: {
            none: {},
          },
        },
        select: { id: true },
      })

      let seededProviders = 0
      const seedWarnings: string[] = []
      for (const provider of providersWithoutTariff) {
        try {
          await replaceProviderTariffServices(provider.id, services)
          seededProviders++
        } catch (seedError) {
          const warning = `Provider ${provider.id} seed failed: ${seedError instanceof Error ? seedError.message : "Unknown error"}`
          console.error(warning)
          seedWarnings.push(warning)
        }
      }

      try {
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: "TARIFF_PLAN_CJHMO_UNIVERSAL_UPLOAD",
            resource: "tariff_plan_services",
            resource_id: `cjhmo_universal_${Date.now()}`,
            new_values: {
              processed_count: services.length,
              seeded_providers: seededProviders,
              failed_providers: seedWarnings.length,
              file_name: file.name,
              warnings: seedWarnings.slice(0, 20),
            },
          },
        })
      } catch (auditError) {
        console.error("Universal tariff uploaded but audit log failed:", auditError)
        seedWarnings.push("Audit log warning: upload completed but audit logging failed")
      }

      const warningCount = seedWarnings.length
      return NextResponse.json({
        success: true,
        message:
          warningCount > 0
            ? `Universal CJHMO tariff uploaded with warnings. ${seededProviders} provider(s) initialized, ${warningCount} provider(s) failed.`
            : `Universal CJHMO tariff uploaded successfully. ${seededProviders} provider(s) without tariffs were initialized.`,
        processedCount: services.length,
        seededProviders,
        failedProviders: warningCount,
        warnings: seedWarnings,
      })
    }

    const providerExists = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true },
    })

    if (!providerExists) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      )
    }

    await replaceProviderTariffServices(providerId, services)
    const newCount = services.length
    const updatedCount = 0

    // Save raw uploaded file to a persistent directory so Download Tariff button works
    try {
      const uploadDir = path.join(process.cwd(), 'uploads', 'tariff-files')
      await mkdir(uploadDir, { recursive: true })
      const timestamp = Date.now()
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `${providerId}_${timestamp}_${sanitizedFileName}`
      const filePath = path.join(uploadDir, fileName)
      await writeFile(filePath, Buffer.from(buffer))

      await prisma.providerTariffFile.upsert({
        where: { provider_id: providerId },
        create: {
          provider_id: providerId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          uploaded_by: session.user.id
        },
        update: {
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          uploaded_at: new Date(),
          uploaded_by: session.user.id
        }
      })
      console.log(`✅ Saved bulk tariff file for download: ${filePath}`)
    } catch (fileErr) {
      console.error('⚠️  Failed to save tariff file for download (non-fatal):', fileErr)
    }

    const totalProcessed = newCount + updatedCount

    console.log(`✅ Processed ${totalProcessed} services (${newCount} new, ${updatedCount} updated)`)

    const warnings: string[] = []

    // AUTO-ADD NEW SERVICES TO ALL EXISTING PLANS
    // This implements the requirement: "By default, all uploaded services will appear in all existing plans"
    if (newCount > 0) {
      try {
        console.log(`\n📋 Auto-adding ${newCount} new services to all existing plans...`)

        // Get all active plans
        const allPlans = await prisma.plan.findMany({
          where: { status: 'ACTIVE' }, // Only active plans
          select: { id: true, name: true }
        })

        // Get provider details for covered services
        const provider = await prisma.provider.findUnique({
          where: { id: providerId },
          select: { id: true, facility_name: true }
        })

        if (!provider) {
          const warning = `Provider ${providerId} not found for covered service sync`
          console.error(`❌ ${warning}`)
          warnings.push(warning)
        } else if (allPlans.length === 0) {
          const warning = "No active plans found. Services uploaded but not auto-added to any plans."
          console.warn(`⚠️  ${warning}`)
          warnings.push(warning)
        } else {
          let coveredServicesCreated = 0

          // Get newly created services (all are new since we deleted and recreated)
          const newServices = await prisma.tariffPlanService.findMany({
            where: {
              provider_id: providerId,
              service_id: { in: services.map(s => s.service_id) },
              created_at: { gte: new Date(Date.now() - 30000) } // Created within last 30 seconds
            }
          })

          // For each new service, create covered service records in all plans
          for (const service of newServices) {
            // Find the corresponding ServiceType
            const serviceType = await prisma.serviceType.findFirst({
              where: {
                OR: [
                  { service_id: service.service_id },
                  { service_name: { equals: service.service_name, mode: 'insensitive' } }
                ]
              }
            })

            if (!serviceType) {
              console.warn(`⚠️  ServiceType not found for ${service.service_name}, skipping auto-add to plans`)
              continue
            }

            // Create covered service for each plan
            for (const plan of allPlans) {
              try {
                // Check if covered service already exists
                const existingCovered = await prisma.coveredService.findFirst({
                  where: {
                    plan_id: plan.id,
                    facility_id: provider.id,
                    service_type_id: serviceType.id
                  }
                })

                if (!existingCovered) {
                  await prisma.coveredService.create({
                    data: {
                      plan_id: plan.id,
                      facility_id: provider.id,
                      service_type_id: serviceType.id,
                      facility_price: service.price,
                      limit_count: null, // No frequency limit by default
                      status: 'ACTIVE' // Active by default, underwriting can deactivate
                    }
                  })
                  coveredServicesCreated++
                }
              } catch (error) {
                console.error(`Failed to create covered service for plan ${plan.name}:`, error)
              }
            }
          }

          if (coveredServicesCreated > 0) {
            console.log(`✅ Auto-created ${coveredServicesCreated} covered service records across ${allPlans.length} plans`)
          }
        }
      } catch (syncError) {
        const warning = syncError instanceof Error ? syncError.message : "Covered service sync failed after upload"
        console.error("Post-upload covered service sync failed:", syncError)
        warnings.push(`Covered service sync warning: ${warning}`)
      }
    }

    // Create audit log without failing the successful upload response.
    try {
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "TARIFF_PLAN_BULK_UPLOAD",
          resource: "tariff_plan_services",
          resource_id: `bulk_${Date.now()}`,
          new_values: {
            total_processed: totalProcessed,
            new_services: newCount,
            updated_services: updatedCount,
            services: services.slice(0, 5) // Log first 5 services as sample
          },
        },
      })
    } catch (auditError) {
      console.error("Tariff services uploaded but audit log failed:", auditError)
      warnings.push("Audit log warning: upload completed but audit logging failed")
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${totalProcessed} services (${newCount} new, ${updatedCount} updated)`,
      processedCount: totalProcessed,
      newCount: newCount,
      updatedCount: updatedCount,
      data: services,
      services: services.slice(0, 10), // Return first 10 services as preview
      warnings
    })

  } catch (error) {
    console.error("Error processing bulk upload:", error)
    return NextResponse.json(
      { error: "Failed to process bulk upload" },
      { status: 500 }
    )
  }
}

function parseTariffWorkbook(buffer: ArrayBuffer): { services: ParsedTariffService[]; error?: any } {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

  if (data.length < 2) {
    return {
      services: [],
      error: { error: "File must contain at least a header row and one data row" },
    }
  }

  const headers = data[0] as string[]
  const headerMap: Record<string, number> = {}
  headers.forEach((header, index) => {
    const normalizedHeader = String(header || '').trim().toLowerCase()
    headerMap[normalizedHeader] = index
  })

  const serviceNameIndex = headerMap['service name'] ?? headerMap['service_name'] ?? 0
  const servicePriceIndex = headerMap['service price'] ?? headerMap['service_price'] ?? headerMap['price'] ?? 1
  const categoryIdIndex = headerMap['category id'] ?? headerMap['category_id'] ?? 2
  const serviceTypeIndex = headerMap['service type'] ?? headerMap['service_type'] ?? 3

  const requiredHeaders = ['Service Name', 'Service Price']
  const missingHeaders = requiredHeaders.filter((header) => {
    const normalized = header.toLowerCase().replace(/\s+/g, '_')
    const normalizedWithSpace = header.toLowerCase()
    return headerMap[normalized] === undefined && headerMap[normalizedWithSpace] === undefined
  })

  if (missingHeaders.length > 0) {
    return {
      services: [],
      error: {
        error: `Missing required columns: ${missingHeaders.join(', ')}`,
        expected: requiredHeaders,
        found: headers,
      },
    }
  }

  const services: ParsedTariffService[] = []
  const errors: string[] = []

  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    try {
      const serviceName = String(row[serviceNameIndex] || '').trim()
      const categoryId = row[categoryIdIndex] ? String(row[categoryIdIndex]).trim() : ''
      const price = Number(row[servicePriceIndex]) || 0
      const serviceTypeValue = row[serviceTypeIndex] ? String(row[serviceTypeIndex]).trim() : ''
      const serviceType = serviceTypeValue === '1' ? 1 : null

      const serviceId = serviceName
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')

      if (!serviceName) {
        errors.push(`Row ${i + 1}: Missing Service Name`)
        continue
      }

      const validCategories = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '15', '17', '18', '19', '21', '22', '23', '24']
      const finalCategoryId = categoryId && validCategories.includes(categoryId) ? categoryId : '10'

      services.push({
        service_id: serviceId,
        service_name: serviceName,
        category_id: finalCategoryId,
        category_name: getCategoryName(finalCategoryId),
        price,
        service_type: serviceType,
        status: 'ACTIVE',
      })
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (errors.length > 0) {
    return {
      services: [],
      error: {
        error: "Validation errors found in uploaded file",
        errors: errors.slice(0, 20),
        totalErrors: errors.length,
        message: `Found ${errors.length} validation error(s). Please fix the errors and try again.`,
      },
    }
  }

  return { services }
}

async function replaceProviderTariffServices(providerId: string, services: ParsedTariffService[]) {
  if (!services.length) {
    throw new Error("Cannot replace tariff services with an empty payload")
  }

  await prisma.$transaction(async (tx) => {
    const latestPlan = await tx.tariffPlan.findFirst({
      where: { provider_id: providerId },
      orderBy: { created_at: 'desc' },
    })

    const editableStatuses = ['DRAFT', 'REJECTED', 'IN_PROGRESS']
    const requiresNewVersion = !latestPlan || !editableStatuses.includes((latestPlan.status || '').toUpperCase())

    const tariffPlan = requiresNewVersion
      ? await tx.tariffPlan.create({
          data: {
            provider_id: providerId,
            status: 'DRAFT',
            version: latestPlan ? latestPlan.version + 1 : 1,
          },
        })
      : latestPlan

    const deletedCount = await tx.tariffPlanService.deleteMany({
      where: { provider_id: providerId },
    })
    console.log(`🗑 Deleted ${deletedCount.count} old tariff services for provider ${providerId}`)

    await tx.tariffPlanService.createMany({
      data: services.map((service) => ({
        ...service,
        provider_id: providerId,
        tariff_plan_id: tariffPlan.id,
        is_draft: true,
      })),
      skipDuplicates: true,
    })
  })
}

function getCategoryName(categoryId: string): string {
  const categories: Record<string, string> = {
    '1': 'Admission',
    '2': 'Caesarian section / Normal Delivery',
    '3': 'Fertility',
    '4': 'Advanced Diagnostic Imaging',
    '5': 'Physiotherapy',
    '6': 'Surgery',
    '7': 'Cancer Care',
    '8': 'Dialysis',
    '9': 'Specialist Consultation',
    '10': 'Others',
    '11': 'Optical Care',
    '12': 'Dental Care',
    '15': 'Advanced Lab',
    '17': 'ICU',
    '18': 'Neonate Care',
    '19': 'Mental Care',
    '21': 'MRI',
    '22': 'CT-SCAN',
    '23': 'Accommodation for In-Patient Care',
    '24': 'Drugs'
  }
  return categories[categoryId] || 'Others'
}
