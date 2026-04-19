import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function rateLimit(ip: string, limit = 1000, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const key = ip
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

export default withAuth(
  function middleware(req: NextRequest) {
    // Rate limiting
    const ip = req.ip || req.headers.get("x-forwarded-for") || "unknown"
    if (!rateLimit(ip)) {
      return new NextResponse(
        JSON.stringify({ error: "Too Many Requests" }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    // Security headers
    const response = NextResponse.next()
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow public routes
        if (req.nextUrl.pathname.startsWith("/auth")) {
          return true
        }

        // Allow provider registration page without authentication
        if (req.nextUrl.pathname.startsWith("/provider-registration")) {
          return true
        }

        // Allow principal registration page without authentication
        if (req.nextUrl.pathname.startsWith("/principal-registration")) {
          return true
        }

        // Allow client auth pages without authentication
        if (req.nextUrl.pathname.startsWith("/client/login")) {
          return true
        }
        if (req.nextUrl.pathname.startsWith("/client/register")) {
          return true
        }

        // Allow mobile sso without authentication
        if (req.nextUrl.pathname.startsWith("/mobile-sso")) {
          return true
        }

        // Allow public telemedicine routes without authentication
        if (req.nextUrl.pathname.startsWith("/public/lab-results")) {
          return true
        }
        if (req.nextUrl.pathname.startsWith("/public/radiology-results")) {
          return true
        }
        if (req.nextUrl.pathname.startsWith("/pharmacy-orders")) {
          return true
        }
        if (req.nextUrl.pathname.startsWith("/telemedicine/facility-portal")) {
          return true
        }
        if (req.nextUrl.pathname.startsWith("/public/benefit-plans")) {
          return true
        }

        // Require authentication for all other routes
        return !!token
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  },
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/ (ALL API routes - let them handle their own auth)
     * - api/auth (authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static files (images, sounds, etc.)
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|mp3|wav|pdf|csv|json|css|js)$).*)",
  ],
}
