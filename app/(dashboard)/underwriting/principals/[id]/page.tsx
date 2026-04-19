"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { calculateAge } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Building2,
  Hospital,
  DollarSign,
  Users,
  FileText,
  Activity,
  MoreHorizontal,
  Plus,
  TrendingUp,
  TrendingDown,
  Package,
  Download,
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { PermissionButton } from "@/components/ui/permission-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Service Utilization Summary Component
function ServiceUtilizationSummary({
  principalId,
  initialOldUtilization,
}: {
  principalId: string
  initialOldUtilization?: number
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditingOldUtilization, setIsEditingOldUtilization] = useState(false)
  const [oldUtilizationInput, setOldUtilizationInput] = useState(String(initialOldUtilization ?? 0))

  const { data: utilizationData, isLoading } = useQuery({
    queryKey: ["service-utilization", principalId],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/principals/${principalId}/service-utilization`)
      if (!res.ok) throw new Error("Failed to fetch service utilization")
      return res.json()
    }
  })

  useEffect(() => {
    setOldUtilizationInput(String(initialOldUtilization ?? 0))
  }, [initialOldUtilization])

  const updateOldUtilizationMutation = useMutation({
    mutationFn: async (value: number) => {
      const response = await fetch(`/api/underwriting/principals/${principalId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          old_utilization: value,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "Failed to update old utilization")
      }

      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "Old utilization updated",
        description: "Imported utilization has been saved for this principal.",
      })
      setIsEditingOldUtilization(false)
      queryClient.invalidateQueries({ queryKey: ["service-utilization", principalId] })
      queryClient.invalidateQueries({ queryKey: ["principal", principalId] })
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  if (!utilizationData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load service utilization data</p>
      </div>
    )
  }

  const { summary, service_utilization } = utilizationData
  const oldUtilization = Number(summary.old_utilization ?? initialOldUtilization ?? 0)

  return (
    <div className="space-y-6">
      {/* Utilization Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Annual Limit</p>
                <p className="text-2xl font-bold text-gray-900">₦{summary.annual_limit.toLocaleString()}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Utilized</p>
                <p className="text-2xl font-bold text-red-600">₦{summary.total_utilized.toLocaleString()}</p>
                <p className="mt-1 text-xs text-gray-500">Imported / Old Utilization: ₦{oldUtilization.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <PermissionGate module="underwriting" action="edit">
                  {isEditingOldUtilization ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={oldUtilizationInput}
                        onChange={(event) => setOldUtilizationInput(event.target.value)}
                        className="h-8 w-32"
                      />
                      <Button
                        size="sm"
                        className="h-8 bg-[#BE1522] hover:bg-[#9B1219]"
                        disabled={updateOldUtilizationMutation.isPending}
                        onClick={() => {
                          const parsedValue = Number(oldUtilizationInput)
                          if (!Number.isFinite(parsedValue) || parsedValue < 0) {
                            toast({
                              title: "Invalid amount",
                              description: "Please enter a valid utilization amount.",
                              variant: "destructive",
                            })
                            return
                          }
                          updateOldUtilizationMutation.mutate(parsedValue)
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => {
                          setOldUtilizationInput(String(oldUtilization))
                          setIsEditingOldUtilization(false)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setIsEditingOldUtilization(true)}
                    >
                      Edit
                    </Button>
                  )}
                </PermissionGate>
                <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-red-600" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Remaining Balance</p>
                <p className="text-2xl font-bold text-green-600">₦{summary.remaining_balance.toLocaleString()}</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Utilization Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Plan Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Utilization: {summary.utilization_percentage.toFixed(1)}%</span>
              <span>₦{summary.total_utilized.toLocaleString()} / ₦{summary.annual_limit.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-[#BE1522] h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(summary.utilization_percentage, 100)}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Utilization Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Service Utilization Details
          </CardTitle>
          <CardDescription>
            Breakdown of services utilized by this enrollee
          </CardDescription>
        </CardHeader>
        <CardContent>
          {service_utilization.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service / Period</TableHead>
                  <TableHead>Usage Count</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Last Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {service_utilization.map((service: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{service.service_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {service.is_old_utilization ? "Imported" : `${service.count} times`}
                      </Badge>
                    </TableCell>
                    <TableCell>₦{service.total_amount.toLocaleString()}</TableCell>
                    <TableCell>
                      {service.is_old_utilization
                        ? (service.last_used ? `Uploaded ${new Date(service.last_used).toLocaleDateString()}` : "Legacy import")
                        : (service.last_used ? new Date(service.last_used).toLocaleDateString() : "Carry forward")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">No services utilized yet</p>
              <p className="text-gray-400 text-xs mt-1">Imported period utilization and new service usage will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface Principal {
  id: string
  enrollee_id: string
  first_name: string
  last_name: string
  middle_name?: string
  gender?: string
  date_of_birth?: string
  age?: number
  profile_picture?: string
  marital_status?: string
  region?: string
  phone_number?: string
  email?: string
  residential_address?: string
  organization_id: string
  organization: {
    id: string
    name: string
    code: string
  }
  plan_id?: string
  plan?: {
    id: string
    name: string
    plan_type: string
    premium_amount: number
    annual_limit: number
  }
  account_type: string
  balance: number
  old_utilization?: number
  auto_renewal: boolean
  primary_hospital?: string
  hospital_address?: string
  start_date?: string
  end_date?: string
  status: string
  created_at: string
  updated_at: string
  created_by: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  dependents: Array<{
    id: string
    dependent_id: string
    first_name: string
    last_name: string
    date_of_birth: string
    relationship: string
    status: string
    profile_picture?: string
  }>
  claims: Array<{
    id: string
    claim_number: string
    amount: number
    status: string
    submitted_at: string
  }>
  medical_history?: {
    id: string
    sickle_cell_disease: boolean
    kidney_disease: boolean
    epilepsy: boolean
    cancer_prostate_cervical: boolean
    asthma: boolean
    hiv_aids: boolean
    surgeries: boolean
    diabetes_mellitus: boolean
    cataract: boolean
    goiter: boolean
    peptic_ulcer: boolean
    hypertension: boolean
    glaucoma: boolean
    tuberculosis: boolean
    haemorrhoids: boolean
    hepatitis: boolean
    disease_comments?: string
  }
  _count: {
    dependents: number
    claims: number
  }
}

export default function PrincipalTimelinePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const { id } = params
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Fetch principal data
  const {
    data: principal,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["principal", id],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/principals/${id}`)
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to fetch principal")
      }
      const data = await res.json()
      return data
    },
    enabled: !!id,
  })

  const handleEditPrincipal = () => {
    router.push(`/underwriting/principals/edit/${id}`)
  }

  const handleDeletePrincipal = () => {
    setDeleteDialogOpen(true)
  }

  const confirmDeletePrincipal = async () => {
    if (!principal) return

    try {
      const res = await fetch(`/api/underwriting/principals/${principal.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete principal')
      }

      toast({
        title: "Principal Deleted",
        description: `Principal "${principal.first_name} ${principal.last_name}" has been successfully deleted.`,
      })
      router.push("/underwriting/principals")
    } catch (err: any) {
      toast({
        title: "Error Deleting Principal",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-red-100 text-red-800"
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getAccountTypeBadgeColor = (type: string) => {
    switch (type) {
      case "PRINCIPAL":
        return "bg-red-100 text-red-800"
      case "DEPENDENT":
        return "bg-purple-100 text-purple-800"
      case "PROVIDER":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleExportTimeline = () => {
    const rows = principal.claims.map((claim: { submitted_at: string; claim_number: string; provider?: { facility_name?: string | null } | null; amount: number; status: string }) => ({
      date: new Date(claim.submitted_at).toLocaleDateString(),
      claim_number: claim.claim_number,
      hospital: claim.provider?.facility_name || principal.primary_hospital || "N/A",
      amount: claim.amount,
      status: claim.status,
    }))

    const csv = [
      ["Date", "Claim Number", "Hospital", "Amount", "Status"],
      ...rows.map((row: { date: string; claim_number: string; hospital: string; amount: number; status: string }) => [
        row.date,
        row.claim_number,
        row.hospital,
        String(row.amount),
        row.status,
      ]),
    ]
      .map((r) => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${principal.enrollee_id}-timeline-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const getClaimStatusBadgeColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      case "VETTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getDependentStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Error loading principal: {(error as Error).message}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  if (!principal) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">Principal not found</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  return (
    <PermissionGate module="underwriting" action="view">
      <div className="space-y-6">
        {/* Header */}
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
            <h1 className="text-3xl font-bold">
              <span className="text-[#BE1522]">Principal Timeline</span>
              <span className="text-gray-400 mx-2">&gt;</span>
              <span className="text-gray-600">{principal.first_name} {principal.last_name}</span>
            </h1>
            <p className="text-gray-600">View principal account details and related information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Principal Details Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center">
                    {principal.profile_picture ? (
                      <img
                        src={principal.profile_picture}
                        alt={`${principal.first_name} ${principal.last_name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="h-8 w-8 text-[#BE1522]" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {principal.first_name} {principal.last_name}
                    </h2>
                    <p className="text-gray-600">Enrollee ID: {principal.enrollee_id}</p>
                    <Badge className={getStatusBadgeColor(principal.status)}>
                      {principal.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Personal Information */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Personal Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Gender:</span>
                      <span>{principal.gender || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Age:</span>
                      <span>{principal.date_of_birth ? calculateAge(principal.date_of_birth) : (principal.age || "N/A")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Marital Status:</span>
                      <span>{principal.marital_status || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Region:</span>
                      <span>{principal.region || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">DOB:</span>
                      <span className="text-xs">
                        {principal.date_of_birth
                          ? new Date(principal.date_of_birth).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">Phone:</span>
                      <span className="text-xs">{principal.phone_number || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">Email:</span>
                      <span className="text-xs">{principal.email || "N/A"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-xs">Address:</span>
                      <span className="text-xs">{principal.residential_address || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Organization & Account Information */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Organization & Account</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">Organization:</span>
                      <span className="text-xs">{principal.organization.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">Account Type:</span>
                      <span className="text-xs text-[#BE1522]">{principal.account_type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">Balance:</span>
                      <span className="text-xs">₦{principal.balance.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">Auto Renewal:</span>
                      <span className={`text-xs ${principal.auto_renewal ? "text-green-600" : "text-red-600"}`}>
                        {principal.auto_renewal ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">Primary Hospital:</span>
                      <span className="text-xs">{principal.primary_hospital || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">Start Date:</span>
                      <span className="text-xs">
                        {principal.start_date
                          ? new Date(principal.start_date).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">End Date:</span>
                      <span className="text-xs">
                        {principal.end_date
                          ? new Date(principal.end_date).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">Registered On:</span>
                      <span className="text-xs">{new Date(principal.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Created By:</span>
                      <span>
                        {principal.created_by.first_name} {principal.created_by.last_name}
                      </span>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Tabbed Content Panel */}
          <div className="lg:col-span-2">
            <Card>
              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="plan">Plan</TabsTrigger>
                  <TabsTrigger value="dependents">Dependents</TabsTrigger>
                  <TabsTrigger value="medical">Medical History</TabsTrigger>
                  <TabsTrigger value="claims">Claims</TabsTrigger>
                  <TabsTrigger value="audit">Audit Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="space-y-4">
                  <div className="p-6">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[#BE1522]">Enrollee Timeline</h3>
                      <Button variant="outline" size="sm" onClick={handleExportTimeline}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Timeline
                      </Button>
                    </div>
                    <div className="space-y-6">
                      {/* Timeline with better styling */}
                      {principal.claims.map((claim: any, index: number) => (
                        <div key={claim.id} className="relative flex items-start gap-4 pb-6">
                          {/* Timeline line */}
                          {index < principal.claims.length - 1 && (
                            <div className="absolute left-3 top-8 w-0.5 h-full bg-gray-200"></div>
                          )}
                          {/* Timeline dot */}
                          <div className="relative z-10 w-6 h-6 bg-[#BE1522] rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                          {/* Timeline content */}
                          <div className="flex-1 bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-sm text-gray-900">
                                {new Date(claim.submitted_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                              <Badge className={`text-xs ${getClaimStatusBadgeColor(claim.status)}`}>
                                {claim.status}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-gray-700">
                                Service Claim: {claim.claim_number}
                              </p>
                              <p className="text-sm text-gray-600">
                                Amount: ₦{claim.amount.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                Hospital: {claim.provider?.facility_name || principal.primary_hospital || "N/A"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {principal.claims.length === 0 && (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Activity className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500 text-sm">No service history available</p>
                          <p className="text-gray-400 text-xs mt-1">Claims will appear here once submitted</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="plan" className="space-y-4">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-6 text-[#BE1522]">Plan Details & Service Utilization</h3>
                    {principal.plan ? (
                      <div className="space-y-6">
                        {/* Plan Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan Name</span>
                              <p className="text-sm font-semibold text-[#BE1522] mt-1">{principal.plan.name}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Primary Hospital</span>
                              <p className="text-sm text-gray-900 mt-1">{principal.primary_hospital || "N/A"}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan Start</span>
                              <p className="text-sm text-gray-900 mt-1">
                                {principal.start_date
                                  ? new Date(principal.start_date).toLocaleDateString()
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expires</span>
                              <p className="text-sm text-gray-900 mt-1">
                                {principal.end_date
                                  ? new Date(principal.end_date).toLocaleDateString()
                                  : "N/A"}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Annual Limit</span>
                              <p className="text-sm font-semibold text-gray-900 mt-1">₦{principal.plan.annual_limit.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Premium Amount</span>
                              <p className="text-sm font-semibold text-gray-900 mt-1">₦{principal.plan.premium_amount.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>

                        {/* Service Utilization Summary */}
                        <ServiceUtilizationSummary
                          principalId={principal.id}
                          initialOldUtilization={Number(principal.old_utilization ?? 0)}
                        />
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">No plan assigned</p>
                        <p className="text-gray-400 text-xs mt-1">Contact administrator to assign a plan</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="dependents" className="space-y-4">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Dependents</h3>
                      <PermissionButton
                        module="underwriting"
                        action="add"
                        size="sm"
                        className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
                        onClick={() => router.push("/underwriting/dependents")}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Dependent
                      </PermissionButton>
                    </div>
                    {principal.dependents.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Photo</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Relationship</TableHead>
                            <TableHead>Age</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {principal.dependents.map((dependent: any) => (
                            <TableRow key={dependent.id}>
                              <TableCell>
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                                  {dependent.profile_picture ? (
                                    <img
                                      src={dependent.profile_picture}
                                      alt={`${dependent.first_name} ${dependent.last_name}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Users className="h-4 w-4 text-gray-400" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {dependent.first_name} {dependent.last_name}
                              </TableCell>
                              <TableCell>{dependent.relationship}</TableCell>
                              <TableCell>
                                {dependent.date_of_birth ? calculateAge(dependent.date_of_birth) : "N/A"}
                              </TableCell>
                              <TableCell>
                                <Badge className={getDependentStatusBadgeColor(dependent.status)}>
                                  {dependent.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <PermissionButton 
                                      module="underwriting" 
                                      action="view"
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => router.push(`/underwriting/dependents/${dependent.id}`)}
                                      className="w-full justify-start text-xs"
                                    >
                                      View
                                    </PermissionButton>
                                    <PermissionButton 
                                      module="underwriting" 
                                      action="edit"
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => router.push(`/underwriting/dependents/edit/${dependent.id}`)}
                                      className="w-full justify-start text-xs"
                                    >
                                      Edit
                                    </PermissionButton>
                                    <PermissionButton 
                                      module="underwriting" 
                                      action="edit"
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => {}}
                                      className="w-full justify-start text-xs"
                                    >
                                      Change Status
                                    </PermissionButton>
                                    <PermissionButton 
                                      module="underwriting" 
                                      action="delete"
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-red-600 hover:text-red-700 w-full justify-start text-xs"
                                      onClick={() => {
                                        if (window.confirm(`Are you sure you want to delete ${dependent.first_name} ${dependent.last_name}?`)) {
                                          // Handle delete
                                        }
                                      }}
                                    >
                                      Delete
                                    </PermissionButton>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No dependents registered</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="medical" className="space-y-4">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Medical History</h3>
                    {principal.medical_history ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-gray-900">Medical Conditions</h4>
                            <div className="space-y-1 text-sm">
                              {principal.medical_history.sickle_cell_disease && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Sickle Cell Disease</span>
                                </div>
                              )}
                              {principal.medical_history.kidney_disease && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Kidney Disease</span>
                                </div>
                              )}
                              {principal.medical_history.epilepsy && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Epilepsy</span>
                                </div>
                              )}
                              {principal.medical_history.cancer_prostate_cervical && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Cancer (Prostate/Cervical)</span>
                                </div>
                              )}
                              {principal.medical_history.asthma && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Asthma</span>
                                </div>
                              )}
                              {principal.medical_history.hiv_aids && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>HIV/AIDS</span>
                                </div>
                              )}
                              {principal.medical_history.surgeries && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Previous Surgeries</span>
                                </div>
                              )}
                              {principal.medical_history.diabetes_mellitus && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Diabetes Mellitus</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-medium text-gray-900">Additional Conditions</h4>
                            <div className="space-y-1 text-sm">
                              {principal.medical_history.cataract && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Cataract</span>
                                </div>
                              )}
                              {principal.medical_history.goiter && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Goiter</span>
                                </div>
                              )}
                              {principal.medical_history.peptic_ulcer && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Peptic Ulcer</span>
                                </div>
                              )}
                              {principal.medical_history.hypertension && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Hypertension</span>
                                </div>
                              )}
                              {principal.medical_history.glaucoma && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Glaucoma</span>
                                </div>
                              )}
                              {principal.medical_history.tuberculosis && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Tuberculosis</span>
                                </div>
                              )}
                              {principal.medical_history.haemorrhoids && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Haemorrhoids</span>
                                </div>
                              )}
                              {principal.medical_history.hepatitis && (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span>Hepatitis</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {principal.medical_history.disease_comments && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Additional Comments</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {principal.medical_history.disease_comments}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No medical history recorded</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="claims" className="space-y-4">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Claims History</h3>
                    {principal.claims.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Hospital</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {principal.claims.map((claim: any) => (
                            <TableRow key={claim.id}>
                              <TableCell>
                                {new Date(claim.submitted_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>{claim.provider?.facility_name || principal.primary_hospital || "N/A"}</TableCell>
                              <TableCell>{claim.claim_number}</TableCell>
                              <TableCell>₦{claim.amount.toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge className={getClaimStatusBadgeColor(claim.status)}>
                                  {claim.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No claims history available</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="space-y-4">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-6 text-[#BE1522]">Audit Logs</h3>
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">No audit logs available</p>
                      <p className="text-gray-400 text-xs mt-1">Activity logs will appear here</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Principal Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the principal account for{" "}
              <strong>
                {principal?.first_name} {principal?.last_name}
              </strong>{" "}
              ({principal?.id.slice(-8)})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePrincipal}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGate>
  )
}
