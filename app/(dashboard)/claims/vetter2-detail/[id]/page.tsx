"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export const dynamic = 'force-dynamic'

/**
 * Legacy route kept for backward compatibility.
 * Canonical provider-scoped view now lives at /claims/vetter2/provider/[providerId].
 */
export default function Vetter2DetailLegacyRedirectPage() {
  const router = useRouter()
  const params = useParams()
  const providerId = params.id as string

  useEffect(() => {
    if (!providerId) return
    router.replace(`/claims/vetter2/provider/${providerId}`)
  }, [providerId, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
}
