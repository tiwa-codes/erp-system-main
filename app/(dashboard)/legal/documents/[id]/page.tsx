"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, FileCheck, Edit } from "lucide-react"
import Link from "next/link"
import { WorkflowStatusBadge } from "@/components/legal/workflow-status-badge"
import { DocumentViewer } from "@/components/legal/document-viewer"
import { SignatureCapture } from "@/components/ui/signature-capture"
import { PermissionGate } from "@/components/ui/permission-gate"
import { LegalDocumentStatus } from "@prisma/client"
import {

export const dynamic = 'force-dynamic'
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function LegalDocumentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showSignatureDialog, setShowSignatureDialog] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["legal-document", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/legal/documents/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch document")
      return res.json()
    },
  })

  const document = data?.data

  const vetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/legal/documents/${params.id}/vet`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to vet document")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-document", params.id] })
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] })
      toast({
        title: "Success",
        description: "Document vetted successfully",
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
      const res = await fetch(`/api/legal/documents/${params.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_image_url: signatureImageUrl,
          signature_data: signatureData,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to approve document")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-document", params.id] })
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] })
      toast({
        title: "Success",
        description: "Document approved successfully",
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

  if (!document) {
    return <div className="text-center py-8">Document not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/legal/documents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{document.title}</h1>
          <p className="text-muted-foreground">Document ID: {document.document_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <WorkflowStatusBadge status={document.status} />
          {document.status === "DRAFT" && (
            <PermissionGate permission="legal:edit">
              <Link href={`/legal/documents/${document.id}/edit`}>
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
              <CardTitle>Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Document Type</p>
                <p className="font-medium">{document.document_type.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Title</p>
                <p className="font-medium">{document.title}</p>
              </div>
              {document.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{document.description}</p>
                </div>
              )}
              {document.compliance_certificate_type && (
                <div>
                  <p className="text-sm text-muted-foreground">Compliance Certificate Type</p>
                  <p className="font-medium">
                    {document.compliance_certificate_type.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {document.expiry_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Expiry Date</p>
                  <p className="font-medium">
                    {new Date(document.expiry_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <DocumentViewer fileUrl={document.file_url} title={document.title} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {document.status === "DRAFT" && (
                <PermissionGate permission="legal:vet">
                  <Button
                    onClick={() => vetMutation.mutate()}
                    disabled={vetMutation.isPending}
                    className="w-full"
                  >
                    <FileCheck className="h-4 w-4 mr-1" />
                    {vetMutation.isPending ? "Vetting..." : "Vet Document"}
                  </Button>
                </PermissionGate>
              )}

              {document.status === "VETTED" && (
                <PermissionGate permission="legal:approve">
                  <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve Document
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Approve Document</DialogTitle>
                        <DialogDescription>
                          Please sign below to approve this document
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
                  {document.created_by
                    ? `${document.created_by.first_name} ${document.created_by.last_name}`
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(document.created_at).toLocaleString()}
                </p>
              </div>
              {document.vetted_by && (
                <div>
                  <p className="text-sm text-muted-foreground">Vetted By</p>
                  <p className="font-medium">
                    {`${document.vetted_by.first_name} ${document.vetted_by.last_name}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {document.vetted_at
                      ? new Date(document.vetted_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              )}
              {document.approved_by && (
                <div>
                  <p className="text-sm text-muted-foreground">Approved By</p>
                  <p className="font-medium">
                    {`${document.approved_by.first_name} ${document.approved_by.last_name}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {document.approved_at
                      ? new Date(document.approved_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {document.signatures && document.signatures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Signatures</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {document.signatures.map((signature: any) => (
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

