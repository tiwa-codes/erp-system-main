import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""

    const skip = (page - 1) * limit

    // Build where clause - show only encounter codes (exclude approval codes and manual codes)
    const where: any = {
      AND: [
        {
          NOT: {
            approval_code: {
              startsWith: "APR/"
            }
          }
        },
        {
          NOT: {
            approval_code: {
              startsWith: "APR-"
            }
          }
        },
        {
          NOT: {
            approval_code: {
              startsWith: "M-APR-"
            }
          }
        }
      ]
    }

    const trimmedSearch = search.trim()
    if (trimmedSearch) {
      // Search mode rules:
      // - Letters/mixed     → name/diagnosis fields (startsWith)
      // - Digits ≤ 6        → ID/code contains only (NOT phone)
      // - Digits ≥ 7 or starts with '0' → phone contains
      const isDigitOnly = /^\d+$/.test(trimmedSearch)
      const isPhoneSearch = isDigitOnly && (trimmedSearch.length >= 7 || trimmedSearch.startsWith('0'))
      const isIdSearch = isDigitOnly && !isPhoneSearch
      if (isIdSearch) {
        where.OR = [
          { approval_code: { contains: trimmedSearch, mode: "insensitive" } },
          { beneficiary_id: { contains: trimmedSearch, mode: "insensitive" } },
          {
            enrollee: {
              enrollee_id: { contains: trimmedSearch, mode: "insensitive" }
            }
          },
        ]
      } else if (isPhoneSearch) {
        where.OR = [
          { beneficiary_id: { contains: trimmedSearch, mode: "insensitive" } },
          {
            enrollee: {
              OR: [
                { enrollee_id: { contains: trimmedSearch, mode: "insensitive" } },
                { phone_number: { contains: trimmedSearch, mode: "insensitive" } },
              ]
            }
          },
        ]
      } else {
        where.OR = [
          { approval_code: { startsWith: trimmedSearch, mode: "insensitive" } },
          { enrollee_name: { startsWith: trimmedSearch, mode: "insensitive" } },
          { diagnosis: { startsWith: trimmedSearch, mode: "insensitive" } },
          {
            enrollee: {
              OR: [
                { first_name: { startsWith: trimmedSearch, mode: "insensitive" } },
                { last_name: { startsWith: trimmedSearch, mode: "insensitive" } },
              ]
            }
          },
        ]
      }
    }

    // Map status filter to encounter code statuses
    if (status && status !== "all") {
      if (status === "NEW") {
        where.status = "PENDING" // PENDING = Active for encounter codes
      } else if (status === "USED") {
        where.status = "APPROVED" // APPROVED = Used for encounter codes
      } else {
        where.status = status
      }
    }

    const [encounterCodes, total] = await Promise.all([
      prisma.approvalCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          enrollee: {
            select: {
              id: true,
              enrollee_id: true,
              first_name: true,
              last_name: true,
              organization: {
                select: {
                  name: true
                }
              },
              plan: {
                select: {
                  name: true
                }
              }
            }
          },
          generated_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true
            }
          }
        }
      }),
      prisma.approvalCode.count({ where })
    ])

    // Format encounter codes - remove hospital from response
    const formattedCodes = encounterCodes.map(code => ({
      id: code.id,
      encounter_code: code.approval_code,
      enrollee_name: code.enrollee_name,
      // Prefer beneficiary_id (actual ID string) over enrollee_id (relation ID)
      // Note: Cast as any because beneficiary_id is new field
      enrollee_id: (code as any).beneficiary_id || code.enrollee?.enrollee_id || '',
      organization: code.enrollee?.organization?.name || '',
      plan: code.enrollee?.plan?.name || '',
      services: code.services,
      amount: Number(code.amount),
      diagnosis: code.diagnosis,
      admission_required: code.admission_required,
      // Map status for encounter codes: PENDING -> NEW, APPROVED -> USED
      status: code.status === 'PENDING' ? 'NEW' : code.status === 'APPROVED' ? 'USED' : code.status,
      generated_by: `${code.generated_by?.first_name || ''} ${code.generated_by?.last_name || ''}`.trim(),
      created_at: code.created_at,
      updated_at: code.updated_at
    }))

    return NextResponse.json({
      success: true,
      encounter_codes: formattedCodes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching encounter codes:", error)
    return NextResponse.json(
      { error: "Failed to fetch encounter codes" },
      { status: 500 }
    )
  }
}
