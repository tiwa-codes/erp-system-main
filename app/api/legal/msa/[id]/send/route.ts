import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { notificationService } from "@/lib/notifications"
import { generateMsaPdfBuffer } from "@/lib/msa-pdf"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "legal", "send_msa")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params

    // Get MSA
    const msa = await prisma.mSA.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            address: true,
            email: true,
            phone_whatsapp: true,
            hmo_coordinator_email: true,
          },
        },
        tariff_plan: {
          select: {
            id: true,
            version: true,
          },
        },
      },
    })

    if (!msa) {
      return NextResponse.json(
        { error: "MSA not found" },
        { status: 404 }
      )
    }

    const services = await prisma.tariffPlanService.findMany({
      where: {
        tariff_plan_id: msa.tariff_plan_id,
        status: "ACTIVE",
      },
      select: {
        service_name: true,
        category_name: true,
        price: true,
      },
      orderBy: {
        service_name: "asc",
      },
    })

    const pdfBytes = await generateMsaPdfBuffer({
      msaId: msa.id,
      tariffPlanId: msa.tariff_plan.id,
      version: msa.tariff_plan.version,
      provider: {
        facility_name: msa.provider.facility_name,
        address: msa.provider.address,
        email: msa.provider.email,
        phone_whatsapp: msa.provider.phone_whatsapp,
      },
      services,
      generatedAt: msa.generated_at || new Date(),
      commenceDate: msa.generated_at || new Date(),
      cjhSignatoryName: session.user.name || "Authorized Signatory",
      cjhSignatoryTitle: "Legal Department, Crown Jewel HMO",
    })

    const safeName = (msa.provider.facility_name || "provider")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
    const attachmentFileName = `msa-${safeName}-${msa.id}.pdf`

    const documentUrl = `/api/legal/msa/${msa.id}/document`
    if (msa.document_url !== documentUrl) {
      await prisma.mSA.update({
        where: { id: msa.id },
        data: {
          document_url: documentUrl,
        },
      })
    }

    // Send email with MSA document
    const emailSubject = `Medical Service Agreement (MSA) - ${msa.provider.facility_name}`
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Medical Service Agreement (MSA)</h2>
        <p>Dear ${msa.provider.facility_name},</p>
        <p>Please find attached your Medical Service Agreement (MSA) for your approved tariff plan.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Agreement Details</h3>
          <p><strong>Provider:</strong> ${msa.provider.facility_name}</p>
          <p><strong>Provider Address:</strong> ${msa.provider.address || "N/A"}</p>
          <p><strong>Tariff Plan Version:</strong> ${msa.tariff_plan.version}</p>
          <p><strong>Commencement Date:</strong> ${msa.generated_at ? new Date(msa.generated_at).toLocaleDateString() : "N/A"}</p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">
            <strong>Action Required:</strong> Please review and sign the attached MSA document.
            Once signed, please return it to us for final processing.
          </p>
        </div>

        <p>You may also view/download the document in ERP:</p>
        <p><a href="${process.env.NEXTAUTH_URL || "https://crownjewelhmo.sbfy360.com"}${documentUrl}" target="_blank" rel="noopener noreferrer">View MSA Document</a></p>
        
        <p>If you have any questions about this agreement, please contact our Legal Department.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    // Send email to provider
    const emails = [msa.provider.email]
    if (msa.provider.hmo_coordinator_email && msa.provider.hmo_coordinator_email !== msa.provider.email) {
      emails.push(msa.provider.hmo_coordinator_email)
    }

    for (const email of emails) {
      await notificationService.sendEmail({
        to: email,
        subject: emailSubject,
        html: emailHtml,
        attachments: [
          {
            filename: attachmentFileName,
            content: Buffer.from(pdfBytes),
            contentType: "application/pdf",
          },
        ],
      })
    }

    // Update MSA status
    const updatedMSA = await prisma.mSA.update({
      where: { id },
      data: {
        status: "SENT",
        signed_at: msa.signed_at || new Date(),
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "MSA_SEND",
        resource: "msa",
        resource_id: id,
        new_values: { status: "SENT" },
      },
    })

    return NextResponse.json({
      success: true,
      message: "MSA sent successfully",
      msa: updatedMSA,
    })
  } catch (error) {
    console.error("Error sending MSA:", error)
    return NextResponse.json(
      { error: "Failed to send MSA" },
      { status: 500 }
    )
  }
}

