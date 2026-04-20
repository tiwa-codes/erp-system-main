"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  Plus,
  Download,
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  MoreHorizontal,
  X,
  Copy,
  ExternalLink
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { PermissionGate } from "@/components/ui/permission-gate"
import { MetricCard } from "@/components/ui/metric-card"

export const dynamic = 'force-dynamic'

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
  
  status: string
  created_at: string
  updated_at: string
  _count?: {
    claims: number
    in_patients: number
  }
}

export default function ProviderManagementPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states for approval
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "suspend">("approve")
  const [approvalComments, setApprovalComments] = useState("")

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch providers
  const { data: providersData, isLoading } = useQuery({
    queryKey: ["providers", currentPage, limit, debouncedSearchTerm, selectedType, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedType !== "all" && { facility_type: selectedType }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      })
      
      const res = await fetch(`/api/providers?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  // Fetch provider metrics
  const { data: metricsData } = useQuery({
    queryKey: ["provider-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/providers/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch provider metrics")
      }
      return res.json()
    },
  })

  const providers = providersData?.providers || []
  const pagination = providersData?.pagination
  const metrics = metricsData || {
    total_providers: 0,
    active_providers: 0,
    pending_approval: 0,
    suspended_providers: 0,
    total_claims: 0,
    total_inpatients: 0
  }

  // Delete provider mutation
  const deleteProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/providers/${providerId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Failed to delete provider")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["providers"] })
      queryClient.invalidateQueries({ queryKey: ["provider-metrics"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete provider",
        variant: "destructive",
      })
    },
  })

  const handleDeleteProvider = (providerId: string, providerName: string) => {
    if (window.confirm(`Are you sure you want to delete ${providerName}?`)) {
      deleteProviderMutation.mutate(providerId)
    }
  }

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Approval mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ providerId, action, comments }: { providerId: string, action: string, comments: string }) => {
      const res = await fetch(`/api/providers/${providerId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, comments }),
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
      setSelectedProvider(null)
      setApprovalComments("")
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
  const handleApprovalAction = (provider: Provider, action: "approve" | "reject" | "suspend") => {
    setSelectedProvider(provider)
    setApprovalAction(action)
    setApprovalComments("")
    setShowApprovalModal(true)
  }

  const handleSubmitApproval = () => {
    if (!selectedProvider) return
    
    approvalMutation.mutate({
      providerId: selectedProvider.id,
      action: approvalAction,
      comments: approvalComments
    })
  }

  // Handle export
  // Handle copy public registration link
  const handleCopyLink = async () => {
    const publicUrl = `${window.location.origin}/provider-registration`
    
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast({
        title: "Link Copied",
        description: "Public provider registration link has been copied to clipboard",
      })
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = publicUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      
      toast({
        title: "Link Copied",
        description: "Public provider registration link has been copied to clipboard",
      })
    }
  }

  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params = new URLSearchParams({
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedType !== "all" && { facility_type: selectedType }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        format
      })
      
      const res = await fetch(`/api/providers/export?${params}`)
      if (!res.ok) {
        throw new Error(`Failed to export ${format}`)
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `providers-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Success",
        description: `${format.toUpperCase()} report exported successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to export ${format}`,
        variant: "destructive",
      })
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
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
  const getFacilityTypeBadgeColor = (facilityTypes: string[] = []) => {
    if (facilityTypes.includes('HOSPITAL')) {
      return 'bg-blue-100 text-blue-800'
    } else if (facilityTypes.includes('CLINIC')) {
      return 'bg-green-100 text-green-800'
    } else if (facilityTypes.includes('PHARMACY')) {
      return 'bg-purple-100 text-purple-800'
    } else if (facilityTypes.includes('LABORATORY')) {
      return 'bg-orange-100 text-orange-800'
    } else if (facilityTypes.includes('SPECIALIST')) {
      return 'bg-pink-100 text-pink-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  // Get facility type display text
  const getFacilityTypeText = (facilityTypes: string[] = []) => {
    if (facilityTypes.length === 0) return 'Unknown'
    return facilityTypes.join(', ').replace(/_/g, ' ')
  }

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Provider Management</h1>
            <p className="text-gray-600">Manage healthcare providers and facilities</p>
          </div>
          <div className="flex gap-4">
            <PermissionGate module="provider" action="add">
              <Button onClick={() => router.push("/providers/add")} className="bg-[#BE1522] hover:bg-[#9B1219]">
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </PermissionGate>
            <PermissionGate module="provider" action="view">
              <Button onClick={handleCopyLink} className="bg-green-600 hover:bg-green-700 text-white">
                <Copy className="h-4 w-4 mr-2" />
                Copy Public Link
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Public Registration Link Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ExternalLink className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Public Provider Registration</p>
                <p className="text-xs text-blue-700">Share this link with providers to allow them to register directly</p>
              </div>
              <Button 
                onClick={handleCopyLink} 
                size="sm" 
                className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Providers"
            value={metrics.total_providers}
            icon={Building2}
            trend={{ value: 12, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Active Providers"
            value={metrics.active_providers}
            icon={CheckCircle}
            trend={{ value: 8, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Pending Approval"
            value={metrics.pending_approval}
            icon={Clock}
            trend={{ value: 3, isPositive: false }}
            description="vs last month"
          />
          <MetricCard
            title="Suspended"
            value={metrics.suspended_providers}
            icon={XCircle}
            trend={{ value: 1, isPositive: false }}
            description="vs last month"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Search Provider</label>
                <Input
                  placeholder="Search by facility name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Facility Type</label>
                <Select value={selectedType} onValueChange={(value) => {
                  setSelectedType(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="HOSPITAL">Hospital</SelectItem>
                    <SelectItem value="PRIMARY_CARE">Primary Care/Clinic</SelectItem>
                    <SelectItem value="SECONDARY_CARE">Secondary Care</SelectItem>
                    <SelectItem value="PHARMACEUTICAL">Pharmaceutical Services</SelectItem>
                    <SelectItem value="OPTICAL">Optical Clinic</SelectItem>
                    <SelectItem value="DENTAL">Dental Clinic</SelectItem>
                    <SelectItem value="DIAGNOSTICS">Diagnostics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={selectedStatus} onValueChange={(value) => {
                  setSelectedStatus(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleFilterChange} className="bg-[#BE1522] hover:bg-[#9B1219]">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
                <Button onClick={() => handleExport('excel')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button onClick={() => handleExport('pdf')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Providers Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Providers</CardTitle>
                <CardDescription className="mt-2">Manage healthcare providers and facilities</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">FACILITY NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">FACILITY TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">MEDICAL DIRECTOR</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">HMO COORDINATOR</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PHONE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">EMAIL</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CLAIMS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">IN-PATIENTS</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((provider: Provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-red-400">
                                {provider.facility_name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{provider.facility_name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getFacilityTypeBadgeColor(provider.facility_type)}>
                            {getFacilityTypeText(provider.facility_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>{provider.medical_director_name}</TableCell>
                        <TableCell>{provider.hmo_coordinator_name}</TableCell>
                        <TableCell>{provider.phone_whatsapp || "---"}</TableCell>
                        <TableCell>{provider.email || "---"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(provider.status)}>
                            {provider.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{provider._count?.claims || 0}</TableCell>
                        <TableCell>{provider._count?.in_patients || 0}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <PermissionGate module="provider" action="view">
                                <DropdownMenuItem 
                                  onClick={() => router.push(`/provider/${provider.id}`)}
                                  className="w-full justify-start text-xs"
                                >
                                  View
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="provider" action="edit">
                                <DropdownMenuItem 
                                  onClick={() => router.push(`/provider/edit/${provider.id}`)}
                                  className="w-full justify-start text-xs"
                                >
                                  Edit
                                </DropdownMenuItem>
                              </PermissionGate>
                              {provider.status === "PENDING_APPROVAL" && (
                                <>
                                  <PermissionGate module="provider" action="approve">
                                    <DropdownMenuItem 
                                      onClick={() => handleApprovalAction(provider, "approve")}
                                      className="text-green-600 w-full justify-start text-xs"
                                    >
                                      Approve
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                  <PermissionGate module="provider" action="approve">
                                    <DropdownMenuItem 
                                      onClick={() => handleApprovalAction(provider, "reject")}
                                      className="text-red-600 w-full justify-start text-xs"
                                    >
                                      Reject
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                </>
                              )}
                              {provider.status === "ACTIVE" && (
                                <PermissionGate module="provider" action="approve">
                                  <DropdownMenuItem 
                                    onClick={() => handleApprovalAction(provider, "suspend")}
                                    className="text-orange-600"
                                  >
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    Suspend
                                  </DropdownMenuItem>
                                </PermissionGate>
                              )}
                              <PermissionGate module="provider" action="delete">
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteProvider(provider.id, provider.facility_name)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </PermissionGate>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                        disabled={pagination.page === pagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Approval Modal */}
        {showApprovalModal && selectedProvider && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">
                    {approvalAction === "approve" ? "Approve" : approvalAction === "reject" ? "Reject" : "Suspend"} Provider
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApprovalModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {approvalAction === "approve" ? "Approve" : approvalAction === "reject" ? "Reject" : "Suspend"} {selectedProvider.facility_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="comments">
                      {approvalAction === "approve" ? "Approval" : approvalAction === "reject" ? "Rejection" : "Suspension"} Comments
                    </Label>
                    <Textarea
                      id="comments"
                      placeholder={`Enter ${approvalAction === "approve" ? "approval" : approvalAction === "reject" ? "rejection" : "suspension"} comments...`}
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
                          : approvalAction === "reject" 
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-orange-600 hover:bg-orange-700"
                      }
                    >
                      {approvalMutation.isPending ? "Processing..." : 
                        approvalAction === "approve" ? "Approve" : 
                        approvalAction === "reject" ? "Reject" : "Suspend"}
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
