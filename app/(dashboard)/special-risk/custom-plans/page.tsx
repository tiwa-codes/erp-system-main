"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, CheckCircle, Edit, MoreHorizontal, Plus, Send, Download } from "lucide-react"
import { useRouter } from "next/navigation"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { PermissionGate } from "@/components/ui/permission-gate"
import {


  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function CustomPlansPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ["special-risk-plans", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
      })
      const res = await fetch(`/api/special-risk/plans?${params}`)
      if (!res.ok) throw new Error("Failed to fetch plans")
      return res.json()
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  })

  const approveMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/special-risk/plans/${planId}/approve`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to approve plan")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-risk-plans"] })
      toast({
        title: "Success",
        description: "Plan approved and sent to Executive Desk",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      const now = new Date()
      const planName = `Special Service Plan ${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
      const res = await fetch("/api/special-risk/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: planName }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Failed to create custom plan draft")
      return payload
    },
    onSuccess: (payload) => {
      const id = payload?.data?.plan?.id
      queryClient.invalidateQueries({ queryKey: ["special-risk-plans"] })
      toast({
        title: "Draft created",
        description: "Custom plan draft created in Special Services.",
      })
      if (id) {
        router.push(`/underwriting/plans/${id}/customize?returnTo=/special-risk/custom-plans&stageLabel=Special%20Services`)
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const sendToMdMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/special-risk/plans/${planId}/send-to-md`, {
        method: "POST",
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Failed to send plan to MD")
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-risk-plans"] })
      toast({
        title: "Success",
        description: "Plan sent to MD successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const plans = data?.data?.plans || []
  const pagination = data?.data?.pagination

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Custom Plans</h1>
        <p className="text-muted-foreground">
          Review, create, customize, and forward custom plans to MD
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Special Services Custom Plans</CardTitle>
              <CardDescription>
                Plans at Special Services stage
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <PermissionGate permission="special-risk.add">
                <Button
                  onClick={() => createDraftMutation.mutate()}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                  disabled={createDraftMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createDraftMutation.isPending ? "Creating..." : "Add Custom Plan"}
                </Button>
              </PermissionGate>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plans..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No custom plans found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan ID</TableHead>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan: any) => {
                    const planRef = plan.id || plan.plan_id
                    return (
                    <TableRow key={planRef}>
                      <TableCell className="font-mono">{plan.plan_id}</TableCell>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{plan.plan_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {plan.created_by?.first_name} {plan.created_by?.last_name}
                      </TableCell>
                      <TableCell>
                        {new Date(plan.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={plan.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <PermissionGate permission="special-risk.view">
                              <DropdownMenuItem
                                onClick={() => router.push(`/special-risk/custom-plans/${planRef}`)}
                                className="w-full justify-start text-xs"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate permission="special-risk.edit">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/underwriting/plans/${planRef}/customize?returnTo=/special-risk/custom-plans&stageLabel=Special%20Services`
                                  )
                                }
                                className="w-full justify-start text-xs"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Modify
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate permission="special-risk.view">
                              <DropdownMenuItem
                                onClick={() => {
                                  window.location.href = `/api/special-risk/plans/${planRef}/export`
                                }}
                                className="w-full justify-start text-xs"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Export
                              </DropdownMenuItem>
                            </PermissionGate>
                            {(plan.status === "PENDING_APPROVAL" || plan.status === "DRAFT" || plan.status === "IN_PROGRESS") && (
                              <>
                                <PermissionGate permission="special-risk.approve">
                                  <DropdownMenuItem
                                    onClick={() => sendToMdMutation.mutate(planRef)}
                                    className="w-full justify-start text-xs"
                                    disabled={sendToMdMutation.isPending}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Send to MD
                                  </DropdownMenuItem>
                                </PermissionGate>
                              </>
                            )}
                            {plan.status === "PENDING_APPROVAL" && (
                              <PermissionGate permission="special-risk.approve">
                                <DropdownMenuItem
                                  onClick={() => approveMutation.mutate(planRef)}
                                  className="w-full justify-start text-xs"
                                  disabled={approveMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                              </PermissionGate>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
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
