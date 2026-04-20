"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Filter,
  Check,
  X,
  Calendar,
  Users,
  MoreHorizontal,
  Download,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AddLeaveForm } from "@/components/forms/add-leave-form"



export default function LeaveManagementPage() {
  const { toast } = useToast()
  const [selectedEmployee, setSelectedEmployee] = useState("all")
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)

  // Fetch leave requests
  const { data: leaveData, isLoading, refetch } = useQuery({
    queryKey: ["leave-requests", selectedEmployee, startDate, endDate, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedEmployee !== "all") params.append("employee", selectedEmployee)
      params.append("startDate", startDate)
      params.append("endDate", endDate)
      params.append("page", currentPage.toString())
      params.append("limit", "10")
      
      const res = await fetch(`/api/hr/leave?${params}`)
      if (!res.ok) throw new Error("Failed to fetch leave requests")
      return res.json()
    }
  })

  // Fetch employees for filter
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-leave"],
    queryFn: async () => {
      const res = await fetch("/api/hr/employees?limit=1000")
      if (!res.ok) throw new Error("Failed to fetch employees")
      return res.json()
    }
  })

  const leaveRequests = leaveData?.leaveRequests || []
  const pagination = leaveData?.pagination

  // Approve leave mutation
  const approveMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const res = await fetch(`/api/hr/leave/${leaveId}/approve`, {
        method: 'PATCH'
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve leave')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Leave request approved successfully" })
      refetch()
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      })
    }
  })

  // Reject leave mutation
  const rejectMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const res = await fetch(`/api/hr/leave/${leaveId}/reject`, {
        method: 'PATCH'
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reject leave')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Leave request rejected successfully" })
      refetch()
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      })
    }
  })

  const handleAddLeave = () => {
    setShowAddModal(true)
  }

  const handleApplyFilters = () => {
    refetch()
  }

  const handleApprove = async (leaveId: string) => {
    const leave = leaveData?.leave_requests?.find((l: any) => l.id === leaveId)
    if (!leave) return
    
    if (!confirm(`Approve leave request for ${leave.employee?.first_name} ${leave.employee?.last_name}?`)) return
    
    try {
      await approveMutation.mutateAsync(leaveId)
    } catch (error) {
      console.error('Error approving leave:', error)
    }
  }

  const handleReject = async (leaveId: string) => {
    const leave = leaveData?.leave_requests?.find((l: any) => l.id === leaveId)
    if (!leave) return
    
    if (!confirm(`Reject leave request for ${leave.employee?.first_name} ${leave.employee?.last_name}?`)) return
    
    try {
      await rejectMutation.mutateAsync(leaveId)
    } catch (error) {
      console.error('Error rejecting leave:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case "SICK":
        return "bg-red-100 text-red-800"
      case "VACATION":
        return "bg-blue-100 text-blue-800"
      case "ANNUAL":
        return "bg-green-100 text-green-800"
      case "MATERNITY":
        return "bg-purple-100 text-purple-800"
      case "PATERNITY":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
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
          <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-600">Manage employee leave requests and approvals</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => {}}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleAddLeave} className="bg-[#BE1522] hover:bg-[#9B1219] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add Leave
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-48">
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
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-48"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-48"
            />
            <Button onClick={handleApplyFilters} className="bg-[#BE1522] hover:bg-[#9B1219] text-white">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Leave</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DEPARTMENT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((leave: any) => (
                  <TableRow key={leave.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-400">
                            {leave.employee.first_name?.[0]}{leave.employee.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {leave.employee.first_name} {leave.employee.last_name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{leave.employee.employee_id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{leave.employee.department?.name || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.leave_type)}`}>
                        {leave.leave_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="text-gray-900">{formatDate(leave.start_date)}</div>
                        <div className="text-gray-500">{formatTime(leave.start_date)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-900">
                        {leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {leave.status === 'PENDING' && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => handleApprove(leave.id)}
                                className="w-full justify-start text-xs"
                                disabled={approveMutation.isPending}
                              >
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleReject(leave.id)}
                                className="text-red-600 hover:text-red-700 w-full justify-start text-xs"
                                disabled={rejectMutation.isPending}
                              >
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Add Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Add Leave</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>Add a new leave request</CardDescription>
            </CardHeader>
            <CardContent>
              <AddLeaveForm 
                onClose={() => setShowAddModal(false)} 
                onCreated={() => { 
                  setShowAddModal(false)
                  refetch()
                }} 
              />
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
