import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const enrolleeId = params.id

    // Find enrollee with coverage details
    const enrollee = await prisma.principalAccount.findUnique({
      where: { id: enrolleeId },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true,
            premium_amount: true,
            annual_limit: true
          }
        }
      }
    })

    if (!enrollee) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    // Determine band based on plan
    let band = "Band A"
    if (enrollee.plan?.premium_amount && enrollee.plan.premium_amount > 50000) {
      band = "Band C"
    } else if (enrollee.plan?.premium_amount && enrollee.plan.premium_amount > 25000) {
      band = "Band B"
    }

    const coverage = {
      plan: enrollee.plan?.name || 'No Plan',
      band: band,
      status: enrollee.status,
      enrollee: `${enrollee.first_name} ${enrollee.last_name} (${enrollee.enrollee_id})`,
      provider: enrollee.organization?.name || 'No Provider',
      start_date: enrollee.created_at.toLocaleDateString('en-GB')
    }

    return NextResponse.json({
      success: true,
      coverage
    })

  } catch (error) {
    console.error("Error fetching coverage details:", error)
    return NextResponse.json(
      { error: "Failed to fetch coverage details" },
      { status: 500 }
    )
  }
}
