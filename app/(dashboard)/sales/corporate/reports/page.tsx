"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Eye, Edit, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { ReportStatusBadge } from "@/components/sales/report-status-badge"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SalesSubmodule, ReportType, SalesReportStatus } from "@prisma/client"

export default function CorporateSalesReportsPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["corporate-sales-reports", page, search, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        submodule: SalesSubmodule.CORPORATE_SALES,
        ...(search && { search }),
        ...(typeFilter !== "all" && { report_type: typeFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      })
      const res = await fetch(`/api/sales/reports?${params}`)
      if (!res.ok) throw new Error("Failed to fetch reports")
      return res.json()
    },
  })

  const reports = data?.data?.reports || []
  const pagination = data?.data?.pagination

  const getTypeLabel = (type: ReportType) => {
    return type.replace(/_/g, " ")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Public Sector Channel Reports</h1>
          <p className="text-muted-foreground">Manage and track all public sector channel reports</p>
        </div>
        <PermissionGate permission="sales:add">
          <Link href="/sales/corporate/reports/add">
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Add Report
            </Button>
          </Link>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reports</CardTitle>
              <CardDescription>All public sector channel reports</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
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
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No reports found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Sales Amount</TableHead>
                    <TableHead>Achievement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report: any) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.report_id}</TableCell>
                      <TableCell>{report.title}</TableCell>
                      <TableCell>{getTypeLabel(report.report_type)}</TableCell>
                      <TableCell>{report.region?.name || "N/A"}</TableCell>
                      <TableCell>{report.branch?.name || "N/A"}</TableCell>
                      <TableCell>{report.branch?.state || report.state || "N/A"}</TableCell>
                      <TableCell>
                        {new Date(report.report_period).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {Number(report.sales_amount).toLocaleString("en-NG", {
                          style: "currency",
                          currency: "NGN",
                        })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            Number(report.achievement) < 80
                              ? "text-red-600"
                              : Number(report.achievement) <= 100
                              ? "text-yellow-600"
                              : "text-green-600"
                          }
                        >
                          {Number(report.achievement).toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <ReportStatusBadge status={report.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <PermissionGate permission="sales:view">
                              <DropdownMenuItem
                                onClick={() => router.push(`/sales/corporate/reports/${report.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                            </PermissionGate>
                            {(report.status === SalesReportStatus.DRAFT ||
                              report.status === SalesReportStatus.SUBMITTED) && (
                              <PermissionGate permission="sales:edit">
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/sales/corporate/reports/${report.id}/edit`)
                                  }
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              </PermissionGate>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                      disabled={page === pagination.pages}
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
  )
}
