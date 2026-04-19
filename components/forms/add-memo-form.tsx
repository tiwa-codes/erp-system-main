"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Search, UserPlus } from "lucide-react"

interface Recipient {
  id: string
  first_name: string
  last_name: string
  email: string
  role?: { name: string } | null
  department?: { name: string } | null
}

export function AddMemoForm({
  onSuccess,
  onCancel,
  module: moduleProp,
}: {
  onSuccess: () => void
  onCancel: () => void
  module?: string
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "NORMAL",
    memo_type: "STANDARD",
  })
  const [recipientSearch, setRecipientSearch] = useState("")
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([])
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)

  // Debounced search: fetch users matching the search term
  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["memo-recipients-search", recipientSearch],
    queryFn: async () => {
      if (!recipientSearch.trim()) return { users: [] }
      const res = await fetch(`/api/memos/recipients?search=${encodeURIComponent(recipientSearch)}`)
      if (!res.ok) throw new Error("Failed to search recipients")
      return res.json()
    },
    enabled: recipientSearch.trim().length > 0,
    staleTime: 10_000,
  })

  const candidateUsers: Recipient[] = (searchResults?.users || []).filter(
    (u: Recipient) => !selectedRecipients.some((r) => r.id === u.id)
  )

  const addRecipient = (user: Recipient) => {
    setSelectedRecipients((prev) => [...prev, user])
    setRecipientSearch("")
  }

  const removeRecipient = (id: string) => {
    setSelectedRecipients((prev) => prev.filter((r) => r.id !== id))
  }

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/memos", { method: "POST", body: data })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || error.error || "Failed to create memo")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Memo sent successfully" })
      onSuccess()
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create memo", variant: "destructive" })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim()) {
      toast({ title: "Validation Error", description: "Title is required", variant: "destructive" })
      return
    }
    if (!form.content.trim()) {
      toast({ title: "Validation Error", description: "Content is required", variant: "destructive" })
      return
    }
    if (selectedRecipients.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one recipient", variant: "destructive" })
      return
    }

    if (attachmentFile) {
      const allowed = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ]
      if (!allowed.includes(attachmentFile.type)) {
        toast({ title: "Invalid file type", description: "Only PDF, Word, or Excel documents are allowed", variant: "destructive" })
        return
      }
      if (attachmentFile.size > 1 * 1024 * 1024) {
        toast({ title: "File too large", description: "Max file size is 1 MB", variant: "destructive" })
        return
      }
    }

    const payload = new FormData()
    payload.append("title", form.title)
    payload.append("content", form.content)
    payload.append("priority", form.priority)
    payload.append("memo_type", form.memo_type)
    payload.append("recipient_ids", JSON.stringify(selectedRecipients.map((r) => r.id)))
    if (moduleProp) payload.append("module", moduleProp)
    if (attachmentFile) payload.append("attachment", attachmentFile)

    createMutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <Label htmlFor="title">Subject / Title *</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Enter memo subject"
          required
        />
      </div>

      {/* Recipients */}
      <div>
        <Label>Recipients *</Label>
        {/* Selected recipients as chips */}
        {selectedRecipients.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 mt-1">
            {selectedRecipients.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full"
              >
                {r.first_name} {r.last_name}
                <button
                  type="button"
                  onClick={() => removeRecipient(r.id)}
                  className="hover:text-blue-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <Input
            value={recipientSearch}
            onChange={(e) => setRecipientSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="pl-9"
          />
        </div>

        {/* Dropdown results */}
        {recipientSearch.trim().length > 0 && (
          <div className="border rounded-md mt-1 max-h-48 overflow-y-auto bg-white shadow-sm">
            {searching ? (
              <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
            ) : candidateUsers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">No users found</div>
            ) : (
              candidateUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => addRecipient(user)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm"
                >
                  <UserPlus className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="font-medium">{user.first_name} {user.last_name}</span>
                    <span className="text-gray-400 ml-2">{user.email}</span>
                    {user.role?.name && (
                      <span className="ml-2 text-xs text-gray-500 bg-gray-100 rounded px-1 py-0.5">
                        {user.role.name}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Priority + Memo Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select value={form.priority} onValueChange={(v) => setForm((prev) => ({ ...prev, priority: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="NORMAL">Normal</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="memo_type">Memo Type</Label>
          <Select value={form.memo_type} onValueChange={(v) => setForm((prev) => ({ ...prev, memo_type: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STANDARD">Standard (via Dept Oversight)</SelectItem>
              <SelectItem value="REQUEST">Request (direct to Executive)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div>
        <Label htmlFor="content">Message *</Label>
        <Textarea
          id="content"
          value={form.content}
          onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
          placeholder="Type your memo here..."
          rows={6}
          required
        />
      </div>

      {/* Attachment */}
      <div>
        <Label htmlFor="attachment">Attachment (PDF, Word, or Excel, max 1 MB)</Label>
        <Input
          id="attachment"
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Sending..." : "Send Memo"}
        </Button>
      </div>
    </form>
  )
}
