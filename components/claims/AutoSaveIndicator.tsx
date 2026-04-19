"use client"

import { Check, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface AutoSaveIndicatorProps {
  isSaving: boolean
  lastSaved?: Date
  hasUnsavedChanges: boolean
  className?: string
}

export function AutoSaveIndicator({
  isSaving,
  lastSaved,
  hasUnsavedChanges,
  className
}: AutoSaveIndicatorProps) {
  if (isSaving) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-gray-500", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Saving...</span>
      </div>
    )
  }

  if (hasUnsavedChanges) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-amber-600", className)}>
        <AlertCircle className="h-4 w-4" />
        <span>Unsaved changes</span>
      </div>
    )
  }

  if (lastSaved) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-green-600", className)}>
        <Check className="h-4 w-4" />
        <span>
          Draft saved at {lastSaved.toLocaleTimeString()}
        </span>
      </div>
    )
  }

  return null
}









