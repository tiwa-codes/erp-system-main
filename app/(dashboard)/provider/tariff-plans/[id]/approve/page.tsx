"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react"
import { format } from "date-fns"
import { useSession } from "next-auth/react"

type TariffPlanServiceRow = {
  id: string
  service_id?: string | null
  service_name: string
  price: number | string
  original_price?: number | string | null
}

export default function ApproveTariffPlanPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const params = useParams()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const tariffPlanId = params.id as string
  const returnTo = searchParams.get("returnTo") || "/provider/tariff-plans/pending"

  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [approvalComments, setApprovalComments] = useState("")
  const [editablePrices, setEditablePrices] = useState<Record<string, { cjhmoTariff: string; providerTariff: string }>>({})

  const { data, isLoading } = useQuery({
    queryKey: ["tariff-plan", tariffPlanId],
    queryFn: async () => {
      const res = await fetch(`/api/provider/tariff-plan/${tariffPlanId}`)
      if (!res.ok) throw new Error("Failed to fetch tariff plan")
      return res.json()
    },
    enabled: !!tariffPlanId,
  })

  const tariffPlan = data?.tariffPlan
  const latestMsa = tariffPlan?.msas?.[0] || null
  const isAdminRole = ["ADMIN", "SUPER_ADMIN"].includes((session?.user?.role || "").toUpperCase())
  const negotiationComment = data?.negotiation_comment

  // Services are already included in tariff plan data
  const services = useMemo<TariffPlanServiceRow[]>(
    () => (Array.isArray(tariffPlan?.tariff_plan_services) ? tariffPlan.tariff_plan_services : []),
    [tariffPlan?.tariff_plan_services]
  )

  const resolveApprovalEndpoint = (stage: string, isCustomized: boolean) => {
    // Non-customized plans use the direct approval route (no staged workflow transitions).
    if (!isCustomized) {
      return `/api/provider/tariff-plan/${tariffPlanId}/approve`
    }

    const normalizedStage = stage.toUpperCase()
    if (normalizedStage === "UNDERWRITING") {
      return `/api/provider/tariff-plan/${tariffPlanId}/approve/underwriting`
    }
    if (normalizedStage === "SPECIAL_RISK") {
      return `/api/provider/tariff-plan/${tariffPlanId}/approve/special-risk`
    }
    if (normalizedStage === "MD") {
      return `/api/provider/tariff-plan/${tariffPlanId}/approve/md`
    }
    return `/api/provider/tariff-plan/${tariffPlanId}/approve`
  }

  useEffect(() => {
    if (!services.length) {
      setEditablePrices({})
      return
    }

    const seeded: Record<string, { cjhmoTariff: string; providerTariff: string }> = {}
    services.forEach((service) => {
      const cjhmoTariff = service.original_price != null
        ? Number(service.original_price)
        : Number(service.price)
      const providerTariff = Number(service.price)

      seeded[service.id] = {
        cjhmoTariff: Number.isFinite(cjhmoTariff) ? String(cjhmoTariff) : "0",
        providerTariff: Number.isFinite(providerTariff) ? String(providerTariff) : "0",
      }
    })

    setEditablePrices(seeded)
  }, [services])

  const updateServicePriceMutation = useMutation({
    mutationFn: async ({ serviceId, cjhmoTariff, providerTariff }: { serviceId: string; cjhmoTariff: number; providerTariff: number }) => {
      const res = await fetch(`/api/provider/tariff-plan/services/${serviceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_price: cjhmoTariff,
          price: providerTariff,
        }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Failed to update service pricing")
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariff-plan", tariffPlanId] })
      toast({
        title: "Updated",
        description: "Service pricing updated successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handlePriceFieldChange = (serviceId: string, field: "cjhmoTariff" | "providerTariff", value: string) => {
    setEditablePrices((prev) => ({
      ...prev,
      [serviceId]: {
        ...(prev[serviceId] || { cjhmoTariff: "0", providerTariff: "0" }),
        [field]: value,
      },
    }))
  }

  const handleSaveServicePrices = (serviceId: string) => {
    const current = editablePrices[serviceId]
    if (!current) return

    const cjhmoTariff = Number(current.cjhmoTariff)
    const providerTariff = Number(current.providerTariff)

    if (Number.isNaN(cjhmoTariff) || cjhmoTariff < 0 || Number.isNaN(providerTariff) || providerTariff < 0) {
      toast({
        title: "Validation error",
        description: "Both tariff values must be valid non-negative numbers",
        variant: "destructive",
      })
      return
    }

    updateServicePriceMutation.mutate({ serviceId, cjhmoTariff, providerTariff })
  }

  const approveMutation = useMutation({
    mutationFn: async (comments?: string) => {
      // Always re-check the latest stage right before approval to avoid stale-page stage mismatches.
      const latestRes = await fetch(`/api/provider/tariff-plan/${tariffPlanId}`)
      if (!latestRes.ok) {
        throw new Error("Unable to verify latest tariff plan stage. Please refresh and try again.")
      }

      const latestPayload = await latestRes.json()
      const latestPlan = latestPayload?.tariffPlan
      const stage = (latestPlan?.approval_stage || tariffPlan?.approval_stage || "").toUpperCase()
      const isCustomized =
        typeof latestPlan?.is_customized === "boolean"
          ? latestPlan.is_customized
          : Boolean(tariffPlan?.is_customized)
      const endpoint = resolveApprovalEndpoint(stage, isCustomized)

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to approve tariff plan")
      }
      return res.json()
    },
    onSuccess: (response) => {
      toast({
        title: "Success",
        description: response?.message || "Tariff plan approved successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ["pending-tariff-plans"] })
      queryClient.invalidateQueries({ queryKey: ["tariff-plan", tariffPlanId] })
      router.push(returnTo)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetch(`/api/provider/tariff-plan/${tariffPlanId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: reason }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to reject tariff plan")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tariff plan rejected successfully. Provider has been notified.",
      })
      queryClient.invalidateQueries({ queryKey: ["pending-tariff-plans"] })
      router.push(returnTo)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const regenerateMsaMutation = useMutation({
    mutationFn: async () => {
      if (!latestMsa?.id) {
        throw new Error("No MSA record found for this tariff plan")
      }

      const response = await fetch(`/api/legal/msa/${latestMsa.id}/document?regenerate=true&t=${Date.now()}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to regenerate MSA")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = `msa-${latestMsa.id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    },
    onSuccess: () => {
      toast({
        title: "MSA regenerated",
        description: "A regenerated MSA document has been downloaded.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Regeneration failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleViewMsa = () => {
    if (!latestMsa?.id) return
    window.open(`/api/legal/msa/${latestMsa.id}/document?t=${Date.now()}`, "_blank", "noopener,noreferrer")
  }

  const handleApprove = () => {
    const stage = (tariffPlan?.approval_stage || "").toUpperCase()
    const message =
      stage === "UNDERWRITING"
        ? "Are you sure you want to accept this tariff negotiation and forward it to MD?"
        : stage === "SPECIAL_RISK"
          ? "Are you sure you want to accept this tariff negotiation and forward it to MD?"
          : "Are you sure you want to approve this tariff plan?"

    if (confirm(message)) {
      approveMutation.mutate(approvalComments.trim() || undefined)
    }
  }

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      })
      return
    }
    if (confirm("Are you sure you want to reject this tariff plan?")) {
      rejectMutation.mutate(rejectionReason)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!tariffPlan) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Tariff plan not found</p>
        </div>
      </div>
    )
  }

  return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push(returnTo)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Review Tariff Plan</h1>
            <p className="text-gray-600 mt-2">
              Provider: {tariffPlan.provider?.facility_name || "Unknown"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Provider Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Facility Name</Label>
                <p className="font-medium">{tariffPlan.provider?.facility_name || "N/A"}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="font-medium">{tariffPlan.provider?.email || "N/A"}</p>
              </div>
              <div>
                <Label>Phone</Label>
                <p className="font-medium">{tariffPlan.provider?.phone_whatsapp || "N/A"}</p>
              </div>
              <div>
                <Label>Submitted Date</Label>
                <p className="font-medium">
                  {tariffPlan.submitted_at
                    ? format(new Date(tariffPlan.submitted_at), "MMM dd, yyyy HH:mm")
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services & Pricing</CardTitle>
            <CardDescription>
              Review CJHMO tariff and provider custom tariff for this submission
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(tariffPlan?.approval_stage || "").toUpperCase() === "MD" && negotiationComment && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-semibold text-blue-900">Negotiation Comment</p>
                <p className="text-sm text-blue-800 mt-1">{String(negotiationComment)}</p>
              </div>
            )}
            {services.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No services found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Name</TableHead>
                    <TableHead className="text-right">CJHMO Tariff (₦)</TableHead>
                    <TableHead className="text-right">Provider Custom Tariff (₦)</TableHead>
                    <TableHead className="text-right">Modify</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id} className={(service.service_id || "").toLowerCase().startsWith("manual_") ? "bg-orange-50" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{service.service_name}</span>
                          {(service.service_id || "").toLowerCase().startsWith("manual_") && (
                            <Badge className="bg-orange-500 text-white">Manual</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editablePrices[service.id]?.cjhmoTariff ?? ""}
                          onChange={(e) => handlePriceFieldChange(service.id, "cjhmoTariff", e.target.value)}
                          className="w-44 ml-auto text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editablePrices[service.id]?.providerTariff ?? ""}
                          onChange={(e) => handlePriceFieldChange(service.id, "providerTariff", e.target.value)}
                          className="w-44 ml-auto text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveServicePrices(service.id)}
                          disabled={updateServicePriceMutation.isPending}
                        >
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {!showRejectForm ? (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {latestMsa?.id && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-semibold text-emerald-900">MSA Document</p>
                  <p className="text-xs text-emerald-800 mt-1">MSA ID: {latestMsa.id}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleViewMsa}>
                      View MSA
                    </Button>
                    {isAdminRole && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => regenerateMsaMutation.mutate()}
                        disabled={regenerateMsaMutation.isPending}
                      >
                        {regenerateMsaMutation.isPending ? "Regenerating..." : "Regenerate MSA"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={handleApprove}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {approveMutation.isPending
                    ? "Approving..."
                    : (tariffPlan?.approval_stage || "").toUpperCase() === "MD"
                      ? "Approve and Send MSA"
                      : "Approve Tariff Plan"}
                </Button>
                <Button
                  onClick={() => setShowRejectForm(true)}
                  variant="destructive"
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Tariff Plan
                </Button>
              </div>
              <div className="mt-4">
                <Label htmlFor="approval-comments">Approval Comment (Optional)</Label>
                <Textarea
                  id="approval-comments"
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder="Add optional comments for this approval..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Reject Tariff Plan</CardTitle>
              <CardDescription>
                Please provide a reason for rejection. The provider will be notified.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                  rows={4}
                />
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={handleReject}
                  variant="destructive"
                  disabled={rejectMutation.isPending || !rejectionReason.trim()}
                >
                  {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                </Button>
                <Button
                  onClick={() => {
                    setShowRejectForm(false)
                    setRejectionReason("")
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
  )
}
