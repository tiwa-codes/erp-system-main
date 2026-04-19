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

        // Check permission
        const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
        if (!hasPermission) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "10")
        const search = searchParams.get("search") || ""
        const trimmedSearch = search.trim()

        const skip = (page - 1) * limit

        // Build where clause - only soft-deleted codes
        const where: any = { is_deleted: true }

        if (trimmedSearch) {
            where.OR = [
                { approval_code: { startsWith: trimmedSearch, mode: "insensitive" } },
                { enrollee_name: { startsWith: trimmedSearch, mode: "insensitive" } },
                { hospital: { startsWith: trimmedSearch, mode: "insensitive" } },
                { deletion_reason: { contains: trimmedSearch, mode: "insensitive" } },
                {
                    enrollee: {
                        OR: [
                            { enrollee_id: { startsWith: trimmedSearch, mode: "insensitive" } },
                            { first_name: { startsWith: trimmedSearch, mode: "insensitive" } },
                            { last_name: { startsWith: trimmedSearch, mode: "insensitive" } },
                        ],
                    },
                },
            ]
        }

        const [deletedCodes, total] = await Promise.all([
            prisma.approvalCode.findMany({
                where,
                skip,
                take: limit,
                orderBy: { deleted_at: "desc" },
                include: {
                    enrollee: {
                        select: {
                            id: true,
                            enrollee_id: true,
                            first_name: true,
                            last_name: true,
                            organization: {
                                select: { name: true },
                            },
                            plan: {
                                select: { name: true },
                            },
                        },
                    },
                    generated_by: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                    deleted_by: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                },
            }),
            prisma.approvalCode.count({ where }),
        ])

        // Format deleted codes
        const formattedCodes = deletedCodes.map((code) => ({
            id: code.id,
            approval_code: code.approval_code,
            enrollee_name: code.enrollee_name,
            enrollee_id: code.enrollee?.enrollee_id || "",
            organization: code.enrollee?.organization?.name || "",
            plan: code.enrollee?.plan?.name || "",
            hospital: code.hospital,
            services: code.services,
            amount: Number(code.amount),
            diagnosis: code.diagnosis,
            status: code.status,
            generated_by: `${code.generated_by?.first_name || ""} ${code.generated_by?.last_name || ""}`.trim(),
            created_at: code.created_at,
            deleted_at: code.deleted_at,
            deleted_by: `${code.deleted_by?.first_name || ""} ${code.deleted_by?.last_name || ""}`.trim(),
            deletion_reason: code.deletion_reason,
        }))

        return NextResponse.json({
            success: true,
            deleted_approval_codes: formattedCodes,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error("Error fetching deleted approval codes:", error)
        return NextResponse.json(
            { error: "Failed to fetch deleted approval codes" },
            { status: 500 }
        )
    }
}
