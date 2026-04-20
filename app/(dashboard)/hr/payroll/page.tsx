"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  Download,
  Check,
  FileText,
  Edit,
  Users,
  Wallet,
  MoreHorizontal,
  X,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AddPayrollForm } from "@/components/forms/add-payroll-form"
import { PermissionButton } from "@/components/ui/permission-button"
import { PermissionGate } from "@/components/ui/permission-gate"
import { StatusText } from "@/components/ui/status-text"



export default function PayrollManagementPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedEmployee, setSelectedEmployee] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null)

  // Fetch payroll records
  const { data: payrollData, isLoading, refetch } = useQuery({
    queryKey: ["payroll", selectedEmployee, startDate, endDate, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedEmployee !== "all") params.append("employee", selectedEmployee)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      params.append("page", currentPage.toString())
      params.append("limit", "10")
      
      const res = await fetch(`/api/hr/payroll?${params}`)
      if (!res.ok) throw new Error("Failed to fetch payroll records")
      return res.json()
    }
  })

  // Fetch employees for filter
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-payroll"],
    queryFn: async () => {
      const res = await fetch("/api/hr/employees?limit=1000")
      if (!res.ok) throw new Error("Failed to fetch employees")
      return res.json()
    }
  })

  const payrollRecords = payrollData?.payroll || []
  const pagination = payrollData?.pagination

  // Process payroll mutation
  const processMutation = useMutation({
    mutationFn: async (payrollId: string) => {
      const res = await fetch(`/api/hr/payroll/${payrollId}/process`, {
        method: 'PATCH'
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to process payroll')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Payroll processed successfully" })
      queryClient.invalidateQueries({ queryKey: ["payroll"] })
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      })
    }
  })

  const handleAddPayroll = () => {
    setShowAddModal(true)
  }

  const handleApplyFilters = () => {
    queryClient.invalidateQueries({ queryKey: ["payroll"] })
    setCurrentPage(1)
  }

  const handleProcess = async (payrollId: string) => {
    const payroll = payrollData?.payroll_records?.find((p: any) => p.id === payrollId)
    if (!payroll) return
    
    if (!confirm(`Process payroll for ${payroll.employee?.first_name} ${payroll.employee?.last_name}?`)) return
    
    try {
      await processMutation.mutateAsync(payrollId)
    } catch (error) {
      console.error('Error processing payroll:', error)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedEmployee !== "all") params.append("employee", selectedEmployee)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)

      const response = await fetch(`/api/hr/payroll/export?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to export payroll')
      }

      const csvContent = await response.text()
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `payroll-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: "Payroll data has been exported successfully."
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export payroll",
        variant: "destructive"
      })
    }
  }

  const handleViewPayroll = (payroll: any) => {
    setSelectedPayroll(payroll)
    setShowViewModal(true)
  }

  const handleEditPayroll = (payroll: any) => {
    setSelectedPayroll(payroll)
    setShowEditModal(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-green-100 text-green-800"
      case "PROCESSED":
        return "bg-blue-100 text-blue-800"
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
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
          <h1 className="text-3xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-600">Manage employee payroll and salary processing</p>
        </div>
        <div className="flex items-center gap-4">
          <PermissionButton 
            module="hr" 
            action="view"
            variant="outline" 
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </PermissionButton>
          <PermissionButton 
            module="hr" 
            action="add"
            onClick={handleAddPayroll} 
            className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payroll
          </PermissionButton>
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
                  placeholder="Start date (optional)"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                  placeholder="End date (optional)"
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

      {/* Payroll Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Payroll</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DEPARTMENT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">BASIC</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRecords.map((payroll: any) => (
                  <TableRow key={payroll.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-400">
                            {payroll.employee.first_name?.[0]}{payroll.employee.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {payroll.employee.first_name} {payroll.employee.last_name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{payroll.employee.employee_id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{payroll.employee.department?.name || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{formatCurrency(Number(payroll.basic_salary))}</div>
                    </TableCell>
                    <TableCell>
                      <StatusText status={payroll.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleViewPayroll(payroll)}
                            className="w-full justify-start text-xs"
                          >
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleEditPayroll(payroll)}
                            className="w-full justify-start text-xs"
                          >
                            Edit
                          </DropdownMenuItem>
                          {payroll.status === 'PENDING' && (
                            <DropdownMenuItem 
                              onClick={() => handleProcess(payroll.id)}
                              className="w-full justify-start text-xs"
                              disabled={processMutation.isPending}
                            >
                              Process
                            </DropdownMenuItem>
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

      {/* Add Payroll Modal */}
      <PermissionGate module="hr" action="add">
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Add Payroll</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Add a new payroll record</CardDescription>
              </CardHeader>
              <CardContent>
                <AddPayrollForm 
                  onClose={() => setShowAddModal(false)} 
                  onCreated={() => { 
                    setShowAddModal(false)
                    // Invalidate and refetch payroll queries
                    queryClient.invalidateQueries({ queryKey: ["payroll"] })
                    // Reset to first page to see the new record
                    setCurrentPage(1)
                  }} 
                />
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>

      {/* View Payroll Modal */}
      <PermissionGate module="hr" action="view">
        {showViewModal && selectedPayroll && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Payroll Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowViewModal(false)
                      setSelectedPayroll(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>View payroll information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                {/* Employee Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Employee Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Employee Name</label>
                      <p className="text-sm">{selectedPayroll.employee?.first_name} {selectedPayroll.employee?.last_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Employee ID</label>
                      <p className="text-sm">{selectedPayroll.employee?.employee_id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Department</label>
                      <p className="text-sm">{selectedPayroll.employee?.department?.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Position</label>
                      <p className="text-sm">{selectedPayroll.employee?.position}</p>
                    </div>
                  </div>
                </div>

                {/* Payroll Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Payroll Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Pay Period</label>
                      <p className="text-sm">{selectedPayroll.pay_period}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedPayroll.status)}`}>
                        {selectedPayroll.status}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Basic Salary</label>
                      <p className="text-sm font-semibold">₦{selectedPayroll.basic_salary?.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Allowances</label>
                      <p className="text-sm">₦{selectedPayroll.allowances?.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Deductions</label>
                      <p className="text-sm">₦{selectedPayroll.deductions?.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Net Salary</label>
                      <p className="text-sm font-semibold text-blue-600">₦{selectedPayroll.net_salary?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Created Date</label>
                      <p className="text-sm">{new Date(selectedPayroll.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Updated Date</label>
                      <p className="text-sm">{new Date(selectedPayroll.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>

      {/* Edit Payroll Modal */}
      <PermissionGate module="hr" action="edit">
        {showEditModal && selectedPayroll && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Edit Payroll</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedPayroll(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Edit payroll information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-yellow-600 mr-2" />
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Editing payroll records should be done carefully. 
                      Only basic information can be modified after processing.
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Employee</label>
                    <p className="text-sm">{selectedPayroll.employee?.first_name} {selectedPayroll.employee?.last_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Pay Period</label>
                    <p className="text-sm">{selectedPayroll.pay_period}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedPayroll.status)}`}>
                      {selectedPayroll.status}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Net Salary</label>
                    <p className="text-sm font-semibold text-blue-600">₦{selectedPayroll.net_salary?.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                    onClick={() => {
                      toast({
                        title: "Edit Payroll",
                        description: "Payroll editing functionality will be implemented in the next update.",
                      })
                      setShowEditModal(false)
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>

    </div>
  )
}
