"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"

export const dynamic = 'force-dynamic'

/**
 * Legacy Vetter2 Page - Redirects to new vetter2 vetter page
 * This page exists for backward compatibility
 * Redirects to /claims/vetter2/vetter/[id]
 */
export default function LegacyVetter2Redirect() {
  const router = useRouter()
  const params = useParams()
  const claimId = params.id as string

  useEffect(() => {
    // Always redirect to vetter2/vetter page
    router.replace(`/claims/vetter2/vetter/${claimId}`)
  }, [claimId, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
}
