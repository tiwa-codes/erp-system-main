"use client"

import { Badge } from "@/components/ui/badge"
import { SalesReportStatus } from "@prisma/client"
import { cn } from "@/lib/utils"

interface ReportStatusBadgeProps {
  status: SalesReportStatus
  className?: string
}

export function ReportStatusBadge({ status, className }: ReportStatusBadgeProps) {
  const getStatusColor = (status: SalesReportStatus) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800 border-gray-300"
      case "SUBMITTED":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "VETTED":
        return "bg-purple-100 text-purple-800 border-purple-300"
      case "APPROVED":
        return "bg-green-100 text-green-800 border-green-300"
      case "FINAL_COPY_UPLOADED":
        return "bg-emerald-100 text-emerald-800 border-emerald-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  return (
    <Badge variant="outline" className={cn(getStatusColor(status), className)}>
      {status.replace(/_/g, " ")}
    </Badge>
  )
}

