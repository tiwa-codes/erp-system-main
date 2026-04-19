import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type Diagnostics = {
  timestamp: string
  environment: string | undefined
  session: {
    exists: boolean
    userId: string | undefined
    userRole: string | undefined
  }
  database: {
    url_exists: boolean
    url_preview: string
    connection?: "SUCCESS" | "FAILED"
    error?: string
    user_count?: number
    query_error?: string
  }
  env_vars: {
    nextauth_url: boolean
    nextauth_secret: boolean
    resend_api_key: boolean
    cloudinary_configured: boolean
  }
}

export async function GET(request: NextRequest) {
  try {
    void request

    // Check if this is production and if we should allow this endpoint
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEBUG_ENDPOINTS) {
      return NextResponse.json({ error: "Debug endpoint disabled in production" }, { status: 404 })
    }

    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Basic environment checks
    const diagnostics: Diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      session: {
        exists: !!session,
        userId: session?.user?.id,
        userRole: session?.user?.role
      },
      database: {
        url_exists: !!process.env.DATABASE_URL,
        url_preview: process.env.DATABASE_URL ? 
          process.env.DATABASE_URL.substring(0, 20) + "..." : "Missing"
      },
      env_vars: {
        nextauth_url: !!process.env.NEXTAUTH_URL,
        nextauth_secret: !!process.env.NEXTAUTH_SECRET,
        resend_api_key: !!process.env.RESEND_API_KEY,
        cloudinary_configured: !!(
          process.env.CLOUDINARY_CLOUD_NAME && 
          process.env.CLOUDINARY_API_KEY && 
          process.env.CLOUDINARY_API_SECRET
        )
      }
    }

    // Try a simple database connection test
    try {
      await prisma.$queryRaw`SELECT 1 as test`
      diagnostics.database.connection = "SUCCESS"
    } catch (dbError) {
      diagnostics.database.connection = "FAILED"
      diagnostics.database.error = dbError instanceof Error ? dbError.message : "Unknown database error"
    }

    // Test if we can fetch a simple record
    try {
      const userCount = await prisma.user.count()
      diagnostics.database.user_count = userCount
    } catch (dbError) {
      diagnostics.database.query_error = dbError instanceof Error ? dbError.message : "Failed to query users"
    }

    return NextResponse.json(diagnostics, { status: 200 })

  } catch (error) {
    console.error("Production check error:", error)
    return NextResponse.json({
      error: "Diagnostic check failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
