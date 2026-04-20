"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
  Building2,
  Users,
  Edit,
  Trash2,
  Search,
  MoreHorizontal,
  Eye,
  X,
  Download,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"



export default function DepartmentsPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null)
  const [departmentEmployees, setDepartmentEmployees] = useState<any[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [employeesPage, setEmployeesPage] = useState(1)
  const [employeesLimit] = useState(10)
  const [employeesPagination, setEmployeesPagination] = useState<{
    page: number
    pages: number
    total: number
    limit: number
  } | null>(null)
  const [form, setForm] = useState({
    name: "",
    description: "",
  })

  // Fetch departments
  const { data: departments = [], refetch } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments")
      if (!res.ok) throw new Error("Failed to fetch departments")
      return res.json()
    }
  })

  // Filter departments based on search
  const filteredDepartments = departments.filter((dept: any) =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Create department mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to create department")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Department created successfully" })
      setShowAddModal(false)
      setForm({ name: "", description: "" })
      refetch()
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  })

  // Update department mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/departments/${selectedDepartment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update department")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Department updated successfully" })
      setShowEditModal(false)
      setSelectedDepartment(null)
      setForm({ name: "", description: "" })
      refetch()
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  })

  // Delete department mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/departments/${id}`, {
        method: "DELETE"
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete department")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Department deleted successfully" })
      refetch()
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  })

  const handleAddDepartment = () => {
    setForm({ name: "", description: "" })
    setShowAddModal(true)
  }

  const closeViewModal = () => {
    setShowViewModal(false)
    setSelectedDepartment(null)
    setDepartmentEmployees([])
    setEmployeesPagination(null)
    setEmployeesPage(1)
  }

  const loadDepartmentEmployees = async (deptId: string, page: number) => {
    setDepartmentEmployees([])
    setIsLoadingEmployees(true)
    try {
      const res = await fetch(`/api/hr/employees?department=${deptId}&page=${page}&limit=${employeesLimit}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to fetch department employees")
      }
      const data = await res.json()
      setDepartmentEmployees(data.employees || [])
      if (data.pagination) {
        setEmployeesPagination(data.pagination)
        setEmployeesPage(data.pagination.page)
      } else {
        setEmployeesPagination(null)
        setEmployeesPage(page)
      }
    } catch (error: any) {
      console.error("Error fetching department employees:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to load employees for this department",
        variant: "destructive",
      })
    } finally {
      setIsLoadingEmployees(false)
    }
  }

  const handleViewDepartment = (dept: any) => {
    setSelectedDepartment(dept)
    setShowViewModal(true)
    loadDepartmentEmployees(dept.id, 1)
  }

  const handleEditDepartment = (dept: any) => {
    setSelectedDepartment(dept)
    setForm({ name: dept.name, description: dept.description || "" })
    setShowEditModal(true)
  }

  const handleDeleteDepartment = async (dept: any) => {
    if (!confirm(`Delete department "${dept.name}"?`)) return
    
    try {
      await deleteMutation.mutateAsync(dept.id)
    } catch (error) {
      console.error('Error deleting department:', error)
    }
  }
 
  const getStatusBadgeClass = (status?: string) => {
    const normalized = (status || "ACTIVE").toUpperCase()
    switch (normalized) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-gray-100 text-gray-800"
      case "ON_LEAVE":
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-800"
      case "TERMINATED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-blue-100 text-blue-800"
    }
  }

  const handlePageChange = (targetPage: number) => {
    if (!selectedDepartment) return
    if (targetPage < 1) return
    if (employeesPagination && targetPage > employeesPagination.pages) return
    loadDepartmentEmployees(selectedDepartment.id, targetPage)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (showAddModal) {
      createMutation.mutate()
    } else {
      updateMutation.mutate()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-600">Manage organizational departments</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => {}}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleAddDepartment} className="bg-[#0891B2] hover:bg-[#9B1219] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </Button>
        </div>
      </div>

      {/* Search Section */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search departments..."
              className="pl-9 max-w-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Departments Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Departments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">DEPARTMENT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DESCRIPTION</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">EMPLOYEES</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">CREATED</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.map((dept: any) => (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-400">
                            {dept.name.split(' ').map((word: string) => word[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{dept.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {dept.description || "No description"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900">{dept.users?.length || 0}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-500">
                        {new Date(dept.created_at).toLocaleDateString()}
                      </div>
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
                            onClick={() => handleViewDepartment(dept)}
                            className="w-full justify-start text-xs"
                          >
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleEditDepartment(dept)}
                            className="w-full justify-start text-xs"
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteDepartment(dept)}
                            className="text-red-600 hover:text-red-700 w-full justify-start text-xs"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Add Department</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>Create a new department in the organization</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Department Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter department name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter department description"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Department"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditModal && selectedDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Edit Department</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedDepartment(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>Update department information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Department Name *</Label>
                  <Input
                    id="edit-name"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter department name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter department description"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending}
                    className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
                  >
                    {updateMutation.isPending ? "Updating..." : "Update Department"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Department Modal */}
      {showViewModal && selectedDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Department Details</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeViewModal}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>View department information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Department Name</Label>
                  <div className="mt-1 text-sm text-gray-900">{selectedDepartment.name}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Description</Label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedDepartment.description || "No description provided"}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Number of Employees</Label>
                  <div className="mt-1 text-sm text-gray-900">
                    {departmentEmployees.length || selectedDepartment.users?.length || 0} employees
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Created Date</Label>
                  <div className="mt-1 text-sm text-gray-900">
                    {new Date(selectedDepartment.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Employees</h3>
                  <span className="text-sm text-gray-500">
                    {departmentEmployees.length || "0"} records
                  </span>
                </div>
                {isLoadingEmployees ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    Loading employees...
                  </div>
                ) : departmentEmployees.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    No employees added yet for this department.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs font-medium text-gray-600">EMPLOYEE ID</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600">NAME</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600">POSITION</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600">TITLE</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600">EMAIL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {departmentEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                              <TableCell className="text-sm text-gray-900">{employee.employee_id}</TableCell>
                              <TableCell>
                                <div className="font-medium text-gray-900">
                                  {employee.first_name} {employee.last_name}
                                </div>
                                <div className="text-xs text-gray-500">{employee.phone_number || "No phone"}</div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-900">
                                {employee.position || "N/A"}
                              </TableCell>
                              <TableCell className="text-sm text-gray-900">
                                {employee.title || "N/A"}
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusBadgeClass(employee.status)}>
                                  {employee.status || "UNKNOWN"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <a href={`mailto:${employee.email}`} className="text-sm text-blue-600">
                                  {employee.email}
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {employeesPagination && (
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div>
                          Showing page {employeesPagination.page} of {employeesPagination.pages} · {employeesPagination.total} employees
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePageChange(employeesPagination.page - 1)}
                            disabled={employeesPagination.page === 1 || isLoadingEmployees}
                          >
                            Previous
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePageChange(employeesPagination.page + 1)}
                            disabled={employeesPagination.page === employeesPagination.pages || isLoadingEmployees}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={closeViewModal}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
