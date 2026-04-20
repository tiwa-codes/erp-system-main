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
import { Search, Eye, CheckCircle, Edit } from "lucide-react"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useRouter } from "next/navigation"



export default function ExecutiveDeskCustomPlansPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ["executive-desk-plans", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
      })
      const res = await fetch(`/api/executive-desk/plans?${params}`)
      if (!res.ok) throw new Error("Failed to fetch plans")
      return res.json()
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  })

  const approveMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/executive-desk/plans/${planId}/approve`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to approve plan")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executive-desk-plans"] })
      toast({
        title: "Success",
        description: "Plan approved and activated",
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
        <h1 className="text-3xl font-bold">Custom Plans - MD Approval</h1>
        <p className="text-muted-foreground">
          Final review and approval of customized plans
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending MD Approval</CardTitle>
              <CardDescription>
                Plans approved by Special Services, awaiting MD final approval
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
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
            <div className="text-center py-8 text-muted-foreground">
              No pending plans for MD approval
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan ID</TableHead>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Special Services Approved By</TableHead>
                    <TableHead>Approved Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan: any) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-mono">{plan.plan_id}</TableCell>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{plan.plan_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {plan.special_risk_approved_by
                          ? `${plan.special_risk_approved_by.first_name} ${plan.special_risk_approved_by.last_name}`
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {plan.special_risk_approved_at
                          ? new Date(plan.special_risk_approved_at).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={plan.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PermissionGate module="executive-desk" action="view">
                            <Button variant="outline" size="sm" onClick={() => router.push(`/executive-desk/custom-plans/${plan.id}`)}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="executive-desk" action="edit">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/underwriting/plans/${plan.id}/customize?returnTo=/executive-desk/custom-plans/${plan.id}&stageLabel=Executive%20Desk`
                                )
                              }
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Modify
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="executive-desk" action="approve">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => approveMutation.mutate(plan.id)}
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Final Approve
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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







