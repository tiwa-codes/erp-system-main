"use client"

import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"

export interface Permission {
  module: string
  action: string
}

// Default permissions for ADMIN role to ensure buttons show
function getAdminDefaultPermissions(): Permission[] {
  return [
    { module: "dashboard", action: "view" },
    { module: "hr", action: "view" },
    { module: "hr", action: "add" },
    { module: "hr", action: "edit" },
    { module: "hr", action: "manage_employees" },
    { module: "hr", action: "manage_attendance" },
    { module: "hr", action: "manage_leave" },
    { module: "claims", action: "view" },
    { module: "claims", action: "add" },
    { module: "claims", action: "edit" },
    { module: "claims", action: "vet" },
    { module: "claims", action: "audit" },
    { module: "finance", action: "view" },
    { module: "finance", action: "add" },
    { module: "finance", action: "edit" },
    { module: "finance", action: "process_payouts" },
    { module: "provider", action: "view" },
    { module: "provider", action: "add" },
    { module: "provider", action: "edit" },
    { module: "provider", action: "approve" },
    { module: "provider", action: "manage_risk" },
    { module: "provider", action: "manage_tariff_plan" },
    { module: "providers", action: "view" },
    { module: "providers", action: "add" },
    { module: "providers", action: "edit" },
    { module: "providers", action: "approve" },
    { module: "underwriting", action: "view" },
    { module: "underwriting", action: "add" },
    { module: "underwriting", action: "edit" },
    { module: "underwriting", action: "manage_organizations" },
    { module: "underwriting", action: "manage_principals" },
    { module: "underwriting", action: "manage_dependents" },
    { module: "call-centre", action: "view" },
    { module: "call-centre", action: "add" },
    { module: "call-centre", action: "edit" },
    { module: "call-centre", action: "manage_requests" },
    { module: "call-centre", action: "verify_codes" },
    { module: "call-centre", action: "check_coverage" },
    { module: "reports", action: "view" },
    { module: "reports", action: "generate_all" },
    { module: "reports", action: "view_all" },
    { module: "statistics", action: "view" },
    { module: "statistics", action: "generate" },
    { module: "statistics", action: "export" },
    { module: "settings", action: "view" },
    { module: "settings", action: "add" },
    { module: "settings", action: "edit" },
    { module: "fraud-detection", action: "view" },
    { module: "fraud-detection", action: "add" },
    { module: "fraud-detection", action: "edit" },
    { module: "fraud-detection", action: "investigate" },
    { module: "fraud-detection", action: "approve" },
    { module: "fraud-detection", action: "reject" },
    { module: "users", action: "view" },
    { module: "users", action: "add" },
    { module: "users", action: "edit" },
    { module: "department-oversight", action: "view" },
    { module: "department-oversight", action: "add" },
    { module: "department-oversight", action: "edit" },
    { module: "department-oversight", action: "delete" },
    { module: "operation-desk", action: "view" },
    { module: "operation-desk", action: "add" },
    { module: "operation-desk", action: "edit" },
    { module: "operation-desk", action: "delete" },
    { module: "executive-desk", action: "view" },
    { module: "executive-desk", action: "add" },
    { module: "executive-desk", action: "edit" },
    { module: "executive-desk", action: "delete" },
    { module: "telemedicine", action: "view" },
    { module: "telemedicine", action: "add" },
    { module: "telemedicine", action: "edit" },
    { module: "telemedicine", action: "delete" },
    { module: "telemedicine", action: "manage_facilities" },
    { module: "telemedicine", action: "manage_appointments" },
    { module: "telemedicine", action: "view_claims" },
    { module: "telemedicine", action: "procurement" },
    { module: "hr", action: "procurement" },
    { module: "claims", action: "procurement" },
    { module: "finance", action: "procurement" },
    { module: "provider", action: "procurement" },
    { module: "underwriting", action: "procurement" },
    { module: "call-centre", action: "procurement" },
    { module: "legal", action: "procurement" },
  ]
}

// Get default permissions for any role
function getDefaultPermissionsForRole(role: string): Permission[] {
  switch (role) {
    case "ADMIN":
      return getAdminDefaultPermissions()

    case "HR_MANAGER":
      return [
        { module: "dashboard", action: "view" },
        { module: "hr", action: "view" },
        { module: "hr", action: "add" },
        { module: "hr", action: "edit" },
        { module: "hr", action: "delete" },
        { module: "hr", action: "manage_employees" },
        { module: "hr", action: "manage_attendance" },
        { module: "hr", action: "manage_leave" },
        { module: "hr", action: "manage_memos" },
        { module: "hr", action: "manage_rules" },
        { module: "hr", action: "manage_payroll" },
        { module: "hr", action: "procurement" },
        { module: "reports", action: "view" },
        { module: "reports", action: "generate_hr" },
        { module: "settings", action: "view" },
        { module: "users", action: "view" },
        { module: "telemedicine", action: "view" },
        { module: "telemedicine", action: "add" },
        { module: "telemedicine", action: "edit" },
        { module: "telemedicine", action: "view_claims" },
      ]

    case "HR_OFFICER":
      return [
        { module: "dashboard", action: "view" },
        { module: "hr", action: "view" },
        { module: "hr", action: "add" },
        { module: "hr", action: "edit" },
        { module: "hr", action: "manage_employees" },
        { module: "hr", action: "manage_attendance" },
        { module: "hr", action: "manage_leave" },
        { module: "hr", action: "manage_payroll" },
        { module: "hr", action: "procurement" },
        { module: "reports", action: "view" },
        { module: "reports", action: "generate_hr" },
        { module: "settings", action: "view" },
        { module: "telemedicine", action: "view" },
        { module: "telemedicine", action: "view_claims" },
      ]

    case "CLAIMS_MANAGER":
      return [
        { module: "dashboard", action: "view" },
        { module: "claims", action: "view" },
        { module: "claims", action: "add" },
        { module: "claims", action: "edit" },
        { module: "claims", action: "delete" },
        { module: "claims", action: "vet" },
        { module: "claims", action: "audit" },
        { module: "claims", action: "approve" },
        { module: "claims", action: "fraud_detection" },
        { module: "claims", action: "procurement" },
        { module: "call-centre", action: "view" },
        { module: "call-centre", action: "add" },
        { module: "call-centre", action: "edit" },
        { module: "call-centre", action: "manage_requests" },
        { module: "call-centre", action: "verify_codes" },
        { module: "call-centre", action: "check_coverage" },
        { module: "fraud-detection", action: "view" },
        { module: "fraud-detection", action: "add" },
        { module: "fraud-detection", action: "edit" },
        { module: "fraud-detection", action: "investigate" },
        { module: "fraud-detection", action: "approve" },
        { module: "fraud-detection", action: "reject" },
        { module: "reports", action: "view" },
        { module: "reports", action: "generate_claims" },
        { module: "settings", action: "view" },
        { module: "users", action: "view" },
        { module: "telemedicine", action: "view" },
        { module: "telemedicine", action: "add" },
        { module: "telemedicine", action: "edit" },
        { module: "telemedicine", action: "view_claims" },
      ]

    case "CLAIMS_PROCESSOR":
      return [
        { module: "dashboard", action: "view" },
        { module: "claims", action: "view" },
        { module: "claims", action: "add" },
        { module: "claims", action: "edit" },
        { module: "claims", action: "vet" },
        { module: "claims", action: "procurement" },
        { module: "call-centre", action: "view" },
        { module: "call-centre", action: "add" },
        { module: "call-centre", action: "edit" },
        { module: "call-centre", action: "verify_codes" },
        { module: "call-centre", action: "check_coverage" },
        { module: "fraud-detection", action: "view" },
        { module: "fraud-detection", action: "investigate" },
        { module: "reports", action: "view" },
        { module: "reports", action: "generate_claims" },
        { module: "settings", action: "view" },
        { module: "telemedicine", action: "view" },
        { module: "telemedicine", action: "add" },
        { module: "telemedicine", action: "edit" },
        { module: "telemedicine", action: "view_claims" },
      ]

    case "FINANCE_OFFICER":
      return [
        { module: "dashboard", action: "view" },
        { module: "finance", action: "view" },
        { module: "finance", action: "add" },
        { module: "finance", action: "edit" },
        { module: "finance", action: "manage_accounts" },
        { module: "finance", action: "process_payouts" },
        { module: "finance", action: "procurement" },
        { module: "claims", action: "view" },
        { module: "fraud-detection", action: "view" },
        { module: "reports", action: "view" },
        { module: "reports", action: "generate_finance" },
        { module: "settings", action: "view" },
        { module: "telemedicine", action: "view" },
        { module: "telemedicine", action: "add" },
        { module: "telemedicine", action: "edit" },
        { module: "telemedicine", action: "view_claims" },
      ]

    case "PROVIDER_MANAGER":
      return [
        { module: "dashboard", action: "view" },
        { module: "users", action: "view" },
        { module: "users", action: "add" },
        { module: "users", action: "edit" },
        { module: "provider", action: "view" },
        { module: "provider", action: "add" },
        { module: "provider", action: "edit" },
        { module: "provider", action: "delete" },
        { module: "provider", action: "approve" },
        { module: "provider", action: "manage_risk" },
        { module: "provider", action: "manage_inpatients" },
        { module: "provider", action: "manage_tariff_plan" },
        { module: "provider", action: "procurement" },
        { module: "providers", action: "view" },
        { module: "providers", action: "add" },
        { module: "providers", action: "edit" },
        { module: "providers", action: "delete" },
        { module: "providers", action: "approve" },
        { module: "claims", action: "view" },
        { module: "fraud-detection", action: "view" },
        { module: "fraud-detection", action: "investigate" },
        { module: "reports", action: "view" },
        { module: "reports", action: "generate_provider" },
        { module: "settings", action: "view" },
        { module: "telemedicine", action: "view" },
        { module: "telemedicine", action: "add" },
        { module: "telemedicine", action: "edit" },
        { module: "telemedicine", action: "delete" },
        { module: "telemedicine", action: "manage_facilities" },
        { module: "telemedicine", action: "manage_appointments" },
        { module: "telemedicine", action: "view_claims" },
      ]

    case "UNDERWRITER":
      return [
        { module: "dashboard", action: "view" },
        { module: "underwriting", action: "view" },
        { module: "underwriting", action: "add" },
        { module: "underwriting", action: "edit" },
        { module: "underwriting", action: "delete" },
        { module: "underwriting", action: "manage_organizations" },
        { module: "underwriting", action: "manage_principals" },
        { module: "underwriting", action: "manage_dependents" },
        { module: "underwriting", action: "manage_plans" },
        { module: "underwriting", action: "procurement" },
        { module: "fraud-detection", action: "view" },
        { module: "reports", action: "view" },
        { module: "reports", action: "generate_underwriting" },
        { module: "settings", action: "view" },
        { module: "settings", action: "add" },
        { module: "settings", action: "edit" },
        { module: "telemedicine", action: "view" },
        { module: "telemedicine", action: "view_claims" },
      ]

    case "PROVIDER":
      return [
        { module: "dashboard", action: "view" },
        { module: "providers", action: "view" },
        { module: "providers", action: "add" },
        { module: "provider", action: "manage_tariff_plan" }, // This is for tariff plan management (under providers module in sidebar)
        { module: "claims", action: "view" },
        { module: "claims", action: "add" },
      ]

    case "TELEMEDICINE":
      return [
        { module: "dashboard", action: "view" },
        { module: "telemedicine", action: "view" },
        { module: "telemedicine", action: "add" },
        { module: "telemedicine", action: "edit" },
        { module: "telemedicine", action: "delete" },
        { module: "telemedicine", action: "manage_facilities" },
        { module: "telemedicine", action: "manage_appointments" },
        { module: "telemedicine", action: "view_claims" },
        { module: "reports", action: "view" }, // Allow telemedicine users to view reports
      ]

    case "CALL_CENTRE":
    case "CALL CENTRE":
      return [
        { module: "dashboard", action: "view" },
        { module: "call-centre", action: "view" },
        { module: "call-centre", action: "add" },
        { module: "call-centre", action: "edit" },
        { module: "call-centre", action: "delete" },
        { module: "call-centre", action: "manage_requests" },
        { module: "call-centre", action: "verify_codes" },
        { module: "call-centre", action: "check_coverage" },
        { module: "call-centre", action: "approve" },
        { module: "call-centre", action: "procurement" },
        { module: "hr", action: "view" },
        { module: "hr", action: "procurement" },
        { module: "underwriting", action: "view" },
        { module: "underwriting", action: "manage_organizations" },
        { module: "underwriting", action: "manage_principals" },
        { module: "underwriting", action: "manage_dependents" },
        { module: "underwriting_coverage", action: "view" },
        { module: "underwriting_mobile", action: "view" },
        { module: "claims", action: "view" },
        { module: "providers", action: "view" },
        { module: "reports", action: "view" },
        { module: "settings", action: "view" },
        { module: "telemedicine", action: "view" },
      ]

    case "CRM":
      return [
        { module: "dashboard", action: "view" },
        { module: "underwriting", action: "view" },
        { module: "underwriting", action: "add" },
        { module: "underwriting", action: "edit" },
        { module: "underwriting", action: "manage_organizations" },
        { module: "underwriting", action: "manage_principals" },
        { module: "underwriting", action: "manage_dependents" },
        { module: "underwriting_coverage", action: "view" },
        { module: "underwriting_mobile", action: "view" },
        { module: "claims", action: "view" },
        { module: "reports", action: "view" },
        { module: "settings", action: "view" },
      ]

    case "HEAD_OF_OPERATIONS":
    case "HEAD OF OPERATIONS":
      return [
        { module: "dashboard", action: "view" },
        { module: "claims", action: "view" },
        { module: "claims", action: "add" },
        { module: "claims", action: "edit" },
        { module: "claims", action: "vet" },
        { module: "claims", action: "audit" },
        { module: "claims", action: "procurement" },
        { module: "operation-desk", action: "view" },
        { module: "operation-desk", action: "add" },
        { module: "operation-desk", action: "edit" },
        { module: "operation-desk", action: "delete" },
        { module: "underwriting", action: "view" },
        { module: "reports", action: "view" },
        { module: "reports", action: "generate_claims" },
        { module: "providers", action: "view" },
        { module: "provider", action: "view" },
        { module: "settings", action: "view" },
      ]

    case "SPECIAL_RISK":
    case "SPECIAL RISK":
    case "SPECIAL_RISK_MANAGER":
      return [
        { module: "dashboard", action: "view" },
        { module: "special-risk", action: "view" },
        { module: "special-risk", action: "add" },
        { module: "special-risk", action: "edit" },
        { module: "special-risk", action: "approve" },
        { module: "special-risk", action: "delete" },
        { module: "special-risk", action: "manage_memos" },
        { module: "reports", action: "view" },
        { module: "reports", action: "generate_underwriting" },
        { module: "settings", action: "view" },
        { module: "telemedicine", action: "view" },
        { module: "telemedicine", action: "view_claims" },
      ]

    default:
      return []
  }
}

export function usePermissions() {
  const { data: session } = useSession()

  const { data: permissions, isLoading, error } = useQuery<Permission[]>({
    queryKey: ['permissions', session?.user?.role],
    queryFn: async () => {
      console.log('Fetching permissions from API for role:', session?.user?.role)
      const res = await fetch('/api/permissions/me')
      if (!res.ok) throw new Error('Failed to fetch permissions')
      const data = await res.json()

      console.log('Permissions received from API:', data.length, 'permissions')
      console.log('Sample permissions:', data.slice(0, 10))

      // Debug logging for telemedicine users
      if (session?.user?.role?.includes('TELEMEDICINE')) {
      }

      return data
    },
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Refetch when window regains focus to catch permission matrix updates
    refetchOnWindowFocus: true,
    // Refetch every 30 seconds
    refetchInterval: 30000,
  })

  const hasPermission = (module: string, action: string): boolean => {
    console.log('Checking permission:', module, action, 'for role:', session?.user?.role)
    console.log('Available permissions:', permissions)

    // Super admin always has all permissions
    if (session?.user?.role === 'SUPER_ADMIN') return true

    // Check if user has ANY database permissions
    const hasAnyDbPermissions = permissions && permissions.length > 0

    if (hasAnyDbPermissions) {
      // If database permissions exist, use ONLY database (Permission Matrix has full control)
      // Match if module and action match (ignore submodule - permissions can be granted with or without submodules)
      // Map action names: permission matrix uses "create"/"edit" but frontend checks "add"/"edit"
      const matches = permissions.some((p: Permission) => {
        // Normalize module names for comparison
        const pModule = p.module?.toLowerCase().trim() || ''
        const checkModule = module?.toLowerCase().trim() || ''
        const moduleMatches = pModule === checkModule || pModule.includes(checkModule) || checkModule.includes(pModule)

        // Normalize and map actions
        const pAction = (p.action || '').toLowerCase().trim()
        const checkAction = (action || '').toLowerCase().trim()

        // Action matching with aliases
        const actionMatches =
          pAction === checkAction ||
          // Map "add" <-> "create"
          (checkAction === 'add' && pAction === 'create') ||
          (checkAction === 'create' && pAction === 'add') ||
          // Map "update" <-> "edit"  
          (checkAction === 'edit' && (pAction === 'update' || pAction === 'edit')) ||
          (checkAction === 'update' && (pAction === 'edit' || pAction === 'update')) ||
          // Check if action contains the other (for compound actions like "view claims")
          pAction.includes(checkAction) ||
          checkAction.includes(pAction)

        return moduleMatches && actionMatches
      })


      return matches
    }

    // If no database permissions, fall back to role defaults
    if (session?.user?.role) {
      const roleDefaults = getDefaultPermissionsForRole(session.user.role)
      return roleDefaults.some((p: Permission) => {
        const moduleMatches = p.module === module || p.module?.toLowerCase() === module?.toLowerCase()
        const actionMatches =
          p.action === action ||
          p.action?.toLowerCase() === action?.toLowerCase() ||
          (action === 'add' && (p.action === 'create' || p.action === 'add')) ||
          (action === 'create' && (p.action === 'add' || p.action === 'create'))
        return moduleMatches && actionMatches
      })
    }

    return false
  }

  const hasAnyPermission = (module: string, actions: string[]): boolean => {
    if (session?.user?.role === 'SUPER_ADMIN') return true

    // Check if user has ANY database permissions
    const hasAnyDbPermissions = permissions && permissions.length > 0

    if (hasAnyDbPermissions) {
      // If database permissions exist, use ONLY database (Permission Matrix has full control)
      return actions.some(action => {
        return permissions.some((p: Permission) => {
          const moduleMatches = p.module === module || p.module?.toLowerCase() === module?.toLowerCase()
          const actionMatches =
            p.action === action ||
            p.action?.toLowerCase() === action?.toLowerCase() ||
            (action === 'add' && (p.action === 'create' || p.action === 'add')) ||
            (action === 'create' && (p.action === 'add' || p.action === 'create')) ||
            (action === 'edit' && (p.action === 'update' || p.action === 'edit')) ||
            (action === 'update' && (p.action === 'edit' || p.action === 'update'))
          return moduleMatches && actionMatches
        })
      })
    }

    // If no database permissions, fall back to role defaults
    if (session?.user?.role) {
      const roleDefaults = getDefaultPermissionsForRole(session.user.role)
      return actions.some(action => {
        return roleDefaults.some((p: Permission) => {
          const moduleMatches = p.module === module || p.module?.toLowerCase() === module?.toLowerCase()
          const actionMatches =
            p.action === action ||
            p.action?.toLowerCase() === action?.toLowerCase() ||
            (action === 'add' && (p.action === 'create' || p.action === 'add')) ||
            (action === 'create' && (p.action === 'add' || p.action === 'create'))
          return moduleMatches && actionMatches
        })
      })
    }

    return false
  }

  const hasAllPermissions = (module: string, actions: string[]): boolean => {
    if (session?.user?.role === 'SUPER_ADMIN') return true

    // Check if user has ANY database permissions
    const hasAnyDbPermissions = permissions && permissions.length > 0

    if (hasAnyDbPermissions) {
      // If database permissions exist, use ONLY database (Permission Matrix has full control)
      return actions.every(action => permissions.some((p: Permission) => p.module === module && p.action === action))
    }

    // If no database permissions, fall back to role defaults
    if (session?.user?.role) {
      const roleDefaults = getDefaultPermissionsForRole(session.user.role)
      return actions.every(action => roleDefaults.some((p: Permission) => p.module === module && p.action === action))
    }

    return false
  }

  const getModulePermissions = (module: string): string[] => {
    if (session?.user?.role === 'SUPER_ADMIN') {
      // Return all possible actions for super admin
      return ['view', 'add', 'edit', 'delete', 'manage_employees', 'manage_attendance', 'manage_leave', 'manage_memos', 'manage_rules', 'manage_payroll']
    }

    return permissions
      ?.filter((p: Permission) => p.module === module)
      ?.map((p: Permission) => p.action) || []
  }

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getModulePermissions,
    isSuperAdmin: session?.user?.role === 'SUPER_ADMIN'
  }
}
