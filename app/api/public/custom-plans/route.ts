
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PlanStatus, ApprovalStage, PlanClassification, PlanType } from "@prisma/client"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"

const customPlanSchema = z.object({
    organization_name: z.string().min(1, "Organization Name is required"),
    plan_name: z.string().min(1, "Plan Name is required"),
    submitter_name: z.string().min(1, "Contact Person Name is required"),
    submitter_email: z.string().email("Invalid email address"),
    submitter_phone: z.string().min(1, "Phone number is required"),
    base_plan_id: z.string().min(1, "Base Plan ID is required"),
    premium_amount: z.number().optional().default(0), // Proposer can suggest price or it defaults
    benefit_config: z.array(z.object({
        category: z.string(),
        service_name: z.string().optional().nullable(),
        amount: z.number(),
        default_price: z.number().optional().nullable(),
        input_type: z.enum(["NUMBER", "DROPDOWN", "ALPHANUMERIC"]),
        is_customizable: z.boolean(),
        limit_type: z.enum(["PRICE", "FREQUENCY"]).optional(),
        limit_frequency: z.string().optional().nullable(),
        coverage_status: z.enum(["COVERED", "NOT_COVERED"]).optional()
    }))
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const validatedData = customPlanSchema.parse(body)

        // Find a system user to attribute creation to (e.g., first Super Admin)
        // This is necessary because the public submission is unauthenticated
        const systemUser = await prisma.user.findFirst({
            where: {
                role: {
                    name: {
                        in: ["SUPER_ADMIN", "ADMIN", "IT_ADMIN"]
                    }
                },
                status: "ACTIVE"
            }
        })

        if (!systemUser) {
            return NextResponse.json({ error: "System configuration error: No admin user found to attribute plan to." }, { status: 500 })
        }

        // Generate a unique Plan ID
        const planIdSlug = `CUST-${Date.now().toString().slice(-6)}`

        // Create the Plan in Special Services PENDING state
        /*
          The requirement is:
          1. Create Plan with status PENDING_APPROVAL
          2. Set approval_stage to SPECIAL_RISK
          3. Set classification to CUSTOM
        */
        const newPlan = await prisma.$transaction(async (tx) => {
            // Create the plan
            const plan = await tx.plan.create({
                data: {
                    name: validatedData.plan_name,
                    plan_id: planIdSlug,
                    plan_type: PlanType.CORPORATE, // Defaulting to Corporate for custom plans usually
                    classification: PlanClassification.CUSTOM,
                    status: PlanStatus.PENDING_APPROVAL,
                    approval_stage: ApprovalStage.SPECIAL_RISK,
                    premium_amount: new Decimal(validatedData.premium_amount),
                    annual_limit: new Decimal(0), // Calculated or set based on configs? usually 0 or sum
                    created_by_id: systemUser.id,
                    proposed_organization_name: validatedData.organization_name,
                    metadata: {
                        submitter_contact: {
                            name: validatedData.submitter_name,
                            email: validatedData.submitter_email,
                            phone: validatedData.submitter_phone
                        }
                    }
                }
            })

            // Create the benefit configs (PackageLimits)
            if (validatedData.benefit_config.length > 0) {
                await tx.packageLimit.createMany({
                    data: validatedData.benefit_config.map(config => ({
                        plan_id: plan.id,
                        category: config.category,
                        service_name: config.service_name || null,
                        amount: new Decimal(config.amount),
                        default_price: config.default_price ? new Decimal(config.default_price) : null,
                        input_type: config.input_type as any,
                        is_customizable: config.is_customizable,
                        limit_type: (config.limit_type as any) || "PRICE",
                        limit_frequency: config.limit_frequency || null,
                        coverage_status: (config.coverage_status as any) || "COVERED",
                        status: "ACTIVE"
                    }))
                })
            }

            return plan
        })

        return NextResponse.json({
            success: true,
            plan_id: newPlan.id,
            message: "Plan submitted successfully for Special Services review."
        })

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
        }
        console.error("Error submitting custom plan:", error)
        return NextResponse.json({ error: "Failed to submit custom plan" }, { status: 500 })
    }
}

