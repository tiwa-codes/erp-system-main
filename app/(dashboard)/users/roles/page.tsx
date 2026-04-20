"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  Eye, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Shield,
  Users,
  ArrowLeft
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

export const dynamic = 'force-dynamic'

interface Role {
  id: string
  name: string
  description: string
  userCount: number
  permissions: string[]
  createdAt: string
  updatedAt: string
}

const ROLE_DESCRIPTIONS = {
  'SUPER_ADMIN': 'Full system access with all permissions',
  'ADMIN': 'Administrative access to most modules',
  'HR_MANAGER': 'Human Resources management and oversight',
  'HR_OFFICER': 'Human Resources operational tasks',
  'CLAIMS_PROCESSOR': 'Claims processing and validation',
  'CLAIMS_MANAGER': 'Claims management and approval',
  'FINANCE_OFFICER': 'Financial operations and transactions',
  'PROVIDER_MANAGER': 'Provider management and oversight',
  'PROVIDER': 'Provider-specific access and operations',
  'UNDERWRITER': 'Underwriting operations and plan management'
}

const ROLE_BADGE_COLORS = {
  'SUPER_ADMIN': 'bg-red-100 text-red-800',
  'ADMIN': 'bg-purple-100 text-purple-800',
  'HR_MANAGER': 'bg-blue-100 text-blue-800',
  'HR_OFFICER': 'bg-blue-100 text-blue-800',
  'CLAIMS_PROCESSOR': 'bg-green-100 text-green-800',
  'CLAIMS_MANAGER': 'bg-green-100 text-green-800',
  'FINANCE_OFFICER': 'bg-yellow-100 text-yellow-800',
  'PROVIDER_MANAGER': 'bg-orange-100 text-orange-800',
  'PROVIDER': 'bg-orange-100 text-orange-800',
  'UNDERWRITER': 'bg-indigo-100 text-indigo-800'
}

export default function RolesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState("all")

  // Fetch roles data
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/users/roles")
      if (!res.ok) throw new Error("Failed to fetch roles")
      return res.json()
    }
  })

  // Fetch users count for each role
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      return res.json()
    }
  })

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await fetch(`/api/users/roles/${roleId}`, {
        method: "DELETE"
      })
      if (!res.ok) throw new Error("Failed to delete role")
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Role deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["roles"] })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  })

  const handleDeleteRole = (roleId: string, roleName: string) => {
    if (confirm(`Are you sure you want to delete the role "${roleName}"? This action cannot be undone.`)) {
      deleteRoleMutation.mutate(roleId)
    }
  }

  const handleViewRole = (roleName: string) => {
    router.push(`/users/permissions?role=${roleName}`)
  }

  const handleEditRole = (roleId: string) => {
    router.push(`/users/roles/edit/${roleId}`)
  }

  // Filter roles based on search and selected role
  const filteredRoles = rolesData?.roles?.filter((role: Role) => {
    const matchesSearch = role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         role.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === "all" || role.name === selectedRole
    return matchesSearch && matchesRole
  }) || []

  return (
    <PermissionGate module="users" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
              <p className="text-gray-600">Manage system roles and their permissions</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push("/users/add-role")}
              className="flex items-center gap-2 bg-[#BE1522] hover:bg-[#9B1219]"
            >
              <Plus className="h-4 w-4" />
              Add Role
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Roles</p>
                  <p className="text-2xl font-bold text-gray-900">{rolesData?.roles?.length || 0}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{usersData?.users?.length || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Custom Roles</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {rolesData?.roles?.filter((role: Role) => !Object.keys(ROLE_DESCRIPTIONS).includes(role.name)).length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Shield className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search roles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-48">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-700 bg-blue-50"
                >
                  <option value="all">All Roles</option>
                  {Object.keys(ROLE_DESCRIPTIONS).map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Roles Table */}
        <Card>
          <CardHeader>
            <CardTitle>System Roles</CardTitle>
            <CardDescription>Manage and configure system roles</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-lg">Loading roles...</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((role: Role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Badge className={ROLE_BADGE_COLORS[role.name as keyof typeof ROLE_BADGE_COLORS] || 'bg-gray-100 text-gray-800'}>
                            {role.name}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ROLE_DESCRIPTIONS[role.name as keyof typeof ROLE_DESCRIPTIONS] || role.description}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {usersData?.users?.filter((user: any) => user.role === role.name).length || 0} users
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {Object.keys(ROLE_DESCRIPTIONS).includes(role.name) ? 'System' : 'Custom'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(role.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleViewRole(role.name)}
                              className="w-full justify-start text-xs"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Permissions
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEditRole(role.id)}
                              className="w-full justify-start text-xs"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteRole(role.id, role.name)}
                              className="w-full justify-start text-xs text-red-600"
                              disabled={Object.keys(ROLE_DESCRIPTIONS).includes(role.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Role
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {filteredRoles.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <div className="text-gray-500">No roles found</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
