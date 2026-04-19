import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { notificationService } from "@/lib/notifications"

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

        if (!reason || !reason.trim()) {
            return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
        }

        // Get the registration
        const registration = await prisma.principalRegistration.findUnique({
            where: { id: params.id },
            include: {
                organization: true,
                plan: true,
            },
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
        await prisma.principalRegistration.update({
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

        // Send rejection email
        try {
            await notificationService.sendEmail({
                to: registration.email,
                subject: "Principal Registration - Action Required",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px;">Registration Requires Attention</h1>
                        </div>
                        
                        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                            <p style="font-size: 16px;">Dear ${registration.first_name} ${registration.last_name},</p>
                            <p>Thank you for your interest in enrolling with Crown Jewel HMO. After reviewing your registration, we need you to address the following:</p>
                            
                            <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                                <h3 style="margin-top: 0; color: #991b1b;">Reason for Review:</h3>
                                <p style="color: #7f1d1d; margin: 0;">${reason}</p>
                            </div>
                            
                            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                                    📋 Your Submitted Details
                                </h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Name:</strong></td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${registration.first_name} ${registration.middle_name || ''} ${registration.last_name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Organization:</strong></td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${registration.organization?.name || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0;"><strong>Plan:</strong></td>
                                        <td style="padding: 10px 0; text-align: right;">${registration.plan?.name || 'N/A'}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                                <h4 style="margin-top: 0; color: #92400e;">
                                    📌 Next Steps
                                </h4>
                                <ul style="margin: 10px 0; padding-left: 20px; color: #78350f;">
                                    <li>Review the reason above carefully</li>
                                    <li>Gather the required information or corrections</li>
                                    <li>Contact our support team for assistance</li>
                                    <li>Resubmit your registration with the necessary updates</li>
                                </ul>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                If you have any questions or need clarification, please contact our support team. We're here to help you complete your enrollment.
                            </p>
                        </div>
                        
                        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; margin-top: 20px; border-radius: 8px;">
                            <p style="color: #6b7280; font-size: 12px; margin: 0;">
                                This is an automated message from Crown Jewel HMO ERP System.<br>
                                Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                `,
            })
        } catch (emailError) {
            console.error("Failed to send rejection email:", emailError)
            // Don't fail the rejection if email fails
        }

        return NextResponse.json({
            success: true,
            message: "Principal registration rejected",
        })
    } catch (error) {
        console.error("Error rejecting registration:", error)
        return NextResponse.json(
            { error: "Failed to reject registration" },
            { status: 500 }
        )
    }
}
