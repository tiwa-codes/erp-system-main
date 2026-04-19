import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Check permissions
        const hasPermission = await checkPermission(session.user.role as any, "call-centre", "edit")
        if (!hasPermission) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
        }

        const { id } = params

        // Verify request exists and is rejected
        const providerRequest = await prisma.providerRequest.findUnique({
            where: { id }
        })

        if (!providerRequest) {
            return NextResponse.json({ error: "Provider request not found" }, { status: 404 })
        }

        // Allow retracting REJECTED or PARTIAL requests (since they contain rejections)
        // Actually, user asked for "if a request from a hospital was rejected (All the services)"
        // So strictly REJECTED is safer, but PARTIAL might also need retraction?
        // Let's stick to REJECTED or PARTIAL as they both imply some rejection logic was applied.
        // However, for "Retract", it implies undoing the whole decision.
        // If it's PARTIAL, it means an Approval Code was likely generated for the approved part.
        // Retracting a PARTIAL request would be messy (need to void the approval code?).
        // Let's restrict to 'REJECTED' for now as per user request "All the services".

        if (providerRequest.status !== 'REJECTED') {
            return NextResponse.json({
                error: "Only rejected requests can be retracted. This request is " + providerRequest.status
            }, { status: 400 })
        }

        // Update status to PENDING and clear rejection info
        const updatedRequest = await prisma.providerRequest.update({
            where: { id },
            data: {
                status: 'PENDING',
                rejection_reason: null, // Clear the overall rejection reason
                // We probably should keep the rejected services JSON in rejection_reason HISTORY, 
                // but for now, making it PENDING effectively wipes the decision.
                // Prisma doesn't strictly require clearing it, but it's cleaner.
            }
        })

        // Create audit log
        await prisma.auditLog.create({
            data: {
                user_id: session.user.id,
                action: "PROVIDER_REQUEST_RETRACTED",
                resource: "provider_request",
                resource_id: providerRequest.id,
                old_values: providerRequest as any, // Cast to any to avoid strict JSON type issues if they arise
                new_values: updatedRequest as any
            }
        })

        return NextResponse.json({
            success: true,
            message: "Request retracted successfully",
            data: updatedRequest
        })

    } catch (error) {
        console.error("Error retracting provider request:", error)
        return NextResponse.json(
            { error: "Failed to retract provider request" },
            { status: 500 }
        )
    }
}
