import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { notificationService } from "@/lib/notifications"
import { hashPassword, generateRandomPassword } from "@/lib/auth-utils"
import * as XLSX from 'xlsx'

function getCredentialRecipients(emails: Array<string | null | undefined>): string[] {
  const cleaned = emails
    .map((value) => (value || "").trim().toLowerCase())
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has provider permissions
    const hasPermission = await checkPermission(session.user.role as any, "provider", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(`📤 Starting bulk upload for ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)

    // Read Excel file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const providers = XLSX.utils.sheet_to_json(worksheet)

    if (!providers || providers.length === 0) {
      console.error('❌ No data found in the file')
      return NextResponse.json({ error: 'No data found in the file' }, { status: 400 })
    }

    console.log(`📊 Found ${providers.length} rows to process`)

    const results = {
      success: [] as any[],
      errors: [] as any[],
      duplicates: [] as any[]
    }

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i] as any
      const rowNumber = i + 2 // +2 because Excel is 1-indexed and we skip header

      try {
        // Map new column names to database fields
        const facilityName = provider['Facility Name'] || provider.facility_name
        const facilityType = provider['Facility Type'] || provider.facility_type
        const region = provider['Region'] || provider.region
        const state = provider['State'] || provider.state
        const hospitalAddress = provider['Hospital Address'] || provider.address
        const email = provider['Email'] || provider.email
        // Convert phone numbers to strings (Excel may read them as numbers)
        const phoneContact = provider['Contact'] ? String(provider['Contact']) : (provider.phone_contact ? String(provider.phone_contact) : '')
        const whatsappContact = provider['Whatsapp Contact'] ? String(provider['Whatsapp Contact']) : (provider.phone_whatsapp ? String(provider.phone_whatsapp) : '')
        const band = provider['Band'] || provider.band

        // Validate required fields - Facility Name, Email, and Band are required
        if (!facilityName || !email || !band) {
          const missingFields = []
          if (!facilityName) missingFields.push('Facility Name')
          if (!email) missingFields.push('Email')
          if (!band) missingFields.push('Band')

          console.error(`❌ Row ${rowNumber}: Missing required fields: ${missingFields.join(', ')}`)
          results.errors.push({
            row: rowNumber,
            error: `Missing required fields: ${missingFields.join(', ')}`
          })
          continue
        }

        // Validate band value
        const validBands = ['A', 'B', 'C', 'D']
        if (!validBands.includes(band.toUpperCase())) {
          console.error(`❌ Row ${rowNumber}: Invalid band value '${band}'. Must be A, B, C, or D`)
          results.errors.push({
            row: rowNumber,
            error: `Invalid band value '${band}'. Must be A, B, C, or D`
          })
          continue
        }

        // Check for duplicate facility name
        const existingProvider = await prisma.provider.findFirst({
          where: { facility_name: facilityName }
        })

        if (existingProvider) {
          results.duplicates.push({
            row: rowNumber,
            facility_name: facilityName,
            reason: 'Facility name already exists'
          })
          continue
        }

        // Check for duplicate email
        const existingProviderEmail = await prisma.provider.findFirst({
          where: { email: email }
        })

        if (existingProviderEmail) {
          results.duplicates.push({
            row: rowNumber,
            facility_name: facilityName,
            reason: `Email ${email} already exists for another provider`
          })
          continue
        }

        // Prepare JSON fields
        const emergencyCareServices = provider.emergency_care_services
          ? provider.emergency_care_services.split(',').map((s: string) => s.trim()).filter(Boolean)
          : null

        const facilityTypeArray = facilityType
          ? (typeof facilityType === 'string' ? facilityType.split(',').map((s: string) => s.trim()).filter(Boolean) : [facilityType])
          : null

        const radiologyLabServices = provider.radiology_lab_services
          ? provider.radiology_lab_services.split(',').map((s: string) => s.trim()).filter(Boolean)
          : null

        const otherServices = provider.other_services
          ? provider.other_services.split(',').map((s: string) => s.trim()).filter(Boolean)
          : null

        // Generate unique provider_id (numeric ID)
        let nextProviderId: string
        let idAttempts = 0
        const maxIdAttempts = 5

        do {
          const lastProvider = await prisma.provider.findFirst({
            orderBy: { provider_id: 'desc' }
          })

          nextProviderId = lastProvider
            ? (parseInt(lastProvider.provider_id) + 1).toString()
            : '1'

          // Check if this ID already exists
          const existingId = await prisma.provider.findFirst({
            where: { provider_id: nextProviderId }
          })

          if (!existingId) {
            break // ID is unique, we can use it
          }

          idAttempts++
          if (idAttempts >= maxIdAttempts) {
            // Fallback to UUID-based ID if numeric generation fails
            nextProviderId = `PROV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            console.log(`Row ${rowNumber}: Using fallback provider ID: ${nextProviderId}`)
            break
          }

          // Add a small delay and try again
          await new Promise(resolve => setTimeout(resolve, 50))
        } while (idAttempts < maxIdAttempts)

        console.log(`Row ${rowNumber}: Creating provider with data:`, {
          provider_id: nextProviderId,
          facility_name: facilityName,
          email: email,
          band: band,
          phone_whatsapp: phoneContact || whatsappContact || null
        })

        // Create provider - using mapped variables
        const newProvider = await prisma.provider.create({
          data: {
            provider_id: nextProviderId,
            partnership_interest: provider.partnership_interest || "",
            facility_name: facilityName,
            address: hospitalAddress || "",
            phone_whatsapp: phoneContact || whatsappContact || "",
            email: email,
            band: band, // Required field
            medical_director_name: provider['Medical Director Name'] || provider.medical_director_name || "",
            hmo_coordinator_name: provider.hmo_coordinator_name || "",
            hmo_coordinator_phone: provider.hmo_coordinator_phone || "",
            hmo_coordinator_email: provider.hmo_coordinator_email || "",
            year_of_incorporation: provider.year_of_incorporation || "",
            facility_reg_number: provider.facility_reg_number || "",
            practice: provider.practice || "",
            proprietor_partners: provider.proprietor_partners || "",
            hcp_code: provider.hcp_code || null,
            hours_of_operation: provider.hours_of_operation || null,
            other_branches: provider.other_branches || null,
            emergency_care_services: emergencyCareServices,
            facility_type: facilityTypeArray,
            personnel_licensed: provider.personnel_licensed || null,
            blood_bank_available: provider.blood_bank_available || null,
            blood_sourcing_method: provider.blood_sourcing_method || null,
            radiology_lab_services: radiologyLabServices,
            other_services: otherServices,
            account_name: provider.account_name || null,
            account_number: provider.account_number || null,
            designation: provider.designation || null,
            date: provider.date ? new Date(provider.date) : null,
            cac_registration_url: provider.cac_registration_url || null,
            nhis_accreditation_url: provider.nhis_accreditation_url || null,
            professional_indemnity_url: provider.professional_indemnity_url || null,
            state_facility_registration_url: provider.state_facility_registration_url || null,
            selected_bands: [band], // Array of bands the provider is assigned to
            status: 'ACTIVE'
          }
        })

        console.log(`✅ Successfully created provider: ${newProvider.facility_name} (Row ${rowNumber})`)

        // Create user account and send login credentials
        let userCreated = false
        let emailSent = false
        try {
          // Check if user already exists with this email
          const existingUser = await prisma.user.findUnique({
            where: { email: email }
          })

          if (!existingUser) {
            // Find PROVIDER role
            const providerRole = await prisma.role.findFirst({
              where: { name: 'PROVIDER' }
            })

            if (providerRole) {
              // Generate temporary password
              const tempPassword = generateRandomPassword(12)
              const hashedPassword = await hashPassword(tempPassword)

              // Extract name from HMO coordinator or use facility name
              const coordinatorName = provider.hmo_coordinator_name || facilityName
              const nameParts = coordinatorName.split(' ')
              const firstName = nameParts[0] || 'Provider'
              const lastName = nameParts.slice(1).join(' ') || 'User'

              // Create user account
              const createdUser = await prisma.user.create({
                data: {
                  email: email,
                  first_name: firstName,
                  last_name: lastName,
                  phone_number: provider.hmo_coordinator_phone || phoneContact || whatsappContact,
                  role_id: providerRole.id,
                  provider_id: newProvider.id,
                  password: hashedPassword,
                  status: 'ACTIVE',
                  first_login: true
                },
                include: {
                  role: true,
                  provider: true
                }
              })

              // Log user creation
              try {
                await prisma.auditLog.create({
                  data: {
                    user_id: session.user.id,
                    action: 'USER_CREATED',
                    resource: 'user',
                    resource_id: createdUser.id,
                    new_values: {
                      email: createdUser.email,
                      role: 'PROVIDER',
                      provider_id: newProvider.id,
                      auto_created: true,
                      source: 'bulk_upload'
                    }
                  }
                })
              } catch (auditError) {
                console.error(`Failed to create audit log for user ${createdUser.email}:`, auditError)
                // Don't fail if audit log fails
              }

              // Send login credentials email (facility email + coordinator email when available)
              try {
                const recipients = getCredentialRecipients([
                  email,
                  provider.hmo_coordinator_email
                ])

                if (recipients.length === 0) {
                  console.error(`❌ [Row ${rowNumber}] No recipient email found for credentials`)
                } else {
                  let sentAny = false
                  for (const recipient of recipients) {
                    console.log(`[Row ${rowNumber}] Attempting to send login credentials to ${recipient}...`)
                    const sent = await notificationService.sendProviderLoginCredentials(
                      recipient,
                      `${firstName} ${lastName}`,
                      newProvider.facility_name,
                      tempPassword
                    )
                    sentAny = sentAny || sent
                    if (sent) {
                      console.log(`✅ [Row ${rowNumber}] Login credentials sent to ${recipient}`)
                    } else {
                      console.error(`❌ [Row ${rowNumber}] Credentials email failed for ${recipient}`)
                    }
                  }
                  emailSent = sentAny
                }
              } catch (emailError: any) {
                console.error(`❌ [Row ${rowNumber}] Failed to send email to ${email}:`, {
                  error: emailError.message,
                  code: emailError.code,
                  stack: emailError.stack?.split('\n').slice(0, 3)
                })
                // Don't fail bulk upload if email fails
              }

              userCreated = true
            } else {
              console.error('PROVIDER role not found in database')
            }
          } else {
            // User already exists, just link to provider if not already linked
            if (!existingUser.provider_id) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { provider_id: newProvider.id }
              })
              console.log(`Linked existing user ${existingUser.email} to provider ${newProvider.id}`)

              // Send notification to existing user about provider linkage
              try {
                const recipients = getCredentialRecipients([
                  email,
                  provider.hmo_coordinator_email
                ])
                let sentAny = false
                for (const recipient of recipients) {
                  console.log(`[Row ${rowNumber}] Sending provider linkage notification to ${recipient}...`)
                  const sent = await notificationService.sendProviderLinkageNotification(
                    recipient,
                    `${existingUser.first_name} ${existingUser.last_name}`,
                    newProvider.facility_name
                  )
                  sentAny = sentAny || sent
                  if (sent) {
                    console.log(`✅ [Row ${rowNumber}] Provider linkage notification sent to ${recipient}`)
                  } else {
                    console.error(`❌ [Row ${rowNumber}] Provider linkage notification failed for ${recipient}`)
                  }
                }
                emailSent = sentAny
              } catch (emailError: any) {
                console.error(`❌ [Row ${rowNumber}] Failed to send linkage notification to ${email}:`, {
                  error: emailError.message,
                  code: emailError.code
                })
                // Don't fail bulk upload if email fails
              }
            } else {
              console.log(`User ${existingUser.email} already linked to a provider (${existingUser.provider_id})`)
            }
          }
        } catch (userCreationError) {
          console.error(`Failed to create user account for provider ${newProvider.facility_name}:`, userCreationError)
          // Don't fail the bulk upload if user creation fails
        }

        results.success.push({
          id: newProvider.id,
          facility_name: newProvider.facility_name,
          email: newProvider.email,
          band: newProvider.band,
          selected_bands: newProvider.selected_bands,
          user_created: userCreated,
          email_sent: emailSent
        })

        console.log(`[Row ${rowNumber}] Summary:`, {
          facility: newProvider.facility_name,
          band: newProvider.band,
          user_created: userCreated,
          email_sent: emailSent
        })

      } catch (error) {
        const errorDetails = {
          row: rowNumber,
          facility_name: provider['Facility Name'] || provider.facility_name || 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
          code: (error as any).code,
          meta: (error as any).meta
        }
        console.error(`❌ [Row ${rowNumber}] Error:`, errorDetails)
        results.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
          facility_name: provider['Facility Name'] || provider.facility_name || 'Unknown'
        })
      }
    }

    console.log(`\n📈 Bulk Upload Summary:`)
    console.log(`   ✅ Successful: ${results.success.length}`)
    console.log(`   ❌ Errors: ${results.errors.length}`)
    console.log(`   ⚠️  Duplicates: ${results.duplicates.length}`)

    // Count email statistics
    const emailsSent = results.success.filter(r => r.email_sent).length
    const usersCreated = results.success.filter(r => r.user_created).length
    console.log(`   📧 Emails sent: ${emailsSent}/${results.success.length}`)
    console.log(`   👤 Users created: ${usersCreated}/${results.success.length}`)

    if (results.errors.length > 0) {
      console.log(`\n❌ Error Details:`)
      results.errors.forEach(err => {
        console.log(`   Row ${err.row}: ${err.error}`)
      })
    }

    return NextResponse.json({
      success: true,
      message: `Bulk upload completed. ${results.success.length} successful, ${results.errors.length} errors, ${results.duplicates.length} duplicates`,
      processedCount: results.success.length,
      data: results.success,
      results
    })

  } catch (error) {
    console.error("Error in bulk upload:", error)
    return NextResponse.json(
      { error: "Failed to process bulk upload" },
      { status: 500 }
    )
  }
}
