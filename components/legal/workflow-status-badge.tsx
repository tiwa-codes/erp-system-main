"use client"

import { Badge } from "@/components/ui/badge"
import { LegalDocumentStatus } from "@prisma/client"
import { cn } from "@/lib/utils"

interface WorkflowStatusBadgeProps {
  status: LegalDocumentStatus
  className?: string
}

export function WorkflowStatusBadge({ status, className }: WorkflowStatusBadgeProps) {
  const getStatusVariant = (status: LegalDocumentStatus) => {
    switch (status) {
      case "DRAFT":
        return "secondary"
      case "VETTED":
        return "default"
      case "APPROVED":
        return "default"
      default:
        return "secondary"
    }
  }

  const getStatusColor = (status: LegalDocumentStatus) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800 border-gray-300"
      case "VETTED":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "APPROVED":
        return "bg-green-100 text-green-800 border-green-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  return (
    <Badge
      variant={getStatusVariant(status)}
      className={cn(getStatusColor(status), className)}
    >
      {status}
    </Badge>
  )
}

