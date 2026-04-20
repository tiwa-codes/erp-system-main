"use client"

export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ui/combobox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"



type ApprovalCodeRow = {
  id: string
  approval_code: string
  is_manual?: boolean
  enrollee_name: string
  hospital: string
  status: string
  generated_by: string
  approved_by?: string | null
  rejected_by?: string | null
  created_at: string
}

type ProviderRequestRow = {
  id: string
  status: string
  date: string
  enrollee_name?: string
  beneficiary_name?: string
  provider_name?: string
  approved_by?: string | null
  rejected_by?: string | null
}

type ManualCodeRow = {
  id: string
  approval_code: string
  created_at: string
  enrollee_name?: string
  generated_by?: {
    first_name?: string
    last_name?: string
  } | null
}

function csvEscape(value: unknown) {
  const str = String(value ?? "")
  return `"${str.replace(/"/g, '""')}"`
}

function isApprovalCode(value: string) {
  const code = (value || "").trim().toUpperCase()
  return /^(APR\/|M-APR-)/.test(code)
}

const TEST_NAME_MARKERS = ["john doe", "baby john", "lady john"]

function isTestEnrolleeName(name: string) {
  const normalized = (name || "").toLowerCase()
  return TEST_NAME_MARKERS.some((marker) => normalized.includes(marker))
}

function isManualCode(row: ApprovalCodeRow) {
  return !!row.is_manual || (row.approval_code || "").toUpperCase().startsWith("M-")
}

function getStatusBadgeClass(status: string) {
  const normalized = (status || "").toUpperCase()
  if (normalized === "APPROVED") return "bg-green-600 text-white"
  if (normalized === "REJECTED") return "bg-red-600 text-white"
  if (normalized === "PARTIAL") return "bg-yellow-400 text-black"
  return "bg-gray-200 text-gray-800"
}

export default function CallCentreReportPage() {
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [officerFilter, setOfficerFilter] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["call-centre-report-approval-codes"],
    queryFn: async () => {
      const res = await fetch("/api/call-centre/approval-codes?page=1&limit=2000&status=all")
      if (!res.ok) throw new Error("Failed to fetch call centre report data")
      return res.json()
    },
  })

  const rows: ApprovalCodeRow[] = data?.approval_codes || []
  const approvalRows = useMemo(
    () => rows.filter((row) => isApprovalCode(row.approval_code) && !isTestEnrolleeName(row.enrollee_name)),
    [rows]
  )

  const { data: providerRequestsData } = useQuery({
    queryKey: ["call-centre-report-provider-requests"],
    queryFn: async () => {
      const res = await fetch("/api/call-centre/provider-requests?page=1&limit=2000&status=ALL")
      if (!res.ok) throw new Error("Failed to fetch provider requests for report")
      return res.json()
    },
  })

  const { data: manualCodesData } = useQuery({
    queryKey: ["call-centre-report-manual-codes"],
    queryFn: async () => {
      const res = await fetch("/api/call-centre/manual-codes?page=1&limit=2000")
      if (!res.ok) throw new Error("Failed to fetch manual codes for report")
      return res.json()
    },
  })

  const { data: usersData } = useQuery({
    queryKey: ["call-centre-report-users-officers"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/users?page=1&limit=5000&excludeRole=PROVIDER")
        if (!res.ok) return { users: [] as Array<{ first_name?: string; last_name?: string; name?: string }> }
        return res.json()
      } catch {
        return { users: [] as Array<{ first_name?: string; last_name?: string; name?: string }> }
      }
    },
  })

  const filteredRows = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null

    return approvalRows.filter((row) => {
      const createdAt = new Date(row.created_at)
      if (from && createdAt < from) return false
      if (to && createdAt > to) return false
      if (officerFilter) {
        const isGeneratedByOfficer = row.generated_by === officerFilter
        const isApprovedByOfficer = row.approved_by === officerFilter
        const isRejectedByOfficer = row.rejected_by === officerFilter
        if (!isGeneratedByOfficer && !isApprovedByOfficer && !isRejectedByOfficer) return false
      }
      return true
    })
  }, [approvalRows, fromDate, toDate, officerFilter])

  const providerRequestRows: ProviderRequestRow[] = providerRequestsData?.provider_requests || []
  const filteredProviderRequestRows = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null

    return providerRequestRows.filter((row) => {
      const displayName = row.beneficiary_name || row.enrollee_name || ""
      if (isTestEnrolleeName(displayName)) return false

      const createdAt = new Date(row.date)
      if (from && createdAt < from) return false
      if (to && createdAt > to) return false

      if (officerFilter) {
        if (row.status === "APPROVED" || row.status === "PARTIAL") {
          if ((row.approved_by || "") !== officerFilter) return false
        }
        if (row.status === "REJECTED") {
          if ((row.rejected_by || "") !== officerFilter) return false
        }
      }

      return row.status === "APPROVED" || row.status === "REJECTED" || row.status === "PARTIAL"
    })
  }, [providerRequestRows, fromDate, toDate, officerFilter])

  const manualCodeRows: ManualCodeRow[] = manualCodesData?.codes || []
  const filteredManualCodeRows = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null

    return manualCodeRows.filter((row) => {
      if (isTestEnrolleeName(row.enrollee_name || "")) return false

      const createdAt = new Date(row.created_at)
      if (from && createdAt < from) return false
      if (to && createdAt > to) return false

      const generator = `${row.generated_by?.first_name || ""} ${row.generated_by?.last_name || ""}`.trim()
      if (officerFilter && generator !== officerFilter) return false

      return true
    })
  }, [manualCodeRows, fromDate, toDate, officerFilter])

  const officers = useMemo(() => {
    const names = (usersData?.users || [])
      .map((u: any) => u?.name || `${u?.first_name || ""} ${u?.last_name || ""}`.trim())
      .filter(Boolean)

    const unique = Array.from(new Set(names))
    return unique.sort((a, b) => a.localeCompare(b))
  }, [usersData])

  const metrics = useMemo(() => {
    const manualCodes = filteredManualCodeRows.length
    const approved = filteredProviderRequestRows.filter((r) => r.status === "APPROVED").length
    const rejected = filteredProviderRequestRows.filter((r) => r.status === "REJECTED").length
    const partial = filteredProviderRequestRows.filter((r) => r.status === "PARTIAL").length
    const totalCodes = manualCodes + approved + rejected + partial
    return { totalCodes, approved, rejected, partial, manualCodes }
  }, [filteredProviderRequestRows, filteredManualCodeRows])

  const summaryByOfficer = useMemo(() => {
    const map = new Map<
      string,
      { officer: string; approved: number; rejected: number; partial: number; manualGenerated: number }
    >()

    for (const row of filteredProviderRequestRows) {
      const approverKey = row.approved_by || "System"
      const rejectorKey = row.rejected_by || "System"

      if (row.status === "APPROVED") {
        if (!map.has(approverKey)) {
          map.set(approverKey, { officer: approverKey, approved: 0, rejected: 0, partial: 0, manualGenerated: 0 })
        }
        map.get(approverKey)!.approved += 1
      }

      if (row.status === "PARTIAL") {
        if (!map.has(approverKey)) {
          map.set(approverKey, { officer: approverKey, approved: 0, rejected: 0, partial: 0, manualGenerated: 0 })
        }
        map.get(approverKey)!.partial += 1
      }

      if (row.status === "REJECTED") {
        if (!map.has(rejectorKey)) {
          map.set(rejectorKey, { officer: rejectorKey, approved: 0, rejected: 0, partial: 0, manualGenerated: 0 })
        }
        map.get(rejectorKey)!.rejected += 1
      }
    }

    for (const row of filteredManualCodeRows) {
      const generatorKey = `${row.generated_by?.first_name || ""} ${row.generated_by?.last_name || ""}`.trim() || "System"
      if (!map.has(generatorKey)) {
        map.set(generatorKey, { officer: generatorKey, approved: 0, rejected: 0, partial: 0, manualGenerated: 0 })
      }
      map.get(generatorKey)!.manualGenerated += 1
    }

    const summary = Array.from(map.values()).sort((a, b) => b.approved - a.approved)
    if (officerFilter) {
      return summary.filter((item) => item.officer === officerFilter)
    }
    return summary
  }, [filteredProviderRequestRows, filteredManualCodeRows, officerFilter])

  const officerOptions = useMemo(
    () => officers.map((officer) => ({ value: officer, label: officer })),
    [officers]
  )

  const exportCsv = () => {
    const headers = ["Date", "Enrollee", "Provider", "Code", "Status", "Approved By", "Generated By"]
    const lines = [
      headers.map(csvEscape).join(","),
      ...filteredRows.map((row) =>
        [
          new Date(row.created_at).toLocaleDateString("en-GB"),
          row.enrollee_name,
          row.hospital,
          row.approval_code,
          row.status,
          row.status === "REJECTED"
            ? (row.rejected_by || "-")
            : (row.approved_by || row.generated_by || "-"),
          row.generated_by || "System",
        ]
          .map(csvEscape)
          .join(",")
      ),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `call-centre-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PermissionGate module="reports" action="view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Call Centre Authorization Report</h1>
            <p className="text-gray-600">Authorization report and officer activity summary</p>
          </div>
          <Button onClick={exportCsv} variant="outline" className="border-red-600 text-red-600 hover:bg-red-50">
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Date From</p>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Date To</p>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Combobox
              options={officerOptions}
              value={officerFilter}
              onValueChange={setOfficerFilter}
              placeholder="Search and select officer"
              searchPlaceholder="Search officers..."
              emptyText="No officer found"
              clearable
            />
            <div className="flex gap-2">
              <Button className="bg-red-600 hover:bg-red-700 text-white flex-1">Apply Filter</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setFromDate("")
                  setToDate("")
                  setOfficerFilter("")
                }}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Codes</p><p className="text-2xl font-bold">{metrics.totalCodes.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Approved</p><p className="text-2xl font-bold text-green-600">{metrics.approved.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Rejected</p><p className="text-2xl font-bold text-red-600">{metrics.rejected.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Partial</p><p className="text-2xl font-bold text-amber-600">{metrics.partial.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Manual Codes</p><p className="text-2xl font-bold">{metrics.manualCodes.toLocaleString()}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Authorization Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="bg-zinc-900">
                <TableRow className="hover:bg-zinc-900">
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-white">Enrollee</TableHead>
                  <TableHead className="text-white">Provider</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                  <TableHead className="text-white">Processed By</TableHead>
                  <TableHead className="text-white">Request Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
                ) : filteredProviderRequestRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>No records found</TableCell></TableRow>
                ) : (
                  filteredProviderRequestRows.slice(0, 100).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.date).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell>{row.enrollee_name || row.beneficiary_name || "-"}</TableCell>
                      <TableCell>{row.provider_name || "-"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(row.status)}`}>
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.status === "REJECTED"
                          ? (row.rejected_by || "-")
                          : (row.approved_by || "-")}
                      </TableCell>
                      <TableCell>{new Date(row.date).toLocaleDateString("en-GB")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary by Officer</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Officer</TableHead>
                  <TableHead>Request Approved (Provider)</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Partial</TableHead>
                  <TableHead>Code Manually Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByOfficer.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>No summary data</TableCell></TableRow>
                ) : (
                  summaryByOfficer.map((item) => (
                    <TableRow key={item.officer}>
                      <TableCell>{item.officer}</TableCell>
                      <TableCell>{item.approved}</TableCell>
                      <TableCell>{item.rejected}</TableCell>
                      <TableCell>{item.partial}</TableCell>
                      <TableCell>{item.manualGenerated}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
