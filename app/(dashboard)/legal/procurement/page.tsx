"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusIndicator } from "@/components/ui/status-indicator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Download,
  Filter,
  Calendar,
  Eye,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  ShoppingCart,
  MoreHorizontal,
  Search,
  FileText,
  Paperclip,
  Upload
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { FONT_CLASSES } from "@/lib/font-utils"
import { FileViewerModal } from "@/components/ui/file-viewer-modal"

interface Invoice {
  id: string
  invoice_number: string
  service_type: string
  department: string
  generated_by: string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'
  description?: string
  attachment_url?: string
  attachment_name?: string
  created_at: string
  updated_at: string
}

export default function ProcurementPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [fileViewer, setFileViewer] = useState<{ url: string; name: string } | null>(null)
  
  // Create invoice form state
  const [invoiceForm, setInvoiceForm] = useState({
    service_type: "",
    department: "",
    amount: "",
    description: ""
  })

  // Attachment state
  const [invoiceAttachment, setInvoiceAttachment] = useState<{ name: string; url: string; size: number } | null>(null)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch departments for invoice creation
  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/hr/departments")
      if (!res.ok) {
        throw new Error("Failed to fetch departments")
      }
      return res.json()
    },
  })

  // Fetch invoices
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ["procurement-invoices", currentPage, limit, debouncedSearchTerm, selectedStatus, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })
      
      const res = await fetch(`/api/hr/procurement?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch invoices")
      }
      return res.json()
    },
  })

  const invoices = invoicesData?.invoices || []
  const pagination = invoicesData?.pagination
  const departments = departmentsData?.departments || []

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: any) => {
      const res = await fetch('/api/hr/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      })
      if (!res.ok) {
        throw new Error('Failed to create invoice')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["procurement-invoices"] })
      setShowCreateModal(false)
      setInvoiceForm({
        service_type: "",
        department: "",
        amount: "",
        description: ""
      })
      setInvoiceAttachment(null)
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      })
    },
  })

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/hr/procurement/${invoiceId}/mark-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        throw new Error('Failed to mark invoice as paid')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice marked as paid successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["procurement-invoices"] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark invoice as paid",
        variant: "destructive",
      })
    },
  })

  const handleExportExcel = () => {
    // TODO: Implement Excel export
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowViewModal(true)
  }

  const handleMarkAsPaid = (invoiceId: string) => {
    if (window.confirm("Are you sure you want to mark this invoice as paid?")) {
      markAsPaidMutation.mutate(invoiceId)
    }
  }

  const handleCreateInvoice = () => {
    if (!invoiceForm.service_type || !invoiceForm.department || !invoiceForm.amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    createInvoiceMutation.mutate({ ...invoiceForm, attachment: invoiceAttachment })
  }

  // Main component render
  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Procurement</h1>
            <p className="text-gray-600">Manage procurement requests and invoices</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setShowCreateModal(true)} className="bg-[#BE1522] hover:bg-[#9B1219] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Invoice
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search invoices..."
                    className="pl-9 max-w-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 border rounded-lg px-3 py-2 h-8">
                  <Calendar className="h-3 w-3 text-gray-500" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-0 p-0 h-auto text-xs w-28"
                  />
                </div>

                <Button className="bg-[#BE1522] hover:bg-[#9B1219] text-white h-8 px-3 text-xs" onClick={() => { setStartDate(""); setEndDate(""); setSelectedStatus("all"); setSearchTerm("") }}>
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">INVOICE NO.</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SERVICE TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DEPARTMENT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">GENERATED BY</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No invoices found
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices.map((invoice: Invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{invoice.service_type}</TableCell>
                          <TableCell>{invoice.department}</TableCell>
                          <TableCell>{invoice.generated_by}</TableCell>
                          <TableCell>₦{invoice.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <StatusIndicator status={invoice.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => handleViewInvoice(invoice)}
                                  className="w-full justify-start text-xs"
                                >
                                  View
                                </DropdownMenuItem>
                                {invoice.status === 'PENDING' && (
                                  <DropdownMenuItem
                                    onClick={() => handleMarkAsPaid(invoice.id)}
                                    disabled={markAsPaidMutation.isPending}
                                    className="w-full justify-start text-xs"
                                  >
                                    Mark Paid
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.total > 0 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={pagination.page === 1}
                        className="text-xs"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                        disabled={pagination.page === pagination.pages}
                        className="text-xs"
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

        {/* View Invoice Modal */}
        {showViewModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Invoice Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowViewModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Invoice Number</label>
                    <p className="text-lg font-semibold">{selectedInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <StatusIndicator status={selectedInvoice.status} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Service Type</label>
                    <p>{selectedInvoice.service_type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Department</label>
                    <p>{selectedInvoice.department}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Generated By</label>
                    <p>{selectedInvoice.generated_by}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Amount</label>
                    <p className="text-lg font-semibold text-green-600">₦{selectedInvoice.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Created Date</label>
                    <p>{new Date(selectedInvoice.created_at).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Description</label>
                    <p>{selectedInvoice.description || 'N/A'}</p>
                  </div>
                  {selectedInvoice.attachment_url && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-600">Attachment</label>
                      <button
                        onClick={() => setFileViewer({ url: selectedInvoice.attachment_url!, name: selectedInvoice.attachment_name || 'Attachment' })}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm mt-1 text-left"
                      >
                        <Paperclip className="h-4 w-4" />
                        {selectedInvoice.attachment_name || 'View Attachment'}
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create Invoice Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Create New Invoice</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Generate a new procurement invoice</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Service Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Service Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Select service *</label>
                      <Select value={invoiceForm.service_type} onValueChange={(value) => setInvoiceForm(prev => ({ ...prev, service_type: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="office_supplies">Office Supplies</SelectItem>
                          <SelectItem value="equipment">Equipment</SelectItem>
                          <SelectItem value="software">Software</SelectItem>
                          <SelectItem value="consulting">Consulting</SelectItem>
                          <SelectItem value="travel">Travel</SelectItem>
                          <SelectItem value="training">Training</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Select Department *</label>
                      <Select value={invoiceForm.department} onValueChange={(value) => setInvoiceForm(prev => ({ ...prev, department: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.name}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Amount and Description */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Amount & Description</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Amount *</label>
                      <Input
                        placeholder="Enter amount"
                        value={invoiceForm.amount}
                        onChange={(e) => setInvoiceForm(prev => ({ ...prev, amount: e.target.value }))}
                        type="number"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description (optional)</label>
                      <Input
                        placeholder="Enter description"
                        value={invoiceForm.description}
                        onChange={(e) => setInvoiceForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Attachment */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Attachment (optional)</h3>
                  {invoiceAttachment ? (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Paperclip className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-700 truncate">{invoiceAttachment.name}</p>
                        <p className="text-xs text-gray-400">{(invoiceAttachment.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setInvoiceAttachment(null)} className="text-gray-400 hover:text-red-500 p-1">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all ${isUploadingAttachment ? "opacity-60 cursor-not-allowed border-gray-200" : "border-blue-200 hover:border-blue-400 hover:bg-blue-50/30"}`}>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                        disabled={isUploadingAttachment}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 5 * 1024 * 1024) {
                            toast({ title: "Error", description: "File must be smaller than 5 MB", variant: "destructive" })
                            return
                          }
                          setIsUploadingAttachment(true)
                          try {
                            const fd = new FormData()
                            fd.append("file", file)
                            fd.append("folder", "procurement")
                            const res = await fetch("/api/hr/procurement/upload", { method: "POST", body: fd })
                            if (!res.ok) throw new Error("Upload failed")
                            const data = await res.json()
                            setInvoiceAttachment({ name: file.name, url: data.url, size: file.size })
                          } catch {
                            toast({ title: "Upload Error", description: "Failed to upload file", variant: "destructive" })
                          } finally {
                            setIsUploadingAttachment(false)
                            e.target.value = ""
                          }
                        }}
                      />
                      <Upload className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-blue-600 font-medium">{isUploadingAttachment ? "Uploading..." : "Click to attach a supporting document"}</span>
                      <span className="text-xs text-gray-400">PDF, images, Word · max 5 MB</span>
                    </label>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateInvoice}
                    disabled={createInvoiceMutation.isPending}
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                  >
                    {createInvoiceMutation.isPending ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {fileViewer && (
        <FileViewerModal
          url={fileViewer.url}
          name={fileViewer.name}
          isOpen={!!fileViewer}
          onClose={() => setFileViewer(null)}
        />
      )}
    </>
  )
}
