
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const enrolleeId = params.id // This is the cuid of PrincipalAccount or Dependent

        // 1. Try to find if it's a Dependent
        const dependent = await prisma.dependent.findUnique({
            where: { id: enrolleeId },
            select: {
                id: true,
                dependent_id: true,
                first_name: true,
                last_name: true,
                relationship: true,
                principal_id: true
            }
        })

        let principalId: string | undefined
        let humanReadableId: string | undefined
        let enrolleeType = "Principal"

        if (dependent) {
            principalId = dependent.principal_id
            humanReadableId = dependent.dependent_id
            enrolleeType = dependent.relationship.toLowerCase()
            enrolleeType = enrolleeType.charAt(0).toUpperCase() + enrolleeType.slice(1)
        } else {
            // Try Principal
            const principal = await prisma.principalAccount.findUnique({
                where: { id: enrolleeId },
                select: {
                    id: true,
                    enrollee_id: true
                }
            })
            if (principal) {
                principalId = principal.id
                humanReadableId = principal.enrollee_id
            }
        }

        if (!humanReadableId) {
            return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
        }

        // 2. Fetch all Claims for this humanReadableId
        const claims = await prisma.claim.findMany({
            where: { enrollee_id: humanReadableId },
            select: {
                id: true,
                claim_number: true,
                claim_type: true,
                amount: true,
                original_amount: true,
                status: true,
                submitted_at: true,
                provider: {
                    select: { facility_name: true }
                },
                approval_codes: {
                    select: {
                        approval_code: true,
                        diagnosis: true,
                        service_items: {
                            select: {
                                service_name: true,
                                category: true,
                                is_vetted_approved: true,
                                is_deleted: true
                            }
                        }
                    }
                }
            },
            orderBy: { submitted_at: 'desc' }
        })

        // 3. Fetch all ProviderRequests (Encounters) for this enrollee/beneficiary
        const providerRequests = await prisma.providerRequest.findMany({
            where: {
                OR: [
                    { enrollee_id: principalId, beneficiary_id: humanReadableId }, // For dependents
                    { enrollee_id: principalId, beneficiary_id: null } // For principals (if beneficiary_id is null)
                ]
            },
            select: {
                id: true,
                hospital: true,
                diagnosis: true,
                services: true,
                amount: true,
                status: true,
                created_at: true,
                request_items: {
                    select: {
                        service_name: true,
                        category: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        // 4. Format into a unified history
        const history = claims.map(claim => {
            const approval = claim.approval_codes?.[0]
            const serviceItems = approval?.service_items || []

            const drugs = serviceItems.filter(i => i.category === 'DRG' && !i.is_deleted).map(i => i.service_name).join(", ")
            const services = serviceItems.filter(i => i.category !== 'DRG' && !i.is_deleted).map(i => i.service_name).join(", ")

            return {
                id: claim.id,
                date: claim.submitted_at,
                hospital: claim.provider?.facility_name || "N/A",
                diagnosis: approval?.diagnosis || "N/A",
                drugs,
                services,
                amount: claim.amount,
                status: claim.status,
                auth_code: approval?.approval_code || "N/A",
                type: enrolleeType,
                record_type: "CLAIM"
            }
        })

        // Add encounters that don't have claims yet or show them as distinct
        // (Logic to avoid duplicates if a claim is already linked to a request)
        const linkedRequestIds = claims.map(c => c.id) // This is not correct linkage, but for now...

        // Better: Filter out requests that have claims already in the list
        // (We could link by claim_id in ProviderRequest)

        const formattedRequests = providerRequests.map(req => {
            const drugItems = req.request_items.filter(i => i.category === 'DRG').map(i => i.service_name).join(", ")
            const serviceItems = req.request_items.filter(i => i.category !== 'DRG').map(i => i.service_name).join(", ")

            return {
                id: req.id,
                date: req.created_at,
                hospital: req.hospital,
                diagnosis: req.diagnosis || "N/A",
                drugs: drugItems,
                services: serviceItems,
                amount: req.amount,
                status: req.status,
                auth_code: "N/A",
                type: enrolleeType,
                record_type: "ENCOUNTER"
            }
        })

        // Combine and sort
        const combined = [...history, ...formattedRequests].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )

        return NextResponse.json({ history: combined })

    } catch (error) {
        console.error("Enrollee history error:", error)
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
    }
}
