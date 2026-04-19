import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

interface RouteParams {
    params: {
        id: string
    }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const canView = await checkPermission(session.user.role as any, "underwriting", "view")
        if (!canView) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const registration = await prisma.principalRegistration.findUnique({
            where: { id: params.id },
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
                dependents: true,
            },
        })

        if (!registration) {
            return NextResponse.json({ error: "Registration not found" }, { status: 404 })
        }

        return NextResponse.json(registration)
    } catch (error) {
        console.error("Error fetching registration:", error)
        return NextResponse.json(
            { error: "Failed to fetch registration" },
            { status: 500 }
        )
    }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const canEdit = await checkPermission(session.user.role as any, "underwriting", "edit")
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()

        // Convert date_of_birth string to Date object if present
        const updateData: any = { ...body }
        if (updateData.date_of_birth && typeof updateData.date_of_birth === 'string') {
            updateData.date_of_birth = new Date(updateData.date_of_birth)
        }

        // Handle organization_id - convert to relation
        if (updateData.organization_id) {
            updateData.organization = {
                connect: { id: updateData.organization_id }
            }
            delete updateData.organization_id
        }

        // Handle plan_id - convert to relation
        if (updateData.plan_id) {
            updateData.plan = {
                connect: { id: updateData.plan_id }
            }
            delete updateData.plan_id
        }

        // Add review metadata
        updateData.reviewed_at = new Date()
        updateData.reviewed_by = {
            connect: { id: session.user.id }
        }

        const updatedRegistration = await prisma.principalRegistration.update({
            where: { id: params.id },
            data: updateData,
        })

        return NextResponse.json(updatedRegistration)
    } catch (error) {
        console.error("Error updating registration:", error)
        return NextResponse.json(
            { error: "Failed to update registration" },
            { status: 500 }
        )
    }
}
