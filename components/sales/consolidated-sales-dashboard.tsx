"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { SalesSubmodule, ReportType } from "@prisma/client"
import { Eye, Search, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ReportStatusBadge } from "@/components/sales/report-status-badge"
import { SALES_SUBMODULE_LABELS } from "@/lib/sales"

type ConsolidatedSalesDashboardProps = {
  showAnnualTargetButton?: boolean
}

const SALES_REPORT_VIEW_PATHS: Record<SalesSubmodule, string> = {
  CORPORATE_SALES: "/sales/corporate/reports",
  AGENCY_SALES: "/sales/agency/reports",
  SPECIAL_RISKS_SALES: "/sales/special-risks/reports",
  SALES_OPERATIONS: "/sales/operations/reports",
}

type SalesRegion = {
  id: string
  name: string
  branches?: { id: string; name: string; state: string }[]
}

type SalesReportRow = {
  id: string
  report_id: string
  title: string
  submodule: SalesSubmodule
  report_type: ReportType
  status: string
  state: string | null
  report_period: string
  sales_amount: number
  target_amount: number
  submitted_by_id: string | null
  submitted_by?: {
    id: string
    first_name?: string | null
    last_name?: string | null
    email?: string | null
  } | null
  region?: {
    id: string
    name: string
  } | null
  branch?: {
    id: string
    name: string
    state: string
  } | null
}

type AggregatedByLocationRow = {
  key: string
  region: string
  branch: string
  state: string
  channel: string
  annualTarget: number
  ytdTarget: number
  ytdActual: number
  runRate: number
}

type AggregatedByOfficerRow = {
  key: string
  officer: string
  region: string
  branch: string
  state: string
  channel: string
  annualTarget: number
  ytdTarget: number
  ytdActual: number
  runRate: number
}

export function ConsolidatedSalesDashboard({ showAnnualTargetButton = false }: ConsolidatedSalesDashboardProps) {
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [submoduleFilter, setSubmoduleFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [branchFilter, setBranchFilter] = useState<string>("all")

  const { data: regionsData } = useQuery({
    queryKey: ["settings-sales-regions-with-branches"],
    queryFn: async () => {
      const res = await fetch("/api/settings/sales-regions?include_branches=true")
      if (!res.ok) throw new Error("Failed to fetch sales regions")
      return res.json()
    },
  })

  const regions = (regionsData?.data || []) as SalesRegion[]
  const selectedRegion = regions.find((region) => region.id === regionFilter) || null
  const branchOptions = selectedRegion?.branches || []

  const { data: reportsData } = useQuery({
    queryKey: [
      "consolidated-sales-reports-table-view",
      search,
      submoduleFilter,
      typeFilter,
      statusFilter,
      regionFilter,
      branchFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "1000",
        ...(search && { search }),
        ...(submoduleFilter !== "all" && { submodule: submoduleFilter }),
        ...(typeFilter !== "all" && { report_type: typeFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(regionFilter !== "all" && { region_id: regionFilter }),
        ...(branchFilter !== "all" && { branch_id: branchFilter }),
      })
      const res = await fetch(`/api/executive-desk/consolidated-sales?${params}`)
      if (!res.ok) throw new Error("Failed to fetch consolidated sales reports")
      return res.json()
    },
  })

  const reports = ((reportsData?.data?.reports || []) as SalesReportRow[]).map((report) => ({
    ...report,
    sales_amount: Number(report.sales_amount || 0),
    target_amount: Number(report.target_amount || 0),
  }))

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonthNumber = now.getMonth() + 1
  const ytdReports = reports.filter((report) => {
    const reportDate = new Date(report.report_period)
    if (Number.isNaN(reportDate.getTime())) return false
    if (reportDate.getFullYear() !== currentYear) return false
    // Count all entries within the current year up to the current month.
    return reportDate.getMonth() + 1 <= currentMonthNumber
  })

  const aggregateByLocation = useMemo<AggregatedByLocationRow[]>(() => {
    const bucket = new Map<string, AggregatedByLocationRow>()

    for (const report of ytdReports) {
      const region = report.region?.name?.trim() || "N/A"
      const branch = report.branch?.name?.trim() || "N/A"
      const state = report.branch?.state?.trim() || report.state?.trim() || "N/A"
      const channel = SALES_SUBMODULE_LABELS[report.submodule] || report.submodule
      const key = `${region}__${branch}__${state}__${report.submodule}`

      if (!bucket.has(key)) {
        bucket.set(key, {
          key,
          region,
          branch,
          state,
          channel,
          annualTarget: Number(report.target_amount || 0),
          ytdTarget: 0,
          ytdActual: 0,
          runRate: 0,
        })
      }

      const entry = bucket.get(key)!
      entry.annualTarget = Math.max(entry.annualTarget, Number(report.target_amount || 0))
      entry.ytdActual += Number(report.sales_amount || 0)
      entry.ytdTarget = (entry.annualTarget / 12) * currentMonthNumber
      entry.runRate = entry.ytdTarget - entry.ytdActual
    }

    return Array.from(bucket.values()).sort((a, b) => {
      const regionCompare = a.region.localeCompare(b.region)
      if (regionCompare !== 0) return regionCompare
      const branchCompare = a.branch.localeCompare(b.branch)
      if (branchCompare !== 0) return branchCompare
      return a.channel.localeCompare(b.channel)
    })
  }, [currentMonthNumber, ytdReports])

  const aggregateByOfficer = useMemo<AggregatedByOfficerRow[]>(() => {
    const bucket = new Map<string, AggregatedByOfficerRow>()

    for (const report of ytdReports) {
      const officer =
        `${report.submitted_by?.first_name || ""} ${report.submitted_by?.last_name || ""}`.trim() ||
        report.submitted_by?.email ||
        "N/A"
      const region = report.region?.name?.trim() || "N/A"
      const branch = report.branch?.name?.trim() || "N/A"
      const state = report.branch?.state?.trim() || report.state?.trim() || "N/A"
      const channel = SALES_SUBMODULE_LABELS[report.submodule] || report.submodule
      const key = `${report.submitted_by_id || "na"}__${region}__${branch}__${report.submodule}`

      if (!bucket.has(key)) {
        bucket.set(key, {
          key,
          officer,
          region,
          branch,
          state,
          channel,
          annualTarget: Number(report.target_amount || 0),
          ytdTarget: 0,
          ytdActual: 0,
          runRate: 0,
        })
      }

      const entry = bucket.get(key)!
      entry.annualTarget = Math.max(entry.annualTarget, Number(report.target_amount || 0))
      entry.ytdActual += Number(report.sales_amount || 0)
      entry.ytdTarget = (entry.annualTarget / 12) * currentMonthNumber
      entry.runRate = entry.ytdTarget - entry.ytdActual
    }

    return Array.from(bucket.values()).sort((a, b) => a.officer.localeCompare(b.officer))
  }, [currentMonthNumber, ytdReports])

  const locationTotals = useMemo(() => {
    return aggregateByLocation.reduce(
      (acc, row) => {
        acc.annualTarget += row.annualTarget
        acc.ytdTarget += row.ytdTarget
        acc.ytdActual += row.ytdActual
        acc.runRate += row.runRate
        return acc
      },
      { annualTarget: 0, ytdTarget: 0, ytdActual: 0, runRate: 0 }
    )
  }, [aggregateByLocation])

  const formatCurrency = (value: number) =>
    value.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Consolidated Sales</h1>
          <p className="text-muted-foreground">Sales data grouped by region, branch and state.</p>
        </div>

        {showAnnualTargetButton ? (
          <Button onClick={() => router.push("/settings/sales-targets")}>
            <Settings2 className="mr-2 h-4 w-4" />
            Configure Targets
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter submitted reports used to build consolidated tables.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <Select value={submoduleFilter} onValueChange={setSubmoduleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Submodule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Submodules</SelectItem>
                <SelectItem value="CORPORATE_SALES">{SALES_SUBMODULE_LABELS.CORPORATE_SALES}</SelectItem>
                <SelectItem value="AGENCY_SALES">{SALES_SUBMODULE_LABELS.AGENCY_SALES}</SelectItem>
                <SelectItem value="SPECIAL_RISKS_SALES">{SALES_SUBMODULE_LABELS.SPECIAL_RISKS_SALES}</SelectItem>
                <SelectItem value="SALES_OPERATIONS">{SALES_SUBMODULE_LABELS.SALES_OPERATIONS}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="HALF_YEARLY">Half-Yearly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="VETTED">Vetted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="FINAL_COPY_UPLOADED">Final Copy Uploaded</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={regionFilter}
              onValueChange={(value) => {
                setRegionFilter(value)
                setBranchFilter("all")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter} disabled={regionFilter === "all"}>
              <SelectTrigger>
                <SelectValue placeholder={regionFilter === "all" ? "Select region first" : "Branch"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branchOptions.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.state})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales Data Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary hover:bg-primary">
                  <TableHead className="text-primary-foreground">Region</TableHead>
                  <TableHead className="text-primary-foreground">Branch</TableHead>
                  <TableHead className="text-primary-foreground">State</TableHead>
                  <TableHead className="text-primary-foreground">Channel</TableHead>
                  <TableHead className="text-primary-foreground text-right">Annual Target</TableHead>
                  <TableHead className="text-primary-foreground text-right">YTD Target</TableHead>
                  <TableHead className="text-primary-foreground text-right">YTD Actual</TableHead>
                  <TableHead className="text-primary-foreground text-right">Run Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregateByLocation.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No report data found
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {aggregateByLocation.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>{row.region}</TableCell>
                        <TableCell>{row.branch}</TableCell>
                        <TableCell>{row.state}</TableCell>
                        <TableCell>{row.channel}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.annualTarget)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.ytdTarget)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.ytdActual)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.runRate)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(locationTotals.annualTarget)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(locationTotals.ytdTarget)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(locationTotals.ytdActual)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(locationTotals.runRate)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Individual Performance Data Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary hover:bg-primary">
                  <TableHead className="text-primary-foreground">Officer</TableHead>
                  <TableHead className="text-primary-foreground">Region</TableHead>
                  <TableHead className="text-primary-foreground">Branch</TableHead>
                  <TableHead className="text-primary-foreground">State</TableHead>
                  <TableHead className="text-primary-foreground">Channel</TableHead>
                  <TableHead className="text-primary-foreground text-right">Annual Target</TableHead>
                  <TableHead className="text-primary-foreground text-right">YTD Target</TableHead>
                  <TableHead className="text-primary-foreground text-right">YTD Actual</TableHead>
                  <TableHead className="text-primary-foreground text-right">Run Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregateByOfficer.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No officer data found
                    </TableCell>
                  </TableRow>
                ) : (
                  aggregateByOfficer.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>{row.officer}</TableCell>
                      <TableCell>{row.region}</TableCell>
                      <TableCell>{row.branch}</TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell>{row.channel}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.annualTarget)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.ytdTarget)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.ytdActual)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.runRate)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Reports</CardTitle>
          <CardDescription>All reports with submitter and status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report ID</TableHead>
                  <TableHead>Submodule</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Sales Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground">
                      No reports found
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => {
                    const submittedBy =
                      `${report.submitted_by?.first_name || ""} ${report.submitted_by?.last_name || ""}`.trim() ||
                      report.submitted_by?.email ||
                      "N/A"
                    const routeBase = SALES_REPORT_VIEW_PATHS[report.submodule]

                    return (
                      <TableRow key={report.id}>
                        <TableCell>{report.report_id}</TableCell>
                        <TableCell>{SALES_SUBMODULE_LABELS[report.submodule]}</TableCell>
                        <TableCell>{report.title}</TableCell>
                        <TableCell>{submittedBy}</TableCell>
                        <TableCell>{report.report_type.replace(/_/g, " ")}</TableCell>
                        <TableCell>{report.region?.name || "N/A"}</TableCell>
                        <TableCell>{report.branch?.name || "N/A"}</TableCell>
                        <TableCell>{report.branch?.state || report.state || "N/A"}</TableCell>
                        <TableCell>{new Date(report.report_period).toLocaleDateString()}</TableCell>
                        <TableCell>{formatCurrency(report.sales_amount)}</TableCell>
                        <TableCell>
                          <ReportStatusBadge status={report.status as any} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!routeBase) return
                                  router.push(`${routeBase}/${report.id}`)
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
