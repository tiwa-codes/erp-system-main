"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Plus, Search, Eye, Edit, Trash2, MoreHorizontal, Download, ChevronDown, ChevronRight, Minus, ArrowRight } from "lucide-react"
import { AccountCategory } from "@prisma/client"
import { StatusIndicator } from "@/components/ui/status-indicator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/ui/permission-gate"
import { exportToExcel, exportToPDF } from "@/lib/export-utils"
import { formatAccountCode } from "@/lib/finance/account-code"

export const dynamic = 'force-dynamic'

export default function ChartOfAccountsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [category, setCategory] = useState<string>("all")
  const [isActive, setIsActive] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["chart-of-accounts", page, limit, category, isActive, search, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(category !== "all" && { category }),
        ...(isActive !== "all" && { is_active: isActive }),
        ...(search && { search }),
        ...(fromDate && { from_date: fromDate }),
        ...(toDate && { to_date: toDate }),
      })
      const res = await fetch(`/api/finance/chart-of-accounts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch accounts")
      return res.json()
    },
  })

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return

    try {
      const res = await fetch(`/api/finance/chart-of-accounts/${id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete account")
      }

      toast({
        title: "Success",
        description: "Account deleted successfully",
      })
      refetch()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      })
    }
  }

  const toggleExpand = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts)
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId)
    } else {
      newExpanded.add(accountId)
    }
    setExpandedAccounts(newExpanded)
  }

  const accounts = data?.data?.accounts || []
  const allAccounts = data?.data?.allAccounts || []
  const pagination = data?.data?.pagination
  const summary = data?.data?.summary || {
    total_accounts: 0,
    asset_accounts: 0,
    liability_accounts: 0,
    expense_accounts: 0,
  }

  // Build hierarchical structure with nested children
  const buildHierarchicalAccounts = (accounts: any[], depth: number = 0): any[] => {
    const result: any[] = []

    accounts.forEach((account) => {
      // Add the account itself
      result.push({
        ...account,
        depth,
        isParent: account.level === "Parent",
        isChild: account.level === "Child",
        isDetail: account.level === "Detail",
      })

      // If expanded and has children, recursively add children
      if (expandedAccounts.has(account.id) && account.child_accounts && account.child_accounts.length > 0) {
        const children = buildHierarchicalAccounts(account.child_accounts, depth + 1)
        result.push(...children)
      }
    })

    return result
  }

  // Use allAccounts if accounts is empty (no hierarchy), otherwise use hierarchical view
  const hierarchicalAccounts = accounts.length > 0 
    ? buildHierarchicalAccounts(accounts)
    : allAccounts.map((account: any) => ({
        ...account,
        depth: 0,
        isParent: account.level === "Parent",
        isChild: account.level === "Child",
        isDetail: account.level === "Detail",
      }))

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
          <h1 className="text-3xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-gray-600">Manage your chart of accounts</p>
        </div>
        <PermissionGate permission="finance:add">
          <Button
            onClick={() => router.push("/finance/chart-of-accounts/add")}
            className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Account
          </Button>
        </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Account</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_accounts}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <span className="text-yellow-600 text-xl font-bold">₦</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Asset Account</p>
                <p className="text-2xl font-bold text-gray-900">{summary.asset_accounts}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 text-lg">📝</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Liability Account</p>
                <p className="text-2xl font-bold text-gray-900">{summary.liability_accounts}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-pink-100 flex items-center justify-center">
                <span className="text-pink-600 text-lg">💎</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expenses Account</p>
                <p className="text-2xl font-bold text-gray-900">{summary.expense_accounts}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-purple-600 text-lg">🛍️</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search by name or code"
                  className="pl-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <Button
                onClick={() => refetch()}
                className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
              >
                Search
              </Button>
            </div>
            <div className="flex gap-4 items-center">
              <div className="flex gap-2 items-center">
                <label className="text-sm text-gray-700 whitespace-nowrap">From:</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[150px]"
                  placeholder="dd-mm-yyyy"
                />
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-sm text-gray-700 whitespace-nowrap">To:</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-[150px]"
                  placeholder="dd-mm-yyyy"
                />
              </div>
              <Select value={category} onValueChange={(value) => { setCategory(value); setPage(1) }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  <SelectItem value={AccountCategory.ASSET}>Assets</SelectItem>
                  <SelectItem value={AccountCategory.LIABILITY}>Liabilities</SelectItem>
                  <SelectItem value={AccountCategory.EQUITY}>Equity</SelectItem>
                  <SelectItem value={AccountCategory.INCOME}>Income</SelectItem>
                  <SelectItem value={AccountCategory.EXPENSE}>Expenses</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  const reportData = {
                    title: "Chart of Accounts",
                    subtitle: "Account listing",
                data: allAccounts.map((account: any) => ({
                  account_code: formatAccountCode(account.account_code),
                  account_name: account.account_name,
                  type: account.account_category.replace(/_/g, " "),
                  sub_category: account.sub_category
                    ? account.sub_category.replace(/_/g, " ")
                    : "—",
                  parent: account.parent_account?.account_name || "—",
                  level: account.level,
                  balance_type: account.balance_type,
                  opening: Number(account.opening_balance),
                  balance: Number(account.balance || 0),
                  status: account.is_active ? "Active" : "Inactive",
                })),
                    columns: [
                      { key: "account_code", label: "Code", type: "string" },
                      { key: "account_name", label: "Account Name", type: "string" },
                      { key: "type", label: "Type", type: "string" },
                      { key: "sub_category", label: "Sub-Category", type: "string" },
                      { key: "parent", label: "Parent", type: "string" },
                      { key: "level", label: "Level", type: "string" },
                      { key: "balance_type", label: "Balance Type", type: "string" },
                      { key: "opening", label: "Opening", type: "currency" },
                      { key: "balance", label: "Balance", type: "currency" },
                      { key: "status", label: "Status", type: "string" },
                    ],
                  }
                  const result = exportToExcel(reportData)
                  if (result.success) {
                    toast({ title: "Success", description: "Chart of Accounts exported to Excel" })
                  } else {
                    toast({ title: "Error", description: result.error, variant: "destructive" })
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Chart of Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">CODE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ACCOUNT NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">SUB-CATEGORY</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PARENT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">LEVEL</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">BALANCE TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">OPENING</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">BALANCE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hierarchicalAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                      No accounts found
                    </TableCell>
                  </TableRow>
                ) : (
                  hierarchicalAccounts.map((account: any) => {
                    const isParent = account.level === "Parent"
                    const isChild = account.level === "Child"
                    const isDetail = account.level === "Detail"
                    const isExpanded = expandedAccounts.has(account.id)
                    const hasChildren = account.child_accounts && account.child_accounts.length > 0
                    const depth = account.depth || 0

                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono text-gray-900">{formatAccountCode(account.account_code)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
                            {/* Expand/Collapse button for Parent and Child accounts with children */}
                            {(isParent || isChild) && hasChildren && (
                              <button
                                onClick={() => toggleExpand(account.id)}
                                className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                              >
                                {isExpanded ? (
                                  <Minus className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            )}
                            {/* Right arrow for Child accounts */}
                            {isChild && !hasChildren && (
                              <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                            {/* Bullet point for Detail accounts */}
                            {isDetail && (
                              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-600 font-bold">•</span>
                              </span>
                            )}
                            {/* Spacer for accounts without icons */}
                            {!isParent && !isChild && !isDetail && (
                              <span className="w-4 h-4 flex-shrink-0"></span>
                            )}
                            <span className="font-medium text-gray-900">{account.account_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700">{account.account_category.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-gray-700">
                          {account.sub_category
                            ? account.sub_category.replace(/_/g, " ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {account.parent_account?.account_name || "—"}
                        </TableCell>
                        <TableCell className="text-gray-700">{account.level}</TableCell>
                        <TableCell className="text-gray-700">{account.balance_type || "—"}</TableCell>
                        <TableCell className="text-gray-700">
                          ₦{Number(account.opening_balance || 0).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-gray-700 font-medium">
                          ₦{Number(account.balance || 0).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <StatusIndicator
                            status={account.is_active ? "ACTIVE" : "INACTIVE"}
                          />
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
                                onClick={() => router.push(`/finance/chart-of-accounts/${account.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <PermissionGate permission="finance:edit">
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/finance/chart-of-accounts/${account.id}/edit`)
                                  }
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(account.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </PermissionGate>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} of {pagination.total} entries
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const pageNum = i + 1
              return (
                <Button
                  key={pageNum}
                  variant={pagination.page === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className={pagination.page === pageNum ? "bg-[#BE1522] hover:bg-[#9B1219] text-white" : ""}
                >
                  {pageNum}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
