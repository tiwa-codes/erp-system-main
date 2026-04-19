import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Sync Service to Global Service Pool
 * 
 * This endpoint is called after bulk upload or add service to sync
 * services to the global pool for Plan Management Customize.
 * Prevents duplicates across 1000+ providers.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { providerId, services } = await request.json()

        if (!providerId || !services || !Array.isArray(services)) {
            return NextResponse.json(
                { error: "Invalid request data" },
                { status: 400 }
            )
        }

        let addedCount = 0
        let skippedCount = 0

        for (const service of services) {
            // Check if service already exists in global pool
            const existing = await prisma.globalService.findFirst({
                where: {
                    service_name: service.service_name,
                    category_id: service.category_id
                }
            })

            if (!existing) {
                // Add new service to global pool
                await prisma.globalService.create({
                    data: {
                        service_name: service.service_name,
                        category_id: service.category_id,
                        category_name: service.category_name,
                        is_active: true
                    }
                })
                addedCount++
            } else {
                // Silently skip duplicates
                skippedCount++
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${addedCount} new services, skipped ${skippedCount} duplicates`,
            added: addedCount,
            skipped: skippedCount
        })

    } catch (error) {
        console.error("Error syncing services:", error)
        return NextResponse.json(
            { error: "Failed to sync services" },
            { status: 500 }
        )
    }
}
