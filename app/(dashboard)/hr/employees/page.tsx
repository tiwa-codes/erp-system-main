"use client"

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
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Users,
  MoreHorizontal,
  ToggleLeft,
  X,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AddEmployeeForm } from "@/components/forms/add-employee-form"
import { EditEmployeeForm } from "@/components/forms/edit-employee-form"
import { ViewEmployee } from "@/components/forms/view-employee"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { PermissionButton } from "@/components/ui/permission-button"
import { PermissionGate } from "@/components/ui/permission-gate"

export const dynamic = 'force-dynamic'

export default function EmployeesPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch employees data
  const { data: employeesData, isLoading, refetch } = useQuery({
    queryKey: ["employees", debouncedSearchTerm, selectedDepartment, selectedStatus, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm)
      if (selectedDepartment !== "all") params.append("department", selectedDepartment)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      params.append("page", currentPage.toString())
      params.append("limit", "10")
      
      const res = await fetch(`/api/hr/employees?${params}`)
      if (!res.ok) throw new Error("Failed to fetch employees")
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

  const employees = employeesData?.employees || []
  const pagination = employeesData?.pagination

  const fetchEmployeeDetails = async (employeeId: string) => {
    const res = await fetch(`/api/hr/employees/${employeeId}`)
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.message || error.error || "Failed to fetch employee details")
    }
    const data = await res.json()
    return data.data || data.employee || data
  }

  const handleAddEmployee = () => {
    setShowAddModal(true)
  }

  const handleViewEmployee = async (emp: any) => {
    try {
      const employeeDetails = await fetchEmployeeDetails(emp.id)
      setSelectedEmployee(employeeDetails)
      setShowViewModal(true)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load employee details",
        variant: "destructive"
      })
    }
  }

  const handleEditEmployee = async (emp: any) => {
    try {
      const employeeDetails = await fetchEmployeeDetails(emp.id)
      setSelectedEmployee(employeeDetails)
      setShowEditModal(true)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load employee details",
        variant: "destructive"
      })
    }
  }

  const handleDeleteEmployee = async (emp: any) => {
    if (!confirm(`Delete employee "${emp.first_name} ${emp.last_name}"?`)) return

    try {
      const res = await fetch(`/api/hr/employees/${emp.id}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete employee')
      }

      toast({
        title: "Employee deleted successfully",
        description: `${emp.first_name} ${emp.last_name} has been deleted from the system.`
      })
      
      refetch()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete employee",
        variant: "destructive"
      })
    }
  }

  const handleChangeStatus = async (emp: any) => {
    const newStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const statusText = newStatus === 'ACTIVE' ? 'activate' : 'deactivate'
    
    if (!confirm(`${statusText.charAt(0).toUpperCase() + statusText.slice(1)} employee "${emp.first_name} ${emp.last_name}"?`)) return

    try {
      const res = await fetch(`/api/hr/employees/${emp.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })
      
      if (!res.ok) {
        let errorMessage = 'Failed to update employee status'
        try {
          const error = await res.json()
          errorMessage = error.error || error.message || errorMessage
        } catch (e) {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`
        }
        throw new Error(errorMessage)
      }

      toast({
        title: "Employee status updated successfully",
        description: `${emp.first_name} ${emp.last_name} has been ${statusText}d.`
      })
      
      refetch()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update employee status",
        variant: "destructive"
      })
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm)
      if (selectedDepartment !== "all") params.append("department", selectedDepartment)
      if (selectedStatus !== "all") params.append("status", selectedStatus)

      const response = await fetch(`/api/hr/employees/export?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to export employees')
      }

      const csvContent = await response.text()
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `employees-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: "Employees data has been exported successfully."
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export employees",
        variant: "destructive"
      })
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-600">Manage employee records and information</p>
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
            onClick={handleAddEmployee}
            className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Employee
          </PermissionButton>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search employees..."
                  className="pl-9 max-w-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employee</SelectItem>
                  {departments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DEPARTMENT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ROLE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp: any) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-400">
                            {emp.first_name?.[0]}{emp.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</div>
                          <div className="text-sm text-gray-500">{emp.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{emp.department?.name || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{emp.position}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{emp.employee_id}</div>
                    </TableCell>
                    <TableCell>
                      <StatusIndicator status={emp.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <PermissionButton 
                            module="hr" 
                            action="view"
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewEmployee(emp)}
                            className="w-full justify-start text-xs"
                          >
                            View
                          </PermissionButton>
                          <PermissionButton 
                            module="hr" 
                            action="edit"
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditEmployee(emp)}
                            className="w-full justify-start text-xs"
                          >
                            Edit
                          </PermissionButton>
                          <PermissionButton 
                            module="hr" 
                            action="edit"
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleChangeStatus(emp)}
                            className="w-full justify-start text-xs"
                          >
                            Change Status
                          </PermissionButton>
                          <PermissionButton 
                            module="hr" 
                            action="delete"
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 w-full justify-start text-xs"
                            onClick={() => handleDeleteEmployee(emp)}
                          >
                            Delete
                          </PermissionButton>
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

      {/* Add Employee Modal */}
      <PermissionGate module="hr" action="add">
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Add Employee</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Add a new employee to the system</CardDescription>
              </CardHeader>
              <CardContent>
                <AddEmployeeForm 
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
      </PermissionGate>

      {/* Edit Employee Modal */}
      <PermissionGate module="hr" action="edit">
        {showEditModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Edit Employee</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedEmployee(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Update employee information</CardDescription>
              </CardHeader>
              <CardContent>
                <EditEmployeeForm
                  employee={selectedEmployee}
                  onCancel={() => { 
                    setShowEditModal(false)
                    setSelectedEmployee(null)
                  }}
                  onSuccess={() => { 
                    setShowEditModal(false)
                    setSelectedEmployee(null)
                    refetch()
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>

      {/* View Employee Modal */}
      <PermissionGate module="hr" action="view">
        {showViewModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Employee Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowViewModal(false)
                      setSelectedEmployee(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>View employee information</CardDescription>
              </CardHeader>
              <CardContent>
                <ViewEmployee
                  employee={selectedEmployee}
                  onClose={() => { 
                    setShowViewModal(false)
                    setSelectedEmployee(null)
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>

    </div>
  )
}
