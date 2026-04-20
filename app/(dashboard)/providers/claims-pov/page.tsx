"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
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
  Building2,
  DollarSign,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  Download,
  MoreHorizontal
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { MetricCard } from "@/components/ui/metric-card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

export const dynamic = 'force-dynamic'

interface Claim {
  id: string
  claim_number: string
  enrollee_id: string
  principal_id?: string
  principal?: {
    id: string
    enrollee_id: string
    first_name: string
    last_name: string
  }
  provider_id: string
  provider: {
    id: string
    name: string
    provider_code: string
  }
  claim_type: string
  amount: number
  status: string
  submitted_at: string
  processed_at?: string
  approved_at?: string
  rejected_at?: string
}

export default function ProvidersClaimsPOVPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedClaimType, setSelectedClaimType] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch claims
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["provider-claims-pov", currentPage, limit, debouncedSearchTerm, selectedProvider, selectedStatus, selectedClaimType],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedClaimType !== "all" && { claim_type: selectedClaimType }),
      })
      
      const res = await fetch(`/api/claims?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claims")
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

  // Fetch claims metrics
  const { data: metricsData } = useQuery({
    queryKey: ["claims-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/claims/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch claims metrics")
      }
      return res.json()
    },
  })

  const claims = claimsData?.claims || []
  const pagination = claimsData?.pagination
  const providers = providersData?.providers || []
  const metrics = metricsData?.metrics || {
    total_claims: 0,
    new_claims: 0,
    pending_claims: 0,
    approved_claims: 0,
    rejected_claims: 0,
    paid_claims: 0,
    total_amount: 0,
    average_claim_amount: 0
  }

  // Mock data for charts
  const claimsByProviderData = [
    { provider: "Lagos Hospital", claims: 45, amount: 2500000 },
    { provider: "Abuja Clinic", claims: 38, amount: 1800000 },
    { provider: "Kano Medical", claims: 32, amount: 2200000 },
    { provider: "Port Harcourt Health", claims: 28, amount: 1600000 },
    { provider: "Ibadan Care", claims: 25, amount: 1400000 }
  ]

  const monthlyClaimsData = [
    { month: "Jan", claims: 120, amount: 2500000 },
    { month: "Feb", claims: 135, amount: 2800000 },
    { month: "Mar", claims: 142, amount: 2950000 },
    { month: "Apr", claims: 158, amount: 3200000 },
    { month: "May", claims: 165, amount: 3400000 },
    { month: "Jun", claims: 172, amount: 3550000 }
  ]

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle export
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params = new URLSearchParams({
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedClaimType !== "all" && { claim_type: selectedClaimType }),
        format
      })
      
      const res = await fetch(`/api/claims/export?${params}`)
      if (!res.ok) {
        throw new Error(`Failed to export ${format}`)
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `provider-claims-pov-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`
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
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'under_review':
        return 'bg-blue-100 text-blue-800'
      case 'flagged':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Providers Claims (POV)</h1>
            <p className="text-gray-600">Claims overview and analytics from provider perspective</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <MetricCard
            title="Approved"
            value={metrics.approved_claims}
            icon={CheckCircle}
            description="Total approved claims"
          />
          <MetricCard
            title="Rejected"
            value={metrics.rejected_claims}
            icon={XCircle}
            description="Total rejected claims"
          />
          <MetricCard
            title="Claims Paid"
            value={metrics.paid_claims}
            icon={DollarSign}
            description="Total paid claims"
          />
          <MetricCard
            title="New"
            value={metrics.new_claims}
            icon={AlertTriangle}
            description="Total new claims"
          />
          <MetricCard
            title="Pending"
            value={metrics.pending_claims}
            icon={Clock}
            description="Total pending claims"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Claims by Provider */}
          <Card>
            <CardHeader>
              <CardTitle>Claims by Provider</CardTitle>
              <CardDescription>Top providers by claim count and amount</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={claimsByProviderData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="provider" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="claims" fill="#10b981" name="Claims" />
                    <Bar yAxisId="right" dataKey="amount" fill="#3b82f6" name="Amount (₦)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Claims Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Claims Trend</CardTitle>
              <CardDescription>Claims count and amount over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyClaimsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="claims" stroke="#10b981" strokeWidth={2} name="Claims" />
                    <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} name="Amount (₦)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Claims Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Search Claims</label>
                <Input
                  placeholder="Search by claim number or enrollee"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                    {providers.map((provider: any) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
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
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="FLAGGED">Flagged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Claim Type</label>
                <Select value={selectedClaimType} onValueChange={(value) => {
                  setSelectedClaimType(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="INPATIENT">Inpatient</SelectItem>
                    <SelectItem value="OUTPATIENT">Outpatient</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                    <SelectItem value="SURGERY">Surgery</SelectItem>
                    <SelectItem value="LABORATORY">Laboratory</SelectItem>
                    <SelectItem value="RADIOLOGY">Radiology</SelectItem>
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

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Provider Claims</CardTitle>
                <CardDescription className="mt-2">All claims submitted by providers</CardDescription>
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
                      <TableHead className="text-xs font-medium text-gray-600">CLAIM NUMBER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CLAIM TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SUBMITTED DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROCESSED DATE</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((claim: Claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-medium">{claim.claim_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-red-400">
                                {claim.provider.name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{claim.provider.name}</div>
                            </div>
                          </div>
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
                          <Badge variant="outline">
                            {claim.claim_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ₦{claim.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(claim.status)}>
                            {claim.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(claim.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {claim.processed_at ? 
                            new Date(claim.processed_at).toLocaleDateString() : 
                            "---"
                          }
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
                                  onClick={() => router.push(`/claims/${claim.id}`)}
                                  className="w-full justify-start text-xs"
                                >
                                  View
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
      </div>
    </PermissionGate>
  )
}
