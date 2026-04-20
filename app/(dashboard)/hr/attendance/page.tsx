"use client"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Filter,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export const dynamic = 'force-dynamic'

export default function DailyAttendancePage() {
  const { toast } = useToast()
  const [selectedEmployee, setSelectedEmployee] = useState("all")
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch attendance data
  const { data: attendanceData, isLoading, refetch } = useQuery({
    queryKey: ["attendance", selectedEmployee, startDate, endDate, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedEmployee !== "all") params.append("employee", selectedEmployee)
      params.append("startDate", startDate)
      params.append("endDate", endDate)
      params.append("page", currentPage.toString())
      params.append("limit", "10")
      
      const res = await fetch(`/api/hr/attendance?${params}`)
      if (!res.ok) throw new Error("Failed to fetch attendance")
      return res.json()
    }
  })

  // Fetch employees for filter
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-attendance"],
    queryFn: async () => {
      const res = await fetch("/api/hr/employees?limit=1000")
      if (!res.ok) throw new Error("Failed to fetch employees")
      return res.json()
    }
  })

  const attendanceRecords = attendanceData?.attendance || []
  const pagination = attendanceData?.pagination

  const handleApplyFilters = () => {
    refetch()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PRESENT":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "LATE":
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case "ABSENT":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PRESENT":
        return "bg-green-100 text-green-800"
      case "LATE":
        return "bg-orange-100 text-orange-800"
      case "ABSENT":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatTime = (time: string | null) => {
    if (!time) return "N/A"
    return new Date(time).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const calculateOvertime = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn || !clockOut) return "0h 0min"
    
    const start = new Date(clockIn)
    const end = new Date(clockOut)
    const diffMs = end.getTime() - start.getTime()
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    // Assuming 8 hours is standard work time
    const standardHours = 8
    const overtimeHours = Math.max(0, hours - standardHours)
    const overtimeMinutes = overtimeHours > 0 ? minutes : 0
    
    return `${overtimeHours}h ${overtimeMinutes}min`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Attendance</h1>
          <p className="text-gray-600">Track and manage employee attendance records</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => {}}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Employee</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employee</SelectItem>
                    {employees.employees?.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyFilters} className="bg-[#BE1522] hover:bg-[#9B1219] text-white w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Daily Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DEPARTMENT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">CHECK-IN</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">CHECK-OUT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">OVERTIME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.map((record: any) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-400">
                            {record.employee.first_name?.[0]}{record.employee.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {record.employee.first_name} {record.employee.last_name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{record.employee.employee_id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{record.employee.department?.name || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">
                        {formatTime(record.clock_in)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">
                        {formatTime(record.clock_out)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">
                        {calculateOvertime(record.clock_in, record.clock_out)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {pagination && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-xs text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="bg-[#BE1522] text-white">
                  {pagination.page}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
