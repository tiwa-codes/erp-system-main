"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Search, 
  Filter, 
  Eye, 
  Building2,
  DollarSign,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  Download,
  Key,
  Shield,
  MoreHorizontal
} from "lucide-react"
import { exportToExcel, exportToPDF, getReportDataStructure } from "@/lib/export-utils"
import { MetricCard } from "@/components/ui/metric-card"
import { PermissionGate } from "@/components/ui/permission-gate"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"



interface ApprovalCode {
  id: string
  code: string
  provider_id: string
  provider: {
    id: string
    name: string
    provider_code: string
  }
  enrollee_id: string
  principal?: {
    id: string
    enrollee_id: string
    first_name: string
    last_name: string
  }
  service_type: string
  amount: number
  status: string
  generated_at: string
  expires_at: string
  used_at?: string
  claim_id?: string
}

export default function ProvidersApprovalCodePOVPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedServiceType, setSelectedServiceType] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch approval codes
  const { data: approvalCodesData, isLoading } = useQuery({
    queryKey: ["provider-approval-codes-pov", currentPage, limit, debouncedSearchTerm, selectedProvider, selectedStatus, selectedServiceType],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedServiceType !== "all" && { service_type: selectedServiceType }),
      })
      
      const res = await fetch(`/api/providers/approval-codes?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch approval codes")
      }
      return res.json()
    },
  })

  // Fetch providers for filter
  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers")
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  // Fetch approval code metrics
  const { data: metricsData } = useQuery({
    queryKey: ["approval-code-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/providers/approval-codes/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch approval code metrics")
      }
      return res.json()
    },
  })

  const approvalCodes = approvalCodesData?.approval_codes || []
  const pagination = approvalCodesData?.pagination
  const providers = providersData?.providers || []
  const metrics = metricsData || {
    total_codes: 0,
    active_codes: 0,
    used_codes: 0,
    expired_codes: 0,
    total_amount: 0,
    average_code_amount: 0
  }

  // Mock data for charts
  const codesByProviderData = [
    { provider: "Lagos Hospital", codes: 45, amount: 2500000 },
    { provider: "Abuja Clinic", codes: 38, amount: 1800000 },
    { provider: "Kano Medical", codes: 32, amount: 2200000 },
    { provider: "Port Harcourt Health", codes: 28, amount: 1600000 },
    { provider: "Ibadan Care", codes: 25, amount: 1400000 }
  ]

  const monthlyCodesData = [
    { month: "Jan", codes: 120, amount: 2500000 },
    { month: "Feb", codes: 135, amount: 2800000 },
    { month: "Mar", codes: 142, amount: 2950000 },
    { month: "Apr", codes: 158, amount: 3200000 },
    { month: "May", codes: 165, amount: 3400000 },
    { month: "Jun", codes: 172, amount: 3550000 }
  ]

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle export
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      // Transform approval codes data for export
      const exportData = approvalCodes.map((code: any) => ({
        approval_code: code.code,
        provider: code.provider.name,
        enrollee_name: code.principal ? `${code.principal.first_name} ${code.principal.last_name}` : code.enrollee_id,
        service_type: code.service_type,
        amount: code.amount,
        status: code.status,
        generated_date: new Date(code.generated_at).toLocaleDateString(),
        expires_date: new Date(code.expires_at).toLocaleDateString(),
        used_date: code.used_at ? new Date(code.used_at).toLocaleDateString() : 'Not Used'
      }))

      const reportData = {
        title: 'Provider Approval Codes Report',
        subtitle: 'Approval codes generated for providers',
        data: exportData,
        columns: [
          { key: 'approval_code', label: 'Approval Code', type: 'string' },
          { key: 'provider', label: 'Provider', type: 'string' },
          { key: 'enrollee_name', label: 'Enrollee', type: 'string' },
          { key: 'service_type', label: 'Service Type', type: 'string' },
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'status', label: 'Status', type: 'string' },
          { key: 'generated_date', label: 'Generated Date', type: 'date' },
          { key: 'expires_date', label: 'Expires Date', type: 'date' },
          { key: 'used_date', label: 'Used Date', type: 'string' }
        ],
        filters: {
          search: debouncedSearchTerm || 'All',
          provider: selectedProvider !== 'all' ? providers.find((p: any) => p.id === selectedProvider)?.name || 'All' : 'All',
          status: selectedStatus !== 'all' ? selectedStatus : 'All',
          service_type: selectedServiceType !== 'all' ? selectedServiceType : 'All'
        }
      }

      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `provider-approval-codes-pov-${timestamp}.${format === 'excel' ? 'xlsx' : 'pdf'}`

      let result
      if (format === 'excel') {
        result = exportToExcel(reportData, filename)
      } else {
        result = await exportToPDF(reportData, filename)
      }

      if (result.success) {
        toast({
          title: "Export Successful",
          description: `${format.toUpperCase()} file "${result.filename}" has been downloaded successfully.`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: `Failed to export ${format.toUpperCase()} file. Please try again.`,
        variant: "destructive",
      })
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'used':
        return 'bg-blue-100 text-blue-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Check if code is expired
  const isCodeExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Providers Approval Code (POV)</h1>
            <p className="text-gray-600">Approval codes overview and analytics from provider perspective</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Codes"
            value={metrics.total_codes}
            icon={Key}
            trend={{ value: 15, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Active Codes"
            value={metrics.active_codes}
            icon={Shield}
            trend={{ value: 8, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Used Codes"
            value={metrics.used_codes}
            icon={CheckCircle}
            trend={{ value: 12, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Total Amount"
            value={`₦${(metrics.total_amount / 1000000).toFixed(1)}M`}
            icon={DollarSign}
            trend={{ value: 18, isPositive: true }}
            description="vs last month"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Codes by Provider */}
          <Card>
            <CardHeader>
              <CardTitle>Approval Codes by Provider</CardTitle>
              <CardDescription>Top providers by code count and amount</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={codesByProviderData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="provider" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="codes" fill="#10b981" name="Codes" />
                    <Bar yAxisId="right" dataKey="amount" fill="#3b82f6" name="Amount (₦)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Codes Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Approval Codes Trend</CardTitle>
              <CardDescription>Codes count and amount over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyCodesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="codes" stroke="#10b981" strokeWidth={2} name="Codes" />
                    <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} name="Amount (₦)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-600" />
              Approval Code Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Search Codes</label>
                <Input
                  placeholder="Search by code or enrollee"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Provider</label>
                <Select value={selectedProvider} onValueChange={(value) => {
                  setSelectedProvider(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.map((provider: any) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={selectedStatus} onValueChange={(value) => {
                  setSelectedStatus(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="USED">Used</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Service Type</label>
                <Select value={selectedServiceType} onValueChange={(value) => {
                  setSelectedServiceType(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="INPATIENT">Inpatient</SelectItem>
                    <SelectItem value="OUTPATIENT">Outpatient</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                    <SelectItem value="SURGERY">Surgery</SelectItem>
                    <SelectItem value="LABORATORY">Laboratory</SelectItem>
                    <SelectItem value="RADIOLOGY">Radiology</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleFilterChange} className="bg-[#BE1522] hover:bg-[#9B1219]">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
                <Button onClick={() => handleExport('excel')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button onClick={() => handleExport('pdf')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Codes Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Provider Approval Codes</CardTitle>
                <CardDescription>All approval codes generated for providers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>APPROVAL CODE</TableHead>
                      <TableHead>PROVIDER</TableHead>
                      <TableHead>ENROLLEE</TableHead>
                      <TableHead>SERVICE TYPE</TableHead>
                      <TableHead>AMOUNT</TableHead>
                      <TableHead>STATUS</TableHead>
                      <TableHead>GENERATED DATE</TableHead>
                      <TableHead>EXPIRES DATE</TableHead>
                      <TableHead>USED DATE</TableHead>
                      <TableHead>ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalCodes.map((code: ApprovalCode) => (
                      <TableRow key={code.id}>
                        <TableCell className="font-medium font-mono">{code.code}</TableCell>
                        <TableCell>{code.provider.name}</TableCell>
                        <TableCell>
                          {code.principal ? 
                            `${code.principal.first_name} ${code.principal.last_name}` : 
                            code.enrollee_id
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {code.service_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ₦{code.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            isCodeExpired(code.expires_at) && code.status === 'ACTIVE' 
                              ? 'bg-red-100 text-red-800' 
                              : getStatusBadgeColor(code.status)
                          }>
                            {isCodeExpired(code.expires_at) && code.status === 'ACTIVE' 
                              ? 'EXPIRED' 
                              : code.status.replace('_', ' ')
                            }
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(code.generated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(code.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {code.used_at ? 
                            new Date(code.used_at).toLocaleDateString() : 
                            "---"
                          }
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <PermissionGate module="provider" action="view">
                                <DropdownMenuItem onClick={() => router.push(`/provider/approval-codes/${code.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                              </PermissionGate>
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
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
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
