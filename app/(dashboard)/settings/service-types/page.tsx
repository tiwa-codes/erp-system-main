"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
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
  Package,
  Upload,
  MoreHorizontal,
  X
} from "lucide-react"

interface ServiceType {
  id: string
  service_name: string
  service_category: string
  service_type?: "PRIMARY_SERVICE" | "SECONDARY_SERVICE" | null
  nhia_price?: number | null
  is_nhia_service?: boolean
  created_at: string
  updated_at: string
}

interface Category {
  id: string
  name: string
  description: string
}

const SERVICE_TYPES = [
  { value: "PRIMARY_SERVICE", label: "Primary Service" },
  { value: "SECONDARY_SERVICE", label: "Secondary Service" }
]

export default function ServiceTypesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Form state
  const [formData, setFormData] = useState({
    service_name: "",
    service_category: "",
    service_type: "",
    nhia_price: "",
    is_nhia_service: false
  })

  // Load categories from JSON file
  useEffect(() => {
    fetch('/plan_categories.json')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Error loading categories:', err))
  }, [])

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch service types
  const { data: serviceTypesData, isLoading } = useQuery({
    queryKey: ["service-types", currentPage, pageSize, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm
      })
      const res = await fetch(`/api/settings/service-types?${params}`)
      if (!res.ok) throw new Error("Failed to fetch service types")
      return res.json()
    },
  })

  // Create service type mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/settings/service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to create service type')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service type created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["service-types"] })
      setShowAddModal(false)
      setFormData({
        service_name: "",
        service_category: "",
        service_type: "",
        nhia_price: "",
        is_nhia_service: false
      })
    },
    onError: (error: any) => {
      // Extract specific error message from API response
      const errorMessage = error.response?.data?.error || error.message || "Failed to create service type"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    },
  })

  // Update service type mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/settings/service-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update service type')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service type updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["service-types"] })
      setShowEditModal(false)
      setSelectedService(null)
      setFormData({
        service_name: "",
        service_category: "",
        service_type: "",
        nhia_price: "",
        is_nhia_service: false
      })
    },
    onError: (error: any) => {
      // Extract specific error message from API response
      const errorMessage = error.response?.data?.error || error.message || "Failed to update service type"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    },
  })

  // Delete service type mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/service-types/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete service type')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service type deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["service-types"] })
    },
    onError: (error: any) => {
      // Extract specific error message from API response
      const errorMessage = error.response?.data?.error || error.message || "Failed to delete service type"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    },
  })

  const serviceTypes: ServiceType[] = serviceTypesData?.serviceTypes || []
  const pagination = serviceTypesData?.pagination || {
    page: currentPage,
    limit: pageSize,
    total: serviceTypesData?.totalCount || 0,
    pages: Math.ceil((serviceTypesData?.totalCount || 0) / pageSize)
  }

  // Service types are already filtered by the API based on search term
  const filteredServiceTypes = serviceTypes

  const handleAddService = () => {
    createMutation.mutate(formData)
  }

  const handleEditService = () => {
    if (selectedService) {
      updateMutation.mutate({ id: selectedService.id, data: formData })
    }
  }

  const handleEditClick = (service: ServiceType) => {
    setSelectedService(service)
    setFormData({
      service_name: service.service_name,
      service_category: service.service_category,
      service_type: service.service_type || "",
      nhia_price: service.nhia_price?.toString() || "",
      is_nhia_service: service.is_nhia_service || false
    })
    setShowEditModal(true)
  }

  const handleDeleteClick = (id: string) => {
    if (confirm("Are you sure you want to delete this service type?")) {
      deleteMutation.mutate(id)
    }
  }

  const handleBulkUploadSuccess = (data: any[]) => {
    toast({
      title: "Bulk upload completed",
      description: `Successfully uploaded ${data.length} service types`,
    })
    queryClient.invalidateQueries({ queryKey: ["service-types"] })
  }

  const handleViewClick = (service: ServiceType) => {
    setSelectedService(service)
    setShowViewModal(true)
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
          <h1 className="text-2xl font-bold text-gray-900">NHIA Tariff</h1>
          <p className="text-gray-600 mt-1">Manage NHIA global tariffs and services</p>
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
          <Button onClick={() => setShowAddModal(true)} className="bg-[#BE1522] hover:bg-[#9B1219]">
            <Plus className="h-4 w-4 mr-2" />
            Add NHIA Service
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search service types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Types Table */}
      <Card>
        <CardHeader>
          <CardTitle>NHIA Services</CardTitle>
          <CardDescription className="mt-2">
            Manage all NHIA services and their tariffs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">SERVICE NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">SERVICE CATEGORY</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">SERVICE TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">NHIA PRICE</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServiceTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      No service types found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServiceTypes.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.service_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categories.find(cat => cat.id === service.service_category)?.name || service.service_category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {SERVICE_TYPES.find(type => type.value === service.service_type)?.label || 'Not Set'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {service.is_nhia_service ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-600">
                              ₦{service.nhia_price?.toLocaleString() || '0'}
                            </span>
                            <Badge className="bg-blue-100 text-blue-800 text-xs">NHIA</Badge>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
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
                              onClick={() => handleViewClick(service)}
                              className="w-full justify-start text-xs"
                            >
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditClick(service)}
                              className="w-full justify-start text-xs"
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(service.id)}
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
          {pagination && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
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
                <Button variant="outline" size="sm" className="bg-[#BE1522] text-white">
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

      {/* Add Service Type Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Add Service Type</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                Create a new medical service type and assign it to a category.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="service_name">Service Name</Label>
                  <Input
                    id="service_name"
                    placeholder="Enter service name"
                    value={formData.service_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, service_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service_category">Service Category</Label>
                  <Select
                    value={formData.service_category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, service_category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Service Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service_type">Service Type</Label>
                  <Select
                    value={formData.service_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, service_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Service Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="is_nhia_service"
                    checked={formData.is_nhia_service}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_nhia_service: checked as boolean }))}
                  />
                  <Label htmlFor="is_nhia_service">Is NHIA Service?</Label>
                </div>
                {formData.is_nhia_service && (
                  <div className="space-y-2">
                    <Label htmlFor="nhia_price">NHIA Price (₦)</Label>
                    <Input
                      id="nhia_price"
                      type="number"
                      placeholder="Enter NHIA price"
                      value={formData.nhia_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, nhia_price: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddService} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Service Type Modal */}
      {showEditModal && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Edit Service Type</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                Update the service type information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_service_name">Service Name</Label>
                  <Input
                    id="edit_service_name"
                    placeholder="Enter service name"
                    value={formData.service_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, service_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_service_category">Service Category</Label>
                  <Select
                    value={formData.service_category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, service_category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Service Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_service_type">Service Type</Label>
                  <Select
                    value={formData.service_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, service_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Service Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="edit_is_nhia_service"
                    checked={formData.is_nhia_service}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_nhia_service: checked as boolean }))}
                  />
                  <Label htmlFor="edit_is_nhia_service">Is NHIA Service?</Label>
                </div>
                {formData.is_nhia_service && (
                  <div className="space-y-2">
                    <Label htmlFor="edit_nhia_price">NHIA Price (₦)</Label>
                    <Input
                      id="edit_nhia_price"
                      type="number"
                      placeholder="Enter NHIA price"
                      value={formData.nhia_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, nhia_price: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditService} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update"}
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
        module="settings"
        submodule="service-types"
        onUploadSuccess={handleBulkUploadSuccess}
        uploadEndpoint="/api/settings/bulk-upload"
        sampleFileName="service-types-sample.xlsx"
        acceptedColumns={["Service Name", "Service Category", "NHIA Price", "Service Type (Optional)"]}
        maxFileSize={200}
      />

      {/* View Service Type Modal */}
      {showViewModal && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Service Type Details</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowViewModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                View details of the selected service type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Service Name</Label>
                    <p className="text-sm font-medium">{selectedService.service_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Service Category</Label>
                    <Badge variant="outline" className="mt-1">
                      {categories.find(cat => cat.id === selectedService.service_category)?.name || selectedService.service_category}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Service Type</Label>
                    <Badge variant="secondary" className="mt-1">
                      {SERVICE_TYPES.find(type => type.value === selectedService.service_type)?.label || 'Not Set'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Created At</Label>
                    <p className="text-sm">{new Date(selectedService.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
                    <p className="text-sm">{new Date(selectedService.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}