import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { generateMsaPdfBuffer } from "@/lib/msa-pdf"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasLegalView = await checkPermission(session.user.role as any, "legal", "view")
    const hasProviderTariffManage = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    const hasProviderTariffApprove = await checkPermission(session.user.role as any, "provider", "approve_tariff_plan")
    const hasExecutiveApprove = await checkPermission(session.user.role as any, "executive-desk", "approve")

    if (!hasLegalView && !hasProviderTariffManage && !hasProviderTariffApprove && !hasExecutiveApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const isAdminRole = ["ADMIN", "SUPER_ADMIN"].includes((session.user.role || "").toUpperCase())
    const shouldRegenerate = request.nextUrl.searchParams.get("regenerate") === "true"

    if (shouldRegenerate && !isAdminRole) {
      return NextResponse.json({ error: "Only admins can regenerate MSA documents" }, { status: 403 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: "MSA ID is required" }, { status: 400 })
    }

    const msaInclude = {
      provider: {
        select: {
          id: true,
          facility_name: true,
          address: true,
          email: true,
          phone_whatsapp: true,
        },
      },
      tariff_plan: {
        select: {
          id: true,
          version: true,
        },
      },
      generated_by: {
        select: {
          first_name: true,
          last_name: true,
        },
      },
    }

    let msa = await prisma.mSA.findUnique({
      where: { id },
      include: msaInclude,
    })

    if (!msa) {
      return NextResponse.json({ error: "MSA not found" }, { status: 404 })
    }

    if (shouldRegenerate) {
      msa = await prisma.mSA.update({
        where: { id },
        data: {
          generated_at: new Date(),
          generated_by_id: session.user.id,
        },
        include: msaInclude,
      })

      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "MSA_REGENERATE",
          resource: "msa",
          resource_id: msa.id,
          new_values: {
            generated_at: msa.generated_at,
          },
        },
      })
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
      tariffPlanId: msa.tariff_plan_id,
      version: msa.tariff_plan?.version,
      provider: msa.provider,
      services,
      generatedAt: msa.generated_at || new Date(),
      commenceDate: msa.generated_at || new Date(),
      cjhSignatoryName:
        [msa.generated_by?.first_name, msa.generated_by?.last_name]
          .filter(Boolean)
          .join(" ") || "Authorized Signatory",
      cjhSignatoryTitle: "Crown Jewel HMO",
    })

    const safeName = (msa.provider.facility_name || "provider")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"msa-${safeName}-${msa.id}.pdf\"`,
      },
    })
  } catch (error) {
    console.error("Error generating MSA PDF:", error)
    return NextResponse.json({ error: "Failed to generate MSA PDF" }, { status: 500 })
  }
}
