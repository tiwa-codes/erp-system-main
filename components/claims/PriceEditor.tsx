"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Edit, Save, X, History, ChevronDown, ChevronUp } from "lucide-react"

interface PriceEditorProps {
  claimId: string
  currentAmount: number
  originalAmount: number
  onSave: (newAmount: number, reason: string) => void
  canEdit: boolean
  stage: 'vetter1' | 'vetter2' | 'audit' | 'approval'
}

export function PriceEditor({
  claimId,
  currentAmount,
  originalAmount,
  onSave,
  canEdit,
  stage
}: PriceEditorProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [newAmount, setNewAmount] = useState(currentAmount.toString())
  const [reason, setReason] = useState("")
  const [showHistory, setShowHistory] = useState(false)

  const { data: historyData } = useQuery({
    queryKey: ['price-history', claimId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/price-history`)
      if (!res.ok) throw new Error('Failed to fetch price history')
      return res.json()
    },
    enabled: !!claimId,
  })

  const editMutation = useMutation({
    mutationFn: async (data: { newAmount: number; reason: string }) => {
      const res = await fetch(`/api/claims/${claimId}/edit-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newAmount: data.newAmount,
          reason: data.reason,
          stage: stage
        })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to edit price')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success('Price updated successfully')
      onSave(parseFloat(newAmount), reason)
      setIsEditing(false)
      setReason("")
      // Invalidate history
      queryClient.invalidateQueries({ queryKey: ['price-history', claimId] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update price')
    }
  })

  const handleSave = () => {
    const amount = parseFloat(newAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for the price change')
      return
    }
    editMutation.mutate({ newAmount: amount, reason: reason.trim() })
  }

  const handleCancel = () => {
    setIsEditing(false)
    setNewAmount(currentAmount.toString())
    setReason("")
  }

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Price Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Original Amount:</span>
              <span className="text-sm font-medium">₦{originalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Current Amount:</span>
              <span className="text-sm font-medium">₦{currentAmount.toLocaleString()}</span>
            </div>
            {historyData?.edits?.length > 0 && (
              <PriceHistoryPanel edits={historyData.edits} showHistory={showHistory} setShowHistory={setShowHistory} />
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Price Editor</CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Price
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isEditing ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Original Amount:</span>
              <span className="text-sm font-medium">₦{originalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Current Amount:</span>
              <span className="text-sm font-bold text-blue-700">₦{currentAmount.toLocaleString()}</span>
            </div>
            {currentAmount !== originalAmount && originalAmount > 0 && (
              <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 text-xs">
                ⚠ Price has been modified
              </Badge>
            )}
            {historyData?.edits?.length > 0 && (
              <PriceHistoryPanel edits={historyData.edits} showHistory={showHistory} setShowHistory={setShowHistory} />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Amount (₦)</Label>
              <Input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="Enter new amount"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason for Change *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you're changing the price..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={editMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={editMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface PriceHistoryPanelProps {
  edits: Array<{
    id: string
    old_amount: number
    new_amount: number
    reason: string
    stage: string
    created_at: string
    edited_by: { first_name?: string; last_name?: string; email: string }
  }>
  showHistory: boolean
  setShowHistory: (v: boolean) => void
}

function PriceHistoryPanel({ edits, showHistory, setShowHistory }: PriceHistoryPanelProps) {
  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setShowHistory(!showHistory)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        <History className="h-3 w-3" />
        Price Edit History ({edits.length})
        {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {showHistory && (
        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
          {edits.map((edit) => {
            const editorName = [edit.edited_by?.first_name, edit.edited_by?.last_name].filter(Boolean).join(' ') || edit.edited_by?.email
            const date = new Date(edit.created_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })
            return (
              <div key={edit.id} className="bg-orange-50 border border-orange-100 rounded p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-orange-700">{editorName}</span>
                  <span className="text-gray-400">{date}</span>
                </div>
                <div className="mt-0.5 text-gray-700">
                  <span className="line-through text-gray-400">₦{Number(edit.old_amount).toLocaleString()}</span>
                  {' → '}
                  <span className="font-bold text-blue-700">₦{Number(edit.new_amount).toLocaleString()}</span>
                  <span className="ml-1 text-gray-500 capitalize text-[10px]">({edit.stage})</span>
                </div>
                {edit.reason && <div className="mt-0.5 italic text-gray-500">{edit.reason}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}





