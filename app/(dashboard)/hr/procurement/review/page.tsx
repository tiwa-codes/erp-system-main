"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusText } from "@/components/ui/status-text"
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
  CheckCircle,
  Clock,
  XCircle,
  ShoppingCart,
  MoreHorizontal,
  ArrowRight,
  User,
  FileText
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"



interface Invoice {
  id: string
  date: string
  enrollee_id: string
  enrollee_name: string
  invoice_number: string
  plan_type: string
  plan_amount: number
  status: 'PENDING_INTERNAL_CONTROL' | 'PENDING_AUDIT' | 'PENDING_MD' | 'PENDING_FINANCE' | 'APPROVED' | 'REJECTED'
  due_date?: string
  paid_at?: string
  workflow_stage: 'INTERNAL_CONTROL' | 'AUDIT' | 'MD' | 'FINANCE'
  requested_by: string
  department: string
}

const WORKFLOW_STAGES = [
  { key: 'INTERNAL_CONTROL', name: 'Internal Control', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'AUDIT', name: 'Audit', color: 'bg-blue-100 text-blue-800' },
  { key: 'MD', name: 'MD', color: 'bg-purple-100 text-purple-800' },
  { key: 'FINANCE', name: 'Finance', color: 'bg-green-100 text-green-800' }
]

export default function InvoiceReviewPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedStage, setSelectedStage] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Debounce search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch invoices for review
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ["invoice-review", currentPage, limit, debouncedSearchTerm, selectedStatus, selectedStage, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedStage !== "all" && { stage: selectedStage }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })
      
      const res = await fetch(`/api/hr/procurement/review?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch invoices for review")
      }
      return res.json()
    },
  })

  const invoices = invoicesData?.invoices || []
  const pagination = invoicesData?.pagination

  // Approve invoice mutation
  const approveMutation = useMutation({
    mutationFn: async ({ invoiceId, stage }: { invoiceId: string, stage: string }) => {
      const res = await fetch(`/api/hr/procurement/review/${invoiceId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage })
      })
      if (!res.ok) {
        throw new Error('Failed to approve invoice')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice approved successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["invoice-review"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  // Reject invoice mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ invoiceId, reason }: { invoiceId: string, reason: string }) => {
      const res = await fetch(`/api/hr/procurement/review/${invoiceId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      if (!res.ok) {
        throw new Error('Failed to reject invoice')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice rejected successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["invoice-review"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  const handleApprove = async (invoiceId: string, currentStage: string) => {
    if (!confirm(`Approve this invoice for ${currentStage} stage?`)) return
    
    try {
      await approveMutation.mutateAsync({ invoiceId, stage: currentStage })
    } catch (error) {
      console.error('Error approving invoice:', error)
    }
  }

  const handleReject = async (invoiceId: string) => {
    const reason = prompt("Please provide a reason for rejection:")
    if (!reason) return
    
    try {
      await rejectMutation.mutateAsync({ invoiceId, reason })
    } catch (error) {
      console.error('Error rejecting invoice:', error)
    }
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowViewModal(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getNextStage = (currentStage: string) => {
    const stages = ['INTERNAL_CONTROL', 'AUDIT', 'MD', 'FINANCE']
    const currentIndex = stages.indexOf(currentStage)
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null
  }

  const getStageColor = (stage: string) => {
    const stageConfig = WORKFLOW_STAGES.find(s => s.key === stage)
    return stageConfig?.color || 'bg-gray-100 text-gray-800'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoice Review Workflow</h1>
          <p className="text-gray-600">Review and approve invoices through the workflow stages</p>
        </div>
      </div>

      {/* Workflow Stages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-blue-600">Workflow Stages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {WORKFLOW_STAGES.map((stage, index) => (
              <div key={stage.key} className="flex items-center">
                <div className={`px-3 py-2 rounded-lg text-xs font-medium ${stage.color}`}>
                  {stage.name}
                </div>
                {index < WORKFLOW_STAGES.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-gray-400 mx-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-blue-600">Filters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Search</label>
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING_INTERNAL_CONTROL">Pending Internal Control</SelectItem>
                    <SelectItem value="PENDING_AUDIT">Pending Audit</SelectItem>
                    <SelectItem value="PENDING_MD">Pending MD</SelectItem>
                    <SelectItem value="PENDING_FINANCE">Pending Finance</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Stage</label>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="INTERNAL_CONTROL">Internal Control</SelectItem>
                    <SelectItem value="AUDIT">Audit</SelectItem>
                    <SelectItem value="MD">MD</SelectItem>
                    <SelectItem value="FINANCE">Finance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={() => setCurrentPage(1)} className="bg-[#0891B2] hover:bg-[#9B1219] text-white w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Invoices for Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">INVOICE NO.</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">REQUESTED BY</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DEPARTMENT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">SERVICE TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">CURRENT STAGE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice: Invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-sm">{invoice.requested_by}</span>
                      </div>
                    </TableCell>
                    <TableCell>{invoice.department}</TableCell>
                    <TableCell>{invoice.plan_type}</TableCell>
                    <TableCell>{formatCurrency(invoice.plan_amount)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageColor(invoice.workflow_stage)}`}>
                        {WORKFLOW_STAGES.find(s => s.key === invoice.workflow_stage)?.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusText status={invoice.status} />
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
                            View Details
                          </DropdownMenuItem>
                          {invoice.status.startsWith('PENDING_') && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => handleApprove(invoice.id, invoice.workflow_stage)}
                                className="w-full justify-start text-xs"
                                disabled={approveMutation.isPending}
                              >
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleReject(invoice.id)}
                                className="text-red-600 hover:text-red-700 w-full justify-start text-xs"
                                disabled={rejectMutation.isPending}
                              >
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {pagination && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-xs text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="bg-[#0891B2] text-white">
                  {pagination.page}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                  disabled={pagination.page === pagination.pages || pagination.total === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Invoice Modal */}
      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Invoice Review Details</span>
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
                  <label className="text-sm font-medium text-gray-700">Invoice Number</label>
                  <p className="text-sm text-gray-900">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Date</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedInvoice.date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Requested By</label>
                  <p className="text-sm text-gray-900">{selectedInvoice.requested_by}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Department</label>
                  <p className="text-sm text-gray-900">{selectedInvoice.department}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Service Type</label>
                  <p className="text-sm text-gray-900">{selectedInvoice.plan_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Amount</label>
                  <p className="text-sm text-gray-900">{formatCurrency(selectedInvoice.plan_amount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Current Stage</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStageColor(selectedInvoice.workflow_stage)}`}>
                    {WORKFLOW_STAGES.find(s => s.key === selectedInvoice.workflow_stage)?.name}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <StatusText status={selectedInvoice.status} />
                </div>
              </div>
              
              {/* Workflow Progress */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Workflow Progress</h4>
                <div className="flex items-center justify-between">
                  {WORKFLOW_STAGES.map((stage, index) => {
                    const isCompleted = WORKFLOW_STAGES.findIndex(s => s.key === selectedInvoice.workflow_stage) > index
                    const isCurrent = stage.key === selectedInvoice.workflow_stage
                    
                    return (
                      <div key={stage.key} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          isCompleted ? 'bg-green-100 text-green-800' : 
                          isCurrent ? 'bg-blue-100 text-blue-800' : 
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                        </div>
                        <span className={`ml-2 text-xs ${isCurrent ? 'font-medium' : ''}`}>
                          {stage.name}
                        </span>
                        {index < WORKFLOW_STAGES.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-gray-400 mx-2" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
