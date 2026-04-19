"use client"

import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useToast } from "@/hooks/use-toast"

export default function TariffNegotiationPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject">("approve")
  const [actionPlan, setActionPlan] = useState<any>(null)
  const [actionComment, setActionComment] = useState("")

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pending-tariff-plans", "UNDERWRITING"],
    queryFn: async () => {
      const res = await fetch("/api/provider/tariff-plans/pending?stage=UNDERWRITING")
      if (!res.ok) throw new Error("Failed to fetch tariff negotiations")
      return res.json()
    },
  })

  const tariffPlans = data?.tariffPlans || []

  const uploadCjhmoTariffMutation = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/provider/tariff-plan/bulk-upload", {
        method: "POST",
        body: formData,
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Failed to upload tariff")
      return payload
    },
    onSuccess: (payload) => {
      const warnings = Array.isArray(payload?.warnings) ? payload.warnings : []
      toast({
        title: warnings.length > 0 ? "Upload completed with warnings" : "Upload successful",
        description: payload?.message || "CJHMO tariff uploaded successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["pending-tariff-plans", "UNDERWRITING"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const approveRejectMutation = useMutation({
    mutationFn: async ({ planId, action, comment }: { planId: string; action: "approve" | "reject"; comment?: string }) => {
      if (action === "approve") {
        const res = await fetch(`/api/provider/tariff-plan/${planId}/approve/underwriting`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comments: comment || undefined }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.error || "Failed to approve tariff")
        return payload
      }

      const res = await fetch(`/api/provider/tariff-plan/${planId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: comment || "Rejected during tariff negotiation" }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Failed to reject tariff")
      return payload
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.action === "approve" ? "Tariff approved" : "Tariff rejected",
        description:
          variables.action === "approve"
            ? "Tariff moved to MSA Approval."
            : "Tariff returned to Provider module with rejection reason.",
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
    if (actionType === "reject" && !actionComment.trim()) {
      toast({
        title: "Comment required",
        description: "Please provide rejection reason",
        variant: "destructive",
      })
      return
    }

    approveRejectMutation.mutate({
      planId: actionPlan.id,
      action: actionType,
      comment: actionComment.trim() || undefined,
    })
  }

  const handleUploadClick = () => {
    setSelectedUploadFile(null)
    setUploadModalOpen(true)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedUploadFile(file)
  }

  const handleSubmitUpload = () => {
    if (!selectedUploadFile) {
      toast({
        title: "No file selected",
        description: "Choose an Excel file to upload.",
        variant: "destructive",
      })
      return
    }

    uploadCjhmoTariffMutation.mutate(
      { file: selectedUploadFile },
      {
        onSuccess: () => {
          setUploadModalOpen(false)
          setSelectedUploadFile(null)
          if (fileInputRef.current) fileInputRef.current.value = ""
        },
      }
    )
  }

  const handleDownloadSample = () => {
    window.location.href = "/api/provider/tariff-plan/upload-sample"
  }

  const handleViewCjhmoTariff = async () => {
    try {
      const res = await fetch(`/api/provider/cjhmo-tariff/download`)
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "No uploaded CJHMO tariff file found")
      }

      const blob = await res.blob()
      const disposition = res.headers.get("content-disposition") || ""
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i)
      const filename = match?.[1] || "cjhmo-tariff.xlsx"

      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast({
        title: "Unable to view tariff",
        description: error instanceof Error ? error.message : "Failed to download tariff file",
        variant: "destructive",
      })
    }
  }

  return (
    <PermissionGate module="provider" action="approve_tariff_plan">
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h1 className="text-4xl font-semibold text-gray-900">Tariff Negotiation</h1>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <Button variant="outline" onClick={handleUploadClick} disabled={uploadCjhmoTariffMutation.isPending}>
                  {uploadCjhmoTariffMutation.isPending ? "Uploading..." : "Upload CJHMO Tariff"}
                </Button>
                <Button variant="outline" onClick={handleViewCjhmoTariff}>
                  View CJHMO Tariff
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#4A4A4A] text-white">
                    <th className="text-left px-3 py-3 border border-gray-500">Provider</th>
                    <th className="text-left px-3 py-3 border border-gray-500">Custom Tariff</th>
                    <th className="text-left px-3 py-3 border border-gray-500">Date</th>
                    <th className="text-left px-3 py-3 border border-gray-500">Status</th>
                    <th className="text-left px-3 py-3 border border-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-500 border border-gray-200">
                        Loading negotiations...
                      </td>
                    </tr>
                  ) : tariffPlans.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-500 border border-gray-200">
                        No pending tariff negotiations.
                      </td>
                    </tr>
                  ) : (
                    tariffPlans.map((plan: any) => (
                      <tr key={plan.id}>
                        <td className="px-3 py-3 border border-gray-200">{plan.provider?.facility_name || "Unknown"}</td>
                        <td className="px-3 py-3 border border-gray-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/provider/tariff-plans/${plan.id}/approve?returnTo=${encodeURIComponent("/provider/tariff-negotiation")}`
                              )
                            }
                          >
                            View
                          </Button>
                        </td>
                        <td className="px-3 py-3 border border-gray-200">
                          {plan.submitted_at ? format(new Date(plan.submitted_at), "dd MMM yyyy") : "N/A"}
                        </td>
                        <td className="px-3 py-3 border border-gray-200">
                          <Badge className="bg-yellow-500 text-black">Pending</Badge>
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
                  {actionType === "approve" ? "Approve Custom Tariff" : "Reject Custom Tariff"}
                </h2>
                <p className="text-sm text-gray-600">
                  Provider: {actionPlan?.provider?.facility_name || "Unknown"}
                </p>

                <div className="space-y-2">
                  <Label htmlFor="negotiation-comment">
                    {actionType === "approve" ? "Comment (optional, visible to next level)" : "Rejection reason (required)"}
                  </Label>
                  <Textarea
                    id="negotiation-comment"
                    rows={4}
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    placeholder={
                      actionType === "approve"
                        ? "Add negotiation note for Executive Desk..."
                        : "Provide reason for rejection to provider..."
                    }
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionModalOpen(false)
                      setActionComment("")
                      setActionPlan(null)
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
                    {approveRejectMutation.isPending ? "Submitting..." : actionType === "approve" ? "Approve" : "Reject"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {uploadModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Upload CJHMO Tariff</h2>
                <p className="text-sm text-gray-600">
                  Upload a universal tariff file with two columns: Service Name and Service Price.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Browse File
                  </Button>
                  <Button variant="outline" onClick={handleDownloadSample}>
                    Download Sample File
                  </Button>
                </div>

                {selectedUploadFile && (
                  <div className="text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-md p-3">
                    {selectedUploadFile.name}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadModalOpen(false)
                      setSelectedUploadFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitUpload} disabled={uploadCjhmoTariffMutation.isPending}>
                    {uploadCjhmoTariffMutation.isPending ? "Uploading..." : "Upload"}
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
