"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

export const dynamic = 'force-dynamic'

/**
 * Legacy Vetter Page - Redirects to new vetter pages
 * This page exists for backward compatibility
 * Redirects to /claims/vetter1/vetter/[id] or /claims/vetter2/vetter/[id]
 * based on the claim's current_stage
 */
export default function LegacyVetterRedirect() {
  const router = useRouter()
  const params = useParams()
  const claimId = params.id as string

  // Fetch claim to determine which vetter page to redirect to
  const { data: claimData, isLoading } = useQuery({
    queryKey: ["claim-redirect", claimId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}`)
      if (!res.ok) throw new Error("Failed to fetch claim")
      return res.json()
    },
  })

  useEffect(() => {
    if (claimData?.claim) {
      const stage = claimData.claim.current_stage

      // Redirect based on current_stage
      if (stage === 'vetter1') {
        router.replace(`/claims/vetter1/vetter/${claimId}`)
      } else if (stage === 'vetter2') {
        router.replace(`/claims/vetter2/vetter/${claimId}`)
      } else {
        // Default to vetter1 for backward compatibility
        router.replace(`/claims/vetter1/vetter/${claimId}`)
      }
    }
  }, [claimData, claimId, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to vetter page...</p>
      </div>
    </div>
  )
}
