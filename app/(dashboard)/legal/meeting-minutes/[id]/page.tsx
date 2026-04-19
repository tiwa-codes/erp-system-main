"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle, FileCheck, Edit, Download } from "lucide-react"
import Link from "next/link"
import { WorkflowStatusBadge } from "@/components/legal/workflow-status-badge"
import { SignatureCapture } from "@/components/ui/signature-capture"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function MeetingMinutesDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showSignatureDialog, setShowSignatureDialog] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["meeting-minutes", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/legal/meeting-minutes/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch meeting minutes")
      return res.json()
    },
  })

  const meeting = data?.data

  const vetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/legal/meeting-minutes/${params.id}/vet`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to vet meeting minutes")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes", params.id] })
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] })
      toast({
        title: "Success",
        description: "Meeting minutes vetted successfully",
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

  const approveMutation = useMutation({
    mutationFn: async (signatureImageUrl: string, signatureData?: any) => {
      const res = await fetch(`/api/legal/meeting-minutes/${params.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_image_url: signatureImageUrl,
          signature_data: signatureData,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to approve meeting minutes")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes", params.id] })
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] })
      toast({
        title: "Success",
        description: "Meeting minutes approved successfully",
      })
      setShowSignatureDialog(false)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleSignatureSave = (signatureImageUrl: string, signatureData?: any) => {
    approveMutation.mutate(signatureImageUrl, signatureData)
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!meeting) {
    return <div className="text-center py-8">Meeting minutes not found</div>
  }

  const attendees = Array.isArray(meeting.attendees) ? meeting.attendees : []
  const attachments = Array.isArray(meeting.attachments) ? meeting.attachments : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/legal/meeting-minutes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{meeting.title}</h1>
          <p className="text-muted-foreground">Meeting ID: {meeting.meeting_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <WorkflowStatusBadge status={meeting.status} />
          {meeting.status === "DRAFT" && (
            <PermissionGate permission="legal:edit">
              <Link href={`/legal/meeting-minutes/${meeting.id}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </Link>
            </PermissionGate>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Meeting Type</p>
                <p className="font-medium">{meeting.meeting_type.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meeting Date</p>
                <p className="font-medium">
                  {new Date(meeting.meeting_date).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Title</p>
                <p className="font-medium">{meeting.title}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendees</CardTitle>
            </CardHeader>
            <CardContent>
              {attendees.length > 0 ? (
                <ul className="space-y-2">
                  {attendees.map((attendee: any, index: number) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="font-medium">{attendee.name}</span>
                      {attendee.email && (
                        <span className="text-sm text-muted-foreground">({attendee.email})</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No attendees listed</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meeting Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{meeting.meeting_notes}</div>
            </CardContent>
          </Card>

          {attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attachments.map((url: string, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Attachment {index + 1}
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(url, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {meeting.status === "DRAFT" && (
                <PermissionGate permission="legal:vet">
                  <Button
                    onClick={() => vetMutation.mutate()}
                    disabled={vetMutation.isPending}
                    className="w-full"
                  >
                    <FileCheck className="h-4 w-4 mr-1" />
                    {vetMutation.isPending ? "Vetting..." : "Vet Meeting Minutes"}
                  </Button>
                </PermissionGate>
              )}

              {meeting.status === "VETTED" && (
                <PermissionGate permission="legal:approve">
                  <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve Meeting Minutes
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Approve Meeting Minutes</DialogTitle>
                        <DialogDescription>
                          Please sign below to approve this meeting minutes
                        </DialogDescription>
                      </DialogHeader>
                      <SignatureCapture
                        onSave={handleSignatureSave}
                        onCancel={() => setShowSignatureDialog(false)}
                        disabled={approveMutation.isPending}
                      />
                    </DialogContent>
                  </Dialog>
                </PermissionGate>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Created By</p>
                <p className="font-medium">
                  {meeting.created_by
                    ? `${meeting.created_by.first_name} ${meeting.created_by.last_name}`
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(meeting.created_at).toLocaleString()}
                </p>
              </div>
              {meeting.vetted_by && (
                <div>
                  <p className="text-sm text-muted-foreground">Vetted By</p>
                  <p className="font-medium">
                    {`${meeting.vetted_by.first_name} ${meeting.vetted_by.last_name}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {meeting.vetted_at
                      ? new Date(meeting.vetted_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              )}
              {meeting.approved_by && (
                <div>
                  <p className="text-sm text-muted-foreground">Approved By</p>
                  <p className="font-medium">
                    {`${meeting.approved_by.first_name} ${meeting.approved_by.last_name}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {meeting.approved_at
                      ? new Date(meeting.approved_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {meeting.signatures && meeting.signatures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Signatures</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {meeting.signatures.map((signature: any) => (
                  <div key={signature.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">
                        {signature.signer
                          ? `${signature.signer.first_name} ${signature.signer.last_name}`
                          : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(signature.signed_at).toLocaleString()}
                      </p>
                    </div>
                    <img
                      src={signature.signature_image_url}
                      alt="Signature"
                      className="w-full h-24 object-contain border rounded"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

