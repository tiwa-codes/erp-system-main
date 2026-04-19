"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  Users,
  MoreVertical,
  FileText,
  AlertTriangle,
  Download,
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
  enrollee_name: string
  enrollee_id: string
  provider_name: string
  provider_id: string
  facility_type: string[]
  status: string
  amount: number
  submitted_at: string
  processed_at?: string
}

interface ProviderStats {
  id: string
  provider_id: string
  provider_name: string
  facility_type: string[]
  total_claims: number
  pending_claims: number
  vetted_claims: number
  rejected_claims: number
  total_amount: number
  latest_date: string
  latest_claim?: {
    submitted_at?: string | null
  } | null
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

export default function Vetter2Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<"auto" | "manual">(
    (searchParams.get("tab") as "auto" | "manual") || "auto"
  )

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedProviderFilter, setSelectedProviderFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)

  const handleTabChange = (value: string) => {
    setActiveTab(value as "auto" | "manual")
    setCurrentPage(1)

    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/claims/vetter2?${params.toString()}`, { scroll: false })
  }

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, selectedStatus, selectedProviderFilter])

  // Fetch claims data for vetter2
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["vetter2-claims", activeTab, currentPage, limit, debouncedSearchTerm, selectedStatus, selectedProviderFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        bill_type: activeTab,
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProviderFilter !== "all" && { provider: selectedProviderFilter }),
      })
      
      const res = await fetch(`/api/claims/vetter2?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claims")
      }
      return res.json()
    },
  })

  // Fetch vetter2 metrics
  const { data: metricsData } = useQuery({
    queryKey: ["vetter2-metrics", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/claims/vetter2/metrics?bill_type=${activeTab}`)
      if (!res.ok) {
        throw new Error("Failed to fetch metrics")
      }
      return res.json()
    },
  })

  const { data: tabPendingCounts } = useQuery({
    queryKey: ["vetter2-tab-pending-counts"],
    queryFn: async () => {
      const [autoRes, manualRes] = await Promise.all([
        fetch("/api/claims/vetter2/metrics?bill_type=auto"),
        fetch("/api/claims/vetter2/metrics?bill_type=manual"),
      ])

      if (!autoRes.ok || !manualRes.ok) {
        throw new Error("Failed to fetch tab counts")
      }

      const [autoData, manualData] = await Promise.all([autoRes.json(), manualRes.json()])

      return {
        auto: autoData?.metrics?.pending_audit || 0,
        manual: manualData?.metrics?.pending_audit || 0,
      }
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

  // The API now returns provider statistics directly, so we can use them as-is
  const processedClaims: ProviderStats[] = claims.map((provider: any) => ({
    id: provider.id,
    provider_id: provider.id,
    provider_name: provider.provider_name,
    facility_type: provider.facility_type,
    total_claims: provider.total_claims,
    pending_claims: provider.pending_vetting,
    vetted_claims: provider.vetted,
    rejected_claims: provider.rejected,
    total_amount: provider.total_amount,
    latest_date: provider.latest_claim?.submitted_at || null,
    latest_claim: provider.latest_claim
  }))

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
  const autoPendingCount = tabPendingCounts?.auto || 0
  const manualPendingCount = tabPendingCounts?.manual || 0

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Get status text color
  const getStatusTextColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'system':
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

  // Handle action clicks - simplified for provider stats
  const handleViewClaims = (providerId: string) => {
    router.push(`/claims/vetter2/provider/${providerId}`)
  }

  const handleViewEnrollees = (providerId: string) => {
    router.push(`/claims/vetter2/provider/${providerId}`)
  }


  return (
    <PermissionGate module="claims" action="view">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vetter 2 Overview {'>>'} All Providers</h1>
            <p className="text-gray-600">Second-level vetting for auto and manual bills</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="auto">
              Auto Bill
              {autoPendingCount > 0 && (
                <Badge className="ml-2 bg-red-500 text-white hover:bg-red-500">
                  {autoPendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="manual">
              Manual Bill
              {manualPendingCount > 0 && (
                <Badge className="ml-2 bg-red-500 text-white hover:bg-red-500">
                  {manualPendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Claim Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Provider</label>
                <Select value={selectedProviderFilter} onValueChange={(value) => {
                  setSelectedProviderFilter(value)
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
                    <SelectItem value="AUDITED">Audited</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
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
                  <p className="text-sm font-medium text-gray-600">Pending Vetting</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.pending_audit}</p>
                  <p className="text-sm text-gray-600">Awaiting review</p>
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
                  <p className="text-2xl font-bold text-gray-900">{metrics.approved_amount}</p>
                  <p className="text-sm text-green-600">Through manual vetting</p>
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
                  <p className="text-sm font-medium text-gray-600">Flagged Claims</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.flagged_claims}</p>
                  <p className="text-sm text-red-600">Require attention</p>
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
                <CardTitle>Vetter 2 Overview {'>>'} {selectedProviderFilter !== "all" ? 
                  providersData?.providers?.find((p: any) => p.id === selectedProviderFilter)?.facility_name || "All Providers" : 
                  "All Providers"
                }</CardTitle>
                <CardDescription className="mt-2">Claims ready for vetting</CardDescription>
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
                      <TableHead className="text-xs font-medium text-gray-600">TOTAL CLAIMS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PENDING</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">VETTED</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REJECTED</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TOTAL AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DATE/TIME</TableHead>
                <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                    {processedClaims.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            onClick={() => router.push(`/claims/vetter2/provider/${provider.provider_id}`)}
                            className="text-left text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            {provider.provider_name}
                          </button>
                  </TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold">{provider.total_claims}</span>
                  </TableCell>
                        <TableCell>
                          <span className="text-xs text-yellow-600">{provider.pending_claims}</span>
                  </TableCell>
                        <TableCell>
                          <span className="text-xs text-green-600">{provider.vetted_claims}</span>
                  </TableCell>
                        <TableCell>
                          <span className="text-xs text-red-600">{provider.rejected_claims}</span>
                  </TableCell>
                        <TableCell>
                          ₦{provider.total_amount?.toLocaleString() || '0'}
                  </TableCell>
                  <TableCell>
                          {provider.latest_claim?.submitted_at ? 
                            new Date(provider.latest_claim.submitted_at).toLocaleString('en-GB') : 
                            'No claims'
                          }
                  </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => router.push(`/claims/vetter2/provider/${provider.provider_id}`)}>
                                View Enrollees
                              </DropdownMenuItem>
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

    
        {null}
    </div>
    </PermissionGate>
  )
}
