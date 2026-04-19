"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { ArrowLeft, Edit, Check, X, FileText, Download } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { JournalEntryStatus, PostingType } from "@prisma/client"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export default function JournalEntryDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["journal-entry", id],
    queryFn: async () => {
      const res = await fetch(`/api/finance/journal-entries/${id}`)
      if (!res.ok) throw new Error("Failed to fetch journal entry")
      return res.json()
    },
  })

  const entry = data?.data

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/finance/journal-entries/${id}/post`, {
        method: "POST",
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to post")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entry", id] })
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] })
      toast({ title: "Success", description: "Journal entry posted to General Ledger" })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to post journal entry",
        variant: "destructive",
      })
    },
  })

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!entry) {
    return <div className="text-center py-8">Journal entry not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{entry.entry_number}</h1>
          <p className="text-muted-foreground">{entry.description || "No description"}</p>
        </div>
        <div className="flex gap-2">
          {[JournalEntryStatus.DRAFT, JournalEntryStatus.PENDING_APPROVAL, JournalEntryStatus.APPROVED].includes(entry.status) && (
            <PermissionGate permission="finance:edit">
              <Button
                variant="outline"
                onClick={() => router.push(`/finance/journal-entries/${id}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                onClick={() => postMutation.mutate()}
                disabled={postMutation.isPending}
              >
                <FileText className="h-4 w-4 mr-2" />
                Post to GL
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Entry Information</CardTitle>
            <CardDescription>Basic journal entry details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Entry Number</div>
              <div className="font-mono text-lg">{entry.entry_number}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Entry Date</div>
              <div>{new Date(entry.entry_date).toLocaleDateString("en-NG")}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Type</div>
              <div>{entry.entry_type === "MANUAL" ? "Manual" : "System Generated"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <StatusIndicator status={entry.status} />
            </div>
            {entry.description && (
              <div>
                <div className="text-sm text-muted-foreground">Description</div>
                <div>{entry.description}</div>
              </div>
            )}
            {entry.rejection_reason && (
              <div>
                <div className="text-sm text-muted-foreground">Rejection Reason</div>
                <div className="text-red-600">{entry.rejection_reason}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
            <CardDescription>Journal entry totals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Debits</div>
              <div className="text-2xl font-bold text-green-600">
                ₦{Number(entry.total_debit).toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Credits</div>
              <div className="text-2xl font-bold text-red-600">
                ₦{Number(entry.total_credit).toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground">Difference</div>
              <div
                className={`text-lg font-bold ${
                  Number(entry.total_debit) === Number(entry.total_credit)
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                ₦{(
                  Number(entry.total_debit) - Number(entry.total_credit)
                ).toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Journal Entry Lines</CardTitle>
          <CardDescription>Debit and credit entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.journal_entry_lines?.map((line: any) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{line.account.account_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {line.account.account_code}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        line.posting_type === PostingType.DEBIT
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {line.posting_type === PostingType.DEBIT ? "Debit" : "Credit"}
                    </span>
                  </TableCell>
                  <TableCell>{line.description || "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    ₦{Number(line.amount).toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

