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

export async function POST(request: NextRequest, { params }: RouteParams) {
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
        const { reason } = body

        if (!reason) {
            return NextResponse.json(
                { error: "Rejection reason is required" },
                { status: 400 }
            )
        }

        // Get the registration
        const registration = await prisma.dependentRegistration.findUnique({
            where: { id: params.id },
        })

        if (!registration) {
            return NextResponse.json({ error: "Registration not found" }, { status: 404 })
        }

        if (registration.status !== "PENDING") {
            return NextResponse.json(
                { error: "Registration has already been processed" },
                { status: 400 }
            )
        }

        // Update registration status
        await prisma.dependentRegistration.update({
            where: { id: params.id },
            data: {
                status: "REJECTED",
                rejected_at: new Date(),
                rejected_by: {
                    connect: { id: session.user.id }
                },
                rejection_reason: reason,
            },
        })

        // TODO: Send rejection email with reason

        return NextResponse.json({
            success: true,
            message: "Dependent registration rejected",
        })
    } catch (error) {
        console.error("Error rejecting dependent registration:", error)
        return NextResponse.json(
            { error: "Failed to reject registration" },
            { status: 500 }
        )
    }
}
