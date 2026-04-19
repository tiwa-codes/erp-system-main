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

        const registration = await prisma.dependentRegistration.findUnique({
            where: { id: params.id },
            include: {
                principal_registration: {
                    include: {
                        organization: true,
                        plan: true,
                    },
                },
                principal: {
                    include: {
                        organization: true,
                        plan: true,
                    },
                },
            },
        })

        if (!registration) {
            return NextResponse.json({ error: "Registration not found" }, { status: 404 })
        }

        // Rename principal_registration or principal to principal to match frontend expectations
        const response = {
            ...registration,
            principal: registration.principal_registration || registration.principal,
        }
        // Remove the original field to avoid confusion
        delete (response as any).principal_registration

        return NextResponse.json(response)
    } catch (error) {
        console.error("Error fetching dependent registration:", error)
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

        // Check if registration exists and is pending
        const existing = await prisma.dependentRegistration.findUnique({
            where: { id: params.id },
        })

        if (!existing) {
            return NextResponse.json({ error: "Registration not found" }, { status: 404 })
        }

        if (existing.status !== "PENDING") {
            return NextResponse.json(
                { error: "Can only edit pending registrations" },
                { status: 400 }
            )
        }

        // Update the registration
        const updated = await prisma.dependentRegistration.update({
            where: { id: params.id },
            data: {
                first_name: body.first_name,
                last_name: body.last_name,
                middle_name: body.middle_name,
                date_of_birth: body.date_of_birth ? new Date(body.date_of_birth) : undefined,
                gender: body.gender,
                relationship: body.relationship,
            },
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Error updating dependent registration:", error)
        return NextResponse.json(
            { error: "Failed to update registration" },
            { status: 500 }
        )
    }
}
