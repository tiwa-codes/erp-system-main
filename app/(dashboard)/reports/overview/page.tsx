"use client"

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
  Building2,
  Activity,
  MoreHorizontal
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/ui/permission-gate"
import { exportToExcel, exportToPDF, exportToCSV, getReportDataStructure } from "@/lib/export-utils"

interface OverviewMetrics {
  total_claims_vetted: number
  total_payout: number
  total_pending_claims: number
  total_pending_payout: number
  claims_trend: number
  payout_trend: number
  pending_claims_trend: number
  pending_payout_trend: number
}

interface OrganizationBreakdown {
  id: string
  organization_name: string
  enrollees_count: number
  services_count: number
  performance_score: number
  status: string
}

export default function OverviewBreakdown() {
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [filters, setFilters] = useState({
    category: "all",
    department: "all",
    startDate: "",
    endDate: ""
  })

  // Fetch overview metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["overview-metrics", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.category) params.append("category", filters.category)
      if (filters.department) params.append("department", filters.department)
      if (filters.startDate) params.append("startDate", filters.startDate)
      if (filters.endDate) params.append("endDate", filters.endDate)
      
      const res = await fetch(`/api/reports/overview/metrics?${params}`)
      if (!res.ok) throw new Error("Failed to fetch metrics")
      return res.json()
    },
  })

  // Fetch organization breakdown data
  const { data: organizationsData, isLoading: organizationsLoading } = useQuery({
    queryKey: ["organizations-breakdown", currentPage, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...filters
      })
      
      const res = await fetch(`/api/reports/overview/organizations?${params}`)
      if (!res.ok) throw new Error("Failed to fetch organizations")
      return res.json()
    },
  })

  // Fetch categories for filter
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/reports/categories")
      if (!res.ok) throw new Error("Failed to fetch categories")
      return res.json()
    },
  })

  // Fetch departments for filter
  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/hr/departments")
      if (!res.ok) throw new Error("Failed to fetch departments")
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

  const organizations = organizationsData?.organizations || []
  const pagination = organizationsData?.pagination

  const handleGenerateReport = async () => {
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: "overview",
          category: filters.category !== "all" ? filters.category : "Analytics",
          department: filters.department !== "all" ? filters.department : "Reports",
          filters: {
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
        title: "Overview Report Generated",
        description: `${result.report.name} has been generated successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error Generating Report",
        description: "Failed to generate overview report. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleExportExcel = () => {
    try {
      const reportData = getReportDataStructure('overview', organizations || [], filters)
      const result = exportToExcel(reportData, `overview-report-${new Date().toISOString().split('T')[0]}.xlsx`)
      
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
      const reportData = getReportDataStructure('overview', organizations || [], filters)
      const result = await exportToPDF(reportData, `overview-report-${new Date().toISOString().split('T')[0]}.pdf`)
      
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

  const getPerformanceBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
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
            <h1 className="text-3xl font-bold tracking-tight">Overview Breakdown</h1>
            <p className="text-muted-foreground">Comprehensive analytics and performance metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Activity className="h-4 w-4 mr-1" />
              Real-time Analytics
            </Badge>
          </div>
        </div>

        {/* Report Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
            <CardDescription className="mt-2">Filter overview data by category, department, and date range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categoriesData?.categories?.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={filters.department} onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departmentsData?.departments?.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
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
              <div className="text-2xl font-bold text-blue-600">{metrics.total_payout}</div>
              <p className="text-xs text-blue-600">
                {metrics.payout_trend > 0 ? '+' : ''}{metrics.payout_trend}% from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pending Claims</CardTitle>
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-yellow-600" />
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

        {/* Overview Breakdown Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Overview Breakdown</CardTitle>
                <CardDescription className="mt-2">Organization performance and analytics</CardDescription>
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
            {organizationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading organizations...</div>
              </div>
            ) : organizations.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No organizations found</div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ORGANIZATION</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEES</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SERVICES</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PERFORMANCE</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((org: OrganizationBreakdown) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-mono text-sm">
                          {org.id.slice(-8)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-red-400">
                                {org.organization_name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{org.organization_name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{org.enrollees_count}</TableCell>
                        <TableCell>{org.services_count}</TableCell>
                        <TableCell>
                          <Badge className={getPerformanceBadgeColor(org.performance_score)}>
                            {org.performance_score}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
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
