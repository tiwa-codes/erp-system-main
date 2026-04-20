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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  MoreVertical,
  MoreHorizontal,
  X,
  Upload
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"
import {


  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Claim {
  id: string
  claim_number: string
  enrollee_id: string
  principal_id?: string
  principal?: {
    id: string
    first_name: string
    last_name: string
    enrollee_id: string
  }
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string[]
  }
  claim_type: string
  amount: number
  status: string
  submitted_at: string
  processed_at?: string
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
}

interface ClaimsMetrics {
  total_claims: number
  pending_claims: number
  vetted_claims: number
  flagged_claims: number
  total_amount: number
  approval_rate: number
}

export default function ClaimsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)

  // Bulk upload state
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch claims data
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["claims", currentPage, limit, debouncedSearchTerm, selectedStatus, selectedProvider, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })
      
      const res = await fetch(`/api/claims?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claims")
      }
      return res.json()
    },
  })

  // Fetch metrics
  const { data: metricsData } = useQuery({
    queryKey: ["claims-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/claims/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch metrics")
      }
      return res.json()
    },
  })

  // Fetch providers for filter
  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers")
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  const claims: Claim[] = claimsData?.claims || []
  const pagination = claimsData?.pagination
  const metrics = metricsData?.metrics || {
    total_claims: 0,
    pending_claims: 0,
    vetted_claims: 0,
    flagged_claims: 0,
    total_amount: 0,
    approval_rate: 0
  }

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })
      
      const res = await fetch(`/api/claims/export?${params}`)
      if (!res.ok) {
        throw new Error("Failed to export claims")
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `claims-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Success",
        description: "Claims exported successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export claims",
        variant: "destructive",
      })
    }
  }

  // Handle process claim
  const handleProcessClaim = (claim: Claim) => {
    setSelectedClaim(claim)
    setShowProcessModal(true)
  }

  // Handle bulk upload
  const handleBulkUpload = () => {
    setShowBulkUploadModal(true)
  }

  const handleBulkUploadSuccess = (data: any[]) => {
    toast({
      title: "Bulk Upload Successful",
      description: `${data.length} claims uploaded successfully`,
    })
    queryClient.invalidateQueries({ queryKey: ["claims"] })
    setShowBulkUploadModal(false)
  }

  // Handle submit claims request
  const handleSubmitClaimsRequest = async () => {
    if (!selectedClaim) return

    try {
      const response = await fetch('/api/claims/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvalCodeId: selectedClaim.id,
          enrolleeId: selectedClaim.enrollee_id,
          providerId: selectedClaim.provider_id,
          amount: selectedClaim.amount
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Claims Request Submitted",
          description: "Claims request has been submitted successfully and will appear as Pending",
        })
        setShowProcessModal(false)
        setSelectedClaim(null)
        queryClient.invalidateQueries({ queryKey: ["claims"] })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to submit claims request",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error submitting claims request:', error)
      toast({
        title: "Error",
        description: "Failed to submit claims request",
        variant: "destructive",
      })
    }
  }

  // Get status text color
  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'text-gray-600'
    
    switch (status.toLowerCase()) {
      case 'new':
        return 'text-orange-600'
      case 'submitted':
      case 'under_review':
        return 'text-yellow-600'
      case 'vetting':
        return 'text-blue-600'
      case 'approved':
        return 'text-green-600'
      case 'rejected':
        return 'text-red-600'
      case 'paid':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  // Get action dropdown - horizontal dropdown icon
  const getActionDropdown = (claim: Claim) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {claim.status === 'NEW' ? (
            <DropdownMenuItem 
              onClick={() => handleProcessClaim(claim)}
              className="w-full justify-start text-xs"
            >
              Process
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem 
                onClick={() => router.push(`/claims/details/${claim.id}`)}
                className="w-full justify-start text-xs"
              >
                View Details
              </DropdownMenuItem>
              {claim.status.toLowerCase() === 'submitted' || claim.status.toLowerCase() === 'under_review' || claim.status.toLowerCase() === 'pending' ? (
                <DropdownMenuItem 
                  onClick={() => router.push(`/claims/vetter/${claim.id}`)}
                  className="w-full justify-start text-xs"
                >
                  Start Vetting
                </DropdownMenuItem>
              ) : null}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <PermissionGate module="claims" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Claims</h1>
            <p className="text-gray-600">Manage and process insurance claims</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Claim Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Provider</label>
                <Select value={selectedProvider} onValueChange={(value) => {
                  setSelectedProvider(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providersData?.providers?.map((provider: any) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.facility_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Claim Status</label>
                <Select value={selectedStatus} onValueChange={(value) => {
                  setSelectedStatus(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="VETTING">Vetting</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search claims..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Claims</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.total_claims}</p>
                  <p className="text-sm text-green-600">+12% from last month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Claims</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.pending_claims}</p>
                  <p className="text-sm text-gray-600">Requires attention</p>
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
                  <p className="text-sm font-medium text-gray-600">Vetted</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.vetted_claims}</p>
                  <p className="text-sm text-green-600">{metrics.approval_rate}% approval rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Flag Off</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.flagged_claims}</p>
                  <p className="text-sm text-red-600">5.5% AI Fraud Detect</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claims Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Claims Overview</CardTitle>
                <CardDescription className="mt-2">Manage and track all claims</CardDescription>
              </div>
              <div className="flex gap-2">
                <PermissionGate module="claims" action="add">
                  <Button 
                    onClick={handleBulkUpload}
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Upload
                  </Button>
                </PermissionGate>
                <PermissionGate module="claims" action="view">
                  <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700">
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </PermissionGate>
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
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CLAIM ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((claim: Claim) => (
                      <TableRow key={claim.id}>
                        <TableCell>
                          {new Date(claim.submitted_at).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {claim.claim_number}
                        </TableCell>
                        <TableCell>
                          {claim.provider.facility_name}
                        </TableCell>
                        <TableCell>
                          ₦{claim.amount.toLocaleString()}
                        </TableCell>
                <TableCell>
                  <span className={`${getStatusBadgeColor(claim.status)} text-xs`}>
                    {claim.status === 'NEW' ? 'New' :
                     claim.status === 'SUBMITTED' ? 'Pending' : 
                     claim.status === 'REJECTED' ? 'Rejected' :
                     claim.status === 'VETTING' ? 'Vetted' :
                     claim.status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </TableCell>
                        <TableCell>
                          {getActionDropdown(claim)}
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

        {/* Process Claims Modal */}
        {showProcessModal && selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-blue-600">Request Claims</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowProcessModal(false)
                      setSelectedClaim(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Approval Code</label>
                    <p className="text-sm font-semibold">{selectedClaim.claim_number}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Enrollee</label>
                    <p className="text-sm font-semibold">
                      {selectedClaim.principal ? 
                        `${selectedClaim.principal.first_name} ${selectedClaim.principal.last_name} (${selectedClaim.principal.enrollee_id})` : 
                        selectedClaim.enrollee_id
                      }
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Provider</label>
                    <p className="text-sm font-semibold">{selectedClaim.provider?.facility_name}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Amount</label>
                    <p className="text-sm font-semibold text-green-600">₦{selectedClaim.amount.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> Clicking "Request Claims" will submit this approval code for claims processing. 
                      The claim will appear in the claims module with "Pending" status.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowProcessModal(false)
                    setSelectedClaim(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitClaimsRequest}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  Request Claims
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        module="claims"
        onUploadSuccess={handleBulkUploadSuccess}
        uploadEndpoint="/api/claims/bulk-upload"
        sampleFileName="claims-sample.xlsx"
        acceptedColumns={[
          "claim_number",
          "enrollee_id",
          "provider_id",
          "amount",
          "diagnosis",
          "services",
          "submitted_at"
        ]}
      />
    </PermissionGate>
  )
}
