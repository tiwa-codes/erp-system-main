"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2 } from "lucide-react"

const statusBadge = (status: string) => {
  switch (status) {
    case "APPROVED":
    case "ACTIVE":
      return "bg-green-100 text-green-800"
    case "REJECTED":
      return "bg-red-100 text-red-800"
    case "PENDING":
      return "bg-yellow-100 text-yellow-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

interface Encounter {
  id: string
  approval_code?: string
  request_id?: string
  hospital: string
  provider_name: string
  enrollee_name: string
  enrollee_id: string
  diagnosis: string
  services: string
  amount: number
  status: string
  created_at: string
  type: "provider_request" | "approval_code" | "claim"
}

interface FetchResponse {
  success: boolean
  encounters: Encounter[]
  utilization?: {
    amount_utilized: number
    balance: number
    total_limit: number
    utilization_percentage: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

const fetchEncounterHistory = async ({ page, limit, search, enrolleeId }: { page: number; limit: number; search: string; enrolleeId: string | null }) => {
  const params = new URLSearchParams()
  params.append("page", page.toString())
  params.append("limit", limit.toString())
  if (search) params.append("search", search)
  if (enrolleeId) params.append("enrollee_id", enrolleeId)

  const res = await fetch(`/api/call-centre/encounter-history?${params}`)
  if (!res.ok) {
    throw new Error("Unable to load encounter history")
  }
  return res.json() as Promise<FetchResponse>
}

export default function PreviousEncounterHistoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialEnrolleeId = searchParams.get("enrollee_id") || ""

  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const limit = 10
  const [enrolleeId, setEnrolleeId] = useState(initialEnrolleeId)

  useEffect(() => {
    setEnrolleeId(initialEnrolleeId)
  }, [initialEnrolleeId])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const { data, isLoading } = useQuery<FetchResponse>({
    queryKey: ["encounter-history", page, debouncedSearch, enrolleeId],
    queryFn: () => fetchEncounterHistory({ page, limit, search: debouncedSearch, enrolleeId: enrolleeId || null }),
  })

  const encounters = data?.encounters || []
  const pagination = data?.pagination

  const handlePageChange = (direction: "prev" | "next") => {
    if (!pagination) return
    if (direction === "prev" && page > 1) {
      setPage(prev => prev - 1)
    }
    if (direction === "next" && page < pagination.pages) {
      setPage(prev => prev + 1)
    }
  }

  const handleViewRequest = (encounter: Encounter) => {
    if (encounter.type === "provider_request") {
      router.push(`/call-centre/requests/${encounter.id}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Previous Encounters</h1>
          <p className="text-gray-600">Browse every enrollee encounter from the ERP</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/call-centre/requests")}>
          Back to Provider Requests
        </Button>
      </div>

      {data?.utilization && enrolleeId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="bg-blue-50/50 border-blue-100 shadow-none">
            <CardContent className="pt-6">
              <p className="text-[10px] uppercase text-blue-600 font-bold tracking-wider mb-1">Annual Plan Limit</p>
              <p className="text-3xl font-black text-blue-900">
                ₦{data.utilization.total_limit.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50/50 border-orange-100 shadow-none">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <p className="text-[10px] uppercase text-orange-600 font-bold tracking-wider mb-1">Utilized (YTD)</p>
                <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">
                  {data.utilization.utilization_percentage.toFixed(1)}%
                </Badge>
              </div>
              <p className="text-3xl font-black text-orange-700">
                ₦{data.utilization.amount_utilized.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50/50 border-emerald-100 shadow-none">
            <CardContent className="pt-6">
              <p className="text-[10px] uppercase text-emerald-600 font-bold tracking-wider mb-1">Remaining Balance</p>
              <p className="text-3xl font-black text-emerald-700">
                ₦{data.utilization.balance.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search by enrollee ID, name, provider, or approval code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by enrollee, hospital, or code..."
                className="pl-10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col">
              <Input
                placeholder="Filter by enrollee ID"
                value={enrolleeId}
                onChange={(event) => {
                  setEnrolleeId(event.target.value)
                  setPage(1)
                }}
              />
              {enrolleeId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-600 mt-1 px-0 hover:text-blue-700"
                  onClick={() => {
                    setEnrolleeId("")
                    setPage(1)
                  }}
                >
                  Clear enrollee filter
                </Button>
              )}
            </div>
          </div>
          {pagination && (
            <div className="flex flex-wrap items-center justify-between text-sm text-gray-600">
              <span>
                Showing page {pagination.page} of {pagination.pages} · {pagination.total} records
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("prev")}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("next")}
                  disabled={page === pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : encounters.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              No encounters found yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">DATE</TableHead>
                    <TableHead className="text-xs">ENROLLEE</TableHead>
                    <TableHead className="text-xs">PROVIDER</TableHead>
                    <TableHead className="text-xs">SERVICES</TableHead>
                    <TableHead className="text-xs">AMOUNT</TableHead>
                    <TableHead className="text-xs">STATUS</TableHead>
                    <TableHead className="text-xs">APPROVAL CODE</TableHead>
                    <TableHead className="text-xs text-right">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {encounters.map((encounter: Encounter) => (
                    <TableRow key={encounter.id}>
                      <TableCell className="text-sm">
                        {new Date(encounter.created_at).toLocaleDateString("en-GB")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">{encounter.enrollee_name || "Unknown"}</div>
                        <div className="text-xs text-gray-500">
                          ID: {encounter.enrollee_id || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium text-gray-900">{encounter.provider_name || encounter.hospital}</div>
                        <div className="text-xs text-gray-500">{encounter.hospital}</div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {encounter.services || "—"}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ₦{encounter.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadge(encounter.status)}>{encounter.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {encounter.approval_code ? (
                          <Badge className="bg-slate-100 text-slate-800 font-mono">{encounter.approval_code}</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {encounter.type === "provider_request" && (
                          <Button variant="outline" size="sm" onClick={() => handleViewRequest(encounter)}>
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {pagination && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} entries
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePageChange("prev")} disabled={page === 1}>
              Previous
            </Button>
            <span>
              Page {page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange("next")}
              disabled={pagination.pages === 0 || page === pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
