"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { IDCardViewer } from "@/components/id-card/id-card-viewer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PermissionGate } from "@/components/ui/permission-gate"
import { PermissionButton } from "@/components/ui/permission-button"
import { AddDependentForm } from "@/components/forms/add-dependent-form"
import { EditDependentForm } from "@/components/forms/edit-dependent-form"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"
import {
  Plus,
  Download,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  X,
  Upload,
} from "lucide-react"
import {


  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function DependentsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOrganization, setSelectedOrganization] = useState("all")
  const [selectedPlan, setSelectedPlan] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedDependent, setSelectedDependent] = useState<any>(null)

  // Status change modal state
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedDependentForStatus, setSelectedDependentForStatus] = useState<any>(null)
  const [newStatus, setNewStatus] = useState("")
  const [statusReason, setStatusReason] = useState("")
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [showIDCard, setShowIDCard] = useState(false)
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  // Bulk upload state
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim())
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch dependents data
  const { data: dependentsData, isLoading, refetch } = useQuery({
    queryKey: ["dependents", searchTerm, selectedOrganization, selectedPlan, selectedStatus, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)
      if (selectedOrganization !== "all") params.append("organization", selectedOrganization)
      if (selectedPlan !== "all") params.append("plan", selectedPlan)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      params.append("page", currentPage.toString())
      params.append("limit", "10")

      const res = await fetch(`/api/underwriting/dependents?${params}`)
      if (!res.ok) throw new Error("Failed to fetch dependents")
      return res.json()
    }
  })

  // Fetch organizations for filter
  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations?limit=1000")
      if (!res.ok) throw new Error("Failed to fetch organizations")
      return res.json()
    }
  })

  // Fetch plans for filter
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/plans")
      if (!res.ok) throw new Error("Failed to fetch plans")
      return res.json()
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (dependentId: string) => {
      const res = await fetch(`/api/underwriting/dependents/${dependentId}`, {
        method: "DELETE"
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete dependent")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Dependent deleted successfully",
        description: "The dependent has been removed from the system."
      })
      queryClient.invalidateQueries({ queryKey: ["dependents"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleViewDependent = (dependent: any) => {
    setOpenDropdownId(null)
    router.push(`/underwriting/dependents/${dependent.id}`)
  }

  const handleViewIDCard = (enrolleeId: string) => {
    setOpenDropdownId(null)
    setSelectedEnrolleeId(enrolleeId)
    setShowIDCard(true)
  }

  const handleEditDependent = (dependent: any) => {
    setOpenDropdownId(null)
    setSelectedDependent(dependent)
    setShowEditModal(true)
  }

  const handleDeleteDependent = async (dependent: any) => {
    setOpenDropdownId(null)
    if (!confirm(`Delete dependent "${dependent.first_name} ${dependent.last_name}"?`)) return

    try {
      await deleteMutation.mutateAsync(dependent.id)
    } catch (error) {
      console.error('Error deleting dependent:', error)
    }
  }

  const handleChangeStatus = (dependent: any) => {
    setOpenDropdownId(null)
    setSelectedDependentForStatus(dependent)
    setNewStatus(dependent.status)
    setStatusReason("")
    setShowStatusModal(true)
  }

  const handleStatusChange = async () => {
    if (!selectedDependentForStatus || !newStatus || isChangingStatus) return

    setIsChangingStatus(true)

    try {
      const response = await fetch(`/api/underwriting/dependents/${selectedDependentForStatus.id}/status`, {
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
      setSelectedDependentForStatus(null)
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

  const handleApplyFilters = () => {
    refetch()
  }

  const handleBulkUpload = () => {
    setShowBulkUploadModal(true)
  }

  const handleBulkUploadSuccess = (data: any[]) => {
    toast({
      title: "Bulk Upload Successful",
      description: `${data.length} dependents uploaded successfully`,
    })
    queryClient.invalidateQueries({ queryKey: ["dependents"] })
    setShowBulkUploadModal(false)
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)
      if (selectedOrganization !== "all") params.append("organization", selectedOrganization)
      if (selectedPlan !== "all") params.append("plan", selectedPlan)
      if (selectedStatus !== "all") params.append("status", selectedStatus)

      const res = await fetch(`/api/underwriting/dependents/export?${params}`)
      if (!res.ok) throw new Error("Failed to export dependents")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dependents-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export successful",
        description: "Dependents data has been exported successfully."
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export dependents data.",
        variant: "destructive"
      })
    }
  }

  const getStatusColor = (status: string) => {
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

  const getRelationshipColor = (relationship: string) => {
    switch (relationship) {
      case "SPOUSE":
        return "bg-blue-100 text-blue-800"
      case "CHILD":
        return "bg-purple-100 text-purple-800"
      case "PARENT":
        return "bg-orange-100 text-orange-800"
      case "SIBLING":
        return "bg-pink-100 text-pink-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const dependents = dependentsData?.dependents || []
  const pagination = dependentsData?.pagination

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dependents</h1>
          <p className="text-muted-foreground">
            Manage dependent accounts and their information
          </p>
        </div>
        <div className="flex items-center gap-4">
          <PermissionButton
            module="underwriting"
            action="view"
            variant="outline"
            onClick={handleExport}
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
          <PermissionGate module="underwriting" action="create">
            <Button onClick={() => setShowAddModal(true)} className="bg-[#0891B2] hover:bg-[#9B1219] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Dependent
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Search by name or ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            {organizationsData?.organizations?.map((org: any) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedPlan} onValueChange={setSelectedPlan}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            {plansData?.plans?.map((plan: any) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full sm:w-[200px]">
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

      {/* Dependents Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Dependents</CardTitle>
        </CardHeader>
        <CardContent>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DEPENDENT NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">RELATIONSHIP</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ORGANIZATION</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PLAN</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PHONE NUMBER</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">HOSPITAL</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dependents.map((dependent: any) => (
                  <TableRow key={dependent.id}>
                    <TableCell className="font-medium text-xs">
                      {dependent.dependent_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-400">
                            {dependent.first_name?.[0]}{dependent.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {dependent.first_name} {dependent.last_name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {dependent.relationship}
                    </TableCell>
                    <TableCell className="text-xs">{dependent.principal?.organization?.name}</TableCell>
                    <TableCell className="text-xs">{dependent.principal?.plan?.name}</TableCell>
                    <TableCell className="text-xs">{dependent.phone_number || "N/A"}</TableCell>
                    <TableCell className="text-xs">{dependent.principal?.primary_hospital || "N/A"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(dependent.status)}`}>
                        {dependent.status.charAt(0) + dependent.status.slice(1).toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu
                        open={openDropdownId === dependent.id}
                        onOpenChange={(open) => setOpenDropdownId(open ? dependent.id : null)}
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
                            onClick={() => handleViewDependent(dependent)}
                            className="w-full justify-start text-xs"
                          >
                            View
                          </PermissionButton>
                          <PermissionButton
                            module="underwriting"
                            action="view"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewIDCard(dependent.id)}
                            className="w-full justify-start text-xs"
                          >
                            View ID Card
                          </PermissionButton>
                          <PermissionButton
                            module="underwriting"
                            action="edit"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditDependent(dependent)}
                            className="w-full justify-start text-xs"
                          >
                            Edit
                          </PermissionButton>
                          <PermissionButton
                            module="underwriting"
                            action="edit"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleChangeStatus(dependent)}
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
                            onClick={() => handleDeleteDependent(dependent)}
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
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dependent Modal */}
      <PermissionGate module="underwriting" action="create">
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Add New Dependent</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Create a new dependent account for an existing principal.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddDependentForm
                  onSuccess={() => {
                    setShowAddModal(false)
                    queryClient.invalidateQueries({ queryKey: ["dependents"] })
                  }}
                  onCancel={() => setShowAddModal(false)}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>

      {/* Edit Dependent Modal */}
      <PermissionGate module="underwriting" action="update">
        {showEditModal && selectedDependent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Edit Dependent</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedDependent(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Update dependent information and details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EditDependentForm
                  dependent={selectedDependent}
                  onSuccess={() => {
                    setShowEditModal(false)
                    setSelectedDependent(null)
                    queryClient.invalidateQueries({ queryKey: ["dependents"] })
                  }}
                  onCancel={() => {
                    setShowEditModal(false)
                    setSelectedDependent(null)
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>

      {/* Status Change Modal */}
      {showStatusModal && selectedDependentForStatus && (
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
                <Label htmlFor="dependent-name">Dependent</Label>
                <Input
                  id="dependent-name"
                  value={`${selectedDependentForStatus.first_name} ${selectedDependentForStatus.last_name}`}
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
                  className="bg-[#0891B2] hover:bg-[#9B1219]"
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

      {/* ID Card Viewer Modal */}
      {selectedEnrolleeId && (
        <IDCardViewer
          isOpen={showIDCard}
          onClose={() => {
            setShowIDCard(false)
            setSelectedEnrolleeId(null)
          }}
          enrolleeId={selectedEnrolleeId}
          enrolleeType="dependent"
        />
      )}

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        module="underwriting"
        submodule="dependents"
        onUploadSuccess={handleBulkUploadSuccess}
        uploadEndpoint="/api/underwriting/dependents/bulk-upload"
        sampleFileName="dependents-sample.xlsx"
        acceptedColumns={[
          "dependent_id",
          "first_name",
          "last_name",
          "middle_name",
          "date_of_birth",
          "relationship",
          "gender",
          "phone_number",
          "email",
          "residential_address",
          "state",
          "lga",
          "utilization",
          "principal_id",
          "principal_enrollee_id"
        ]}
        requiredColumns={[
          "Dependent ID",
          "Principal Enrollee ID",
        ]}
      />
    </div>
  )
}
