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
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const code = await prisma.approvalCode.findUnique({
            where: { id: params.id },
            include: {
                service_items: true,
                generated_by: {
                    select: { first_name: true, last_name: true }
                },
                enrollee: {
                    select: {
                        enrollee_id: true,
                        first_name: true,
                        last_name: true,
                        date_of_birth: true,
                        phone_number: true,
                        email: true,
                        account_type: true,
                        gender: true,
                        marital_status: true,
                        end_date: true,
                        organization: {
                            select: {
                                id: true,
                                name: true,
                            }
                        },
                        plan: {
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        })

        if (!code || code.is_deleted) {
            return NextResponse.json({ error: 'Code not found' }, { status: 404 })
        }

        const isManualOrigin = code.is_manual || code.approval_code.startsWith("M-APR-")
        if (!isManualOrigin) {
            return NextResponse.json({ error: 'Code not found' }, { status: 404 })
        }

        let beneficiary = null as any
        const beneficiaryId = code.beneficiary_id || code.enrollee?.enrollee_id || code.enrollee_id

        if (code.beneficiary_id && code.enrollee?.enrollee_id && code.beneficiary_id !== code.enrollee.enrollee_id) {
            const dependent = await prisma.dependent.findUnique({
                where: { dependent_id: code.beneficiary_id },
                include: {
                    principal: {
                        select: {
                            first_name: true,
                            last_name: true,
                            account_type: true,
                            organization: {
                                select: {
                                    id: true,
                                    name: true,
                                }
                            },
                            plan: {
                                select: {
                                    id: true,
                                    name: true,
                                }
                            },
                            gender: true,
                            marital_status: true,
                            end_date: true,
                            phone_number: true,
                            email: true,
                        }
                    }
                }
            })

            if (dependent) {
                beneficiary = {
                    id: dependent.id,
                    enrollee_id: dependent.dependent_id,
                    first_name: dependent.first_name,
                    last_name: dependent.last_name,
                    date_of_birth: dependent.date_of_birth,
                    phone_number: dependent.phone_number || dependent.principal?.phone_number || null,
                    email: dependent.email || dependent.principal?.email || null,
                    account_type: dependent.principal?.account_type || null,
                    organization: dependent.principal?.organization || null,
                    plan: dependent.principal?.plan || null,
                    gender: dependent.gender || dependent.principal?.gender || null,
                    marital_status: dependent.principal?.marital_status || null,
                    end_date: dependent.principal?.end_date || null,
                    is_dependent: true,
                    principal_name: `${dependent.principal?.first_name || ""} ${dependent.principal?.last_name || ""}`.trim() || null,
                }
            }
        }

        if (!beneficiary && code.enrollee) {
            beneficiary = {
                id: code.enrollee_id,
                enrollee_id: beneficiaryId,
                first_name: code.enrollee.first_name,
                last_name: code.enrollee.last_name,
                date_of_birth: code.enrollee.date_of_birth,
                phone_number: code.enrollee.phone_number,
                email: code.enrollee.email,
                account_type: code.enrollee.account_type,
                organization: code.enrollee.organization,
                plan: code.enrollee.plan,
                gender: code.enrollee.gender,
                marital_status: code.enrollee.marital_status,
                end_date: code.enrollee.end_date,
                is_dependent: false,
                principal_name: null,
            }
        }

        const normalizedCode = {
            ...code,
            enrollee_id: beneficiaryId,
            beneficiary,
        }

        return NextResponse.json({ code: normalizedCode })

    } catch (error) {
        console.error('Error fetching manual code:', error)
        return NextResponse.json({ error: 'Failed to fetch code' }, { status: 500 })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check Update Permission
        const canUpdate = await checkPermission(session.user.role as any, 'call-centre', 'create') // Assuming same perm for now
        if (!canUpdate) {
            // return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { services, claim_amount, diagnosis, clinical_encounter } = body

        if (!services || !Array.isArray(services)) {
            return NextResponse.json({ error: 'Invalid services data' }, { status: 400 })
        }

        const existingCode = await prisma.approvalCode.findFirst({
            where: {
                id: params.id,
                is_deleted: false,
                OR: [
                    { is_manual: true },
                    { approval_code: { startsWith: "M-APR-" } }
                ]
            },
            select: {
                id: true,
                claim_id: true,
                approval_code: true
            }
        })

        if (!existingCode) {
            return NextResponse.json({ error: 'Code not found' }, { status: 404 })
        }

        // Transaction to update code and replace service items
        const updatedCode = await prisma.$transaction(async (tx) => {
            // Delete existing items
            await tx.approvalCodeService.deleteMany({
                where: { approval_code_id: params.id }
            })

            // Format legacy string with quantity and totals
            const servicesString = services.map((s: any) => {
                const qty = Number(s.quantity) || 1
                const unitPrice = Number(s.amount) || 0
                const total = unitPrice * qty
                return qty > 1 
                    ? `${s.name} (${qty} × ₦${unitPrice.toLocaleString()} = ₦${total.toLocaleString()})`
                    : `${s.name} (₦${total.toLocaleString()})`
            }).join(', ')

            // Calculate actual total amount
            const totalAmount = services.reduce((sum: number, s: any) => {
                const amount = Number(s.amount) || 0
                const quantity = Number(s.quantity) || 1
                return sum + (amount * quantity)
            }, 0)

            // Update code header
            const code = await tx.approvalCode.update({
                where: { id: params.id },
                data: {
                    amount: totalAmount, // Use calculated total instead of claim_amount
                    services: servicesString,
                    diagnosis: typeof diagnosis === 'string' ? diagnosis : undefined,
                    clinical_encounter: typeof clinical_encounter === 'string' ? clinical_encounter : undefined,
                    service_items: {
                        create: services.map((s: any) => ({
                            service_name: s.name,
                            service_amount: Number(s.amount),
                            is_initial: false,
                            quantity: Number(s.quantity) || 1,
                            is_ad_hoc: s.is_ad_hoc || false,
                            service_id: s.service_id || s.id || null,
                            category: s.category_id || s.category || null
                        }))
                    }
                },
                include: { service_items: true }
            })

            // Keep linked claim amount in sync so enrollee utilization reflects edits.
            if (existingCode.claim_id) {
                await tx.claim.updateMany({
                    where: { id: existingCode.claim_id },
                    data: {
                        amount: totalAmount,
                        original_amount: totalAmount
                    }
                })
            } else if (existingCode.approval_code) {
                await tx.claim.updateMany({
                    where: { claim_number: existingCode.approval_code },
                    data: {
                        amount: totalAmount,
                        original_amount: totalAmount
                    }
                })
            }
            return code
        })

        return NextResponse.json({ success: true, code: updatedCode })

    } catch (error) {
        console.error('Error updating manual code:', error)
        return NextResponse.json({ error: 'Failed to update code' }, { status: 500 })
    }
}
