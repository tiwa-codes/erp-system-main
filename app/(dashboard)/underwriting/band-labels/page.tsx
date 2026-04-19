"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { PermissionGate } from "@/components/ui/permission-gate"
import { PermissionButton } from "@/components/ui/permission-button"
import { useToast } from "@/hooks/use-toast"
import { Plus, Search, Edit, Trash2, Eye, Save, X } from "lucide-react"

interface BandLabel {
  id: string
  label: string
  description?: string
  status: string
  created_at: string
  updated_at: string
}

interface BandLabelFormData {
  label: string
  description: string
  status: string
}

export default function BandLabelsPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedBandLabel, setSelectedBandLabel] = useState<BandLabel | null>(null)
  const [formData, setFormData] = useState<BandLabelFormData>({
    label: "",
    description: "",
    status: "ACTIVE"
  })

  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch band labels
  const { data: bandLabelsData, isLoading, refetch } = useQuery({
    queryKey: ["band-labels", search, status, currentPage, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (status && status !== "all") params.append("status", status)
      params.append("page", currentPage.toString())
      params.append("limit", pageSize.toString())

      const res = await fetch(`/api/underwriting/band-labels?${params}`)
      if (!res.ok) throw new Error("Failed to fetch band labels")
      return res.json()
    }
  })

  // Create band label mutation
  const createBandLabelMutation = useMutation({
    mutationFn: async (data: BandLabelFormData) => {
      const res = await fetch("/api/underwriting/band-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create band label")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Band label created successfully"
      })
      queryClient.invalidateQueries({ queryKey: ["band-labels"] })
      setIsAddModalOpen(false)
      setFormData({ label: "", description: "", status: "ACTIVE" })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create band label",
        variant: "destructive"
      })
    }
  })

  // Update band label mutation
  const updateBandLabelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BandLabelFormData }) => {
      const res = await fetch(`/api/underwriting/band-labels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update band label")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Band label updated successfully"
      })
      queryClient.invalidateQueries({ queryKey: ["band-labels"] })
      setIsEditModalOpen(false)
      setSelectedBandLabel(null)
      setFormData({ label: "", description: "", status: "ACTIVE" })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update band label",
        variant: "destructive"
      })
    }
  })

  // Delete band label mutation
  const deleteBandLabelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/underwriting/band-labels/${id}`, {
        method: "DELETE"
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete band label")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Band label deleted successfully"
      })
      queryClient.invalidateQueries({ queryKey: ["band-labels"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete band label",
        variant: "destructive"
      })
    }
  })

  const handleAddBandLabel = () => {
    if (!formData.label.trim()) {
      toast({
        title: "Error",
        description: "Band label is required",
        variant: "destructive"
      })
      return
    }

    createBandLabelMutation.mutate(formData)
  }

  const handleEditBandLabel = () => {
    if (!selectedBandLabel || !formData.label.trim()) {
      toast({
        title: "Error",
        description: "Band label is required",
        variant: "destructive"
      })
      return
    }

    updateBandLabelMutation.mutate({
      id: selectedBandLabel.id,
      data: formData
    })
  }

  const handleDeleteBandLabel = (bandLabel: BandLabel) => {
    if (confirm(`Are you sure you want to delete "${bandLabel.label}"?`)) {
      deleteBandLabelMutation.mutate(bandLabel.id)
    }
  }

  const handleViewBandLabel = (bandLabel: BandLabel) => {
    setSelectedBandLabel(bandLabel)
    setIsViewModalOpen(true)
  }

  const handleEditClick = (bandLabel: BandLabel) => {
    setSelectedBandLabel(bandLabel)
    setFormData({
      label: bandLabel.label,
      description: bandLabel.description || "",
      status: bandLabel.status
    })
    setIsEditModalOpen(true)
  }

  const handleFilterChange = () => {
    setCurrentPage(1)
    refetch()
  }

  const bandLabels = bandLabelsData?.band_labels || []
  const pagination = bandLabelsData?.pagination || { total: 0, pages: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Band Labels</h1>
          <p className="text-gray-600">Manage band labels for provider plans and plans</p>
        </div>
        <PermissionGate module="underwriting" action="add">
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-[#BE1522] hover:bg-[#9B1219]">
            <Plus className="h-4 w-4 mr-2" />
            Add Band Label
          </Button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search band labels..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pageSize">Page Size</Label>
              <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleFilterChange} className="bg-[#BE1522] hover:bg-[#9B1219] w-full">
                <Search className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Band Labels Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Band Labels</CardTitle>
          <CardDescription>
            {pagination.total} band label(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : bandLabels.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No band labels found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">LABEL</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DESCRIPTION</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CREATED</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bandLabels.map((bandLabel: BandLabel) => (
                      <TableRow key={bandLabel.id}>
                        <TableCell className="font-medium">
                          <div className="text-sm text-gray-900">{bandLabel.label}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-900">
                            {bandLabel.description || "No description"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusIndicator status={bandLabel.status} />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-900">
                            {new Date(bandLabel.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <PermissionButton
                              module="underwriting"
                              action="view"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewBandLabel(bandLabel)}
                            >
                              <Eye className="h-4 w-4" />
                            </PermissionButton>
                            <PermissionButton
                              module="underwriting"
                              action="edit"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(bandLabel)}
                            >
                              <Edit className="h-4 w-4" />
                            </PermissionButton>
                            <PermissionButton
                              module="underwriting"
                              action="delete"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBandLabel(bandLabel)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </PermissionButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-700">
                      Page {currentPage} of {pagination.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                      disabled={currentPage === pagination.pages}
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

      {/* Add Band Label Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Band Label</DialogTitle>
            <DialogDescription>
              Create a new band label for provider plans and plans
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                placeholder="e.g., A, B, C"
                value={formData.label}
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter description (optional)"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddBandLabel}
              disabled={createBandLabelMutation.isPending}
              className="bg-[#BE1522] hover:bg-[#9B1219]"
            >
              {createBandLabelMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Band Label Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Band Label</DialogTitle>
            <DialogDescription>
              Update the band label information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-label">Label *</Label>
              <Input
                id="edit-label"
                placeholder="e.g., A, B, C"
                value={formData.label}
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Enter description (optional)"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditBandLabel}
              disabled={updateBandLabelMutation.isPending}
              className="bg-[#BE1522] hover:bg-[#9B1219]"
            >
              {updateBandLabelMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Band Label Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Band Label Details</DialogTitle>
            <DialogDescription>
              View band label information
            </DialogDescription>
          </DialogHeader>
          {selectedBandLabel && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Label</Label>
                <p className="text-sm text-gray-900">{selectedBandLabel.label}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Description</Label>
                <p className="text-sm text-gray-900">
                  {selectedBandLabel.description || "No description"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <div className="mt-1">
                  <StatusIndicator status={selectedBandLabel.status} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Created</Label>
                <p className="text-sm text-gray-900">
                  {new Date(selectedBandLabel.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
                <p className="text-sm text-gray-900">
                  {new Date(selectedBandLabel.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

