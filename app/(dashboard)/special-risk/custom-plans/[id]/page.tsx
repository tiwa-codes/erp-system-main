"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, XCircle, Edit, Download } from "lucide-react"
import Link from "next/link"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"



function formatCurrency(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "N/A"
  return `₦${Number(value).toLocaleString()}`
}

function formatLimitValue(limit: number | null | undefined, unlimited?: boolean) {
  if (unlimited) return "Unlimited"
  if (limit === null || limit === undefined || Number.isNaN(Number(limit))) return "N/A"
  return formatCurrency(limit)
}

function normalizeTierList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((tier) => String(tier || "").trim())
    .filter(Boolean)
}

function getPlanTiers(planColumn: any, fallback: unknown): string[] {
  const perPlan = normalizeTierList(planColumn?.hospitalTiers)
  if (perPlan.length > 0) return perPlan
  return normalizeTierList(fallback)
}

export default function CustomPlanDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["special-risk-plan", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/special-risk/plans/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch plan")
      return res.json()
    },
  })

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/special-risk/plans/${params.id}/approve`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to approve plan")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-risk-plan", params.id] })
      queryClient.invalidateQueries({ queryKey: ["special-risk-plans"] })
      toast({
        title: "Success",
        description: "Plan approved and sent to Executive Desk",
      })
      router.push("/special-risk/custom-plans")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetch(`/api/special-risk/plans/${params.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reject plan")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-risk-plan", params.id] })
      queryClient.invalidateQueries({ queryKey: ["special-risk-plans"] })
      toast({
        title: "Success",
        description: "Plan rejected and sent back to Underwriting",
      })
      setIsRejectOpen(false)
      setRejectionReason("")
      router.push("/special-risk/custom-plans")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const plan = data?.data
  const specialServiceConfig = plan?.metadata?.specialServiceConfig
  const combinedHospitalTiers = Array.from(
    new Set(
      (specialServiceConfig?.plans || []).flatMap((planColumn: any) =>
        getPlanTiers(planColumn, specialServiceConfig?.hospitalTiers)
      )
    )
  )

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!plan) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Plan not found</p>
        <Link href="/special-risk/custom-plans">
          <Button variant="outline" className="mt-4">
            Back to Custom Plans
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/special-risk/custom-plans">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{plan.name}</h1>
            <p className="text-muted-foreground">Plan ID: {plan.plan_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator status={plan.status} />
          <PermissionGate module="special-risk" action="view">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = `/api/special-risk/plans/${params.id}/export`
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </PermissionGate>
          {plan.status === "PENDING_APPROVAL" && (
            <>
              <PermissionGate module="special-risk" action="edit">
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(
                      `/underwriting/plans/${params.id}/customize?returnTo=/special-risk/custom-plans/${params.id}&stageLabel=Special%20Services`
                    )
                  }
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Modify
                </Button>
              </PermissionGate>
              <PermissionGate module="special-risk" action="approve">
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve & Send to MD
                </Button>
              </PermissionGate>
              <PermissionGate module="special-risk" action="approve">
                <Button
                  variant="destructive"
                  onClick={() => setIsRejectOpen(true)}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </PermissionGate>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Plan Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Plan Type</p>
              <p className="font-medium">{plan.plan_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Classification</p>
              <Badge variant="outline">{plan.classification}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Premium Amount</p>
              <p className="font-medium">₦{Number(plan.premium_amount).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Annual Limit</p>
              <p className="font-medium">
                {specialServiceConfig?.unlimitedAnnualLimit
                  ? "UNLIMITED"
                  : `₦${Number(plan.annual_limit).toLocaleString()}`}
              </p>
            </div>
            {specialServiceConfig?.enabled && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Account Type Pricing</p>
                  <div className="font-medium">
                    {specialServiceConfig.accountTypes?.map((type: string) => (
                      <p key={type}>
                        {type}: ₦{Number(specialServiceConfig.accountTypePrices?.[type] || 0).toLocaleString()}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hospital Tiers</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {combinedHospitalTiers.map((tier: string) => (
                      <Badge key={tier} variant="secondary">{tier}</Badge>
                    ))}
                  </div>
                </div>
                {specialServiceConfig.regionOfCover && (
                  <div>
                    <p className="text-sm text-muted-foreground">Region of Cover</p>
                    <p className="font-medium">{specialServiceConfig.regionOfCover}</p>
                  </div>
                )}
              </>
            )}
            {plan.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{plan.description}</p>
              </div>
            )}
            {plan.metadata?.submitter_contact && (
              <>
                <div className="pt-4 border-t border-gray-100 mt-2">
                  <p className="text-sm text-muted-foreground font-semibold mb-2">Submitter Information</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Person</p>
                      <p className="font-medium">{plan.metadata.submitter_contact.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{plan.metadata.submitter_contact.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{plan.metadata.submitter_contact.phone}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Created By</p>
              <p className="font-medium">
                {plan.created_by?.first_name} {plan.created_by?.last_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created Date</p>
              <p className="font-medium">
                {new Date(plan.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {specialServiceConfig?.enabled && Array.isArray(specialServiceConfig.plans) && specialServiceConfig.plans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Configured Plans</CardTitle>
              <CardDescription>Exact 4-plan setup submitted from customization.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {specialServiceConfig.plans.map((planColumn: any) => (
                  <Card key={planColumn.id || planColumn.name} className="border border-gray-200">
                    <CardContent className="space-y-2 pt-4">
                      <p className="font-semibold text-sm">{planColumn.name || "Unnamed Plan"}</p>
                      <div>
                        <p className="text-xs text-muted-foreground">Individual Price</p>
                        <p className="font-medium">{formatCurrency(planColumn.individualPrice || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Family Price</p>
                        <p className="font-medium">{formatCurrency(planColumn.familyPrice || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Individual Limit</p>
                        <p className="font-medium">{formatLimitValue(planColumn.individualLimit, Boolean(planColumn.individualUnlimited))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Family Limit</p>
                        <p className="font-medium">{formatLimitValue(planColumn.familyLimit, Boolean(planColumn.familyUnlimited))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Hospital Tiers</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {getPlanTiers(planColumn, specialServiceConfig?.hospitalTiers).length > 0 ? (
                            getPlanTiers(planColumn, specialServiceConfig?.hospitalTiers).map((tier: string) => (
                              <Badge key={`${planColumn.id || planColumn.name}-${tier}`} variant="secondary">{tier}</Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {specialServiceConfig?.enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Customized Categories & Services</CardTitle>
            <CardDescription>Sheet view from Underwriting custom special service table</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(specialServiceConfig.table?.categories || []).map((category: any) => (
              <div key={category.id} className="rounded-lg border p-4 space-y-3">
                <h3 className="font-semibold">{category.title}</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Services</TableHead>
                        {(specialServiceConfig.table?.columns || []).map((column: string) => (
                          <TableHead key={`${category.id}-${column}`}>{column}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(category.rows || []).map((row: any) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.serviceName || "-"}</TableCell>
                          {(specialServiceConfig.table?.columns || []).map((column: string) => (
                            <TableCell key={`${row.id}-${column}`}>{row.values?.[column] || "-"}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {(!category.rows || category.rows.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={(specialServiceConfig.table?.columns?.length || 0) + 1} className="text-center text-muted-foreground">
                            No services added yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!specialServiceConfig?.enabled && plan.customizations && plan.customizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Customized Categories & Services</CardTitle>
            <CardDescription>Saved category limits and selected services from Underwriting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.customizations.map((category: any) => (
              <div key={category.categoryId} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-semibold">{category.categoryName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {category.services.length} selected service{category.services.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">Category Limit: {formatCurrency(category.priceLimit)}</Badge>
                    <Badge variant="outline">Frequency: {category.frequencyLimit ?? "N/A"}</Badge>
                  </div>
                </div>

                {category.services.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Base Price</TableHead>
                        <TableHead>Service Price Limit</TableHead>
                        <TableHead>Service Frequency Limit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {category.services.map((service: any) => (
                        <TableRow key={`${category.categoryId}-${service.id}`}>
                          <TableCell>{service.name}</TableCell>
                          <TableCell>{formatCurrency(service.facilityPrice)}</TableCell>
                          <TableCell>{formatCurrency(service.servicePriceLimit)}</TableCell>
                          <TableCell>{service.serviceFrequencyLimit ?? "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No services selected for this category yet.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!specialServiceConfig?.enabled && (!plan.customizations || plan.customizations.length === 0) && plan.plan_limits && plan.plan_limits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Limits</CardTitle>
            <CardDescription>Fallback raw limit records</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Price Limit</TableHead>
                  <TableHead>Frequency Limit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.plan_limits.map((limit: any) => (
                  <TableRow key={limit.id}>
                    <TableCell>{limit.limit_type}</TableCell>
                    <TableCell>{limit.category_id || "N/A"}</TableCell>
                    <TableCell>{limit.service_id || "N/A"}</TableCell>
                    <TableCell>{formatCurrency(limit.price_limit)}</TableCell>
                    <TableCell>{limit.frequency_limit || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Custom Plan</DialogTitle>
            <DialogDescription>
              This will send the plan back to Underwriting for rework.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rejection Reason</label>
            <Textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Enter the reason for rejecting this custom plan"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              onClick={() => rejectMutation.mutate(rejectionReason.trim())}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
