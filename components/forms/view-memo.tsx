"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  CheckCircle,
  Archive,
  Clock,
  User,
  Calendar,
  FileText,
  ArrowLeft
} from "lucide-react"
import { MemoStatusBadge } from "@/components/memos/memo-status-badge"
import { MemoApprovalCard } from "@/components/memos/memo-approval-card"
import { MemoComments } from "@/components/memos/memo-comments"
import { useSession } from "next-auth/react"
import { FileViewerModal } from "@/components/ui/file-viewer-modal"

export function ViewMemo({ memo, onClose }: { memo: any, onClose: () => void }) {
  const { data: session } = useSession()
  const [fileViewer, setFileViewer] = useState<{ url: string; name: string } | null>(null)

  // Mark memo as read for current user when opened
  useEffect(() => {
    if (memo?.id) {
      fetch(`/api/memos/${memo.id}/read`, { method: 'PATCH' }).catch(() => {})
    }
  }, [memo?.id])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'destructive'
      case 'HIGH': return 'destructive'
      case 'NORMAL': return 'default'
      case 'LOW': return 'secondary'
      default: return 'default'
    }
  }

  // Check if current user can approve at Department Oversight level
  const canApproveDeptOversight = memo.status === 'PENDING_DEPT_OVERSIGHT' &&
    (session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'ADMIN')

  // Check if current user can give final (MD) approval
  const userRoleUpper = ((session?.user?.role as string) || '').toUpperCase().replace(/\s+/g, '_')
  const isMD = userRoleUpper.includes('MD') || userRoleUpper.includes('MANAGING_DIRECTOR') || userRoleUpper === 'SUPER_ADMIN'
  const canApproveExecutive = memo.status === 'PENDING_EXECUTIVE' && isMD

  // Get approver names
  const deptOversightApprover = memo.dept_oversight_approver
    ? `${memo.dept_oversight_approver.first_name} ${memo.dept_oversight_approver.last_name}`
    : null

  const executiveApprover = memo.executive_approver
    ? `${memo.executive_approver.first_name} ${memo.executive_approver.last_name}`
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-600" />
          <h2 className="text-xl font-semibold">Memo Details</h2>
        </div>
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Memo Information */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{memo.title}</CardTitle>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant={getPriorityColor(memo.priority)}>
                  {memo.priority}
                </Badge>
                <MemoStatusBadge
                  status={memo.status}
                  deptOversightApprover={deptOversightApprover}
                  executiveApprover={executiveApprover}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sender / Employee Information */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <User className="h-5 w-5 text-gray-600" />
            <div>
              {memo.employee ? (
                <>
                  <div className="font-medium">
                    {memo.employee.first_name} {memo.employee.last_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {memo.employee.employee_id} • {memo.employee.email}
                  </div>
                  {memo.employee.position && (
                    <div className="text-sm text-gray-500">
                      {memo.employee.position}
                      {memo.employee.department && (
                        <span> • {memo.employee.department.name}</span>
                      )}
                    </div>
                  )}
                </>
              ) : memo.sender_user ? (
                <>
                  <div className="font-medium">
                    {memo.sender_user.first_name} {memo.sender_user.last_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {memo.sender_user.email}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">System</div>
              )}
            </div>
          </div>

          {memo.origin_department && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium">Memo Origin Department</div>
                <div className="text-sm text-blue-700">{memo.origin_department.name}</div>
              </div>
            </div>
          )}

          <Separator />

          {/* Content */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Content</h3>
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {memo.content}
              </div>
            </div>
          </div>

          <Separator />

          {/* Attachment */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Attachment</h3>
            {memo.attachment?.url ? (
              <button
                onClick={() => setFileViewer({ url: memo.attachment.url, name: memo.attachment.name || 'Attachment' })}
                className="text-blue-600 hover:underline text-left"
              >
                {memo.attachment.name || "View Attachment"}
              </button>
            ) : (
              <p className="text-sm text-gray-500">No attachment</p>
            )}
          </div>

          {/* Rejection Reason (if rejected) */}
          {memo.status === 'REJECTED' && memo.rejection_reason && (
            <>
              <Separator />
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-900 mb-2">Rejection Reason</h3>
                <p className="text-red-700">{memo.rejection_reason}</p>
              </div>
            </>
          )}

          {/* Department Oversight Comments */}
          {memo.dept_oversight_comments && (
            <>
              <Separator />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">
                  Department Oversight Comments
                </h3>
                <p className="text-blue-700">{memo.dept_oversight_comments}</p>
              </div>
            </>
          )}

          {/* Executive Comments */}
          {memo.executive_comments && (
            <>
              <Separator />
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-2">
                  Executive Comments
                </h3>
                <p className="text-green-700">{memo.executive_comments}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div>
                <div className="font-medium">Created</div>
                <div className="text-gray-600">
                  {new Date(memo.created_at).toLocaleString()}
                </div>
              </div>
            </div>
            {memo.updated_at && memo.updated_at !== memo.created_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-medium">Last Updated</div>
                  <div className="text-gray-600">
                    {new Date(memo.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approval Interface - Show if user can approve */}
      {canApproveDeptOversight && (
        <MemoApprovalCard
          memo={memo}
          approvalLevel="dept_oversight"
          onSuccess={onClose}
        />
      )}

      {canApproveExecutive && (
        <MemoApprovalCard
          memo={memo}
          approvalLevel="executive"
          onSuccess={onClose}
        />
      )}

      {/* Comments Section */}
      <MemoComments memoId={memo.id} />

      {fileViewer && (
        <FileViewerModal
          url={fileViewer.url}
          name={fileViewer.name}
          isOpen={!!fileViewer}
          onClose={() => setFileViewer(null)}
        />
      )}
    </div>
  )
}
