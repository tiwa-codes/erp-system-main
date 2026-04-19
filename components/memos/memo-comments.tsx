'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface MemoCommentsProps {
    memoId: string
}

export function MemoComments({ memoId }: MemoCommentsProps) {
    const [newComment, setNewComment] = useState('')
    const queryClient = useQueryClient()

    const { data: commentsData, isLoading } = useQuery({
        queryKey: ['memo-comments', memoId],
        queryFn: async () => {
            const res = await fetch(`/api/memos/${memoId}/comments`)
            if (!res.ok) throw new Error('Failed to fetch comments')
            return res.json()
        }
    })

    const addCommentMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/memos/${memoId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: newComment })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to add comment')
            }

            return res.json()
        },
        onSuccess: () => {
            toast.success('Comment added successfully')
            queryClient.invalidateQueries({ queryKey: ['memo-comments', memoId] })
            setNewComment('')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const comments = commentsData?.comments || []

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Comments ({comments.length})
                </CardTitle>
                <CardDescription>
                    Discuss this memo with other stakeholders
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Add Comment Form */}
                <div className="space-y-2">
                    <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        rows={3}
                        disabled={addCommentMutation.isPending}
                    />
                    <Button
                        onClick={() => addCommentMutation.mutate()}
                        disabled={addCommentMutation.isPending || !newComment.trim()}
                        size="sm"
                    >
                        {addCommentMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Send className="h-4 w-4 mr-2" />
                        )}
                        Post Comment
                    </Button>
                </div>

                {/* Comments List */}
                <div className="space-y-3 mt-6">
                    {isLoading ? (
                        <div className="text-center py-4 text-gray-500">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            Loading comments...
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>No comments yet. Be the first to comment!</p>
                        </div>
                    ) : (
                        comments.map((comment: any) => (
                            <div
                                key={comment.id}
                                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-medium text-sm">
                                            {comment.user.first_name} {comment.user.last_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {comment.comment}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
