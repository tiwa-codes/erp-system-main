"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusIndicator } from "@/components/ui/status-indicator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Calendar,
  Eye,
  Download,
  CreditCard,
  FileText,
  MoreHorizontal,
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

interface PrincipalAccount {
  id: string
  enrollee_id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  account_type: string
  status: string
  organization?: {
    id: string
    name: string
  }
  plan?: {
    id: string
    name: string
    premium_amount?: number
  }
  created_at: string
  _count?: {
    dependents: number
    claims: number
  }
}

export default function PrincipalAccountManagementPage() {
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedOrganization, setSelectedOrganization] = useState("all")
  const [selectedPlan, setSelectedPlan] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch principal accounts
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ["principal-accounts", currentPage, limit, debouncedSearchTerm, selectedOrganization, selectedPlan, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: debouncedSearchTerm,
        organizationId: selectedOrganization,
        planId: selectedPlan,
        status: selectedStatus
      })
      
      const res = await fetch(`/api/underwriting/principals?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch principal accounts")
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

  // Fetch plans for filter
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/plans")
      if (!res.ok) {
        throw new Error("Failed to fetch plans")
      }
      return res.json()
    },
  })

  const accounts = accountsData?.principals || []
  const pagination = accountsData?.pagination
  const organizations = organizationsData?.organizations || []
  const plans = plansData?.plans || []

  // Get account type badge color
  const getAccountTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'INDIVIDUAL':
        return 'bg-blue-100 text-blue-800'
      case 'FAMILY':
        return 'bg-purple-100 text-purple-800'
      case 'CORPORATE':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleViewAccount = (account: PrincipalAccount) => {
    // TODO: Implement view account details
  }

  const handleExportExcel = () => {
    // TODO: Implement Excel export
  }

  // Calculate metrics
  const totalAccounts = accounts.length
  const activeAccounts = accounts.filter((account: PrincipalAccount) => account.status === 'ACTIVE').length
  const totalDependents = accounts.reduce((sum: number, account: PrincipalAccount) => sum + (account._count?.dependents || 0), 0)
  const totalClaims = accounts.reduce((sum: number, account: PrincipalAccount) => sum + (account._count?.claims || 0), 0)

  return (
    <PermissionGate module="finance" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Principal Account Management</h1>
            <p className="text-gray-600">Manage and monitor principal accounts</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAccounts}</div>
              <p className="text-xs text-muted-foreground">
                All principal accounts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeAccounts}</div>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Dependents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{totalDependents}</div>
              <p className="text-xs text-muted-foreground">
                Across all accounts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{totalClaims}</div>
              <p className="text-xs text-muted-foreground">
                All time claims
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Principal Accounts</CardTitle>
                <CardDescription>Manage principal accounts and their details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Account Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search accounts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Organization" />
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
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Plan" />
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
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Accounts Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading accounts...</div>
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No accounts found</div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">Enrollee ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Name</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Email</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Phone</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Organization</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Plan</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Account Type</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Status</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Dependents</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Claims</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account: PrincipalAccount) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono text-sm">{account.enrollee_id}</TableCell>
                        <TableCell>{account.first_name} {account.last_name}</TableCell>
                        <TableCell>{account.email}</TableCell>
                        <TableCell>{account.phone_number}</TableCell>
                        <TableCell>{account.organization?.name || '-'}</TableCell>
                        <TableCell>
                          {account.plan ? (
                            <div>
                              <div className="font-medium">{account.plan.name}</div>
                              <div className="text-sm text-gray-500">
                                ₦{(account.plan.premium_amount || 0).toLocaleString()}
                              </div>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getAccountTypeBadgeColor(account.account_type)}>
                            {account.account_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusIndicator status={account.status} />
                        </TableCell>
                        <TableCell>
                          <span className="text-blue-600 font-medium">{account._count?.dependents || 0}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-purple-600 font-medium">{account._count?.claims || 0}</span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewAccount(account)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
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
      </div>
    </PermissionGate>
  )
}
