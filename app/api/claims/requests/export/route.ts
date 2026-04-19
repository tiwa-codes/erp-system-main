import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "claims", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const provider = searchParams.get("provider") || ""
    const startDate = searchParams.get("start_date") || ""
    const endDate = searchParams.get("end_date") || ""

    const where: any = {}

    if (user.role?.name === "PROVIDER" && user.provider_id) {
      where.provider_id = user.provider_id
    } else if (provider && provider !== "all") {
      where.provider_id = provider
    }

    if (search) {
      where.OR = [
        { enrollee_id: { contains: search, mode: "insensitive" } },
        { claim_number: { contains: search, mode: "insensitive" } },
        {
          principal: {
            OR: [
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
              { enrollee_id: { contains: search, mode: "insensitive" } },
            ],
          },
        },
        { provider: { facility_name: { contains: search, mode: "insensitive" } } },
        {
          approval_codes: {
            some: {
              OR: [
                { approval_code: { contains: search, mode: "insensitive" } },
                { services: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ]
    }

    if (status && status !== "all") {
      const normalizedStatus = status.toUpperCase()
      if (normalizedStatus === "NEW") {
        where.status = "NEW"
      } else if (normalizedStatus === "APPROVED") {
        where.status = "APPROVED"
      } else if (normalizedStatus === "PAID") {
        where.status = "PAID"
      } else if (normalizedStatus === "REJECTED") {
        where.status = "REJECTED"
      } else if (normalizedStatus === "PENDING") {
        where.NOT = { status: { in: ["NEW", "APPROVED", "PAID", "REJECTED"] } }
      }
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null
      const end = endDate ? new Date(endDate) : null

      if (start) start.setHours(0, 0, 0, 0)
      if (end) end.setHours(23, 59, 59, 999)

      where.created_at = {
        ...(start ? { gte: start } : {}),
        ...(end ? { lte: end } : {}),
      }
    }

    const claims = await prisma.claim.findMany({
      where,
      include: {
        principal: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true,
          },
        },
        provider: {
          select: {
            facility_name: true,
            facility_type: true,
          },
        },
        approval_codes: {
          select: {
            service_items: {
              select: {
                service_name: true,
              },
            },
            services: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    })

    const mapProviderStatus = (rawStatus: string) => {
      if (rawStatus === "NEW") return "NEW"
      if (rawStatus === "APPROVED") return "APPROVED"
      if (rawStatus === "PAID") return "PAID"
      if (rawStatus === "REJECTED") return "REJECTED"
      return "PENDING"
    }

    const csvHeaders = [
      "Claim Number",
      "Enrollee ID",
      "Enrollee Name",
      "Provider Name",
      "Provider Type",
      "Services",
      "Amount",
      "Status",
      "Created At",
      "Submitted At",
    ]

    const csvRows = claims.map((claim) => {
      const services = claim.approval_codes?.[0]?.service_items?.length
        ? claim.approval_codes[0].service_items.map((service) => service.service_name).join(", ")
        : claim.approval_codes?.[0]?.services || "General Service"

      return [
        claim.claim_number,
        claim.enrollee_id,
        claim.principal ? `${claim.principal.first_name} ${claim.principal.last_name}` : "Unknown Enrollee",
        claim.provider?.facility_name || "",
        claim.provider?.facility_type || "",
        services,
        String(claim.amount ?? ""),
        mapProviderStatus(claim.status),
        claim.created_at.toISOString(),
        claim.submitted_at ? claim.submitted_at.toISOString() : "",
      ]
    })

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="claims-requests-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("Error exporting claims requests:", error)
    return NextResponse.json(
      { error: "Failed to export claims requests" },
      { status: 500 }
    )
  }
}
