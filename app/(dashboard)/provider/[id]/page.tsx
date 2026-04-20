"use client"

export const dynamic = 'force-dynamic'

import { Component, ReactNode, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  Edit,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  User,
  Send,
  Upload,
  Download
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BandSelector } from "@/components/ui/band-selector"
import { TariffPlanTabV2 as TariffPlanTab } from "@/components/provider/tariff-plan-tab-v2"



interface Provider {
  id: string
  // Section 1: Basic Information
  partnership_interest?: string
  facility_name: string
  address: string
  phone_whatsapp: string
  email: string
  medical_director_name: string
  hmo_coordinator_name: string
  hmo_coordinator_phone: string
  hmo_coordinator_email: string
  year_of_incorporation: string
  facility_reg_number: string
  practice: string
  proprietor_partners: string
  hcp_code?: string

  // Section 2: Service Delivery
  hours_of_operation?: string
  other_branches?: string
  emergency_care_services?: string[]
  facility_type?: string[]
  personnel_licensed?: string
  blood_bank_available?: string
  blood_sourcing_method?: string
  radiology_lab_services?: string[]
  other_services?: string[]

  // Section 3: Banking Information
  account_name?: string
  account_number?: string
  designation?: string
  date?: string

  // Document URLs
  cac_registration_url?: string
  nhis_accreditation_url?: string
  professional_indemnity_url?: string
  state_facility_registration_url?: string

  // Band selection
  selected_bands?: string[]

  status: string
  created_at: string
  updated_at: string
  claims: Array<{
    id: string
    claim_number: string
    amount: number
    status: string
    submitted_at: string
    principal?: {
      id: string
      enrollee_id: string
      first_name: string
      last_name: string
    }
  }>
  in_patients: Array<{
    id: string
    patient_id: string
    admission_date: string
    discharge_date?: string
    diagnosis?: string
    treatment?: string
    status: string
  }>
  risk_profiles: Array<{
    id: string
    risk_score: number
    risk_level: string
    assessment_date: string
    factors?: any
    recommendations?: string
  }>
  _count?: {
    claims: number
    in_patients: number
    risk_profiles: number
  }
}

class TariffTabErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error("Tariff tab render error:", error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Tariff Plan</CardTitle>
            <CardDescription>Unable to load tariff plan data for this provider.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600">
              The tariff tab hit a display error. Refresh the page and try again.
            </p>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

export default function ProviderViewPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { id } = params

  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve")
  const [approvalComments, setApprovalComments] = useState("")
  const [selectedBands, setSelectedBands] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("overview")

  // Tariff file upload state
  const [uploadingTariff, setUploadingTariff] = useState(false)
  const fileInputRef = useState<HTMLInputElement | null>(null)[0]

  // Fetch provider data
  const {
    data: providerData,
    isLoading,
    error
  } = useQuery({
    queryKey: ["provider", id],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${id}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider")
      }
      const data = await res.json()
      return data.provider as Provider
    },
  })

  const provider = providerData
  const {
    data: updatesData,
    isLoading: updatesLoading
  } = useQuery({
    queryKey: ["provider-updates", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/providers/${id}/updates`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider updates")
      }
      return res.json()
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ updateId, status }: { updateId: string; status: "PENDING" | "APPROVED" }) => {
      const res = await fetch(`/api/providers/${id}/updates/${updateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update provider update status")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-updates", id] })
      toast({
        title: "Update status refreshed",
      })
    },
  })

  const updates = updatesData?.updates || []
  const pendingUpdates = updates.filter((update: { status: string }) => update.status === "PENDING")
  const approvedUpdates = updates.filter((update: { status: string }) => update.status === "APPROVED")


  // Approval mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ action, comments, assigned_bands }: { action: string, comments: string, assigned_bands?: string[] }) => {
      const res = await fetch(`/api/providers/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, comments, assigned_bands }),
      })
      if (!res.ok) {
        throw new Error("Failed to process approval")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      })
      setShowApprovalModal(false)
      setApprovalComments("")
      setSelectedBands([])
      queryClient.invalidateQueries({ queryKey: ["provider", id] })
      queryClient.invalidateQueries({ queryKey: ["providers"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Handle approval actions
  const handleApprovalAction = (action: "approve" | "reject") => {
    setApprovalAction(action)
    setApprovalComments("")
    setSelectedBands([])
    setShowApprovalModal(true)
  }

  const handleSubmitApproval = () => {
    // Validate that bands are selected for approval
    if (approvalAction === "approve" && selectedBands.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one band for approval",
        variant: "destructive",
      })
      return
    }

    approvalMutation.mutate({
      action: approvalAction,
      comments: approvalComments,
      assigned_bands: approvalAction === "approve" ? selectedBands : undefined
    })
  }

  // Fetch tariff file status
  const { data: tariffFileData, refetch: refetchTariffFile } = useQuery({
    queryKey: ["tariff-file", id],
    queryFn: async () => {
      const res = await fetch(`/api/provider/download-tariff-file/${id}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error("Failed to check tariff file")
      return { exists: true }
    },
    enabled: !!id
  })

  // Upload tariff file mutation
  const uploadTariffMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('providerId', id)

      const res = await fetch('/api/provider/upload-tariff-file', {
        method: 'POST',
        body: formData
      })

      const contentType = res.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')
      const payload = isJson ? await res.json() : null

      if (!res.ok) {
        throw new Error(payload?.error || payload?.message || `Upload failed (${res.status})`)
      }

      return payload
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tariff file uploaded successfully"
      })
      refetchTariffFile()
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  // Handle tariff file upload
  const handleTariffFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive"
      })
      return
    }

    uploadTariffMutation.mutate(file)
  }

  // Handle tariff file download
  const handleTariffFileDownload = () => {
    window.location.href = `/api/provider/download-tariff-file/${id}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    console.error('Provider fetch error:', error)
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load provider: {error.message}</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Provider not found</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'

    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'suspended':
        return 'bg-red-100 text-red-800'
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get facility type badge color based on facility_type array
  const getFacilityTypeBadgeColor = (facilityTypes: string[] | null | undefined = []) => {
    if (!facilityTypes || !Array.isArray(facilityTypes)) return 'bg-gray-100 text-gray-800'
    if (facilityTypes.includes('HOSPITAL')) {
      return 'bg-blue-100 text-blue-800'
    } else if (facilityTypes.includes('PRIMARY_CARE')) {
      return 'bg-green-100 text-green-800'
    } else if (facilityTypes.includes('SECONDARY_CARE')) {
      return 'bg-purple-100 text-purple-800'
    } else if (facilityTypes.includes('PHARMACEUTICAL')) {
      return 'bg-orange-100 text-orange-800'
    } else if (facilityTypes.includes('OPTICAL')) {
      return 'bg-pink-100 text-pink-800'
    } else if (facilityTypes.includes('DENTAL')) {
      return 'bg-indigo-100 text-indigo-800'
    } else if (facilityTypes.includes('DIAGNOSTICS')) {
      return 'bg-teal-100 text-teal-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  // Get facility type display text
  const getFacilityTypeText = (facilityTypes: string[] | null | undefined = []) => {
    if (!facilityTypes || !Array.isArray(facilityTypes) || facilityTypes.length === 0) return 'Unknown'
    return facilityTypes.join(', ').replace(/_/g, ' ')
  }

  // Get risk level badge color
  const getRiskLevelBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'critical':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{provider.facility_name}</h1>
              <p className="text-gray-600">Provider Details</p>
            </div>
          </div>
          <div className="flex gap-4">
            <PermissionGate module="provider" action="edit">
              <Button onClick={() => router.push(`/provider/edit/${provider.id}`)} className="bg-[#BE1522] hover:bg-[#9B1219]">
                <Edit className="h-4 w-4 mr-2" />
                Edit Provider
              </Button>
            </PermissionGate>

            {/* Approval buttons for pending providers */}
            {provider.status === "PENDING_APPROVAL" && (
              <>
                <PermissionGate module="provider" action="approve">
                  <Button
                    onClick={() => handleApprovalAction("approve")}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Provider
                  </Button>
                </PermissionGate>
                <PermissionGate module="provider" action="approve">
                  <Button
                    onClick={() => handleApprovalAction("reject")}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Provider
                  </Button>
                </PermissionGate>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Pending HCP Updates
                </CardTitle>
                <CardDescription>
                  Updates pushed from the mobile app that still require approval
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {updatesLoading && !pendingUpdates.length ? (
                  <p className="text-sm text-gray-500">Loading updates...</p>
                ) : pendingUpdates.length === 0 ? (
                  <p className="text-sm text-gray-500">No pending HCP updates</p>
                ) : (
                  pendingUpdates.map((update: any) => (
                    <div key={update.id} className="rounded-lg border border-dashed border-amber-200 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{update.source || "Mobile"} Update</p>
                        <Badge className="text-xs uppercase bg-yellow-100 text-yellow-800">{update.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(update.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600">
                        {JSON.stringify(update.payload).slice(0, 160)}
                        {JSON.stringify(update.payload).length > 160 ? "…" : ""}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full"
                        onClick={() => updateStatusMutation.mutate({ updateId: update.id, status: "APPROVED" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve Update
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Approved HCP Updates
                </CardTitle>
                <CardDescription>
                  Updates already confirmed for this provider
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {approvedUpdates.length === 0 ? (
                  <p className="text-sm text-gray-500">No approved updates yet</p>
                ) : (
                  approvedUpdates.map((update: any) => (
                    <div key={update.id} className="rounded-lg border border-dashed border-green-200 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{update.source || "Mobile"} Update</p>
                        <Badge className="text-xs uppercase bg-green-100 text-green-800">{update.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(update.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600">
                        {JSON.stringify(update.payload).slice(0, 160)}
                        {JSON.stringify(update.payload).length > 160 ? "…" : ""}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Provider Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Facility Name</p>
                  <p className="text-lg font-semibold">{provider.facility_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <Badge className={getStatusBadgeColor(provider.status)}>
                    {provider.status ? provider.status.replace('_', ' ') : 'Unknown'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Facility Type</p>
                  <Badge className={getFacilityTypeBadgeColor(provider.facility_type)}>
                    {getFacilityTypeText(provider.facility_type)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <span className="text-2xl font-bold text-orange-600">₦</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Claims</p>
                  <p className="text-lg font-semibold">{provider._count?.claims || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider Details Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="claims">Claims</TabsTrigger>
            <TabsTrigger value="inpatients">In-patients</TabsTrigger>
            <TabsTrigger value="risk-profile">Tariff Plan</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Provider Registration Timeline */}
            <div className="space-y-6">
              {/* Section 1: Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Section 1: Basic Information
                  </CardTitle>
                  <CardDescription>Core facility and partnership details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Partnership Interest</label>
                      <p className="text-lg">{provider.partnership_interest || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Facility Name</label>
                      <p className="text-lg font-semibold">{provider.facility_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Medical Director</label>
                      <p className="text-lg">{provider.medical_director_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Year of Incorporation</label>
                      <p className="text-lg">{provider.year_of_incorporation || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Facility Registration Number</label>
                      <p className="text-lg">{provider.facility_reg_number || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Practice</label>
                      <p className="text-lg">{provider.practice || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Proprietor/Partners</label>
                      <p className="text-lg">{provider.proprietor_partners || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">HCP Code</label>
                      <p className="text-lg">{provider.hcp_code || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Registration Date</label>
                      <p className="text-lg">{new Date(provider.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Band Information */}
              {provider.selected_bands && provider.selected_bands.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge className="h-5 w-5 text-blue-600" />
                      Selected Bands
                    </CardTitle>
                    <CardDescription>Provider's assigned tariff bands</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {provider.selected_bands.map((band) => (
                        <Badge key={band} variant="secondary" className="text-sm">
                          {band}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    Contact Information
                  </CardTitle>
                  <CardDescription>Primary contact details and location</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone/WhatsApp</label>
                      <p className="text-lg">{provider.phone_whatsapp || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-lg">{provider.email || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Address</label>
                      <p className="text-lg">{provider.address || "---"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* HMO Coordinator Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    HMO Coordinator Details
                  </CardTitle>
                  <CardDescription>Designated HMO liaison officer information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Coordinator Name</label>
                      <p className="text-lg">{provider.hmo_coordinator_name || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone</label>
                      <p className="text-lg">{provider.hmo_coordinator_phone || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-lg">{provider.hmo_coordinator_email || "---"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Service Delivery */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Section 2: Service Delivery
                  </CardTitle>
                  <CardDescription>Operational details and service capabilities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Hours of Operation</label>
                      <p className="text-lg">{provider.hours_of_operation || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Other Branches</label>
                      <p className="text-lg">{provider.other_branches || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Personnel Licensed</label>
                      <p className="text-lg">{provider.personnel_licensed || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Blood Bank Available</label>
                      <p className="text-lg">{provider.blood_bank_available || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Blood Sourcing Method</label>
                      <p className="text-lg">{provider.blood_sourcing_method || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Facility Type</label>
                      <div className="flex flex-wrap gap-2">
                        {provider.facility_type && Array.isArray(provider.facility_type) ? (
                          provider.facility_type.map((type: string, index: number) => (
                            <Badge key={index} className={getFacilityTypeBadgeColor([type])}>
                              {type.replace(/_/g, ' ')}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-lg">---</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Emergency Care Services</label>
                      <div className="flex flex-wrap gap-2">
                        {provider.emergency_care_services && Array.isArray(provider.emergency_care_services) ? (
                          provider.emergency_care_services.map((service: string, index: number) => (
                            <Badge key={index} variant="outline">
                              {service}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-lg">---</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Radiology/Lab Services</label>
                      <div className="flex flex-wrap gap-2">
                        {provider.radiology_lab_services && Array.isArray(provider.radiology_lab_services) ? (
                          provider.radiology_lab_services.map((service: string, index: number) => (
                            <Badge key={index} variant="outline">
                              {service}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-lg">---</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Other Services</label>
                      <div className="flex flex-wrap gap-2">
                        {provider.other_services && Array.isArray(provider.other_services) ? (
                          provider.other_services.map((service: string, index: number) => (
                            <Badge key={index} variant="outline">
                              {service}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-lg">---</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: Banking Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-blue-600">₦</span>
                    Section 3: Banking Information
                  </CardTitle>
                  <CardDescription>Financial account and payment details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Account Name</label>
                      <p className="text-lg">{provider.account_name || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Account Number</label>
                      <p className="text-lg">{provider.account_number || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Designation</label>
                      <p className="text-lg">{provider.designation || "---"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date</label>
                      <p className="text-lg">{provider.date ? new Date(provider.date).toLocaleDateString() : "---"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Documents Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Documents & Certifications
                  </CardTitle>
                  <CardDescription>Required documentation and compliance certificates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">CAC Registration</label>
                      <div className="mt-2">
                        {provider.cac_registration_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(provider.cac_registration_url, '_blank')}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Document
                          </Button>
                        ) : (
                          <span className="text-lg text-gray-400">Not uploaded</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">NHIS Accreditation</label>
                      <div className="mt-2">
                        {provider.nhis_accreditation_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(provider.nhis_accreditation_url, '_blank')}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Document
                          </Button>
                        ) : (
                          <span className="text-lg text-gray-400">Not uploaded</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Professional Indemnity</label>
                      <div className="mt-2">
                        {provider.professional_indemnity_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(provider.professional_indemnity_url, '_blank')}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Document
                          </Button>
                        ) : (
                          <span className="text-lg text-gray-400">Not uploaded</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">State Facility Registration</label>
                      <div className="mt-2">
                        {provider.state_facility_registration_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(provider.state_facility_registration_url, '_blank')}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Document
                          </Button>
                        ) : (
                          <span className="text-lg text-gray-400">Not uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tariff Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Tariff Management
                  </CardTitle>
                  <CardDescription>Upload and manage provider tariff price list</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Tariff Price List</label>
                      <div className="mt-2 flex items-center gap-4">
                        {tariffFileData?.exists ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleTariffFileDownload}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Tariff Price
                            </Button>
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              File Uploaded
                            </Badge>
                          </>
                        ) : (
                          <span className="text-lg text-gray-400">No Tariff Uploaded</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Upload New Tariff File</label>
                      <div className="mt-2">
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleTariffFileUpload}
                          className="hidden"
                          id="tariff-file-input"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('tariff-file-input')?.click()}
                          disabled={uploadTariffMutation.isPending}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadTariffMutation.isPending ? 'Uploading...' : 'Upload Tariff Price'}
                        </Button>
                        <p className="text-xs text-gray-500 mt-2">
                          Excel files only (.xlsx, .xls). This will replace any existing tariff file.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status & Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Status & Timeline
                  </CardTitle>
                  <CardDescription>Current status and important dates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Current Status</label>
                      <div className="mt-2">
                        <Badge className={getStatusBadgeColor(provider.status)}>
                          {provider.status ? provider.status.replace('_', ' ') : 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Registration Date</label>
                      <p className="text-lg">{new Date(provider.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Updated</label>
                      <p className="text-lg">{new Date(provider.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Claims Tab */}
          <TabsContent value="claims">
            <Card>
              <CardHeader>
                <CardTitle>Recent Claims</CardTitle>
                <CardDescription>Latest claims from this provider</CardDescription>
              </CardHeader>
              <CardContent>
                {provider.claims && provider.claims.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Claim Number</TableHead>
                        <TableHead>Enrollee</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.claims.map((claim) => (
                        <TableRow key={claim.id}>
                          <TableCell className="font-medium">{claim.claim_number}</TableCell>
                          <TableCell>
                            {claim.principal
                              ? `${claim.principal.first_name} ${claim.principal.last_name}`
                              : "---"}
                          </TableCell>
                          <TableCell>₦{claim.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(claim.status)}>
                              {claim.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(claim.submitted_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-gray-500 text-center py-8">No claims found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* In-patients Tab */}
          <TabsContent value="inpatients">
            <Card>
              <CardHeader>
                <CardTitle>In-patient Records</CardTitle>
                <CardDescription>Current and recent in-patient admissions</CardDescription>
              </CardHeader>
              <CardContent>
                {provider.in_patients && provider.in_patients.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient ID</TableHead>
                        <TableHead>Admission Date</TableHead>
                        <TableHead>Discharge Date</TableHead>
                        <TableHead>Diagnosis</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.in_patients.map((patient) => (
                        <TableRow key={patient.id}>
                          <TableCell className="font-medium">{patient.patient_id}</TableCell>
                          <TableCell>
                            {new Date(patient.admission_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {patient.discharge_date ?
                              new Date(patient.discharge_date).toLocaleDateString() :
                              "---"
                            }
                          </TableCell>
                          <TableCell>{patient.diagnosis || "---"}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(patient.status)}>
                              {patient.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-gray-500 text-center py-8">No in-patient records found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tariff Plan Tab */}
          <TabsContent value="risk-profile">
            {activeTab === "risk-profile" ? (
              <TariffTabErrorBoundary>
                <TariffPlanTab providerId={provider.id} />
              </TariffTabErrorBoundary>
            ) : null}
          </TabsContent>
        </Tabs>

        {/* Approval Modal */}
        {showApprovalModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className={approvalAction === "approve" ? "text-green-600" : "text-red-600"}>
                    {approvalAction === "approve" ? "Approve" : "Reject"} Provider
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApprovalModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {approvalAction === "approve" ? "Approve" : "Reject"} {provider.facility_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {approvalAction === "approve" && (
                    <BandSelector
                      selectedBands={selectedBands}
                      onBandsChange={setSelectedBands}
                      className="mb-4"
                    />
                  )}
                  <div>
                    <Label htmlFor="comments">
                      {approvalAction === "approve" ? "Approval" : "Rejection"} Comments
                    </Label>
                    <Textarea
                      id="comments"
                      placeholder={`Enter ${approvalAction === "approve" ? "approval" : "rejection"} comments...`}
                      value={approvalComments}
                      onChange={(e) => setApprovalComments(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowApprovalModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitApproval}
                      disabled={approvalMutation.isPending}
                      className={
                        approvalAction === "approve"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      }
                    >
                      {approvalMutation.isPending ? "Processing..." :
                        approvalAction === "approve" ? "Approve" : "Reject"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
