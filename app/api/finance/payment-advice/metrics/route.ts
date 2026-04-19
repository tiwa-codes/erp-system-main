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

        const canAccess = await checkPermission(session.user.role as any, "finance", "view")
        if (!canAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const claimPaidFilter: any = {
            OR: [
                { status: "PAID" },
                {
                    payouts: {
                        some: { status: "PAID" }
                    }
                }
            ]
        };

        // Get count of providers that have at least one PAID claim
        const paidProvidersCount = await prisma.provider.count({
            where: {
                claims: {
                    some: claimPaidFilter
                }
            }
        })

        // Get total paid amount from all PAID claims
        const totalPaidAmountResult = await prisma.claim.aggregate({
            where: claimPaidFilter,
            _sum: {
                amount: true
            }
        })

        // Get count of enrollees paid across all providers
        const paidEnrolleesCountResult = await prisma.claim.groupBy({
            by: ['enrollee_id'],
            where: claimPaidFilter
        })

        return NextResponse.json({
            metrics: {
                paid_providers: paidProvidersCount,
                total_payout_amount: Number(totalPaidAmountResult._sum.amount || 0),
                paid_enrollees: paidEnrolleesCountResult.length
            }
        })
    } catch (error) {
        console.error("Error fetching payment advice metrics:", error)
        return NextResponse.json(
            { error: "Failed to fetch payment advice metrics" },
            { status: 500 }
        )
    }
}
