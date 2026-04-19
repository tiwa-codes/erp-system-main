import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { checkPermission } from "@/lib/permissions"

/**
 * PATCH /api/clients-plans/:id/approve
 * Admin: Approve plan, set total price, and trigger invoice generation
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "settings", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const { total_price } = await req.json()

    if (!total_price || total_price <= 0) {
      return NextResponse.json(
        { error: "Valid total_price is required" },
        { status: 400 }
      )
    }

    // Get the plan
    const clientPlan = await prisma.clientPlan.findUnique({
      where: { id },
      include: {
        services: true,
        principal_account: {
          include: {
            user: true,
            organization: true,
          },
        },
        client_account: {
          include: {
            user: true,
            organization: true,
          },
        },
      },
    })

    if (!clientPlan) {
      return NextResponse.json(
        { error: "Client plan not found" },
        { status: 404 }
      )
    }

    if (clientPlan.status !== "PENDING" && clientPlan.status !== "REVIEW") {
      return NextResponse.json(
        { error: "Plan must be in PENDING or REVIEW status to approve" },
        { status: 400 }
      )
    }

    // Update plan to APPROVED
    const updatedPlan = await prisma.clientPlan.update({
      where: { id },
      data: {
        status: "APPROVED",
        total_price: total_price,
        approved_at: new Date(),
        approved_by_id: session.user.id,
      },
      include: {
        services: true,
        principal_account: true,
        organization: true,
      },
    })

    // Auto-generate invoice
    const invoiceNumber = `CPLAN-${Date.now()}`
    const invoiceOrganizationName =
      clientPlan.client_account?.organization?.name ||
      clientPlan.principal_account?.organization?.name ||
      "Aspirage"
    const invoiceClientName = clientPlan.client_account?.user
      ? `${clientPlan.client_account.user.first_name} ${clientPlan.client_account.user.last_name}`
      : clientPlan.principal_account
        ? `${clientPlan.principal_account.first_name} ${clientPlan.principal_account.last_name}`
        : "Client"
    const invoiceClientEmail =
      clientPlan.client_account?.user?.email || clientPlan.principal_account?.user?.email || ""

    const invoice = await prisma.clientPlanInvoice.create({
      data: {
        invoice_number: invoiceNumber,
        client_plan_id: id,
        organization_name: invoiceOrganizationName,
        client_name: invoiceClientName,
        client_email: invoiceClientEmail,
        total_amount: total_price,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: "PENDING",
        invoice_data: {
          client_plan_id: id,
          services: clientPlan.services,
          breakdown: {
            subtotal: total_price,
            tax: 0,
            total: total_price,
          },
        },
      },
    })

    // Update plan with invoice reference
    const finalPlan = await prisma.clientPlan.update({
      where: { id },
      data: {
        invoice_id: invoice.id,
        status: "INVOICED",
        invoice_sent_at: new Date(),
      },
      include: {
        services: true,
        invoice: true,
        organization: true,
        principal_account: {
          include: {
            user: {
              select: {
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
        },
        client_account: {
          include: {
            user: {
              select: {
                first_name: true,
                last_name: true,
                email: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    })

    // TODO: Send invoice email to client
    // sendInvoiceEmail(clientPlan.principal_account.user?.email, invoice)

    return NextResponse.json(
      {
        data: finalPlan,
        invoice,
        message: "Plan approved and invoice generated successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error approving plan:", error)
    return NextResponse.json(
      { error: "Failed to approve plan" },
      { status: 500 }
    )
  }
}
