import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
      return NextResponse.json({ error: "Provider ID is required" }, { status: 400 })
    }

    const tariffFile = await prisma.providerTariffFile.findUnique({
      where: { provider_id: providerId },
      select: { id: true, uploaded_at: true, file_name: true },
    })

    return NextResponse.json({
      exists: !!tariffFile,
      uploaded_at: tariffFile?.uploaded_at || null,
      file_name: tariffFile?.file_name || null,
    })
  } catch (error) {
    console.error("Error fetching tariff file status:", error)
    return NextResponse.json({ error: "Failed to fetch tariff file status" }, { status: 500 })
  }
}
