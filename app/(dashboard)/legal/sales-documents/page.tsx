"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Eye, Download } from "lucide-react"
import Link from "next/link"
import { DocumentViewer } from "@/components/legal/document-viewer"
import { LegalDocumentType } from "@prisma/client"
import {

export const dynamic = 'force-dynamic'
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function SalesDocumentsPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [selectedDocument, setSelectedDocument] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["sales-documents", page, search, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        status: "APPROVED", // Only approved documents for sales team
        ...(search && { search }),
        ...(typeFilter !== "all" && { document_type: typeFilter }),
      })
      const res = await fetch(`/api/legal/documents?${params}`)
      if (!res.ok) throw new Error("Failed to fetch documents")
      return res.json()
    },
  })

  const documents = data?.data?.documents || []
  const pagination = data?.data?.pagination

  const getTypeLabel = (type: LegalDocumentType) => {
    return type.replace(/_/g, " ")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Company Documents</h1>
        <p className="text-muted-foreground">
          View and download approved company documents for bid submissions and tenders
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Approved Documents</CardTitle>
              <CardDescription>All approved legal documents and certificates</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CAC_DOCUMENT">CAC Document</SelectItem>
                  <SelectItem value="COMPLIANCE_CERTIFICATE">Compliance Certificate</SelectItem>
                  <SelectItem value="LICENSE">License</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No approved documents found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc: any) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono text-sm">{doc.document_id}</TableCell>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell>{getTypeLabel(doc.document_type)}</TableCell>
                      <TableCell>
                        {new Date(doc.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDocument(doc)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>{doc.title}</DialogTitle>
                                <DialogDescription>
                                  Document ID: {doc.document_id}
                                </DialogDescription>
                              </DialogHeader>
                              <DocumentViewer fileUrl={doc.file_url} title={doc.title} />
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement("a")
                              link.href = doc.file_url
                              link.download = doc.title || "document"
                              link.target = "_blank"
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((page - 1) * pagination.limit) + 1} to{" "}
                    {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}{" "}
                    documents
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

