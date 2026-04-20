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
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  MoreHorizontal,
  Upload,
  Copy
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { MetricCard } from "@/components/ui/metric-card"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"



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
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Bulk upload state
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch providers
  const { data: providersData, isLoading } = useQuery({
    queryKey: ["providers", currentPage, limit, debouncedSearchTerm, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
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

  const handleBulkUpload = () => {
    setShowBulkUploadModal(true)
  }

  const handleBulkUploadSuccess = (data: any[]) => {
    toast({
      title: "Bulk Upload Successful",
      description: `${data.length} providers uploaded successfully`,
    })
    queryClient.invalidateQueries({ queryKey: ["providers"] })
    queryClient.invalidateQueries({ queryKey: ["provider-metrics"] })
    setShowBulkUploadModal(false)
  }

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle export
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params = new URLSearchParams({
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
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

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Provider Management</h1>
            <p className="text-gray-600">Manage healthcare providers and facilities</p>
          </div>
          <div className="flex items-center gap-4">
            <PermissionGate module="provider" action="add">
              <Button
                variant="outline"
                onClick={handleBulkUpload}
              >
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
            </PermissionGate>
            <PermissionGate module="provider" action="add">
              <Button onClick={() => router.push("/provider/add")} className="bg-[#0891B2] hover:bg-[#9B1219]">
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </PermissionGate>
            <PermissionGate module="providers" action="view">
              <Button onClick={handleCopyLink} className="bg-green-600 hover:bg-green-700 text-white">
                <Copy className="h-4 w-4 mr-2" />
                Copy Public Link
              </Button>
            </PermissionGate>
          </div>
        </div>

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
                <Button onClick={handleFilterChange} className="bg-[#0891B2] hover:bg-[#9B1219]">
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
                      <TableHead className="text-xs font-medium text-gray-600">PHONE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">EMAIL</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CLAIMS</TableHead>
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
                              <PermissionGate module="provider" action="view" fallback={
                                <div className="font-medium text-gray-900">{provider.facility_name}</div>
                              }>
                                <button
                                  type="button"
                                  onClick={() => router.push(`/provider/${provider.id}`)}
                                  className="font-medium text-gray-900 hover:underline text-left"
                                >
                                  {provider.facility_name}
                                </button>
                              </PermissionGate>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{provider.phone_whatsapp || "---"}</TableCell>
                        <TableCell>{provider.email || "---"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(provider.status)}>
                            {provider.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{provider._count?.claims || 0}</TableCell>
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
                              <PermissionGate module="provider" action="delete">
                                <DropdownMenuItem
                                  onClick={() => handleDeleteProvider(provider.id, provider.facility_name)}
                                  className="text-red-600 w-full justify-start text-xs"
                                >
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

        {/* Bulk Upload Modal */}
        <BulkUploadModal
          isOpen={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          module="provider"
          submodule="providers"
          onUploadSuccess={handleBulkUploadSuccess}
          uploadEndpoint="/api/provider/bulk-upload"
          sampleFileName="providers-sample.xlsx"
          acceptedColumns={[
            "facility_name",
            "email",
            "band",
            "partnership_interest",
            "address",
            "phone_whatsapp",
            "medical_director_name",
            "hmo_coordinator_name",
            "hmo_coordinator_phone",
            "hmo_coordinator_email",
            "year_of_incorporation",
            "facility_reg_number",
            "practice",
            "proprietor_partners",
            "hcp_code",
            "hours_of_operation",
            "other_branches",
            "emergency_care_services",
            "facility_type",
            "personnel_licensed",
            "blood_bank_available",
            "blood_sourcing_method",
            "radiology_lab_services",
            "other_services",
            "account_name",
            "account_number",
            "designation",
            "date",
            "cac_registration_url",
            "nhis_accreditation_url",
            "professional_indemnity_url",
            "state_facility_registration_url"
          ]}
          requiredColumns={["facility_name", "email", "band"]}
        />
      </div>
    </PermissionGate>
  )
}
