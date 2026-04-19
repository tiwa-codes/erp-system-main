"use client"

import { Button } from "@/components/ui/button"
import { FileCheck, CheckCircle, Upload, Send } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { SalesReportStatus } from "@prisma/client"

interface WorkflowActionsProps {
  status: SalesReportStatus
  onSubmit: () => void
  onVet: () => void
  onApprove: () => void
  onUploadFinal: () => void
  isSubmitting?: boolean
  isVetting?: boolean
  isApproving?: boolean
  isUploading?: boolean
}

export function WorkflowActions({
  status,
  onSubmit,
  onVet,
  onApprove,
  onUploadFinal,
  isSubmitting = false,
  isVetting = false,
  isApproving = false,
  isUploading = false,
}: WorkflowActionsProps) {
  return (
    <div className="flex flex-col gap-2">
      {status === "DRAFT" && (
        <PermissionGate permission="sales:submit">
          <Button onClick={onSubmit} disabled={isSubmitting} className="w-full">
            <Send className="h-4 w-4 mr-1" />
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </PermissionGate>
      )}

      {status === "SUBMITTED" && (
        <PermissionGate permission="sales:vet">
          <Button onClick={onVet} disabled={isVetting} className="w-full">
            <FileCheck className="h-4 w-4 mr-1" />
            {isVetting ? "Vetting..." : "Vet Report"}
          </Button>
        </PermissionGate>
      )}

      {status === "VETTED" && (
        <PermissionGate permission="sales:approve">
          <Button onClick={onApprove} disabled={isApproving} className="w-full">
            <CheckCircle className="h-4 w-4 mr-1" />
            {isApproving ? "Approving..." : "Approve Report"}
          </Button>
        </PermissionGate>
      )}

      {status === "APPROVED" && (
        <PermissionGate permission="sales:upload">
          <Button onClick={onUploadFinal} disabled={isUploading} className="w-full">
            <Upload className="h-4 w-4 mr-1" />
            {isUploading ? "Uploading..." : "Upload Final Copy"}
          </Button>
        </PermissionGate>
      )}
    </div>
  )
}

