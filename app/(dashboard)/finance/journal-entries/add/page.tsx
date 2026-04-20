"use client"

import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { JournalEntryForm } from "@/components/finance/journal-entry-form"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"

export const dynamic = 'force-dynamic'

export default function AddJournalEntryPage() {
  const router = useRouter()
  const { toast } = useToast()

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/finance/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create journal entry")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Journal entry created successfully",
      })
      router.push("/finance/journal-entries")
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create journal entry",
        variant: "destructive",
      })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add Journal Entry</h1>
          <p className="text-gray-600">Create a new manual journal entry</p>
        </div>
      </div>

      <JournalEntryForm
        onSubmit={(data) => createMutation.mutate(data)}
        onCancel={() => router.back()}
        isSubmitting={createMutation.isPending}
      />
    </div>
  )
}

