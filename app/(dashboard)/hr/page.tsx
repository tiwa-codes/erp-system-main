"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Calendar,
  UserX,
  Wallet,
  TrendingUp,
  Filter,
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
import { PermissionButton } from "@/components/ui/permission-button"



export default function HRDashboard() {
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // Fetch HR metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["hr-metrics", selectedDepartment, selectedType, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedDepartment !== "all") params.append("department", selectedDepartment)
      if (selectedType !== "all") params.append("type", selectedType)
      params.append("date", selectedDate)
      
      const res = await fetch(`/api/hr/metrics?${params}`)
      if (!res.ok) throw new Error("Failed to fetch HR metrics")
      return res.json()
    }
  })

  // Fetch workforce by department data
  const { data: workforceData, isLoading: workforceLoading } = useQuery({
    queryKey: ["workforce-by-department", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/hr/workforce-by-department?date=${selectedDate}`)
      if (!res.ok) throw new Error("Failed to fetch workforce data")
      return res.json()
    }
  })

  // Fetch recent activities
  const { data: recentActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["hr-recent-activities"],
    queryFn: async () => {
      const res = await fetch("/api/hr/recent-activities")
      if (!res.ok) throw new Error("Failed to fetch recent activities")
      return res.json()
    }
  })

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments")
      if (!res.ok) throw new Error("Failed to fetch departments")
      return res.json()
    }
  })

  const handleApplyFilters = () => {
    // The queries will automatically refetch when the state changes
  }

  if (metricsLoading || workforceLoading || activitiesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Employees</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.totalEmployees || 0}</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">Up by {metrics?.employeeGrowth || 0}% this week</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Leave</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.activeLeave || 0}</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">Up by {metrics?.leaveGrowth || 0}% this week</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive Employee</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.inactiveEmployees || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <UserX className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Payroll</p>
                <p className="text-2xl font-bold text-gray-900">₦{metrics?.totalPayroll || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Wallet className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Department</SelectItem>
                {departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Type</SelectItem>
                <SelectItem value="FULL_TIME">Full Time</SelectItem>
                <SelectItem value="PART_TIME">Part Time</SelectItem>
                <SelectItem value="CONTRACT">Contract</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-48"
            />
            <PermissionButton 
              module="hr" 
              action="view"
              onClick={handleApplyFilters} 
              className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
            >
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </PermissionButton>
          </div>
        </CardContent>
      </Card>

      {/* Workforce by Department Chart */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Workforce by Department</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={workforceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Employee Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities?.employeeRecords?.slice(0, 3).map((record: any, index: number) => (
                <div key={index} className="text-sm">
                  <span className="text-gray-500">{record.date}</span>
                  <span className="text-gray-700 ml-2">{record.name} Joined</span>
                </div>
              ))}
              <Button variant="link" className="p-0 h-auto text-blue-600">
                View All
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Daily Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities?.attendance?.slice(0, 3).map((record: any, index: number) => (
                <div key={index} className="text-sm">
                  <span className="text-gray-500">{record.time}</span>
                  <span className="text-gray-700 ml-2">{record.name}</span>
                </div>
              ))}
              <Button variant="link" className="p-0 h-auto text-blue-600">
                View All
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities?.leave?.slice(0, 3).map((record: any, index: number) => (
                <div key={index} className="text-sm">
                  <span className="text-gray-500">{record.type}</span>
                  <span className="text-gray-700 ml-2">| {record.date}</span>
                </div>
              ))}
              <Button variant="link" className="p-0 h-auto text-blue-600">
                View All
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Payroll</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities?.payroll?.slice(0, 3).map((record: any, index: number) => (
                <div key={index} className="text-sm">
                  <span className="text-gray-500">₦{record.amount}</span>
                </div>
              ))}
              <Button variant="link" className="p-0 h-auto text-blue-600">
                View All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
