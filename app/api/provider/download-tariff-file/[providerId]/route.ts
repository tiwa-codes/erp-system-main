import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import path from "path"

export async function GET(
    request: NextRequest,
    { params }: { params: { providerId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const providerId = params.providerId

        if (!providerId) {
            return NextResponse.json(
                { error: "Provider ID is required" },
                { status: 400 }
            )
        }

        // Fetch tariff file record
        const tariffFile = await prisma.providerTariffFile.findUnique({
            where: { provider_id: providerId }
        })

        if (!tariffFile) {
            return NextResponse.json(
                { error: "No tariff file uploaded for this provider" },
                { status: 404 }
            )
        }

        // Read file from disk
        const fileBuffer = await readFile(tariffFile.file_path)

        // Create audit log
        await prisma.auditLog.create({
            data: {
                user_id: session.user.id,
                action: "TARIFF_FILE_DOWNLOAD",
                resource: "provider_tariff_files",
                resource_id: tariffFile.id,
                new_values: {
                    provider_id: providerId,
                    file_name: tariffFile.file_name
                },
            },
        })

        // Return file as download
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': tariffFile.mime_type,
                'Content-Disposition': `attachment; filename="${tariffFile.file_name}"`,
                'Content-Length': tariffFile.file_size.toString()
            }
        })

    } catch (error) {
        console.error("Error downloading tariff file:", error)
        return NextResponse.json(
            { error: "Failed to download tariff file" },
            { status: 500 }
        )
    }
}
