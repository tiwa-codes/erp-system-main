"use client"

import { cn } from "@/lib/utils"

interface StatusIndicatorProps {
  status?: string | null
  className?: string
}

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const getStatusColor = (status: string) => {
    if (!status) return 'text-gray-600'
    switch (status.toLowerCase()) {
      case 'active':
      case 'completed':
    case 'complete':
      case 'approved':
      case 'admitted':
        return 'text-green-600'
      case 'inactive':
      case 'rejected':
      case 'expired':
      case 'discharged':
      case 'deleted':
        return 'text-red-600'
      case 'paid':
        return 'text-green-600'
      case 'pending':
      case 'processing':
      case 'under_review':
      case 'submitted':
      case 'pending_approval':
      case 'in_progress':
      case 'pending_operations':
      case 'pending_md':
      case 'pending_finance':
        return 'text-yellow-600'
      case 'used':
      case 'verified':
        return 'text-blue-600'
      case 'suspended':
        return 'text-orange-600'
    case 'draft':
      return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  if (!status) {
    return (
      <span className={cn("text-xs font-medium text-gray-600", className)}>
        N/A
      </span>
    )
  }

  const formatStatus = (s: string) => {
    if (s.toLowerCase() === 'paid') return 'Paid'
    return s
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  return (
    <span className={cn("text-xs font-medium", getStatusColor(status), className)}>
      {formatStatus(status)}
    </span>
  )
}

// Utility function for backward compatibility
export const renderStatus = (status?: string | null, className?: string) => {
  return <StatusIndicator status={status} className={className} />
}
