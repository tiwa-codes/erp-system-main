import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { transitionTariffPlanStage } from "@/lib/tariff-plan-workflow"
import { sendTariffPlanApprovalNotification } from "@/lib/notifications"
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

    const [hasProviderPermission, hasExecutivePermission] = await Promise.all([
      checkPermission(session.user.role as any, "provider", "approve_tariff_plan"),
      checkPermission(session.user.role as any, "executive-desk", "approve"),
    ])

    if (!hasProviderPermission && !hasExecutivePermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json().catch(() => ({}))
    const comments =
      typeof body?.comments === "string" && body.comments.trim().length > 0
        ? body.comments.trim()
        : undefined
    if (!id) {
      return NextResponse.json({ error: "Tariff plan ID is required" }, { status: 400 })
    }

    const result = await transitionTariffPlanStage({
      id,
      currentStage: "MD",
      nextStage: "COMPLETE",
      nextStatus: "COMPLETE",
      extraData: {
        approved_by_id: session.user.id
      }
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 })
    }

    await prisma.tariffPlanService.updateMany({
      where: { tariff_plan_id: id },
      data: {
        is_draft: false,
        status: "ACTIVE"
      }
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_STAGE_MD_APPROVED",
        resource: "tariff_plan",
        resource_id: id,
        new_values: {
          approval_stage: "COMPLETE",
          status: "COMPLETE",
          comments: comments || null,
        }
      }
    })

    // Trigger notifications and MSA generation asynchronously so approval response is fast.
    void (async () => {
      try {
        await sendTariffPlanApprovalNotification({
          tariffPlan: result.tariffPlan,
          provider: result.tariffPlan.provider,
          approvedBy: result.tariffPlan.approved_by || undefined,
          comments,
        })
      } catch (emailError) {
        console.error("Failed to send MD approval notification:", emailError)
      }

      try {
        let msa = await prisma.mSA.findFirst({
          where: {
            provider_id: result.tariffPlan.provider_id,
            tariff_plan_id: id,
          },
        })

        if (!msa) {
          msa = await prisma.mSA.create({
            data: {
              provider_id: result.tariffPlan.provider_id,
              tariff_plan_id: id,
              document_url: "",
              status: "GENERATED",
              generated_at: new Date(),
              generated_by_id: session.user.id,
            },
          })
        }

        const services = await prisma.tariffPlanService.findMany({
          where: {
            tariff_plan_id: id,
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
          tariffPlanId: id,
          version: result.tariffPlan.version,
          provider: {
            facility_name: result.tariffPlan.provider?.facility_name || "Provider",
            address: result.tariffPlan.provider?.address,
            email: result.tariffPlan.provider?.email,
            phone_whatsapp: result.tariffPlan.provider?.phone_whatsapp,
          },
          services,
          generatedAt: msa.generated_at || new Date(),
          commenceDate: msa.generated_at || new Date(),
          approvalComment: comments,
          cjhSignatoryName: session.user.name || "Authorized Signatory",
          cjhSignatoryTitle: "Managing Director, Aspirage",
        })

        const safeName = (result.tariffPlan.provider?.facility_name || "provider")
          .replace(/[^a-zA-Z0-9-_]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase()
        const attachmentFileName = `msa-${safeName}-${msa.id}.pdf`

        const documentUrl = `/api/legal/msa/${msa.id}/document`
        await prisma.mSA.update({
          where: { id: msa.id },
          data: {
            document_url: documentUrl,
          },
        })

        const providerEmail = result.tariffPlan.provider?.email
        const coordinatorEmail = result.tariffPlan.provider?.hmo_coordinator_email
        const recipients = [providerEmail, coordinatorEmail].filter(
          (v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i
        )

        const appUrl = process.env.NEXTAUTH_URL || "https://aspirage.com"
        const msaSubject = `MSA Approval - ${result.tariffPlan.provider?.facility_name || "Provider"}`
        const msaHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
            <h2 style="color: #0f766e;">Medical Service Agreement (MSA) Approved</h2>
            <p>Dear ${result.tariffPlan.provider?.facility_name || "Provider"},</p>
            <p>Your tariff submission has been approved by Executive Desk (MD).</p>
            <p>Your MSA has been generated and attached to this email.</p>
            <ul>
              <li><strong>Tariff Plan ID:</strong> ${id}</li>
              <li><strong>Approval Date:</strong> ${new Date().toLocaleString()}</li>
              <li><strong>MSA Record ID:</strong> ${msa.id}</li>
              <li><strong>Commencement Date:</strong> ${(msa.generated_at || new Date()).toLocaleDateString()}</li>
              <li><strong>Provider Address:</strong> ${result.tariffPlan.provider?.address || "N/A"}</li>
            </ul>
            ${
              comments
                ? `<p><strong>MD Comment:</strong> ${comments}</p>`
                : ""
            }
            <p>You can also access the same document in the ERP system:</p>
            <p><a href="${appUrl}${documentUrl}" target="_blank" rel="noopener noreferrer">View MSA Document</a></p>
            <p style="color: #6b7280; font-size: 12px;">This is an automated message from Aspirage ERP.</p>
          </div>
        `

        for (const to of recipients) {
          await notificationService.sendEmail({
            to,
            subject: msaSubject,
            html: msaHtml,
            attachments: [
              {
                filename: attachmentFileName,
                content: Buffer.from(pdfBytes),
                contentType: "application/pdf",
              },
            ],
          })
        }

        await prisma.mSA.update({
          where: { id: msa.id },
          data: {
            status: "SENT",
            signed_at: new Date(),
          },
        })
      } catch (msaError) {
        console.error("Failed to generate/send MSA after MD approval:", msaError)
      }
    })()

    return NextResponse.json({
      success: true,
      message: "Tariff plan approved by MD. MSA dispatch has started.",
      tariffPlan: result.tariffPlan
    })
  } catch (error) {
    console.error("Error approving tariff plan at MD stage:", error)
    return NextResponse.json({ error: "Failed to approve tariff plan" }, { status: 500 })
  }
}
