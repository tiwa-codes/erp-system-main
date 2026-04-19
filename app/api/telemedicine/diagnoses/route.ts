import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim() || ""
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50)

    if (search.length < 2) {
      return NextResponse.json({ diagnoses: [] })
    }

    const diagnoses = await prisma.diagnosis.findMany({
      where: {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true, description: true },
      orderBy: { code: "asc" },
      take: limit,
    })

    return NextResponse.json({ diagnoses })
  } catch (error) {
    console.error("Error fetching diagnoses:", error)
    return NextResponse.json({ error: "Failed to fetch diagnoses" }, { status: 500 })
  }
}
