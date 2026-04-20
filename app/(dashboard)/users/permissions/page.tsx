"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  Checkbox,
} from "@/components/ui/checkbox"
import {
  Save,
  RefreshCw,
  Shield,
  Users,
  Settings,
  AlertCircle,
  Plus,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PermissionButton } from "@/components/ui/permission-button"
import { PermissionGate } from "@/components/ui/permission-gate"



// Define all modules with their submodules
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
      { id: 'chart-of-accounts', name: 'Chart of Accounts' },
      { id: 'general-ledger', name: 'General Ledger' },
      { id: 'general-ledger-summary', name: 'GL Summary' },
      { id: 'journal-entries', name: 'Journal Entries' },
      { id: 'trial-balance', name: 'Trial Balance' },
      { id: 'profit-loss', name: 'Profit & Loss' },
      { id: 'balance-sheet', name: 'Balance Sheet' },
      { id: 'financial-transactions', name: 'Financial Transactions' },
      { id: 'claims-settlement', name: 'Claims Settlement' },
      { id: 'procurement', name: 'Procurement' },
      { id: 'leave', name: 'Leave Management' }
    ]
  },
  {
    id: 'provider',
    name: 'Provider Management',
    submodules: [
      { id: 'provider', name: 'Provider' },
      { id: 'provider-accounts', name: 'Provider Accounts' },
      { id: 'inpatient', name: 'In-patient Management' },
      { id: 'procurement', name: 'Procurement' },
      { id: 'leave', name: 'Leave Management' },
      { id: 'tariff-plan', name: 'Tariff Plan' },
      { id: 'memos', name: 'Memos' }
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
      { id: 'procurement-bill', name: 'Procurement Bill' },
      { id: 'memos', name: 'Memos' }
    ]
  },
  {
    id: 'operation-desk',
    name: 'Internal Control',
    submodules: [
      { id: 'procurement-bill', name: 'Procurement Bill' },
      { id: 'audit', name: 'Audit' },
      { id: 'memos', name: 'Memos' }
    ]
  },
  {
    id: 'executive-desk',
    name: 'Executive Desk',
    submodules: [
      { id: 'procurement-bill', name: 'Procurement Bill' },
      { id: 'approval', name: 'Approval' },
      { id: 'custom-plans', name: 'Custom Plans' },
      { id: 'consolidated-sales', name: 'Consolidated Sales' },
      { id: 'memos', name: 'Memos' }
    ]
  },
  {
    id: 'underwriting',
    name: 'Underwriting',
    submodules: [
      { id: 'organizations', name: 'Organizations' },
      { id: 'coverage', name: 'Coverage Rules' },
      { id: 'principals', name: 'Principals' },
      { id: 'mobile', name: 'Pending Updates' },
      { id: 'dependents', name: 'Dependents' },
      { id: 'utilization', name: 'Client Utilization' },
      { id: 'plans-management', name: 'Plans Management' },
      { id: 'band-labels', name: 'Band Labels' },
      { id: 'procurement', name: 'Procurement' },
      { id: 'leave', name: 'Leave Management' },
      { id: 'memos', name: 'Memos' }
    ]
  },
  {
    id: 'special-risk',
    name: 'Special Services',
    submodules: [
      { id: 'custom-plans', name: 'Custom Plans' },
      { id: 'special-providers', name: 'International Coverage' },
      { id: 'memos', name: 'Memos' }
    ]
  },
  {
    id: 'legal',
    name: 'Legal Services',
    submodules: [
      { id: 'documents', name: 'Documents' },
      { id: 'meeting-minutes', name: 'Meeting Minutes' },
      { id: 'sales-documents', name: 'Sales Documents' },
      { id: 'memos', name: 'Memos' }
    ]
  },
  {
    id: 'sales',
    name: 'Sales',
    submodules: [
      { id: 'corporate', name: 'Corporate' },
      { id: 'agency', name: 'Agency' },
      { id: 'retail', name: 'Retail' },
      { id: 'memos', name: 'Memos' }
    ]
  },
  {
    id: 'fraud-detection',
    name: 'Fraud Detection',
    submodules: [
      { id: 'fraud-detection', name: 'Fraud Detection' },
      { id: 'provider-risk-profile', name: 'Provider Tariff Plan' },
      { id: 'flagged-claims', name: 'Flagged Claims' },
      { id: 'history', name: 'History' },
      { id: 'risk-management', name: 'Risk Management' },
      { id: 'rules-management', name: 'Rules Management' }
    ]
  },
  {
    id: 'call-centre',
    name: 'Call Centre',
    submodules: [
      { id: 'call-centre', name: 'Call Centre' },
      { id: 'requests', name: 'Requests' },
      { id: 'coverage', name: 'Coverage' },
      { id: 'generate-code', name: 'Generate Approval Code' },
      { id: 'manage-encounter-codes', name: 'Manage Encounter Codes' },
      { id: 'rejected-services', name: 'Rejected Services' },
      { id: 'procurement', name: 'Procurement' },
      { id: 'leave', name: 'Leave Management' },
      { id: 'memos', name: 'Memos' }
    ]
  },
  {
    id: 'reports',
    name: 'Reports',
    submodules: [
      { id: 'overview', name: 'Overview' },
      { id: 'utilization', name: 'Utilization' },
      { id: 'filters', name: 'Filters' }
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
    name: 'Users',
    submodules: [
      { id: 'users', name: 'Users' },
      { id: 'provider-accounts', name: 'Provider Accounts' },
      { id: 'client-accounts', name: 'Client Accounts' },
      { id: 'permissions', name: 'Permissions' }
    ]
  },
  {
    id: 'settings',
    name: 'Settings',
    submodules: [
      { id: 'service-types', name: 'Service Types' },
      { id: 'plans', name: 'Plans' },
      { id: 'package-limits', name: 'Package Limits' },
      { id: 'provider-plans', name: 'Provider Plans' },
      { id: 'covered-services', name: 'Covered Services' },
      { id: 'risk-management', name: 'Risk Management' }
    ]
  },
  {
    id: 'telemedicine',
    name: 'Telemedicine',
    submodules: [
      { id: 'scheduled-appointment', name: 'Scheduled Appointment' },
      { id: 'outpatient', name: 'Outpatient' },
      { id: 'manage-facilities', name: 'Manage Facilities' },
      { id: 'claims-request', name: 'Claims Request' },
      { id: 'memos', name: 'Memos' }
    ]
  }
]

const ACTIONS = ['Create', 'View', 'Edit', 'Delete', 'View Claims', 'Manage Memos']

export default function PermissionMatrixPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [permissions, setPermissions] = useState<Record<string, Record<string, Record<string, boolean>>>>({})
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Fetch available roles from API
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await fetch('/api/users/roles')
      if (!res.ok) throw new Error('Failed to fetch roles')
      return res.json()
    }
  })

  const ROLES = rolesData?.roles?.map((role: any) => role.name) || []

  // Fetch permissions for selected role
  // NOTE: Use 'permission-matrix' key (not 'permissions') to avoid colliding with the
  // usePermissions hook in the sidebar, which shares the ['permissions', role] key but
  // fetches from a different endpoint and omits the `allowed` field.
  const { data: rolePermissions, isLoading } = useQuery({
    queryKey: ['permission-matrix', selectedRole],
    queryFn: async () => {
      if (!selectedRole) return []
      const res = await fetch(`/api/permissions?role=${encodeURIComponent(selectedRole)}`)
      if (!res.ok) throw new Error('Failed to fetch permissions')
      return res.json()
    },
    enabled: !!selectedRole,
  })

  // Initialize permissions state when data is loaded
  useEffect(() => {
    if (rolePermissions) {
      const newPermissions: Record<string, Record<string, Record<string, boolean>>> = {}

      MODULES_WITH_SUBMODULES.forEach(module => {
        newPermissions[module.id] = {}
        module.submodules.forEach(submodule => {
          newPermissions[module.id][submodule.id] = {}
          ACTIONS.forEach(action => {
            // Check for exact match (module + submodule + action) or module-level permission (module + action, no submodule)
            const normalizeId = (id: string) => (id || "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
            const hasPermission = rolePermissions.some((p: any) => {
              const moduleMatch = normalizeId(p.module) === normalizeId(module.id)
              const submoduleMatch = !p.submodule || normalizeId(p.submodule) === normalizeId(submodule.id)
              const actionMatch = p.action === action.toLowerCase().replace(/ /g, '_')
              return moduleMatch && submoduleMatch && actionMatch && p.allowed
            })
            newPermissions[module.id][submodule.id][action.toLowerCase()] = hasPermission
          })
        })
      })

      setPermissions(newPermissions)
    }
  }, [rolePermissions])

  // Update permission mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async (data: { role: string; permissions: any[] }) => {
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update permissions')
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Permissions updated successfully" })
      queryClient.invalidateQueries({ queryKey: ['permission-matrix'] })
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setShowConfirmDialog(false)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handlePermissionChange = (module: string, submodule: string, action: string, checked: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [submodule]: {
          ...prev[module]?.[submodule],
          [action.toLowerCase()]: checked
        }
      }
    }))
  }

  const handleSubmoduleToggle = (module: string, submodule: string, checked: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [submodule]: Object.fromEntries(
          ACTIONS.map(action => [action.toLowerCase(), checked])
        )
      }
    }))
  }

  const handleModuleToggle = (module: string, checked: boolean) => {
    const moduleData = MODULES_WITH_SUBMODULES.find(m => m.id === module)
    if (moduleData) {
      setPermissions(prev => ({
        ...prev,
        [module]: Object.fromEntries(
          moduleData.submodules.map(submodule => [
            submodule.id,
            Object.fromEntries(
              ACTIONS.map(action => [action.toLowerCase(), checked])
            )
          ])
        )
      }))
    }
  }

  const handleSavePermissions = () => {
    if (!selectedRole) return

    // Normalize module and submodule IDs before saving
    const normalizeId = (id: string) => (id || "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")

    const permissionData = Object.entries(permissions).flatMap(([module, submodules]) =>
      Object.entries(submodules).flatMap(([submodule, actions]) =>
        Object.entries(actions).map(([action, allowed]) => ({
          module: normalizeId(module),
          submodule: submodule ? normalizeId(submodule) : null,
          action: action.toLowerCase().replace(/ /g, '_'),
          allowed
        }))
      )
    )

    updatePermissionsMutation.mutate({
      role: selectedRole,
      permissions: permissionData
    })
  }

  const getModulePermissionCount = (module: string) => {
    const moduleData = MODULES_WITH_SUBMODULES.find(m => m.id === module)
    if (!moduleData) return { total: 0, granted: 0 }

    const total = moduleData.submodules.length * ACTIONS.length
    const granted = Object.values(permissions[module] || {}).reduce((acc, submodule) => {
      return acc + Object.values(submodule).filter(Boolean).length
    }, 0)

    return { total, granted }
  }

  const getSubmodulePermissionCount = (module: string, submodule: string) => {
    const granted = Object.values(permissions[module]?.[submodule] || {}).filter(Boolean).length
    return { total: ACTIONS.length, granted }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permission Matrix</h1>
          <p className="text-gray-600">Manage role-based permissions across all modules and submodules</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push("/users/roles")}
            className="flex items-center gap-2 bg-[#0891B2] hover:bg-[#9B1219] text-white"
          >
            <Plus className="h-4 w-4" />
            Add Role
          </Button>
          <PermissionButton
            module="users"
            action="manage_permissions"
            onClick={() => window.location.reload()}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </PermissionButton>
        </div>
      </div>

      {/* Role Selection */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Role Selection</CardTitle>
          <CardDescription className="mt-2">Select a role to manage its permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">Select Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a role to manage" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role: string) => (
                    <SelectItem key={role} value={role}>
                      {role.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRole && (
              <div className="flex items-center gap-4">
                <PermissionButton
                  module="users"
                  action="manage_permissions"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={updatePermissionsMutation.isPending}
                  className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updatePermissionsMutation.isPending ? "Saving..." : "Save Changes"}
                </PermissionButton>
                <PermissionGate
                  module="users"
                  action="manage_permissions"
                  fallback={
                    <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-md flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      You don't have permission to modify permissions
                    </div>
                  }
                >
                  <div></div>
                </PermissionGate>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permission Matrix */}
      {selectedRole && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Permission Matrix for {selectedRole.replace('_', ' ')}</CardTitle>
            <CardDescription className="mt-2">Configure permissions for each module and submodule</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading permissions...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-64 text-xs font-medium text-gray-600">MODULE / SUBMODULE</TableHead>
                      {ACTIONS.map(action => (
                        <TableHead key={action} className="text-center min-w-20 text-xs font-medium text-gray-600">
                          {action.toUpperCase()}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULES_WITH_SUBMODULES.map(module => (
                      <>
                        {/* Module Header Row */}
                        <TableRow key={module.id} className="bg-gray-50">
                          <TableCell className="font-semibold text-gray-800">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={getModulePermissionCount(module.id).granted === getModulePermissionCount(module.id).total}
                                onCheckedChange={(checked) => handleModuleToggle(module.id, checked as boolean)}
                              />
                              <span>{module.name}</span>
                              <span className="text-xs text-gray-500">
                                ({getModulePermissionCount(module.id).granted}/{getModulePermissionCount(module.id).total})
                              </span>
                            </div>
                          </TableCell>
                          {ACTIONS.map(action => (
                            <TableCell key={`${module.id}-${action}`} className="text-center">
                              <Checkbox
                                checked={getModulePermissionCount(module.id).granted === getModulePermissionCount(module.id).total}
                                onCheckedChange={(checked) => handleModuleToggle(module.id, checked as boolean)}
                              />
                            </TableCell>
                          ))}
                        </TableRow>

                        {/* Submodule Rows */}
                        {module.submodules.map(submodule => (
                          <TableRow key={`${module.id}-${submodule.id}`} className="border-l-4 border-l-blue-200">
                            <TableCell className="pl-8 text-gray-700">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={getSubmodulePermissionCount(module.id, submodule.id).granted === getSubmodulePermissionCount(module.id, submodule.id).total}
                                  onCheckedChange={(checked) => handleSubmoduleToggle(module.id, submodule.id, checked as boolean)}
                                />
                                <span>{submodule.name}</span>
                                <span className="text-xs text-gray-500">
                                  ({getSubmodulePermissionCount(module.id, submodule.id).granted}/{getSubmodulePermissionCount(module.id, submodule.id).total})
                                </span>
                              </div>
                            </TableCell>
                            {ACTIONS.map(action => (
                              <TableCell key={`${module.id}-${submodule.id}-${action}`} className="text-center">
                                <Checkbox
                                  checked={permissions[module.id]?.[submodule.id]?.[action.toLowerCase()] || false}
                                  onCheckedChange={(checked) => handlePermissionChange(module.id, submodule.id, action, checked as boolean)}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Save Button at Bottom */}
            {selectedRole && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Make your changes above, then click Save Changes to apply them.
                  </div>
                  <div className="flex items-center gap-4">
                    <PermissionButton
                      module="users"
                      action="manage_permissions"
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={updatePermissionsMutation.isPending}
                      className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updatePermissionsMutation.isPending ? "Saving..." : "Save Changes"}
                    </PermissionButton>
                    <PermissionGate
                      module="users"
                      action="manage_permissions"
                      fallback={
                        <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-md flex items-center">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          No permission to modify
                        </div>
                      }
                    >
                      <div></div>
                    </PermissionGate>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Confirm Permission Changes
              </CardTitle>
              <CardDescription>
                Are you sure you want to update permissions for <strong>{selectedRole.replace('_', ' ')}</strong>?
                This will affect all users with this role.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePermissions}
                  disabled={updatePermissionsMutation.isPending}
                  className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
                >
                  {updatePermissionsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
