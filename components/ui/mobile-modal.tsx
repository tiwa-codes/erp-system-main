"use client"

import { ReactNode } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children: ReactNode
  className?: string
  showCloseButton?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export function MobileModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showCloseButton = true,
  size = 'md'
}: MobileModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "w-full max-h-[90vh] overflow-y-auto",
          sizeClasses[size],
          "sm:max-w-md",
          className
        )}
      >
        {(title || description || showCloseButton) && (
          <DialogHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {title && (
                  <DialogTitle className="text-lg sm:text-xl pr-2">
                    {title}
                  </DialogTitle>
                )}
                {description && (
                  <DialogDescription className="text-sm text-gray-600 mt-1">
                    {description}
                  </DialogDescription>
                )}
              </div>
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="flex-shrink-0 touch-target"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogHeader>
        )}
        
        <div className="space-y-4 sm:space-y-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Mobile-optimized action sheet (bottom sheet for mobile)
interface MobileActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  className?: string
}

export function MobileActionSheet({
  open,
  onOpenChange,
  title,
  children,
  className
}: MobileActionSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "fixed bottom-0 left-0 right-0 top-auto max-h-[60vh] rounded-t-lg",
          "sm:max-w-md sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
          className
        )}
      >
        {title && (
          <DialogHeader className="pb-2">
            <DialogTitle className="text-center text-lg">{title}</DialogTitle>
          </DialogHeader>
        )}
        
        <div className="space-y-2">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Mobile-optimized confirmation dialog
interface MobileConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: 'default' | 'destructive'
  isLoading?: boolean
}

export function MobileConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = 'default',
  isLoading = false
}: MobileConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <MobileModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
    >
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isLoading}
          className="w-full sm:w-auto touch-target"
        >
          {cancelText}
        </Button>
        <Button
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onClick={handleConfirm}
          disabled={isLoading}
          className="w-full sm:w-auto touch-target"
        >
          {isLoading ? "Processing..." : confirmText}
        </Button>
      </div>
    </MobileModal>
  )
}
