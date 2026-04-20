"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { StatusText } from "@/components/ui/status-text"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Users, 
  UserCheck, 
  Shield, 
  UserPlus,
  Search,
  Filter,
  Plus,
  Key,
  Eye,
  Edit,
  Trash2,
  Download,
  Shield as ShieldIcon,
  MoreHorizontal,
  Copy,
  X,
  Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AddUserForm } from "@/components/forms/add-user-form"
import { EditUserForm } from "@/components/forms/edit-user-form"
import { ViewUser } from "@/components/forms/view-user"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface UsersListProps {
  defaultRole?: string
  excludeRole?: string
  pageTitle?: string
  pageDescription?: string
  hideRoleFilter?: boolean
}

export default function UsersList({
  defaultRole = "all",
  excludeRole,
  pageTitle = "User Access Control",
  pageDescription = "Manage users",
  hideRoleFilter = false,
}: UsersListProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState(defaultRole)
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddUserForm, setShowAddUserForm] = useState(false)
  const [showEditUserForm, setShowEditUserForm] = useState(false)
  const [showViewUser, setShowViewUser] = useState(false)
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false)
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false)
  const [showTempPasswordConfirmModal, setShowTempPasswordConfirmModal] = useState(false)
  const [showTempPasswordResultModal, setShowTempPasswordResultModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isGeneratingTempPassword, setIsGeneratingTempPassword] = useState(false)
  const [generatedTempPassword, setGeneratedTempPassword] = useState<{
    email: string
    password: string
    loginUrl: string
    message: string
  } | null>(null)

  // Fetch users data
  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ["users", searchTerm, selectedRole, selectedStatus, selectedDepartment, currentPage, excludeRole],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)
      if (selectedRole !== "all") params.append("role", selectedRole)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (selectedDepartment !== "all") params.append("department", selectedDepartment)
      if (excludeRole) params.append("excludeRole", excludeRole)
      params.append("page", currentPage.toString())
      params.append("limit", "10")
      
      const res = await fetch(`/api/users?${params}`)
      if (!res.ok) throw new Error("Failed to fetch users")
      return res.json()
    }
  })

  // Fetch user metrics
  const { data: userMetrics } = useQuery({
    queryKey: ["user-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/users/metrics")
      if (!res.ok) throw new Error("Failed to fetch user metrics")
      return res.json()
    }
  })

  const users = usersData?.users || []
  const pagination = usersData?.pagination
  const isProviderAccountsPage = hideRoleFilter && defaultRole === "provider"

  const handleAddUser = () => {
    setShowAddUserForm(true)
  }

  const handleUserCreated = () => {
    refetch()
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (pagination && currentPage < pagination.pages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handleFilterChange = () => {
    setCurrentPage(1) // Reset to first page when filters change
  }

  const handleViewUser = (user: any) => {
    setSelectedUser(user)
    setShowViewUser(true)
  }

  const handleEditUser = (user: any) => {
    setSelectedUser(user)
    setShowEditUserForm(true)
  }

  const handleChangeStatus = (user: any) => {
    setSelectedUser(user)
    setShowChangeStatusModal(true)
  }

  const handleResetPassword = (user: any) => {
    setSelectedUser(user)
    setShowPasswordResetModal(true)
  }

  const handleGenerateTemporaryPassword = (user: any) => {
    setSelectedUser(user)
    setShowTempPasswordConfirmModal(true)
  }

  const confirmGenerateTemporaryPassword = async () => {
    if (!selectedUser) return

    setIsGeneratingTempPassword(true)
    try {
      const res = await fetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendEmail: false,
          mode: "manual-share"
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate temporary password')
      }

      const data = await res.json()
      const loginUrl = data.loginUrl || (typeof window !== "undefined" ? `${window.location.origin}/auth/signin` : "https://aspirage.com/auth/signin")
      const message = `ERP Login Details\nEmail: ${selectedUser.email}\nTemporary Password: ${data.tempPassword}\nLogin URL: ${loginUrl}`

      setGeneratedTempPassword({
        email: selectedUser.email,
        password: data.tempPassword,
        loginUrl,
        message
      })

      setShowTempPasswordConfirmModal(false)
      setShowTempPasswordResultModal(true)

      toast({
        title: "Temporary password generated",
        description: "Copy and share it with the provider."
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate temporary password",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingTempPassword(false)
    }
  }

  const handleCopyTempPasswordMessage = async () => {
    if (!generatedTempPassword) return
    try {
      await navigator.clipboard.writeText(generatedTempPassword.message)
      toast({
        title: "Copied",
        description: "Login details copied to clipboard."
      })
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy. Please copy manually.",
        variant: "destructive"
      })
    }
  }

  const confirmPasswordReset = async () => {
    if (!selectedUser) return

    setIsResettingPassword(true)
    try {
      const res = await fetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reset password')
      }

      toast({
        title: "Password reset successfully",
        description: `A new password has been sent to ${selectedUser.email}`
      })
      
      setShowPasswordResetModal(false)
      setSelectedUser(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset password",
        variant: "destructive"
      })
    } finally {
      setIsResettingPassword(false)
    }
  }

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Delete user "${user.email}"?`)) return

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete user')
      }

      const result = await res.json()

      toast({
        title: result?.title || "User updated successfully",
        description: result?.message || `${user.first_name} ${user.last_name} has been removed from active users.`
      })
      
      refetch()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive"
      })
    }
  }

  const handleBulkPasswordReset = async () => {
    // For now, just show a message. In a real implementation, you'd have user selection
    toast({
      title: "Bulk Password Reset",
      description: "Please select users first to reset their passwords."
    })
  }

  const handleExportUsers = () => {
    toast({
      title: "Export Users",
      description: "User data export initiated."
    })
  }

  const handlePermissionMatrix = () => {
    window.location.href = "/users/permissions"
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin": return "bg-purple-100 text-purple-800"
      case "Operations": return "bg-blue-100 text-blue-800"
      case "Sub-Admin": return "bg-orange-100 text-orange-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-100 text-green-800"
      case "Inactive": return "bg-yellow-100 text-yellow-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-gray-600 mt-1">{pageDescription}</p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={handleAddUser} className="bg-[#0891B2] hover:bg-[#9B1219] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add New User
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{userMetrics?.totalUsers || 0}</p>
                <p className="text-sm text-green-600">+5% this month</p>
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
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{userMetrics?.activeUsers || 0}</p>
                <p className="text-sm text-green-600">94.4% active</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-gray-900">{userMetrics?.admins || 0}</p>
                <p className="text-sm text-gray-600">System Administrator</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sub-Admins</p>
                <p className="text-2xl font-bold text-gray-900">{userMetrics?.subAdmins || 0}</p>
                <p className="text-sm text-gray-600">IT Personnel</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserPlus className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Section */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  handleFilterChange()
                }}
                className="w-full"
              />
            </div>
            
            {!hideRoleFilter && (
              <Select value={selectedRole} onValueChange={(value) => {
                setSelectedRole(value)
                handleFilterChange()
              }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="sub-admin">Sub-Admin</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select value={selectedStatus} onValueChange={(value) => {
              setSelectedStatus(value)
              handleFilterChange()
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedDepartment} onValueChange={(value) => {
              setSelectedDepartment(value)
              handleFilterChange()
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Department</SelectItem>
                <SelectItem value="md-office">MD's Office</SelectItem>
                <SelectItem value="underwriting">Underwriting</SelectItem>
                <SelectItem value="claims">Claims</SelectItem>
                <SelectItem value="ict">ICT</SelectItem>
              </SelectContent>
            </Select>

            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}

      {/* Users Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription className="mt-2">Manage system users and their permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">USER DETAILS</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">ROLE</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">DEPARTMENT</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">PROVIDER</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">PHONE</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">STATUS</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-600">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-400">
                            {`${user.first_name || ''} ${user.last_name || ''}`.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{`${user.first_name || ''} ${user.last_name || ''}`}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{user.department}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{user.provider}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{user.phone}</td>
                    <td className="py-3 px-4">
                      <StatusText status={user.status} />
                    </td>
                    <td className="py-3 px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleViewUser(user)}
                            className="w-full justify-start text-xs"
                          >
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleEditUser(user)}
                            className="w-full justify-start text-xs"
                          >
                            Edit
                          </DropdownMenuItem>
                          {!isProviderAccountsPage && (
                            <DropdownMenuItem 
                              onClick={() => handleResetPassword(user)}
                              className="w-full justify-start text-xs"
                            >
                              <Key className="h-3 w-3 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                          )}
                          {String(user.role || '').toLowerCase() === 'provider' && (
                            <DropdownMenuItem 
                              onClick={() => handleGenerateTemporaryPassword(user)}
                              className="w-full justify-start text-xs"
                            >
                              <Key className="h-3 w-3 mr-2" />
                              Generate Temporary Password
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleChangeStatus(user)}
                            className="w-full justify-start text-xs"
                          >
                            Change Status
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600 w-full justify-start text-xs"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {pagination && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={handlePreviousPage}
                >
                  Previous
                </Button>
                <Button variant="outline" size="sm">
                  {pagination.page}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={handleNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Action Buttons */}
      <div className="flex items-center justify-end gap-4">
        <Button onClick={handlePermissionMatrix} className="bg-purple-600 hover:bg-purple-700 text-white">
          <ShieldIcon className="h-4 w-4 mr-2" />
          Permission Matrix
        </Button>
      </div>

      {/* Add User Dialog */}
      {showAddUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Add User</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddUserForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>Add a new user to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <AddUserForm 
                onClose={() => setShowAddUserForm(false)} 
                onCreated={() => { 
                  setShowAddUserForm(false)
                  refetch()
                }} 
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit User Dialog */}
      {showEditUserForm && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Edit User</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowEditUserForm(false)
                    setSelectedUser(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>Update user details</CardDescription>
            </CardHeader>
            <CardContent>
              <EditUserForm
                user={selectedUser}
                onClose={() => {
                  setShowEditUserForm(false)
                  setSelectedUser(null)
                }}
                onUpdated={() => {
                  setShowEditUserForm(false)
                  setSelectedUser(null)
                  refetch()
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* View User Dialog */}
      {showViewUser && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">User Details</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowViewUser(false)
                    setSelectedUser(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>View user information</CardDescription>
            </CardHeader>
            <CardContent>
              <ViewUser
                user={selectedUser}
                onClose={() => { 
                  setShowViewUser(false)
                  setSelectedUser(null)
                }}
                onEdit={() => {
                  setShowViewUser(false)
                  setShowEditUserForm(true)
                }}
                onDelete={() => {
                  setShowViewUser(false)
                  handleDeleteUser(selectedUser)
                  setSelectedUser(null)
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Change Status Modal */}
      {showChangeStatusModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Change User Status</CardTitle>
              <CardDescription>
                Change the status for {selectedUser.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={selectedUser.status} 
                    onValueChange={(value) => setSelectedUser({...selectedUser, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowChangeStatusModal(false)
                  setSelectedUser(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  setIsUpdatingStatus(true)
                  try {
                    const res = await fetch(`/api/users/${selectedUser.id}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        status: selectedUser.status
                      })
                    })
                    
                    if (res.ok) {
                      toast({
                        title: "Status Updated",
                        description: `${selectedUser.name}'s status has been updated to ${selectedUser.status}`,
                      })
                      setShowChangeStatusModal(false)
                      setSelectedUser(null)
                      refetch()
                    } else {
                      throw new Error("Failed to update status")
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to update user status",
                      variant: "destructive",
                    })
                  } finally {
                    setIsUpdatingStatus(false)
                  }
                }}
                disabled={isUpdatingStatus}
                className="bg-[#0891B2] hover:bg-[#9B1219]"
              >
                {isUpdatingStatus ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Password Reset Confirmation Modal */}
      {showPasswordResetModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-orange-500" />
                Reset Password
              </CardTitle>
              <CardDescription>
                Reset password for {selectedUser.first_name} {selectedUser.last_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <ShieldIcon className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Password Reset Warning
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>This action will:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Generate a new random password</li>
                          <li>Send the new password to {selectedUser.email}</li>
                          <li>Log this action in the audit trail</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <Eye className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        What happens next?
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>The user will receive an email with their new password and should change it immediately upon login.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordResetModal(false)
                  setSelectedUser(null)
                }}
                disabled={isResettingPassword}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmPasswordReset}
                disabled={isResettingPassword}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isResettingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Temporary Password Confirmation Modal */}
      {showTempPasswordConfirmModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-[#0891B2]" />
                Generate Temporary Password
              </CardTitle>
              <CardDescription>
                Is this mail correct before generating login details?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border p-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-900">{selectedUser.email}</p>
              </div>
            </CardContent>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTempPasswordConfirmModal(false)
                  setSelectedUser(null)
                }}
                disabled={isGeneratingTempPassword}
              >
                No
              </Button>
              <Button
                onClick={confirmGenerateTemporaryPassword}
                disabled={isGeneratingTempPassword}
                className="bg-[#0891B2] hover:bg-[#9B1219]"
              >
                {isGeneratingTempPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Yes, Generate"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Temporary Password Result Modal */}
      {showTempPasswordResultModal && generatedTempPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-xl mx-4">
            <CardHeader>
              <CardTitle>Temporary Password Generated</CardTitle>
              <CardDescription>
                Copy and send via WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div className="font-medium text-gray-600">Email</div>
                <div className="md:col-span-2 text-gray-900 break-all">{generatedTempPassword.email}</div>
                <div className="font-medium text-gray-600">Temporary Password</div>
                <div className="md:col-span-2 text-gray-900">{generatedTempPassword.password}</div>
                <div className="font-medium text-gray-600">ERP URL</div>
                <div className="md:col-span-2 text-gray-900 break-all">{generatedTempPassword.loginUrl}</div>
              </div>
              <div>
                <Label htmlFor="temp-password-message">Copy Message</Label>
                <textarea
                  id="temp-password-message"
                  value={generatedTempPassword.message}
                  readOnly
                  className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm bg-gray-50 min-h-[140px]"
                />
              </div>
            </CardContent>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTempPasswordResultModal(false)
                  setGeneratedTempPassword(null)
                  setSelectedUser(null)
                }}
              >
                Close
              </Button>
              <Button onClick={handleCopyTempPasswordMessage} className="bg-[#0891B2] hover:bg-[#9B1219]">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}
