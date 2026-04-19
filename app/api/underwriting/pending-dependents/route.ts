import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const canView = await checkPermission(session.user.role as any, "underwriting", "view")
        if (!canView) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get("search") || ""
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "10")

        const where: any = {
            status: "PENDING",
        }

        if (search) {
            where.OR = [
                { first_name: { contains: search, mode: "insensitive" } },
                { last_name: { contains: search, mode: "insensitive" } },
            ]
        }

        const [registrations, total] = await Promise.all([
            prisma.dependentRegistration.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { submitted_at: "desc" },
                include: {
                    principal_registration: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            status: true,
                        },
                    },
                    principal: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            enrollee_id: true,
                            status: true,
                        },
                    },
                },
            }),
            prisma.dependentRegistration.count({ where }),
        ])

        return NextResponse.json({
            registrations,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error("Error fetching pending dependents:", error)
        return NextResponse.json(
            { error: "Failed to fetch pending dependents" },
            { status: 500 }
        )
    }
}
