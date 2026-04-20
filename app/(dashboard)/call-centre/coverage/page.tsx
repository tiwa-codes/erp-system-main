"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Search,
  Eye,
  Users,
  Building2,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Bell,
  Lock,
  MoreHorizontal
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"



interface Enrollee {
  id: string
  enrollee_id: string
  name: string
  plan: string
  phone_number: string
  region: string
  status: 'ACTIVE' | 'INACTIVE'
  date_added: string
  type?: 'Principal' | 'Dependent'
  principal_account_id?: string
}

interface CoverageDetails {
  plan: string
  band: string
  status: 'ACTIVE' | 'INACTIVE'
  enrollee: string
  provider: string
  start_date: string
}

interface ServiceCoverage {
  id: string
  service_name: string
  service_category: string
  coverage_status: 'IN_PLAN' | 'NOT_IN_PLAN' | 'NOT_ASSIGNED'
  overall_status: 'IN_PLAN' | 'NOT_IN_PLAN' | 'NOT_IN_BAND' | 'NOT_ASSIGNED'
  facility_price: number
  limit_count: number
  selectable: boolean
  status_message: string
}

interface CallCentreMetrics {
  total_enrollees: number
  total_providers: number
  total_plans: number
  requests: number
}

export default function CoverageCheckerPage() {
  const router = useRouter()
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showCoverageModal, setShowCoverageModal] = useState(false)
  const [selectedEnrollee, setSelectedEnrollee] = useState<Enrollee | null>(null)
  const [coverageDetails, setCoverageDetails] = useState<CoverageDetails | null>(null)
  const [serviceCoverage, setServiceCoverage] = useState<ServiceCoverage[]>([])
  const [selectedProvider, setSelectedProvider] = useState("")
  const [providerBandStatus, setProviderBandStatus] = useState<any>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch call centre metrics
  const { data: metricsData } = useQuery({
    queryKey: ["call-centre-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/call-centre/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch call centre metrics")
      }
      return res.json()
    },
  })

  // Fetch enrollees
  const { data: enrolleesData, isLoading } = useQuery({
    queryKey: ["enrollees-coverage", currentPage, limit, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: debouncedSearchTerm
      })
      
      const res = await fetch(`/api/call-centre/enrollees?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch enrollees")
      }
      return res.json()
    },
  })

  // Fetch providers for band validation
  const { data: providersData } = useQuery({
    queryKey: ["providers-list"],
    queryFn: async () => {
      const res = await fetch("/api/providers")
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  const metrics = metricsData?.metrics || {
    total_enrollees: 0,
    total_providers: 0,
    total_plans: 0,
    requests: 0
  }

  const enrollees = enrolleesData?.enrollees || []
  const pagination = enrolleesData?.pagination

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'INACTIVE':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get coverage status badge color
  const getCoverageStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'IN_PLAN':
        return 'bg-green-100 text-green-800'
      case 'NOT_IN_PLAN':
        return 'bg-red-100 text-red-800'
      case 'NOT_IN_BAND':
        return 'bg-orange-100 text-orange-800'
      case 'NOT_ASSIGNED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get coverage status text
  const getCoverageStatusText = (status: string) => {
    switch (status) {
      case 'IN_PLAN':
        return 'In Plan'
      case 'NOT_IN_PLAN':
        return 'Not in Plan'
      case 'NOT_IN_BAND':
        return 'Not in Band'
      case 'NOT_ASSIGNED':
        return 'Not Assigned'
      default:
        return status
    }
  }

  const handleViewCoverage = async (enrollee: Enrollee) => {
    setSelectedEnrollee(enrollee)
    setSelectedProvider("")
    setProviderBandStatus(null)
    
    // Fetch coverage details
    try {
      const res = await fetch(`/api/call-centre/coverage/${enrollee.id}`)
      if (res.ok) {
        const data = await res.json()
        setCoverageDetails(data.coverage)
      }
    } catch (error) {
      console.error("Failed to fetch coverage details:", error)
    }

    // Fetch service coverage
    try {
      const res = await fetch(`/api/call-centre/services-coverage?enrollee_id=${enrollee.enrollee_id}`)
      if (res.ok) {
        const data = await res.json()
        setServiceCoverage(data.services || [])
      }
    } catch (error) {
      console.error("Failed to fetch service coverage:", error)
    }
    
    setShowCoverageModal(true)
  }

  const handleViewEnrollee = (enrollee: Enrollee) => {
    const targetId = enrollee.type === 'Dependent'
      ? enrollee.principal_account_id || enrollee.id
      : enrollee.id
    router.push(`/underwriting/principals/${targetId}`)
  }

  const handleProviderChange = async (providerId: string) => {
    setSelectedProvider(providerId)
    
    if (!selectedEnrollee || !providerId) {
      setProviderBandStatus(null)
      return
    }

    // Fetch band validation for selected provider
    try {
      const res = await fetch("/api/enrollee/band-validation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          enrolleeId: selectedEnrollee.enrollee_id,
          providerId: providerId
        })
      })
      
      if (res.ok) {
        const data = await res.json()
        setProviderBandStatus(data.providerBandStatus)
        
        // Update service coverage with provider-specific band validation
        if (data.providerBandStatus) {
          const updatedServices: ServiceCoverage[] = serviceCoverage.map(service => ({
            ...service,
            overall_status: data.providerBandStatus.isCovered ? service.coverage_status : "NOT_IN_BAND" as const,
            selectable: service.coverage_status === "IN_PLAN" && data.providerBandStatus.isCovered,
            status_message: data.providerBandStatus.isCovered 
              ? service.status_message 
              : `Service may be in plan but provider band (${data.providerBandStatus.providerBand}) does not match enrollee's band(s): ${data.providerBandStatus.enrolleeBands.join(", ")}`
          }))
          setServiceCoverage(updatedServices)
        }
      }
    } catch (error) {
      console.error("Failed to fetch band validation:", error)
    }
  }

  return (
    <PermissionGate module="call-centre" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coverage Checker</h1>
            <p className="text-gray-600">Check enrollee coverage and eligibility</p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Enrollee</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_enrollees}</div>
              <p className="text-xs text-muted-foreground">
                +5.6% this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Provider</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_providers}</div>
              <p className="text-xs text-muted-foreground">
                +3.2% this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_plans}</div>
              <p className="text-xs text-muted-foreground">
                Limits flag off
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.requests}</div>
              <p className="text-xs text-muted-foreground">
                Today
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enrollees Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Enrollees</CardTitle>
                <CardDescription>Check coverage for enrollees</CardDescription>
              </div>
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by ID, name, Phone number"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
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
                      <TableHead className="text-xs font-medium text-gray-600">NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PLAN</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PHONE NUMBER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REGION</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DATE ADDED</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollees.map((enrollee: Enrollee) => (
                      <TableRow key={enrollee.id}>
                        <TableCell className="font-mono text-sm">{enrollee.enrollee_id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-red-400">
                                {enrollee.name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{enrollee.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{enrollee.plan}</TableCell>
                        <TableCell>{enrollee.phone_number}</TableCell>
                        <TableCell>{enrollee.region}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(enrollee.status)}>
                            {enrollee.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(enrollee.date_added).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => handleViewEnrollee(enrollee)}
                                className="w-full justify-start text-xs"
                              >
                                View Enrollee
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleViewCoverage(enrollee)}
                                className="w-full justify-start text-xs"
                              >
                                Coverage Details
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

        {/* Coverage Details Modal */}
        {showCoverageModal && selectedEnrollee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Coverage Checker &gt;&gt; {selectedEnrollee.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCoverageModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {coverageDetails ? (
                  <>
                    {/* Coverage Details */}
                    <div>
                      <h3 className="text-blue-600 font-semibold mb-4">Coverage Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Plan:</label>
                          <p className="text-sm font-semibold">{coverageDetails.plan}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Band:</label>
                          <p className="text-sm font-semibold">{coverageDetails.band}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Status:</label>
                          <Badge className={getStatusBadgeColor(coverageDetails.status)}>
                            {coverageDetails.status}
                          </Badge>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Enrollee:</label>
                          <p className="text-sm">{coverageDetails.enrollee}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Provider:</label>
                          <p className="text-sm">{coverageDetails.provider}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Start Date:</label>
                          <p className="text-sm">{coverageDetails.start_date}</p>
                        </div>
                      </div>
                    </div>

                    {/* Provider Band Validation */}
                    <div>
                      <h3 className="text-blue-600 font-semibold mb-4">Provider Band Validation</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Select Provider:</label>
                          <Select value={selectedProvider} onValueChange={handleProviderChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a provider to check band coverage" />
                            </SelectTrigger>
                            <SelectContent>
                              {providersData?.providers?.map((provider: any) => (
                                <SelectItem key={provider.id} value={provider.id}>
                                  {provider.facility_name} ({provider.facility_type})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {providerBandStatus && (
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={providerBandStatus.isCovered ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {providerBandStatus.isCovered ? 'IN BAND' : 'NOT IN BAND'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{providerBandStatus.message}</p>
                            <div className="mt-2 text-xs text-gray-500">
                              <p>Enrollee Bands: {providerBandStatus.enrolleeBands.join(", ")}</p>
                              <p>Provider Band: {providerBandStatus.providerBand}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Service Coverage */}
                    <div>
                      <h3 className="text-blue-600 font-semibold mb-4">Service Coverage</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {serviceCoverage.length === 0 ? (
                          <p className="text-sm text-gray-500">No services found</p>
                        ) : (
                          serviceCoverage.map((service) => (
                            <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{service.service_name}</p>
                                <p className="text-xs text-gray-500">{service.service_category}</p>
                                <p className="text-xs text-gray-400 mt-1">{service.status_message}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getCoverageStatusBadgeColor(service.overall_status)}>
                                  {getCoverageStatusText(service.overall_status)}
                                </Badge>
                                {service.facility_price > 0 && (
                                  <span className="text-xs text-green-600 font-medium">
                                    ₦{service.facility_price.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Loading coverage details...</div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCoverageModal(false)}
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
