"use client"

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
import { AccountSelector } from "@/components/finance/account-selector"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  Search,
  Filter,
  Calendar,
  Download,
  MoreHorizontal,
  CreditCard,
  AlertTriangle,
  FileText,
  Paperclip,
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

interface TransactionMetrics {
  total_transactions: number
  pending_transactions: number
  processed_transactions: number
  failed_transactions: number
  total_amount: number
  claim_payouts: number
  refunds: number
  adjustments: number
  transfers: number
}

interface FinancialTransaction {
  id: string
  transaction_type: 'CLAIM_PAYOUT' | 'REFUND' | 'ADJUSTMENT' | 'TRANSFER' | 'PROCUREMENT_PAYOUT'
  amount: number
  currency: string
  reference_id?: string
  reference_type?: string
  description?: string
  status: 'PENDING' | 'PROCESSED' | 'PAID' | 'FAILED'
  processed_at?: string
  created_at: string
  attachment_url?: string
  attachment_name?: string
  rejection_reason?: string | null
  dept_oversight_comment?: string | null
  dept_oversight_at?: string | null
  dept_oversight_by?: {
    first_name?: string
    last_name?: string
    email?: string
  } | null
  operations_comment?: string | null
  operations_at?: string | null
  operations_by?: {
    first_name?: string
    last_name?: string
    email?: string
  } | null
  executive_comment?: string | null
  executive_at?: string | null
  executive_by?: {
    first_name?: string
    last_name?: string
    email?: string
  } | null
  general_ledger_entry?: { id: string }
  created_by?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
}

export default function FinancialTransactionsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedTransactionType, setSelectedTransactionType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showMarkAsPaidModal, setShowMarkAsPaidModal] = useState(false)
  const [showPostToGLModal, setShowPostToGLModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null)
  
  // Post to GL form state
  const [postToGLForm, setPostToGLForm] = useState({
    debit_account_id: "",
    credit_account_id: "",
    description: "",
    entry_date: new Date().toISOString().split("T")[0],
  })
  
  // Create transaction form state
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: "",
    amount: "",
    currency: "NGN",
    reference_id: "",
    reference_type: "",
    description: ""
  })

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch transaction metrics
  const { data: metricsData } = useQuery({
    queryKey: ["transaction-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/finance/transactions/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch transaction metrics")
      }
      return res.json()
    },
  })

  // Fetch transactions
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ["financial-transactions", currentPage, limit, debouncedSearchTerm, selectedTransactionType, selectedStatus, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: debouncedSearchTerm,
        transactionType: selectedTransactionType,
        status: selectedStatus,
        startDate: startDate,
        endDate: endDate
      })
      
      const res = await fetch(`/api/finance/transactions?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch transactions")
      }
      return res.json()
    },
  })

  const metrics = metricsData?.metrics || {
    total_transactions: 0,
    pending_transactions: 0,
    processed_transactions: 0,
    failed_transactions: 0,
    total_amount: 0,
    claim_payouts: 0,
    refunds: 0,
    adjustments: 0,
    transfers: 0
  }

  const transactions = transactionsData?.transactions || []
  const pagination = transactionsData?.pagination

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData)
      })
      if (!res.ok) {
        throw new Error('Failed to create transaction')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transaction created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] })
      queryClient.invalidateQueries({ queryKey: ["transaction-metrics"] })
      setShowCreateModal(false)
      setTransactionForm({
        transaction_type: "",
        amount: "",
        currency: "NGN",
        reference_id: "",
        reference_type: "",
        description: ""
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create transaction",
        variant: "destructive",
      })
    },
  })

  // Mark transaction as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const res = await fetch(`/api/finance/transactions/${transactionId}/mark-as-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        throw new Error('Failed to mark transaction as paid')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transaction marked as paid successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] })
      queryClient.invalidateQueries({ queryKey: ["transaction-metrics"] })
      setShowMarkAsPaidModal(false)
      setShowViewModal(false)
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark transaction as paid",
        variant: "destructive",
      })
    },
  })

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'PROCESSED':
        return 'bg-green-100 text-green-800'
      case 'PAID':
        return 'bg-green-100 text-green-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get transaction type badge color
  const getTransactionTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'CLAIM_PAYOUT':
        return 'bg-blue-100 text-blue-800'
      case 'REFUND':
        return 'bg-orange-100 text-orange-800'
      case 'ADJUSTMENT':
        return 'bg-purple-100 text-purple-800'
      case 'TRANSFER':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleCreateTransaction = () => {
    if (!transactionForm.transaction_type || !transactionForm.amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    createTransactionMutation.mutate(transactionForm)
  }

  // Post to GL mutation
  const postToGLMutation = useMutation({
    mutationFn: async (data: { transactionId: string; debit_account_id: string; credit_account_id: string; description?: string; entry_date?: string }) => {
      const res = await fetch(`/api/finance/transactions/${data.transactionId}/post-to-gl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debit_account_id: data.debit_account_id,
          credit_account_id: data.credit_account_id,
          description: data.description,
          entry_date: data.entry_date,
        })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to post to GL')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transaction posted to General Ledger successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] })
      setShowPostToGLModal(false)
      setPostToGLForm({
        debit_account_id: "",
        credit_account_id: "",
        description: "",
        entry_date: new Date().toISOString().split("T")[0],
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to post transaction to GL",
        variant: "destructive",
      })
    },
  })

  const handleViewTransaction = (transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction)
    setShowViewModal(true)
  }

  const handlePostToGL = (transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction)
    setPostToGLForm({
      debit_account_id: "",
      credit_account_id: "",
      description: transaction.description || "",
      entry_date: transaction.processed_at 
        ? new Date(transaction.processed_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    })
    setShowPostToGLModal(true)
  }

  const handlePostToGLSubmit = () => {
    if (!selectedTransaction) return
    
    if (!postToGLForm.debit_account_id || !postToGLForm.credit_account_id) {
      toast({
        title: "Error",
        description: "Please select both debit and credit accounts",
        variant: "destructive",
      })
      return
    }

    postToGLMutation.mutate({
      transactionId: selectedTransaction.id,
      debit_account_id: postToGLForm.debit_account_id,
      credit_account_id: postToGLForm.credit_account_id,
      description: postToGLForm.description,
      entry_date: postToGLForm.entry_date,
    })
  }

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm)
      if (selectedTransactionType !== "all") params.append("transaction_type", selectedTransactionType)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (startDate) params.append("start_date", startDate)
      if (endDate) params.append("end_date", endDate)

      const response = await fetch(`/api/finance/transactions/export?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to export transactions')
      }

      const csvContent = await response.text()
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `financial-transactions-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: "Financial transactions data has been exported successfully."
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export transactions",
        variant: "destructive"
      })
    }
  }

  const handleMarkAsPaid = () => {
    if (selectedTransaction) {
      markAsPaidMutation.mutate(selectedTransaction.id)
    }
  }

  const handlePayClick = () => {
    setShowMarkAsPaidModal(true)
  }

  return (
    <PermissionGate module="finance" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Financial Transactions</h1>
            <p className="text-gray-600">Manage and track all financial transactions</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <PermissionGate module="finance" action="add">
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="bg-[#BE1522] hover:bg-[#9B1219]"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Transaction
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <span className="text-lg font-bold text-muted-foreground">₦</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_transactions}</div>
              <p className="text-xs text-muted-foreground">
                All time transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Transactions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{metrics.pending_transactions}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processed Transactions</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{metrics.processed_transactions}</div>
              <p className="text-xs text-muted-foreground">
                Successfully completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ₦{metrics.total_amount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Processed amount
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Type Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Claim Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{metrics.claim_payouts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Refunds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{metrics.refunds}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Adjustments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{metrics.adjustments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{metrics.transfers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transactions</CardTitle>
                <CardDescription className="mt-2">All financial transactions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Transaction Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedTransactionType} onValueChange={setSelectedTransactionType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CLAIM_PAYOUT">Claim Payout</SelectItem>
                  <SelectItem value="REFUND">Refund</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PROCESSED">Processed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  placeholder="Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  placeholder="End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>

            {/* Transactions Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading transactions...</div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No transactions found</div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REFERENCE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DESCRIPTION</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CREATED BY</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction: FinancialTransaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{new Date(transaction.created_at).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>
                          <Badge className={getTransactionTypeBadgeColor(transaction.transaction_type)}>
                            {transaction.transaction_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>₦{transaction.amount.toLocaleString()}</TableCell>
                        <TableCell>{transaction.reference_id || '-'}</TableCell>
                        <TableCell>{transaction.description || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(transaction.status)}>
                            {transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {transaction.created_by ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-red-400">
                                  {transaction.created_by.first_name?.[0]}{transaction.created_by.last_name?.[0]}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {transaction.created_by.first_name} {transaction.created_by.last_name}
                                </div>
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => handleViewTransaction(transaction)}
                                className="w-full justify-start text-xs"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              {transaction.status === 'PAID' && 
                               !transaction.general_ledger_entry && (
                                <PermissionGate module="finance" action="edit">
                                  <DropdownMenuItem 
                                    onClick={() => handlePostToGL(transaction)}
                                    className="w-full justify-start text-xs"
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Post to GL
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

        {/* Create Transaction Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Create New Transaction</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Create a new financial transaction</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Transaction Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Transaction Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Transaction Type *</label>
                      <Select value={transactionForm.transaction_type} onValueChange={(value) => setTransactionForm({ ...transactionForm, transaction_type: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select transaction type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLAIM_PAYOUT">Claim Payout</SelectItem>
                          <SelectItem value="REFUND">Refund</SelectItem>
                          <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                          <SelectItem value="TRANSFER">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Amount *</label>
                      <Input
                        placeholder="Enter amount"
                        type="number"
                        value={transactionForm.amount}
                        onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Currency</label>
                      <Select value={transactionForm.currency} onValueChange={(value) => setTransactionForm({ ...transactionForm, currency: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NGN">NGN</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Reference ID</label>
                      <Input
                        placeholder="Enter reference ID"
                        value={transactionForm.reference_id}
                        onChange={(e) => setTransactionForm({ ...transactionForm, reference_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Reference Type</label>
                      <Input
                        placeholder="Enter reference type"
                        value={transactionForm.reference_type}
                        onChange={(e) => setTransactionForm({ ...transactionForm, reference_type: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Description</label>
                      <Input
                        placeholder="Enter description"
                        value={transactionForm.description}
                        onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
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
                    onClick={handleCreateTransaction}
                    disabled={createTransactionMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createTransactionMutation.isPending ? "Creating..." : "Create Transaction"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Transaction Modal */}
        {showViewModal && selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Transaction Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowViewModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Transaction #{selectedTransaction.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Transaction Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Transaction Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Transaction Type</label>
                      <Badge className={getTransactionTypeBadgeColor(selectedTransaction.transaction_type)}>
                        {selectedTransaction.transaction_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Amount</label>
                      <p className="text-sm font-semibold text-green-600">
                        ₦{selectedTransaction.amount.toLocaleString()}
                        {/* {selectedTransaction.currency} */}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <Badge className={getStatusBadgeColor(selectedTransaction.status)}>
                        {selectedTransaction.status}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date</label>
                      <p className="text-sm">{new Date(selectedTransaction.created_at).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Reference ID</label>
                      <p className="text-sm">{selectedTransaction.reference_id || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Reference Type</label>
                      <p className="text-sm">{selectedTransaction.reference_type || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-600">Description</label>
                      <p className="text-sm">{selectedTransaction.description || '-'}</p>
                    </div>
                    {selectedTransaction.attachment_url && (
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-600">Attachment</label>
                        <a
                          href={selectedTransaction.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm mt-1"
                        >
                          <Paperclip className="h-4 w-4" />
                          {selectedTransaction.attachment_name || 'View Attachment'}
                        </a>
                      </div>
                    )}
                    {selectedTransaction.rejection_reason && (
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-600">Rejection Reason</label>
                        <p className="text-sm text-red-600">{selectedTransaction.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {(selectedTransaction.dept_oversight_comment || selectedTransaction.operations_comment || selectedTransaction.executive_comment) && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-blue-600 font-semibold mb-4">Verification Comments</h3>
                    <div className="space-y-4">
                      {selectedTransaction.dept_oversight_comment && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-blue-600">Department Oversight</span>
                            {selectedTransaction.dept_oversight_at && (
                              <span className="text-xs text-gray-500">
                                {new Date(selectedTransaction.dept_oversight_at).toLocaleDateString('en-GB')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700">{selectedTransaction.dept_oversight_comment}</p>
                          {selectedTransaction.dept_oversight_by && (
                            <p className="text-xs text-gray-500 mt-1">
                              By: {selectedTransaction.dept_oversight_by.first_name} {selectedTransaction.dept_oversight_by.last_name}
                            </p>
                          )}
                        </div>
                      )}
                      {selectedTransaction.operations_comment && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-blue-600">Operations</span>
                            {selectedTransaction.operations_at && (
                              <span className="text-xs text-gray-500">
                                {new Date(selectedTransaction.operations_at).toLocaleDateString('en-GB')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700">{selectedTransaction.operations_comment}</p>
                          {selectedTransaction.operations_by && (
                            <p className="text-xs text-gray-500 mt-1">
                              By: {selectedTransaction.operations_by.first_name} {selectedTransaction.operations_by.last_name}
                            </p>
                          )}
                        </div>
                      )}
                      {selectedTransaction.executive_comment && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-blue-600">Executive</span>
                            {selectedTransaction.executive_at && (
                              <span className="text-xs text-gray-500">
                                {new Date(selectedTransaction.executive_at).toLocaleDateString('en-GB')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700">{selectedTransaction.executive_comment}</p>
                          {selectedTransaction.executive_by && (
                            <p className="text-xs text-gray-500 mt-1">
                              By: {selectedTransaction.executive_by.first_name} {selectedTransaction.executive_by.last_name}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Created By Information */}
                {selectedTransaction.created_by && (
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Created By</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Name</label>
                        <p className="text-sm">{selectedTransaction.created_by.first_name} {selectedTransaction.created_by.last_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <p className="text-sm">{selectedTransaction.created_by.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                  {selectedTransaction.status === 'PENDING' && (
                    <PermissionGate module="finance" action="edit">
                      <Button
                        onClick={handlePayClick}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Mark as Paid
                      </Button>
                    </PermissionGate>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setShowViewModal(false)}
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mark as Paid Confirmation Modal */}
        {showMarkAsPaidModal && selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Confirm Payment
                </CardTitle>
                <CardDescription>
                  Are you sure you want to mark this transaction as paid?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Transaction Details</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Type:</span> {selectedTransaction.transaction_type.replace('_', ' ')}</p>
                    <p><span className="font-medium">Amount:</span> ₦{selectedTransaction.amount.toLocaleString()}</p>
                    <p><span className="font-medium">Reference:</span> {selectedTransaction.reference_id || 'N/A'}</p>
                    <p><span className="font-medium">Transaction ID:</span> {selectedTransaction.id}</p>
                  </div>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm font-medium text-yellow-800">
                      This action cannot be undone. The transaction status will be permanently changed to "PAID".
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowMarkAsPaidModal(false)}
                    disabled={markAsPaidMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMarkAsPaid}
                    disabled={markAsPaidMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {markAsPaidMutation.isPending ? "Processing..." : "Confirm Payment"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Post to GL Modal */}
        {showPostToGLModal && selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Post Transaction to General Ledger</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPostToGLModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Select debit and credit accounts to post this transaction to General Ledger
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Transaction Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Transaction Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Type:</span> {selectedTransaction.transaction_type.replace('_', ' ')}
                    </div>
                    <div>
                      <span className="font-medium">Amount:</span> ₦{selectedTransaction.amount.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Reference:</span> {selectedTransaction.reference_id || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> {selectedTransaction.status}
                    </div>
                  </div>
                </div>

                {/* Account Selection */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Account Selection</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="debit_account" className="text-sm font-medium">
                        Debit Account *
                      </Label>
                      <AccountSelector
                        value={postToGLForm.debit_account_id}
                        onValueChange={(value) =>
                          setPostToGLForm({ ...postToGLForm, debit_account_id: value })
                        }
                        placeholder="Select debit account"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="credit_account" className="text-sm font-medium">
                        Credit Account *
                      </Label>
                      <AccountSelector
                        value={postToGLForm.credit_account_id}
                        onValueChange={(value) =>
                          setPostToGLForm({ ...postToGLForm, credit_account_id: value })
                        }
                        placeholder="Select credit account"
                      />
                    </div>
                  </div>
                </div>

                {/* Entry Details */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Entry Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entry_date" className="text-sm font-medium">
                        Entry Date *
                      </Label>
                      <Input
                        id="entry_date"
                        type="date"
                        value={postToGLForm.entry_date}
                        onChange={(e) =>
                          setPostToGLForm({ ...postToGLForm, entry_date: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="description" className="text-sm font-medium">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={postToGLForm.description}
                        onChange={(e) =>
                          setPostToGLForm({ ...postToGLForm, description: e.target.value })
                        }
                        placeholder="Enter description for journal entry"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowPostToGLModal(false)}
                    disabled={postToGLMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePostToGLSubmit}
                    disabled={postToGLMutation.isPending || !postToGLForm.debit_account_id || !postToGLForm.credit_account_id}
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                  >
                    {postToGLMutation.isPending ? "Posting..." : "Post to GL"}
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
