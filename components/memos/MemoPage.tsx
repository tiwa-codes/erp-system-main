"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Plus,
  Search,
  Eye,
  Inbox,
  Send,
  LayoutList,
  X,
  FileText,
} from "lucide-react"
import { AddMemoForm } from "@/components/forms/add-memo-form"
import { ViewMemo } from "@/components/forms/view-memo"

interface MemoPageProps {
  module: string
  title?: string
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN']
const GLOBAL_MEMO_ADMIN_EMAIL = "admin@erp.com"
const EXECUTIVE_INBOX_FALLBACK_EMAILS = [GLOBAL_MEMO_ADMIN_EMAIL, "aliyu.sumaila@crownjewelhmo.com"]

const normalizeRole = (role?: string | null) => (role || "").toUpperCase().replace(/[\s-]+/g, "_")

const priorityColor: Record<string, string> = {
  URGENT: 'destructive',
  HIGH: 'destructive',
  NORMAL: 'default',
  LOW: 'secondary',
}

const statusColor: Record<string, string> = {
  DRAFT: 'secondary',
  PENDING_DEPT_OVERSIGHT: 'default',
  PENDING_EXECUTIVE: 'default',
  APPROVED: 'default',
  REJECTED: 'destructive',
}

const statusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_DEPT_OVERSIGHT: 'Dept Review',
  PENDING_EXECUTIVE: 'MD Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export function MemoPage({ module, title }: MemoPageProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedMemo, setSelectedMemo] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("inbox")

  const userEmail = ((session?.user?.email as string) || '').toLowerCase()
  const userRoleUpper = normalizeRole(session?.user?.role as string)
  const isAdmin = ADMIN_ROLES.includes(userRoleUpper)
  const isGlobalMemoAdmin = userEmail === GLOBAL_MEMO_ADMIN_EMAIL
  const isExecutiveByFallbackEmail = EXECUTIVE_INBOX_FALLBACK_EMAILS.includes(userEmail)
  const isExecutiveApprover =
    module === "executive-desk" &&
    (
      userRoleUpper.includes('MD') ||
      userRoleUpper.includes('MANAGING_DIRECTOR') ||
      ADMIN_ROLES.includes(userRoleUpper) ||
      isExecutiveByFallbackEmail
    )
  const hasSharedExecutiveInbox = module === "executive-desk" && isExecutiveApprover

  const { data: memos = [], isLoading, refetch } = useQuery({
    queryKey: ["memos", module],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (module) params.append("module", module)
      const res = await fetch(`/api/memos?${params}`)
      if (!res.ok) throw new Error("Failed to fetch memos")
      return res.json()
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const userId = session?.user?.id as string | undefined

  // Split into inbox (user is recipient) vs sent (user is sender)
  // Legacy memos (no sender_user_id/recipients) fall into "All" tab for admins,
  // and into "inbox" for everyone else so existing data is not lost.
  const inboxMemos = isGlobalMemoAdmin
    ? memos
    : hasSharedExecutiveInbox
    ? memos
    : memos.filter((m: any) =>
        m.recipients?.some((r: any) => r.user_id === userId) ||
        (isExecutiveApprover && m.status === "PENDING_EXECUTIVE") ||
        // Legacy memos with no new-style sender/recipients show in inbox
        (!m.sender_user_id && (!m.recipients || m.recipients.length === 0))
      )
  const sentMemos = memos.filter((m: any) => m.sender_user_id === userId)

  const filterBySearch = (list: any[]) => {
    if (!searchTerm.trim()) return list
    const q = searchTerm.toLowerCase()
    return list.filter((m: any) =>
      m.title?.toLowerCase().includes(q) ||
      `${m.sender_user?.first_name} ${m.sender_user?.last_name}`.toLowerCase().includes(q)
    )
  }

  const displayedMemos =
    activeTab === "inbox"
      ? filterBySearch(inboxMemos)
      : activeTab === "sent"
      ? filterBySearch(sentMemos)
      : filterBySearch(memos) // "all" — admin only

  const handleView = (memo: any) => {
    setSelectedMemo(memo)
    setShowViewModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {title || `${module.charAt(0).toUpperCase() + module.slice(1).replace(/-/g, ' ')} Memos`}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Internal memos and communications</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-[#BE1522] hover:bg-[#9B1219] text-white">
          <Plus className="h-4 w-4 mr-2" />
          Compose
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
        <Input
          placeholder="Search memos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inbox" className="flex items-center gap-1.5">
            <Inbox className="h-4 w-4" />
            Inbox
            {inboxMemos.length > 0 && (
              <span className="ml-1 text-xs bg-[#BE1522] text-white rounded-full px-1.5 py-0.5 leading-none">
                {inboxMemos.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-1.5">
            <Send className="h-4 w-4" />
            Sent
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="all" className="flex items-center gap-1.5">
              <LayoutList className="h-4 w-4" />
              All
            </TabsTrigger>
          )}
        </TabsList>

        {["inbox", "sent", "all"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  {tab === "inbox"
                    ? `Inbox (${filterBySearch(inboxMemos).length})`
                    : tab === "sent"
                    ? `Sent (${filterBySearch(sentMemos).length})`
                    : `All Memos (${filterBySearch(memos).length})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading memos...</div>
                ) : displayedMemos.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    {tab === "inbox"
                      ? "No memos in your inbox yet."
                      : tab === "sent"
                      ? "You haven't sent any memos yet."
                      : "No memos found."}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>{tab === "inbox" ? "From" : "To"}</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedMemos.map((memo: any) => {
                        const isUnread =
                          tab === "inbox" &&
                          memo.recipients?.some(
                            (r: any) => r.user_id === userId && !r.read_at
                          )
                        return (
                          <TableRow
                            key={memo.id}
                            className={isUnread ? "bg-blue-50/50" : ""}
                          >
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-[#BE1522] shrink-0" />
                                )}
                                <span className={`max-w-xs truncate ${isUnread ? "font-semibold" : ""}`}>
                                  {memo.title}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {tab === "inbox" ? (
                                memo.sender_user ? (
                                  <span className="text-sm">
                                    {memo.sender_user.first_name} {memo.sender_user.last_name}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic text-sm">System</span>
                                )
                              ) : (
                                <span className="text-sm text-gray-600">
                                  {memo.recipients?.length
                                    ? memo.recipients
                                        .slice(0, 2)
                                        .map((r: any) => `${r.user?.first_name} ${r.user?.last_name}`)
                                        .join(", ") +
                                      (memo.recipients.length > 2
                                        ? ` +${memo.recipients.length - 2}`
                                        : "")
                                    : "—"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={priorityColor[memo.priority] as any}>
                                {memo.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusColor[memo.status] as any ?? 'default'}>
                                {statusLabel[memo.status] ?? memo.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {new Date(memo.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(memo)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Compose Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">New Memo</span>
                <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddMemoForm
                module={module}
                onSuccess={() => {
                  setShowAddModal(false)
                  refetch()
                }}
                onCancel={() => setShowAddModal(false)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Memo Modal */}
      {showViewModal && selectedMemo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Memo</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowViewModal(false)
                    setSelectedMemo(null)
                    refetch() // refresh in case read_at was updated
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ViewMemo
                memo={selectedMemo}
                onClose={() => {
                  setShowViewModal(false)
                  setSelectedMemo(null)
                  refetch()
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
