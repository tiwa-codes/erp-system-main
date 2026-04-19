"use client"

import { ReactNode } from "react"
import { usePermissions } from "@/lib/hooks/usePermissions"

interface PermissionGateProps {
  module?: string
  action?: string
  permission?: string
  children: ReactNode
  fallback?: ReactNode
  requireAll?: boolean
  actions?: string[]
}

function parsePermissionString(permission?: string) {
  if (!permission) return { module: undefined, action: undefined }

  const separator = permission.includes(":") ? ":" : "."
  const [module, action] = permission.split(separator)

  return {
    module: module?.trim(),
    action: action?.trim(),
  }
}

export function PermissionGate({ 
  module, 
  action, 
  permission,
  children, 
  fallback = null,
  requireAll = false,
  actions
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions()
  const parsedPermission = parsePermissionString(permission)
  const resolvedModule = module || parsedPermission.module
  const resolvedAction = action || parsedPermission.action

  // Show loading state while permissions are being fetched
  if (isLoading) {
    return <>{children}</>
  }

  let hasAccess = false

  if (actions && actions.length > 0 && resolvedModule) {
    // Check multiple actions
    hasAccess = requireAll 
      ? hasAllPermissions(resolvedModule, actions)
      : hasAnyPermission(resolvedModule, actions)
  } else if (resolvedModule && resolvedAction) {
    // Check single action
    hasAccess = hasPermission(resolvedModule, resolvedAction)
  }

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface PermissionButtonProps {
  module: string
  action: string
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  fallback?: ReactNode
}

export function PermissionButton({
  module,
  action,
  children,
  onClick,
  disabled = false,
  variant = "default",
  size = "default",
  className,
  fallback = null,
  ...props
}: PermissionButtonProps) {
  return (
    <PermissionGate module={module} action={action} fallback={fallback}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={className}
        {...props}
      >
        {children}
      </button>
    </PermissionGate>
  )
}
