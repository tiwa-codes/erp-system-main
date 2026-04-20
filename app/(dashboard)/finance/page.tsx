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
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  DollarSign,
  FileText,
  TrendingUp,
  Users,
  Download,
  Filter,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  XCircle,
  MoreHorizontal
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { exportToExcel, exportToPDF } from "@/lib/export-utils"



interface FinanceMetrics {
  pending_invoices: number
  pending_payout: number
  premium_received: number
  claims_settlement: number
}

interface Invoice {
  id: string
  date: string
  enrollee_id: string
  enrollee_name: string
  invoice_number: string
  plan_type: string
  plan_amount: number
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
}

export default function FinanceDashboardPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedOrganization, setSelectedOrganization] = useState("all")
  const [selectedPlan, setSelectedPlan] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  
  // Create invoice form state
  const [invoiceForm, setInvoiceForm] = useState({
    enrollee_id: "",
    enrollee_name: "",
    plan_id: "",
    plan_type: "",
    plan_amount: "",
    due_date: ""
  })

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Handle organization change - reset plan selection
  const handleOrganizationChange = (value: string) => {
    setSelectedOrganization(value)
    setSelectedPlan('all') // Reset plan when organization changes
  }

  // Fetch finance metrics
  const { data: metricsData } = useQuery({
    queryKey: ["finance-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/finance/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch finance metrics")
      }
      return res.json()
    },
  })

  // Fetch organizations for filter
  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations")
      if (!res.ok) {
        throw new Error("Failed to fetch organizations")
      }
      return res.json()
    },
  })

  // Fetch plans for invoice creation and filter
  const { data: plansData } = useQuery({
    queryKey: ["plans", selectedOrganization],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedOrganization !== 'all') {
        params.append('organizationId', selectedOrganization)
      }
      
      const res = await fetch(`/api/underwriting/plans?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch plans")
      }
      return res.json()
    },
  })

  // Fetch enrollees for invoice creation
  const { data: enrolleesData } = useQuery({
    queryKey: ["enrollees"],
    queryFn: async () => {
      const res = await fetch("/api/finance/enrollees")
      if (!res.ok) {
        throw new Error("Failed to fetch enrollees")
      }
      return res.json()
    },
  })

  // Fetch invoices
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ["invoices", currentPage, limit, debouncedSearchTerm, selectedOrganization, selectedPlan, selectedStatus, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedOrganization !== "all" && { organization: selectedOrganization }),
        ...(selectedPlan !== "all" && { plan: selectedPlan }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })
      
      const res = await fetch(`/api/finance/invoices?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch invoices")
      }
      return res.json()
    },
  })

  const metrics = metricsData?.metrics || {
    pending_invoices: 0,
    pending_payout: 0,
    premium_received: 0,
    claims_settlement: 0
  }

  const invoices = invoicesData?.invoices || []
  const pagination = invoicesData?.pagination
  const enrollees = enrolleesData?.enrollees || []

  // Extract organizations and plans from API data
  const organizations = organizationsData?.organizations || []
  const plans = plansData?.plans || []

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: any) => {
      const res = await fetch('/api/finance/invoices', {
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["finance-metrics"] })
      setShowCreateModal(false)
      setInvoiceForm({
        enrollee_id: "",
        enrollee_name: "",
        plan_id: "",
        plan_type: "",
        plan_amount: "",
        due_date: ""
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      })
    },
  })

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-orange-100 text-orange-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleExportExcel = async () => {
    try {
      const exportData = invoices.map((invoice: any) => ({
        invoice_number: invoice.invoice_number,
        enrollee_name: invoice.enrollee_name,
        organization_name: invoice.organization_name,
        plan_name: invoice.plan_name,
        plan_type: invoice.plan_type,
        plan_amount: invoice.plan_amount,
        status: invoice.status,
        due_date: new Date(invoice.due_date).toLocaleDateString(),
        created_at: new Date(invoice.created_at).toLocaleDateString(),
      }))

      const reportData = {
        title: 'Finance Invoices Report',
        subtitle: 'Overview of all premium invoices',
        data: exportData,
        columns: [
          { key: 'invoice_number', label: 'Invoice Number', type: 'string' as const },
          { key: 'enrollee_name', label: 'Enrollee Name', type: 'string' as const },
          { key: 'organization_name', label: 'Organization', type: 'string' as const },
          { key: 'plan_name', label: 'Plan', type: 'string' as const },
          { key: 'plan_type', label: 'Plan Type', type: 'string' as const },
          { key: 'plan_amount', label: 'Amount', type: 'currency' as const },
          { key: 'status', label: 'Status', type: 'string' as const },
          { key: 'due_date', label: 'Due Date', type: 'date' as const },
          { key: 'created_at', label: 'Created At', type: 'date' as const },
        ],
        filters: {
          search: searchTerm || 'All',
          organization: selectedOrganization !== 'all' ? organizations.find((o: any) => o.id === selectedOrganization)?.name || 'All' : 'All',
          plan: selectedPlan !== 'all' ? plans.find((p: any) => p.id === selectedPlan)?.name || 'All' : 'All',
          status: selectedStatus !== 'all' ? selectedStatus : 'All',
          date_range: startDate && endDate ? `${startDate} to ${endDate}` : 'All',
        }
      }

      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `finance-invoices-${timestamp}.xlsx`

      const result = exportToExcel(reportData, filename)

      if (result.success) {
        toast({
          title: "Export Successful",
          description: `Excel file "${result.filename}" has been downloaded successfully.`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: `Failed to export Excel file. Please try again. ${error.message}`,
        variant: "destructive",
      })
    }
  }

  const handleExportPDF = async () => {
    try {
      const exportData = invoices.map((invoice: any) => ({
        invoice_number: invoice.invoice_number,
        enrollee_name: invoice.enrollee_name,
        organization_name: invoice.organization_name,
        plan_name: invoice.plan_name,
        plan_type: invoice.plan_type,
        plan_amount: invoice.plan_amount,
        status: invoice.status,
        due_date: new Date(invoice.due_date).toLocaleDateString(),
        created_at: new Date(invoice.created_at).toLocaleDateString(),
      }))

      const reportData = {
        title: 'Finance Invoices Report',
        subtitle: 'Overview of all premium invoices',
        data: exportData,
        columns: [
          { key: 'invoice_number', label: 'Invoice Number', type: 'string' as const },
          { key: 'enrollee_name', label: 'Enrollee Name', type: 'string' as const },
          { key: 'organization_name', label: 'Organization', type: 'string' as const },
          { key: 'plan_name', label: 'Plan', type: 'string' as const },
          { key: 'plan_type', label: 'Plan Type', type: 'string' as const },
          { key: 'plan_amount', label: 'Amount', type: 'currency' as const },
          { key: 'status', label: 'Status', type: 'string' as const },
          { key: 'due_date', label: 'Due Date', type: 'date' as const },
          { key: 'created_at', label: 'Created At', type: 'date' as const },
        ],
        filters: {
          search: searchTerm || 'All',
          organization: selectedOrganization !== 'all' ? organizations.find((o: any) => o.id === selectedOrganization)?.name || 'All' : 'All',
          plan: selectedPlan !== 'all' ? plans.find((p: any) => p.id === selectedPlan)?.name || 'All' : 'All',
          status: selectedStatus !== 'all' ? selectedStatus : 'All',
          date_range: startDate && endDate ? `${startDate} to ${endDate}` : 'All',
        }
      }

      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `finance-invoices-${timestamp}.pdf`

      const result = await exportToPDF(reportData, filename)

      if (result.success) {
        toast({
          title: "Export Successful",
          description: `PDF file "${result.filename}" has been downloaded successfully.`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: `Failed to export PDF file. Please try again. ${error.message}`,
        variant: "destructive",
      })
    }
  }

  const handleCreateInvoice = () => {
    if (!invoiceForm.enrollee_id || !invoiceForm.enrollee_name || !invoiceForm.plan_amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    createInvoiceMutation.mutate(invoiceForm)
  }

  const handlePlanChange = (planId: string) => {
    const selectedPlan = plans.find((plan: any) => plan.id === planId)
    if (selectedPlan) {
      setInvoiceForm({
        ...invoiceForm,
        plan_id: planId,
        plan_type: selectedPlan.plan_type,
        plan_amount: selectedPlan.premium_amount.toString()
      })
    }
  }

  const handleEnrolleeChange = (enrolleeId: string) => {
    const selectedEnrollee = enrollees.find((enrollee: any) => enrollee.id === enrolleeId)
    if (selectedEnrollee) {
      setInvoiceForm({
        ...invoiceForm,
        enrollee_id: enrolleeId,
        enrollee_name: selectedEnrollee.name
      })
    }
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowViewModal(true)
  }

  const handleAcceptInvoice = async (invoice: Invoice) => {
    if (window.confirm(`Are you sure you want to accept invoice ${invoice.invoice_number}?`)) {
      try {
        const res = await fetch(`/api/finance/invoices/${invoice.id}/mark-paid`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (res.ok) {
          toast({
            title: "Success",
            description: "Invoice accepted and marked as paid",
          })
          queryClient.invalidateQueries({ queryKey: ["invoices"] })
          queryClient.invalidateQueries({ queryKey: ["finance-metrics"] })
        } else {
          throw new Error('Failed to accept invoice')
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to accept invoice",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <PermissionGate module="finance" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Finance</h1>
            <p className="text-gray-600">Complete finance monitoring and management system</p>
          </div>
        </div>

        {/* Account Summary */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Invoices</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.pending_invoices}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Payout</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.pending_payout}</p>
                  </div>
                  <FileText className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Premium Received</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.premium_received}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-pink-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Claims Settlement</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.claims_settlement}</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-600" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Search by name or ID</label>
                <Input
                  placeholder="Search by name or ID"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">All Organizations</label>
                <Select value={selectedOrganization} onValueChange={handleOrganizationChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map((org: any) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">All Plans</label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    {plans.map((plan: any) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">All Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="bg-green-600 hover:bg-green-700">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Manage premium invoices and payments</CardDescription>
              </div>
              <div className="flex gap-2">
                <PermissionGate module="finance" action="add">
                  <Button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                  >
                    Generate Bill
                  </Button>
                </PermissionGate>
                <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button onClick={handleExportPDF} className="bg-red-600 hover:bg-red-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Invoice Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  placeholder="dd-mm-yyyy"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  placeholder="dd-mm-yyyy"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Invoices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Invoices</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">INVOICE NO.</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PLAN TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PLAN AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice: Invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{new Date(invoice.date).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>{invoice.enrollee_id}</TableCell>
                        <TableCell>{invoice.enrollee_name}</TableCell>
                        <TableCell>{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.plan_type}</TableCell>
                        <TableCell>₦{invoice.plan_amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewInvoice(invoice)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              {invoice.status === 'PENDING' && (
                                <PermissionGate module="finance" action="edit">
                                  <DropdownMenuItem onClick={() => handleAcceptInvoice(invoice)}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Accept
                                  </DropdownMenuItem>
                                </PermissionGate>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                        disabled={pagination.page === pagination.pages}
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

        {/* Create Invoice Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Generate Bill</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Create a new premium invoice for enrollee</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enrollee Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Enrollee Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Select Enrollee *</label>
                      <Select value={invoiceForm.enrollee_id} onValueChange={handleEnrolleeChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an enrollee" />
                        </SelectTrigger>
                        <SelectContent>
                          {enrollees.map((enrollee: any) => (
                            <SelectItem key={enrollee.id} value={enrollee.id}>
                              {enrollee.name} ({enrollee.type}) - {enrollee.organization}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Enrollee Name</label>
                      <Input
                        placeholder="Enrollee name"
                        value={invoiceForm.enrollee_name}
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* Plan Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Plan Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Select Plan *</label>
                      <Select value={invoiceForm.plan_id} onValueChange={handlePlanChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((plan: any) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} - {plan.plan_type} (₦{plan.premium_amount.toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Plan Type</label>
                      <Input
                        placeholder="Plan type"
                        value={invoiceForm.plan_type}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Plan Amount *</label>
                      <Input
                        placeholder="Enter plan amount"
                        type="number"
                        value={invoiceForm.plan_amount}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, plan_amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Due Date</label>
                      <Input
                        type="date"
                        value={invoiceForm.due_date}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                      />
                    </div>
                  </div>
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
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
                <CardDescription>Invoice #{selectedInvoice.invoice_number}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Invoice Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Invoice Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Invoice Number</label>
                      <p className="text-sm font-semibold">{selectedInvoice.invoice_number}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date</label>
                      <p className="text-sm">{new Date(selectedInvoice.date).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <Badge className={getStatusBadgeColor(selectedInvoice.status)}>
                        {selectedInvoice.status}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Amount</label>
                      <p className="text-sm font-semibold text-green-600">₦{selectedInvoice.plan_amount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Enrollee Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Enrollee Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Enrollee ID</label>
                      <p className="text-sm">{selectedInvoice.enrollee_id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Enrollee Name</label>
                      <p className="text-sm">{selectedInvoice.enrollee_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Plan Type</label>
                      <p className="text-sm">{selectedInvoice.plan_type}</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowViewModal(false)}
                  >
                    Close
                  </Button>
                  {selectedInvoice.status === 'PENDING' && (
                    <PermissionGate module="finance" action="edit">
                      <Button
                        onClick={() => {
                          setShowViewModal(false)
                          handleAcceptInvoice(selectedInvoice)
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept Invoice
                      </Button>
                    </PermissionGate>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
