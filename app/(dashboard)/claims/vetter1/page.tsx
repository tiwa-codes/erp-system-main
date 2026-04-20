"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
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
  Download,
  Phone
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Loader2 } from "lucide-react"
import {

export const dynamic = 'force-dynamic'
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  is_primary_hospital?: boolean
  principal?: any
  provider?: any
  claim_type?: string
  vetting_records?: any[]
  code_deleted?: boolean
  manual_code?: string | null
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
  latest_claim?: any
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

export default function Vetter1Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Active tab: 'auto' = provider-originated | 'manual' = call-centre manual codes
  // Initialise from ?tab= so Back navigation from drill-down restores the correct tab
  const [activeTab, setActiveTab] = useState<"auto" | "manual">(
    (searchParams.get("tab") as "auto" | "manual") || "auto"
  )

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // (kept for disabled legacy modals below)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [showLoadApprovalDialog, setShowLoadApprovalDialog] = useState(false)
  const [approvalCodeInput, setApprovalCodeInput] = useState("")

  // Reset page when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value as "auto" | "manual")
    setCurrentPage(1)

    // Update URL to persist tab state
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/claims/vetter1?${params.toString()}`, { scroll: false })
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
  }, [debouncedSearchTerm, selectedStatus, selectedProvider])

  // Fetch claims data for current tab
  const { data: claimsData, isLoading, isFetching } = useQuery({
    queryKey: ["vetter1-claims", activeTab, currentPage, limit, debouncedSearchTerm, selectedStatus, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        bill_type: activeTab,
        grouped: "providers",
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
      })
      const res = await fetch(`/api/claims/vetter1?${params}`)
      if (!res.ok) throw new Error("Failed to fetch claims")
      return res.json()
    },
    placeholderData: (previousData) => previousData,
  })

  // Fetch metrics for current tab
  const { data: metricsData } = useQuery({
    queryKey: ["vetter1-metrics", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/claims/vetter1/metrics?bill_type=${activeTab}`)
      if (!res.ok) throw new Error("Failed to fetch metrics")
      return res.json()
    },
  })

  const { data: tabPendingCounts } = useQuery({
    queryKey: ["vetter1-tab-pending-counts"],
    queryFn: async () => {
      const [autoRes, manualRes] = await Promise.all([
        fetch("/api/claims/vetter1/metrics?bill_type=auto"),
        fetch("/api/claims/vetter1/metrics?bill_type=manual"),
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
      const res = await fetch("/api/providers?page=1&limit=5000")
      if (!res.ok) throw new Error("Failed to fetch providers")
      return res.json()
    },
  })

  const providerOptions = useMemo(() => {
    const providers = (providersData?.providers || [])
      .slice()
      .sort((a: any, b: any) => a.facility_name.localeCompare(b.facility_name))

    return [
      { value: "all", label: "All Providers" },
      ...providers.map((p: any) => ({ value: p.id, label: p.facility_name })),
    ]
  }, [providersData])

  const claims = claimsData?.claims || []
  const pagination = claimsData?.pagination

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

  const handleFilterChange = () => setCurrentPage(1)

  const handleVetClaim = (claim: Claim) => router.push(`/claims/vetter1/${claim.id}`)

  const loadApprovalCodeMutation = useMutation({
    mutationFn: async (approvalCode: string) => {
      const res = await fetch("/api/claims/load-approval-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_code: approvalCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to load approval code")
      }
      return data
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Approval code loaded successfully.",
      })
      setShowLoadApprovalDialog(false)
      setApprovalCodeInput("")
      queryClient.invalidateQueries({ queryKey: ["vetter1-claims"] })
      queryClient.invalidateQueries({ queryKey: ["vetter1-metrics"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to Load Approval Code",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleLoadApprovalCode = () => {
    const code = approvalCodeInput.trim()
    if (!code) {
      toast({
        title: "Approval Code Required",
        description: "Enter an approval code to continue.",
        variant: "destructive",
      })
      return
    }
    loadApprovalCodeMutation.mutate(code)
  }

  const handleReviewClaim = async (claim: Claim) => {
    try {
      const res = await fetch(`/api/claims/${claim.id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedClaim(data.claim)
        setShowReviewModal(true)
      } else {
        setSelectedClaim(claim)
        setShowReviewModal(true)
      }
    } catch {
      setSelectedClaim(claim)
      setShowReviewModal(true)
    }
  }

  // â”€â”€â”€ Shared sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const FiltersCard = () => (
    <Card>
      <CardHeader>
        <CardTitle>Claim Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium">Provider</label>
            <Combobox
              options={providerOptions}
              value={selectedProvider}
              onValueChange={(v) => {
                setSelectedProvider(v || "all")
                handleFilterChange()
              }}
              placeholder="All Providers"
              searchPlaceholder="Search provider..."
              emptyText="No provider found"
              clearable
            />
          </div>
          <div>
            <label className="text-sm font-medium">Claim Status</label>
            <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); handleFilterChange() }}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent className="z-[80]">
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
  )

  const MetricsRow = () => (
    <>
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
                <p className="text-sm text-green-600">₦{Number(metrics.total_amount).toLocaleString()}</p>
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
                <p className="text-sm text-green-600">₦{Number(metrics.approved_amount).toLocaleString()}</p>
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
                <p className="text-sm text-red-600">₦{Number(metrics.rejected_amount).toLocaleString()}</p>
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
                <span className="text-2xl font-bold text-blue-600">₦</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Net Amount (After Rejections)</p>
                <p className="text-3xl font-bold text-blue-600">₦{Number(metrics.net_amount).toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total - Rejected = Net</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total: ₦{Number(metrics.total_amount).toLocaleString()}</p>
              <p className="text-sm text-red-600">Rejected: ₦{Number(metrics.rejected_amount).toLocaleString()}</p>
              <p className="text-sm text-green-600">Approved: ₦{Number(metrics.approved_amount).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )

  const ProviderTable = ({ isManual }: { isManual?: boolean }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {isManual ? "Manual Bills" : "Auto Bills"} Overview {">>"}{" "}
              {selectedProvider !== "all"
                ? providersData?.providers?.find((p: any) => p.id === selectedProvider)?.facility_name || "All Providers"
                : "All Providers"}
            </CardTitle>
            <CardDescription className="mt-2">
              {isManual
                ? "Claims from Call Centre-generated manual approval codes"
                : "Claims submitted via the provider portal"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && !isLoading && (
              <span className="inline-flex items-center text-xs text-gray-500 mr-2">
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Updating table...
              </span>
            )}
            <Button className="bg-green-600 hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" />Export Excel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700">
              <Download className="h-4 w-4 mr-2" />Export PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && processedClaims.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : processedClaims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            {isManual ? (
              <>
                <Phone className="h-10 w-10 mb-3 text-gray-300" />
                <p className="font-medium">No manual bills yet</p>
                <p className="text-sm mt-1">Manual approval codes generated by Call Centre will appear here automatically.</p>
              </>
            ) : (
              <>
                <FileText className="h-10 w-10 mb-3 text-gray-300" />
                <p className="font-medium">No claims found</p>
              </>
            )}
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
                        onClick={() =>
                          router.push(
                            `/claims/vetter1/${provider.provider_id}${isManual ? "?bill_type=manual" : ""}`
                          )
                        }
                        className="flex items-center gap-1.5 text-left text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        <span>{provider.provider_name}</span>
                        {provider.latest_claim?.is_primary_hospital === false && (
                          <div title="Latest claim is from Non-Primary Hospital: Potential Fraud/Misuse">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600 animate-pulse" />
                          </div>
                        )}
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
                    <TableCell>₦{provider.total_amount?.toLocaleString() || "0"}</TableCell>
                    <TableCell>
                      {provider.latest_claim?.submitted_at
                        ? new Date(provider.latest_claim.submitted_at).toLocaleString("en-GB")
                        : "No claims"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/claims/vetter1/${provider.provider_id}${isManual ? "?bill_type=manual" : ""}`
                              )
                            }
                          >
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
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-600">
                Showing {processedClaims.length} providers with claims
              </p>
              <div className="flex items-center gap-2">
                {pagination && (
                  <>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={pagination.page === 1}
                    >
                      Previous
                    </Button>
                    {[1, 2, 3].filter((n) => n <= pagination.pages).map((n) => (
                      <Button
                        key={n}
                        variant={currentPage === n ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(n)}
                      >
                        {n}
                      </Button>
                    ))}
                    {pagination.pages > 3 && currentPage > 3 && (
                      <>
                        <span className="text-sm">...</span>
                        <Button variant="default" size="sm">{currentPage}</Button>
                      </>
                    )}
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, pagination.pages))}
                      disabled={pagination.page === pagination.pages}
                    >
                      Next
                    </Button>
                    <span className="text-sm text-gray-500">({pagination.pages} pages total)</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )

  return (
    <PermissionGate module="claims" action="view" actions={["view", "vet"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Claims Overview {">>"} Vetter 1</h1>
            <p className="text-gray-600">Review and process claims - Vetter 1 workflow</p>
          </div>
          <PermissionGate module="claims" action="view" actions={["view", "vet"]}>
            <Button
              onClick={() => setShowLoadApprovalDialog(true)}
              className="bg-[#BE1522] hover:bg-[#9B1219]"
            >
              Load Approval Code
            </Button>
          </PermissionGate>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-2">
            <TabsTrigger value="auto" className="gap-2">
              <FileText className="h-4 w-4" />
              Auto Bills
              {autoPendingCount > 0 && (
                <span className="text-[10px] font-semibold text-red-600 animate-pulse">({autoPendingCount})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Phone className="h-4 w-4" />
              Manual Bills
              {manualPendingCount > 0 && (
                <span className="text-[10px] font-semibold text-red-600 animate-pulse">({manualPendingCount})</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* â”€â”€ AUTO BILLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <TabsContent value="auto" className="space-y-6">
            <FiltersCard />
            <MetricsRow />
            <ProviderTable isManual={false} />
          </TabsContent>

          {/* â”€â”€ MANUAL BILLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <TabsContent value="manual" className="space-y-6">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <strong>Manual Bills</strong> — Claims here are created automatically when Call Centre generates a
              manual approval code. Modifications and deletions made in the Call Centre module are reflected live.
            </div>
            <FiltersCard />
            <MetricsRow />
            <ProviderTable isManual={true} />
          </TabsContent>
        </Tabs>

        <Dialog open={showLoadApprovalDialog} onOpenChange={setShowLoadApprovalDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Load Approval Code</DialogTitle>
              <DialogDescription>
                Enter an approval code to load it into Vetter 1 as a pending claim.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Approval Code</label>
              <Input
                placeholder="e.g. APR/CJH/2026030201"
                value={approvalCodeInput}
                onChange={(e) => setApprovalCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleLoadApprovalCode()
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowLoadApprovalDialog(false)}
                disabled={loadApprovalCodeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLoadApprovalCode}
                disabled={loadApprovalCodeMutation.isPending}
                className="bg-[#BE1522] hover:bg-[#9B1219]"
              >
                {loadApprovalCodeMutation.isPending ? "Loading..." : "Load Approval Code"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Legacy disabled modals â€” kept for data structure compatibility */}
        {false && showViewModal && selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-blue-600">Vetter 1 Details</h2>
                <Button variant="outline" size="sm" onClick={() => { setShowViewModal(false); setSelectedClaim(null) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {false && showReviewModal && selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-blue-600">Review Claim</h2>
                <Button variant="outline" size="sm" onClick={() => { setShowReviewModal(false); setSelectedClaim(null) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
