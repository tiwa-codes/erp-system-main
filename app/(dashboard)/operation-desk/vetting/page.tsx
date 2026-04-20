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
  DollarSign,
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
  services?: string
  diagnosis?: string
  hospital?: string
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

export default function OperationDeskVettingPage() {
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

  // Fetch claims data for audit vetting
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["operation-audit-vetting-claims", currentPage, limit, debouncedSearchTerm, selectedStatus, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
      })
      
      const res = await fetch(`/api/operation-desk/vetting?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claims")
      }
      return res.json()
    },
  })

  // Fetch vetting metrics for audit
  const { data: metricsData } = useQuery({
    queryKey: ["operation-audit-vetting-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/operation-desk/vetting/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch metrics")
      }
      return res.json()
    },
  })

  // Fetch providers for filter
  const { data: providersData } = useQuery({
    queryKey: ["operation-audit-vetting-providers"],
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
  const metrics: VettingMetrics = metricsData?.metrics || {
    total_pending: 0,
    total_vetted: 0,
    total_flagged: 0,
    avg_processing_time: 0,
    total_amount: 0,
    approved_amount: 0,
    rejected_amount: 0,
    net_amount: 0
  }

  // Handle vetting actions
  const vetClaimMutation = useMutation({
    mutationFn: async ({ claimId, action, findings }: { claimId: string, action: 'approve' | 'reject', findings?: string }) => {
      const res = await fetch(`/api/operation-desk/vetting/${claimId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, findings })
      })
      if (!res.ok) throw new Error('Failed to process claim')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-audit-vetting-claims"] })
      queryClient.invalidateQueries({ queryKey: ["operation-audit-vetting-metrics"] })
      toast({
        title: "Success",
        description: "Claim processed successfully",
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process claim",
        variant: "destructive",
      })
    }
  })

  const vetAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/operation-desk/vetting/vet-all', {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to vet all claims')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-audit-vetting-claims"] })
      queryClient.invalidateQueries({ queryKey: ["operation-audit-vetting-metrics"] })
      toast({
        title: "Success",
        description: "All claims processed successfully",
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process all claims",
        variant: "destructive",
      })
    }
  })

  const handleVetClaim = (claimId: string, action: 'approve' | 'reject') => {
    vetClaimMutation.mutate({ claimId, action })
  }

  const handleVetAll = () => {
    vetAllMutation.mutate()
  }

  const handleViewClaim = (claim: Claim) => {
    setSelectedClaim(claim)
    setShowViewModal(true)
  }

  const handleInvestigateClaim = (claim: Claim) => {
    setSelectedClaim(claim)
    setShowInvestigateModal(true)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      SUBMITTED: { color: "bg-blue-100 text-blue-800", icon: Clock },
      VETTING: { color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
      VETTER1_COMPLETED: { color: "bg-purple-100 text-purple-800", icon: CheckCircle },
      VETTER2_COMPLETED: { color: "bg-indigo-100 text-indigo-800", icon: CheckCircle },
      AUDIT_COMPLETED: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      APPROVED: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      REJECTED: { color: "bg-red-100 text-red-800", icon: XCircle },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.SUBMITTED
    const Icon = config.icon
    
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace(/_/g, ' ')}
      </Badge>
    )
  }

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
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
          {claim.status === 'VETTER2_COMPLETED' && (
            <>
              <DropdownMenuItem onClick={() => handleVetClaim(claim.id, 'approve')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleVetClaim(claim.id, 'reject')}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => handleInvestigateClaim(claim)}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Investigate
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
            <h1 className="text-3xl font-bold text-gray-900">Internal Control - Vetting</h1>
            <p className="text-gray-600">Audit vetting and smart-assisted claim validation</p>
          </div>
          <PermissionGate module="claims" action="audit">
            <Button 
              onClick={handleVetAll}
              disabled={vetAllMutation.isPending}
              className="bg-[#BE1522] hover:bg-[#9B1219] px-6 py-2"
            >
              {vetAllMutation.isPending ? "Processing..." : "Vet All Claims"}
            </Button>
          </PermissionGate>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Audit</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_pending}</div>
              <p className="text-xs text-muted-foreground">
                Claims awaiting audit review
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Audited</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_vetted}</div>
              <p className="text-xs text-muted-foreground">
                Claims completed audit
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flagged</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_flagged}</div>
              <p className="text-xs text-muted-foreground">
                Claims requiring investigation
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{metrics.total_amount?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">
                Net amount: ₦{metrics.net_amount?.toLocaleString() || '0'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter claims for audit vetting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by enrollee, provider, or claim number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="VETTER2_COMPLETED">Ready for Audit</SelectItem>
                  <SelectItem value="AUDIT_COMPLETED">Audit Completed</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Provider filter" />
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
          </CardContent>
        </Card>

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Vetting Queue</CardTitle>
            <CardDescription>Claims ready for audit vetting</CardDescription>
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
                      <TableHead className="text-xs font-medium text-gray-600">CLAIM #</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SUBMITTED</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((claim: Claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-medium">
                          {claim.claim_number}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {claim.principal?.first_name} {claim.principal?.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {claim.principal?.enrollee_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{claim.provider.facility_name}</div>
                            <div className="text-sm text-gray-500">
                              {claim.provider.facility_type?.join(', ')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <div className="font-medium text-sm">
                              {(() => {
                                try {
                                  if (claim.services) {
                                    const services = JSON.parse(claim.services)
                                    if (Array.isArray(services)) {
                                      return services.map((service: any) => service.service_name).join(', ')
                                    }
                                  }
                                  return claim.claim_type
                                } catch {
                                  return claim.services || claim.claim_type
                                }
                              })()}
                            </div>
                            {claim.diagnosis && (
                              <div className="text-xs text-gray-500 mt-1">
                                Dx: {claim.diagnosis}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          ₦{claim.amount?.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(claim.status)}
                        </TableCell>
                        <TableCell>
                          {new Date(claim.submitted_at).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell className="text-right">
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
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} claims
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={pagination.page <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={pagination.page >= pagination.pages}
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
      </div>
    </PermissionGate>
  )
}
