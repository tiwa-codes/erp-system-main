"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Building2,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Download,
  Users,
  Calendar,
  MapPin,
  Phone,
  Mail,
  FileText,
  MoreHorizontal,
  X,
  UserCheck,
  Upload
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddOrganizationForm } from "@/components/forms/add-organization-form"
import { EditOrganizationForm } from "@/components/forms/edit-organization-form"
import { PermissionButton } from "@/components/ui/permission-button"
import { PermissionGate } from "@/components/ui/permission-gate"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"



export default function OrganizationsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [searchInput, setSearchInput] = useState("") // User's input
  const [searchTerm, setSearchTerm] = useState("") // Actual search query
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedState, setSelectedState] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState<any>(null)
  const [newStatus, setNewStatus] = useState("")
  const [statusReason, setStatusReason] = useState("")
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  
  // Bulk upload state
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)

  // Handle search
  const handleSearchClick = () => {
    setSearchTerm(searchInput)
    setCurrentPage(1)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchClick()
    }
  }

  const handleClearSearch = () => {
    setSearchInput("")
    setSearchTerm("")
    setCurrentPage(1)
  }

  // Fetch organizations data
  const { data: organizationsData, isLoading, refetch } = useQuery({
    queryKey: ["organizations", searchTerm, selectedStatus, selectedState, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (selectedState !== "all") params.append("state", selectedState)
      params.append("page", currentPage.toString())
      params.append("limit", "10")
      
      const res = await fetch(`/api/organizations?${params}`)
      if (!res.ok) throw new Error("Failed to fetch organizations")
      return res.json()
    }
  })

  const organizations = organizationsData?.organizations || []
  const pagination = organizationsData?.pagination

  const handleAddOrganization = () => {
    setShowAddModal(true)
  }

  const handleViewOrganization = (org: any) => {
    router.push(`/underwriting/organizations/${org.id}`)
  }

  const handleEditOrganization = (org: any) => {
    setSelectedOrganization(org)
    setShowEditModal(true)
  }

  const handleDeleteOrganization = async (org: any) => {
    if (!confirm(`Delete organization "${org.name}" (${org.code})? This action cannot be undone.`)) return

    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete organization')
      }

      toast({
        title: "Organization deleted successfully",
        description: `${org.name} has been deleted from the system.`
      })
      
      refetch()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete organization",
        variant: "destructive"
      })
    }
  }

  const handleChangeStatus = (org: any) => {
    setSelectedOrganization(org)
    setNewStatus("")
    setStatusReason("")
    setShowStatusModal(true)
  }

  const handleStatusChange = async () => {
    if (!selectedOrganization || !newStatus || isChangingStatus) return

    setIsChangingStatus(true)

    try {
      const response = await fetch(`/api/organizations/${selectedOrganization.id}/status`, {
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
      setSelectedOrganization(null)
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

  const handleBulkUpload = () => {
    setShowBulkUploadModal(true)
  }

  const handleBulkUploadSuccess = (data: any[]) => {
    toast({
      title: "Bulk Upload Successful",
      description: `${data.length} organizations uploaded successfully`,
    })
    refetch()
    setShowBulkUploadModal(false)
  }

  const handleExport = async () => {
    try {
      // Build export parameters
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (selectedState !== "all") params.append("state", selectedState)

      const response = await fetch(`/api/organizations/export?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to export organizations')
      }

      // Get the CSV content
      const csvContent = await response.text()
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `organizations-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: "Organizations data has been exported successfully."
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export organizations",
        variant: "destructive"
      })
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800"
      case "INACTIVE": return "bg-yellow-100 text-yellow-800"
      case "SUSPENDED": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getAccountTypeBadgeColor = (accountType: string) => {
    switch (accountType) {
      case "CORPORATE": return "bg-blue-100 text-blue-800"
      case "INDIVIDUAL": return "bg-purple-100 text-purple-800"
      case "GOVERNMENT": return "bg-green-100 text-green-800"
      default: return "bg-gray-100 text-gray-800"
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-600">Manage organization accounts and details</p>
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
          <PermissionButton 
            module="underwriting" 
            action="add"
            onClick={handleAddOrganization} 
            className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Organization
          </PermissionButton>
        </div>
      </div>

      {/* Search and Filter Section */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search organizations..."
                  className="pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                />
              </div>
              <Button onClick={handleSearchClick} variant="default">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              {searchTerm && (
                <Button onClick={handleClearSearch} variant="outline">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-4">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="Lagos">Lagos</SelectItem>
                  <SelectItem value="Abuja">Abuja</SelectItem>
                  <SelectItem value="Kano">Kano</SelectItem>
                  <SelectItem value="Rivers">Rivers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">ORGANIZATION</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">CONTACT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ACCOUNT TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">LOCATION</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEES</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org: any) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-400">
                            {org.name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{org.name}</div>
                          <div className="text-xs text-gray-500">ID: {org.organization_code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-900">
                        {org.contact_info?.contactNumber || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-900">
                        {org.type}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-900">
                        {org.contact_info?.state || "N/A"}, {org.contact_info?.lga || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusBadgeColor(org.status)} text-xs`}>
                        {org.status.charAt(0) + org.status.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div className="text-gray-900">{org.active_principals_count + (org.active_dependents_count || 0)}/{org.principals_count + (org.dependents_count || 0)}</div>
                        <div className="text-gray-500">Active/Total</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
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
                            onClick={() => handleViewOrganization(org)}
                            className="w-full justify-start text-xs"
                          >
                            View
                          </PermissionButton>
                          <PermissionButton 
                            module="underwriting" 
                            action="edit"
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditOrganization(org)}
                            className="w-full justify-start text-xs"
                          >
                            Edit
                          </PermissionButton>
                          <PermissionButton 
                            module="underwriting" 
                            action="edit"
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleChangeStatus(org)}
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
                            onClick={() => handleDeleteOrganization(org)}
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
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Organization Modal */}
      <PermissionGate module="underwriting" action="add">
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Add Organization</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Add a new organization to the system</CardDescription>
              </CardHeader>
              <CardContent>
                <AddOrganizationForm 
                  onClose={() => setShowAddModal(false)} 
                  onCreated={() => { 
                    setShowAddModal(false)
                    refetch()
                  }} 
                />
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>

      {/* Edit Organization Modal */}
      <PermissionGate module="underwriting" action="edit">
        {showEditModal && selectedOrganization && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Edit Organization</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedOrganization(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Update organization details</CardDescription>
              </CardHeader>
              <CardContent>
                <EditOrganizationForm
                  organization={selectedOrganization || {}}
                  onClose={() => { 
                    setShowEditModal(false)
                    setSelectedOrganization(null)
                  }}
                  onUpdated={() => { 
                    setShowEditModal(false)
                    refetch()
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </PermissionGate>


      {/* Status Change Modal */}
      {showStatusModal && selectedOrganization && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Change Organization Status</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStatusModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                Change status for {selectedOrganization.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="currentStatus">Current Status</Label>
                  <div className="text-sm text-gray-600 mt-1">
                    <Badge className={getStatusBadgeColor(selectedOrganization.status)}>
                      {selectedOrganization.status.charAt(0) + selectedOrganization.status.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label htmlFor="newStatus">New Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new status" />
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
                  <Input
                    id="reason"
                    placeholder="Enter reason for status change"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                  />
                </div>
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
        submodule="organizations"
        onUploadSuccess={handleBulkUploadSuccess}
        uploadEndpoint="/api/organizations/bulk-upload"
        sampleFileName="organizations-sample.xlsx"
        acceptedColumns={[
          "name",
          "code",
          "type",
          "address",
          "phone",
          "email",
          "contact_person",
          "registration_number"
        ]}
      />
    </div>
  )
}
