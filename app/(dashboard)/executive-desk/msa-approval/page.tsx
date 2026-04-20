"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useToast } from "@/hooks/use-toast"

export const dynamic = 'force-dynamic'

export default function MsaApprovalPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject">("approve")
  const [actionPlan, setActionPlan] = useState<any>(null)
  const [actionComment, setActionComment] = useState("")

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pending-tariff-plans", "MD"],
    queryFn: async () => {
      const res = await fetch("/api/provider/tariff-plans/pending?stage=MD")
      if (!res.ok) throw new Error("Failed to fetch MSA approvals")
      return res.json()
    },
  })

  const tariffPlans = data?.tariffPlans || []

  const approveRejectMutation = useMutation({
    mutationFn: async ({ planId, action, comment }: { planId: string; action: "approve" | "reject"; comment?: string }) => {
      if (action === "approve") {
        const res = await fetch(`/api/provider/tariff-plan/${planId}/approve/md`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comments: comment || undefined }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.error || "Failed to approve and send MSA")
        return payload
      }

      const res = await fetch(`/api/provider/tariff-plan/${planId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: comment || "Rejected at MSA approval" }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Failed to reject tariff")
      return payload
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.action === "approve" ? "Approved" : "Rejected",
        description:
          variables.action === "approve"
            ? "MSA email and PDF have been sent to provider."
            : "Request rejected and sent back to provider with reason.",
      })
      setActionModalOpen(false)
      setActionPlan(null)
      setActionComment("")
      refetch()
      queryClient.invalidateQueries({ queryKey: ["pending-tariff-plans", "MD"] })
      queryClient.invalidateQueries({ queryKey: ["pending-tariff-plans", "UNDERWRITING"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleOpenActionModal = (plan: any, action: "approve" | "reject") => {
    setActionPlan(plan)
    setActionType(action)
    setActionComment("")
    setActionModalOpen(true)
  }

  const handleSubmitAction = () => {
    if (!actionPlan?.id) return
    approveRejectMutation.mutate({
      planId: actionPlan.id,
      action: actionType,
      comment: actionComment.trim() || undefined,
    })
  }

  return (
    <PermissionGate module="executive-desk" action="approve">
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h1 className="text-4xl font-semibold text-gray-900">MSA Approval</h1>

            <div className="overflow-x-auto border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#4A4A4A] text-white">
                    <th className="text-left px-3 py-3 border border-gray-500">Provider</th>
                    <th className="text-left px-3 py-3 border border-gray-500">Tariff Type</th>
                    <th className="text-left px-3 py-3 border border-gray-500">Tariff File</th>
                    <th className="text-left px-3 py-3 border border-gray-500">Status</th>
                    <th className="text-left px-3 py-3 border border-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-500 border border-gray-200">
                        Loading MSA approvals...
                      </td>
                    </tr>
                  ) : tariffPlans.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-500 border border-gray-200">
                        No pending MSA approvals.
                      </td>
                    </tr>
                  ) : (
                    tariffPlans.map((plan: any) => (
                      <tr key={plan.id}>
                        <td className="px-3 py-3 border border-gray-200">{plan.provider?.facility_name || "Unknown"}</td>
                        <td className="px-3 py-3 border border-gray-200">{plan.is_customized ? "Custom" : "Default"}</td>
                        <td className="px-3 py-3 border border-gray-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/provider/tariff-plans/${plan.id}/approve?returnTo=${encodeURIComponent("/executive-desk/msa-approval")}`
                              )
                            }
                          >
                            View
                          </Button>
                        </td>
                        <td className="px-3 py-3 border border-gray-200">
                          <Badge className="bg-violet-600 text-white">Awaiting MD Approval</Badge>
                        </td>
                        <td className="px-3 py-3 border border-gray-200">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleOpenActionModal(plan, "approve")}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleOpenActionModal(plan, "reject")}
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {actionModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {actionType === "approve" ? "Approve and Send MSA" : "Reject MSA Request"}
                </h2>
                <p className="text-sm text-gray-600">
                  Provider: {actionPlan?.provider?.facility_name || "Unknown"}
                </p>

                <div className="space-y-2">
                  <Label htmlFor="msa-comment">Comment (optional)</Label>
                  <Textarea
                    id="msa-comment"
                    rows={4}
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    placeholder={
                      actionType === "approve"
                        ? "Optional comment to include with approval..."
                        : "Optional rejection reason (defaults if left blank)..."
                    }
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionModalOpen(false)
                      setActionPlan(null)
                      setActionComment("")
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitAction}
                    className={actionType === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
                    variant={actionType === "approve" ? "default" : "destructive"}
                    disabled={approveRejectMutation.isPending}
                  >
                    {approveRejectMutation.isPending
                      ? "Submitting..."
                      : actionType === "approve"
                        ? "Approve and Send MSA"
                        : "Reject"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}

