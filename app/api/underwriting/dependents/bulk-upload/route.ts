import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { appendDependentUtilizationImport } from "@/lib/underwriting/utilization-imports"
import * as XLSX from 'xlsx'

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

function normalizeNameParts(firstName?: string | null, lastName?: string | null, fullName?: string | null): {
  firstName: string | null
  lastName: string | null
  fullName: string | null
} {
  const clean = (value?: string | null) => {
    if (!hasValue(value)) return null
    return String(value).trim().replace(/\s+/g, " ")
  }

  let normalizedFirst = clean(firstName)
  let normalizedLast = clean(lastName)
  const normalizedFullFromColumn = clean(fullName)

  if ((!normalizedFirst || !normalizedLast) && normalizedFullFromColumn) {
    const parts = normalizedFullFromColumn.split(" ").filter(Boolean)
    if (parts.length >= 2) {
      normalizedFirst = normalizedFirst || parts[0]
      normalizedLast = normalizedLast || parts.slice(1).join(" ")
    } else if (parts.length === 1 && !normalizedFirst && !normalizedLast) {
      normalizedFirst = parts[0]
      normalizedLast = parts[0]
    }
  }

  const normalizedFull = clean(
    normalizedFullFromColumn ||
      [normalizedFirst, normalizedLast].filter(Boolean).join(" ")
  )

  return {
    firstName: normalizedFirst,
    lastName: normalizedLast,
    fullName: normalizedFull,
  }
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

const VALID_RELATIONSHIPS = new Set([
  "SPOUSE",
  "SON",
  "DAUGHTER",
  "PARENT",
  "SIBLING",
  "OTHER",
  "EXTRA_DEPENDENT",
])

function normalizeRelationship(value?: string | null, genderValue?: string | null): string | null {
  if (!value) return null
  const raw = value.trim().toUpperCase()

  if (raw === "CHILD") {
    const normalizedGender = (genderValue || "").trim().toUpperCase()
    if (normalizedGender === "FEMALE" || normalizedGender === "F") return "DAUGHTER"
    if (normalizedGender === "MALE" || normalizedGender === "M") return "SON"
    return "SON"
  }

  const map: Record<string, string> = {
    SPOUSE: "SPOUSE",
    WIFE: "SPOUSE",
    HUSBAND: "SPOUSE",
    SON: "SON",
    DAUGHTER: "DAUGHTER",
    BOY: "SON",
    GIRL: "DAUGHTER",
    FATHER: "PARENT",
    MOTHER: "PARENT",
    PARENT: "PARENT",
    SIBLING: "SIBLING",
    BROTHER: "SIBLING",
    SISTER: "SIBLING",
    OTHER: "OTHER"
  }
  return map[raw] || raw
}

function buildShortIdentifierSuffix(identifier: string): string | null {
  const trimmed = identifier.trim()
  if (!/^\d+$/.test(trimmed) || trimmed.length > 6) {
    return null
  }

  return `/${trimmed.padStart(3, '0')}`
}

async function findDependentByUploadIdentifier(identifier: string) {
  const trimmedIdentifier = identifier.trim()
  const shortSuffix = buildShortIdentifierSuffix(trimmedIdentifier)

  const directMatch = await prisma.dependent.findFirst({
    where: {
      OR: [
        { id: trimmedIdentifier },
        { dependent_id: trimmedIdentifier }
      ]
    },
    select: {
      id: true,
      dependent_id: true,
      principal_id: true,
      email: true
    }
  })

  if (directMatch) {
    return directMatch
  }

  if (!shortSuffix) {
    return null
  }

  const suffixMatches = await prisma.dependent.findMany({
    where: {
      dependent_id: {
        endsWith: shortSuffix,
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      dependent_id: true,
      principal_id: true,
      email: true
    },
    take: 2
  })

  if (suffixMatches.length === 1) {
    return suffixMatches[0]
  }

  return null
}

async function findDependentByPrincipalAndName(options: {
  principalId: string
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
}) {
  const normalized = normalizeNameParts(options.firstName, options.lastName, options.fullName)
  const firstName = normalized.firstName
  const lastName = normalized.lastName
  const fullName = normalized.fullName

  if (!firstName && !lastName && !fullName) {
    return null
  }

  if (firstName && lastName) {
    const strictMatches = await prisma.dependent.findMany({
      where: {
        principal_id: options.principalId,
        first_name: { equals: firstName, mode: "insensitive" },
        last_name: { equals: lastName, mode: "insensitive" },
      },
      select: {
        id: true,
        dependent_id: true,
        principal_id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
      take: 2,
    })

    if (strictMatches.length === 1) return strictMatches[0]
    if (strictMatches.length > 1) return "AMBIGUOUS"
  }

  const matches = await prisma.dependent.findMany({
    where: {
      principal_id: options.principalId
    },
    select: {
      id: true,
      dependent_id: true,
      principal_id: true,
      email: true,
      first_name: true,
      last_name: true,
    }
  })

  const normalizedMatch = (value: string | null | undefined) =>
    (value || "").trim().replace(/\s+/g, " ").toLowerCase()

  const targetNames = new Set(
    [fullName, [firstName, lastName].filter(Boolean).join(" ")]
      .map((value) => normalizedMatch(value))
      .filter(Boolean)
  )

  const byName = matches.filter((item) => {
    const candidateFullName = normalizedMatch(`${item.first_name || ""} ${item.last_name || ""}`)
    return targetNames.has(candidateFullName)
  })

  if (byName.length === 1) return byName[0]
  if (byName.length > 1) return "AMBIGUOUS"
  return null
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
    select: {
      id: true,
      enrollee_id: true,
      organization: { select: { name: true, code: true } }
    }
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
    select: {
      id: true,
      enrollee_id: true,
      organization: { select: { name: true, code: true } }
    },
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
    const dependents = XLSX.utils.sheet_to_json(worksheet)

    if (!dependents || !Array.isArray(dependents)) {
      return NextResponse.json({ error: 'Invalid dependents data' }, { status: 400 })
    }

    const results = {
      success: [],
      errors: [],
      duplicates: []
    }

    for (let i = 0; i < dependents.length; i++) {
      const dependent = dependents[i]
      const rowNumber = i + 1

      try {
        // Flexible columns
        const dependentName = getFirstValue(dependent, ['dependent_name', 'Dependent Name', 'name', 'Name'])
        const firstNameValue = getFirstValue(dependent, ['first_name', 'First Name', 'firstName'])
        const lastNameValue = getFirstValue(dependent, ['last_name', 'Last Name', 'lastName'])
        const normalizedName = normalizeNameParts(
          hasValue(firstNameValue) ? String(firstNameValue) : null,
          hasValue(lastNameValue) ? String(lastNameValue) : null,
          hasValue(dependentName) ? String(dependentName) : null
        )
        const firstName = normalizedName.firstName
        const lastName = normalizedName.lastName
        const middleName = getFirstValue(dependent, ['middle_name', 'Middle Name', 'middleName'])
        const gender = getFirstValue(dependent, ['gender', 'Gender'])
        const phoneNumber = getFirstValue(dependent, ['phone_number', 'Phone Number', 'phoneNumber'])
        const email = getFirstValue(dependent, ['email', 'Email'])
        const residentialAddress = getFirstValue(dependent, ['residential_address', 'Residential Address', 'residentialAddress', 'Address'])
        const state = getFirstValue(dependent, ['state', 'State'])
        const lga = getFirstValue(dependent, ['lga', 'LGA'])
        const region = getFirstValue(dependent, ['region', 'Region'])
        const profilePicture = getFirstValue(dependent, ['profile_picture', 'Profile Picture', 'profilePicture'])
        const identifier = getFirstValue(dependent, ['id', 'ID', 'dependent_id', 'Dependent ID', 'dependentId', 'Enrollee ID'])
        let principalId = getFirstValue(dependent, ['principal_id', 'principalId', 'Principal ID', 'principal_enrollee_id', 'Principal Enrollee ID'])
        const relationshipRaw = getFirstValue(dependent, ['relationship', 'Relationship'])
        const normalizedGenderForRelationship = hasValue(gender) ? String(gender) : null
        const relationship = normalizeRelationship(
          hasValue(relationshipRaw) ? String(relationshipRaw) : null,
          normalizedGenderForRelationship
        )
        const utilizationPeriodValue = getFirstValue(dependent, ['period', 'Period'])
        const utilizationValue = getFirstValue(dependent, ['utilization', 'Utilization', 'old_utilization', 'Old Utilization'])

        // Parse optional date of birth
        let dateOfBirth: Date | null = null
        const dateOfBirthValue = getFirstValue(dependent, ['date_of_birth', 'Date of Birth', 'dateOfBirth'])
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

        if (relationship && !VALID_RELATIONSHIPS.has(relationship)) {
          results.errors.push({
            row: rowNumber,
            error: `Invalid relationship '${relationshipRaw}'. Allowed values: SPOUSE, SON, DAUGHTER, PARENT, SIBLING, OTHER, EXTRA_DEPENDENT (or CHILD).`
          })
          continue
        }

        if (!identifier || String(identifier).trim() === '') {
          results.errors.push({
            row: rowNumber,
            error: 'Dependent ID is required'
          })
          continue
        }

        if (!principalId || String(principalId).trim() === '') {
          results.errors.push({
            row: rowNumber,
            error: 'Principal ID (or Principal Enrollee ID) is required'
          })
          continue
        }

        // Resolve existing dependent by identifier (ID is identifier for updates)
        let existingDependentByIdentifier: any = null
        if (identifier) {
          existingDependentByIdentifier = await findDependentByUploadIdentifier(String(identifier))
        }

        // Use the extracted principalId from above

        let principal
        if (principalId && String(principalId).trim() !== '') {
          const principalValue = String(principalId).trim()
          principal = await findPrincipalByUploadIdentifier(principalValue)

          if (!principal) {
            results.errors.push({
              row: rowNumber,
              error: `Principal '${principalValue}' not found`
            })
            continue
          }

          principalId = principal.id
        }

        // If dependent ID is from an old system, allow principal-ID + dependent name matching.
        if (!existingDependentByIdentifier && principalId && (hasValue(firstName) || hasValue(lastName) || hasValue(dependentName))) {
          const matchedByName = await findDependentByPrincipalAndName({
            principalId: String(principalId),
            firstName: hasValue(firstName) ? String(firstName) : null,
            lastName: hasValue(lastName) ? String(lastName) : null,
            fullName: hasValue(dependentName) ? String(dependentName) : null,
          })

          if (matchedByName === "AMBIGUOUS") {
            const attemptedName =
              [firstName, lastName].filter(Boolean).join(" ").trim() ||
              (hasValue(dependentName) ? String(dependentName).trim() : "provided dependent name")
            results.errors.push({
              row: rowNumber,
              error: `Multiple dependents with name '${attemptedName}' under principal '${String(principalId)}'. Use dependent ID for this row.`,
            })
            continue
          }

          if (matchedByName) {
            existingDependentByIdentifier = matchedByName
          }
        }

        if (existingDependentByIdentifier) {
          // Update existing dependent: only non-empty columns should overwrite.
          const updateData: any = {}
          if (hasValue(firstName)) updateData.first_name = String(firstName).trim()
          if (hasValue(lastName)) updateData.last_name = String(lastName).trim()
          if (hasValue(middleName)) updateData.middle_name = String(middleName).trim()
          if (hasValue(dateOfBirth)) updateData.date_of_birth = dateOfBirth
          if (hasValue(relationship)) updateData.relationship = relationship
          if (hasValue(gender)) updateData.gender = String(gender).trim().toUpperCase()
          if (hasValue(phoneNumber)) updateData.phone_number = String(phoneNumber).trim()
          if (hasValue(email)) updateData.email = String(email).trim()
          if (hasValue(residentialAddress)) updateData.residential_address = String(residentialAddress).trim()
          if (hasValue(state)) updateData.state = String(state).trim()
          if (hasValue(lga)) updateData.lga = String(lga).trim()
          if (hasValue(region)) updateData.region = String(region).trim()
          if (hasValue(profilePicture)) updateData.profile_picture = String(profilePicture).trim()
          if (hasValue(principalId)) updateData.principal_id = principalId

          // Email conflict check if changing email
          if (updateData.email && updateData.email !== existingDependentByIdentifier.email) {
            const emailInUse = await prisma.dependent.findFirst({
              where: {
                email: updateData.email,
                id: { not: existingDependentByIdentifier.id }
              },
              select: { id: true }
            })
            if (emailInUse) {
              results.errors.push({
                row: rowNumber,
                error: `Email '${updateData.email}' is already used by another dependent`
              })
              continue
            }
          }

          if (Object.keys(updateData).length === 0 && parsedUtilization === null) {
            results.success.push({
              row: rowNumber,
              dependent_id: existingDependentByIdentifier.dependent_id,
              name: `${firstName || 'Existing'} ${lastName || 'Record'}`.trim(),
              action: 'SKIPPED_NO_CHANGES'
            } as any)
            continue
          }

          const updatedDependent = await prisma.dependent.update({
            where: { id: existingDependentByIdentifier.id },
            data: updateData
          })

          if (parsedUtilization !== null && parsedUtilizationPeriod) {
            await appendDependentUtilizationImport(prisma, {
              dependentId: updatedDependent.id,
              periodLabel: parsedUtilizationPeriod,
              amount: parsedUtilization,
              userId: session.user.id,
            })
          }

          await prisma.auditLog.create({
            data: {
              user_id: session.user.id,
              action: 'BULK_UPDATE_DEPENDENT',
              resource: 'dependent',
              resource_id: updatedDependent.id,
              new_values: updateData
            }
          })

          results.success.push({
            row: rowNumber,
            dependent_id: updatedDependent.dependent_id,
            name: `${updatedDependent.first_name} ${updatedDependent.last_name}`,
            action: 'UPDATED'
          } as any)
          continue
        }

        // For new records, date of birth is still required by schema.
        if (!principalId || !dateOfBirth) {
          results.errors.push({
            row: rowNumber,
            error: 'Missing required fields for new record: principal_id/Principal Enrollee ID, date_of_birth/Date of Birth'
          })
          continue
        }

        // Dependent ID is required for deterministic updates/imports.
        const dependentId = String(identifier).trim()

        // Check if provided dependent_id already exists
        const existingDependent = await prisma.dependent.findUnique({
          where: { dependent_id: dependentId }
        })

        if (existingDependent) {
          results.errors.push({
            row: rowNumber,
            error: `Dependent ID '${dependentId}' already exists`
          })
          continue
        }

        // Create dependent
        const newDependent = await prisma.dependent.create({
          data: {
            dependent_id: String(dependentId).trim(),
            first_name: hasValue(firstName) ? String(firstName).trim() : '',
            last_name: hasValue(lastName) ? String(lastName).trim() : '',
            middle_name: hasValue(middleName) ? String(middleName).trim() : null,
            date_of_birth: dateOfBirth!,
            relationship: (relationship || 'OTHER') as any,
            gender: hasValue(gender) ? String(gender).trim().toUpperCase() as any : null,
            phone_number: hasValue(phoneNumber) ? String(phoneNumber).trim() : null,
            email: hasValue(email) ? String(email).trim() : null,
            residential_address: hasValue(residentialAddress) ? String(residentialAddress).trim() : null,
            state: hasValue(state) ? String(state).trim() : null,
            lga: hasValue(lga) ? String(lga).trim() : null,
            region: hasValue(region) ? String(region).trim() : null,
            profile_picture: hasValue(profilePicture) ? String(profilePicture).trim() : null,
            old_utilization: 0,
            principal_id: principalId,
            status: 'ACTIVE',
            created_by_id: session.user.id
          }
        })

        if (parsedUtilization !== null && parsedUtilizationPeriod) {
          await appendDependentUtilizationImport(prisma, {
            dependentId: newDependent.id,
            periodLabel: parsedUtilizationPeriod,
            amount: parsedUtilization,
            userId: session.user.id,
          })
        }

        // Create audit log
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: 'BULK_CREATE_DEPENDENT',
            resource: 'dependent',
            resource_id: newDependent.id,
            new_values: {
              dependent_id: newDependent.dependent_id,
              first_name: newDependent.first_name,
              last_name: newDependent.last_name,
              principal_id: newDependent.principal_id
            }
          }
        })

        results.success.push({
          row: rowNumber,
          dependent_id: newDependent.dependent_id,
          name: `${newDependent.first_name} ${newDependent.last_name}`.trim() || newDependent.dependent_id,
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
