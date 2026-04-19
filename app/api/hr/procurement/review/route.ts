import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || "all"
    const stage = searchParams.get("stage") || "all"

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { invoice_number: { contains: search, mode: "insensitive" } },
        { requested_by: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } }
      ]
    }

    if (status !== "all") {
      where.status = status
    }

    if (stage !== "all") {
      where.workflow_stage = stage
    }

    // Fetch invoices for review
    const invoices = await prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        created_at: "desc"
      },
      include: {
        enrollee: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        }
      }
    })

    // Get total count
    const total = await prisma.invoice.count({ where })

    // Transform data for frontend
    const transformedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      date: invoice.created_at.toISOString(),
      enrollee_id: invoice.enrollee_id,
      enrollee_name: `${invoice.enrollee?.first_name || ''} ${invoice.enrollee?.last_name || ''}`.trim(),
      invoice_number: invoice.invoice_number,
      plan_type: invoice.plan_type,
      plan_amount: invoice.plan_amount,
      status: invoice.status,
      workflow_stage: invoice.workflow_stage || 'INTERNAL_CONTROL',
      requested_by: invoice.requested_by || 'Unknown',
      department: invoice.department || 'Unknown',
      due_date: invoice.due_date?.toISOString(),
      paid_at: invoice.paid_at?.toISOString()
    }))

    return NextResponse.json({
      success: true,
      invoices: transformedInvoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching invoices for review:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoices for review" },
      { status: 500 }
    )
  }
}
