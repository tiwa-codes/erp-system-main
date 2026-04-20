"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign,
  Activity,
  PieChart,
  LineChart,
  Calendar,
  FileSpreadsheet,
  FileImage
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useToast } from "@/hooks/use-toast"
import { exportToExcel, exportToPDF, getReportDataStructure } from "@/lib/export-utils"

export const dynamic = 'force-dynamic'

interface AnalyticsMetrics {
  total_enrollees: number
  total_claims: number
  total_payout: number
  active_providers: number
  claims_trend: number
  payout_trend: number
  enrollees_trend: number
  providers_trend: number
}

export default function AnalyticsDashboard() {
  const { toast } = useToast()
  const [timeRange, setTimeRange] = useState("30d")

  // Fetch analytics metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["analytics-metrics", timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({ timeRange })
      
      const res = await fetch(`/api/reports/analytics/metrics?${params}`)
      if (!res.ok) throw new Error("Failed to fetch analytics")
      return res.json()
    },
  })

  // Fetch chart data
  const { data: chartData } = useQuery({
    queryKey: ["analytics-charts", timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({ timeRange })
      
      const res = await fetch(`/api/reports/analytics/charts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch chart data")
      return res.json()
    },
  })

  const metrics = metricsData?.metrics || {
    total_enrollees: 0,
    total_claims: 0,
    total_payout: 0,
    active_providers: 0,
    claims_trend: 0,
    payout_trend: 0,
    enrollees_trend: 0,
    providers_trend: 0
  }

  const charts = chartData?.charts || {
    claims_over_time: [],
    payout_over_time: [],
    enrollees_by_plan: [],
    providers_by_status: []
  }

  const handleExportExcel = () => {
    try {
      // Create analytics data for export
      const analyticsData = [
        { metric: 'Total Enrollees', value: metrics.total_enrollees, change: metrics.enrollees_trend, trend: metrics.enrollees_trend > 0 ? 'Up' : 'Down', period: timeRange },
        { metric: 'Total Claims', value: metrics.total_claims, change: metrics.claims_trend, trend: metrics.claims_trend > 0 ? 'Up' : 'Down', period: timeRange },
        { metric: 'Total Payout', value: metrics.total_payout, change: metrics.payout_trend, trend: metrics.payout_trend > 0 ? 'Up' : 'Down', period: timeRange },
        { metric: 'Active Providers', value: metrics.active_providers, change: metrics.providers_trend, trend: metrics.providers_trend > 0 ? 'Up' : 'Down', period: timeRange }
      ]
      
      const reportData = getReportDataStructure('analytics', analyticsData, { timeRange })
      const result = exportToExcel(reportData, `analytics-report-${new Date().toISOString().split('T')[0]}.xlsx`)
      
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
      // Create analytics data for export
      const analyticsData = [
        { metric: 'Total Enrollees', value: metrics.total_enrollees, change: metrics.enrollees_trend, trend: metrics.enrollees_trend > 0 ? 'Up' : 'Down', period: timeRange },
        { metric: 'Total Claims', value: metrics.total_claims, change: metrics.claims_trend, trend: metrics.claims_trend > 0 ? 'Up' : 'Down', period: timeRange },
        { metric: 'Total Payout', value: metrics.total_payout, change: metrics.payout_trend, trend: metrics.payout_trend > 0 ? 'Up' : 'Down', period: timeRange },
        { metric: 'Active Providers', value: metrics.active_providers, change: metrics.providers_trend, trend: metrics.providers_trend > 0 ? 'Up' : 'Down', period: timeRange }
      ]
      
      const reportData = getReportDataStructure('analytics', analyticsData, { timeRange })
      const result = await exportToPDF(reportData, `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`)
      
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

  return (
    <PermissionGate module="reports" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Real-time analytics and insights</p>
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
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-sm">
              <Activity className="h-4 w-4 mr-1" />
              Live Data
            </Badge>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Enrollees</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_enrollees.toLocaleString()}</div>
              <p className="text-xs text-blue-600">
                {metrics.enrollees_trend > 0 ? '+' : ''}{metrics.enrollees_trend}% from last period
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_claims.toLocaleString()}</div>
              <p className="text-xs text-green-600">
                {metrics.claims_trend > 0 ? '+' : ''}{metrics.claims_trend}% from last period
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payout</CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{metrics.total_payout.toLocaleString()}</div>
              <p className="text-xs text-purple-600">
                {metrics.payout_trend > 0 ? '+' : ''}{metrics.payout_trend}% from last period
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Activity className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.active_providers}</div>
              <p className="text-xs text-orange-600">
                {metrics.providers_trend > 0 ? '+' : ''}{metrics.providers_trend}% from last period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Claims Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Claims Over Time
              </CardTitle>
              <CardDescription>Claims processed over the selected time period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <LineChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Chart visualization will be implemented</p>
                  <p className="text-gray-400 text-sm">Data points: {charts.claims_over_time.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payout Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Payout Over Time
              </CardTitle>
              <CardDescription>Payout amounts over the selected time period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Chart visualization will be implemented</p>
                  <p className="text-gray-400 text-sm">Data points: {charts.payout_over_time.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enrollees by Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Enrollees by Plan
              </CardTitle>
              <CardDescription>Distribution of enrollees across different plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Chart visualization will be implemented</p>
                  <p className="text-gray-400 text-sm">Plans: {charts.enrollees_by_plan.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Providers by Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Providers by Status
              </CardTitle>
              <CardDescription>Provider distribution by status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Chart visualization will be implemented</p>
                  <p className="text-gray-400 text-sm">Statuses: {charts.providers_by_status.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance Insights
            </CardTitle>
            <CardDescription>Key performance indicators and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-green-600">Claims Processing</h4>
                <p className="text-2xl font-bold text-green-600">94.2%</p>
                <p className="text-sm text-gray-600">Average processing rate</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-blue-600">Provider Satisfaction</h4>
                <p className="text-2xl font-bold text-blue-600">4.7/5</p>
                <p className="text-sm text-gray-600">Average rating</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-purple-600">System Uptime</h4>
                <p className="text-2xl font-bold text-purple-600">99.9%</p>
                <p className="text-sm text-gray-600">Last 30 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
