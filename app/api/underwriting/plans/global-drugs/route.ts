import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Get all global drugs for Approval Code Request dropdown
 * Drugs are synced when added in approval requests
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const drugs = await prisma.globalDrug.findMany({
            where: { is_active: true },
            orderBy: { drug_name: 'asc' }
        })

        return NextResponse.json(drugs)

    } catch (error) {
        console.error("Error fetching global drugs:", error)
        return NextResponse.json(
            { error: "Failed to fetch drugs" },
            { status: 500 }
        )
    }
}
