"use client"

export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Eye } from "lucide-react"



type SummaryRow = {
  vetter_id: string
  name: string
  email: string | null
  vetted_claims_count: number
  rank: number
}

type Vetter = {
  id: string
  name: string
}

type ServiceItem = {
  id: string
  service_name: string
  quantity: number
  amount: number
  vetted_amount: number | null
  category: string | null
  is_vetted_approved: boolean
  rejection_reason: string | null
  is_deleted: boolean
}

type DetailRow = {
  claim_id: string
  claim_number: string
  approval_code: string
  vetted_at: string
  enrollee_name: string
  enrollee_id: string | null
  provider_name: string
  claim_status: string
  services: ServiceItem[]
}

export default function ClaimsApprovedCodesPage() {
  const [vetterId, setVetterId] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [activeVetter, setActiveVetter] = useState<SummaryRow | null>(null)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)

  const filters = useMemo(() => {
    const params = new URLSearchParams()
    if (vetterId && vetterId !== "all") params.set("vetter_id", vetterId)
    if (startDate) params.set("start_date", startDate)
    if (endDate) params.set("end_date", endDate)
    return params.toString()
  }, [vetterId, startDate, endDate])

  const summaryQuery = useQuery<{
    rows: SummaryRow[]
    vetters: Vetter[]
  }>({
    queryKey: ["claims-approved-codes-summary", filters],
    queryFn: async () => {
      const res = await fetch(`/api/claims/approved-codes?${filters}`)
      if (!res.ok) throw new Error("Failed to fetch approved codes summary")
      return res.json()
    },
  })

  const detailsQuery = useQuery<{ rows: DetailRow[] }>({
    queryKey: ["claims-approved-codes-details", activeVetter?.vetter_id, startDate, endDate],
    enabled: !!activeVetter?.vetter_id,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (startDate) params.set("start_date", startDate)
      if (endDate) params.set("end_date", endDate)
      const res = await fetch(`/api/claims/approved-codes/${activeVetter?.vetter_id}?${params}`)
      if (!res.ok) throw new Error("Failed to fetch approved code details")
      return res.json()
    },
  })

  const rows = summaryQuery.data?.rows || []
  const vetters = summaryQuery.data?.vetters || []
  const detailRows = detailsQuery.data?.rows || []

  return (
    <PermissionGate module="claims" action="view">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vetted Claims</h1>
          <p className="text-gray-600">
            View vetted claims by vetter and drill into claim and service details.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter by vetter and date range.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Vetter</Label>
              <Select value={vetterId} onValueChange={setVetterId}>
                <SelectTrigger>
                  <SelectValue placeholder="All vetters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vetters</SelectItem>
                  {vetters.map((vetter) => (
                    <SelectItem key={vetter.id} value={vetter.id}>
                      {vetter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vetted Claims By Vetter</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>No. of Vetted Claims</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {!summaryQuery.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No vetted claims found for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.vetter_id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      {row.email && <div className="text-xs text-gray-500">{row.email}</div>}
                    </TableCell>
                    <TableCell>{row.vetted_claims_count}</TableCell>
                    <TableCell>
                      <Badge variant="outline">#{row.rank}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveVetter(row)
                          setExpandedCode(null)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!activeVetter} onOpenChange={(open) => !open && setActiveVetter(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>
                {activeVetter?.name} - Vetted Claims
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-auto space-y-4">
              {detailsQuery.isLoading && <p className="text-sm text-gray-500">Loading details...</p>}
              {!detailsQuery.isLoading && detailRows.length === 0 && (
                <p className="text-sm text-gray-500">No vetted claim records found.</p>
              )}

              {detailRows.map((row) => (
                <Card key={row.claim_id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <p className="font-semibold text-blue-700">{row.approval_code}</p>
                        <p className="text-xs text-gray-600">
                          {row.enrollee_name} ({row.enrollee_id || "N/A"}) - {row.provider_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Vetted: {new Date(row.vetted_at).toLocaleString("en-GB")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpandedCode((current) =>
                            current === row.claim_id ? null : row.claim_id
                          )
                        }
                      >
                        {expandedCode === row.claim_id ? "Hide Services" : "View Services"}
                      </Button>
                    </div>

                    {expandedCode === row.claim_id && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Service</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Vetted Amount</TableHead>
                            <TableHead>Verdict</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {row.services.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-gray-500">
                                No service items found for this approval code.
                              </TableCell>
                            </TableRow>
                          )}
                          {row.services.map((service) => (
                            <TableRow key={service.id}>
                              <TableCell>{service.service_name}</TableCell>
                              <TableCell>{service.category || "-"}</TableCell>
                              <TableCell>{service.quantity}</TableCell>
                              <TableCell>₦{service.amount.toLocaleString()}</TableCell>
                              <TableCell>
                                {service.vetted_amount == null
                                  ? "-"
                                  : `₦${service.vetted_amount.toLocaleString()}`}
                              </TableCell>
                              <TableCell>
                                <Badge className={service.is_vetted_approved ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                  {service.is_vetted_approved ? "Approved" : "Rejected"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  )
}
