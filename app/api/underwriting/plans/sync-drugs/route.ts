import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Sync Drug to Global Drug List
 * 
 * This endpoint is called when a drug is added in approval code request
 * to sync it to the global drug list for future use.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { drugName } = await request.json()

        if (!drugName || typeof drugName !== 'string') {
            return NextResponse.json(
                { error: "Drug name is required" },
                { status: 400 }
            )
        }

        // Check if drug already exists
        const existing = await prisma.globalDrug.findUnique({
            where: { drug_name: drugName }
        })

        if (existing) {
            return NextResponse.json({
                success: true,
                message: "Drug already exists in global list",
                drug: existing,
                isNew: false
            })
        }

        // Add new drug to global list
        const newDrug = await prisma.globalDrug.create({
            data: {
                drug_name: drugName,
                is_active: true
            }
        })

        return NextResponse.json({
            success: true,
            message: "Drug added to global list",
            drug: newDrug,
            isNew: true
        })

    } catch (error) {
        console.error("Error syncing drug:", error)
        return NextResponse.json(
            { error: "Failed to sync drug" },
            { status: 500 }
        )
    }
}
