"use client"

export const dynamic = 'force-dynamic'

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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  MoreHorizontal,
  X
} from "lucide-react"
import { MetricCard } from "@/components/ui/metric-card"
import { PermissionGate } from "@/components/ui/permission-gate"
import { BandSelector } from "@/components/ui/band-selector"



interface Provider {
  id: string
  facility_name: string
  hcp_code: string
  facility_type: string
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
  hours_of_operation: string
  other_branches: string
  emergency_care_services: string
  personnel_licensed: string
  blood_bank_available: string
  blood_sourcing_method: string
  radiology_lab_services: string
  other_services: string
  account_name: string
  account_number: string
  designation: string
  cac_registration_url?: string | null
  nhis_accreditation_url?: string | null
  professional_indemnity_url?: string | null
  state_facility_registration_url?: string | null
  others_attachment_url?: string | null
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_APPROVAL"
  created_at: string
  updated_at: string
  // Note: These fields don't exist in the current Provider model
  // They would need to be added to the schema if approval tracking is required
}

interface ApprovalMetrics {
  total_pending: number
  total_approved_today: number
  total_rejected_today: number
  avg_processing_time: number
}

export default function ProviderApprovalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("PENDING_APPROVAL")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<{ title: string; url: string } | null>(null)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "suspend">("approve")
  const [approvalComments, setApprovalComments] = useState("")
  const [selectedBands, setSelectedBands] = useState<string[]>([])
  const isStagingHost = typeof window !== "undefined" && window.location.hostname.includes("staging.")

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch providers pending approval
  const { data: providersData, isLoading } = useQuery({
    queryKey: ["provider-approvals", currentPage, limit, debouncedSearchTerm, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        status: selectedStatus,
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
      })
      
      const res = await fetch(`/api/providers?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  // Fetch approval metrics
  const { data: metricsData } = useQuery({
    queryKey: ["provider-approval-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/providers/approval/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch metrics")
      }
      return res.json()
    },
  })

  // Approval mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ providerId, action, comments, assigned_bands }: { providerId: string, action: string, comments: string, assigned_bands?: string[] }) => {
      const res = await fetch(`/api/providers/${providerId}/approve`, {
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
      setSelectedProvider(null)
      setApprovalComments("")
      setSelectedBands([])
      queryClient.invalidateQueries({ queryKey: ["provider-approvals"] })
      queryClient.invalidateQueries({ queryKey: ["provider-approval-metrics"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const providers = providersData?.providers || []
  const pagination = providersData?.pagination
  const metrics = metricsData?.metrics || {
    total_pending: 0,
    total_approved_today: 0,
    total_rejected_today: 0,
    avg_processing_time: 0
  }

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return "bg-yellow-100 text-yellow-800"
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-red-100 text-red-800"
      case "SUSPENDED":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Handle action clicks
  const handleViewProvider = async (provider: Provider) => {
    try {
      const res = await fetch(`/api/providers/${provider.id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedProvider(data.provider)
        setShowViewModal(true)
      } else {
        setSelectedProvider(provider)
        setShowViewModal(true)
      }
    } catch (error) {
      console.error("Error fetching provider details:", error)
      setSelectedProvider(provider)
      setShowViewModal(true)
    }
  }

  const handleViewAttachment = (title: string, url?: string | null) => {
    if (!url) return

    if (isStagingHost) {
      setAttachmentPreview({ title, url })
      return
    }

    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleApprovalAction = (provider: Provider, action: "approve" | "reject" | "suspend") => {
    setSelectedProvider(provider)
    setApprovalAction(action)
    setApprovalComments("")
    setSelectedBands([])
    setShowApprovalModal(true)
  }

  const handleSubmitApproval = () => {
    if (!selectedProvider) return
    
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
      providerId: selectedProvider.id,
      action: approvalAction,
      comments: approvalComments,
      assigned_bands: approvalAction === "approve" ? selectedBands : undefined
    })
  }

  return (
    <PermissionGate module="provider" action="approve">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Provider Approval</h1>
            <p className="text-gray-600">Review and approve provider registrations</p>
          </div>
          <Button 
            onClick={() => router.push("/providers")} 
            variant="outline"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Back to Providers
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Pending Approval"
            value={metrics.total_pending}
            icon={Clock}
            trend={{ value: 0, isPositive: true }}
            description="awaiting review"
          />
          <MetricCard
            title="Approved Today"
            value={metrics.total_approved_today}
            icon={CheckCircle}
            trend={{ value: 0, isPositive: true }}
            description="vs yesterday"
          />
          <MetricCard
            title="Rejected Today"
            value={metrics.total_rejected_today}
            icon={XCircle}
            trend={{ value: 0, isPositive: false }}
            description="vs yesterday"
          />
          <MetricCard
            title="Avg Processing Time"
            value={`${metrics.avg_processing_time}h`}
            icon={Clock}
            trend={{ value: 0, isPositive: true }}
            description="to process"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search Providers</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="search"
                    placeholder="Search by facility name, HCP code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={selectedStatus} onValueChange={(value) => {
                  setSelectedStatus(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleFilterChange} className="w-full bg-[#0891B2] hover:bg-[#9B1219] text-white">
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Providers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Providers</CardTitle>
            <CardDescription className="mt-2">
              {pagination?.total || 0} providers found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading providers...</p>
                </div>
              </div>
            ) : providers.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No providers found</h3>
                <p className="text-gray-600">No providers match your current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">FACILITY NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">HCP CODE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CONTACT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CREATED</TableHead>
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
                              <div className="text-sm text-gray-500">{provider.address}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{provider.hcp_code}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {typeof provider.facility_type === 'string' ? provider.facility_type.replace(/_/g, ' ') : provider.facility_type || '---'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="text-gray-900">{provider.phone_whatsapp}</div>
                            <div className="text-gray-500">{provider.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(provider.status)}>
                            {provider.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(provider.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
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
                                  onClick={() => handleViewProvider(provider)}
                                  className="w-full justify-start text-xs"
                                >
                                  View Details
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
                                    className="text-orange-600 w-full justify-start text-xs"
                                  >
                                    Suspend
                                  </DropdownMenuItem>
                                </PermissionGate>
                              )}
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
                    <div className="text-sm text-gray-700">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={pagination.page <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Provider Modal */}
        {showViewModal && selectedProvider && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Provider Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowViewModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {selectedProvider.facility_name} - {selectedProvider.hcp_code}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Facility Name</Label>
                        <p className="text-sm font-medium">{selectedProvider.facility_name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">HCP Code</Label>
                        <p className="text-sm">{selectedProvider.hcp_code}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Facility Type</Label>
                        <p className="text-sm">{typeof selectedProvider.facility_type === 'string' ? selectedProvider.facility_type.replace(/_/g, ' ') : selectedProvider.facility_type || '---'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Year of Incorporation</Label>
                        <p className="text-sm">{selectedProvider.year_of_incorporation}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Registration Number</Label>
                        <p className="text-sm">{selectedProvider.facility_reg_number}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Status</Label>
                        <Badge className={getStatusBadgeColor(selectedProvider.status)}>
                          {selectedProvider.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Address</Label>
                        <p className="text-sm">{selectedProvider.address}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Phone/WhatsApp</Label>
                        <p className="text-sm">{selectedProvider.phone_whatsapp}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Email</Label>
                        <p className="text-sm">{selectedProvider.email}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Medical Director</Label>
                        <p className="text-sm">{selectedProvider.medical_director_name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">HMO Coordinator</Label>
                        <p className="text-sm">{selectedProvider.hmo_coordinator_name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">HMO Coordinator Phone</Label>
                        <p className="text-sm">{selectedProvider.hmo_coordinator_phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Service Information */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Service Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Hours of Operation</Label>
                        <p className="text-sm">{selectedProvider.hours_of_operation}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Emergency Care</Label>
                        <p className="text-sm">{selectedProvider.emergency_care_services}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Blood Bank Available</Label>
                        <p className="text-sm">{selectedProvider.blood_bank_available}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Radiology/Lab Services</Label>
                        <p className="text-sm">{selectedProvider.radiology_lab_services}</p>
                      </div>
                    </div>
                  </div>

                  {/* Banking Information */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Banking Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Account Name</Label>
                        <p className="text-sm">{selectedProvider.account_name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Account Number</Label>
                        <p className="text-sm">{selectedProvider.account_number}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Bank Name</Label>
                        <p className="text-sm">{selectedProvider.designation}</p>
                      </div>
                    </div>
                  </div>

                  {/* Approval Information - Note: These fields don't exist in current schema */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Status Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Current Status</Label>
                        <Badge className={getStatusBadgeColor(selectedProvider.status)}>
                          {selectedProvider.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
                        <p className="text-sm">{new Date(selectedProvider.updated_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Attachments */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Attachments</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: 'cac', label: 'CAC Registration', url: selectedProvider.cac_registration_url },
                        { key: 'nhis', label: 'NHIS Accreditation', url: selectedProvider.nhis_accreditation_url },
                        { key: 'indemnity', label: 'Professional Indemnity', url: selectedProvider.professional_indemnity_url },
                        { key: 'state', label: 'State Facility Registration', url: selectedProvider.state_facility_registration_url },
                        { key: 'others', label: 'Others', url: selectedProvider.others_attachment_url },
                      ].map((doc) => (
                        <div key={doc.key} className="border rounded-md p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm truncate">{doc.label}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!doc.url}
                            onClick={() => handleViewAttachment(doc.label, doc.url)}
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      {isStagingHost
                        ? "Attachments open in preview modal on staging."
                        : "Attachments open in a new tab on production."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Attachment Preview Modal (staging only) */}
        {attachmentPreview && isStagingHost && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <Card className="w-full max-w-5xl h-[85vh] mx-4 flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Attachment Preview: {attachmentPreview.title}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAttachmentPreview(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {/(\.png|\.jpg|\.jpeg|\.gif|\.webp)(\?|$)/i.test(attachmentPreview.url) ? (
                  <div className="h-full overflow-auto rounded border bg-gray-50 p-4">
                    <img
                      src={attachmentPreview.url}
                      alt={attachmentPreview.title}
                      className="max-w-full h-auto mx-auto"
                    />
                  </div>
                ) : (
                  <iframe
                    src={attachmentPreview.url}
                    title={attachmentPreview.title}
                    className="w-full h-full rounded border"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

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
                  {approvalAction === "approve" && (
                    <BandSelector
                      selectedBands={selectedBands}
                      onBandsChange={setSelectedBands}
                      className="mb-4"
                    />
                  )}
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
