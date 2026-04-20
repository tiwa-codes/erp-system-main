export const dynamic = 'force-dynamic'

﻿"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
  Download,
  Eye,
  Clock,
  TrendingUp,
  Users,
  FileText,
  Search,
  XCircle
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { exportToPDF } from "@/lib/export-utils"



interface ProviderSettlement {
  provider_id: string
  provider_name: string
  provider_code: string
  total_enrollees: number
  total_amount: number
  paid_amount: number
  pending_claims: number
}

interface EnrolleeClaim {
  id: string
  claim_number: string
  amount: number
  payout_status: 'PENDING' | 'PAID' | 'PROCESSING' | 'FAILED'
  submitted_at: string
}

interface ProviderEnrollee {
  enrollee_id: string
  enrollee_name: string
  total_amount: number
  paid_amount: number
  claims: EnrolleeClaim[]
}

interface SettlementClaimRow extends EnrolleeClaim {
  enrollee_id: string
  enrollee_name: string
}

interface ServiceBreakdownItem {
  id: string
  service_name: string
  category?: string | null
  quantity?: number | null
  service_amount?: number | string | null
  vetted_amount?: number | string | null
  is_deleted?: boolean | null
}

interface SettlementMetrics {
  pending_payouts: number
  total_payouts: number
  total_amount: number
  processed_today: number
}

export default function ClaimsSettlementPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showEnrolleesModal, setShowEnrolleesModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderSettlement | null>(null)
  const [providerEnrollees, setProviderEnrollees] = useState<ProviderEnrollee[]>([])
  const [isLoadingEnrollees, setIsLoadingEnrollees] = useState(false)
  const [showServicesModal, setShowServicesModal] = useState(false)
  const [selectedClaimForServices, setSelectedClaimForServices] = useState<SettlementClaimRow | null>(null)
  const [selectedClaimServices, setSelectedClaimServices] = useState<ServiceBreakdownItem[]>([])
  const [isLoadingClaimServices, setIsLoadingClaimServices] = useState(false)
  const [showPayAllModal, setShowPayAllModal] = useState(false)
  const [payAllProvider, setPayAllProvider] = useState<ProviderSettlement | null>(null)
  const [payAllComment, setPayAllComment] = useState("")

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch settlement metrics
  const { data: metricsData } = useQuery({
    queryKey: ["settlement-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/finance/settlement/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch settlement metrics")
      }
      return res.json()
    },
  })

  // Fetch settlement providers
  const { data: providersData, isLoading } = useQuery({
    queryKey: ["settlement-providers", currentPage, limit, debouncedSearchTerm, startDate, endDate, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: debouncedSearchTerm,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      })
      
      const res = await fetch(`/api/finance/settlement/providers?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch settlement providers")
      }
      return res.json()
    },
  })

  const metrics = metricsData?.metrics || {
    pending_payouts: 0,
    total_payouts: 0,
    total_amount: 0,
    processed_today: 0
  }

  const providers = providersData?.providers || []
  const pagination = providersData?.pagination

  // Process payout mutation

  // Mark settlement as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const res = await fetch(`/api/finance/settlement/${claimId}/mark-as-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        throw new Error('Failed to mark settlement as paid')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlement-providers"] })
      queryClient.invalidateQueries({ queryKey: ["settlement-metrics"] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark settlement as paid",
        variant: "destructive",
      })
    },
  })

  const payAllMutation = useMutation({
    mutationFn: async ({ providerId, comments }: { providerId: string; comments?: string }) => {
      const payload: Record<string, string | undefined> = {
        provider_id: providerId,
        ...(comments ? { comments } : {}),
      }
      const res = await fetch("/api/finance/settlement/bulk-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || "Failed to bulk pay provider claims")
      }
      return res.json()
    },
    onSuccess: (data) => {
      const providerName = payAllProvider?.provider_name || "selected provider"
      toast({
        title: "Bulk payment completed",
        description: data.message || `Paid ${data.paid_count || 0} claims for ${providerName}`,
      })
      queryClient.invalidateQueries({ queryKey: ["settlement-providers"] })
      queryClient.invalidateQueries({ queryKey: ["settlement-metrics"] })
      if (selectedProvider && payAllProvider && selectedProvider.provider_id === payAllProvider.provider_id) {
        handleViewEnrollees(selectedProvider)
      }
      setShowPayAllModal(false)
      setPayAllProvider(null)
      setPayAllComment("")
    },
    onError: (error: any) => {
      toast({
        title: "Bulk payment failed",
        description: error?.message || "Failed to mark all claims as paid",
        variant: "destructive",
      })
    },
  })

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800'
      case 'PAID':
        return 'bg-green-100 text-green-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleViewEnrollees = async (provider: ProviderSettlement) => {
    setSelectedProvider(provider)
    setShowEnrolleesModal(true)
    setIsLoadingEnrollees(true)
    try {
      const res = await fetch(`/api/finance/settlement/providers/${provider.provider_id}/enrollees`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider enrollees")
      }
      const data = await res.json()
      setProviderEnrollees(data.enrollees || [])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch provider enrollees",
        variant: "destructive",
      })
    } finally {
      setIsLoadingEnrollees(false)
    }
  }

  const handleViewServices = async (claim: SettlementClaimRow) => {
    setSelectedClaimForServices(claim)
    setShowServicesModal(true)
    setIsLoadingClaimServices(true)
    try {
      const res = await fetch(`/api/claims/${claim.id}`)
      if (!res.ok) throw new Error("Failed to fetch claim services")
      const data = await res.json()
      const serviceItems = Array.isArray(data?.claim?.approval_codes?.[0]?.service_items)
        ? data.claim.approval_codes[0].service_items
        : []
      setSelectedClaimServices(serviceItems.filter((item: ServiceBreakdownItem) => !item.is_deleted))
    } catch (error) {
      setSelectedClaimServices([])
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load claim services",
        variant: "destructive",
      })
    } finally {
      setIsLoadingClaimServices(false)
    }
  }

  const handlePrintReceipt = async (provider: ProviderSettlement) => {
    try {
      const res = await fetch(`/api/finance/settlement/providers/${provider.provider_id}/enrollees`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider enrollees")
      }
      const data = await res.json()
      const enrollees = (data.enrollees || []) as ProviderEnrollee[]
      const paidRows = enrollees.flatMap((enrollee) =>
        enrollee.claims
          .filter((claim) => claim.payout_status === "PAID")
          .map((claim) => ({
            enrollee_name: enrollee.enrollee_name,
            enrollee_id: enrollee.enrollee_id,
            claim_number: claim.claim_number,
            amount: claim.amount,
            submitted_at: claim.submitted_at
          }))
      )

      if (paidRows.length === 0) {
        toast({
          title: "No payment processed",
          description: "No payment has been processed.",
        })
        return
      }

      await exportToPDF(
        {
          title: "Claims Settlement Receipt",
          subtitle: provider.provider_name,
          data: paidRows,
          columns: [
            { key: "enrollee_name", label: "Enrollee", type: "string" },
            { key: "enrollee_id", label: "Enrollee ID", type: "string" },
            { key: "claim_number", label: "Claim Number", type: "string" },
            { key: "amount", label: "Amount", type: "currency" },
            { key: "submitted_at", label: "Submitted Date", type: "date" }
          ]
        },
        `claims-settlement-receipt-${provider.provider_name.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().split("T")[0]}.pdf`
      )
    } catch (error) {
      toast({
        title: "Receipt generation failed",
        description: error instanceof Error ? error.message : "Failed to generate receipt",
        variant: "destructive",
      })
    }
  }


  const handleOpenPayAllModal = (provider: ProviderSettlement) => {
    if (provider.pending_claims === 0) {
      toast({
        title: "Nothing to pay",
        description: "All claims for this provider have already been settled.",
      })
      return
    }
    setPayAllProvider(provider)
    setPayAllComment("")
    setShowPayAllModal(true)
  }

  const handleConfirmPayAll = () => {
    if (!payAllProvider) return
    payAllMutation.mutate({
      providerId: payAllProvider.provider_id,
      comments: payAllComment.trim() || undefined
    })
  }

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (startDate) params.append("start_date", startDate)
      if (endDate) params.append("end_date", endDate)

      const response = await fetch(`/api/finance/settlement/export?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to export settlements')
      }

      const csvContent = await response.text()
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `claims-settlement-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: "Claims settlement data has been exported successfully."
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export settlements",
        variant: "destructive"
      })
    }
  }

  const handleMarkAsPaid = async (claim: SettlementClaimRow) => {
    if (claim.payout_status === "PAID") return
    try {
      await markAsPaidMutation.mutateAsync(claim.id)
      toast({
        title: "Success",
        description: `Claim ${claim.claim_number} marked as paid successfully`,
      })
      if (selectedProvider) {
        await handleViewEnrollees(selectedProvider)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark claim as paid",
        variant: "destructive",
      })
    }
  }

  return (
    <PermissionGate module="finance" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Claims Settlement</h1>
            <p className="text-gray-600">Process payouts for approved claims</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{metrics.pending_payouts}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_payouts}</div>
              <p className="text-xs text-muted-foreground">
                All time payouts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <span className="text-lg font-bold text-muted-foreground">NGN</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                NGN {metrics.total_amount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Processed amount
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processed Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{metrics.processed_today}</div>
              <p className="text-xs text-muted-foreground">
                Today's payouts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Settlement Providers Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Settlement Providers</CardTitle>
                <CardDescription className="mt-2">Approved claims grouped by provider</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Settlement Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search providers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  placeholder="Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  placeholder="End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>

            {/* Settlement Providers Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading settlement providers...</div>
              </div>
            ) : providers.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No settlement providers found</div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TOTAL ENROLLEES</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PENDING</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PAID</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((provider: ProviderSettlement) => (
                      <TableRow key={provider.provider_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{provider.provider_name}</div>
                            <div className="text-sm text-gray-500">{provider.provider_code}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{provider.total_enrollees}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          NGN {provider.total_amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              provider.pending_claims > 0
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {provider.pending_claims} pending
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          NGN {provider.paid_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewEnrollees(provider)}
                            >
                              <Users className="h-3.5 w-3.5 mr-1" />
                              View Enrollees
                            </Button>
                            <PermissionGate module="finance" action="edit">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPayAllModal(provider)}
                                disabled={
                                  provider.pending_claims === 0 ||
                                  (payAllMutation.isPending &&
                                    payAllProvider?.provider_id === provider.provider_id)
                                }
                              >
                                {payAllMutation.isPending &&
                                payAllProvider?.provider_id === provider.provider_id
                                  ? "Processing..."
                                  : "Pay All"}
                              </Button>
                            </PermissionGate>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePrintReceipt(provider)}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              Print Receipt
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
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

        {/* Provider Enrollees Modal */}
        {showEnrolleesModal && selectedProvider && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{selectedProvider.provider_name} - Enrollees</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowEnrolleesModal(false)
                      setSelectedProvider(null)
                      setProviderEnrollees([])
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Claims ready for settlement under this provider</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingEnrollees ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Loading enrollees...</div>
                  </div>
                ) : providerEnrollees.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">No enrollees found for this provider</div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-medium text-gray-600">CLAIM NUMBER</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600">SUBMITTED</TableHead>
                        <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {providerEnrollees.flatMap((enrollee) =>
                        enrollee.claims.map((claim) => {
                          const row: SettlementClaimRow = {
                            ...claim,
                            enrollee_id: enrollee.enrollee_id,
                            enrollee_name: enrollee.enrollee_name
                          }
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-sm">{row.claim_number}</TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">{row.enrollee_name}</div>
                              <div className="text-sm text-gray-500">{row.enrollee_id}</div>
                            </TableCell>
                            <TableCell className="font-semibold text-green-600">
                              NGN {row.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusBadgeColor(row.payout_status)}>
                                {row.payout_status}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(row.submitted_at).toLocaleString('en-GB')}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewServices(row)}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  View Services
                                </Button>
                                <PermissionGate module="finance" action="edit">
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkAsPaid(row)}
                                    disabled={
                                      row.payout_status === "PAID" ||
                                      (markAsPaidMutation.isPending && markAsPaidMutation.variables === row.id)
                                    }
                                  >
                                    Pay
                                  </Button>
                                </PermissionGate>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Services Modal */}
        {showServicesModal && selectedClaimForServices && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Claim Services</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowServicesModal(false)
                      setSelectedClaimForServices(null)
                      setSelectedClaimServices([])
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {selectedClaimForServices.claim_number} · {selectedClaimForServices.enrollee_name} ({selectedClaimForServices.enrollee_id})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingClaimServices ? (
                  <div className="text-sm text-gray-500">Loading services...</div>
                ) : selectedClaimServices.length === 0 ? (
                  <div className="text-sm text-gray-500">No services found for this claim.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600">CATEGORY</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600">QTY</TableHead>
                        <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedClaimServices.map((item) => {
                        const amount = Number(item.vetted_amount ?? item.service_amount ?? 0)
                        const qty = Number(item.quantity ?? 1)
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.service_name}</TableCell>
                            <TableCell>{item.category || "SERVICE"}</TableCell>
                            <TableCell>{qty}</TableCell>
                            <TableCell className="font-semibold text-green-600">NGN {amount.toLocaleString()}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        {showPayAllModal && payAllProvider && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pay All Pending Claims</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowPayAllModal(false)
                      setPayAllProvider(null)
                      setPayAllComment("")
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {payAllProvider.provider_name} · {payAllProvider.pending_claims} pending claim(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Confirming this action will mark all pending claims for this provider as paid and trigger the standard settlement process.
                </p>
                <Textarea
                  placeholder="Optional payment note"
                  value={payAllComment}
                  onChange={(e) => setPayAllComment(e.target.value)}
                  className="min-h-[120px]"
                />
              </CardContent>
              <div className="flex justify-end gap-3 px-6 pb-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPayAllModal(false)
                    setPayAllProvider(null)
                    setPayAllComment("")
                  }}
                  disabled={payAllMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmPayAll}
                  disabled={payAllMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {payAllMutation.isPending ? "Processing..." : "Confirm Pay All"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}

