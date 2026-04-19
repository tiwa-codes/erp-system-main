'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface MemoApprovalCardProps {
    memo: any
    approvalLevel: 'dept_oversight' | 'executive'
    onSuccess?: () => void
}

export function MemoApprovalCard({ memo, approvalLevel, onSuccess }: MemoApprovalCardProps) {
    const [comments, setComments] = useState('')
    const [rejectionReason, setRejectionReason] = useState('')
    const [showRejectForm, setShowRejectForm] = useState(false)
    const queryClient = useQueryClient()

    const approveMutation = useMutation({
        mutationFn: async () => {
            const endpoint = approvalLevel === 'dept_oversight'
                ? `/api/memos/${memo.id}/approve-dept-oversight`
                : `/api/memos/${memo.id}/approve-executive`

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comments })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to approve memo')
            }

            return res.json()
        },
        onSuccess: () => {
            toast.success(
                approvalLevel === 'dept_oversight'
                    ? 'Memo confirmed and forwarded to Executive Desk'
                    : 'Memo approved successfully'
            )
            queryClient.invalidateQueries({ queryKey: ['memos'] })
            onSuccess?.()
            setComments('')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const rejectMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/memos/${memo.id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: rejectionReason })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to reject memo')
            }

            return res.json()
        },
        onSuccess: () => {
            toast.success('Memo rejected and returned to initiator')
            queryClient.invalidateQueries({ queryKey: ['memos'] })
            onSuccess?.()
            setRejectionReason('')
            setShowRejectForm(false)
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const isLoading = approveMutation.isPending || rejectMutation.isPending

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">
                    {approvalLevel === 'dept_oversight'
                        ? 'Department Oversight Review'
                        : 'Executive Desk Approval'}
                </CardTitle>
                <CardDescription>
                    {approvalLevel === 'dept_oversight'
                        ? 'Review and confirm this memo to forward it to Executive Desk'
                        : 'Final approval required for this memo'}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {!showRejectForm ? (
                    <>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Comments (Optional)
                            </label>
                            <Textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                placeholder="Add any comments or notes..."
                                rows={3}
                                disabled={isLoading}
                            />
                        </div>
                    </>
                ) : (
                    <div>
                        <label className="text-sm font-medium mb-2 block text-red-600">
                            Rejection Reason *
                        </label>
                        <Textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Please provide a reason for rejection..."
                            rows={4}
                            disabled={isLoading}
                            className="border-red-300 focus:border-red-500"
                        />
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex gap-2">
                {!showRejectForm ? (
                    <>
                        <Button
                            onClick={() => approveMutation.mutate()}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            {approvalLevel === 'dept_oversight' ? 'Confirm to Executive' : 'Approve'}
                        </Button>
                        <Button
                            onClick={() => setShowRejectForm(true)}
                            disabled={isLoading}
                            variant="destructive"
                        >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            onClick={() => rejectMutation.mutate()}
                            disabled={isLoading || !rejectionReason.trim()}
                            variant="destructive"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <XCircle className="h-4 w-4 mr-2" />
                            )}
                            Confirm Rejection
                        </Button>
                        <Button
                            onClick={() => {
                                setShowRejectForm(false)
                                setRejectionReason('')
                            }}
                            disabled={isLoading}
                            variant="outline"
                        >
                            Cancel
                        </Button>
                    </>
                )}
            </CardFooter>
        </Card>
    )
}
