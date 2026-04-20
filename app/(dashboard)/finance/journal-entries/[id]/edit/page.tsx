"use client"

export const dynamic = 'force-dynamic'

import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { JournalEntryForm } from "@/components/finance/journal-entry-form"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"
import { JournalEntryStatus } from "@prisma/client"



export default function EditJournalEntryPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ["journal-entry", id],
    queryFn: async () => {
      const res = await fetch(`/api/finance/journal-entries/${id}`)
      if (!res.ok) throw new Error("Failed to fetch journal entry")
      return res.json()
    },
  })

  const entry = data?.data

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/finance/journal-entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update journal entry")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Journal entry updated successfully",
      })
      router.push(`/finance/journal-entries/${id}`)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update journal entry",
        variant: "destructive",
      })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Journal entry not found</p>
      </div>
    )
  }

  // Check if entry can be edited
  if (entry.status !== JournalEntryStatus.DRAFT && entry.status !== JournalEntryStatus.PENDING_APPROVAL) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cannot Edit Journal Entry</h1>
            <p className="text-gray-600">This journal entry cannot be edited</p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Journal entries can only be edited when they are in <strong>Draft</strong> or <strong>Pending Approval</strong> status.
            Current status: <strong>{entry.status}</strong>
          </p>
        </div>
      </div>
    )
  }

  const initialData = {
    entry_date: new Date(entry.entry_date).toISOString().split("T")[0],
    description: entry.description || "",
    lines: entry.journal_entry_lines?.map((line: any) => ({
      account_id: line.account_id,
      posting_type: line.posting_type,
      amount: Number(line.amount),
      description: line.description || "",
    })) || [],
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Journal Entry</h1>
          <p className="text-gray-600">Entry Number: {entry.entry_number}</p>
        </div>
      </div>

      <JournalEntryForm
        initialData={initialData}
        onSubmit={(data) => {
          updateMutation.mutate({
            entry_date: data.entry_date.toISOString(),
            description: data.description,
            lines: data.lines,
          })
        }}
        onCancel={() => router.back()}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  )
}

