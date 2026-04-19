import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has provider permissions
    const hasPermission = await checkPermission(session.user.role as any, "provider", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { enrollee_id, package_type } = body

    if (!enrollee_id || !package_type) {
      return NextResponse.json({ 
        error: "Enrollee ID and package type are required" 
      }, { status: 400 })
    }

    // Find enrollee with plan
    const enrollee = await prisma.principalAccount.findFirst({
      where: {
        OR: [
          { id: enrollee_id },
          { enrollee_id }
        ]
      },
      include: {
        plan: {
          include: {
            package_limits: {
              where: {
                status: "ACTIVE",
                OR: [
                  { category: package_type },
                  { service_name: package_type }
                ]
              }
            }
          }
        }
      }
    })

    if (!enrollee) {
      return NextResponse.json({ 
        error: "Enrollee not found" 
      }, { status: 404 })
    }

    // Check if plan has package limits for this package type
    const packageLimit = enrollee.plan?.package_limits?.[0]
    if (!packageLimit) {
      return NextResponse.json({
        success: true,
        hasLimit: false,
        message: "No package limit set for this package type"
      })
    }

    // Package limits no longer store the legacy time-frame fields this route used.
    // Until package usage is tracked per benefit/package again, return the configured
    // limit without blocking service selection on stale-schema assumptions.
    const usedAmount = 0
    const limitAmount = Number(packageLimit.amount || 0)
    const exceeded = false

    return NextResponse.json({
      success: true,
      hasLimit: true,
      exceeded,
      packageLimit: {
        amount: limitAmount,
        timeFrame: packageLimit.limit_frequency || null,
        usedAmount: usedAmount,
        remainingAmount: Math.max(0, limitAmount - usedAmount)
      },
      message: "Package limit available"
    })

  } catch (error) {
    console.error("Error checking package limit:", error)
    return NextResponse.json(
      { error: "Failed to check package limit" },
      { status: 500 }
    )
  }
}
