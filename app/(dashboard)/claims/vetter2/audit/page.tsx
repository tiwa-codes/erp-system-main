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
  Search, 
  Filter, 
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
  X,
  Download
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import {

export const dynamic = 'force-dynamic'
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
  vetting_records?: {
    id: string
    vetter: {
      id: string
      first_name: string
      last_name: string
      email: string
    }
    comments?: string
    completed_at: string
  }[]
}

interface AuditMetrics {
  total_audited: number
  pending_audit: number
  flagged_claims: number
  avg_audit_time: number
  total_amount: number
  approved_amount: number
  rejected_amount: number
  net_amount: number
}

export default function AuditPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch claims data for audit
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["audit-claims", currentPage, limit, debouncedSearchTerm, selectedStatus, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
      })
      
      const res = await fetch(`/api/claims/audit?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claims")
      }
      return res.json()
    },
  })

  // Fetch audit metrics
  const { data: metricsData } = useQuery({
    queryKey: ["audit-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/claims/audit/metrics")
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

  const claims = claimsData?.claims || []
  const pagination = claimsData?.pagination
  const metrics = metricsData?.metrics || {
    total_audited: 0,
    pending_audit: 0,
    flagged_claims: 0,
    avg_audit_time: 0,
    total_amount: 0,
    approved_amount: 0,
    rejected_amount: 0,
    net_amount: 0
  }

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Get status text color
  const getStatusTextColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'submitted':
      case 'under_review':
        return 'text-yellow-600'
      case 'vetting':
        return 'text-blue-600'
      case 'approved':
        return 'text-green-600'
      case 'rejected':
        return 'text-red-600'
      case 'audited':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  // Handle action clicks
  const handleViewClaim = async (claim: Claim) => {
    try {
      // Fetch detailed claim information including vetting records
      const res = await fetch(`/api/claims/${claim.id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedClaim(data.claim)
        setShowViewModal(true)
      } else {
        // Fallback to basic claim info
        setSelectedClaim(claim)
        setShowViewModal(true)
      }
    } catch (error) {
      console.error('Error fetching claim details:', error)
      // Fallback to basic claim info
      setSelectedClaim(claim)
      setShowViewModal(true)
    }
  }

  const handleAuditClaim = (claim: Claim) => {
    router.push(`/claims/audit-claim/${claim.id}`)
  }

  const handleReviewClaim = async (claim: Claim) => {
    try {
      // Fetch detailed claim information including vetting records
      const res = await fetch(`/api/claims/${claim.id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedClaim(data.claim)
        setShowReviewModal(true)
      } else {
        // Fallback to basic claim info
        setSelectedClaim(claim)
        setShowReviewModal(true)
      }
    } catch (error) {
      console.error('Error fetching claim details:', error)
      // Fallback to basic claim info
      setSelectedClaim(claim)
      setShowReviewModal(true)
    }
  }

  // Get action dropdown
  const getActionDropdown = (claim: Claim) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => router.push(`/claims/audit-detail/${claim.provider_id}`)}>
            View Enrollees
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAuditClaim(claim)}>
            Audit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleReviewClaim(claim)}>
            Review
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <PermissionGate module="claims" action="audit">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit</h1>
            <p className="text-gray-600">Audit claims and review vetting results</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Claim Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <SelectItem value="AUDITED">Audited</SelectItem>
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
                  <p className="text-2xl font-bold text-gray-900">{metrics.total_audited}</p>
                  <p className="text-sm text-green-600">₦{metrics.total_amount.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{metrics.pending_audit}</p>
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
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.total_audited}</p>
                  <p className="text-sm text-green-600">₦{metrics.approved_amount.toLocaleString()}</p>
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
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.flagged_claims}</p>
                  <p className="text-sm text-red-600">₦{metrics.rejected_amount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Net Amount Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Net Amount (After Rejections)</p>
                  <p className="text-3xl font-bold text-blue-600">₦{metrics.net_amount.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Total - Rejected = Net</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total: ₦{metrics.total_amount.toLocaleString()}</p>
                <p className="text-sm text-red-600">Rejected: ₦{metrics.rejected_amount.toLocaleString()}</p>
                <p className="text-sm text-green-600">Approved: ₦{metrics.approved_amount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claims Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Audit Overview {'>>'} {selectedProvider !== "all" ? 
                  providersData?.providers?.find((p: any) => p.id === selectedProvider)?.facility_name || "All Providers" : 
                  "All Providers"
                }</CardTitle>
                <CardDescription className="mt-2">Claims ready for audit</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button className="bg-green-600 hover:bg-green-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button className="bg-red-600 hover:bg-red-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
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
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">FACILITY TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TOTAL CLAIMS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PENDING</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">VETTED</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REJECTED</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TOTAL AMOUNT</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((claim: any) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-medium">
                          {claim.provider?.facility_name}
                        </TableCell>
                        <TableCell>
                          {claim.provider?.facility_type?.join(', ') || 'General'}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold">12</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-yellow-600">3</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-green-600">7</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-red-600">2</span>
                        </TableCell>
                        <TableCell>
                          ₦{claim.amount.toLocaleString()}
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

        {/* View Claim Modal */}
        {showViewModal && selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-blue-600">Audit Details {'>>'} {selectedClaim.principal ? 
                      `${selectedClaim.principal.first_name} ${selectedClaim.principal.last_name}` : 
                      selectedClaim.enrollee_id
                    }</h2>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowViewModal(false)
                      setSelectedClaim(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Claim Details Section */}
              <div className="px-6 py-4 border-b">
                <div className="grid grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Approval Code:</span>
                      <span className="text-sm font-semibold">{selectedClaim.claim_number || 'APR/2025/07/23'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Date of Claim:</span>
                      <span className="text-sm font-semibold">{new Date(selectedClaim.submitted_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Service Type:</span>
                      <span className="text-sm font-semibold">{selectedClaim.claim_type || 'Consultation'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Amount:</span>
                      <span className="text-sm font-semibold text-green-600">₦{selectedClaim.amount?.toLocaleString() || '4,000'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Status:</span>
                      <Badge className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                        Vetted
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Price Limit Used:</span>
                      <span className="text-sm font-semibold text-green-600">₦430,500</span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Enrollee:</span>
                      <span className="text-sm font-semibold">{selectedClaim.principal ? 
                        `${selectedClaim.principal.first_name} ${selectedClaim.principal.last_name} (${selectedClaim.principal.enrollee_id})` : 
                        `${selectedClaim.enrollee_id}`
                      }</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Provider:</span>
                      <span className="text-sm font-semibold">{selectedClaim.provider?.facility_name || 'Limi Hospital'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Band:</span>
                      <span className="text-sm font-semibold">Band B</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Plan:</span>
                      <span className="text-sm font-semibold">Gold SME</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Date of Service:</span>
                      <span className="text-sm font-semibold">{new Date(selectedClaim.submitted_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Price Limit Remaining:</span>
                      <span className="text-sm font-semibold text-green-600">₦570,500</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Claim Description Section */}
              <div className="px-6 py-4 border-b">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-blue-600 underline">Claim Description</span>
                    <p className="text-sm text-gray-700 mt-1">
                      Patient treated for Malaria with full blood test and consultation.
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-blue-600 underline">Investigation Note:</span>
                    <p className="text-sm text-gray-700 mt-1">Cleared</p>
                  </div>
                </div>
              </div>

              {/* Audit Information Section */}
              <div className="px-6 py-4">
                <div className="flex justify-end">
                  <div className="text-right space-y-1">
                    {selectedClaim.vetting_records && selectedClaim.vetting_records.length > 0 ? (
                      <>
                        <p className="text-sm text-gray-600">
                          Vetted by {selectedClaim.vetting_records[0].vetter.first_name} {selectedClaim.vetting_records[0].vetter.last_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Comment: {selectedClaim.vetting_records[0].comments || 'No comments provided'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">Not yet vetted</p>
                        <p className="text-sm text-gray-600">Comment: Pending vetting</p>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-start mt-4">
                  <Button 
                    className="bg-[#BE1522] hover:bg-[#9B1219] text-white px-6 py-2"
                    onClick={() => {
                      setShowViewModal(false)
                      setSelectedClaim(null)
                    }}
                  >
                    Audit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Review Claim Modal */}
        {showReviewModal && selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-blue-600">Review Claim</h2>
                  <p className="text-blue-600">Claim Details {'>>'} {selectedClaim.principal ? 
                    `${selectedClaim.principal.first_name} ${selectedClaim.principal.last_name}` : 
                    selectedClaim.enrollee_id
                  }</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowReviewModal(false)
                    setSelectedClaim(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Review Form */}
              <div className="space-y-6">
                {/* Claim Information */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Claim Number</label>
                    <p className="text-lg font-semibold">{selectedClaim.claim_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Amount</label>
                    <p className="text-lg font-semibold text-green-600">₦{selectedClaim.amount?.toLocaleString()}</p>
                  </div>
                </div>

                {/* Vetting Information */}
                {selectedClaim.vetting_records && selectedClaim.vetting_records.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-600">Vetting Information</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Vetted by</label>
                          <p className="text-sm font-semibold">
                            {selectedClaim.vetting_records[0].vetter.first_name} {selectedClaim.vetting_records[0].vetter.last_name}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Vetting Date</label>
                          <p className="text-sm font-semibold">
                            {new Date(selectedClaim.vetting_records[0].completed_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="text-sm font-medium text-gray-600">Vetting Comments</label>
                        <p className="text-sm text-gray-700 mt-1">
                          {selectedClaim.vetting_records[0].comments || 'No comments provided'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Review Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-600">Review Details</h3>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Review Type</label>
                    <select className="w-full mt-2 p-3 border rounded-lg">
                      <option value="">Select review type</option>
                      <option value="quality">Quality Review</option>
                      <option value="compliance">Compliance Review</option>
                      <option value="financial">Financial Review</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Review Notes</label>
                    <textarea 
                      className="w-full mt-2 p-3 border rounded-lg"
                      rows={4}
                      placeholder="Add review notes here..."
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowReviewModal(false)
                      setSelectedClaim(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-2"
                    onClick={() => {
                      toast({
                        title: "Success",
                        description: "Review completed successfully",
                      })
                      setShowReviewModal(false)
                      setSelectedClaim(null)
                    }}
                  >
                    Complete Review
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
