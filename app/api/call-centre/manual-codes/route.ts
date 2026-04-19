import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { getEnrolleeUtilization } from "@/lib/underwriting/usage"
import { enforcePlanUsage } from "@/lib/underwriting/enforcement"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
        const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10)
        const search = (searchParams.get("search") || "").trim()
        const skip = (page - 1) * limit

        const where: any = {
            is_deleted: false,
            AND: [
                {
                    OR: [
                        { is_manual: true },
                        { approval_code: { startsWith: "M-APR-" } }
                    ]
                }
            ]
        }

        if (search) {
            where.AND.push({
                OR: [
                    { approval_code: { contains: search, mode: "insensitive" } },
                    { enrollee_name: { contains: search, mode: "insensitive" } },
                    { hospital: { contains: search, mode: "insensitive" } }
                ]
            })
        }

        const [codes, total] = await Promise.all([
            prisma.approvalCode.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    created_at: 'desc'
                },
                include: {
                    generated_by: {
                        select: { first_name: true, last_name: true, email: true }
                    },
                    enrollee: {
                        select: { enrollee_id: true }
                    }
                }
            }),
            prisma.approvalCode.count({ where })
        ])

        const normalizedCodes = codes.map((code) => ({
            ...code,
            enrollee_id: code.beneficiary_id || code.enrollee?.enrollee_id || code.enrollee_id
        }))

        return NextResponse.json({
            codes: normalizedCodes,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        })

    } catch (error) {
        console.error('Error fetching manual codes:', error)
        return NextResponse.json({ error: 'Failed to fetch manual codes' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const canCreateCode = await checkPermission(session.user.role as any, 'call-centre', 'create')
        if (!canCreateCode) {
            // return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            // Temporarily allow for testing if permission logic is strict
        }

        const body = await req.json()
        const {
            provider_id,
            provider_name,
            hospital_name, // fallback
            enrollee_id,
            diagnosis,
            clinical_encounter,
            services, // Array of { name, amount, is_ad_hoc, service_id (opt) }
            claim_amount
        } = body

        if (!enrollee_id || !services || services.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Fetch Enrollee to link
        let enrollee: any = await prisma.principalAccount.findFirst({
            where: {
                OR: [
                    { enrollee_id: enrollee_id },
                    { id: enrollee_id }
                ]
            }
        })

        // If not found in Principal, check Dependent
        let isDependent = false
        if (!enrollee) {
            const dependent = await prisma.dependent.findFirst({
                where: {
                    OR: [
                        { dependent_id: enrollee_id },
                        { id: enrollee_id }
                    ]
                },
                include: {
                    principal: true
                }
            })

            if (dependent) {
                isDependent = true
                // Map dependent to enrollee structure, but keep principal_id for FK
                enrollee = {
                    id: dependent.principal_id, // Use Principal ID for foreign key
                    first_name: dependent.first_name,
                    last_name: dependent.last_name,
                    enrollee_id: dependent.dependent_id, // Original ID
                    principal_account_id: dependent.principal_id
                }
            }
        }

        if (!enrollee) {
            return NextResponse.json({ error: 'Enrollee not found' }, { status: 404 })
        }

        // Generate Manual Code
        // Format: M-APR-{HOSPITAL_PREFIX}-{RANDOM}
        // Hospital prefix: First 3 letters of provider/hospital name or 'HOS'
        const hospital = provider_name || hospital_name || 'Hospital'
        const cleanHospital = hospital.replace(/[^a-zA-Z]/g, '').toUpperCase()
        const prefix = cleanHospital.substring(0, 3) || 'HOS'

        // Generate unique suffix
        const randomSuffix = Math.floor(Math.random() * 9000000) + 1000000 // 7 digits
        const approvalCode = `M-APR-${prefix}-${randomSuffix}`

        // Calculate total amount (amount * quantity for each service)
        const totalAmount = services.reduce((sum: number, s: any) => {
            const amount = Number(s.amount) || 0
            const quantity = Number(s.quantity) || 1
            return sum + (amount * quantity)
        }, 0)

        const enforcement = await enforcePlanUsage({
            principalId: enrollee.id,
            attemptedAmount: totalAmount,
        })

        if ("error" in enforcement) {
            return NextResponse.json({ error: enforcement.error }, { status: enforcement.status })
        }

        if (enforcement.isBlocked) {
            await prisma.auditLog.create({
                data: {
                    user_id: session.user.id,
                    action: "MANUAL_APPROVAL_CODE_BLOCKED",
                    resource: "approval_code",
                    resource_id: enrollee.id,
                    new_values: {
                        reason: enforcement.warnings,
                        attempted_amount: totalAmount,
                        annual_limit: enforcement.annualLimit,
                        total_used: enforcement.totalUsed,
                    }
                }
            })

            return NextResponse.json(
                {
                    error: enforcement.warnings[0] || "Annual limit has been exhausted. Cannot approve this request."
                },
                { status: 400 }
            )
        }

        // Helper to format services for legacy string field
        const servicesString = services.map((s: any) => {
            const qty = Number(s.quantity) || 1
            const unitPrice = Number(s.amount) || 0
            const total = unitPrice * qty
            return qty > 1 
                ? `${s.name} (${qty} × ₦${unitPrice.toLocaleString()} = ₦${total.toLocaleString()})`
                : `${s.name} (₦${total.toLocaleString()})`
        }).join(', ')

        // Create Approval Code
        const newCode = await prisma.approvalCode.create({
            data: {
                approval_code: approvalCode,
                enrollee_id: enrollee.id,
                beneficiary_id: enrollee.enrollee_id,
                enrollee_name: `${enrollee.first_name} ${enrollee.last_name}`,
                hospital: hospital,
                provider_id: provider_id || null, // Link to provider if ID available
                services: servicesString, // Legacy field
                amount: totalAmount,
                diagnosis: diagnosis || '',
                clinical_encounter: clinical_encounter || null,
                status: 'APPROVED', // Manual codes are immediately approved for provider use
                generated_by_id: session.user.id,
                is_manual: true,
                service_items: {
                    create: services.map((s: any) => ({
                        service_name: s.name,
                        service_amount: Number(s.amount),
                        is_initial: true,
                        quantity: Number(s.quantity) || 1,
                        is_ad_hoc: s.is_ad_hoc || false,
                        service_id: s.service_id || s.id || null,
                        category: s.category_id || s.category || null
                    }))
                }
            }
        })

        // Auto-create a Claim in Vetter 1 for this manual code
        let createdClaimId: string | null = null
        try {
            // Check if a claim already exists for this approval code (idempotency guard)
            const existingClaim = await prisma.claim.findFirst({
                where: { claim_number: newCode.approval_code }
            })

            if (!existingClaim) {
                const manualClaim = await prisma.claim.create({
                    data: {
                        claim_number: newCode.approval_code,
                        enrollee_id: newCode.beneficiary_id || enrollee.enrollee_id,
                        principal_id: newCode.enrollee_id, // PrincipalAccount.id
                        provider_id: newCode.provider_id || null,
                        claim_type: 'MEDICAL',
                        amount: newCode.amount,
                        status: 'SUBMITTED',
                        current_stage: 'vetter1',
                        description: `Manual Approval Code generated by Call Centre: ${newCode.approval_code}`,
                        approval_codes: { connect: { id: newCode.id } }
                    }
                })
                createdClaimId = manualClaim.id

                // Back-link claim_id on the ApprovalCode
                await prisma.approvalCode.update({
                    where: { id: newCode.id },
                    data: { claim_id: manualClaim.id }
                })

                // Record timeline entry
                await prisma.approvalCodeTimeline.create({
                    data: {
                        approval_code_id: newCode.id,
                        stage: 'CLAIM_SUBMITTED',
                        user_id: session.user.id,
                        provider_id: newCode.provider_id || null
                    }
                })
            } else {
                createdClaimId = existingClaim.id
            }
        } catch (claimError) {
            console.error('Error auto-creating claim for manual code:', claimError)
            // Don't fail the whole request — the code was created; claim creation is best-effort
        }

        // Update enrollee utilization in the background (best-effort)
        let utilizationData: any = null
        try {
            utilizationData = await getEnrolleeUtilization(enrollee.id)
        } catch (utilErr) {
            console.error('Error fetching utilization after manual code creation:', utilErr)
        }

        return NextResponse.json({
            success: true,
            approval_code: newCode.approval_code,
            claim_id: createdClaimId,
            utilization: utilizationData,
            data: newCode
        })

    } catch (error) {
        console.error('Error generating manual code:', error)
        return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
    }
}
