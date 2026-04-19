"use client"

import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, ExternalLink } from "lucide-react"
import Link from "next/link"
import { ReportStatusBadge } from "@/components/sales/report-status-badge"
import { WorkflowActions } from "@/components/sales/workflow-actions"
import { PermissionGate } from "@/components/ui/permission-gate"
import { SalesReportStatus } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useFileUpload } from "@/hooks/use-file-upload"

export default function SpecialRisksSalesReportDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { uploadSingleFile, isUploading: isUploadingFile } = useFileUpload({
    folder: "sales-reports",
    resourceType: "auto",
  })

  const [finalCopyFile, setFinalCopyFile] = useState<File | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["special-risks-sales-report", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/sales/reports/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch report")
      return res.json()
    },
  })

  const report = data?.data

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sales/reports/${params.id}/submit`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to submit report")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Report has been submitted successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ["special-risks-sales-report", params.id] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const vetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sales/reports/${params.id}/vet`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to vet report")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Report vetted",
        description: "Report has been vetted successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ["special-risks-sales-report", params.id] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sales/reports/${params.id}/approve`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to approve report")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Report approved",
        description: "Report has been approved successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ["special-risks-sales-report", params.id] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const uploadFinalMutation = useMutation({
    mutationFn: async (fileUrl: string) => {
      const res = await fetch(`/api/sales/reports/${params.id}/upload-final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final_copy_url: fileUrl }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to upload final copy")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Final copy uploaded",
        description: "Final copy has been uploaded successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ["special-risks-sales-report", params.id] })
      setFinalCopyFile(null)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleUploadFinal = async () => {
    if (!finalCopyFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      })
      return
    }

    try {
      const uploadResult = await uploadSingleFile(finalCopyFile)
      await uploadFinalMutation.mutateAsync(uploadResult.secure_url)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!report) {
    return <div className="text-center py-8">Report not found</div>
  }

  const getAchievementColor = () => {
    const achievement = Number(report.achievement)
    if (achievement < 80) return "text-red-600"
    if (achievement <= 100) return "text-yellow-600"
    return "text-green-600"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sales/special-risks/reports">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{report.title}</h1>
          <p className="text-muted-foreground">Report ID: {report.report_id}</p>
        </div>
        <ReportStatusBadge status={report.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Report Type</p>
                  <p className="text-lg">{report.report_type.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Region</p>
                  <p className="text-lg">{report.region?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Branch</p>
                  <p className="text-lg">{report.branch?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">State</p>
                  <p className="text-lg">{report.branch?.state || report.state || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Period</p>
                  <p className="text-lg">
                    {new Date(report.report_period).toLocaleDateString()}
                    {report.report_period_end &&
                      ` - ${new Date(report.report_period_end).toLocaleDateString()}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sales Amount</p>
                  <p className="text-lg font-semibold">
                    {Number(report.sales_amount).toLocaleString("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Target Amount</p>
                  <p className="text-lg font-semibold">
                    {Number(report.target_amount).toLocaleString("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Achievement</p>
                  <p className={`text-lg font-bold ${getAchievementColor()}`}>
                    {Number(report.achievement).toFixed(2)}%
                  </p>
                </div>
              </div>

              {report.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{report.notes}</p>
                </div>
              )}

              {report.final_copy_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Final Copy</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={report.final_copy_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Final Copy
                    </a>
                    <a
                      href={report.final_copy_url}
                      download
                      className="flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </div>
                </div>
              )}

              {report.supporting_documents && Array.isArray(report.supporting_documents) && report.supporting_documents.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Supporting Documents</p>
                  <div className="space-y-2">
                    {report.supporting_documents.map((url: string, index: number) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Document {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.submitted_by && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Submitted By</p>
                  <p className="text-sm">
                    {report.submitted_by.first_name} {report.submitted_by.last_name} (
                    {report.submitted_by.email})
                  </p>
                  {report.submitted_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.submitted_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {report.vetted_by && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vetted By</p>
                  <p className="text-sm">
                    {report.vetted_by.first_name} {report.vetted_by.last_name} (
                    {report.vetted_by.email})
                  </p>
                  {report.vetted_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.vetted_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {report.approved_by && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Approved By</p>
                  <p className="text-sm">
                    {report.approved_by.first_name} {report.approved_by.last_name} (
                    {report.approved_by.email})
                  </p>
                  {report.approved_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.approved_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowActions
                status={report.status}
                onSubmit={() => submitMutation.mutate()}
                onVet={() => vetMutation.mutate()}
                onApprove={() => approveMutation.mutate()}
                onUploadFinal={handleUploadFinal}
                isSubmitting={submitMutation.isPending}
                isVetting={vetMutation.isPending}
                isApproving={approveMutation.isPending}
                isUploading={uploadFinalMutation.isPending || isUploadingFile}
              />
            </CardContent>
          </Card>

          {report.status === SalesReportStatus.APPROVED && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Final Copy</CardTitle>
                <CardDescription>Upload the final approved report document</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="final-copy">Select Final Copy File</Label>
                  <Input
                    id="final-copy"
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          toast({
                            title: "Error",
                            description: "File size must be less than 10MB",
                            variant: "destructive",
                          })
                          return
                        }
                        setFinalCopyFile(file)
                      }
                    }}
                    disabled={uploadFinalMutation.isPending || isUploadingFile}
                  />
                  {finalCopyFile && (
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{finalCopyFile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFinalCopyFile(null)}
                        disabled={uploadFinalMutation.isPending || isUploadingFile}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleUploadFinal}
                  disabled={!finalCopyFile || uploadFinalMutation.isPending || isUploadingFile}
                  className="w-full"
                >
                  {isUploadingFile || uploadFinalMutation.isPending
                    ? "Uploading..."
                    : "Upload Final Copy"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
