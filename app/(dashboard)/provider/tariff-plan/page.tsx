"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { TariffPlanTabV2 as TariffPlanTab } from "@/components/provider/tariff-plan-tab-v2"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"



export default function ProviderTariffPlanPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedProviderId, setSelectedProviderId] = useState<string>("")
  const userSelectedProviderRef = useRef(false) // Track if user manually selected a provider

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    }
  }, [status, router])

  // Fetch current user's provider_id from /api/users/me if not in session
  // This is a fallback for existing sessions that don't have provider_id yet
  const { data: currentUserData } = useQuery({
    queryKey: ["current-user", session?.user?.id],
    queryFn: async () => {
      const res = await fetch("/api/users/me")
      if (!res.ok) return null
      return res.json()
    },
    enabled:
      status === "authenticated" &&
      !!session?.user?.id &&
      !session?.user?.provider_id &&
      session?.user?.role === "PROVIDER",
  })

  // Initialize with session provider_id if available - this should take priority
  // Also check currentUserData as fallback if session doesn't have it yet
  useEffect(() => {
    const providerId = session?.user?.provider_id || currentUserData?.provider_id
    if (providerId) {
      // Always set from session/database if available - this takes priority over any auto-selection
      console.log('[TariffPlanPage] Setting provider:', providerId, 'from:', session?.user?.provider_id ? 'session' : 'database')
      setSelectedProviderId(providerId)
      userSelectedProviderRef.current = false // Reset since this is from session/database, not manual
    } else if (session?.user?.role === "PROVIDER") {
      console.warn('[TariffPlanPage] PROVIDER role user has no provider_id. User may need to be linked to a provider.')
    }
  }, [session?.user?.provider_id, session?.user?.role, currentUserData?.provider_id])

  // Fetch providers if user has PROVIDER role and no provider_id
  const { data: providersData, isLoading: isLoadingProviders, error: providersError } = useQuery({
    queryKey: ["providers", "all"],
    queryFn: async () => {
      const res = await fetch("/api/providers?limit=1000")
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch providers")
      }
      return res.json()
    },
    enabled: status === "authenticated" && !session?.user?.provider_id && session?.user?.role === "PROVIDER",
  })

  // Fetch all providers for admin/provider manager roles
  const { data: allProvidersData } = useQuery({
    queryKey: ["providers", "all-admin"],
    queryFn: async () => {
      const res = await fetch("/api/providers?limit=1000")
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch providers")
      }
      return res.json()
    },
    enabled:
      status === "authenticated" &&
      (session?.user?.role === "PROVIDER_MANAGER" ||
        session?.user?.role === "ADMIN" ||
        session?.user?.role === "SUPER_ADMIN") &&
      !session?.user?.provider_id,
  })

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  // Extract providers from API response - API returns { providers: [...], pagination: {...} }
  const providers = providersData?.providers || allProvidersData?.providers || []

  // Auto-select provider for PROVIDER role users
  // ONLY if they don't have provider_id in session
  // If they have provider_id in session, it's already set above and should NOT be overridden
  useEffect(() => {
    // Only auto-select if:
    // 1. User is PROVIDER role
    // 2. NO provider_id in session (if session has provider_id, don't override it)
    // 3. No provider currently selected
    // 4. Providers have finished loading
    // 5. We have providers available
    // 6. User hasn't manually selected one
    if (
      session?.user?.role === "PROVIDER" &&
      !session?.user?.provider_id && // CRITICAL: Only if NO provider_id in session
      !selectedProviderId && // No provider currently selected
      !isLoadingProviders && // Providers have finished loading
      providers.length > 0 && // We have providers available
      !userSelectedProviderRef.current // User hasn't manually selected one
    ) {
      // Auto-select the first provider ONLY if session doesn't have provider_id
      console.log('[TariffPlanPage] Auto-selecting first provider from list:', providers[0].id, providers[0].facility_name)
      setSelectedProviderId(providers[0].id)
    }
  }, [
    session?.user?.role,
    session?.user?.provider_id,
    selectedProviderId,
    isLoadingProviders,
    providers,
  ])

  // Debug providers extraction
  useEffect(() => {
    if (providersData || allProvidersData) {

    }
  }, [providersData, allProvidersData, providers.length])
  // Use selectedProviderId if set, otherwise fall back to session provider_id
  // This prevents providerId from becoming empty if selectedProviderId is cleared
  const providerId = selectedProviderId || session?.user?.provider_id || ""
  const isProviderRole = session.user.role === "PROVIDER"
  const canSelectProvider =
    !session.user.provider_id &&
    (isProviderRole ||
      session.user.role === "PROVIDER_MANAGER" ||
      session.user.role === "ADMIN" ||
      session.user.role === "SUPER_ADMIN")

  // Disable select if provider was auto-selected for PROVIDER role users
  // (either from session.provider_id or auto-selected from list)
  const isSelectDisabled =
    isProviderRole &&
    selectedProviderId &&
    (
      session?.user?.provider_id || // Provider from session
      !userSelectedProviderRef.current // Auto-selected from list
    )

  // Debug logging - track all state changes
  useEffect(() => {


  }, [providerId, selectedProviderId, (session?.user as any)?.provider_id, session?.user?.role, canSelectProvider, providers.length, providersData, allProvidersData, isLoadingProviders, providersError])

  // Debug when providers finish loading
  useEffect(() => {
    if (!isLoadingProviders && (providersData || allProvidersData)) {
      // If providers loaded but user hasn't selected one yet, log a warning
      if (providers.length > 0 && !selectedProviderId && canSelectProvider) {
      }

      // If no providers loaded, log a warning
      if (providers.length === 0 && canSelectProvider) {

      }
    }
  }, [isLoadingProviders, providersData, allProvidersData, providers.length, selectedProviderId, providerId, canSelectProvider])


  // Reset selected provider if it becomes invalid (only if providers have loaded)
  // IMPORTANT: Only reset if user doesn't have provider_id in session AND user manually selected
  useEffect(() => {

    // Only reset if:
    // 1. User manually selected a provider (no provider_id in session AND userSelectedProviderRef is true)
    // 2. Providers have finished loading
    // 3. Providers data has loaded
    // 4. The selected provider doesn't exist in the list
    if (
      selectedProviderId &&
      !(session?.user as any)?.provider_id && // Only reset if user manually selected (no session provider_id)
      userSelectedProviderRef.current && // User actually selected this provider
      !isLoadingProviders && // Providers have finished loading
      (providersData || allProvidersData) && // Providers data has loaded
      providers.length > 0 // We have providers to check against
    ) {
      const providerExists = providers.some((p: any) => p.id === selectedProviderId)

      if (!providerExists) {
        userSelectedProviderRef.current = false // Reset the flag
        setSelectedProviderId("")
      } else {
      }
    } else {
    }
  }, [selectedProviderId, providers, isLoadingProviders, (session?.user as any)?.provider_id, providersData, allProvidersData])


  return (
    <PermissionGate module="provider" action="manage_tariff_plan" fallback={
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-semibold">Access Denied</p>
              <p className="text-red-600 mt-2">
                You do not have permission to manage tariff plans. Please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Tariff Plan Management</h1>
          <p className="text-gray-600 mt-2">
            Manage your service prices and submit your tariff plan for approval
          </p>
        </div>

        {/* Provider Selection for users without provider_id */}
        {canSelectProvider && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Provider</CardTitle>
              <CardDescription>
                {isProviderRole
                  ? "Please select the provider you want to manage the tariff plan for"
                  : "Select a provider to manage their tariff plan"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                return null
              })()}
              {isLoadingProviders ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  <span className="ml-2 text-gray-600">Loading providers...</span>
                </div>
              ) : providersError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-semibold">Error Loading Providers</p>
                  <p className="text-red-600 mt-1 text-sm">
                    {providersError instanceof Error ? providersError.message : "Failed to load providers"}
                  </p>
                </div>
              ) : providers.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">No providers available. Please contact your administrator.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="provider-select">Provider</Label>
                  <Select
                    value={selectedProviderId}
                    onValueChange={(value) => {
                      userSelectedProviderRef.current = true // Mark that user manually selected
                      setSelectedProviderId(value)
                    }}
                    disabled={!!isSelectDisabled}
                  >
                    <SelectTrigger id="provider-select" className="w-full" disabled={!!isSelectDisabled}>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider: any) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.facility_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedProviderId && (
                    <p className="text-sm text-gray-500 mt-2">
                      Please select a provider to continue
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Show message if no provider selected and no provider_id in session */}
        {!providerId && !canSelectProvider && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  You are not linked to a provider. Please contact your administrator to link your account to a provider.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tariff Plan Tab - only show if provider is selected */}
        {providerId ? (
          <TariffPlanTab key={providerId} providerId={providerId} mode="provider" />
        ) : canSelectProvider ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-12">
                <p className="text-gray-600">Please select a provider to view and manage their tariff plan.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  You are not linked to a provider. Please contact your administrator to link your account to a provider.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PermissionGate>
  )
}

