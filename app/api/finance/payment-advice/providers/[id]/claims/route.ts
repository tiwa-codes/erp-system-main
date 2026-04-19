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
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const canAccess = await checkPermission(session.user.role as any, "finance", "view")
        if (!canAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const providerId = params.id

        // Fetch all claims for this provider that have been PAID
        const claims = await prisma.claim.findMany({
            where: {
                provider_id: providerId,
                OR: [
                    { status: 'PAID' },
                    {
                        payouts: {
                            some: {
                                status: "PAID"
                            }
                        }
                    }
                ]
            },
            select: {
                id: true,
                claim_number: true,
                enrollee_id: true,
                principal_id: true,
                amount: true, // This is the final paid amount for the claim
                original_amount: true,
                submitted_at: true,
                principal: {
                    select: {
                        first_name: true,
                        last_name: true,
                        enrollee_id: true,
                        account_type: true
                    }
                },
                approval_codes: {
                    select: {
                        approval_code: true,
                        diagnosis: true,
                        beneficiary_id: true,
                        service_items: {
                            select: {
                                vetted_amount: true,
                                service_amount: true,
                                is_vetted_approved: true,
                                is_deleted: true,
                                category: true,
                                service_name: true,
                                rejection_reason: true
                            }
                        }
                    }
                },
                payouts: {
                    where: { status: 'PAID' },
                    select: { processed_at: true }
                }
            },
            orderBy: {
                submitted_at: 'desc'
            }
        })

        const formattedClaims = await Promise.all(claims.map(async (claim) => {
            const serviceItems = claim.approval_codes?.[0]?.service_items || []
            const drugs = serviceItems.filter(item => item.category === 'DRG' && !item.is_deleted && item.is_vetted_approved)
            const services = serviceItems.filter(item => item.category !== 'DRG' && !item.is_deleted && item.is_vetted_approved)

            const drugList = drugs.map(d => d.service_name).join(", ")
            const serviceList = services.map(s => s.service_name).join(", ")

            const drugComments = drugs.filter(d => d.rejection_reason).map(d => `${d.service_name}: ${d.rejection_reason}`).join("; ")
            const serviceComments = services.filter(s => s.rejection_reason).map(s => `${s.service_name}: ${s.rejection_reason}`).join("; ")

            const totalBilled = Number(claim.original_amount || claim.amount || 0)
            const totalPaid = Number(claim.amount || 0)
            const totalDiff = totalBilled - totalPaid

            // Explicitly resolve beneficiary (dependent) details if it's not the principal
            let relationshipType = "Principal"
            let enrolleeName = claim.principal
                ? `${claim.principal.first_name} ${claim.principal.last_name}`
                : "Unknown Enrollee"
            let enrolleeId = claim.principal?.enrollee_id || claim.enrollee_id || "N/A"

            // Look up beneficiary from dependent table
            // In the system, enrollee_id on the claim is the dependent_id for dependent claims
            if (claim.enrollee_id && claim.principal?.enrollee_id !== claim.enrollee_id) {
                const dependent = await prisma.dependent.findUnique({
                    where: { dependent_id: claim.enrollee_id },
                    select: {
                        first_name: true,
                        last_name: true,
                        relationship: true,
                        dependent_id: true
                    }
                })

                if (dependent) {
                    enrolleeName = `${dependent.first_name} ${dependent.last_name}`
                    enrolleeId = dependent.dependent_id
                    relationshipType = dependent.relationship.toLowerCase()
                    relationshipType = relationshipType.charAt(0).toUpperCase() + relationshipType.slice(1)
                }
            }

            return {
                id: claim.id,
                claim_number: claim.claim_number,
                approval_code: claim.approval_codes?.[0]?.approval_code || "N/A",
                enrollee_name: enrolleeName,
                enrollee_id: enrolleeId,
                enrollee_type: relationshipType,
                total_billed: totalBilled,
                total_paid: totalPaid,
                total_diff: totalDiff,
                drugs: drugList || "N/A",
                drug_comments: drugComments || "N/A",
                services: serviceList || "N/A",
                service_comments: serviceComments || "N/A",
                date: claim.submitted_at,
                payment_date: claim.payouts?.[0]?.processed_at || claim.submitted_at
            }
        }))

        // Fetch provider details for header
        const provider = await prisma.provider.findUnique({
            where: { id: providerId },
            select: {
                facility_name: true,
                hcp_code: true,
                account_name: true,
                account_number: true
            }
        })

        return NextResponse.json({
            provider,
            claims: formattedClaims,
            summary: {
                total_claims: formattedClaims.length,
                total_amount: formattedClaims.reduce((sum, c) => sum + c.total_paid, 0)
            }
        })
    } catch (error) {
        console.error("Error fetching provider payment breakdown:", error)
        return NextResponse.json(
            { error: "Failed to fetch provider payment breakdown" },
            { status: 500 }
        )
    }
}
