import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

const STAGE_NAMES: Record<string, string> = {
    'REQUESTED': 'Requested',
    'APPROVED': 'Approved',
    'CLAIM_SUBMITTED': 'Sent to Vetter 1',
    'VETTER1_COMPLETED': 'Vetter 1 Vetted',
    'VETTER2_COMPLETED': 'Vetter 2 Vetted',
    'AUDIT_COMPLETED': 'Audit Audited',
    'MD_APPROVED': 'MD Approves',
    'FINANCE_PAID': 'Finance Paid'
}

const formatDelay = (minutes: number | null): string | null => {
    if (minutes === null || minutes < 0) return null
    if (minutes === 0) return "0min"

    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hrs > 0) {
        const hrStr = `${hrs}${hrs === 1 ? 'hr' : 'hrs'}`
        const minStr = mins > 0 ? `, ${mins}${mins === 1 ? 'min' : 'mins'}` : ''
        return `${hrStr}${minStr}`
    }

    return `${mins}${mins === 1 ? 'min' : 'mins'}`
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Allow timeline access for call-centre and claims users (including provider claims tracking views)
        const [canViewCallCentre, canViewClaims] = await Promise.all([
            checkPermission(session.user.role as any, "call-centre", "view"),
            checkPermission(session.user.role as any, "claims", "view")
        ])
        if (!canViewCallCentre && !canViewClaims) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
        }

        const rawId = params.id || ""
        const normalizedId = decodeURIComponent(rawId).trim()
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedId)
        
        console.log(`[Timeline] ===== START =====`)
        console.log(`[Timeline] Raw ID: "${rawId}"`)
        console.log(`[Timeline] Normalized ID: "${normalizedId}"`)
        console.log(`[Timeline] Is UUID: ${isUUID}`)

        let approvalCode = await prisma.approvalCode.findFirst({
            where: isUUID
                ? { id: normalizedId }
                : { approval_code: { equals: normalizedId, mode: "insensitive" } },
            include: {
                generated_by: {
                    select: { id: true, first_name: true, last_name: true, email: true }
                },
                provider: {
                    select: { id: true, facility_name: true, provider_id: true }
                }
            }
        })
        
        if (approvalCode) {
            console.log(`[Timeline] ✅ Found approval code by direct lookup`)
            console.log(`[Timeline]   - ID: ${approvalCode.id}`)
            console.log(`[Timeline]   - Code: ${approvalCode.approval_code}`)
            console.log(`[Timeline]   - Claim ID: ${approvalCode.claim_id || 'null'}`)
        } else {
            console.log(`[Timeline] ❌ Approval code not found by direct lookup`)
            console.log(`[Timeline] Attempting claim lookup with same normalized ID...`)
        }

        // If not found, it may be a claim ID or claim number
        if (!approvalCode) {
            const claim = await prisma.claim.findFirst({
                where: isUUID
                    ? { id: normalizedId }
                    : { claim_number: { equals: normalizedId, mode: "insensitive" } },
                include: {
                    principal: {
                        select: {
                            first_name: true,
                            last_name: true
                        }
                    },
                    provider: {
                        select: {
                            facility_name: true,
                            id: true
                        }
                    },
                    approval_codes: {
                        include: {
                            generated_by: {
                                select: { id: true, first_name: true, last_name: true, email: true }
                            },
                            provider: {
                                select: { id: true, facility_name: true, provider_id: true }
                            }
                        },
                        take: 1
                    }
                }
            })
            
            console.log(`[Timeline] Claim lookup result: ${claim ? '✅ FOUND' : '❌ NOT FOUND'}`)
            if (claim?.approval_codes?.[0]) {
                approvalCode = claim.approval_codes[0] as any
                console.log(`[Timeline] Claim has approval code linked`)
                console.log(`[Timeline]   - Approval Code ID: ${approvalCode.id}`)
                console.log(`[Timeline]   - Approval Code: ${approvalCode.approval_code}`)
            } else if (claim) {
                console.log(`[Timeline] Claim found but no approval code - creating synthetic`)
                console.log(`[Timeline]   - Claim ID: ${claim.id}`)
                console.log(`[Timeline]   - Claim Number: ${claim.claim_number}`)
                // Claim exists but has no approval code - create a synthetic one retroactively
                const enrolleeName = claim.principal 
                    ? `${claim.principal.first_name} ${claim.principal.last_name}`
                    : 'Unknown'
                
                approvalCode = await prisma.approvalCode.create({
                    data: {
                        approval_code: `AUTO-${claim.claim_number}`,
                        enrollee_id: claim.enrollee_id,
                        enrollee_name: enrolleeName,
                        hospital: claim.provider?.facility_name || 'Unknown Provider',
                        services: 'Auto-Created from Claim',
                        amount: claim.amount,
                        status: claim.status === 'PAID' ? 'APPROVED' : 'APPROVED',
                        claim_id: claim.id,
                        is_manual: true,
                        is_deleted: false,
                        generated_by_id: session.user.id,
                        provider_id: claim.provider?.id || null,
                    },
                    include: {
                        generated_by: {
                            select: { id: true, first_name: true, last_name: true, email: true }
                        },
                        provider: {
                            select: { id: true, facility_name: true, provider_id: true }
                        }
                    }
                }) as any
                console.log(`[Timeline] ✅ Successfully created synthetic approval code`)
                console.log(`[Timeline]   - Generated ID: ${approvalCode.id}`)
                console.log(`[Timeline]   - Generated Code: ${approvalCode.approval_code}`)
            } else {
                console.log(`[Timeline] ❌ Claim not found either`)
            }
        }

        if (!approvalCode) {
            console.log(`[Timeline] ❌ FINAL: No approval code found`)
            console.log(`[Timeline]   - Requested ID: ${normalizedId}`)
            console.log(`[Timeline]   - Is UUID: ${isUUID}`)
            console.log(`[Timeline] ===== END (FAILED) =====`)
            return NextResponse.json({ error: "Approval code not found" }, { status: 404 })
        }

        console.log(`[Timeline] ✅ FINAL: Approval code resolved`)
        console.log(`[Timeline]   - ID: ${approvalCode.id}`)
        console.log(`[Timeline]   - Code: ${approvalCode.approval_code}`)
        console.log(`[Timeline] Fetching timeline events...`)

        const timelineEvents = await prisma.approvalCodeTimeline.findMany({
            where: { approval_code_id: approvalCode.id },
            include: {
                user: {
                    select: { id: true, first_name: true, last_name: true, email: true }
                },
                provider: {
                    select: { id: true, facility_name: true, provider_id: true }
                }
            },
            orderBy: { timestamp: 'asc' }
        })

        // If no timeline events exist, provide a minimal response showing creation details
        if (timelineEvents.length === 0) {
            const minimalTimeline = [{
                id: 'system-created',
                stage: 'REQUESTED',
                stage_display: 'Created',
                timestamp: (approvalCode as any).created_at,
                delay_minutes: 0,
                delay_formatted: '0min',
                performed_by: (approvalCode as any).generated_by ? {
                    type: 'user',
                    name: `${(approvalCode as any).generated_by.first_name} ${(approvalCode as any).generated_by.last_name}`,
                    email: (approvalCode as any).generated_by.email
                } : null
            }]

            return NextResponse.json({
                success: true,
                approval_code: (approvalCode as any).approval_code,
                created_at: (approvalCode as any).created_at,
                status: (approvalCode as any).status,
                is_auto_generated: (approvalCode as any).is_manual === true,
                timeline: minimalTimeline
            })
        }

        let timelineWithDelays = timelineEvents.map((event, index) => {
            let delayMinutes = event.delay_minutes

            if (delayMinutes === null && index > 0) {
                const previousEvent = timelineEvents[index - 1]
                const diffMs = new Date(event.timestamp).getTime() - new Date(previousEvent.timestamp).getTime()
                delayMinutes = Math.floor(diffMs / (1000 * 60))
            }

            return {
                id: event.id,
                stage: event.stage,
                stage_display: STAGE_NAMES[event.stage] || event.stage,
                timestamp: event.timestamp,
                delay_minutes: delayMinutes,
                delay_formatted: formatDelay(delayMinutes),
                performed_by: event.user ? {
                    type: 'user',
                    name: `${event.user.first_name} ${event.user.last_name}`,
                    email: event.user.email
                } : event.provider ? {
                    type: 'provider',
                    name: event.provider.facility_name,
                    id: event.provider.provider_id
                } : null
            }
        })

        // Ensure the REQUESTED stage is present and has a performer
        const hasRequested = timelineWithDelays.some(t => t.stage === 'REQUESTED')
        if (!hasRequested && approvalCode) {
            const requestedEvent = {
                id: 'synthetic-requested',
                stage: 'REQUESTED',
                stage_display: STAGE_NAMES['REQUESTED'],
                timestamp: (approvalCode as any).created_at,
                delay_minutes: 0,
                delay_formatted: '0min',
                performed_by: (approvalCode as any).generated_by ? {
                    type: 'user',
                    name: `${(approvalCode as any).generated_by.first_name} ${(approvalCode as any).generated_by.last_name}`,
                    email: (approvalCode as any).generated_by.email
                } : (approvalCode as any).provider ? {
                    type: 'provider',
                    name: (approvalCode as any).provider.facility_name,
                    id: (approvalCode as any).provider.provider_id
                } : null
            }
            timelineWithDelays = [requestedEvent as any, ...timelineWithDelays]
        }

        return NextResponse.json({
            success: true,
            approval_code: approvalCode.approval_code,
            timeline: timelineWithDelays
        })

    } catch (error) {
        console.error("Error fetching approval code timeline:", error)
        return NextResponse.json(
            { error: "Failed to fetch approval code timeline" },
            { status: 500 }
        )
    }
}
