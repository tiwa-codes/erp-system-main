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

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "10")
        const search = searchParams.get("search") || ""
        const startDate = searchParams.get("start_date")
        const endDate = searchParams.get("end_date")

        // Date filter
        const dateFilter: any = {};
        if (startDate && endDate) {
            dateFilter.gte = new Date(startDate);
            dateFilter.lte = new Date(endDate);
        }

        const payoutPaidFilter = {
            status: "PAID" as any // PayoutStatus.PAID
        };

        const claimPaidFilter: any = {
            OR: [
                { status: "PAID" },
                {
                    payouts: {
                        some: payoutPaidFilter
                    }
                }
            ]
        };

        if (startDate && endDate) {
            claimPaidFilter.submitted_at = dateFilter;
        }

        // Get unique providers that have paid claims
        const providersWithPaidClaims = await prisma.provider.findMany({
            where: {
                claims: {
                    some: claimPaidFilter
                },
                ...(search ? {
                    OR: [
                        { facility_name: { contains: search, mode: 'insensitive' } },
                        { hcp_code: { contains: search, mode: 'insensitive' } }
                    ]
                } : {})
            },
            select: {
                id: true,
                facility_name: true,
                hcp_code: true,
                _count: {
                    select: {
                        claims: {
                            where: claimPaidFilter
                        }
                    }
                }
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                facility_name: 'asc'
            }
        })

        const total = await prisma.provider.count({
            where: {
                claims: {
                    some: claimPaidFilter
                },
                ...(search ? {
                    OR: [
                        { facility_name: { contains: search, mode: 'insensitive' } },
                        { hcp_code: { contains: search, mode: 'insensitive' } }
                    ]
                } : {})
            }
        })

        // For each provider, calculate total paid amount and enrollee count
        const providersData = await Promise.all(providersWithPaidClaims.map(async (p) => {
            const claims = await prisma.claim.findMany({
                where: {
                    provider_id: p.id,
                    ...claimPaidFilter
                },
                select: {
                    amount: true,
                    principal_id: true,
                    enrollee_id: true
                }
            })

            const totalPaidAmount = claims.reduce((sum, c) => sum + Number(c.amount || 0), 0)
            const enrolleeIds = new Set(claims.map(c => c.enrollee_id).filter(id => !!id))

            return {
                provider_id: p.id,
                provider_name: p.facility_name,
                provider_code: p.hcp_code,
                total_enrollees: enrolleeIds.size,
                total_amount: totalPaidAmount,
                paid_claims_count: p._count.claims
            }
        }))

        return NextResponse.json({
            providers: providersData,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        })
    } catch (error) {
        console.error("Error fetching payment advice providers:", error)
        return NextResponse.json(
            { error: "Failed to fetch payment advice providers" },
            { status: 500 }
        )
    }
}
