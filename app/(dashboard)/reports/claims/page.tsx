"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"

export const dynamic = 'force-dynamic'

type ClaimRow = {
  id: string
  approval_code: string
  amount: number
  status: string
  created_at: string
  diagnosis?: string | null
  services?: string | null
  enrollee_name?: string
  enrollee_id?: string
  organization?: string
  plan?: string
  hospital?: string
  service_items?: Array<{
    service_name: string
    service_amount: number
    quantity: number
    category?: string | null
  }>
}

function csvEscape(value: unknown) {
  const str = String(value ?? "")
  return `"${str.replace(/"/g, '""')}"`
}

function isApprovalCode(value: string) {
  const code = (value || "").trim().toUpperCase()
  return /^(APR\/|M-APR-)/.test(code)
}

function splitServiceText(value?: string | null) {
  return (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function CollapsibleList({ values }: { values: string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (values.length === 0) return <span className="text-gray-400">-</span>

  const visible = expanded ? values : values.slice(0, 2)
  const hiddenCount = Math.max(0, values.length - visible.length)

  return (
    <div className="space-y-1">
      <div className="text-sm">{visible.join(", ")}</div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="text-xs text-blue-600 hover:underline"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  )
}

export default function ClaimsReportPage() {
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [search, setSearch] = useState("")
  const [organization, setOrganization] = useState("all")

  const { data, isLoading } = useQuery({
    queryKey: ["claims-report", fromDate, toDate, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        limit: "5000",
        ...(search ? { search } : {}),
        ...(fromDate ? { start_date: fromDate } : {}),
        ...(toDate ? { end_date: toDate } : {}),
      })
      const res = await fetch(`/api/call-centre/approval-codes?${params}`)
      if (!res.ok) throw new Error("Failed to fetch claims report data")
      return res.json()
    },
  })

  const rows: ClaimRow[] = (data?.approval_codes || []).filter((row: ClaimRow) => isApprovalCode(row.approval_code))

  const filteredRows = useMemo(() => {
    if (organization === "all") return rows
    return rows.filter((row) => {
      const organizationName = row.organization || ""
      return organizationName.toLowerCase() === organization.toLowerCase()
    })
  }, [rows, organization])

  const organizations = useMemo(() => {
    const values = Array.from(
      new Set(rows.map((r) => r.organization).filter((v): v is string => !!v))
    )
    return values.sort((a, b) => a.localeCompare(b))
  }, [rows])

  const premiumLikeData = useMemo(() => {
    const grouped = new Map<string, { name: string; usage: number; visits: number }>()
    for (const row of filteredRows) {
      const id = row.enrollee_id || row.id
      const name = row.enrollee_name || "N/A"
      const item = grouped.get(id) || { name, usage: 0, visits: 0 }
      item.usage += Number(row.amount || 0)
      item.visits += 1
      grouped.set(id, item)
    }
    return Array.from(grouped.values()).sort((a, b) => b.usage - a.usage)
  }, [filteredRows])

  const exportCsv = () => {
    const headers = ["Name", "Plan", "Organization", "Provider", "Diagnosis", "Service", "Medication", "Amount"]
    const lines = [
      headers.map(csvEscape).join(","),
      ...filteredRows.map((row) => {
        const serviceItems = row.service_items || []
        const serviceNames = serviceItems
          .filter((item) => (item.category || "").toUpperCase() !== "DRG")
          .map((item) => item.service_name)
        const medicationNames = serviceItems
          .filter((item) => (item.category || "").toUpperCase() === "DRG")
          .map((item) => item.service_name)

        return [
          row.enrollee_name || "N/A",
          row.plan || "N/A",
          row.organization || "N/A",
          row.hospital || "N/A",
          row.diagnosis || "N/A",
          serviceNames.join(", ") || row.services || "N/A",
          medicationNames.join(", ") || "-",
          Number(row.amount || 0),
        ]
          .map(csvEscape)
          .join(",")
      }),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `claims-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PermissionGate module="reports" action="view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Claims Report</h1>
            <p className="text-gray-600">Claims utilization and high-usage analysis</p>
          </div>
          <Button onClick={exportCsv} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <Select value={organization} onValueChange={setOrganization}>
              <SelectTrigger>
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {organizations.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search claims..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              variant="ghost"
              onClick={() => {
                setFromDate("")
                setToDate("")
                setSearch("")
                setOrganization("all")
              }}
            >
              Reset
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>1. Utilization by Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Medication</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7}>Loading...</TableCell></TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7}>No records found</TableCell></TableRow>
                ) : (
                  filteredRows.slice(0, 150).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.enrollee_name || "N/A"}</TableCell>
                      <TableCell>{row.plan || "N/A"}</TableCell>
                      <TableCell>{row.hospital || "N/A"}</TableCell>
                      <TableCell>{row.diagnosis || "N/A"}</TableCell>
                      <TableCell>
                        <CollapsibleList
                          values={
                            (row.service_items || []).length > 0
                              ? (row.service_items || [])
                                  .filter((item) => (item.category || "").toUpperCase() !== "DRG")
                                  .map((item) => item.service_name)
                              : splitServiceText(row.services)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <CollapsibleList
                          values={(row.service_items || [])
                            .filter((item) => (item.category || "").toUpperCase() === "DRG")
                            .map((item) => item.service_name)}
                        />
                      </TableCell>
                      <TableCell>₦{Number(row.amount || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Utilization Based on Premium</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Loss Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {premiumLikeData.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>No data</TableCell></TableRow>
                ) : (
                  premiumLikeData.slice(0, 50).map((item, idx) => {
                    const premium = item.usage
                    const ratio = premium > 0 ? (item.usage / premium) * 100 : 0
                    return (
                      <TableRow key={`${item.name}-${idx}`}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>₦{premium.toLocaleString()}</TableCell>
                        <TableCell>₦{item.usage.toLocaleString()}</TableCell>
                        <TableCell>₦0</TableCell>
                        <TableCell>{ratio.toFixed(0)}%</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Utilization Based on Plan Limit</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Limit</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>% Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {premiumLikeData.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>No data</TableCell></TableRow>
                ) : (
                  premiumLikeData.slice(0, 50).map((item, idx) => (
                    <TableRow key={`limit-${idx}`}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>₦{item.usage.toLocaleString()}</TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>N/A</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Enrollees with High Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {premiumLikeData.length === 0 ? (
                  <TableRow><TableCell colSpan={4}>No data</TableCell></TableRow>
                ) : (
                  premiumLikeData.slice(0, 20).map((item, idx) => {
                    const risk = item.usage >= 300000 ? "High" : item.usage >= 100000 ? "Medium" : "Low"
                    return (
                      <TableRow key={`risk-${idx}`}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.visits}</TableCell>
                        <TableCell>₦{item.usage.toLocaleString()}</TableCell>
                        <TableCell>{risk}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
