"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUpload } from "@/components/ui/file-upload"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { useFileUpload } from "@/hooks/use-file-upload"
import { ComplianceCertificateType } from "@prisma/client"

export const dynamic = 'force-dynamic'

export default function EditLegalDocumentPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ["legal-document", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/legal/documents/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch document")
      return res.json()
    },
  })

  const document = data?.data

  const { uploadSingleFile, isUploading: isUploadingFile } = useFileUpload({
    folder: "legal-documents",
    resourceType: "auto",
  })

  const [form, setForm] = useState({
    title: "",
    description: "",
    compliance_certificate_type: "" as ComplianceCertificateType | "",
    expiry_date: "",
    file_url: "",
  })

  const [documentFile, setDocumentFile] = useState<File | null>(null)

  useEffect(() => {
    if (document) {
      setForm({
        title: document.title || "",
        description: document.description || "",
        compliance_certificate_type: document.compliance_certificate_type || "",
        expiry_date: document.expiry_date
          ? new Date(document.expiry_date).toISOString().split("T")[0]
          : "",
        file_url: document.file_url || "",
      })
    }
  }, [document])

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/legal/documents/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update document")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document updated successfully",
      })
      router.push(`/legal/documents/${params.id}`)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return
    const file = files[0]
    setDocumentFile(file)
    try {
      const result = await uploadSingleFile(file)
      setForm((prev) => ({ ...prev, file_url: result.secure_url }))
      toast({
        title: "Success",
        description: "File uploaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!document) return

    const payload: any = {
      title: form.title,
      description: form.description,
    }

    if (form.file_url) {
      payload.file_url = form.file_url
    }

    if (document.document_type === "COMPLIANCE_CERTIFICATE" && form.compliance_certificate_type) {
      payload.compliance_certificate_type = form.compliance_certificate_type
    }

    if (document.document_type === "LICENSE" && form.expiry_date) {
      payload.expiry_date = new Date(form.expiry_date).toISOString()
    }

    updateMutation.mutate(payload)
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!document) {
    return <div className="text-center py-8">Document not found</div>
  }

  if (document.status !== "DRAFT") {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Only draft documents can be edited
        </p>
        <Link href={`/legal/documents/${params.id}`}>
          <Button variant="outline">Back to Document</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/legal/documents/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Document</h1>
          <p className="text-muted-foreground">Update document information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Document Information</CardTitle>
            <CardDescription>Update document details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Input
                value={document.document_type.replace(/_/g, " ")}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter document title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter document description"
                rows={4}
              />
            </div>

            {document.document_type === "COMPLIANCE_CERTIFICATE" && (
              <div className="space-y-2">
                <Label htmlFor="compliance_certificate_type">Compliance Certificate Type</Label>
                <Select
                  value={form.compliance_certificate_type}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      compliance_certificate_type: value as ComplianceCertificateType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select certificate type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAX_CLEARANCE">Tax Clearance</SelectItem>
                    <SelectItem value="PENCOM">PENCOM</SelectItem>
                    <SelectItem value="NSITF">NSITF</SelectItem>
                    <SelectItem value="ITF">ITF</SelectItem>
                    <SelectItem value="BPP">BPP</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {document.document_type === "LICENSE" && (
              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiry_date: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Document File</Label>
              <FileUpload
                onUpload={handleFileUpload}
                onRemove={() => {
                  setDocumentFile(null)
                  setForm((prev) => ({ ...prev, file_url: "" }))
                }}
                acceptedTypes={["image/*", "application/pdf"]}
                maxFiles={1}
                folder="legal-documents"
                resourceType="auto"
                disabled={isUploadingFile}
              />
              {form.file_url && (
                <p className="text-sm text-green-600">File uploaded successfully</p>
              )}
              {!form.file_url && document.file_url && (
                <p className="text-sm text-muted-foreground">
                  Current file: <a href={document.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View current file</a>
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={updateMutation.isPending || isUploadingFile}>
                <Save className="h-4 w-4 mr-1" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Link href={`/legal/documents/${params.id}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

