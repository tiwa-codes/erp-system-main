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
  MoreVertical,
  X,
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
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
}

interface VettingMetrics {
  total_pending: number
  total_vetted: number
  total_flagged: number
  avg_processing_time: number
  total_amount: number
  approved_amount: number
  rejected_amount: number
  net_amount: number
}

export default function VetterPage() {
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
  const [showInvestigateModal, setShowInvestigateModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch claims data for vetting
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["vetter-claims", currentPage, limit, debouncedSearchTerm, selectedStatus, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
      })
      
      const res = await fetch(`/api/executive-desk/vetting?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claims")
      }
      return res.json()
    },
  })

  // Fetch vetting metrics
  const { data: metricsData } = useQuery({
    queryKey: ["vetter-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/executive-desk/vetting/metrics")
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
    total_pending: 0,
    total_vetted: 0,
    total_flagged: 0,
    avg_processing_time: 0,
    total_amount: 0,
    approved_amount: 0,
    rejected_amount: 0,
    net_amount: 0
  }

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle vet all claims
  const vetAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/executive-desk/vetting/vet-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) {
        throw new Error("Failed to vet all claims")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All claims have been queued for vetting",
      })
      queryClient.invalidateQueries({ queryKey: ["vetter-claims"] })
      queryClient.invalidateQueries({ queryKey: ["vetter-metrics"] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to vet all claims",
        variant: "destructive",
      })
    },
  })

  const handleVetAll = () => {
    if (window.confirm("Are you sure you want to vet all pending claims? This action cannot be undone.")) {
      vetAllMutation.mutate()
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'submitted':
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'vetting':
        return 'bg-blue-100 text-blue-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'flagged':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Handle action clicks
  const handleViewClaim = (claim: Claim) => {
    setSelectedClaim(claim)
    setShowViewModal(true)
  }

  const handleVetClaim = (claim: Claim) => {
    router.push(`/executive-desk/vetting/${claim.id}`)
  }

  const handleInvestigateClaim = (claim: Claim) => {
    if (claim.status !== 'FLAGGED') {
      toast({
        title: "Error",
        description: "This claim is not flagged and cannot be investigated",
        variant: "destructive",
      })
      return
    }
    setSelectedClaim(claim)
    setShowInvestigateModal(true)
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
          <DropdownMenuItem onClick={() => handleViewClaim(claim)}>
            View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleVetClaim(claim)}>
            Vet
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleInvestigateClaim(claim)}
            className={claim.status !== 'FLAGGED' ? 'text-gray-400 cursor-not-allowed' : ''}
          >
            Investigate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <PermissionGate module="claims" action="vet">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vetter</h1>
            <p className="text-gray-600">Manual vetting and smart-assisted claim validation</p>
          </div>
          <PermissionGate module="claims" action="vet">
            <Button 
              onClick={handleVetAll}
              disabled={vetAllMutation.isPending}
              className="bg-[#BE1522] hover:bg-[#9B1219] px-6 py-2"
            >
              {vetAllMutation.isPending ? "Processing..." : "Vet All Claims"}
            </Button>
          </PermissionGate>
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
                    <SelectItem value="FLAGGED">Flagged</SelectItem>
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
                  <p className="text-2xl font-bold text-gray-900">{metrics.total_pending + metrics.total_vetted + metrics.total_flagged}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{metrics.total_pending}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{metrics.total_vetted}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{metrics.total_flagged}</p>
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
                <CardTitle>Claims Overview {'>>'} {selectedProvider !== "all" ? 
                  providersData?.providers?.find((p: any) => p.id === selectedProvider)?.facility_name || "All Providers" : 
                  "All Providers"
                }</CardTitle>
                <CardDescription className="mt-2">Claims ready for vetting</CardDescription>
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
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">APPROVAL CODE</TableHead>
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
                        <TableCell>
                          {claim.principal ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-red-400">
                                  {claim.principal.first_name?.[0]}{claim.principal.last_name?.[0]}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {claim.principal.first_name} {claim.principal.last_name}
                                </div>
                              </div>
                            </div>
                          ) : (
                            claim.enrollee_id
                          )}
                        </TableCell>
                        <TableCell>
                          {claim.principal?.enrollee_id || claim.enrollee_id}
                        </TableCell>
                        <TableCell>
                          {claim.claim_type}
                        </TableCell>
                        <TableCell className="font-medium">
                          {claim.claim_number}
                        </TableCell>
                        <TableCell>
                          ₦{claim.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className={`${getStatusBadgeColor(claim.status)} text-xs`}>
                            {claim.status === 'SUBMITTED' ? 'Pending' : 
                             claim.status === 'REJECTED' ? 'Rejected' :
                             claim.status === 'VETTING' ? 'Vetted' :
                             claim.status === 'FLAGGED' ? 'Flagged' :
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

        {/* View Claim Modal */}
        {showViewModal && selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-blue-600">Claim Details</h2>
                  <p className="text-blue-600">Claim Details {'>>'} {selectedClaim.principal ? 
                    `${selectedClaim.principal.first_name} ${selectedClaim.principal.last_name}` : 
                    selectedClaim.enrollee_id
                  }</p>
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

              {/* Claim Details Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-blue-600 mb-4">Claim Details</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Approval Code</label>
                      <p className="text-lg font-semibold">{selectedClaim.claim_number || 'APR/2025/07/23'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date of Claim</label>
                      <p className="text-lg">{new Date(selectedClaim.submitted_at).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Service Type</label>
                      <p className="text-lg">{selectedClaim.claim_type || 'Consultation'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Amount</label>
                      <p className="text-lg font-semibold text-green-600">₦{selectedClaim.amount?.toLocaleString() || '4,000'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Pending
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Price Limit Used</label>
                      <p className="text-lg font-semibold text-green-600">₦430,500</p>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Enrollee</label>
                      <p className="text-lg">{selectedClaim.principal ? 
                        `${selectedClaim.principal.first_name} ${selectedClaim.principal.last_name} (${selectedClaim.principal.enrollee_id})` : 
                        `${selectedClaim.enrollee_id}`
                      }</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Provider</label>
                      <p className="text-lg">{selectedClaim.provider?.facility_name || 'Limi Hospital'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Band</label>
                      <p className="text-lg">Band C</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Plan</label>
                      <p className="text-lg">Gold SME</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date of Service</label>
                      <p className="text-lg">{new Date(selectedClaim.submitted_at).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Price Limit Remaining</label>
                      <p className="text-lg font-semibold text-green-600">₦570,500</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Claim Description Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-blue-600 mb-2">Claim Description</h3>
                <p className="text-gray-700">
                  Patient treated for Malaria with full blood test and consultation.
                </p>
              </div>

              {/* Investigation Note Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-blue-600 mb-2">Investigation Note:</h3>
                <p className="text-gray-700">Cleared</p>
              </div>

              {/* Action Button */}
              <div className="flex justify-center">
                <Button 
                  className="bg-[#BE1522] hover:bg-[#9B1219] text-white px-8 py-2"
                  onClick={() => {
                    setShowViewModal(false)
                    setSelectedClaim(null)
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}


        {/* Investigate Claim Modal */}
        {showInvestigateModal && selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-blue-600">Investigation Workspace</h2>
                  <p className="text-blue-600">Claim Details {'>>'} {selectedClaim.principal ? 
                    `${selectedClaim.principal.first_name} ${selectedClaim.principal.last_name}` : 
                    selectedClaim.enrollee_id
                  }</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowInvestigateModal(false)
                    setSelectedClaim(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Investigation Form */}
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

                {/* Investigation Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-600">Investigation Details</h3>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Investigation Type</label>
                    <select className="w-full mt-2 p-3 border rounded-lg">
                      <option value="">Select investigation type</option>
                      <option value="fraud">Fraud Investigation</option>
                      <option value="medical">Medical Review</option>
                      <option value="provider">Provider Audit</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Investigation Notes</label>
                    <textarea 
                      className="w-full mt-2 p-3 border rounded-lg"
                      rows={4}
                      placeholder="Add investigation notes here..."
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowInvestigateModal(false)
                      setSelectedClaim(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-2"
                    onClick={() => {
                      toast({
                        title: "Success",
                        description: "Investigation completed successfully",
                      })
                      setShowInvestigateModal(false)
                      setSelectedClaim(null)
                    }}
                  >
                    Complete Investigation
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
