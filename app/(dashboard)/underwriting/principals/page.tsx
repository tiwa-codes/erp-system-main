"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { IDCardViewer } from "@/components/id-card/id-card-viewer"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusText } from "@/components/ui/status-text"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download,
  Filter,
  Building2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  X,
  Upload,
  Link2,
} from "lucide-react"
import { PermissionButton } from "@/components/ui/permission-button"
import { PermissionGate } from "@/components/ui/permission-gate"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"

interface Principal {
  id: string
  enrollee_id: string
  first_name: string
  last_name: string
  middle_name?: string
  gender?: string
  date_of_birth?: string
  phone_number?: string
  email?: string
  residential_address?: string
  organization_id: string
  organization: {
    id: string
    name: string
    code: string
  }
  plan_id?: string
  plan?: {
    id: string
    name: string
  }
  account_type: string
  balance: number
  primary_hospital?: string
  hospital_address?: string
  start_date?: string
  end_date?: string
  status: string
  created_at: string
  updated_at: string
  created_by: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  _count: {
    dependents: number
    claims: number
  }
}

interface Organization {
  id: string
  name: string
  code: string
}

interface Plan {
  id: string
  name: string
}

export default function PrincipalsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [organizationFilter, setOrganizationFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)

  // Status change modal state
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedPrincipal, setSelectedPrincipal] = useState<Principal | null>(null)
  const [newStatus, setNewStatus] = useState("")
  const [statusReason, setStatusReason] = useState("")
  const [isChangingStatus, setIsChangingStatus] = useState(false)

  // Bulk upload state
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [showIDCard, setShowIDCard] = useState(false)
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  // Fetch principals
  const {
    data: principalsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["principals", search, organizationFilter, planFilter, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        organizationId: organizationFilter,
        planId: planFilter,
        status: statusFilter,
        page: page.toString(),
        limit: "10",
      })

      const res = await fetch(`/api/underwriting/principals?${params}`)
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to fetch principals")
      }
      return res.json()
    },
    placeholderData: (previousData) => previousData,
  })

  // Fetch organizations for filter
  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations?limit=10000")
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
      const res = await fetch("/api/underwriting/plans?limit=10000")
      if (!res.ok) {
        throw new Error("Failed to fetch plans")
      }
      return res.json()
    },
  })

  // Delete principal mutation
  const deletePrincipalMutation = useMutation({
    mutationFn: async (principalId: string) => {
      const res = await fetch(`/api/underwriting/principals/${principalId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to delete principal")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Principal Deleted",
        description: "Principal has been successfully deleted.",
      })
      queryClient.invalidateQueries({ queryKey: ["principals"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting Principal",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const principals: Principal[] = principalsData?.principals || []
  const organizations: Organization[] = organizationsData?.organizations || []
  const plans: Plan[] = plansData?.plans || []
  const pagination = principalsData?.pagination

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleFilterChange = (filterType: string, value: string) => {
    switch (filterType) {
      case "organization":
        setOrganizationFilter(value)
        break
      case "plan":
        setPlanFilter(value)
        break
      case "status":
        setStatusFilter(value)
        break
    }
    setPage(1)
  }

  const handleDelete = (principal: Principal) => {
    setOpenDropdownId(null)
    if (window.confirm(`Are you sure you want to delete the principal account for ${principal.first_name} ${principal.last_name} (${principal.enrollee_id})? This action cannot be undone.`)) {
      deletePrincipalMutation.mutate(principal.id)
    }
  }

  const handleViewPrincipal = (principalId: string) => {
    setOpenDropdownId(null)
    router.push(`/underwriting/principals/${principalId}`)
  }

  const handleEditPrincipal = (principalId: string) => {
    setOpenDropdownId(null)
    router.push(`/underwriting/principals/edit/${principalId}`)
  }

  const handleChangeStatus = (principal: Principal) => {
    setOpenDropdownId(null)
    setSelectedPrincipal(principal)
    setNewStatus(principal.status)
    setStatusReason("")
    setShowStatusModal(true)
  }

  const handleStatusChange = async () => {
    if (!selectedPrincipal || !newStatus || isChangingStatus) return

    setIsChangingStatus(true)

    try {
      const response = await fetch(`/api/underwriting/principals/${selectedPrincipal.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to change status")
      }

      const result = await response.json()

      toast({
        title: "Success",
        description: result.message,
      })

      setShowStatusModal(false)
      setSelectedPrincipal(null)
      setNewStatus("")
      setStatusReason("")
      refetch()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change status",
        variant: "destructive",
      })
    } finally {
      setIsChangingStatus(false)
    }
  }

  const handleAddPrincipal = () => {
    router.push("/underwriting/principals/add")
  }

  const handleBulkUpload = () => {
    setShowBulkUploadModal(true)
  }

  const handleBulkUploadSuccess = (data: any[], processedCount?: number) => {
    const count = processedCount || data.length
    toast({
      title: "Bulk Upload Successful",
      description: `${count} principals uploaded successfully`,
    })
    queryClient.invalidateQueries({ queryKey: ["principals"] })
    setShowBulkUploadModal(false)
  }

  const handleViewIDCard = (enrolleeId: string) => {
    setOpenDropdownId(null)
    setSelectedEnrolleeId(enrolleeId)
    setShowIDCard(true)
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-red-100 text-red-800"
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getAccountTypeBadgeColor = (type: string) => {
    switch (type) {
      case "PRINCIPAL":
        return "bg-blue-100 text-blue-800"
      case "DEPENDENT":
        return "bg-purple-100 text-purple-800"
      case "PROVIDER":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleCopyPublicLink = () => {
    const publicLink = `${window.location.origin}/principal-registration`
    navigator.clipboard.writeText(publicLink).then(() => {
      toast({
        title: "Link Copied",
        description: "Public registration link has been copied to clipboard.",
      })
    }).catch((error) => {
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      })
    })
  }

  const exportPrincipals = async () => {
    try {
      const params = new URLSearchParams({
        search,
        organizationId: organizationFilter,
        planId: planFilter,
        status: statusFilter,
        limit: "1000", // Export more records
      })

      const res = await fetch(`/api/underwriting/principals?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch principals for export")
      }

      const data = await res.json()
      const principals = data.principals

      // Create CSV content
      const csvContent = [
        [
          "Enrollee ID",
          "Name",
          "Email",
          "Phone",
          "Organization",
          "Plan",
          "Account Type",
          "Status",
          "Primary Hospital",
          "Created Date",
        ],
        ...principals.map((principal: Principal) => [
          principal.enrollee_id,
          `${principal.first_name} ${principal.last_name}`,
          principal.email || "",
          principal.phone_number || "",
          principal.organization.name,
          principal.plan?.name || "N/A",
          principal.account_type,
          principal.status,
          principal.primary_hospital || "",
          new Date(principal.created_at).toLocaleDateString(),
        ]),
      ]
        .map((row) => row.map((field: any) => `"${field}"`).join(","))
        .join("\n")

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `principals-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: "Principals data has been exported successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  if (isLoading && !principalsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Error loading principals: {(error as Error).message}</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Principal Accounts</h1>
          <p className="text-gray-600">Manage principal accounts and enrollees</p>
        </div>
        <div className="flex items-center gap-4">
          <PermissionButton
            module="underwriting"
            action="view"
            variant="outline"
            onClick={handleCopyPublicLink}
          >
            <Link2 className="h-4 w-4 mr-2" />
            Copy Public Link
          </PermissionButton>
          <PermissionButton
            module="underwriting"
            action="view"
            variant="outline"
            onClick={exportPrincipals}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </PermissionButton>
          <PermissionButton
            module="underwriting"
            action="add"
            variant="outline"
            onClick={handleBulkUpload}
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </PermissionButton>
          <PermissionButton
            module="underwriting"
            action="add"
            onClick={handleAddPrincipal}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Principal Account
          </PermissionButton>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name or ID..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Organization</label>
              <Select
                value={organizationFilter}
                onValueChange={(value) => handleFilterChange("organization", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Plan</label>
              <Select
                value={planFilter}
                onValueChange={(value) => handleFilterChange("plan", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end items-center mt-4">
            <div className="text-xs text-gray-500">
              Showing {principals.length} of {pagination?.total || 0} principals
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Principals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Enrollees</CardTitle>
          <CardDescription>
            Manage principal accounts and their associated information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
              Updating table...
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ORGANIZATION</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PLAN</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PHONE NUMBER</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">HOSPITAL</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {principals.map((principal) => (
                  <TableRow key={principal.id}>
                    <TableCell className="font-medium text-xs">
                      <Link
                        href={`/underwriting/principals/${principal.id}`}
                        className="text-[#BE1522] hover:text-[#9B1219] hover:underline"
                      >
                        {principal.enrollee_id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-400">
                            {principal.first_name?.[0]}{principal.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {principal.first_name} {principal.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {principal.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-xs">{principal.organization.name}</div>
                        <div className="text-xs text-gray-500">
                          {principal.organization.code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {principal.plan ? (
                        <div>
                          <div className="font-medium text-xs">{principal.plan.name}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">No Plan</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {principal.phone_number || (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {principal.primary_hospital || (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusText status={principal.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu
                        open={openDropdownId === principal.id}
                        onOpenChange={(open) => setOpenDropdownId(open ? principal.id : null)}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <PermissionButton
                            module="underwriting"
                            action="view"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewPrincipal(principal.id)}
                            className="w-full justify-start text-xs"
                          >
                            View
                          </PermissionButton>
                          <PermissionButton
                            module="underwriting"
                            action="view"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewIDCard(principal.id)}
                            className="w-full justify-start text-xs"
                          >
                            View ID Card
                          </PermissionButton>
                          <PermissionButton
                            module="underwriting"
                            action="edit"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPrincipal(principal.id)}
                            className="w-full justify-start text-xs"
                          >
                            Edit
                          </PermissionButton>
                          <PermissionButton
                            module="underwriting"
                            action="edit"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleChangeStatus(principal)}
                            className="w-full justify-start text-xs"
                          >
                            Change Status
                          </PermissionButton>
                          <PermissionButton
                            module="underwriting"
                            action="delete"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 w-full justify-start text-xs"
                            onClick={() => handleDelete(principal)}
                          >
                            Delete
                          </PermissionButton>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-xs text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm">
                  Page {page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Change Modal */}
      {showStatusModal && selectedPrincipal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Change Status</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStatusModal(false)}
                  disabled={isChangingStatus}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="principal-name">Principal</Label>
                <Input
                  id="principal-name"
                  value={`${selectedPrincipal.first_name} ${selectedPrincipal.last_name}`}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              <div>
                <Label htmlFor="new-status">New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for status change..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
            <CardContent className="pt-0">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowStatusModal(false)}
                  disabled={isChangingStatus}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStatusChange}
                  disabled={!newStatus || isChangingStatus}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  {isChangingStatus ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Changing...
                    </>
                  ) : (
                    "Change Status"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        module="underwriting"
        submodule="principals"
        onUploadSuccess={handleBulkUploadSuccess}
        uploadEndpoint="/api/underwriting/principals/bulk-upload"
        sampleFileName="principals-sample.xlsx"
        acceptedColumns={[
          "first_name",
          "last_name",
          "organization_id",
          "account_type",
          "enrollee_id",
          "middle_name",
          "email",
          "phone_number",
          "gender",
          "date_of_birth",
          "organization_code",
          "plan_id",
          "plan_name",
          "utilization",
          "marital_status",
          "region",
          "residential_address",
          "primary_hospital"
        ]}
        requiredColumns={[
          "First Name",
          "Last Name"
        ]}
      />

      {/* ID Card Viewer Modal */}
      {selectedEnrolleeId && (
        <IDCardViewer
          isOpen={showIDCard}
          onClose={() => {
            setShowIDCard(false)
            setSelectedEnrolleeId(null)
          }}
          enrolleeId={selectedEnrolleeId}
          enrolleeType="principal"
        />
      )}
    </div>
  )
}
