"use client"

import { ReactNode } from "react"
import { Button, ButtonProps } from "@/components/ui/button"
import { PermissionGate } from "@/components/ui/permission-gate"

interface PermissionButtonProps extends Omit<ButtonProps, 'onClick'> {
  module: string
  action: string
  children: ReactNode
  onClick?: () => void
  fallback?: ReactNode
  requireAll?: boolean
  actions?: string[]
}

export function PermissionButton({
  module,
  action,
  children,
  onClick,
  fallback = null,
  requireAll = false,
  actions,
  ...buttonProps
}: PermissionButtonProps) {
  return (
    <PermissionGate 
      module={module} 
      action={action} 
      fallback={fallback}
      requireAll={requireAll}
      actions={actions}
    >
      <Button onClick={onClick} {...buttonProps}>
        {children}
      </Button>
    </PermissionGate>
  )
}
