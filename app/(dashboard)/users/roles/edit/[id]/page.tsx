"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  ArrowLeft,
  Save,
  Loader2
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

const editRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional()
})

type EditRoleFormData = z.infer<typeof editRoleSchema>

const MODULES_WITH_SUBMODULES = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    submodules: [
      { id: 'dashboard', name: 'Dashboard' }
    ]
  },
  {
    id: 'hr',
    name: 'Human Resources',
    submodules: [
      { id: 'employees', name: 'Employees' },
      { id: 'departments', name: 'Department' },
      { id: 'attendance', name: 'Attendance' },
      { id: 'leave', name: 'Leave Management' },
      { id: 'payroll', name: 'Payroll' },
      { id: 'memos', name: 'Memo' },
      { id: 'hr-rules', name: 'HR Rules' },
      { id: 'procurement', name: 'Procurement' }
    ]
  },
  {
    id: 'claims',
    name: 'Claims',
    submodules: [
      { id: 'claims', name: 'Claims' },
      { id: 'vetter', name: 'Vetter' },
      { id: 'procurement', name: 'Procurement' },
      { id: 'leave', name: 'Leave Management' }
    ]
  },
  {
    id: 'finance',
    name: 'Finance',
    submodules: [
      { id: 'accounts', name: 'Accounts' },
      { id: 'transactions', name: 'Transactions' },
      { id: 'procurement', name: 'Procurement' },
      { id: 'leave', name: 'Leave Management' }
    ]
  },
  {
    id: 'provider',
    name: 'Provider Management',
    submodules: [
      { id: 'provider', name: 'Provider' },
      { id: 'inpatient', name: 'In-patient Management' },
      { id: 'procurement', name: 'Procurement' },
      { id: 'leave', name: 'Leave Management' }
    ]
  },
  {
    id: 'providers',
    name: 'Provider',
    submodules: [
      { id: 'approval-code-request', name: 'Approval Code Request' },
      { id: 'claims-request', name: 'Claims Request' },
      { id: 'verify-encounter-code', name: 'Verify Encounter Code' }
    ]
  },
  {
    id: 'department-oversight',
    name: 'Department Oversight',
    submodules: [
      { id: 'procurement-bill', name: 'Procurement Bill' }
    ]
  },
  {
    id: 'operation-desk',
    name: 'Internal Control',
    submodules: [
      { id: 'procurement-bill', name: 'Procurement Bill' },
      { id: 'audit', name: 'Audit' }
    ]
  },
  {
    id: 'executive-desk',
    name: 'Executive Desk',
    submodules: [
      { id: 'procurement-bill', name: 'Procurement Bill' },
      { id: 'approval', name: 'Approval' }
    ]
  },
  {
    id: 'underwriting',
    name: 'Underwriting',
    submodules: [
      { id: 'organizations', name: 'Organizations' },
      { id: 'principals', name: 'Principals' },
      { id: 'dependents', name: 'Dependents' },
      { id: 'plans', name: 'Plans' }
    ]
  },
  {
    id: 'call-centre',
    name: 'Call Centre',
    submodules: [
      { id: 'coverage-checker', name: 'Coverage Checker' },
      { id: 'approval-codes', name: 'Approval Codes' },
      { id: 'rejected-services', name: 'Rejected Services' },
      { id: 'generate-code', name: 'Generate Code' },
      { id: 'validate-code', name: 'Validate Code' },
      { id: 'procurement', name: 'Procurement' },
      { id: 'leave', name: 'Leave Management' }
    ]
  },
  {
    id: 'reports',
    name: 'Reports',
    submodules: [
      { id: 'reports', name: 'Reports' }
    ]
  },
  {
    id: 'statistics',
    name: 'Statistics',
    submodules: [
      { id: 'overview', name: 'Overview' },
      { id: 'erp-staff-usage', name: 'ERP Staff Usage' },
      { id: 'provider-usage', name: 'Provider Usage' },
      { id: 'enrollee-app-usage', name: 'Enrollee App Usage' },
      { id: 'login-analytics', name: 'Login Analytics' },
      { id: 'drop-off-analytics', name: 'Drop-off Analytics' },
      { id: 'daily-activities', name: 'Daily Activities' },
      { id: 'android-vs-ios', name: 'Android vs iOS' },
      { id: 'reports-export', name: 'Reports & Export' }
    ]
  },
  {
    id: 'users',
    name: 'User Management',
    submodules: [
      { id: 'users', name: 'Users' },
      { id: 'provider-accounts', name: 'Provider Accounts' },
      { id: 'client-accounts', name: 'Client Accounts' },
      { id: 'roles', name: 'Roles' },
      { id: 'permissions', name: 'Permissions' }
    ]
  },
  {
    id: 'settings',
    name: 'Settings',
    submodules: [
      { id: 'service-types', name: 'Service Types' },
      { id: 'risk-management', name: 'Risk Management' }
    ]
  }
]

const ACTIONS = ['Create', 'View', 'Edit', 'Delete']

export default function EditRolePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { id } = params

  const form = useForm<EditRoleFormData>({
    resolver: zodResolver(editRoleSchema),
    defaultValues: {
      name: "",
      description: ""
    }
  })

  // Fetch role data
  const { data: roleData, isLoading } = useQuery({
    queryKey: ['role', id],
    queryFn: async () => {
      const res = await fetch(`/api/users/roles/${id}`)
      if (!res.ok) throw new Error('Failed to fetch role')
      return res.json()
    },
    enabled: !!id
  })

  // Update form when role data is loaded
  useEffect(() => {
    if (roleData?.role) {
      form.reset({
        name: roleData.role.name,
        description: roleData.role.description || ""
      })
    }
  }, [roleData, form])

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (data: EditRoleFormData) => {
      const res = await fetch(`/api/users/roles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update role')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Role updated successfully",
        description: "The role has been updated successfully."
      })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      router.push('/users/roles')
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const isSystemRole = roleData?.role?.isSystemRole

  const onSubmit = (data: EditRoleFormData) => {
    updateRoleMutation.mutate(data)
  }



  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!roleData?.role) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Role not found</h2>
          <p className="text-gray-600 mt-2">The role you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/users/roles')} className="mt-4">
            Back to Roles
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate module="users" action="edit">
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
              <h1 className="text-3xl font-bold text-gray-900">Edit Role</h1>
              <p className="text-gray-600">Update role information. Permissions will be managed in the permission matrix.</p>
            </div>
          </div>
        </div>

        {isSystemRole ? (
          <div className="space-y-6">
            {/* System Role Information */}
            <Card>
              <CardHeader>
                <CardTitle>System Role Information</CardTitle>
                <CardDescription>This is a system role and cannot be modified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Role Name</Label>
                    <Input
                      id="name"
                      value={roleData?.role?.name || ''}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={roleData?.role?.description || ''}
                      disabled
                      rows={3}
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    <strong>Note:</strong> System roles are predefined and cannot be edited or deleted. 
                    They provide core functionality to the system.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* System Role Permissions */}
            <Card>
              <CardHeader>
                <CardTitle>System Role Permissions</CardTitle>
                <CardDescription>View the permissions assigned to this system role</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {MODULES_WITH_SUBMODULES.map((module) => (
                    <div key={module.id} className="border rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-4">{module.name}</h3>
                      <div className="space-y-4">
                        {module.submodules.map((submodule) => (
                          <div key={submodule.id} className="border-l-2 border-gray-200 pl-4">
                            <h4 className="font-medium text-gray-700 mb-2">{submodule.name}</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {ACTIONS.map((action) => (
                                <div key={action} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${module.id}-${submodule.id}-${action}`}
                                    checked={roleData?.role?.permissions?.includes('all') || 
                                           roleData?.role?.permissions?.includes(`${module.id}.${submodule.id}.${action.toLowerCase()}`)}
                                    disabled
                                    className="bg-gray-50"
                                  />
                                  <Label 
                                    htmlFor={`${module.id}-${submodule.id}-${action}`}
                                    className="text-sm font-normal text-gray-500"
                                  >
                                    {action}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Back
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Update the role's basic information. Permissions will be managed in the permission matrix.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Role Name *</Label>
                    <Input
                      id="name"
                      {...form.register("name")}
                      placeholder="Enter role name"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      {...form.register("description")}
                      placeholder="Enter role description"
                      rows={3}
                    />
                    {form.formState.errors.description && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.description.message}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateRoleMutation.isPending}
                className="bg-[#BE1522] hover:bg-[#9B1219]"
              >
                {updateRoleMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Role
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PermissionGate>
  )
}
