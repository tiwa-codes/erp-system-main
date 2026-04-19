
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
    try {
        // Fetch all active plans
        const plans = await prisma.plan.findMany({
            where: { status: "ACTIVE" },
            select: {
                id: true,
                name: true,
                plan_type: true,
                premium_amount: true,
                classification: true,
            }
        })

        // Fetch all active benefit configurations (package limits)
        // We fetch ALL active limits and group them by plan in the frontend or here.
        // Grouping here is cleaner.
        const limits = await prisma.packageLimit.findMany({
            where: { status: "ACTIVE" },
            orderBy: [
                { category: 'asc' },
                { service_name: 'asc' }
            ]
        })

        // Combine
        const fullPlans = plans.map(plan => {
            const planLimits = limits.filter(l => l.plan_id === plan.id)
            return {
                ...plan,
                benefit_config: planLimits
            }
        })

        return NextResponse.json({
            success: true,
            plans: fullPlans
        })

    } catch (error) {
        console.error("Error fetching public benefit plans:", error)
        return NextResponse.json(
            { error: "Failed to fetch benefit plans" },
            { status: 500 }
        )
    }
}
