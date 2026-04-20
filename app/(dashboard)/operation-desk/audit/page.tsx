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
  enrollee_name: string
  enrollee_id: string
  provider_name: string
  provider_id: string
  facility_type: string[]
  status: string
  amount: string
  submitted_at: string
  processed_at?: string
  is_primary_hospital?: boolean
}

interface ProviderStats {
  id: string
  provider_id: string
  provider_name: string
  total_claims: number
  pending_claims: number
  vetted_claims: number
  rejected_claims: number
  total_amount: number
  latest_date: string
  latest_claim?: any
}

export default function AuditPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("VETTER2_COMPLETED")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

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

  // Fetch claims data
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["operation-audit-claims", currentPage, limit, debouncedSearchTerm, selectedStatus, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
      })

      const res = await fetch(`/api/operation-desk/audit?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claims")
      }
      return res.json()
    },
  })

  // Fetch providers for filter
  const { data: providersData } = useQuery({
    queryKey: ["audit-providers"],
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
    pending_claims: provider.pending_audit,
    vetted_claims: provider.audited,
    rejected_claims: provider.rejected,
    total_amount: provider.total_amount,
    latest_date: provider.latest_claim?.submitted_at || null,
    latest_claim: provider.latest_claim
  }))

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  return (
    <PermissionGate module="operation-desk" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Internal Control - Audit</h1>
            <p className="text-gray-600">Audit vetted claims from Vetter 2</p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-[#BE1522] hover:bg-[#9B1219]">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="bg-green-600 hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" />
              Report
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
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
                  <SelectItem value="VETTER2_COMPLETED">Pending Audit</SelectItem>
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

        {/* Claims Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Audit Overview {'>>'} {selectedProvider !== "all" ?
                  providersData?.providers?.find((p: any) => p.id === selectedProvider)?.facility_name || "All Providers" :
                  "All Providers"
                }</CardTitle>
                <CardDescription className="mt-2">Pending claims from Vetter 2</CardDescription>
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
                      <TableHead className="text-xs font-medium text-gray-600">AUDITED</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REJECTED</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TOTAL AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DATE/TIME</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedClaims.map((provider) => {
                      return (
                        <TableRow key={provider.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              <span>{provider.provider_name}</span>
                              {provider.latest_claim?.is_primary_hospital === false && (
                                <div title="Latest claim is from Non-Primary Hospital: Potential Fraud/Misuse">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 animate-pulse" />
                                </div>
                              )}
                            </div>
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
                                <DropdownMenuItem
                                  onClick={() => {
                                    router.push(`/operation-desk/audit/${provider.provider_id}`)
                                  }}
                                >
                                  View Enrollees
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Showing {processedClaims.length} providers with claims
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
