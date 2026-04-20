"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { JournalEntryType, JournalEntryStatus } from "@prisma/client"
import { Plus, Search, Eye, Edit, MoreHorizontal } from "lucide-react"
import { StatusIndicator } from "@/components/ui/status-indicator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useToast } from "@/hooks/use-toast"



export default function JournalEntriesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [entryType, setEntryType] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["journal-entries", page, limit, entryType, status, fromDate, toDate, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(entryType !== "all" && { entry_type: entryType }),
        ...(status !== "all" && { status }),
        ...(fromDate && { from_date: fromDate }),
        ...(toDate && { to_date: toDate }),
        ...(search && { search }),
      })
      const res = await fetch(`/api/finance/journal-entries?${params}`)
      if (!res.ok) throw new Error("Failed to fetch journal entries")
      return res.json()
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
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
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] })
      toast({ title: "Success", description: "Journal entry posted to GL" })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to post journal entry",
        variant: "destructive",
      })
    },
  })

  const entries = data?.data?.entries || []
  const pagination = data?.data?.pagination

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Journal Entries</h1>
          <p className="text-gray-600">Manage manual and system-generated journal entries</p>
        </div>
        <PermissionGate permission="finance:add">
          <Button
            onClick={() => router.push("/finance/journal-entries/add")}
            className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Journal Entry
          </Button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search entries..."
                  className="pl-9 max-w-sm"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <Select value={entryType} onValueChange={(value) => { setEntryType(value); setPage(1) }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value={JournalEntryType.MANUAL}>Manual</SelectItem>
                  <SelectItem value={JournalEntryType.SYSTEM_GENERATED}>System Generated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1) }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value={JournalEntryStatus.DRAFT}>Draft</SelectItem>
                  <SelectItem value={JournalEntryStatus.PENDING_APPROVAL}>Pending Approval</SelectItem>
                  <SelectItem value={JournalEntryStatus.APPROVED}>Approved</SelectItem>
                  <SelectItem value={JournalEntryStatus.POSTED}>Posted</SelectItem>
                  <SelectItem value={JournalEntryStatus.REJECTED}>Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value)
                  setPage(1)
                }}
                placeholder="From Date"
                className="w-[150px]"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value)
                  setPage(1)
                }}
                placeholder="To Date"
                className="w-[150px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Journal Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">ENTRY #</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DESCRIPTION</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">TOTAL AMOUNT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No journal entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-gray-900">{entry.entry_number}</TableCell>
                      <TableCell className="text-gray-700">
                        {new Date(entry.entry_date).toLocaleDateString("en-NG")}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {entry.entry_type === JournalEntryType.MANUAL ? "Manual" : "System"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-gray-700">{entry.description || "—"}</TableCell>
                      <TableCell className="text-right font-medium text-gray-900">
                        ₦{Number(entry.total_debit).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={entry.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/finance/journal-entries/${entry.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {entry.status === JournalEntryStatus.DRAFT && (
                              <PermissionGate permission="finance:edit">
                                <DropdownMenuItem
                                  onClick={() => router.push(`/finance/journal-entries/${entry.id}/edit`)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => submitMutation.mutate(entry.id)}
                                  disabled={submitMutation.isPending}
                                >
                                  Post to GL
                                </DropdownMenuItem>
                              </PermissionGate>
                            )}
                            {entry.status === JournalEntryStatus.PENDING_APPROVAL && (
                              <PermissionGate permission="finance:edit">
                                <DropdownMenuItem
                                  onClick={() => submitMutation.mutate(entry.id)}
                                  disabled={submitMutation.isPending}
                                >
                                  Post to GL
                                </DropdownMenuItem>
                              </PermissionGate>
                            )}
                            {entry.status === JournalEntryStatus.APPROVED && (
                              <PermissionGate permission="finance:edit">
                                <DropdownMenuItem
                                  onClick={() => submitMutation.mutate(entry.id)}
                                  disabled={submitMutation.isPending}
                                >
                                  Post to GL
                                </DropdownMenuItem>
                              </PermissionGate>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} entries
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

