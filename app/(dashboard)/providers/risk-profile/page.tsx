"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  Edit,
  Trash2,
  Plus,
  Download,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  PieChart,
  MoreHorizontal
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { MetricCard } from "@/components/ui/metric-card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { AddRiskProfileForm } from "@/components/forms/add-risk-profile-form"
import { ViewRiskProfileModal } from "@/components/forms/view-risk-profile-form"
import { EditRiskProfileModal } from "@/components/forms/edit-risk-profile-form"

interface ProviderRiskProfile {
  id: string
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string[]
  }
  risk_score: number
  risk_level: string
  assessment_date: string
  factors?: any
  recommendations?: string
  created_at: string
}

export default function ProviderRiskProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedRiskProfileId, setSelectedRiskProfileId] = useState<string | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch provider risk profiles
  const { data: riskProfilesData, isLoading } = useQuery({
    queryKey: ["provider-risk-profiles", currentPage, limit, debouncedSearchTerm, selectedRiskLevel],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedRiskLevel !== "all" && { risk_level: selectedRiskLevel }),
      })
      
      const res = await fetch(`/api/providers/risk-profiles?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider risk profiles")
      }
      return res.json()
    },
  })

  // Fetch risk profile metrics
  const { data: metricsData } = useQuery({
    queryKey: ["provider-risk-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/providers/risk-profiles/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch risk profile metrics")
      }
      return res.json()
    },
  })

  const riskProfiles = riskProfilesData?.risk_profiles || []
  const pagination = riskProfilesData?.pagination
  const metrics = metricsData || {
    total_assessments: 0,
    low_risk: 0,
    medium_risk: 0,
    high_risk: 0,
    critical_risk: 0,
    average_risk_score: 0,
    risk_trend_data: []
  }

  // Use real risk trend data from API
  const riskTrendData = metrics.risk_trend_data.length > 0 ? metrics.risk_trend_data : [
    { month: "Jan", low: 0, medium: 0, high: 0, critical: 0 },
    { month: "Feb", low: 0, medium: 0, high: 0, critical: 0 },
    { month: "Mar", low: 0, medium: 0, high: 0, critical: 0 },
    { month: "Apr", low: 0, medium: 0, high: 0, critical: 0 },
    { month: "May", low: 0, medium: 0, high: 0, critical: 0 },
    { month: "Jun", low: 0, medium: 0, high: 0, critical: 0 }
  ]

  // Mock risk distribution data
  const riskDistributionData = [
    { level: "Low", count: metrics.low_risk, color: "#10b981" },
    { level: "Medium", count: metrics.medium_risk, color: "#f59e0b" },
    { level: "High", count: metrics.high_risk, color: "#f97316" },
    { level: "Critical", count: metrics.critical_risk, color: "#ef4444" }
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
        ...(selectedRiskLevel !== "all" && { risk_level: selectedRiskLevel }),
        format
      })
      
      const res = await fetch(`/api/providers/risk-profiles/export?${params}`)
      if (!res.ok) {
        throw new Error(`Failed to export ${format}`)
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `provider-risk-profiles-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`
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

  const handleView = (id: string) => {
    setSelectedRiskProfileId(id)
    setShowViewModal(true)
  }

  const handleEdit = (id: string) => {
    setSelectedRiskProfileId(id)
    setShowEditModal(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this risk profile?")) {
      try {
        const res = await fetch(`/api/providers/risk-profiles/${id}`, {
          method: "DELETE",
        })

        if (!res.ok) {
          throw new Error("Failed to delete risk profile")
        }

        toast({
          title: "Success",
          description: "Risk profile deleted successfully",
        })
        queryClient.invalidateQueries({ queryKey: ["risk-profiles"] })
        queryClient.invalidateQueries({ queryKey: ["risk-profile-metrics"] })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete risk profile",
          variant: "destructive",
        })
      }
    }
  }

  // Get risk level badge color
  const getRiskLevelBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'critical':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Provider Tariff Plan</h1>
            <p className="text-gray-600">Monitor and assess provider tariff plans</p>
          </div>
          <PermissionGate module="provider" action="add">
            <Button onClick={() => setShowAddModal(true)} className="bg-[#BE1522] hover:bg-[#9B1219]">
              <Plus className="h-4 w-4 mr-2" />
              Add Tariff Plan
            </Button>
          </PermissionGate>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Assessments"
            value={metrics.total_assessments}
            icon={BarChart3}
            trend={{ value: 8, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Average Risk Score"
            value={`${metrics.average_risk_score}/100`}
            icon={TrendingUp}
            trend={{ value: 5, isPositive: false }}
            description="vs last month"
          />
          <MetricCard
            title="High Risk Providers"
            value={metrics.high_risk + metrics.critical_risk}
            icon={AlertTriangle}
            trend={{ value: 2, isPositive: false }}
            description="vs last month"
          />
          <MetricCard
            title="Low Risk Providers"
            value={metrics.low_risk}
            icon={CheckCircle}
            trend={{ value: 12, isPositive: true }}
            description="vs last month"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Level Trend</CardTitle>
              <CardDescription>Risk level distribution over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={riskTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="low" stroke="#10b981" strokeWidth={2} name="Low Risk" />
                    <Line type="monotone" dataKey="medium" stroke="#f59e0b" strokeWidth={2} name="Medium Risk" />
                    <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} name="High Risk" />
                    <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} name="Critical Risk" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Risk Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Level Distribution</CardTitle>
              <CardDescription>Current risk level distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskDistributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="level" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" />
                  </BarChart>
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
              Tariff Plan Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Search Provider</label>
                <Input
                  placeholder="Search by provider name or code"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Risk Level</label>
                <Select value={selectedRiskLevel} onValueChange={(value) => {
                  setSelectedRiskLevel(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Risk Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Levels</SelectItem>
                    <SelectItem value="LOW">Low Risk</SelectItem>
                    <SelectItem value="MEDIUM">Medium Risk</SelectItem>
                    <SelectItem value="HIGH">High Risk</SelectItem>
                    <SelectItem value="CRITICAL">Critical Risk</SelectItem>
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

        {/* Tariff Plans Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Provider Tariff Plans</CardTitle>
                <CardDescription>Tariff plan history for all providers</CardDescription>
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
                      <TableHead>PROVIDER</TableHead>
                      <TableHead>FACILITY TYPE</TableHead>
                      <TableHead>RISK SCORE</TableHead>
                      <TableHead>RISK LEVEL</TableHead>
                      <TableHead>ASSESSMENT DATE</TableHead>
                      <TableHead>RECOMMENDATIONS</TableHead>
                      <TableHead>ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskProfiles.map((profile: ProviderRiskProfile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.provider.facility_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {profile.provider.facility_type.map((type, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {type.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {profile.risk_score}/100
                        </TableCell>
                        <TableCell>
                          <Badge className={getRiskLevelBadgeColor(profile.risk_level)}>
                            {profile.risk_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(profile.assessment_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {profile.recommendations || "---"}
                          </span>
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
                                <DropdownMenuItem onClick={() => handleView(profile.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="provider" action="edit">
                                <DropdownMenuItem onClick={() => handleEdit(profile.id)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="provider" action="delete">
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(profile.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
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

        {/* Add Tariff Plan Modal */}
        <AddRiskProfileForm 
          isOpen={showAddModal} 
          onClose={() => setShowAddModal(false)} 
        />

        {/* View Tariff Plan Modal */}
        <ViewRiskProfileModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false)
            setSelectedRiskProfileId(null)
          }}
          riskProfileId={selectedRiskProfileId}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Edit Tariff Plan Modal */}
        <EditRiskProfileModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedRiskProfileId(null)
          }}
          riskProfileId={selectedRiskProfileId}
        />
      </div>
    </PermissionGate>
  )
}
