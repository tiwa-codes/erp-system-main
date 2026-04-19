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

        // Generate enrollee ID
        const orgCode = registration.organization?.code?.toUpperCase() || "UNK"

        // Use centralized ID generator
        const { getNextGlobalEnrolleeId } = await import("@/lib/utils/id-generator")
        const enrolleeId = await getNextGlobalEnrolleeId(orgCode)

        // Create principal account
        const principal = await prisma.principalAccount.create({
            data: {
                enrollee_id: enrolleeId,
                first_name: registration.first_name,
                last_name: registration.last_name,
                middle_name: registration.middle_name,
                gender: registration.gender.toUpperCase() as any,
                date_of_birth: registration.date_of_birth,
                phone_number: registration.phone_number,
                email: registration.email,
                residential_address: registration.residential_address,
                profile_picture: registration.profile_picture,
                organization_id: registration.organization_id!,
                plan_id: registration.plan_id,
                account_type: "PRINCIPAL",
                primary_hospital: registration.primary_hospital,
                hospital_address: registration.hospital_address,
                status: "ACTIVE",
                created_by_id: session.user.id,
            },
        })

        // Update registration status
        await prisma.principalRegistration.update({
            where: { id: params.id },
            data: {
                status: "APPROVED",
                approved_at: new Date(),
                approved_by: {
                    connect: { id: session.user.id }
                },
            },
        })

        // Send approval email
        try {
            await notificationService.sendEmail({
                to: registration.email,
                subject: "Principal Registration Approved - Welcome to Aspirage",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px;">✓ Registration Approved!</h1>
                        </div>
                        
                        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                            <p style="font-size: 16px;">Dear ${registration.first_name} ${registration.last_name},</p>
                            <p>Congratulations! Your principal registration has been approved. You are now enrolled in our healthcare system.</p>
                            
                            <div style="background-color: white; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #10b981;">
                                <h2 style="margin-top: 0; color: #10b981; text-align: center;">Your Enrollee ID</h2>
                                <div style="text-align: center; background-color: #d1fae5; padding: 20px; border-radius: 6px; margin: 15px 0;">
                                    <span style="font-size: 32px; font-weight: bold; color: #065f46; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                                        ${enrolleeId}
                                    </span>
                                </div>
                                <p style="text-align: center; color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
                                    Please keep this ID safe - you'll need it for all healthcare services
                                </p>
                            </div>
                            
                            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                                    📋 Your Details
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
                                        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Plan:</strong></td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${registration.plan?.name || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0;"><strong>Status:</strong></td>
                                        <td style="padding: 10px 0; text-align: right;"><span style="background-color: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 12px; font-weight: bold;">ACTIVE</span></td>
                                    </tr>
                                </table>
                            </div>
                            
                            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                                <h4 style="margin-top: 0; color: #1e40af;">
                                    📌 Next Steps
                                </h4>
                                <ul style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
                                    <li>Keep your Enrollee ID safe and accessible</li>
                                    <li>Present your ID when accessing healthcare services</li>
                                    <li>Contact our call centre for any assistance</li>
                                    <li>Review your plan benefits and coverage</li>
                                </ul>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                If you have any questions, please contact our support team.
                            </p>
                        </div>
                        
                        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; margin-top: 20px; border-radius: 8px;">
                            <p style="color: #6b7280; font-size: 12px; margin: 0;">
                                This is an automated message from Aspirage ERP System.<br>
                                Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                `,
            })
        } catch (emailError) {
            console.error("Failed to send approval email:", emailError)
            // Don't fail the approval if email fails
        }

        return NextResponse.json({
            success: true,
            message: "Principal registration approved successfully",
            principal: {
                id: principal.id,
                enrollee_id: principal.enrollee_id,
            },
        })
    } catch (error) {
        console.error("Error approving registration:", error)
        return NextResponse.json(
            { error: "Failed to approve registration" },
            { status: 500 }
        )
    }
}
