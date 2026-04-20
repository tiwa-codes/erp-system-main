"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Download, Filter, FileText, TrendingUp, Users, Building, CreditCard, Phone, Shield, Stethoscope, ChevronLeft, ChevronRight, Video } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"



// Report types
const REPORT_TYPES = [
  {
    id: "UNDERWRITING",
    name: "Underwriting",
    icon: Building,
    description: "Organization, principal, dependent, and enrollee reports",
    filters: ["Organizations", "Principals", "Dependents", "Enrollees"]
  },
  {
    id: "FINANCE",
    name: "Finance (Claims Settlement)",
    icon: CreditCard,
    description: "Provider payout and settlement reports",
    filters: ["Providers"]
  },
  {
    id: "CALL_CENTRE",
    name: "Call Centre",
    icon: Phone,
    description: "Code generation, rejection, and utilization reports",
    filters: ["Total codes generated", "Total codes rejected", "Utilization per Enrollee", "Utilization per Provider", "Utilization per Organization"]
  },
  {
    id: "CLAIMS",
    name: "Claims",
    icon: FileText,
    description: "Claims processing, utilization, and workflow reports",
    filters: ["Total Claims", "Utilization by Organization", "Utilization by Enrollee", "Vetter", "Audit", "Approval"]
  },
  {
    id: "PROVIDER_MANAGEMENT",
    name: "Provider Management",
    icon: Stethoscope,
    description: "Provider and in-patient reports",
    filters: ["Providers", "In-patient"]
  },
  {
    id: "TELEMEDICINE",
    name: "Telemedicine",
    icon: Video,
    description: "Telemedicine appointments, orders, and patient reports",
    filters: ["Appointments", "Lab Orders", "Radiology Orders", "Pharmacy Orders", "Clinical Encounters"]
  }
]

export default function ReportsPage() {
  const [selectedReportType, setSelectedReportType] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("")
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false)

  // Get current report type configuration
  const currentReportType = REPORT_TYPES.find(type => type.id === selectedReportType)

  // Fetch report data based on selected type and filter
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["reports", selectedReportType, selectedFilter, startDate, endDate, currentPage, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: selectedReportType,
        filter: selectedFilter,
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(startDate && { from: startDate.toISOString() }),
        ...(endDate && { to: endDate.toISOString() })
      })

      const res = await fetch(`/api/reports?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch report data")
      }
      return res.json()
    },
    enabled: hasGeneratedReport && !!selectedReportType && !!selectedFilter
  })

  // Handle report type change
  const handleReportTypeChange = (type: string) => {
    setSelectedReportType(type)
    const reportType = REPORT_TYPES.find(r => r.id === type)
    if (reportType && reportType.filters.length > 0) {
      setSelectedFilter(reportType.filters[0])
    }
    setCurrentPage(1) // Reset to first page when changing report type
    setHasGeneratedReport(false) // Clear report when changing type
  }

  // Handle filter change
  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter)
    setCurrentPage(1) // Reset to first page when changing filter
    setHasGeneratedReport(false) // Clear report when changing filter
  }

  // Handle generate report
  const handleGenerateReport = () => {
    if (selectedReportType && selectedFilter) {
      setHasGeneratedReport(true)
      setCurrentPage(1)
    }
  }

  // Handle export
  const handleExport = () => {
    if (!reportData?.data || reportData.data.length === 0) {
      return
    }

    // Create CSV content
    const tableColumns = getTableColumns()
    const headers = tableColumns.map(col => col.label).join(',')
    const rows = reportData.data.map((row: any) => 
      tableColumns.map(col => `"${row[col.key] || ''}"`).join(',')
    ).join('\n')
    
    const csvContent = `${headers}\n${rows}`
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedReportType}_${selectedFilter}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Handle page size change
  const handlePageSizeChange = (size: string) => {
    setPageSize(Number(size))
    setCurrentPage(1) // Reset to first page when changing page size
  }

  // Get table columns based on report type and filter
  const getTableColumns = () => {
    switch (selectedReportType) {
      case "UNDERWRITING":
        switch (selectedFilter) {
          case "Organizations":
            return [
              { key: "date", label: "Date" },
              { key: "organizations_count", label: "Organizations" },
              { key: "principals_count", label: "Principals" },
              { key: "dependents_count", label: "Dependents" },
              { key: "total_enrollees", label: "Total Enrollees" }
            ]
          case "Principals":
            return [
              { key: "date", label: "Date" },
              { key: "principals_count", label: "Principals" },
              { key: "males_count", label: "Males" },
              { key: "females_count", label: "Females" }
            ]
          case "Dependents":
            return [
              { key: "date", label: "Date" },
              { key: "dependents_count", label: "Dependents" },
              { key: "males_count", label: "Males" },
              { key: "females_count", label: "Females" }
            ]
          case "Enrollees":
            return [
              { key: "date", label: "Date" },
              { key: "enrollees_count", label: "Enrollees" },
              { key: "plan_type_breakdown", label: "Plan Type Breakdown" },
              { key: "status_breakdown", label: "Status Breakdown" }
            ]
          default:
            return []
        }

      case "FINANCE":
        return [
          { key: "hospital_name", label: "Hospital" },
          { key: "paid_by", label: "Paid By" },
          { key: "payout_ready_date", label: "Payout Ready Date" },
          { key: "payment_date", label: "Payment Date" },
          { key: "amount", label: "Amount" }
        ]

      case "CALL_CENTRE":
        switch (selectedFilter) {
          case "Total codes generated":
            return [
              { key: "date", label: "Date" },
              { key: "codes_generated", label: "Codes Generated" },
              { key: "generated_by", label: "Generated By" },
              { key: "provider_name", label: "Provider" }
            ]
          case "Total codes rejected":
            return [
              { key: "date", label: "Date" },
              { key: "codes_rejected", label: "Codes Rejected" },
              { key: "rejected_by", label: "Rejected By" },
              { key: "provider_name", label: "Provider" }
            ]
          case "Utilization per Enrollee":
            return [
              { key: "name", label: "Name" },
              { key: "id", label: "ID" },
              { key: "plan_type", label: "Plan Type" },
              { key: "encounters", label: "Encounters" },
              { key: "costs", label: "Costs" }
            ]
          case "Utilization per Provider":
            return [
              { key: "provider_name", label: "Provider Name" },
              { key: "patient_volume", label: "Patient Volume" },
              { key: "service_utilized", label: "Service Utilized" },
              { key: "number_of_claims", label: "Number of Claims" },
              { key: "total_costs", label: "Total Costs" }
            ]
          case "Utilization per Organization":
            return [
              { key: "organization_name", label: "Organization" },
              { key: "all_enrollees", label: "All Enrollees" },
              { key: "provider_utilization", label: "Provider Utilization" },
              { key: "service_utilization", label: "Service Utilization" },
              { key: "high_cost_cases", label: "High Cost Cases" }
            ]
          default:
            return []
        }

      case "CLAIMS":
        switch (selectedFilter) {
          case "Total Claims":
            return [
              { key: "date", label: "Date" },
              { key: "total_claims", label: "Total Claims" },
              { key: "approved_claims", label: "Approved Claims" },
              { key: "rejected_claims", label: "Rejected Claims" },
              { key: "total_amount", label: "Total Amount" },
              { key: "average_amount", label: "Average Amount" }
            ]
          case "Utilization by Organization":
            return [
              { key: "organization_name", label: "Organization" },
              { key: "total_enrollees", label: "Total Enrollees" },
              { key: "claims_count", label: "Claims Count" },
              { key: "utilization_rate", label: "Utilization Rate" },
              { key: "total_amount", label: "Total Amount" },
              { key: "average_per_enrollee", label: "Average per Enrollee" }
            ]
          case "Utilization by Enrollee":
            return [
              { key: "enrollee_name", label: "Enrollee Name" },
              { key: "enrollee_id", label: "Enrollee ID" },
              { key: "organization", label: "Organization" },
              { key: "claims_count", label: "Claims Count" },
              { key: "total_amount", label: "Total Amount" },
              { key: "last_claim_date", label: "Last Claim Date" }
            ]
          case "Vetter":
            return [
              { key: "date", label: "Date" },
              { key: "claims_approved", label: "Claims Approved" },
              { key: "claims_rejected", label: "Claims Rejected" },
              { key: "total_amount_approved", label: "Total Amount Approved" }
            ]
          case "Audit":
            return [
              { key: "date", label: "Date" },
              { key: "vetted_claims_approved", label: "Vetted Claims Approved" },
              { key: "vetted_claims_rejected", label: "Vetted Claims Rejected" },
              { key: "total_amount_approved", label: "Total Amount Approved" }
            ]
          case "Approval":
            return [
              { key: "date", label: "Date" },
              { key: "audited_claims_approved", label: "Audited Claims Approved" },
              { key: "audited_claims_rejected", label: "Audited Claims Rejected" },
              { key: "total_amount_approved", label: "Total Amount Approved" }
            ]
          default:
            return []
        }

      case "PROVIDER_MANAGEMENT":
        switch (selectedFilter) {
          case "Providers":
            return [
              { key: "provider_name", label: "Provider Name" },
              { key: "approved_by", label: "Approved By" },
              { key: "approval_date", label: "Approval Date" },
              { key: "request_date", label: "Request Date" },
              { key: "status", label: "Status" }
            ]
          case "In-patient":
            return [
              { key: "date", label: "Date" },
              { key: "enrollees_admitted", label: "Enrollees Admitted" },
              { key: "enrollees_discharged", label: "Enrollees Discharged" },
              { key: "provider_name", label: "Provider" }
            ]
          default:
            return []
        }

      default:
        return []
    }
  }

  const tableColumns = getTableColumns()
  const reportDataList = reportData?.data || []
  const totalRecords = reportData?.total || 0
  const totalPages = Math.ceil(totalRecords / pageSize)

  return (
    <PermissionGate module="reports" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600">Generate and view system reports with dynamic filtering</p>
          </div>
          <div className="flex gap-4">
            <Button 
              onClick={handleExport}
              disabled={!hasGeneratedReport || !reportData?.data || reportData.data.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Report Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Select Report Type
            </CardTitle>
            <CardDescription>
              Choose the type of report you want to generate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="report-type">Report Type</Label>
              <Select value={selectedReportType} onValueChange={handleReportTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => {
                    const IconComponent = type.icon
                    return (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          <span>{type.name}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {currentReportType && (
                <p className="text-sm text-gray-600 mt-2">
                  {currentReportType.description}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>
              Configure filters for your selected report type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter">Filter Type</Label>
                <Select value={selectedFilter} onValueChange={handleFilterChange} disabled={!selectedReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedReportType ? "Select filter" : "Select report type first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {currentReportType?.filters.map((filter) => (
                      <SelectItem key={filter} value={filter}>
                        {filter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="page-size">Page Size</Label>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select page size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleGenerateReport}
                    disabled={!selectedReportType || !selectedFilter}
                    className="flex-1 bg-[#0891B2] hover:bg-[#9B1219] text-white disabled:bg-[#0891B2]/40 disabled:text-white"
                  >
                    Generate Report
                  </Button>
                  <Button 
                    onClick={() => {
                      setStartDate(undefined)
                      setEndDate(undefined)
                      setCurrentPage(1)
                      setHasGeneratedReport(false)
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {hasGeneratedReport ? `${currentReportType?.name} - ${selectedFilter}` : 'Report Data'}
            </CardTitle>
            <CardDescription>
              {hasGeneratedReport ? `${totalRecords} records found • Page ${currentPage} of ${totalPages}` : 'Select report type and filter, then click Generate Report to view data'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasGeneratedReport ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">No report generated yet</p>
                <p className="text-gray-400 text-sm">Select a report type and filter, then click "Generate Report" to view data</p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading report data...</p>
                </div>
              </div>
            ) : reportDataList.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No data found for the selected filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {tableColumns.map((column) => (
                        <TableHead key={column.key}>{column.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportDataList.map((row: any, index: number) => (
                      <TableRow key={index}>
                        {tableColumns.map((column) => (
                          <TableCell key={column.key}>
                            {column.key === "status" ? (
                              <Badge variant={row[column.key] === "ACTIVE" ? "default" : "secondary"}>
                                {row[column.key]}
                              </Badge>
                            ) : column.key.includes("amount") || column.key.includes("costs") ? (
                              `₦${Number(row[column.key] || 0).toLocaleString()}`
                            ) : (
                              row[column.key] || "-"
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {reportDataList.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
