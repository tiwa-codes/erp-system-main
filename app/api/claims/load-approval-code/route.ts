import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Role check? Vetter 1 
        // const isVetter1 = session.user.role === 'VETTER_1' || session.user.role === 'ADMIN'
        // if (!isVetter1) return 403... (For now relying on UI gate, API check good practice)

        const body = await req.json()
        const { approval_code } = body

        if (!approval_code) {
            return NextResponse.json({ error: 'Approval Code is required' }, { status: 400 })
        }

        // Check if code exists
        const approval = await prisma.approvalCode.findUnique({
            where: { approval_code: approval_code },
            include: {
                enrollee: true,
                provider: true
            }
        })

        if (!approval) {
            return NextResponse.json({ error: 'Approval Code does not exist' }, { status: 404 })
        }

        // Block access to soft-deleted codes
        if (approval.is_deleted) {
            return NextResponse.json({ error: 'Approval Code does not exist' }, { status: 404 })
        }

        // Check if Claim already exists for this code
        const existingClaim = await prisma.claim.findFirst({
            where: { claim_number: approval_code }
        })

        if (existingClaim) {
            return NextResponse.json({ error: 'Claim already exists for this code', claim_id: existingClaim.id }, { status: 409 })
        }

        // Create Claim
        // We use data from ApprovalCode
        const claim = await prisma.claim.create({
            data: {
                claim_number: approval.approval_code,
                enrollee_id: approval.beneficiary_id || approval.enrollee.enrollee_id,
                principal_id: approval.enrollee_id,
                provider_id: approval.provider_id, // Might be null if manual code didn't link properly
                claim_type: 'MEDICAL', // Default
                amount: approval.amount,
                status: 'SUBMITTED', // Ready for vetting
                current_stage: 'vetter1',
                description: `Manually Loaded Claim (Source: ${approval.is_manual ? 'Call Centre Manual' : 'Standard'})`,
                created_by_id: session.user.id,
                submitted_at: new Date(),
                // Link back to Approval Code
                approval_codes: {
                    connect: { id: approval.id }
                }
            }
        })

        // 🕒 TIMELINE TRACKING
        try {
            // Find APPROVED stage to calculate delay
            const approvedStage = await prisma.approvalCodeTimeline.findFirst({
                where: { approval_code_id: approval.id, stage: 'APPROVED' },
                orderBy: { timestamp: 'desc' }
            })

            let delayMinutes = null
            if (approvedStage) {
                delayMinutes = Math.floor((new Date().getTime() - new Date(approvedStage.timestamp).getTime()) / (1000 * 60))
            }

            await prisma.approvalCodeTimeline.create({
                data: {
                    approval_code_id: approval.id,
                    stage: 'CLAIM_SUBMITTED',
                    timestamp: new Date(),
                    user_id: session.user.id,
                    delay_minutes: delayMinutes
                }
            })
            console.log('✅ Timeline entry created for claim submission')
        } catch (timelineError) {
            console.error('❌ Failed to create timeline entry:', timelineError)
        }

        return NextResponse.json({
            success: true,
            claim_id: claim.id,
            message: 'Approval Code loaded successfully as pending claim'
        })

    } catch (error) {
        console.error('Error loading approval code:', error)
        return NextResponse.json({ error: 'Failed to load approval code' }, { status: 500 })
    }
}
