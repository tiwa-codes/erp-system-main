import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const generateMSASchema = z.object({
  provider_id: z.string().min(1, "Provider ID is required"),
  tariff_plan_id: z.string().min(1, "Tariff plan ID is required"),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "legal", "manage_msa")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = generateMSASchema.parse(body)

    // Verify tariff plan is approved
    const tariffPlan = await prisma.tariffPlan.findUnique({
      where: { id: validatedData.tariff_plan_id },
      include: {
        provider: true,
        tariff_plan_services: {
          where: {
            status: "ACTIVE",
            is_draft: false,
          },
        },
      },
    })

    if (!tariffPlan) {
      return NextResponse.json(
        { error: "Tariff plan not found" },
        { status: 404 }
      )
    }

    if (tariffPlan.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Tariff plan must be approved before generating MSA" },
        { status: 400 }
      )
    }

    // Check if MSA already exists
    const existingMSA = await prisma.mSA.findFirst({
      where: {
        provider_id: validatedData.provider_id,
        tariff_plan_id: validatedData.tariff_plan_id,
      },
    })

    if (existingMSA) {
      return NextResponse.json(
        {
          error: "MSA already exists for this tariff plan",
          msa: existingMSA,
        },
        { status: 400 }
      )
    }

    // Generate MSA document (placeholder - actual document generation would use a template engine)
    // For now, we'll create the MSA record and store a placeholder URL
    const msaDocumentUrl = `/api/legal/msa/${Date.now()}/document.pdf` // Placeholder

    // Create MSA record
    const msa = await prisma.mSA.create({
      data: {
        provider_id: validatedData.provider_id,
        tariff_plan_id: validatedData.tariff_plan_id,
        document_url: msaDocumentUrl,
        status: "GENERATED",
        generated_at: new Date(),
        generated_by_id: session.user.id,
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "MSA_GENERATE",
        resource: "msa",
        resource_id: msa.id,
        new_values: msa,
      },
    })

    return NextResponse.json({
      success: true,
      msa,
      message: "MSA generated successfully",
    })
  } catch (error) {
    console.error("Error generating MSA:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to generate MSA" },
      { status: 500 }
    )
  }
}

