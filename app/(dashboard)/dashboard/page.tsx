"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FONT_CLASSES } from "@/lib/font-utils"
import { Button } from "@/components/ui/button"
import { StatusText } from "@/components/ui/status-text"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Users, 
  Building, 
  DollarSign,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { PermissionGate } from "@/components/ui/permission-gate"

export const dynamic = 'force-dynamic'

// Real data is now fetched from API endpoints

export default function ERPDashboard() {
  const { data: session } = useSession()
  const [selectedOrganization, setSelectedOrganization] = useState('all')
  const [selectedPlan, setSelectedPlan] = useState('all')
  const [selectedDate, setSelectedDate] = useState('25/07/2025')

  // Fetch real data from API
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats")
      if (!res.ok) throw new Error("Failed to fetch dashboard stats")
      return res.json()
    }
  })

  const { data: chartData, isLoading: chartsLoading } = useQuery({
    queryKey: ["dashboard", "charts"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/charts")
      if (!res.ok) throw new Error("Failed to fetch chart data")
      return res.json()
    }
  })


  // Fetch department performance data
  const { data: departmentPerformance } = useQuery({
    queryKey: ["dashboard", "department-performance"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/department-performance")
      if (!res.ok) throw new Error("Failed to fetch department performance")
      return res.json()
    },
    refetchInterval: 60000 // Refetch every minute
  })

  // Fetch organizations for filter
  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations")
      if (!res.ok) {
        throw new Error("Failed to fetch organizations")
      }
      return res.json()
    },
  })

  // Fetch plans for filter
  const { data: plansData } = useQuery({
    queryKey: ["plans", selectedOrganization],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedOrganization !== 'all') {
        params.append('organizationId', selectedOrganization)
      }
      
      const res = await fetch(`/api/underwriting/plans?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch plans")
      }
      return res.json()
    },
  })

  // Extract organizations and plans from API data
  const organizations = organizationsData?.organizations || []
  const plans = plansData?.plans || []

  // Handle organization change - reset plan selection
  const handleOrganizationChange = (value: string) => {
    setSelectedOrganization(value)
    setSelectedPlan('all') // Reset plan when organization changes
  }

  // Use real data from API
  const enrolleeTrendsData = chartData?.enrolleeTrendsData || []
  const revenueData = chartData?.revenueData || []
  const enrolleeData = dashboardStats?.enrolleeData || []

  if (statsLoading || chartsLoading) {
    return (
      <div className="space-y-4 p-4 bg-gray-50 min-h-screen">
        {/* Loading Header */}
        <div className="flex items-center justify-center h-16">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600"></div>
            <span className="text-lg font-medium text-gray-600">Loading Dashboard...</span>
          </div>
        </div>

        {/* Loading Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-white animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                  <div className="h-5 w-5 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="bg-white animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-48"></div>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading Table Skeleton */}
        <Card className="bg-white animate-pulse">
          <CardHeader>
            <div className="h-4 bg-gray-200 rounded w-40"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 bg-gray-200 rounded w-full"></div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Loading Department Performance Skeleton */}
        <Card className="bg-white animate-pulse">
          <CardHeader>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                    <div className="h-3 bg-gray-200 rounded w-32"></div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 bg-gray-300 rounded-full" style={{ width: `${Math.random() * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Determine what to show based on role
  const userRole = session?.user?.role
  const showAllMetrics = userRole === 'SUPER_ADMIN'
  const showLimitedMetrics = userRole === 'ADMIN'
  const showRoleSpecificMetrics = ['HR_MANAGER', 'HR_OFFICER', 'CLAIMS_MANAGER', 'CLAIMS_PROCESSOR', 'FINANCE_OFFICER', 'PROVIDER_MANAGER', 'UNDERWRITER'].includes(userRole || '')
  const isProviderRole = userRole === 'PROVIDER'

  return (
    <div className="space-y-4 p-4 bg-gray-50 min-h-screen">
      {/* Top Metrics Cards */}
      {isProviderRole ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Approved Codes</p>
                  <p className={`text-xl ${FONT_CLASSES.BODY_LARGE} text-gray-900`}>{dashboardStats?.approvalCodesApproved?.toLocaleString() || "0"}</p>
                </div>
                <div className="flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Pending Codes</p>
                  <p className={`text-xl ${FONT_CLASSES.BODY_LARGE} text-gray-900`}>{dashboardStats?.approvalCodesPending?.toLocaleString() || "0"}</p>
                </div>
                <div className="flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Rejected Codes</p>
                  <p className={`text-xl ${FONT_CLASSES.BODY_LARGE} text-gray-900`}>{dashboardStats?.approvalCodesRejected?.toLocaleString() || "0"}</p>
                </div>
                <div className="flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Enrollee - Show to all roles */}
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Total Enrollee</p>
                  <p className={`text-xl ${FONT_CLASSES.BODY_LARGE} text-gray-900`}>{dashboardStats?.totalEnrollees?.toLocaleString() || "0"}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Real-time data
                  </p>
                </div>
                <div className="flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Organization - Show to SUPER_ADMIN and ADMIN */}
          {(showAllMetrics || showLimitedMetrics) && (
            <Card className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Total Organization</p>
                    <p className={`text-xl ${FONT_CLASSES.BODY_LARGE} text-gray-900`}>{dashboardStats?.totalOrganizations?.toLocaleString() || "0"}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Real-time data
                    </p>
                  </div>
                  <div className="flex items-center justify-center">
                    <Building className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Invoices - Show to SUPER_ADMIN, ADMIN, and Finance roles */}
          {(showAllMetrics || showLimitedMetrics || ['FINANCE_OFFICER'].includes(userRole || '')) && (
            <Card className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Pending Invoices</p>
                    <p className={`text-xl ${FONT_CLASSES.BODY_LARGE} text-gray-900`}>{dashboardStats?.pendingInvoices?.toLocaleString() || "0"}</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="text-yellow-600 text-2xl font-bold">NGN</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Claims - Show to SUPER_ADMIN, ADMIN, and Claims roles */}
          {(showAllMetrics || showLimitedMetrics || ['CLAIMS_MANAGER', 'CLAIMS_PROCESSOR'].includes(userRole || '')) && (
            <Card className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Pending Claims</p>
                    <p className={`text-xl ${FONT_CLASSES.BODY_LARGE} text-gray-900`}>{dashboardStats?.pendingClaims?.toLocaleString() || "0"}</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}      {/* Charts Section - Show to SUPER_ADMIN and ADMIN only */}
      {(showAllMetrics || showLimitedMetrics) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Enrollee Trends */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Daily Enrollee Trends (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={enrolleeTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[50, 250]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="thisWeek" stroke="#10b981" strokeWidth={2} name="This Week" />
                  <Line type="monotone" dataKey="lastWeek" stroke="#BE1522" strokeWidth={2} name="Last Week" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue Analysis */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Revenue Analysis (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[100000, 300000]} />
                  <Tooltip formatter={(value) => [`₦${Number(value ?? 0).toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#BE1522" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Current Enrollee Overview Table - Show to SUPER_ADMIN and ADMIN only */}
      {(showAllMetrics || showLimitedMetrics) && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Current Enrollee Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">ENROLLEE ID</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">ENROLLEE</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">ORGANIZATION</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">PLAN</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolleeData.map((enrollee: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-xs font-medium text-[#BE1522]">{enrollee.id}</td>
                      <td className="py-3 px-4 text-xs text-gray-900">{enrollee.name?.replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                      <td className="py-3 px-4 text-xs text-gray-900">{enrollee.organization?.replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                      <td className="py-3 px-4 text-xs text-gray-900">{enrollee.plan?.replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
                      <td className="py-3 px-4">
                        <StatusText status={enrollee.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role-Specific Dashboard Sections */}
      {/* HR Dashboard */}
      {(['HR_MANAGER', 'HR_OFFICER'].includes(userRole || '')) && (
        <div className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium">HR Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Total Employees</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-blue-600 mt-2`}>
                    {dashboardStats?.totalEmployees?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Active</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-green-600 mt-2`}>
                    {dashboardStats?.activeEmployees?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">On Leave</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-orange-600 mt-2`}>
                    {dashboardStats?.employeesOnLeave?.toLocaleString() || "0"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Claims Dashboard */}
      {(['CLAIMS_MANAGER', 'CLAIMS_PROCESSOR'].includes(userRole || '')) && (
        <div className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Claims Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Total Claims</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-purple-600 mt-2`}>
                    {dashboardStats?.totalClaims?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Pending Review</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-yellow-600 mt-2`}>
                    {dashboardStats?.pendingClaims?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Approved Today</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-green-600 mt-2`}>
                    {dashboardStats?.approvedClaimsToday?.toLocaleString() || "0"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Finance Dashboard */}
      {userRole === 'FINANCE_OFFICER' && (
        <div className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Finance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Total Revenue</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-blue-600 mt-2`}>
                    ₦{dashboardStats?.totalRevenue?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Pending Invoices</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-yellow-600 mt-2`}>
                    {dashboardStats?.pendingInvoices?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Paid Today</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-green-600 mt-2`}>
                    ₦{dashboardStats?.paidToday?.toLocaleString() || "0"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provider Dashboard */}
      {userRole === 'PROVIDER_MANAGER' && (
        <div className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Provider Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Total Providers</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-indigo-600 mt-2`}>
                    {dashboardStats?.totalProviders?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Active</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-green-600 mt-2`}>
                    {dashboardStats?.activeProviders?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Pending Approval</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-orange-600 mt-2`}>
                    {dashboardStats?.pendingProviders?.toLocaleString() || "0"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Underwriter Dashboard */}
      {(userRole === 'UNDERWRITER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
        <div className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Underwriting Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-teal-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Total Plans</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-teal-600 mt-2`}>
                    {dashboardStats?.totalPlans?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Active Plans</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-blue-600 mt-2`}>
                    {dashboardStats?.activePlans?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">Enrollees Covered</p>
                  <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-purple-600 mt-2`}>
                    {dashboardStats?.totalEnrollees?.toLocaleString() || "0"}
                  </p>
                </div>
              </div>

              {/* Underwriting Statistics */}
              {dashboardStats?.underwritingStatistics && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">Individual</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-indigo-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.individual?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-pink-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">Family</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-pink-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.family?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-cyan-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">Dependents</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-cyan-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.dependents?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">Male</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-blue-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.male?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-rose-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">Female</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-rose-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.female?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">No Email</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-amber-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.noEmail?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">No Phone Number</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-orange-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.noPhoneNumber?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">No Hospital</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-red-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.noHospital?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">About to Expire</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-yellow-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.aboutToExpire?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600">No Pictures</p>
                    <p className={`text-2xl ${FONT_CLASSES.BODY_LARGE} text-gray-600 mt-2`}>
                      {dashboardStats.underwritingStatistics.noPictures?.toLocaleString() || "0"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Panels - Show to SUPER_ADMIN and ADMIN only */}
      {(showAllMetrics || showLimitedMetrics) && (
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* Department Performance */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Department Performance Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {departmentPerformance?.departments?.map((dept: any, index: number) => (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-900">{dept.name}</span>
                      <span className="text-xs text-gray-500">{dept.description}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${dept.percentage >= 80 ? 'bg-green-500' : dept.percentage >= 60 ? 'bg-orange-500' : 'bg-red-500'}`} 
                        style={{ width: `${dept.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )) || departmentPerformance?.departmentPerformance?.map((dept: any, index: number) => (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-900">{dept.name}</span>
                      <span className="text-xs text-gray-500">{dept.description}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${dept.percentage >= 80 ? 'bg-green-500' : dept.percentage >= 60 ? 'bg-orange-500' : 'bg-red-500'}`} 
                        style={{ width: `${dept.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No department performance data available</p>
                    <p className="text-xs text-gray-400 mt-1">Data will appear as departments complete tasks</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}



