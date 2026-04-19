"use client"

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
  Users,
  DollarSign,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  PieChart,
  Download,
  MoreHorizontal
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { MetricCard } from "@/components/ui/metric-card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

interface Provider {
  id: string
  // Section 1: Basic Information
  partnership_interest?: string
  facility_name: string
  address: string
  phone_whatsapp: string
  email: string
  medical_director_name: string
  hmo_coordinator_name: string
  hmo_coordinator_phone: string
  hmo_coordinator_email: string
  year_of_incorporation: string
  facility_reg_number: string
  practice: string
  proprietor_partners: string
  hcp_code?: string
  
  // Section 2: Service Delivery
  hours_of_operation?: string
  other_branches?: string
  emergency_care_services?: string[]
  facility_type?: string[]
  personnel_licensed?: string
  blood_bank_available?: string
  blood_sourcing_method?: string
  radiology_lab_services?: string[]
  other_services?: string[]
  
  // Section 3: Banking Information
  account_name?: string
  account_number?: string
  designation?: string
  date?: string
  
  // Document URLs
  cac_registration_url?: string
  nhis_accreditation_url?: string
  professional_indemnity_url?: string
  state_facility_registration_url?: string
  
  status: string
  created_at: string
  _count?: {
    claims: number
    in_patients: number
  }
}

export default function ProvidersPOVPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch providers
  const { data: providersData, isLoading } = useQuery({
    queryKey: ["providers-pov", currentPage, limit, debouncedSearchTerm, selectedType, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedType !== "all" && { facility_type: selectedType }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      })
      
      const res = await fetch(`/api/providers?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  // Fetch provider metrics
  const { data: metricsData } = useQuery({
    queryKey: ["provider-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/providers/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch provider metrics")
      }
      return res.json()
    },
  })

  const providers = providersData?.providers || []
  const pagination = providersData?.pagination
  const metrics = metricsData || {
    total_providers: 0,
    active_providers: 0,
    pending_approval: 0,
    suspended_providers: 0,
    total_claims: 0,
    total_inpatients: 0
  }

  // Mock data for charts
  const providerTypeData = [
    { type: "Hospital", count: 45, percentage: 45 },
    { type: "Clinic", count: 30, percentage: 30 },
    { type: "Pharmacy", count: 15, percentage: 15 },
    { type: "Laboratory", count: 7, percentage: 7 },
    { type: "Specialist", count: 3, percentage: 3 }
  ]

  const monthlyTrendData = [
    { month: "Jan", providers: 85, claims: 1200, revenue: 2500000 },
    { month: "Feb", providers: 88, claims: 1350, revenue: 2800000 },
    { month: "Mar", providers: 92, claims: 1420, revenue: 2950000 },
    { month: "Apr", providers: 95, claims: 1580, revenue: 3200000 },
    { month: "May", providers: 98, claims: 1650, revenue: 3400000 },
    { month: "Jun", providers: 100, claims: 1720, revenue: 3550000 }
  ]

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle export
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params = new URLSearchParams({
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedType !== "all" && { facility_type: selectedType }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        format
      })
      
      const res = await fetch(`/api/providers/export?${params}`)
      if (!res.ok) {
        throw new Error(`Failed to export ${format}`)
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `providers-pov-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Success",
        description: `${format.toUpperCase()} report exported successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to export ${format}`,
        variant: "destructive",
      })
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'suspended':
        return 'bg-red-100 text-red-800'
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get facility type badge color based on facility_type array
  const getFacilityTypeBadgeColor = (facilityTypes: string[] = []) => {
    if (facilityTypes.includes('HOSPITAL')) {
      return 'bg-blue-100 text-blue-800'
    } else if (facilityTypes.includes('PRIMARY_CARE')) {
      return 'bg-green-100 text-green-800'
    } else if (facilityTypes.includes('SECONDARY_CARE')) {
      return 'bg-purple-100 text-purple-800'
    } else if (facilityTypes.includes('PHARMACEUTICAL')) {
      return 'bg-orange-100 text-orange-800'
    } else if (facilityTypes.includes('OPTICAL')) {
      return 'bg-pink-100 text-pink-800'
    } else if (facilityTypes.includes('DENTAL')) {
      return 'bg-indigo-100 text-indigo-800'
    } else if (facilityTypes.includes('DIAGNOSTICS')) {
      return 'bg-teal-100 text-teal-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  // Get facility type display text
  const getFacilityTypeText = (facilityTypes: string[] = []) => {
    if (facilityTypes.length === 0) return 'Unknown'
    return facilityTypes.join(', ').replace(/_/g, ' ')
  }

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Providers (POV)</h1>
            <p className="text-gray-600">Provider overview and analytics from provider perspective</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Providers"
            value={metrics.total_providers}
            icon={Building2}
            trend={{ value: 12, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Active Providers"
            value={metrics.active_providers}
            icon={CheckCircle}
            trend={{ value: 8, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Total Claims"
            value={metrics.total_claims}
            icon={DollarSign}
            trend={{ value: 15, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="In-patients"
            value={metrics.total_inpatients}
            icon={Users}
            trend={{ value: 5, isPositive: true }}
            description="vs last month"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provider Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Type Distribution</CardTitle>
              <CardDescription>Distribution of providers by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={providerTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Provider & Claims Trend</CardTitle>
              <CardDescription>Provider count and claims over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="providers" stroke="#10b981" strokeWidth={2} name="Providers" />
                    <Line yAxisId="right" type="monotone" dataKey="claims" stroke="#3b82f6" strokeWidth={2} name="Claims" />
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
              Provider Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Search Provider</label>
                <Input
                  placeholder="Search by facility name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Provider Type</label>
                <Select value={selectedType} onValueChange={(value) => {
                  setSelectedType(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="HOSPITAL">Hospital</SelectItem>
                    <SelectItem value="PRIMARY_CARE">Primary Care/Clinic</SelectItem>
                    <SelectItem value="SECONDARY_CARE">Secondary Care</SelectItem>
                    <SelectItem value="PHARMACEUTICAL">Pharmaceutical Services</SelectItem>
                    <SelectItem value="OPTICAL">Optical Clinic</SelectItem>
                    <SelectItem value="DENTAL">Dental Clinic</SelectItem>
                    <SelectItem value="DIAGNOSTICS">Diagnostics</SelectItem>
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
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
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

        {/* Providers Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Providers Overview</CardTitle>
                <CardDescription>Complete provider directory and status</CardDescription>
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
                      <TableHead className="text-xs font-medium text-gray-600">FACILITY NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">FACILITY TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">MEDICAL DIRECTOR</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">HMO COORDINATOR</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PHONE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">EMAIL</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CLAIMS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">IN-PATIENTS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((provider: Provider) => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">{provider.facility_name}</TableCell>
                        <TableCell>
                          <Badge className={getFacilityTypeBadgeColor(provider.facility_type)}>
                            {getFacilityTypeText(provider.facility_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>{provider.medical_director_name}</TableCell>
                        <TableCell>{provider.hmo_coordinator_name}</TableCell>
                        <TableCell>{provider.phone_whatsapp || "---"}</TableCell>
                        <TableCell>{provider.email || "---"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(provider.status)}>
                            {provider.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{provider._count?.claims || 0}</TableCell>
                        <TableCell>{provider._count?.in_patients || 0}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <PermissionGate module="provider" action="view">
                                <DropdownMenuItem onClick={() => router.push(`/provider/${provider.id}`)}>
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
