import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const organizationId = searchParams.get('organizationId')

        if (!organizationId) {
            return NextResponse.json(
                { error: 'Organization ID is required' },
                { status: 400 }
            )
        }

        // Fetch plans assigned to this organization
        const organizationPlans = await prisma.organizationPlan.findMany({
            where: {
                organization_id: organizationId,
            },
            include: {
                plan: {
                    select: {
                        id: true,
                        name: true,
                        plan_type: true,
                        description: true,
                        premium_amount: true,
                        annual_limit: true,
                        assigned_bands: true,
                    }
                }
            }
        })

        // Extract and format the plans
        const plans = organizationPlans.map(op => ({
            id: op.plan.id,
            name: op.plan.name,
            plan_type: op.plan.plan_type,
            description: op.plan.description,
            premium_amount: op.plan.premium_amount,
            annual_limit: op.plan.annual_limit,
            assigned_bands: op.plan.assigned_bands,
            is_default: op.is_default,
        }))

        return NextResponse.json({
            success: true,
            plans
        })
    } catch (error) {
        console.error('Error fetching public plans:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch plans'
            },
            { status: 500 }
        )
    }
}
