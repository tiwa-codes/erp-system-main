"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"
import { 


  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  Shield,
  Upload,
  Building2,
  Users,
  MoreHorizontal,
  X
} from "lucide-react"

interface PlanBand {
  id: string
  plan_id: string
  plan: {
    name: string
  }
  provider_id: string
  provider: {
    facility_name: string
    hcp_code: string
  }
  band_type: string
  status: "ACTIVE" | "INACTIVE"
  created_at: string
  updated_at: string
}

interface Plan {
  id: string
  name: string
}

interface Provider {
  id: string
  facility_name: string
  hcp_code: string
}

export default function ProviderPlansPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedBand, setSelectedBand] = useState<PlanBand | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Form state
  const [formData, setFormData] = useState({
    plan_id: "",
    provider_id: "",
    band_type: ""
  })

  // Fetch band labels
  const { data: bandLabelsData } = useQuery({
    queryKey: ["band-labels"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/band-labels?status=ACTIVE")
      if (!res.ok) throw new Error("Failed to fetch band labels")
      return res.json()
    }
  })

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch plan bands
  const { data: planBandsData, isLoading } = useQuery({
    queryKey: ["plan-bands", currentPage, pageSize, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm
      })
      const res = await fetch(`/api/settings/provider-plans?${params}`)
      if (!res.ok) throw new Error("Failed to fetch provider plans")
      return res.json()
    },
  })

  // Fetch plans
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/plans")
      if (!res.ok) throw new Error("Failed to fetch plans")
      return res.json()
    },
  })

  // Fetch providers
  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers")
      if (!res.ok) throw new Error("Failed to fetch providers")
      return res.json()
    },
  })

  // Create plan band mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/settings/provider-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to create provider plan')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider plan created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["plan-bands"] })
      setShowAddModal(false)
      setFormData({
        plan_id: "",
        provider_id: "",
        band_type: ""
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create provider plan",
        variant: "destructive",
      })
    },
  })

  // Update plan band mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/settings/provider-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update provider plan')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider plan updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["plan-bands"] })
      setShowEditModal(false)
      setSelectedBand(null)
      setFormData({
        plan_id: "",
        provider_id: "",
        band_type: ""
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update provider plan",
        variant: "destructive",
      })
    },
  })

  // Delete plan band mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/provider-plans/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete provider plan')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider plan deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["plan-bands"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete provider plan",
        variant: "destructive",
      })
    },
  })

  const planBands: PlanBand[] = planBandsData?.planBands || []
  const totalCount = planBandsData?.totalCount || 0
  const totalPages = Math.ceil(totalCount / pageSize)
  const plans: Plan[] = plansData?.plans || []
  const providers: Provider[] = providersData?.providers || []

  const handleAddBand = () => {
    createMutation.mutate(formData)
  }

  const handleEditBand = () => {
    if (selectedBand) {
      updateMutation.mutate({ id: selectedBand.id, data: formData })
    }
  }

  const handleEditClick = (band: PlanBand) => {
    setSelectedBand(band)
    setFormData({
      plan_id: band.plan_id,
      provider_id: band.provider_id,
      band_type: band.band_type
    })
    setShowEditModal(true)
  }

  const handleDeleteClick = (id: string) => {
    if (confirm("Are you sure you want to delete this provider plan?")) {
      deleteMutation.mutate(id)
    }
  }

  const handleBulkUploadSuccess = (data: any[]) => {
    toast({
      title: "Bulk upload completed",
      description: `Successfully uploaded ${data.length} provider plans`,
    })
    queryClient.invalidateQueries({ queryKey: ["plan-bands"] })
  }

  const handleViewClick = (band: PlanBand) => {
    setSelectedBand(band)
    setShowViewModal(true)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getBandBadgeColor = (bandType: string) => {
    switch (bandType) {
      case "A":
        return "bg-blue-100 text-blue-800"
      case "B":
        return "bg-green-100 text-green-800"
      case "C":
        return "bg-yellow-100 text-yellow-800"
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

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider Plans</h1>
          <p className="text-gray-600 mt-1">Assign providers to plans and bands</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="text-blue-600"
            onClick={() => setShowBulkUploadModal(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-[#0891B2] hover:bg-[#9B1219]">
            <Plus className="h-4 w-4 mr-2" />
            Assign Provider to Plan
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search provider plans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Provider Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Plans</CardTitle>
          <CardDescription className="mt-2">
            Manage provider assignments to plans and bands
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">PLAN NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">BAND TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planBands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No provider plans found.
                    </TableCell>
                  </TableRow>
                ) : (
                  planBands.map((band) => (
                    <TableRow key={band.id}>
                      <TableCell>
                        <div>
                          <div className="text-sm text-gray-900">{band.plan.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-red-400">
                              {band.provider.facility_name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-900">{band.provider.facility_name}</div>
                            <div className="text-sm text-gray-500">{band.provider.hcp_code}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">{band.band_type}</div>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={band.status} />
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
                              onClick={() => handleViewClick(band)}
                              className="w-full justify-start text-xs"
                            >
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEditClick(band)}
                              className="w-full justify-start text-xs"
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(band.id)}
                              className="text-red-600 w-full justify-start text-xs"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Provider Plan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Assign Provider to Plan</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                Assign a provider to a plan and set their band type.
              </CardDescription>
            </CardHeader>
            <CardContent>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan_id">Select Plan</Label>
              <Select 
                value={formData.plan_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, plan_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider_id">Select Provider</Label>
              <Select 
                value={formData.provider_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, provider_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.facility_name} ({provider.hcp_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="band_type">Band Type</Label>
              <Select 
                value={formData.band_type} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, band_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Band Type" />
                </SelectTrigger>
                <SelectContent>
                  {bandLabelsData?.band_labels?.map((bandLabel: any) => (
                    <SelectItem key={bandLabel.id} value={bandLabel.label}>
                      {bandLabel.label}
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddBand} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Provider Plan Modal */}
      {showEditModal && selectedBand && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Edit Provider Plan</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                Update the provider plan assignment.
              </CardDescription>
            </CardHeader>
            <CardContent>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_plan_id">Select Plan</Label>
              <Select 
                value={formData.plan_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, plan_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_provider_id">Select Provider</Label>
              <Select 
                value={formData.provider_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, provider_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.facility_name} ({provider.hcp_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_band_type">Band Type</Label>
              <Select 
                value={formData.band_type} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, band_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Band Type" />
                </SelectTrigger>
                <SelectContent>
                  {bandLabelsData?.band_labels?.map((bandLabel: any) => (
                    <SelectItem key={bandLabel.id} value={bandLabel.label}>
                      {bandLabel.label}
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditBand} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Provider Plan Modal */}
      {showViewModal && selectedBand && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Provider Plan Details</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowViewModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                View details of the selected provider plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Plan</Label>
                  <p className="text-sm font-medium">{selectedBand.plan.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Provider</Label>
                  <p className="text-sm font-medium">{selectedBand.provider.facility_name} ({selectedBand.provider.hcp_code})</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Band Type</Label>
                  <p className="text-sm text-gray-900">{selectedBand.band_type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <StatusIndicator status={selectedBand.status} />
                </div>
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
        module="settings"
        submodule="provider-plans"
        onUploadSuccess={handleBulkUploadSuccess}
        uploadEndpoint="/api/settings/bulk-upload"
        sampleFileName="provider-plans-sample.xlsx"
        acceptedColumns={["Plan Name", "Provider Name", "Band Type"]}
        maxFileSize={200}
      />
    </div>
  )
}
