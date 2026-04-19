import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.toLowerCase() || ""

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        diagnoses: [],
        total: 0,
        message: "Please enter at least 2 characters to search"
      })
    }

    // Search diagnoses in database by code or description
    const diagnoses = await prisma.diagnosis.findMany({
      where: {
        OR: [
          {
            code: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            description: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ]
      },
      take: 20, // Limit results to 20 for performance
      orderBy: {
        code: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      diagnoses,
      total: diagnoses.length,
      query: query
    })

  } catch (error) {
    console.error("Error searching diagnoses:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to search diagnoses",
        diagnoses: []
      },
      { status: 500 }
    )
  }
}
