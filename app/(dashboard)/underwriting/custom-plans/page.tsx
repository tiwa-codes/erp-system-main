"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Edit, Send, MoreHorizontal, Download, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { StatusIndicator } from "@/components/ui/status-indicator"
import {


  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function UnderwritingCustomPlansPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["underwriting-custom-plans", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        classification: "CUSTOM",
        ...(search ? { search } : {}),
      })
      const res = await fetch(`/api/underwriting/plans?${params}`)
      if (!res.ok) throw new Error("Failed to fetch custom plans")
      return res.json()
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  })

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      const now = new Date()
      const planName = `Custom Plan ${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}`

      const res = await fetch("/api/underwriting/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planName,
          description: "",
          classification: "CUSTOM",
          special_service_mode: true,
          is_custom_draft: true,
          account_types: ["INDIVIDUAL", "FAMILY"],
          account_type_prices: {
            INDIVIDUAL: 0,
            FAMILY: 0,
          },
          unlimited_annual_limit: false,
          annual_limit: 0,
          hospital_tiers: [],
          region_of_cover: "",
        }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Failed to create custom plan draft")
      return payload
    },
    onSuccess: (payload) => {
      toast({
        title: "Draft created",
        description: "Custom plan draft is ready. You can now customize it.",
      })
      queryClient.invalidateQueries({ queryKey: ["underwriting-custom-plans"] })
      window.location.href = `/underwriting/plans/${payload?.plan?.id}/customize?returnTo=/underwriting/custom-plans&stageLabel=Underwriting`
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (planId: string) => {
      const safePlanId = encodeURIComponent(String(planId || "").trim())
      const res = await fetch(`/api/underwriting/plans/${safePlanId}/submit`, {
        method: "POST",
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Failed to send to Special Services")
      return payload
    },
    onSuccess: () => {
      toast({
        title: "Sent",
        description: "Plan sent to Special Services successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ["underwriting-custom-plans"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/underwriting/plans/${planId}`, {
        method: "DELETE",
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.message || payload?.error || "Failed to delete plan")
      return payload
    },
    onSuccess: () => {
      toast({
        title: "Deleted",
        description: "Custom plan deleted successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ["underwriting-custom-plans"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const plans = data?.plans || []
  const pagination = data?.pagination
  const parseAccountTypes = (value: any): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item ?? "").trim()).filter(Boolean)
    }
    if (typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean)
    }
    return []
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Plans</h1>
          <p className="text-muted-foreground">Create and manage custom special service plan sheets.</p>
        </div>
        <Button
          onClick={() => createDraftMutation.mutate()}
          className="bg-[#0891B2] hover:bg-[#9B1219]"
          disabled={createDraftMutation.isPending}
        >
          <Plus className="h-4 w-4 mr-2" />
          {createDraftMutation.isPending ? "Creating..." : "Add Custom Plan"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom Special Service Plans</CardTitle>
              <CardDescription>Draft, edit, and send custom plans to Special Services.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search plans..."
                className="pl-8 w-72"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No custom plans found.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Account Types</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval Stage</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan: any) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-mono">{plan.plan_id || "-"}</TableCell>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>
                        {parseAccountTypes(plan?.metadata?.specialServiceConfig?.accountTypes).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {parseAccountTypes(plan?.metadata?.specialServiceConfig?.accountTypes).map((accountType: string) => (
                              <Badge key={accountType} variant="outline">{accountType}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={plan.status} />
                      </TableCell>
                      <TableCell>{plan.approval_stage || "UNDERWRITING"}</TableCell>
                      <TableCell>{new Date(plan.updated_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                window.location.href = `/underwriting/plans/${plan.id}/customize?returnTo=/underwriting/custom-plans&stageLabel=Underwriting`
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Customize
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                window.location.href = `/api/underwriting/plans/${plan.id}/export`
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export
                            </DropdownMenuItem>
                            {(plan.status === "IN_PROGRESS" || plan.status === "DRAFT") && (
                              <DropdownMenuItem
                                onClick={() => submitMutation.mutate(plan.id)}
                                disabled={submitMutation.isPending}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Send to Special Service
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              disabled={deleteMutation.isPending}
                              onClick={() => {
                                const confirmed = window.confirm(`Delete custom plan "${plan.name}"? This cannot be undone.`)
                                if (!confirmed) return
                                deleteMutation.mutate(plan.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {deleteMutation.isPending ? "Deleting..." : "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination?.pages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((prev) => Math.min(pagination.pages, prev + 1))}
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
