"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AccountSelector } from "./account-selector"
import { PostingType } from "@prisma/client"
import { Plus, Trash2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface JournalEntryLine {
  account_id: string
  posting_type: PostingType
  amount: number
  description?: string
}

interface JournalEntryFormProps {
  initialData?: {
    entry_date?: string
    description?: string
    supporting_document_url?: string
    lines?: JournalEntryLine[]
  }
  onSubmit: (data: {
    entry_date: Date
    description: string
    supporting_document_url?: string
    lines: JournalEntryLine[]
  }) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

export function JournalEntryForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: JournalEntryFormProps) {
  const [entryDate, setEntryDate] = useState(
    initialData?.entry_date || new Date().toISOString().split("T")[0]
  )
  const [description, setDescription] = useState(initialData?.description || "")
  const [lines, setLines] = useState<JournalEntryLine[]>(
    initialData?.lines || [
      { account_id: "", posting_type: PostingType.DEBIT, amount: 0 },
      { account_id: "", posting_type: PostingType.CREDIT, amount: 0 },
    ]
  )

  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    // Validate debits = credits
    const totalDebits = lines
      .filter((line) => line.posting_type === PostingType.DEBIT)
      .reduce((sum, line) => sum + (line.amount || 0), 0)

    const totalCredits = lines
      .filter((line) => line.posting_type === PostingType.CREDIT)
      .reduce((sum, line) => sum + (line.amount || 0), 0)

    if (totalDebits !== totalCredits) {
      setValidationError(
        `Total debits (${totalDebits.toFixed(2)}) must equal total credits (${totalCredits.toFixed(2)})`
      )
    } else {
      setValidationError(null)
    }
  }, [lines])

  const addLine = () => {
    setLines([...lines, { account_id: "", posting_type: PostingType.DEBIT, amount: 0 }])
  }

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index))
    }
  }

  const updateLine = (index: number, field: keyof JournalEntryLine, value: any) => {
    const updatedLines = [...lines]
    updatedLines[index] = { ...updatedLines[index], [field]: value }
    setLines(updatedLines)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (validationError) {
      return
    }

    if (!description.trim()) {
      setValidationError("Description is required")
      return
    }

    if (lines.some((line) => !line.account_id || line.amount <= 0)) {
      setValidationError("All lines must have an account and amount > 0")
      return
    }

    onSubmit({
      entry_date: new Date(entryDate),
      description: description.trim(),
      lines: lines.map((line) => ({
        account_id: line.account_id,
        posting_type: line.posting_type,
        amount: Number(line.amount),
        description: line.description?.trim() || undefined,
      })),
    })
  }

  const totalDebits = lines
    .filter((line) => line.posting_type === PostingType.DEBIT)
    .reduce((sum, line) => sum + (line.amount || 0), 0)

  const totalCredits = lines
    .filter((line) => line.posting_type === PostingType.CREDIT)
    .reduce((sum, line) => sum + (line.amount || 0), 0)

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-blue-600">Journal Entry Details</CardTitle>
        <CardDescription>Enter the journal entry information and lines</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="entry_date" className="text-sm font-medium text-gray-700">
                Entry Date *
              </Label>
              <Input
                id="entry_date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">
              Description *
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter journal entry description..."
              required
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Journal Entry Lines *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                Add Line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg bg-gray-50">
                  <div className="col-span-4">
                    <Label className="text-xs font-medium text-gray-700">Account *</Label>
                    <AccountSelector
                      value={line.account_id}
                      onValueChange={(value) => updateLine(index, "account_id", value)}
                      placeholder="Select account"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-gray-700">Type *</Label>
                    <Select
                      value={line.posting_type}
                      onValueChange={(value) => updateLine(index, "posting_type", value as PostingType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PostingType.DEBIT}>Debit</SelectItem>
                        <SelectItem value={PostingType.CREDIT}>Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs font-medium text-gray-700">Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount || ""}
                      onChange={(e) => updateLine(index, "amount", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-gray-700">Description</Label>
                    <Input
                      value={line.description || ""}
                      onChange={(e) => updateLine(index, "description", e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-900">Total Debits: ₦{totalDebits.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm font-medium text-gray-900">Total Credits: ₦{totalCredits.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div
                className={`text-lg font-bold ${
                  totalDebits === totalCredits ? "text-green-600" : "text-red-600"
                }`}
              >
                Difference: ₦{Math.abs(totalDebits - totalCredits).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4 pt-4 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || !!validationError}
              className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
            >
              {isSubmitting ? "Saving..." : "Save Journal Entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

