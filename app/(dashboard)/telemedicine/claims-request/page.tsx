"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Search, 
  Filter, 
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  TestTube,
  Scan,
  Pill,
  X,
  Loader2,
  Calendar,
  User,
  Phone,
  Building2
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

export const dynamic = 'force-dynamic'

interface TelemedicineClaim {
  id: string
  claim_number: string
  claim_type: string
  amount: number
  status: string
  description: string
  created_at: string
  principal: {
    id: string
    enrollee_id: string
    first_name: string
    last_name: string
    phone_number?: string
    email?: string
  } | null
  enrollee?: {
    id: string
    enrollee_id: string
    first_name: string
    last_name: string
    phone_number?: string
    email?: string
  } | null
  provider?: {
    id: string
    facility_name: string
    facility_type: string
  }
}

interface ClaimsStats {
  NEW?: number
  PENDING?: number
  APPROVED?: number
  REJECTED?: number
  PAID?: number
}

export default function TelemedicineClaimsRequestPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // State for modals
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<TelemedicineClaim | null>(null)

  // Fetch claims
  const { data: claimsData, isLoading, refetch } = useQuery({
    queryKey: ["telemedicine-claims", currentPage, limit, searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && statusFilter !== "all" && { status: statusFilter }),
      })
      
      const res = await fetch(`/api/telemedicine/claims-request?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claims")
      }
      return res.json()
    },
  })

  const claims = claimsData?.claims || []
  const pagination = claimsData?.pagination
  const stats = claimsData?.stats || {}

  // Request claim mutation
  const requestClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const res = await fetch(`/api/telemedicine/claims-request/${claimId}/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to request claim")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Claim Requested Successfully",
        description: "The claim has been sent to vetter1 for processing.",
      })
      refetch()
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  const handleViewClick = (claim: TelemedicineClaim) => {
    setSelectedClaim(claim)
    setShowViewModal(true)
  }

  const handleRequestClaim = (claimId: string) => {
    requestClaimMutation.mutate(claimId)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'PAID':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getClaimTypeIcon = (type: string) => {
    switch (type) {
      case 'TELEMEDICINE_LAB':
        return <TestTube className="h-4 w-4 text-blue-600" />
      case 'TELEMEDICINE_RADIOLOGY':
        return <Scan className="h-4 w-4 text-green-600" />
      case 'TELEMEDICINE_PHARMACY':
        return <Pill className="h-4 w-4 text-purple-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const getClaimTypeLabel = (type: string) => {
    switch (type) {
      case 'TELEMEDICINE_LAB':
        return 'Lab Test'
      case 'TELEMEDICINE_RADIOLOGY':
        return 'Radiology'
      case 'TELEMEDICINE_PHARMACY':
        return 'Pharmacy'
      default:
        return type
    }
  }

  return (
    <PermissionGate module="telemedicine" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Claims Request</h1>
            <p className="text-gray-600">Request telemedicine claims for vetter1 processing</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">New</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.NEW || 0}</p>
              <p className="text-xs text-gray-500">Ready to request</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium">Sent to Vetter1</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{stats.PENDING || 0}</p>
              <p className="text-xs text-gray-500">Under review</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Approved</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.APPROVED || 0}</p>
              <p className="text-xs text-gray-500">By vetter1</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Rejected</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.REJECTED || 0}</p>
              <p className="text-xs text-gray-500">By vetter1</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Paid</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{stats.PAID || 0}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </CardContent>
          </Card>
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
                <Label htmlFor="search">Search Claim Number</Label>
                <div className="relative">
                  <Input
                    id="search"
                    placeholder="Search by claim number"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_range">Date Range</Label>
                <Input
                  id="date_range"
                  type="date"
                  placeholder="Select date"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleFilterChange} className="bg-[#BE1522] hover:bg-[#9B1219]">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <CardTitle>Telemedicine Claims</CardTitle>
            <CardDescription>Manage and process telemedicine claims</CardDescription>
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
                      <TableHead className="text-xs font-medium text-gray-600">S/N</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CLAIM NUMBER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PATIENT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((claim: TelemedicineClaim, index: number) => (
                      <TableRow key={claim.id}>
                        <TableCell>{((currentPage - 1) * limit) + index + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{claim.claim_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getClaimTypeIcon(claim.claim_type)}
                            <span className="text-sm font-medium">{getClaimTypeLabel(claim.claim_type)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {claim.principal 
                                ? `${claim.principal.first_name} ${claim.principal.last_name}` 
                                : claim.enrollee 
                                  ? `${claim.enrollee.first_name} ${claim.enrollee.last_name}`
                                  : 'Unknown Patient'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {claim.principal?.enrollee_id || claim.enrollee?.enrollee_id || 'N/A'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {claim.amount && Number(claim.amount) > 0 
                            ? `₦${Number(claim.amount).toLocaleString()}` 
                            : <span className="text-gray-400 italic">No amount</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(claim.status)}>
                            {claim.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>{new Date(claim.created_at).toLocaleDateString('en-GB')}</span>
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
                              <DropdownMenuItem onClick={() => handleViewClick(claim)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {claim.status === 'NEW' && (
                                <PermissionGate module="telemedicine" action="edit">
                                  <DropdownMenuItem 
                                    onClick={() => handleRequestClaim(claim.id)}
                                    disabled={requestClaimMutation.isPending}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    {requestClaimMutation.isPending ? 'Requesting...' : 'Request Claims'}
                                  </DropdownMenuItem>
                                </PermissionGate>
                              )}
                              {claim.status === 'PENDING' && (
                                <DropdownMenuItem disabled>
                                  <Clock className="h-4 w-4 mr-2" />
                                  Sent to Vetter1
                                </DropdownMenuItem>
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

        {/* View Claim Details Modal */}
        {showViewModal && selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Claim Details</span>
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
                </CardTitle>
                <CardDescription>
                  Detailed information for claim {selectedClaim.claim_number}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Claim Information */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Claim Number</Label>
                      <p className="text-lg font-semibold font-mono">{selectedClaim.claim_number}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Claim Type</Label>
                      <div className="flex items-center gap-2 mt-1">
                        {getClaimTypeIcon(selectedClaim.claim_type)}
                        <span className="text-lg font-semibold">{getClaimTypeLabel(selectedClaim.claim_type)}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Amount</Label>
                      <p className="text-lg font-semibold text-green-600">
                        {selectedClaim.amount && Number(selectedClaim.amount) > 0 
                          ? `₦${Number(selectedClaim.amount).toLocaleString()}` 
                          : <span className="text-gray-400 italic">No amount set</span>}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Status</Label>
                      <div className="mt-1">
                        <Badge className={getStatusBadge(selectedClaim.status)}>
                          {selectedClaim.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Patient Information */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      Patient Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Patient Name</Label>
                        <p className="text-lg font-semibold">
                          {selectedClaim.principal 
                            ? `${selectedClaim.principal.first_name} ${selectedClaim.principal.last_name}` 
                            : selectedClaim.enrollee 
                              ? `${selectedClaim.enrollee.first_name} ${selectedClaim.enrollee.last_name}`
                              : 'Unknown Patient'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Enrollee ID</Label>
                        <p className="text-lg font-mono">{selectedClaim.principal?.enrollee_id || selectedClaim.enrollee?.enrollee_id || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Phone Number</Label>
                        <p className="text-lg">{selectedClaim.principal?.phone_number || selectedClaim.enrollee?.phone_number || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Email</Label>
                        <p className="text-lg">{selectedClaim.principal?.email || selectedClaim.enrollee?.email || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Provider Information */}
                  {selectedClaim.provider && (
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        Provider Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Facility Name</Label>
                          <p className="text-lg font-semibold">{selectedClaim.provider.facility_name}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Facility Type</Label>
                          <p className="text-lg">{selectedClaim.provider.facility_type}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      Description
                    </h3>
                    <p className="text-gray-700">{selectedClaim.description || 'No description provided'}</p>
                  </div>

                  {/* Timestamps */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      Timestamps
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Created Date</Label>
                        <p className="text-lg">{new Date(selectedClaim.created_at).toLocaleDateString('en-GB')} at {new Date(selectedClaim.created_at).toLocaleTimeString('en-GB')}</p>
                      </div>
                    </div>
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
