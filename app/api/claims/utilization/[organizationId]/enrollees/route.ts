import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { USABLE_CLAIM_STATUSES } from "@/lib/underwriting/enforcement"

interface EnrolleeUtilizationDetail {
  id: string
  name: string
  enrollee_id: string
  account_type: string
  utilized: number
  balance: number
  limit: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "claims", "view")
    if (!canView) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const organizationId = params.organizationId

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        principal_accounts: {
          include: {
            plan: {
              select: {
                annual_limit: true,
              },
            },
            dependents: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const enrolleeDetails: EnrolleeUtilizationDetail[] = []

    for (const principal of organization.principal_accounts) {
      const claimsUsage = await prisma.claim.aggregate({
        where: {
          enrollee_id: principal.enrollee_id,
          status: { in: USABLE_CLAIM_STATUSES as any },
        },
        _sum: { amount: true },
      })

      const codeUsage = await prisma.approvalCode.aggregate({
        where: {
          enrollee_id: principal.enrollee_id,
          status: "APPROVED",
          is_deleted: false,
          claim_id: null,
        },
        _sum: { amount: true },
      })

      const utilized =
        Number(claimsUsage._sum?.amount ?? 0) +
        Number(codeUsage._sum.amount ?? 0) +
        Number(principal.old_utilization ?? 0)

      const limit = Number(principal.plan?.annual_limit ?? 0)
      const balance = Math.max(0, limit - utilized)

      const principalName = principal.first_name && principal.last_name
        ? `${principal.first_name} ${principal.last_name}`
        : principal.enrollee_id

      enrolleeDetails.push({
        id: principal.id,
        name: principalName,
        enrollee_id: principal.enrollee_id,
        account_type: "PRINCIPAL",
        utilized,
        balance,
        limit,
      })

      for (const dependent of principal.dependents) {
        const dependentClaimsUsage = await prisma.claim.aggregate({
          where: {
            enrollee_id: dependent.dependent_id,
            status: { in: USABLE_CLAIM_STATUSES as any },
          },
          _sum: { amount: true },
        })

        const dependentCodeUsage = await prisma.approvalCode.aggregate({
          where: {
            enrollee_id: dependent.dependent_id,
            status: "APPROVED",
            is_deleted: false,
            claim_id: null,
          },
          _sum: { amount: true },
        })

        const dependentUtilized =
          Number(dependentClaimsUsage._sum?.amount ?? 0) +
          Number(dependentCodeUsage._sum.amount ?? 0) +
          Number(dependent.old_utilization ?? 0)

        const dependentLimit = Number(principal.plan?.annual_limit ?? 0)
        const dependentBalance = Math.max(0, dependentLimit - dependentUtilized)

        const dependentName = dependent.first_name && dependent.last_name
          ? `${dependent.first_name} ${dependent.last_name}`
          : dependent.dependent_id

        const relationshipMap: Record<string, string> = {
          SPOUSE: "Spouse",
          SON: "Child",
          DAUGHTER: "Child",
          PARENT: "Parent",
          SIBLING: "Sibling",
          OTHER: "Dependent",
          EXTRA_DEPENDENT: "Extra Dependent",
        }

        const accountType = relationshipMap[dependent.relationship] || dependent.relationship || "Dependent"

        enrolleeDetails.push({
          id: dependent.id,
          name: dependentName,
          enrollee_id: dependent.dependent_id,
          account_type: accountType,
          utilized: dependentUtilized,
          balance: dependentBalance,
          limit: dependentLimit,
        })
      }
    }

    return NextResponse.json({
      success: true,
      organizationId,
      organizationName: organization.name,
      enrollees: enrolleeDetails,
    })
  } catch (error) {
    console.error("Error fetching claims enrollee utilization:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch enrollee utilization",
      },
      { status: 500 }
    )
  }
}

