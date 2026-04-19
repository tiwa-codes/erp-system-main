import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { appendPrincipalUtilizationImport } from "@/lib/underwriting/utilization-imports"
import * as XLSX from 'xlsx'

const BULK_UPLOAD_ORG_CODE = "BULK_UPLOAD_QUEUE"

type BulkUploadOrg = {
  id: string
  name: string
  code: string
}

async function ensureBulkUploadOrganization(): Promise<BulkUploadOrg> {
  const existing = await prisma.organization.findFirst({
    where: { code: BULK_UPLOAD_ORG_CODE },
    select: { id: true, name: true, code: true },
  })

  if (existing) {
    return existing
  }

  return prisma.organization.create({
    data: {
      organization_id: `BULK-${Date.now()}`,
      name: "Bulk Upload Queue",
      code: BULK_UPLOAD_ORG_CODE,
      type: "CORPORATE",
      contact_info: { origin: "bulk_upload", created_at: new Date().toISOString() },
      status: "ACTIVE",
    },
    select: { id: true, name: true, code: true },
  })
}

function mapAccountType(userAccountType?: string): string {
  if (!userAccountType) return 'PRINCIPAL'

  const accountType = userAccountType.trim().toUpperCase()

  switch (accountType) {
    case 'INDIVIDUAL':
    case 'PRINCIPAL':
      return 'PRINCIPAL'
    case 'FAMILY':
    case 'DEPENDENT':
      return 'PRINCIPAL' // Family accounts are still stored as PRINCIPAL in the database
    case 'PROVIDER':
      return 'PROVIDER'
    default:
      return 'PRINCIPAL' // Default fallback
  }
}

function hasValue(value: any): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return true
  return String(value).trim() !== ''
}

function getFirstValue(row: any, keys: string[]): any {
  for (const key of keys) {
    if (key in row && hasValue(row[key])) {
      return row[key]
    }
  }
  return null
}

function parseSpreadsheetDate(value: any): Date | null {
  if (!hasValue(value)) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === "number") {
    const excelDate = XLSX.SSF.parse_date_code(value)
    if (!excelDate) return null

    return new Date(Date.UTC(excelDate.y, excelDate.m - 1, excelDate.d))
  }

  const raw = String(value).trim()
  if (!raw) return null

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (slashMatch) {
    const [, first, second, year] = slashMatch
    const firstNumber = Number(first)
    const secondNumber = Number(second)

    // Prefer day/month/year for slash-separated spreadsheet values.
    const day = firstNumber
    const month = secondNumber

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const parsed = new Date(Date.UTC(Number(year), month - 1, day))
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
  }

  const fallback = new Date(raw)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function parseUtilizationValue(value: any): number | null {
  if (!hasValue(value)) return null

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  const normalized = String(value).replace(/[^0-9.-]/g, "").trim()
  if (!normalized) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseUtilizationPeriod(value: any): string | null {
  if (!hasValue(value)) return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })
  }

  if (typeof value === "number") {
    const excelDate = XLSX.SSF.parse_date_code(value)
    if (excelDate) {
      return new Date(Date.UTC(excelDate.y, excelDate.m - 1, excelDate.d)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    }
  }

  const raw = String(value).trim()
  if (!raw) return null

  const parsedDate = new Date(raw)
  if (!Number.isNaN(parsedDate.getTime())) {
    const looksLikeDate = /[\d/-]/.test(raw) || /^[a-zA-Z]+\s+\d{4}$/i.test(raw)
    if (looksLikeDate) {
      return parsedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    }
  }

  return raw.replace(/\s+/g, " ")
}

function buildShortIdentifierSuffix(identifier: string): string | null {
  const trimmed = identifier.trim()
  if (!/^\d+$/.test(trimmed) || trimmed.length > 6) {
    return null
  }

  return `/${trimmed.padStart(3, '0')}`
}

async function findPrincipalByUploadIdentifier(identifier: string) {
  const trimmedIdentifier = identifier.trim()
  const shortSuffix = buildShortIdentifierSuffix(trimmedIdentifier)

  const directMatch = await prisma.principalAccount.findFirst({
    where: {
      OR: [
        { id: trimmedIdentifier },
        { enrollee_id: trimmedIdentifier }
      ]
    },
    select: { id: true, enrollee_id: true, email: true }
  })

  if (directMatch) {
    return directMatch
  }

  if (!shortSuffix) {
    return null
  }

  const suffixMatches = await prisma.principalAccount.findMany({
    where: {
      enrollee_id: {
        endsWith: shortSuffix,
        mode: 'insensitive'
      }
    },
    select: { id: true, enrollee_id: true, email: true },
    take: 2
  })

  if (suffixMatches.length === 1) {
    return suffixMatches[0]
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAdd = await checkPermission(session.user.role as any, 'underwriting', 'add')
    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read Excel file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const enrollees = XLSX.utils.sheet_to_json(worksheet)

    if (!enrollees || !Array.isArray(enrollees)) {
      return NextResponse.json({ error: 'No data found in the file' }, { status: 400 })
    }

    const results = {
      success: [] as any[],
      errors: [] as any[],
      duplicates: [] as any[]
    }
    let fallbackOrg: BulkUploadOrg | null = null

    for (let i = 0; i < enrollees.length; i++) {
      const enrollee: any = enrollees[i]
      const rowNumber = i + 1

      try {
        // Flexible columns
        const firstName = getFirstValue(enrollee, ['first_name', 'First Name', 'firstName'])
        const lastName = getFirstValue(enrollee, ['last_name', 'Last Name', 'lastName'])
        const middleName = getFirstValue(enrollee, ['middle_name', 'Middle Name', 'middleName'])
        const gender = getFirstValue(enrollee, ['gender', 'Gender'])
        const age = getFirstValue(enrollee, ['age', 'Age'])
        const profilePicture = getFirstValue(enrollee, ['profile_picture', 'Profile Picture', 'profilePicture'])
        const maritalStatus = getFirstValue(enrollee, ['marital_status', 'Marital Status', 'maritalStatus'])
        const region = getFirstValue(enrollee, ['region', 'Region'])
        const state = getFirstValue(enrollee, ['state', 'State'])
        const lga = getFirstValue(enrollee, ['lga', 'LGA'])
        const phoneNumber = getFirstValue(enrollee, ['phone_number', 'Phone Number', 'phoneNumber'])
        const email = getFirstValue(enrollee, ['email', 'Email'])
        const residentialAddress = getFirstValue(enrollee, ['residential_address', 'Address', 'Residential Address', 'residentialAddress'])
        const primaryHospital = getFirstValue(enrollee, ['primary_hospital', 'Primary Hospital', 'primaryHospital'])
        const accountType = getFirstValue(enrollee, ['account_type', 'Account Type', 'accountType'])
        const startDateValue = getFirstValue(enrollee, ['start_date', 'Start Date', 'startDate'])
        const endDateValue = getFirstValue(enrollee, ['end_date', 'End Date', 'endDate'])
        const utilizationPeriodValue = getFirstValue(enrollee, ['period', 'Period'])
        const utilizationValue = getFirstValue(enrollee, ['utilization', 'Utilization', 'old_utilization', 'Old Utilization'])
        const identifier = getFirstValue(enrollee, ['id', 'ID', 'enrollee_id', 'Enrollee ID', 'enrolleeId'])
        let organizationId = getFirstValue(enrollee, ['organization_id', 'organizationId', 'Organization ID', 'organization_code', 'Organization Code'])

        // Resolve existing record first (ID is identifier for updates)
        let existingPrincipal: any = null
        if (identifier) {
          existingPrincipal = await findPrincipalByUploadIdentifier(String(identifier))
        }

        let organization
        if (organizationId && String(organizationId).trim() !== '') {
          // Check if it's an organization code (short string like "CC") or organization ID (long string)
          const orgValue = String(organizationId).trim()
          const isOrgCode = /^[A-Z]{2,5}$/i.test(orgValue)

          if (isOrgCode) {
            // Find organization by code
            organization = await prisma.organization.findFirst({
              where: {
                code: {
                  equals: orgValue.toUpperCase(),
                  mode: 'insensitive'
                }
              },
              select: { id: true, name: true, code: true }
            })

            if (!organization) {
              results.errors.push({
                row: rowNumber,
                error: `Organization code '${orgValue}' not found`
              })
              continue
            }

            organizationId = organization.id
          } else {
            // It's an organization ID, check if it exists
            organization = await prisma.organization.findUnique({
              where: { id: orgValue },
              select: { id: true, name: true, code: true }
            })

            if (!organization) {
              results.errors.push({
                row: rowNumber,
                error: `Organization ID '${orgValue}' not found`
              })
              continue
            }
          }
        } else if (!existingPrincipal) {
          if (!fallbackOrg) {
            fallbackOrg = await ensureBulkUploadOrganization()
          }

          organization = fallbackOrg
          organizationId = organization.id
        }

        // Handle plan_id - either use provided ID or find by name
        let planId = getFirstValue(enrollee, ['plan_id', 'planId', 'Plan ID', 'plan_name', 'Plan Name'])
        if (planId && String(planId).trim() !== '') {
          const planValue = String(planId).trim()
          // Check if it's a plan name (contains letters/spaces) or plan ID (numeric)
          const isPlanName = /[a-zA-Z\s\-]/.test(planValue)

          if (isPlanName) {
            // Find plan by name
            const plan = await prisma.plan.findFirst({
              where: {
                name: {
                  equals: planValue,
                  mode: 'insensitive'
                }
              },
              select: { id: true, name: true }
            })

            if (!plan) {
              results.errors.push({
                row: rowNumber,
                error: `Plan '${planValue}' not found`
              })
              continue
            }

            planId = plan.id
          } else {
            // It's a plan ID, check if it exists
            const plan = await prisma.plan.findUnique({
              where: { plan_id: planValue },
              select: { id: true, name: true }
            })

            if (!plan) {
              results.errors.push({
                row: rowNumber,
                error: `Plan ID '${planValue}' not found`
              })
              continue
            }
            planId = plan.id
          }
        } else {
          planId = null
        }

        // Parse optional dates (only apply when provided)
        let dateOfBirth: Date | null = null
        const dateOfBirthValue = getFirstValue(enrollee, ['date_of_birth', 'Date of Birth', 'dateOfBirth'])
        if (hasValue(dateOfBirthValue)) {
          const parsedDate = parseSpreadsheetDate(dateOfBirthValue)
          if (parsedDate && !isNaN(parsedDate.getTime())) {
            dateOfBirth = parsedDate
          } else {
            results.errors.push({
              row: rowNumber,
              error: `Invalid date format for date_of_birth: ${dateOfBirthValue}. Please use YYYY-MM-DD format.`
            })
            continue
          }
        }

        let parsedStartDate: Date | null = null
        if (hasValue(startDateValue)) {
          const parsedDate = parseSpreadsheetDate(startDateValue)
          if (parsedDate && !isNaN(parsedDate.getTime())) {
            parsedStartDate = parsedDate
          } else {
            results.errors.push({
              row: rowNumber,
              error: `Invalid date format for start_date: ${startDateValue}. Please use YYYY-MM-DD format.`
            })
            continue
          }
        }

        let parsedEndDate: Date | null = null
        if (hasValue(endDateValue)) {
          const parsedDate = parseSpreadsheetDate(endDateValue)
          if (parsedDate && !isNaN(parsedDate.getTime())) {
            parsedEndDate = parsedDate
          } else {
            results.errors.push({
              row: rowNumber,
              error: `Invalid date format for end_date: ${endDateValue}. Please use YYYY-MM-DD format.`
            })
            continue
          }
        }

        const parsedUtilization = parseUtilizationValue(utilizationValue)
        const parsedUtilizationPeriod =
          parseUtilizationPeriod(utilizationPeriodValue) ??
          (parsedUtilization !== null ? 'Old Utilization' : null)
        if (hasValue(utilizationValue) && parsedUtilization === null) {
          results.errors.push({
            row: rowNumber,
            error: `Invalid utilization value: ${utilizationValue}. Please provide a numeric amount.`
          })
          continue
        }

        if (existingPrincipal) {
          // Update existing principal: only overwrite fields that are provided (non-empty columns).
          const updateData: any = {}
          if (hasValue(firstName)) updateData.first_name = String(firstName).trim()
          if (hasValue(lastName)) updateData.last_name = String(lastName).trim()
          if (hasValue(middleName)) updateData.middle_name = String(middleName).trim()
          if (hasValue(gender)) updateData.gender = String(gender).trim().toUpperCase()
          if (hasValue(dateOfBirth)) updateData.date_of_birth = dateOfBirth
          if (hasValue(age)) updateData.age = Number(age)
          if (hasValue(profilePicture)) updateData.profile_picture = String(profilePicture).trim()
          if (hasValue(maritalStatus)) updateData.marital_status = String(maritalStatus).trim().toUpperCase()
          if (hasValue(region)) updateData.region = String(region).trim()
          if (hasValue(state)) updateData.state = String(state).trim()
          if (hasValue(lga)) updateData.lga = String(lga).trim()
          if (hasValue(phoneNumber)) updateData.phone_number = String(phoneNumber).trim()
          if (hasValue(email)) updateData.email = String(email).trim()
          if (hasValue(residentialAddress)) updateData.residential_address = String(residentialAddress).trim()
          if (hasValue(organizationId)) updateData.organization_id = organizationId
          if (hasValue(planId)) updateData.plan_id = planId
          if (hasValue(accountType)) updateData.account_type = mapAccountType(String(accountType))
          if (hasValue(primaryHospital)) updateData.primary_hospital = String(primaryHospital).trim()
          if (hasValue(parsedStartDate)) updateData.start_date = parsedStartDate
          if (hasValue(parsedEndDate)) updateData.end_date = parsedEndDate

          // Email conflict check when updating to a different email
          if (updateData.email && updateData.email !== existingPrincipal.email) {
            const emailInUse = await prisma.principalAccount.findFirst({
              where: {
                email: updateData.email,
                id: { not: existingPrincipal.id }
              },
              select: { id: true }
            })
            if (emailInUse) {
              results.errors.push({
                row: rowNumber,
                error: `Email '${updateData.email}' is already used by another enrollee`
              })
              continue
            }
          }

          if (Object.keys(updateData).length === 0 && parsedUtilization === null) {
            results.success.push({
              row: rowNumber,
              enrollee_id: existingPrincipal.enrollee_id,
              name: `${firstName || 'Existing'} ${lastName || 'Record'}`.trim(),
              action: 'SKIPPED_NO_CHANGES'
            })
            continue
          }

          const updatedPrincipal = await prisma.principalAccount.update({
            where: { id: existingPrincipal.id },
            data: updateData,
            include: {
              organization: { select: { id: true, name: true, code: true } },
              plan: { select: { id: true, name: true } }
            }
          })

          if (parsedUtilization !== null && parsedUtilizationPeriod) {
            await appendPrincipalUtilizationImport(prisma, {
              principalId: updatedPrincipal.id,
              periodLabel: parsedUtilizationPeriod,
              amount: parsedUtilization,
              userId: session.user.id,
            })
          }

          await prisma.auditLog.create({
            data: {
              user_id: session.user.id,
              action: 'BULK_UPDATE_PRINCIPAL',
              resource: 'principal_account',
              resource_id: updatedPrincipal.id,
              new_values: updateData
            }
          })

          results.success.push({
            row: rowNumber,
            enrollee_id: updatedPrincipal.enrollee_id,
            name: `${updatedPrincipal.first_name} ${updatedPrincipal.last_name}`,
            organization_name: updatedPrincipal.organization?.name,
            plan_name: updatedPrincipal.plan?.name,
            action: 'UPDATED'
          })
          continue
        }

        // Check if email already exists (if provided)
        if (email) {
          const existingEmail = await prisma.principalAccount.findFirst({
            where: { email: String(email).trim() },
            select: { id: true }
          })
          if (existingEmail) {
            results.duplicates.push({
              row: rowNumber,
              email: String(email).trim(),
              message: 'Enrollee already exists'
            })
            continue
          }
        }

        // Handle enrollee_id for create - either use provided ID or generate new one
        let enrolleeId = getFirstValue(enrollee, ['enrollee_id', 'enrolleeId', 'Enrollee ID', 'id', 'ID'])
        if (!enrolleeId || String(enrolleeId).trim() === '') {
          const orgCode = organization.code.toUpperCase()
          const { getNextGlobalEnrolleeId } = await import("@/lib/utils/id-generator")
          enrolleeId = await getNextGlobalEnrolleeId(orgCode)
        } else {
          const existingPrincipalById = await findPrincipalByUploadIdentifier(String(enrolleeId))
          if (existingPrincipalById) {
            results.errors.push({
              row: rowNumber,
              error: `Enrollee ID '${enrolleeId}' already exists`
            })
            continue
          }
        }

        // Create principal account
        const newPrincipal = await prisma.principalAccount.create({
          data: {
            enrollee_id: String(enrolleeId).trim(),
            first_name: hasValue(firstName) ? String(firstName).trim() : '',
            last_name: hasValue(lastName) ? String(lastName).trim() : '',
            middle_name: hasValue(middleName) ? String(middleName).trim() : null,
            gender: hasValue(gender) ? String(gender).trim().toUpperCase() : null,
            date_of_birth: dateOfBirth,
            age: hasValue(age) ? Number(age) : null,
            profile_picture: hasValue(profilePicture) ? String(profilePicture).trim() : null,
            marital_status: hasValue(maritalStatus) ? String(maritalStatus).trim().toUpperCase() : null,
            region: hasValue(region) ? String(region).trim() : null,
            state: hasValue(state) ? String(state).trim() : null,
            lga: hasValue(lga) ? String(lga).trim() : null,
            phone_number: hasValue(phoneNumber) ? String(phoneNumber).trim() : null,
            email: hasValue(email) ? String(email).trim() : null,
            residential_address: hasValue(residentialAddress) ? String(residentialAddress).trim() : null,
            organization_id: organizationId,
            plan_id: planId,
            account_type: mapAccountType(hasValue(accountType) ? String(accountType) : undefined),
            old_utilization: 0,
            auto_renewal: false, // Default to false
            primary_hospital: hasValue(primaryHospital) ? String(primaryHospital).trim() : null,
            start_date: parsedStartDate || new Date(), // Default to current date
            end_date: parsedEndDate || null, // Default to null (no end date)
            status: 'ACTIVE',
            created_by_id: session.user.id
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            plan: {
              select: {
                id: true,
                name: true,
              },
            },
          }
        })

        if (parsedUtilization !== null && parsedUtilizationPeriod) {
          await appendPrincipalUtilizationImport(prisma, {
            principalId: newPrincipal.id,
            periodLabel: parsedUtilizationPeriod,
            amount: parsedUtilization,
            userId: session.user.id,
          })
        }

        // Debug logging
        console.log(`Bulk upload - Created principal ${newPrincipal.enrollee_id}:`, {
          organization_id: newPrincipal.organization_id,
          organization_name: newPrincipal.organization?.name,
          plan_id: newPrincipal.plan_id,
          plan_name: newPrincipal.plan?.name,
        })

        // Create audit log
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: 'BULK_CREATE_PRINCIPAL',
            resource: 'principal_account',
            resource_id: newPrincipal.id,
            new_values: {
              enrollee_id: newPrincipal.enrollee_id,
              first_name: newPrincipal.first_name,
              last_name: newPrincipal.last_name,
              organization_id: newPrincipal.organization_id
            }
          }
        })

        results.success.push({
          row: rowNumber,
          enrollee_id: newPrincipal.enrollee_id,
          name: `${newPrincipal.first_name} ${newPrincipal.last_name}`.trim() || newPrincipal.enrollee_id,
          organization_name: newPrincipal.organization?.name,
          plan_name: newPrincipal.plan?.name,
          action: 'CREATED'
        })

      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error)
        results.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk upload completed. ${results.success.length} successful, ${results.errors.length} errors, ${results.duplicates.length} duplicates`,
      processedCount: results.success.length,
      data: results.success,
      results
    })

  } catch (error) {
    console.error('Error in bulk upload:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk upload' },
      { status: 500 }
    )
  }
}
