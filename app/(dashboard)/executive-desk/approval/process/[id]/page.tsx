"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  FileText,
  Clock,
  Paperclip,
  Trash2,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { ApprovalCodeTimeline } from "@/components/approval-code-timeline"
import { PermissionGate } from "@/components/ui/permission-gate"
import { VettingProgressTracker } from "@/components/claims/VettingProgressTracker"
import { PriceSummary } from "@/components/claims/PriceSummary"
import { PriceEditor } from "@/components/claims/PriceEditor"
import { AutoSaveIndicator } from "@/components/claims/AutoSaveIndicator"
import { VettingActionButtons } from "@/components/claims/VettingActionButtons"
import { useAutoSave } from "@/hooks/useAutoSave"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession } from "next-auth/react"
import { ClaimEnrolleeCard } from "@/components/claims/ClaimEnrolleeCard"
import { ServiceVettingTable, ServiceItem, isDrugItem } from "@/components/claims/ServiceVettingTable"
import { AuditTrailView } from "@/components/claims/AuditTrailView"
import { FileViewerModal } from "@/components/ui/file-viewer-modal"

interface Claim {
  id: string
  claim_number: string
  enrollee_id: string
  beneficiary?: {
    id: string
    first_name: string
    last_name: string
  }
  principal?: {
    id: string
    first_name: string
    last_name: string
    enrollee_id: string
  }
  enrollee_utilization?: {
    amount_utilized: number
    balance: number
  }
  encounter_code?: string
  provider_id: string
  provider: {
    id: string
    facility_name: string
  }
  amount: number
  submitted_at?: string
  original_amount: number
  approved_amount?: number
  current_stage?: string
  approval_codes?: Array<{
    approval_code: string
    service_items: any[]
  }>
  is_primary_hospital?: boolean
}

export default function ApprovalProcessPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  const claimId = params.id as string
  const returnTo = searchParams.get("returnTo")
  const stage: "vetter1" | "vetter2" | "audit" | "approval" = "approval"

  const navigateBack = () => {
    if (returnTo) {
      router.push(returnTo)
    } else if (claim?.provider_id) {
      router.push(`/executive-desk/approval/${claim.provider_id}`)
    } else {
      router.push("/executive-desk/approval")
    }
  }

  // State
  const [vettingComments, setVettingComments] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [claimedServices, setClaimedServices] = useState<ServiceItem[]>([])
  const [showTimelineModal, setShowTimelineModal] = useState(false)

  // Service Rejection State
  const [serviceToRemove, setServiceToRemove] = useState<string | null>(null)
  const [specificRejectionReason, setSpecificRejectionReason] = useState("")
  const [showServiceRejectionModal, setShowServiceRejectionModal] = useState(false)

  // Attachment state
  const [attachments, setAttachments] = useState<Array<{ id?: string; name: string; url: string; type: string; size: number; stage: string; uploaded_by?: string; uploaded_at?: string }>>([])  
  const [fileViewer, setFileViewer] = useState<{ url: string; name: string } | null>(null)
  // MD, Admins, Super Admins can edit price at approval stage
  const canEditPrice = ["ADMIN", "SUPER_ADMIN", "MD", "CLAIMS_PROCESSOR"].includes(session?.user?.role as string)

  // Fetch claim details
  const { data: claimData, isLoading } = useQuery({
    queryKey: ["claim-details", claimId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}`)
      if (!res.ok) throw new Error("Failed to fetch claim")
      return res.json()
    },
  })

  const claim = claimData?.claim as Claim

  // Fetch provider request data
  const { data: providerRequestData } = useQuery({
    queryKey: ["provider-request", claimId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/provider-request`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!claim
  })

  // Fetch previous vetting actions
  const { data: vettingActionsData } = useQuery({
    queryKey: ["vetting-actions", claimId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/vetting-actions`)
      if (!res.ok) return { actions: [] }
      return res.json()
    },
    enabled: !!claim
  })

  // Fetch existing attachments
  const { data: attachmentsData } = useQuery({
    queryKey: ["claim-attachments", claimId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/attachments`)
      if (!res.ok) return { attachments: [] }
      return res.json()
    },
    enabled: !!claim
  })

  useEffect(() => {
    if (attachmentsData?.attachments) {
      setAttachments(attachmentsData.attachments)
    }
  }, [attachmentsData])

  // Check if user can take action
  const { data: canTakeActionData } = useQuery({
    queryKey: ["can-take-action", claimId, stage],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/can-take-action?stage=${stage}`)
      if (!res.ok) return { canTakeAction: false }
      return res.json()
    },
    enabled: !!claim
  })

  const canTakeAction = canTakeActionData?.canTakeAction ?? false

  const parseAmount = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.-]/g, "")
      const parsed = Number(cleaned)
      return Number.isFinite(parsed) ? parsed : 0
    }
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const drugSubtotal = claimedServices
    .filter((s) => isDrugItem(s.category, s.service_name))
    .filter((s) => !s.is_deleted)
    .reduce((sum, s) => sum + parseAmount(s.vetted_amount ?? s.claimed_amount), 0)

  const serviceSubtotal = claimedServices
    .filter((s) => !isDrugItem(s.category, s.service_name))
    .filter((s) => !s.is_deleted)
    .reduce((sum, s) => sum + parseAmount(s.vetted_amount ?? s.claimed_amount), 0)

  // Combined subtotal for both sections shown on screen
  const liveTotal = drugSubtotal + serviceSubtotal

  // Parse services logic
  useEffect(() => {
    // Build modified_by_name lookup from previous vetting actions
    const prevModifiedByMap: Record<string, string> = {}
    if (Array.isArray(vettingActionsData?.actions)) {
      for (const action of vettingActionsData.actions) {
        if (Array.isArray(action.service_verdicts)) {
          for (const sv of action.service_verdicts) {
            if (sv.id && sv.modified_by_name) {
              prevModifiedByMap[sv.id] = sv.modified_by_name
            }
          }
        }
      }
    }

    if (claim?.approval_codes?.[0]?.service_items) {
      const parsedFromApprovals = claim.approval_codes[0].service_items.map((service: any) => {
        const qty = service.quantity || 1
        const unitPrice = Number(service.service_amount)  // service_amount is per-unit in DB
        const lineTotal = unitPrice * qty
        return {
          id: service.id,
          service_name: service.service_name,
          claimed_amount: lineTotal,
          tariff_amount: Number(service.tariff_price || service.service_amount) * qty,
          vetted_amount: service.vetted_amount != null ? Number(service.vetted_amount) : lineTotal,
          quantity: qty,
          unit_price: unitPrice,
          verdict: (service.is_vetted_approved ? "COVERED" : "NOT_COVERED") as any,
          price_verdict: "MATCH" as const,
          category: service.category || "SERVICE",
          is_deleted: service.is_deleted || false,
          rejection_reason: service.rejection_reason || undefined,
          is_ad_hoc: service.is_ad_hoc || false,
          modified_by_name: prevModifiedByMap[service.id]
        }
      })
      setClaimedServices(parsedFromApprovals)
      return
    }

    // Fallback if no approval code items
    const requestItems = providerRequestData?.providerRequest?.request_items
    if (Array.isArray(requestItems) && requestItems.length > 0) {
      const parsedFromItems = requestItems.map((service: any, index: number) => {
        const qty = service.quantity || 1
        return {
          id: service.id || index.toString(),
          service_name: service.service_name || "Unknown Service",
          claimed_amount: Number(service.service_amount) * qty,
          tariff_amount: Number(service.tariff_price || service.service_amount) * qty,
          vetted_amount: Number(service.service_amount) * qty,
          quantity: qty,
          unit_price: Number(service.service_amount),
          verdict: "COVERED" as const,
          price_verdict: "MATCH" as const,
          category: service.category || "SERVICE",
          is_ad_hoc: service.is_ad_hoc || false
        }
      })
      setClaimedServices(parsedFromItems)
    }
  }, [claim, providerRequestData, vettingActionsData])

  // Auto-save draft
  const draftData = {
    comments: vettingComments,
    services: claimedServices
  }

  const { isSaving, lastSaved, hasUnsavedChanges, clearDraft } = useAutoSave({
    claimId,
    stage,
    draftData,
    enabled: !!claim
  })

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const res = await fetch(`/api/claims/${claimId}/draft?stage=${stage}`)
        if (res.ok) {
          const data = await res.json()
          if (data.draft?.draft_data) {
            setVettingComments(data.draft.draft_data.comments || "")
            if (data.draft.draft_data.services) {
              setClaimedServices(data.draft.draft_data.services)
            }
          }
        }
      } catch (error) {
        console.error("Failed to load draft:", error)
      }
    }
    loadDraft()
  }, [claimId, stage])

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/approval/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comments: vettingComments,
          serviceVerdicts: claimedServices
        })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to approve")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Claim approved and finalized")
      clearDraft()
      queryClient.invalidateQueries({ queryKey: ["claim-details"] })
      queryClient.invalidateQueries({ queryKey: ["executive-approval-claims"] })
      // Redirect to enrollee list for this provider instead of main approval page
      if (claim?.provider_id) {
        router.push(`/executive-desk/approval/${claim.provider_id}`)
      } else {
        router.push("/executive-desk/approval")
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve claim")
    }
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/approval/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comments: vettingComments,
          reason: rejectionReason
        })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to reject")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Claim rejected and returned")
      clearDraft()
      queryClient.invalidateQueries({ queryKey: ["claim-details"] })
      queryClient.invalidateQueries({ queryKey: ["executive-approval-claims"] })
      // Redirect to enrollee list for this provider instead of main approval page
      if (claim?.provider_id) {
        router.push(`/executive-desk/approval/${claim.provider_id}`)
      } else {
        router.push("/executive-desk/approval")
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject claim")
    }
  })

  const handleApprove = () => {
    approveMutation.mutate()
  }

  const handleReject = () => {
    if (!showRejectDialog) {
      setShowRejectDialog(true)
      return
    }
    rejectMutation.mutate()
  }

  // Handle service updates and deletion
  const handleUpdateService = (id: string, updates: Partial<ServiceItem>) => {
    setClaimedServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const handleDeleteService = (id: string) => {
    setServiceToRemove(id)
    setShowServiceRejectionModal(true)
  }

  const confirmServiceRemoval = () => {
    if (serviceToRemove) {
      handleUpdateService(serviceToRemove, {
        is_deleted: true,
        rejection_reason: specificRejectionReason,
        verdict: 'REJECTED'
      })
      setServiceToRemove(null)
      setSpecificRejectionReason("")
      setShowServiceRejectionModal(false)
      toast.success("Service item rejected")
    }
  }

  // Handle service verdict changes
  const handleCoverageVerdictChange = (serviceId: string, verdict: "COVERED" | "NOT_COVERED") => {
    setClaimedServices(prev =>
      prev.map(service =>
        service.id === serviceId ? { ...service, verdict } : service
      )
    )
  }

  const handlePriceVerdictChange = (serviceId: string, verdict: "MATCH" | "ABOVE_TARIFF" | "BELOW_TARIFF") => {
    setClaimedServices(prev =>
      prev.map(service =>
        service.id === serviceId ? { ...service, price_verdict: verdict } : service
      )
    )
  }

  // Get verdict dropdown
  const getVerdictDropdown = (serviceId: string, verdict: string) => {
    const isPassed = verdict === "COVERED"
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto p-1">
            <div className="flex items-center">
              {isPassed ? (
                <span className="text-green-600 font-medium">Passed</span>
              ) : (
                <span className="text-red-600 font-medium">Failed</span>
              )}
              <ChevronDown className="h-3 w-3 ml-1" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleCoverageVerdictChange(serviceId, "COVERED")}>
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Passed
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCoverageVerdictChange(serviceId, "NOT_COVERED")}>
            <XCircle className="h-4 w-4 mr-2 text-red-600" />
            Failed
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const getPriceVerdictDropdown = (serviceId: string, verdict: string) => {
    const isPassed = verdict === "MATCH" || verdict === "BELOW_TARIFF"
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto p-1">
            <div className="flex items-center">
              {isPassed ? (
                <span className="text-green-600 font-medium">Passed</span>
              ) : (
                <span className="text-red-600 font-medium">Failed</span>
              )}
              <ChevronDown className="h-3 w-3 ml-1" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handlePriceVerdictChange(serviceId, "MATCH")}>
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Passed
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePriceVerdictChange(serviceId, "ABOVE_TARIFF")}>
            <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
            Failed
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePriceVerdictChange(serviceId, "BELOW_TARIFF")}>
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Passed (Below Tariff)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Claim Not Found</h2>
          <Button onClick={() => router.push("/executive-desk/approval")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Approval
          </Button>
        </div>
      </div>
    )
  }

  // Determine completed stages
  const completedStages: ("vetter1" | "vetter2" | "audit" | "approval")[] = []
  if (claim.current_stage === "vetter2" || claim.current_stage === "audit" || claim.current_stage === "approval") {
    completedStages.push("vetter1")
  }
  if (claim.current_stage === "audit" || claim.current_stage === "approval") {
    completedStages.push("vetter2")
  }
  if (claim.current_stage === "approval") {
    completedStages.push("audit")
  }

  const currentStage = (claim.current_stage || "approval") as "vetter1" | "vetter2" | "audit" | "approval"

  // Find the action that sent the claim to this stage (last action)
  const lastAction = vettingActionsData?.actions?.slice()?.reverse()?.[0]
  const isRejectedBack = lastAction?.action === 'REJECTED_BACK'

  return (
    <PermissionGate module="claims" action="approve">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={navigateBack} className="bg-white hover:bg-gray-100 text-gray-900 border-gray-300 font-bold shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              BACK
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 uppercase font-black tracking-tighter text-[10px] px-2 py-0">SMART APPROVAL SYSTEM</Badge>
                <div className="flex items-center text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#BE1522] mr-1.5 ring-2 ring-blue-100"></div>
                  FINAL MEDICAL DIRECTOR REVIEW
                </div>
                {lastAction ? (
                  <div className={`flex items-center gap-1.5 ml-4 px-2 py-0.5 border rounded text-[10px] font-bold uppercase tracking-tighter ${isRejectedBack ? "bg-red-50 border-red-100 text-red-600" : "bg-blue-50 border-blue-100 text-blue-600"}`}>
                    <Clock className="h-3.5 w-3.5" />
                    {isRejectedBack ? `REJECTED BACK FROM ${lastAction.stage.toUpperCase()} BY ${lastAction.action_by?.first_name} ${lastAction.action_by?.last_name}` : `SENT FROM ${lastAction.stage.toUpperCase()} BY ${lastAction.action_by?.first_name} ${lastAction.action_by?.last_name}`} AT {formatDateTime(lastAction.created_at)}
                  </div>
                ) : claim.submitted_at && (
                  <div className="flex items-center gap-1.5 ml-4 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-[10px] font-bold text-blue-600 uppercase tracking-tighter">
                    <Clock className="h-3.5 w-3.5" />
                    RECEIVED FROM {claim.provider?.facility_name || 'PROVIDER'} AT {formatDateTime(claim.submitted_at)}
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight truncate leading-tight">
                CrownJewel MD Approval System
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AutoSaveIndicator isSaving={isSaving} lastSaved={lastSaved} hasUnsavedChanges={hasUnsavedChanges} />
            <Button variant="outline" size="sm" onClick={() => setShowTimelineModal(true)} className="gap-2 border-gray-200 hover:bg-purple-50 font-bold">
              <Clock className="h-4 w-4 text-purple-600" />
              VIEW AUDIT LOG
            </Button>
          </div>
        </div>

        {/* Progress Tracker */}
        <Card>
          <CardContent className="pt-6">
            <VettingProgressTracker
              currentStage={currentStage}
              completedStages={completedStages}
            />
          </CardContent>
        </Card>

        {/* Claimed Enrollee Card */}
        <ClaimEnrolleeCard
          principal={claim.principal}
          beneficiary={claim.beneficiary}
          enrollee_id={claim.enrollee_id}
          utilization={claim.enrollee_utilization}
          approvalCode={claim.approval_codes?.[0]?.approval_code || claim.claim_number}
          encounterCode={claim.encounter_code}
          isPrimaryHospital={claim.is_primary_hospital}
        />

        {/* Price Summary and Editor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PriceSummary
            originalAmount={Number(claim.original_amount || claim.amount)}
            currentAmount={liveTotal || Number(claim.amount)}
            approvedAmount={claim.approved_amount ? Number(claim.approved_amount) : undefined}
            claimId={claimId}
          />
          <PriceEditor
            claimId={claimId}
            currentAmount={Number(claim.amount)}
            originalAmount={Number(claim.original_amount || claim.amount)}
            onSave={() => {
              queryClient.invalidateQueries({ queryKey: ["claim-details", claimId] })
              queryClient.invalidateQueries({ queryKey: ["executive-approval-claims"] })
              queryClient.invalidateQueries({ queryKey: ["approval-provider-claims"] })
            }}
            canEdit={canEditPrice}
            stage={stage}
          />
        </div>

        {/* Services & Drugs Separation */}
        <div className="space-y-10">
          <ServiceVettingTable
            title="Medications / Drug Items"
            colorScheme="purple"
            services={claimedServices.filter(s => isDrugItem(s.category, s.service_name))}
            onUpdateService={handleUpdateService}
            onDeleteService={handleDeleteService}
            canEditPrice={canEditPrice}
            currentUserName={session?.user?.name || session?.user?.email || ""}
          />

          <ServiceVettingTable
            title="General Services & Procedures"
            colorScheme="blue"
            services={claimedServices.filter(s => !isDrugItem(s.category, s.service_name))}
            onUpdateService={handleUpdateService}
            onDeleteService={handleDeleteService}
            canEditPrice={canEditPrice}
            currentUserName={session?.user?.name || session?.user?.email || ""}
          />

          <Card className="border-indigo-200 bg-indigo-50/40">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-indigo-800">Subtotal (Services + Drugs)</span>
                <span className="text-xl font-black text-indigo-700">₦{liveTotal.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Approval Comments */}
        <Card>
          <CardHeader>
            <CardTitle>MD Approval Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add your remarks, red flags or clarifications..."
              value={vettingComments}
              onChange={(e) => setVettingComments(e.target.value)}
              className="min-h-[120px]"
            />
          </CardContent>
        </Card>

        {/* Rejection Reason (if showing reject dialog) */}
        {showRejectDialog && (
          <Card>
            <CardHeader>
              <CardTitle>Rejection Reason (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Please provide a reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>
        )}

        {/* Supporting Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Supporting Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((att, idx) => (
                  <div key={att.id || idx} className="flex items-center gap-3 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg">
                    <Paperclip className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <button onClick={() => setFileViewer({ url: att.url, name: att.name })} className="text-sm font-medium text-blue-700 hover:underline truncate block text-left w-full">
                        {att.name}
                      </button>
                      <p className="text-[10px] text-gray-400">
                        {(att.size / 1024).toFixed(0)} KB · Stage: {att.stage} · By {att.uploaded_by || "Unknown"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No supporting documents attached.</p>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Final Action</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <VettingActionButtons
                claimId={claimId}
                stage={stage}
                canTakeAction={canTakeAction}
                currentClaimStage={claim?.current_stage}
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={approveMutation.isPending || rejectMutation.isPending}
                approvalCode={claim?.approval_codes?.[0]?.approval_code || claim?.claim_number}
              />
              {showRejectDialog && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setShowRejectDialog(false)
                      setRejectionReason("")
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={rejectMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showTimelineModal} onOpenChange={setShowTimelineModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Claim Audit Trail</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <AuditTrailView approvalCode={claim?.approval_codes?.[0]?.approval_code || claim?.claim_number} />
          </div>
        </DialogContent>
      </Dialog>

      {fileViewer && (
        <FileViewerModal
          url={fileViewer.url}
          name={fileViewer.name}
          isOpen={!!fileViewer}
          onClose={() => setFileViewer(null)}
        />
      )}
    </PermissionGate>
  )
}
