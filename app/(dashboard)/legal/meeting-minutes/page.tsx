"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Eye, Edit, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { WorkflowStatusBadge } from "@/components/legal/workflow-status-badge"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MeetingType, LegalDocumentStatus } from "@prisma/client"

export const dynamic = 'force-dynamic'

export default function MeetingMinutesPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["meeting-minutes", page, search, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(typeFilter !== "all" && { meeting_type: typeFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      })
      const res = await fetch(`/api/legal/meeting-minutes?${params}`)
      if (!res.ok) throw new Error("Failed to fetch meeting minutes")
      return res.json()
    },
  })

  const meetings = data?.data?.meetings || []
  const pagination = data?.data?.pagination

  const getTypeLabel = (type: MeetingType) => {
    return type.replace(/_/g, " ")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meeting Minutes</h1>
          <p className="text-muted-foreground">
            Manage board, management, and committee meeting minutes
          </p>
        </div>
        <PermissionGate permission="legal:add">
          <Link href="/legal/meeting-minutes/add">
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Add Meeting Minutes
            </Button>
          </Link>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Meeting Minutes</CardTitle>
              <CardDescription>All meeting minutes records</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="BOARD_MEETING">Board Meeting</SelectItem>
                  <SelectItem value="MANAGEMENT_MEETING">Management Meeting</SelectItem>
                  <SelectItem value="COMMITTEE_MEETING">Committee Meeting</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="VETTED">Vetted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search meeting minutes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No meeting minutes found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meeting ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.map((meeting: any) => (
                    <TableRow key={meeting.id}>
                      <TableCell className="font-mono text-sm">{meeting.meeting_id}</TableCell>
                      <TableCell className="font-medium">{meeting.title}</TableCell>
                      <TableCell>{getTypeLabel(meeting.meeting_type)}</TableCell>
                      <TableCell>
                        {new Date(meeting.meeting_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <WorkflowStatusBadge status={meeting.status} />
                      </TableCell>
                      <TableCell>
                        {meeting.created_by
                          ? `${meeting.created_by.first_name} ${meeting.created_by.last_name}`
                          : "N/A"}
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
                              onClick={() => router.push(`/legal/meeting-minutes/${meeting.id}`)}
                              className="w-full justify-start text-xs"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {meeting.status === "DRAFT" && (
                              <PermissionGate permission="legal:edit">
                                <DropdownMenuItem
                                  onClick={() => router.push(`/legal/meeting-minutes/${meeting.id}/edit`)}
                                  className="w-full justify-start text-xs"
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              </PermissionGate>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((page - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}{" "}
                    meetings
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                      disabled={page === pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

