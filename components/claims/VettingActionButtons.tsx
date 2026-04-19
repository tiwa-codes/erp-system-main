"use client"

import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Check, X, AlertTriangle, ClipboardList } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AuditTrailView } from "./AuditTrailView"

interface VettingActionButtonsProps {
  claimId: string
  stage: 'vetter1' | 'vetter2' | 'audit' | 'approval'
  canTakeAction: boolean
  onApprove: () => void
  onReject: () => void
  isLoading?: boolean
  approveLabel?: string
  rejectLabel?: string
  currentClaimStage?: string // The actual current stage of the claim
  approvalCode?: string // Optional approval code for audit trail
}

export function VettingActionButtons({
  claimId,
  stage,
  canTakeAction,
  onApprove,
  onReject,
  isLoading = false,
  approveLabel,
  rejectLabel,
  currentClaimStage,
  approvalCode
}: VettingActionButtonsProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)

  // Set default labels based on stage
  const getDefaultLabels = () => {
    switch (stage) {
      case 'vetter1':
        return { approve: 'Approve', reject: 'Reject' }
      case 'vetter2':
        return { approve: 'Forward to Internal Control', reject: 'Reject to Vetter' }
      case 'audit':
        return { approve: 'Forward to MD', reject: 'Reject to Audit' }
      case 'approval':
        return { approve: 'Pay Out', reject: 'Reject to Vetter' }
      default:
        return { approve: 'Approve', reject: 'Reject' }
    }
  }

  const defaultLabels = getDefaultLabels()
  const finalApproveLabel = approveLabel || defaultLabels.approve
  const finalRejectLabel = rejectLabel || defaultLabels.reject

  if (!canTakeAction) {
    // If we know the claim's current stage and it's different from this page's stage
    if (currentClaimStage && currentClaimStage !== stage) {
      const getCorrectUrl = () => {
        switch (currentClaimStage) {
          case 'vetter1':
            return `/claims/vetter1/vetter/${claimId}`
          case 'vetter2':
            return `/claims/vetter2/vetter/${claimId}`
          case 'audit':
            return `/operation-desk/audit/process/${claimId}`
          case 'approval':
            return `/executive-desk/approval/process/${claimId}`
          default:
            return null
        }
      }

      const correctUrl = getCorrectUrl()

      return (
        <div className="flex flex-col md:flex-row items-center gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-4 flex-1">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                This claim is currently at <strong>{currentClaimStage}</strong> stage, not {stage} stage.
              </p>
              {correctUrl && (
                <Link href={correctUrl} className="text-sm text-blue-600 hover:underline mt-1 inline-block">
                  Click here to go to the correct page →
                </Link>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAuditModal(true)}
            className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Audit Log
          </Button>

          <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Claim Audit Trail: {approvalCode || claimId}</DialogTitle>
              </DialogHeader>
              <AuditTrailView approvalCode={approvalCode || claimId} />
            </DialogContent>
          </Dialog>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500">
          <span>Action already taken on this claim at {stage} stage</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAuditModal(true)}
          className="ml-auto"
        >
          <ClipboardList className="h-4 w-4 mr-2" />
          Audit Log
        </Button>

        <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Claim Audit Trail: {approvalCode || claimId}</DialogTitle>
            </DialogHeader>
            <AuditTrailView approvalCode={approvalCode || claimId} />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={() => setShowAuditModal(true)}
        variant="outline"
        className="bg-white hover:bg-gray-100 text-gray-900 border-gray-300 font-bold"
      >
        <ClipboardList className="h-4 w-4 mr-2" />
        Audit Log
      </Button>

      <Button
        onClick={onApprove}
        disabled={isLoading}
        className="bg-green-600 hover:bg-green-700 text-white font-bold"
      >
        <Check className="h-4 w-4 mr-2" />
        {finalApproveLabel}
      </Button>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 font-bold"
          >
            <X className="h-4 w-4 mr-2" />
            {finalRejectLabel}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Rejection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this claim? This action will send the claim back to the previous stage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onReject()
                setShowRejectDialog(false)
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Claim Audit Trail: {approvalCode || claimId}</DialogTitle>
          </DialogHeader>
          <AuditTrailView approvalCode={approvalCode || claimId} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

