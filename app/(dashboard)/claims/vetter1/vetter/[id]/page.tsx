"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft,
  FileText,
  User,
  Building,
  Calendar,
  CreditCard,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Plus,
  Trash2,
  Stethoscope,
  History,
  Clock,
  Info,
  Paperclip,
  Upload,
  X as XIcon
} from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { ApprovalCodeTimeline } from "@/components/approval-code-timeline"
import { PermissionGate } from "@/components/ui/permission-gate"
import { VettingProgressTracker } from "@/components/claims/VettingProgressTracker"
import { PriceSummary } from "@/components/claims/PriceSummary"
import { PriceEditor } from "@/components/claims/PriceEditor"
import { AutoSaveIndicator }
  from "@/components/claims/AutoSaveIndicator"
import { VettingActionButtons } from "@/components/claims/VettingActionButtons"
import { useAutoSave } from "@/hooks/useAutoSave"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { useSession } from "next-auth/react"
import { ClaimEnrolleeCard } from "@/components/claims/ClaimEnrolleeCard"
import { ServiceVettingTable, ServiceItem, isDrugItem } from "@/components/claims/ServiceVettingTable"
import { Badge } from "@/components/ui/badge"
import { FileViewerModal } from "@/components/ui/file-viewer-modal"


interface Claim {
  id: string
  claim_number: string
  enrollee_id: string
  principal_id?: string
  beneficiary?: {
    id: string
    dependent_id: string
    first_name: string
    last_name: string
    relationship?: string
  }
  principal?: {
    id: string
    first_name: string
    last_name: string
    enrollee_id: string
    gender?: string
    age?: number
    account_type?: string
    start_date?: string | Date
    end_date?: string | Date
    organization?: {
      name: string
    }
    plan?: {
      name: string
      plan_type: string
      annual_limit: number
    }
    approval_codes?: Array<{
      service_items: any[]
    }>
  }
  enrollee_utilization?: {
    amount_utilized: number
    balance: number
  }
  enrollee_band?: string
  encounter_code?: string
  encounter?: {
    diagnosis: string
    clinical_encounter?: string
    services: string
    created_at: string
  }
  provider_id: string
  provider: {
    id: string
    facility_name: string
  }
  claim_type: string
  amount: number
  original_amount: number
  approved_amount?: number
  status: string
  current_stage?: string
  submitted_at: string
  approval_codes?: Array<{
    approval_code: string
    service_items: any[]
  }>
  is_primary_hospital?: boolean
  rejection_reason?: string
}

export default function Vetter1Page() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  const claimId = params.id as string
  const returnTo = searchParams.get("returnTo")
  const stage: 'vetter1' | 'vetter2' | 'audit' | 'approval' = 'vetter1'

  const navigateBack = () => {
    if (returnTo) {
      router.push(returnTo)
    } else {
      router.push('/claims/vetter1')
    }
  }

  // State
  const [vettingComments, setVettingComments] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [claimedServices, setClaimedServices] = useState<ServiceItem[]>([])
  const [showEncountersModal, setShowEncountersModal] = useState(false)
  const [showTimelineModal, setShowTimelineModal] = useState(false)

  // Service Rejection State
  const [serviceToRemove, setServiceToRemove] = useState<string | null>(null)
  const [specificRejectionReason, setSpecificRejectionReason] = useState("")
  const [showServiceRejectionModal, setShowServiceRejectionModal] = useState(false)

  // Attachment state
  const [attachments, setAttachments] = useState<Array<{ id?: string; name: string; url: string; type: string; size: number; stage: string; uploaded_by?: string; uploaded_at?: string }>>([])
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [fileViewer, setFileViewer] = useState<{ url: string; name: string } | null>(null)

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

  // Fetch previous vetting actions to recover who modified each service at a prior stage
  const { data: vettingActionsData } = useQuery({
    queryKey: ["vetting-actions", claimId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/vetting-actions`)
      if (!res.ok) return { actions: [] }
      return res.json()
    },
    enabled: !!claim
  })

  // Fetch comprehensive enrollee medical history
  const { data: enrolleeHistoryData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["enrollee-history", claim?.beneficiary?.id || claim?.principal?.id],
    queryFn: async () => {
      const id = claim?.beneficiary?.id || claim?.principal?.id
      if (!id) return null
      const res = await fetch(`/api/enrollees/${id}/history`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!claim
  })

  // Fetch existing attachments for this claim
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

  // Parse services from claim data (Approval codes have priority)
  useEffect(() => {
    // Build modified_by_name lookup from all previous stage actions (useful on rejection-back)
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
          verdict: (service.is_vetted_approved ? 'COVERED' : 'NOT_COVERED') as any,
          price_verdict: 'MATCH' as const,
          category: service.category || 'SERVICE',
          is_deleted: service.is_deleted || false,
          rejection_reason: service.rejection_reason || undefined,
          is_ad_hoc: service.is_ad_hoc || false,
          modified_by_name: prevModifiedByMap[service.id]
        }
      })
      setClaimedServices(parsedFromApprovals)
      return
    }

    // Fallback to provider request if no approval codes
    const requestItems = providerRequestData?.providerRequest?.request_items
    if (Array.isArray(requestItems) && requestItems.length > 0) {
      const parsedFromItems = requestItems.map((service: any, index: number) => {
        const qty = service.quantity || 1
        const lineTotal = Number(service.service_amount) * qty
        return {
          id: service.id || index.toString(),
          service_name: service.service_name || 'Unknown Service',
          claimed_amount: lineTotal,
          tariff_amount: Number(service.tariff_price || service.service_amount) * qty,
          vetted_amount: lineTotal,
          quantity: qty,
          unit_price: Number(service.service_amount),
          verdict: 'COVERED' as const,
          price_verdict: 'MATCH' as const,
          category: service.category || 'SERVICE',
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
        console.error('Failed to load draft:', error)
      }
    }
    loadDraft()
  }, [claimId, stage])

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/vetter1/approve`, {
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
      toast.success("Claim approved and moved to Vetter 2")
      clearDraft()
      navigateBack()
      queryClient.invalidateQueries({ queryKey: ["claim-details"] })
      queryClient.invalidateQueries({ queryKey: ["vetter1-claims"] })
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve claim")
    }
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/vetter1/reject`, {
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
      toast.success("Claim rejected and returned to provider")
      clearDraft()
      navigateBack()
      queryClient.invalidateQueries({ queryKey: ["claim-details"] })
      queryClient.invalidateQueries({ queryKey: ["vetter1-claims"] })
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject claim")
    }
  })

  // Handlers
  const handleUpdateService = (id: string, updates: Partial<ServiceItem>) => {
    setClaimedServices(prev =>
      prev.map(service =>
        service.id === id ? { ...service, ...updates } : service
      )
    )
  }

  const handleDeleteService = (id: string) => {
    setServiceToRemove(id)
    setSpecificRejectionReason("")
    setShowServiceRejectionModal(true)
  }

  const confirmServiceRemoval = () => {
    if (!serviceToRemove || !specificRejectionReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }

    setClaimedServices(prev =>
      prev.map(service =>
        service.id === serviceToRemove
          ? {
            ...service,
            is_deleted: true,
            verdict: 'REJECTED' as any,
            rejection_reason: specificRejectionReason
          }
          : service
      )
    )

    setShowServiceRejectionModal(false)
    setServiceToRemove(null)
    setSpecificRejectionReason("")
    toast.success("Service marked as rejected")
  }

  const handleApprove = () => {
    approveMutation.mutate()
  }

  const handleReject = () => {
    rejectMutation.mutate()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1 * 1024 * 1024) {
      toast.error("File must be smaller than 1 MB")
      return
    }
    setIsUploadingFile(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("stage", "vetter1")
      const res = await fetch(`/api/claims/${claimId}/attachments`, { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Upload failed")
      }
      const data = await res.json()
      setAttachments(prev => [...prev, data.attachment])
      toast.success(`${file.name} uploaded successfully`)
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file")
    } finally {
      setIsUploadingFile(false)
      // Reset input
      e.target.value = ""
    }
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
          <Button onClick={navigateBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vetter 1
          </Button>
        </div>
      </div>
    )
  }

  const completedStages: any[] = []
  if (claim.current_stage !== 'vetter1') completedStages.push('vetter1')

  const currentStage = (claim.current_stage || 'vetter1') as any
  const canEditPrice = ['ADMIN', 'SUPER_ADMIN', 'CLAIMS_PROCESSOR'].includes(session?.user?.role as string)

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
  const clinicalDiagnosis = claim.encounter?.diagnosis?.trim() || providerRequestData?.providerRequest?.diagnosis?.trim() || "No diagnosis recorded"
  const clinicalFindings = claim.encounter?.clinical_encounter?.trim() || "No clinical findings captured"

  // Find the action that sent the claim to this stage (last action)
  const lastAction = vettingActionsData?.actions?.slice()?.reverse()?.[0]
  const isRejectedBack = lastAction?.action === 'REJECTED_BACK'

  return (
    <PermissionGate module="claims" action="view" actions={["view", "vet"]}>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={navigateBack} className="rounded-full shadow-sm hover:shadow-md transition-all">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-[#BE1522] hover:bg-[#9B1219]">STAGER 1</Badge>
                <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">Claims Vetting Desk</p>
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
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Reviewing {claim.claim_number}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AutoSaveIndicator
              isSaving={isSaving}
              lastSaved={lastSaved}
              hasUnsavedChanges={hasUnsavedChanges}
            />
            <Button variant="outline" size="sm" onClick={() => setShowEncountersModal(true)} className="gap-2 border-gray-200 hover:bg-blue-50 font-bold">
              <History className="h-4 w-4 text-blue-600" />
              VIEW HISTORY
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTimelineModal(true)} className="gap-2 border-gray-200 hover:bg-purple-50 font-bold">
              <Clock className="h-4 w-4 text-purple-600" />
              VIEW AUDIT TRAIL
            </Button>
          </div>
        </div>

        {/* Progress Tracker */}
        <VettingProgressTracker
          currentStage={currentStage}
          completedStages={completedStages}
        />

        {/* Rejection Reason Banner (shown when claim was rejected back to this stage) */}
        {claim.rejection_reason && isRejectedBack && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">
                Rejected back from {lastAction?.stage?.toUpperCase()} — Reason:
              </p>
              <p className="text-sm text-red-700 mt-1">{claim.rejection_reason}</p>
            </div>
          </div>
        )}

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-blue-200 shadow-sm overflow-hidden">
            <CardHeader className="py-3 bg-blue-50/60 border-b">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-blue-700">
                <Stethoscope className="h-4 w-4" />
                Clinical Diagnosis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-sm font-semibold text-gray-800 whitespace-pre-wrap">
                {clinicalDiagnosis}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 shadow-sm overflow-hidden">
            <CardHeader className="py-3 bg-purple-50/60 border-b">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-purple-700">
                <Info className="h-4 w-4" />
                Clinical Findings
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 text-sm font-semibold text-gray-800 whitespace-pre-wrap">
                {clinicalFindings}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Summary and Tool */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PriceSummary
              originalAmount={claim.original_amount != null ? Number(claim.original_amount) : Number(claim.amount)}
              currentAmount={liveTotal || Number(claim.amount)}
              approvedAmount={claim.approved_amount ? Number(claim.approved_amount) : undefined}
              claimId={claimId}
            />
          </div>
          <div>
            <PriceEditor
              claimId={claimId}
              currentAmount={Number(claim.amount)}
              originalAmount={claim.original_amount != null ? Number(claim.original_amount) : Number(claim.amount)}
              onSave={() => {
                queryClient.invalidateQueries({ queryKey: ["claim-details", claimId] })
                queryClient.invalidateQueries({ queryKey: ["vetter1-claims"] })
              }}
              canEdit={canEditPrice}
              stage={stage}
            />
          </div>
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
            currentUserName={session?.user?.name || session?.user?.email || ''}
          />

          <ServiceVettingTable
            title="General Services & Procedures"
            colorScheme="blue"
            services={claimedServices.filter(s => !isDrugItem(s.category, s.service_name))}
            onUpdateService={handleUpdateService}
            onDeleteService={handleDeleteService}
            canEditPrice={canEditPrice}
            currentUserName={session?.user?.name || session?.user?.email || ''}
          />

          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-800">Subtotal (Services + Drugs)</span>
                <span className="text-xl font-black text-blue-700">₦{liveTotal.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vetting Comments */}
        <Card className="border-gray-200 shadow-sm overflow-hidden">
          <CardHeader className="py-3 bg-gray-50 border-b">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-gray-500">
              <FileText className="h-4 w-4" />
              Clinical Remarks & Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Textarea
              placeholder="Add your remarks, red flags or clarifications..."
              value={vettingComments}
              onChange={(e) => setVettingComments(e.target.value)}
              className="min-h-[140px] bg-white border-gray-200 focus:ring-red-700 focus:border-red-700 transition-all text-sm font-medium leading-relaxed"
            />
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card className="border-gray-200 shadow-sm overflow-hidden">
          <CardHeader className="py-3 bg-gray-50 border-b">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-gray-500">
              <Paperclip className="h-4 w-4" />
              Supporting Documents
              <span className="text-gray-400 font-normal normal-case tracking-normal text-[11px]">(Max 1 MB per file)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((att, idx) => (
                  <div key={att.id || idx} className="flex items-center gap-3 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg">
                    <Paperclip className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <button onClick={() => setFileViewer({ url: att.url, name: att.name })} className="text-sm font-medium text-blue-700 hover:underline truncate block text-left w-full">
                        {att.name}
                      </button>
                      <p className="text-[10px] text-gray-400">
                        {(att.size / 1024).toFixed(0)} KB · Stage: {att.stage} · By {att.uploaded_by}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all ${isUploadingFile ? "opacity-60 cursor-not-allowed border-gray-200" : "border-blue-200 hover:border-blue-400 hover:bg-blue-50/30"}`}>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={handleFileUpload}
                disabled={isUploadingFile}
              />
              <Upload className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-600 font-medium">
                {isUploadingFile ? "Uploading..." : "Click to attach a file"}
              </span>
              <span className="text-xs text-gray-400">PDF, images, Word docs · max 1 MB</span>
            </label>
          </CardContent>
        </Card>

        {/* Action Section */}
        <Card className="border-2 border-blue-600 bg-[#BE1522] text-white shadow-xl">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="font-black text-xl">Confirm Review Results</h4>
                <p className="text-blue-100 text-sm font-medium">Ensure all flags have been addressed before moving to Stage 2</p>
              </div>
              <div className="w-full md:w-auto">
                <VettingActionButtons
                  claimId={claimId}
                  stage={stage}
                  canTakeAction={canTakeAction}
                  currentClaimStage={claim?.current_stage}
                  onApprove={handleApprove}
                  onReject={() => setShowRejectDialog(true)}
                  isLoading={approveMutation.isPending || rejectMutation.isPending}
                  approvalCode={claim?.approval_codes?.[0]?.approval_code}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modals */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader className="gap-2">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-xl font-bold">Reject Entire Claim?</DialogTitle>
              <DialogDescription>
                This will reject the entire claim and return it to the provider.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-bold mb-2 block">Reason for Rejection (optional)</label>
              <Textarea
                placeholder="State reason here..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showServiceRejectionModal} onOpenChange={setShowServiceRejectionModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <Trash2 className="h-5 w-5" />
                Reject Service Item
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <label className="text-xs font-black uppercase text-gray-500 mb-2 block">Reason *</label>
              <Textarea
                placeholder="Why is this item being rejected?"
                value={specificRejectionReason}
                onChange={(e) => setSpecificRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowServiceRejectionModal(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmServiceRemoval} disabled={!specificRejectionReason.trim()}>
                Reject Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Encounter Modal */}
        <Dialog open={showEncountersModal} onOpenChange={setShowEncountersModal}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-0 border-none shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b p-6">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mb-2 border-blue-200 text-blue-700 bg-blue-50 font-bold">HISTORICAL RECORD</Badge>
                    <DialogTitle className="text-2xl font-black text-gray-900">Encounter Insight</DialogTitle>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Encounter Date</p>
                    <p className="text-lg font-bold text-gray-700">
                      {claim.encounter?.created_at ? new Date(claim.encounter.created_at).toLocaleDateString('en-GB') : 'N/A'}
                    </p>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="p-8 space-y-8 bg-gray-50/30">
              {/* Diagnosis Section */}
              <div className="bg-white rounded-2xl p-6 border shadow-sm">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Clinical Diagnosis
                </h4>
                <div className="text-lg font-bold text-gray-800 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                  {claim.encounter?.diagnosis || "No diagnosis recorded"}
                </div>
              </div>

              {/* Historical Records Table - REDESIGNED */}
              <div className="bg-white rounded-2xl overflow-hidden border shadow-sm">
                <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-gray-800 uppercase tracking-widest">Medical History & Previous Encounters</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Unified clinical timeline for this enrollee</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">
                    {enrolleeHistoryData?.history?.length || 0} Records Found
                  </Badge>
                </div>
                {enrolleeHistoryData?.history && enrolleeHistoryData.history.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50/50">
                        <TableRow>
                          <TableHead className="pl-6 font-bold text-gray-500 text-[10px] uppercase">Date</TableHead>
                          <TableHead className="font-bold text-gray-500 text-[10px] uppercase">Hospital</TableHead>
                          <TableHead className="font-bold text-gray-500 text-[10px] uppercase">Type</TableHead>
                          <TableHead className="font-bold text-gray-500 text-[10px] uppercase">Diagnosis</TableHead>
                          <TableHead className="font-bold text-gray-500 text-[10px] uppercase">Services</TableHead>
                          <TableHead className="font-bold text-gray-500 text-[10px] uppercase">Drugs</TableHead>
                          <TableHead className="text-right font-bold text-gray-500 text-[10px] uppercase">Amount</TableHead>
                          <TableHead className="text-center font-bold text-gray-500 text-[10px] uppercase">Status</TableHead>
                          <TableHead className="pr-6 font-bold text-gray-500 text-[10px] uppercase">Code</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrolleeHistoryData.history.map((item: any) => (
                          <TableRow key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <TableCell className="pl-6 py-4">
                              <p className="text-[11px] font-black text-gray-900">{new Date(item.date).toLocaleDateString('en-GB')}</p>
                              <p className="text-[9px] text-gray-400 font-bold uppercase">{item.record_type}</p>
                            </TableCell>
                            <TableCell className="max-w-[150px]">
                              <p className="text-[11px] font-bold text-gray-800 truncate">{item.hospital}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px] font-bold uppercase px-1.5 py-0 border-blue-100 text-blue-600 bg-blue-50/30">
                                {item.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[150px]">
                              <p className="text-[11px] font-medium text-gray-600 line-clamp-2">{item.diagnosis}</p>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="text-[10px] text-blue-700 font-medium line-clamp-2">{item.services || "—"}</p>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="text-[10px] text-purple-700 font-medium line-clamp-2">{item.drugs || "—"}</p>
                            </TableCell>
                            <TableCell className="text-right">
                              <p className="text-[11px] font-black text-gray-900">₦{Number(item.amount).toLocaleString()}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={`text-[9px] font-bold uppercase border-none ${item.status === 'PAID' || item.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                                  item.status === 'REJECTED' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                                  }`}
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-6">
                              <p className="text-[10px] font-mono font-bold text-gray-400">{item.auth_code}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <History className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No historical records found for this enrollee</p>
                  </div>
                )}
              </div>

              {/* Provider Request Summary */}
              <div className="bg-white rounded-2xl p-6 border shadow-sm">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Clinical Findings</h4>
                <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border italic leading-relaxed">
                  {claim.encounter?.clinical_encounter ? (
                    claim.encounter.clinical_encounter
                  ) : claim.encounter?.services ? (
                    (() => {
                      try {
                        const parsed = JSON.parse(claim.encounter.services);
                        if (Array.isArray(parsed)) return parsed.map((s: any) => s.name || s.service_name).join(", ");
                        return claim.encounter.services;
                      } catch {
                        return claim.encounter.services;
                      }
                    })()
                  ) : "No clinical findings captured"}
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t flex justify-end">
              <Button onClick={() => setShowEncountersModal(false)} className="rounded-full px-8 font-bold">CLOSE VIEW</Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Timeline Modal */}
        <Dialog open={showTimelineModal} onOpenChange={setShowTimelineModal}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Claim Audit Trail</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <ApprovalCodeTimeline approvalCode={claim.approval_codes?.[0]?.approval_code || claim.claim_number} />
            </div>
          </DialogContent>
        </Dialog>

      </div>

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
