"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { PermissionGate } from "@/components/ui/permission-gate"
import { EditDependentForm } from "@/components/forms/edit-dependent-form"
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building,
  Heart,
  FileText,
  X,
  Activity,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Download,
} from "lucide-react"

interface DependentViewPageProps {
  params: { id: string }
}

// Service Utilization Summary Component
function ServiceUtilizationSummary({
  dependentId,
  initialOldUtilization,
}: {
  dependentId: string
  initialOldUtilization?: number
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditingOldUtilization, setIsEditingOldUtilization] = useState(false)
  const [oldUtilizationInput, setOldUtilizationInput] = useState(String(initialOldUtilization ?? 0))

  const { data: utilizationData, isLoading } = useQuery({
    queryKey: ["dependent-service-utilization", dependentId],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/dependents/${dependentId}/service-utilization`)
      if (!res.ok) throw new Error("Failed to fetch service utilization")
      return res.json()
    }
  })

  useEffect(() => {
    setOldUtilizationInput(String(initialOldUtilization ?? 0))
  }, [initialOldUtilization])

  const updateOldUtilizationMutation = useMutation({
    mutationFn: async (value: number) => {
      const response = await fetch(`/api/underwriting/dependents/${dependentId}`, {
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
        description: "Imported utilization has been saved for this dependent.",
      })
      setIsEditingOldUtilization(false)
      queryClient.invalidateQueries({ queryKey: ["dependent-service-utilization", dependentId] })
      queryClient.invalidateQueries({ queryKey: ["dependent", dependentId] })
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
            Breakdown of services utilized by this dependent
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

export default function DependentViewPage({ params }: DependentViewPageProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [showEditModal, setShowEditModal] = useState(false)

  // Fetch dependent data
  const { data: dependentData, isLoading, error } = useQuery({
    queryKey: ["dependent", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/dependents/${params.id}`)
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Dependent not found")
        }
        throw new Error("Failed to fetch dependent")
      }
      return res.json()
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/underwriting/dependents/${params.id}`, {
        method: "DELETE"
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete dependent")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Dependent deleted successfully",
        description: "The dependent has been removed from the system."
      })
      router.push("/underwriting/dependents")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleDelete = async () => {
    if (!confirm(`Delete dependent "${dependentData?.first_name} ${dependentData?.last_name}"?`)) return
    deleteMutation.mutate()
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
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
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

  const getRelationshipBadgeColor = (relationship: string) => {
    switch (relationship) {
      case "SPOUSE":
        return "bg-blue-100 text-blue-800"
      case "CHILD":
        return "bg-purple-100 text-purple-800"
      case "PARENT":
        return "bg-orange-100 text-orange-800"
      case "SIBLING":
        return "bg-pink-100 text-pink-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleExportTimeline = () => {
    const claims = dependent.principal?.claims || []
    const rows = claims.map((claim: any) => ({
      date: new Date(claim.submitted_at).toLocaleDateString(),
      claim_number: claim.claim_number,
      hospital: claim.provider?.facility_name || "N/A",
      amount: claim.amount,
      status: claim.status,
    }))

    const csv = [
      ["Date", "Claim Number", "Hospital", "Amount", "Status"],
      ...rows.map((row: any) => [
        row.date,
        row.claim_number,
        row.hospital,
        String(row.amount),
        row.status,
      ]),
    ]
      .map((r: string[]) => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${dependent.dependent_id}-timeline-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading dependent details...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-2">Error</div>
          <div className="text-gray-600 mb-4">{error.message}</div>
          <Button onClick={() => router.push("/underwriting/dependents")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dependents
          </Button>
        </div>
      </div>
    )
  }

  const dependent = dependentData

  if (!dependent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-4">Dependent not found</div>
          <Button onClick={() => router.push("/underwriting/dependents")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dependents
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push("/underwriting/dependents")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {dependent.first_name} {dependent.last_name}
            </h1>
            <p className="text-muted-foreground">
              Dependent ID: {dependent.dependent_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate module="underwriting" action="update">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </PermissionGate>
          <PermissionGate module="underwriting" action="delete">
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Dependent Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Summary */}
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <User className="h-12 w-12 text-gray-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {dependent.first_name} {dependent.last_name}
                </h2>
                <p className="text-gray-600">ID: {dependent.dependent_id}</p>
                <Badge className={getStatusBadgeColor(dependent.status)}>
                  {dependent.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Personal Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Gender</h3>
                <p className="text-lg">{dependent.gender || "N/A"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Date of Birth</h3>
                <p className="text-lg">
                  {dependent.date_of_birth ? new Date(dependent.date_of_birth).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Phone Number</h3>
                <p className="text-lg">{dependent.phone_number || "N/A"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email Address</h3>
                <p className="text-lg">{dependent.email || "N/A"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Residential Address</h3>
                <p className="text-lg">
                  {dependent.residential_address || "N/A"}
                  {dependent.state && dependent.lga && (
                    <span className="text-gray-500">
                      <br />
                      {dependent.state}, {dependent.lga}
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Organizational Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organizational Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Organization</h3>
                <p className="text-lg">{dependent.principal?.organization?.name || "N/A"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Account Type</h3>
                <p className="text-lg">{dependent.principal?.account_type || "N/A"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Start Date</h3>
                <p className="text-lg">
                  {dependent.principal?.start_date ? new Date(dependent.principal.start_date).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">End Date</h3>
                <p className="text-lg">
                  {dependent.principal?.end_date ? new Date(dependent.principal.end_date).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Registered On</h3>
                <p className="text-lg">
                  {dependent.created_at ? new Date(dependent.created_at).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Created By</h3>
                <p className="text-lg">
                  {dependent.created_by
                    ? `${dependent.created_by.first_name} ${dependent.created_by.last_name}`.trim()
                    : "System"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
              <TabsTrigger value="medical">Medical History</TabsTrigger>
              <TabsTrigger value="claims">Claims</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Dependent Timeline
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={handleExportTimeline}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Timeline
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Timeline with better styling */}
                    {dependent.principal?.claims && dependent.principal.claims.length > 0 ? (
                      dependent.principal.claims.map((claim: any, index: number) => (
                        <div key={claim.id} className="relative flex items-start gap-4 pb-6">
                          {/* Timeline line */}
                          {index < dependent.principal.claims.length - 1 && (
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
                                Hospital: {claim.provider?.facility_name || "N/A"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Activity className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">No service history available</p>
                        <p className="text-gray-400 text-xs mt-1">Claims will appear here once submitted</p>
                      </div>
                    )}
                    
                    {/* Basic timeline events */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-3 h-3 bg-[#BE1522] rounded-full"></div>
                      <div>
                        <div className="font-medium">Dependent Created</div>
                        <div className="text-sm text-gray-500">
                          {dependent.created_at ? new Date(dependent.created_at).toLocaleString() : "N/A"}
                        </div>
                      </div>
                    </div>
                    {dependent.updated_at && dependent.updated_at !== dependent.created_at && (
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <div className="font-medium">Last Updated</div>
                          <div className="text-sm text-gray-500">
                            {new Date(dependent.updated_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plan" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Plan Details & Service Utilization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ServiceUtilizationSummary
                    dependentId={params.id}
                    initialOldUtilization={Number(dependent.old_utilization ?? 0)}
                  />
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="medical" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Medical History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm">No medical history available</p>
                    <p className="text-gray-400 text-xs mt-1">Medical records will appear here when available</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="claims" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Claims History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dependent.principal?.claims && dependent.principal.claims.length > 0 ? (
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
                        {dependent.principal.claims.map((claim: any) => (
                          <TableRow key={claim.id}>
                            <TableCell>
                              {new Date(claim.submitted_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{claim.provider?.facility_name || "N/A"}</TableCell>
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
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">No claims found</p>
                      <p className="text-gray-400 text-xs mt-1">Claims will appear here when processed</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Audit Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-3 h-3 bg-[#BE1522] rounded-full"></div>
                      <div>
                        <div className="font-medium">Dependent Created</div>
                        <div className="text-sm text-gray-500">
                          {dependent.created_at ? new Date(dependent.created_at).toLocaleString() : "N/A"}
                        </div>
                      </div>
                    </div>
                    {dependent.updated_at && dependent.updated_at !== dependent.created_at && (
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <div className="font-medium">Last Updated</div>
                          <div className="text-sm text-gray-500">
                            {new Date(dependent.updated_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Dependent Modal */}
      <PermissionGate module="underwriting" action="update">
        {showEditModal && dependent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Edit Dependent</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Update dependent information and details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EditDependentForm
                  dependent={dependent}
                  onSuccess={() => {
                    setShowEditModal(false)
                    queryClient.invalidateQueries({ queryKey: ["dependent", params.id] })
                  }}
                  onCancel={() => setShowEditModal(false)}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>
    </div>
  )
}
