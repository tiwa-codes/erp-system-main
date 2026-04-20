"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { TariffPlanTabV2 } from "@/components/provider/tariff-plan-tab-v2"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Card, CardContent } from "@/components/ui/card"
import { Combobox } from "@/components/ui/combobox"

export const dynamic = 'force-dynamic'

interface ProviderOption {
  id: string
  facility_name: string
  provider_id?: string | null
}

export default function ProviderTariffAgreementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [providerId, setProviderId] = useState("")
  const [providerLinkError, setProviderLinkError] = useState<string | null>(null)

  const canSelectProvider = session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login")
  }, [status, router])

  const { data: me } = useQuery({
    queryKey: ["users-me", session?.user?.id],
    queryFn: async () => {
      const res = await fetch("/api/users/me")
      if (!res.ok) return null
      return res.json()
    },
    enabled: status === "authenticated" && !!session?.user?.id,
  })

  const { data: providersData } = useQuery({
    queryKey: ["providers-for-admin-tariff", canSelectProvider],
    queryFn: async () => {
      const res = await fetch("/api/providers?page=1&limit=5000")
      if (!res.ok) return { providers: [] }
      return res.json()
    },
    enabled: status === "authenticated" && canSelectProvider,
  })

  useEffect(() => {
    if (canSelectProvider) {
      setProviderLinkError(null)
      return
    }

    const providerFromSession = typeof session?.user?.provider_id === "string" ? session.user.provider_id.trim() : ""
    const providerFromMe = typeof me?.provider_id === "string" ? me.provider_id.trim() : ""

    // Never overwrite an already resolved provider ID with an empty value.
    const resolvedProviderId = providerFromMe || providerFromSession || providerId

    if (resolvedProviderId && resolvedProviderId !== providerId) {
      setProviderId(resolvedProviderId)
    }

    if (status === "authenticated" && !resolvedProviderId) {
      setProviderLinkError("Your provider account is not linked to a facility yet. Please contact Provider Management to complete your provider linkage.")
    } else {
      setProviderLinkError(null)
    }
  }, [canSelectProvider, session?.user?.provider_id, me?.provider_id, providerId, status])

  const providerOptions = Array.isArray(providersData?.providers)
    ? (providersData.providers as ProviderOption[]).map((provider) => ({
        value: provider.id,
        label: provider.facility_name,
        subtitle: provider.provider_id || undefined,
      }))
    : []

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <PermissionGate module="provider" action="manage_tariff_plan">
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tariff Agreement</h1>
          <p className="text-gray-600 mt-2">
            Review CJHMO tariffs, accept all, or customize and submit for negotiation.
          </p>
        </div>
        {canSelectProvider && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Select Provider</p>
              <Combobox
                options={providerOptions}
                value={providerId}
                onValueChange={setProviderId}
                placeholder="Select provider facility"
                searchPlaceholder="Search provider..."
                emptyText="No providers found"
                clearable
              />
            </CardContent>
          </Card>
        )}
        {providerLinkError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-red-800">Provider Link Required</p>
              <p className="text-sm text-red-700 mt-1">{providerLinkError}</p>
            </CardContent>
          </Card>
        ) : canSelectProvider && !providerId ? (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-800">Choose a provider above to view their tariff agreement.</p>
            </CardContent>
          </Card>
        ) : (
          <TariffPlanTabV2 providerId={providerId} mode="provider" />
        )}
      </div>
    </PermissionGate>
  )
}

