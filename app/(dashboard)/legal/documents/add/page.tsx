"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
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
import { LegalDocumentType, ComplianceCertificateType } from "@prisma/client"



export default function AddLegalDocumentPage() {
  const router = useRouter()
  const { toast } = useToast()

  const { uploadSingleFile, isUploading: isUploadingFile } = useFileUpload({
    folder: "legal-documents",
    resourceType: "auto",
  })

  const [form, setForm] = useState({
    document_type: "" as LegalDocumentType | "",
    title: "",
    description: "",
    compliance_certificate_type: "" as ComplianceCertificateType | "",
    expiry_date: "",
  })

  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState("")

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/legal/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create document")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document created successfully",
      })
      router.push("/legal/documents")
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
      setFileUrl(result.secure_url)
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

    if (!fileUrl) {
      toast({
        title: "Error",
        description: "Please upload a document file",
        variant: "destructive",
      })
      return
    }

    const payload: any = {
      document_type: form.document_type,
      title: form.title,
      description: form.description,
      file_url: fileUrl,
    }

    if (form.document_type === "COMPLIANCE_CERTIFICATE" && form.compliance_certificate_type) {
      payload.compliance_certificate_type = form.compliance_certificate_type
    }

    if (form.document_type === "LICENSE" && form.expiry_date) {
      payload.expiry_date = new Date(form.expiry_date).toISOString()
    }

    createMutation.mutate(payload)
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
        <div>
          <h1 className="text-3xl font-bold">Add Document</h1>
          <p className="text-muted-foreground">Upload a new legal document</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Document Information</CardTitle>
            <CardDescription>Enter document details and upload the file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="document_type">Document Type *</Label>
              <Select
                value={form.document_type}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, document_type: value as LegalDocumentType }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAC_DOCUMENT">CAC Document</SelectItem>
                  <SelectItem value="COMPLIANCE_CERTIFICATE">Compliance Certificate</SelectItem>
                  <SelectItem value="LICENSE">License</SelectItem>
                </SelectContent>
              </Select>
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

            {form.document_type === "COMPLIANCE_CERTIFICATE" && (
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

            {form.document_type === "LICENSE" && (
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
              <Label>Document File *</Label>
              <FileUpload
                onUpload={handleFileUpload}
                onRemove={() => {
                  setDocumentFile(null)
                  setFileUrl("")
                }}
                acceptedTypes={["image/*", "application/pdf"]}
                maxFiles={1}
                folder="legal-documents"
                resourceType="auto"
                disabled={isUploadingFile}
              />
              {fileUrl && (
                <p className="text-sm text-green-600">File uploaded successfully</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={createMutation.isPending || isUploadingFile || !fileUrl}
              >
                <Save className="h-4 w-4 mr-1" />
                {createMutation.isPending ? "Saving..." : "Save as Draft"}
              </Button>
              <Link href="/legal/documents">
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

