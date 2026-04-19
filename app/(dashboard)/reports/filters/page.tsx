"use client"

import { useState } from "react"
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
  FileText,
  Download,
  Filter,
  Calendar,
  Printer,
  FileSpreadsheet,
  FileImage,
  MoreHorizontal,
  Eye
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/ui/permission-gate"
import { exportToExcel, exportToPDF, exportToCSV, getReportDataStructure } from "@/lib/export-utils"

interface ReportData {
  id: string
  category: string
  department: string
  report_type: string
  generated_date: string
  status: string
}

export default function ReportFilters() {
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    category: "all",
    reportType: "all"
  })

  // Fetch report data
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ["reports-data", currentPage, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...filters
      })
      
      const res = await fetch(`/api/reports/filters/data?${params}`)
      if (!res.ok) throw new Error("Failed to fetch reports")
      return res.json()
    },
  })

  // Fetch categories for filter
  const { data: categoriesData } = useQuery({
    queryKey: ["report-categories"],
    queryFn: async () => {
      const res = await fetch("/api/reports/categories")
      if (!res.ok) throw new Error("Failed to fetch categories")
      return res.json()
    },
  })

  const reports = reportsData?.reports || []
  const pagination = reportsData?.pagination

  const handleGenerateReport = async () => {
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: filters.reportType !== "all" ? filters.reportType : "utilization",
          category: filters.category !== "all" ? filters.category : "General",
          department: "Reports",
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
        title: "Report Generated Successfully",
        description: `${result.report.name} has been generated and is ready for download.`,
      })

      // Refresh the reports list
      window.location.reload()
    } catch (error) {
      toast({
        title: "Error Generating Report",
        description: "Failed to generate report. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleExportExcel = async () => {
    try {
      const reportData = getReportDataStructure('filters', reports, filters)
      const result = exportToExcel(reportData, `report-filters-${new Date().toISOString().split('T')[0]}.xlsx`)
      
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
      const reportData = getReportDataStructure('filters', reports, filters)
      const result = await exportToPDF(reportData, `report-filters-${new Date().toISOString().split('T')[0]}.pdf`)
      
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

  const handlePrint = () => {
    toast({
      title: "Print Started",
      description: "Report is being prepared for printing.",
    })
  }

  const handleDownloadReport = async (report: ReportData) => {
    try {
      const response = await fetch(`/api/reports/download?id=${report.id}&format=csv`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to download report')
      }

      // Get the filename from the response headers or create one
      const contentDisposition = response.headers.get('content-disposition')
      let filename = `${report.report_type}_${report.id}.csv`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Create blob and download
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Download Successful",
        description: `Report "${report.report_type}" has been downloaded successfully.`,
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download report. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleViewReport = async (report: ReportData) => {
    try {
      const response = await fetch(`/api/reports/download?id=${report.id}&format=json`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch report data')
      }

      const data = await response.json()
      
      // Create a modal or new window to display the report data
      const reportWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
      
      if (reportWindow) {
        reportWindow.document.write(`
          <html>
            <head>
              <title>${data.data.title || 'Report View'}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
                .header h1 { margin: 0; color: #333; }
                .header p { margin: 5px 0; color: #666; }
                .data-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .data-table th { background-color: #f2f2f2; }
                .data-table tr:nth-child(even) { background-color: #f9f9f9; }
                .no-data { text-align: center; color: #666; font-style: italic; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>${data.data.title || 'Report'}</h1>
                <p><strong>Generated:</strong> ${new Date(data.data.generatedAt).toLocaleString()}</p>
                <p><strong>Generated By:</strong> ${data.data.generatedBy}</p>
                ${data.data.totalEnrollees ? `<p><strong>Total Enrollees:</strong> ${data.data.totalEnrollees}</p>` : ''}
                ${data.data.totalOrganizations ? `<p><strong>Total Organizations:</strong> ${data.data.totalOrganizations}</p>` : ''}
              </div>
              
              ${data.data.data && Array.isArray(data.data.data) && data.data.data.length > 0 ? `
                <table class="data-table">
                  <thead>
                    <tr>
                      ${Object.keys(data.data.data[0]).map(key => `<th>${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${data.data.data.map((row: Record<string, unknown>) => `
                      <tr>
                        ${Object.values(row).map(value => `<td>${value}</td>`).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div class="no-data">No data available for this report</div>
              `}
            </body>
          </html>
        `)
        reportWindow.document.close()
      } else {
        // Fallback: show data in console and toast
        console.log('Report Data:', data.data)
        toast({
          title: "Report Data Loaded",
          description: `Report "${report.report_type}" data has been loaded. Check the browser console for details.`,
        })
      }
    } catch (error) {
      console.error('View error:', error)
      toast({
        title: "View Failed",
        description: error instanceof Error ? error.message : "Failed to load report data. Please try again.",
        variant: "destructive"
      })
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
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
            <h1 className="text-3xl font-bold tracking-tight">Report Filters</h1>
            <p className="text-muted-foreground">Advanced filtering and custom report generation</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Filter className="h-4 w-4 mr-1" />
              Advanced Filters
            </Badge>
          </div>
        </div>

        {/* Report Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
            <CardDescription className="mt-2">Advanced filtering and custom report generation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
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
                <Label htmlFor="reportType">Report Type</Label>
                <Select value={filters.reportType} onValueChange={(value) => setFilters(prev => ({ ...prev, reportType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Report" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reports</SelectItem>
                    <SelectItem value="utilization">Utilization Report</SelectItem>
                    <SelectItem value="financial">Financial Report</SelectItem>
                    <SelectItem value="claims">Claims Report</SelectItem>
                    <SelectItem value="provider">Provider Report</SelectItem>
                    <SelectItem value="enrollee">Enrollee Report</SelectItem>
                  </SelectContent>
                </Select>
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

        {/* Report Content Area */}
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Generated report will appear here</p>
                <p className="text-gray-400 text-sm">Use the filters above to generate your report</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overview Memo */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Overview Memo</CardTitle>
                <CardDescription className="mt-2">Report summary and export options</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button variant="destructive" onClick={handleExportPDF}>
                  <FileImage className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="secondary" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading reports...</div>
              </div>
            ) : reports.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No reports found</div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">CATEGORY</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DEPARTMENT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REPORT TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">GENERATED DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report: ReportData) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.category}
                        </TableCell>
                        <TableCell>{report.department}</TableCell>
                        <TableCell>{report.report_type}</TableCell>
                        <TableCell>{new Date(report.generated_date).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(report.status)}>
                            {report.status}
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
                              <DropdownMenuItem 
                                onClick={() => handleViewReport(report)}
                                className="w-full justify-start text-xs"
                              >
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDownloadReport(report)}
                                className="w-full justify-start text-xs"
                              >
                                Download
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
