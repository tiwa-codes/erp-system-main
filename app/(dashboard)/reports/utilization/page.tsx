"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  FileText,
  Download,
  Calendar,
  Filter,
  Eye,
  MoreHorizontal
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/ui/permission-gate"
import { exportToExcel, exportToPDF, exportToCSV, getReportDataStructure } from "@/lib/export-utils"



interface UtilizationMetrics {
  total_claims_vetted: number
  total_payout: number
  total_pending_claims: number
  total_pending_payout: number
  claims_trend: number
  payout_trend: number
  pending_claims_trend: number
  pending_payout_trend: number
}

interface EnrolleeUtilization {
  id: string
  enrollee_id: string
  enrollee_name: string
  plan_name: string
  amount_utilized: number
  balance: number
  status: string
}

export default function UtilizationDashboard() {
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [filters, setFilters] = useState({
    plan: "all",
    status: "all",
    startDate: "",
    endDate: ""
  })

  // Fetch utilization metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["utilization-metrics", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.plan) params.append("plan", filters.plan)
      if (filters.status) params.append("status", filters.status)
      if (filters.startDate) params.append("startDate", filters.startDate)
      if (filters.endDate) params.append("endDate", filters.endDate)
      
      const res = await fetch(`/api/reports/utilization/metrics?${params}`)
      if (!res.ok) throw new Error("Failed to fetch metrics")
      return res.json()
    },
  })

  // Fetch enrollees utilization data
  const { data: enrolleesData, isLoading: enrolleesLoading } = useQuery({
    queryKey: ["enrollees-utilization", currentPage, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...filters
      })
      
      const res = await fetch(`/api/reports/utilization/enrollees?${params}`)
      if (!res.ok) throw new Error("Failed to fetch enrollees")
      return res.json()
    },
  })

  // Fetch plans for filter
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/plans")
      if (!res.ok) throw new Error("Failed to fetch plans")
      return res.json()
    },
  })

  const metrics = metricsData?.metrics || {
    total_claims_vetted: 0,
    total_payout: 0,
    total_pending_claims: 0,
    total_pending_payout: 0,
    claims_trend: 0,
    payout_trend: 0,
    pending_claims_trend: 0,
    pending_payout_trend: 0
  }

  const enrollees = enrolleesData?.enrollees || []
  const pagination = enrolleesData?.pagination

  const handleGenerateReport = async () => {
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: "utilization",
          category: "Utilization",
          department: "Reports",
          filters: {
            plan: filters.plan !== "all" ? filters.plan : null,
            status: filters.status !== "all" ? filters.status : null,
            startDate: filters.startDate,
            endDate: filters.endDate
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const result = await response.json()
      
      toast({
        title: "Utilization Report Generated",
        description: `${result.report.name} has been generated successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error Generating Report",
        description: "Failed to generate utilization report. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleExportExcel = () => {
    try {
      const reportData = getReportDataStructure('utilization', enrollees || [], filters)
      const result = exportToExcel(reportData, `utilization-report-${new Date().toISOString().split('T')[0]}.xlsx`)
      
      if (result.success) {
        toast({
          title: "Export Successful",
          description: `Excel file "${result.filename}" has been downloaded successfully.`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export Excel file. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleExportPDF = async () => {
    try {
      const reportData = getReportDataStructure('utilization', enrollees || [], filters)
      const result = await exportToPDF(reportData, `utilization-report-${new Date().toISOString().split('T')[0]}.pdf`)
      
      if (result.success) {
        toast({
          title: "Export Successful",
          description: `PDF file "${result.filename}" has been downloaded successfully.`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export PDF file. Please try again.",
        variant: "destructive"
      })
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-red-100 text-red-800'
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="reports" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Utilization</h1>
            <p className="text-muted-foreground">Manage utilization</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Users className="h-4 w-4 mr-1" />
              Real-time Data
            </Badge>
          </div>
        </div>

        {/* Utility Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Utility Filter</CardTitle>
            <CardDescription className="mt-2">Filter utilization data by plan, status, and date range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <Select value={filters.plan} onValueChange={(value) => setFilters(prev => ({ ...prev, plan: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    {plansData?.plans?.map((plan: any) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  placeholder="dd-mm-yyyy"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  placeholder="dd-mm-yyyy"
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button onClick={handleGenerateReport} className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Claims Vetted</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{metrics.total_claims_vetted}</div>
              <p className="text-xs text-blue-600">
                {metrics.claims_trend > 0 ? '+' : ''}{metrics.claims_trend}% from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payout</CardTitle>
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{metrics.total_payout}</div>
              <p className="text-xs text-green-600">
                {metrics.payout_trend > 0 ? '+' : ''}{metrics.payout_trend}% from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pending Claims</CardTitle>
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{metrics.total_pending_claims}%</div>
              <p className="text-xs text-orange-600">
                {metrics.pending_claims_trend > 0 ? '+' : ''}{metrics.pending_claims_trend}% from target
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pending Payout</CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{metrics.total_pending_payout}</div>
              <p className="text-xs text-gray-600">
                Reporting this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* All Enrollees Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Enrollees</CardTitle>
                <CardDescription className="mt-2">Enrollee utilization and balance information</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button variant="destructive" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {enrolleesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading enrollees...</div>
              </div>
            ) : enrollees.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No enrollees found</div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PLAN</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT UTILIZED</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">BALANCE</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollees.map((enrollee: EnrolleeUtilization) => (
                      <TableRow key={enrollee.id}>
                        <TableCell className="font-mono text-sm">
                          {enrollee.enrollee_id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-red-400">
                                {enrollee.enrollee_name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{enrollee.enrollee_name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{enrollee.plan_name}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          ₦{enrollee.amount_utilized.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          ₦{enrollee.balance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                className="w-full justify-start text-xs"
                              >
                                View
                              </DropdownMenuItem>
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
      </div>
    </PermissionGate>
  )
}
