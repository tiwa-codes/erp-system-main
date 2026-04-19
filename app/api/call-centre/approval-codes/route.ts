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
    const trimmedSearch = search.trim()
    const status = searchParams.get("status") || ""
    const startDate = searchParams.get("start_date") || ""
    const endDate = searchParams.get("end_date") || ""

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { is_deleted: false }

    if (trimmedSearch) {
      where.OR = [
        { approval_code: { startsWith: trimmedSearch, mode: "insensitive" } },
        { enrollee_name: { startsWith: trimmedSearch, mode: "insensitive" } },
        { hospital: { startsWith: trimmedSearch, mode: "insensitive" } },
        { diagnosis: { startsWith: trimmedSearch, mode: "insensitive" } },
        // beneficiary_id / enrollee_id use contains for partial ID match (e.g. "854" finds "CJH/001/854")
        { beneficiary_id: { contains: trimmedSearch, mode: "insensitive" } },
        {
          enrollee: {
            OR: [
              { enrollee_id: { contains: trimmedSearch, mode: "insensitive" } },
              { first_name: { startsWith: trimmedSearch, mode: "insensitive" } },
              { last_name: { startsWith: trimmedSearch, mode: "insensitive" } }
            ]
          }
        },
      ]
    }

    if (status && status !== "all") {
      where.status = status
    }

    if (startDate || endDate) {
      where.created_at = {}
      if (startDate) {
        where.created_at.gte = new Date(`${startDate}T00:00:00.000Z`)
      }
      if (endDate) {
        where.created_at.lte = new Date(`${endDate}T23:59:59.999Z`)
      }
    }

    const [approvalCodes, total] = await Promise.all([
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
              last_name: true,
              role: true
            }
          },
          service_items: {
            where: {
              is_deleted: false
            },
            select: {
              service_name: true,
              service_amount: true,
              quantity: true,
              category: true,
            }
          }
        }
      }),
      prisma.approvalCode.count({ where })
    ])

    const approvalCodeIds = approvalCodes.map((code) => code.id)
    const timelineRows = approvalCodeIds.length > 0
      ? await prisma.approvalCodeTimeline.findMany({
        where: {
          approval_code_id: { in: approvalCodeIds },
          stage: { in: ["APPROVED", "REJECTED"] }
        },
        orderBy: { timestamp: "desc" },
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true
            }
          }
        }
      })
      : []

    const latestApprovedByCodeId = new Map<string, string>()
    const latestRejectedByCodeId = new Map<string, string>()

    for (const timeline of timelineRows) {
      const actorName = `${timeline.user?.first_name || ""} ${timeline.user?.last_name || ""}`.trim()
      if (!actorName) continue

      if (timeline.stage === "APPROVED" && !latestApprovedByCodeId.has(timeline.approval_code_id)) {
        latestApprovedByCodeId.set(timeline.approval_code_id, actorName)
      }

      if (timeline.stage === "REJECTED" && !latestRejectedByCodeId.has(timeline.approval_code_id)) {
        latestRejectedByCodeId.set(timeline.approval_code_id, actorName)
      }
    }

    // Format approval codes
    const formattedCodes = approvalCodes.map(code => {
      const generatorName = `${code.generated_by?.first_name || ''} ${code.generated_by?.last_name || ''}`.trim()
      const safeGeneratorName = code.generated_by?.role === "PROVIDER" ? "" : generatorName

      return {
      id: code.id,
      approval_code: code.approval_code,
      enrollee_name: code.enrollee_name,
      enrollee_id: code.enrollee?.enrollee_id || '',
      organization: code.enrollee?.organization?.name || '',
      plan: code.enrollee?.plan?.name || '',
      hospital: code.hospital,
      services: code.services,
      amount: Number(code.amount),
      diagnosis: code.diagnosis,
      service_items: code.service_items.map((item) => ({
        service_name: item.service_name,
        service_amount: Number(item.service_amount),
        quantity: item.quantity,
        category: item.category,
      })),
      admission_required: code.admission_required,
      status: code.status,
      generated_by: safeGeneratorName,
      approved_by: latestApprovedByCodeId.get(code.id) || safeGeneratorName || null,
      rejected_by: latestRejectedByCodeId.get(code.id) || null,
      created_at: code.created_at,
      updated_at: code.updated_at
      }
    })

    return NextResponse.json({
      success: true,
      approval_codes: formattedCodes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching approval codes:", error)
    return NextResponse.json(
      { error: "Failed to fetch approval codes" },
      { status: 500 }
    )
  }
}
