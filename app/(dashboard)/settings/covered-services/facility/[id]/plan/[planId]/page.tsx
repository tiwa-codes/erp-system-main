"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusIndicator } from "@/components/ui/status-indicator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  Shield,
  DollarSign,
  ArrowLeft,
  MoreHorizontal,
  XCircle,
  Building2,
  Users
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"



interface CoveredService {
  id: string
  plan_id: string
  plan: {
    name: string
    plan_type: string
  }
  facility_id: string
  facility: {
    facility_name: string
    hcp_code: string
  }
  service_type_id: string
  service_type: {
    service_name: string
    service_category: string
  }
  facility_price: number
  limit_count?: number
  status: "ACTIVE" | "INACTIVE"
  created_at: string
  updated_at: string
}

interface Facility {
  id: string
  facility_name: string
  hcp_code: string
  address: string
  phone_number: string
  email: string
  status: "ACTIVE" | "INACTIVE"
}

interface Plan {
  id: string
  name: string
  description?: string
  plan_type: string
  status: "ACTIVE" | "INACTIVE"
  created_at: string
}

export default function PlanServicesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const params = useParams()
  const facilityId = params.id as string
  const planId = params.planId as string
  
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedService, setSelectedService] = useState<CoveredService | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [editingService, setEditingService] = useState<string | null>(null)

  // Edit form state
  const [formData, setFormData] = useState({
    facility_price: "",
    limit_count: ""
  })

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch facility details
  const { data: facilityData } = useQuery({
    queryKey: ["facility", facilityId],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${facilityId}`)
      if (!res.ok) throw new Error("Failed to fetch facility")
      return res.json()
    },
  })

  // Fetch plan details
  const { data: planData } = useQuery({
    queryKey: ["plan", planId],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/plans/${planId}`)
      if (!res.ok) throw new Error("Failed to fetch plan")
      return res.json()
    },
  })

  // Fetch covered services for this plan and facility
  const { data: coveredServicesData, isLoading } = useQuery({
    queryKey: ["plan-covered-services", facilityId, planId, currentPage, pageSize, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        facility_id: facilityId,
        plan_id: planId,
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm
      })
      const res = await fetch(`/api/settings/covered-services?${params}`)
      if (!res.ok) throw new Error("Failed to fetch covered services")
      return res.json()
    },
  })

  // Update covered service mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/settings/covered-services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update covered service')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Covered service updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["plan-covered-services"] })
      setEditingService(null)
      setFormData({
        facility_price: "",
        limit_count: ""
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update covered service",
        variant: "destructive",
      })
    },
  })

  // Delete covered service mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/covered-services/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete covered service')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Covered service deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["plan-covered-services"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete covered service",
        variant: "destructive",
      })
    },
  })

  const facility: Facility = facilityData?.provider
  const plan: Plan = planData?.plan
  const coveredServices: CoveredService[] = coveredServicesData?.coveredServices || []
  const pagination = coveredServicesData?.pagination || {
    page: currentPage,
    limit: pageSize,
    total: coveredServicesData?.totalCount || 0,
    pages: Math.ceil((coveredServicesData?.totalCount || 0) / pageSize)
  }

  const handleEditService = (serviceId: string) => {
    // Validate required fields
    if (!formData.facility_price || !formData.limit_count) {
      toast({
        title: "Validation Error",
        description: "Please fill in facility price and limit count.",
        variant: "destructive",
      })
      return
    }

    const dataToSubmit = {
      facility_price: parseFloat(formData.facility_price) || 0,
      limit_count: parseInt(formData.limit_count) || 0
    }

    updateMutation.mutate({ id: serviceId, data: dataToSubmit })
  }

  const handleEditClick = (service: CoveredService) => {
    setEditingService(service.id)
    setFormData({
      facility_price: service.facility_price.toString(),
      limit_count: service.limit_count?.toString() || ""
    })
  }

  const handleCancelEdit = () => {
    setEditingService(null)
    setFormData({
      facility_price: "",
      limit_count: ""
    })
  }

  const handleDeleteClick = (id: string) => {
    if (confirm("Are you sure you want to delete this covered service?")) {
      deleteMutation.mutate(id)
    }
  }

  const handleViewClick = (service: CoveredService) => {
    setSelectedService(service)
    setShowViewModal(true)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/settings/covered-services/facility/${facilityId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Plans
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-600" />
              {plan?.name} - Covered Services
            </h1>
            <p className="text-gray-600 mt-1">
              Services covered by {plan?.name} at {facility?.facility_name} ({facility?.hcp_code})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/settings/covered-services/assign?facility=${facilityId}&plan=${planId}`}>
            <Button className="bg-[#0891B2] hover:bg-[#9B1219]">
              <Plus className="h-4 w-4 mr-2" />
              Add Services
            </Button>
          </Link>
        </div>
      </div>

      {/* Plan & Facility Info */}
      {(facility && plan) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Plan & Facility Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Plan Details</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Plan Name</Label>
                    <p className="text-sm font-medium">{plan.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Plan Type</Label>
                    <p className="text-sm font-medium">{plan.plan_type}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Description</Label>
                    <p className="text-sm font-medium">{plan.description || "No description"}</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Facility Details</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Facility Name</Label>
                    <p className="text-sm font-medium">{facility.facility_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">HCP Code</Label>
                    <p className="text-sm font-medium">{facility.hcp_code}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Address</Label>
                    <p className="text-sm font-medium">{facility.address}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search covered services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Covered Services Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Covered Services ({coveredServices.length})
          </CardTitle>
          <CardDescription className="mt-2">
            Services covered by {plan?.name} at {facility?.facility_name} with pricing and limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">FACILITY PRICE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">LIMIT COUNT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coveredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No covered services found for this plan at this facility.
                    </TableCell>
                  </TableRow>
                ) : (
                  coveredServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <div>
                          <div className="text-sm text-gray-900">{service.service_type.service_name}</div>
                          <div className="text-sm text-gray-500">{service.service_type.service_category}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingService === service.id ? (
                          <Input
                            type="number"
                            placeholder="Enter price"
                            value={formData.facility_price}
                            onChange={(e) => setFormData(prev => ({ ...prev, facility_price: e.target.value }))}
                            className="w-24"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">₦{service.facility_price.toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingService === service.id ? (
                          <Input
                            type="number"
                            placeholder="Enter limit"
                            value={formData.limit_count}
                            onChange={(e) => setFormData(prev => ({ ...prev, limit_count: e.target.value }))}
                            className="w-20"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">{service.limit_count || "Unlimited"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={service.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {editingService === service.id ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleEditService(service.id)}
                              disabled={updateMutation.isPending}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
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
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleEditClick(service)}
                                className="w-full justify-start text-xs"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClick(service.id)}
                                className="text-red-600 w-full justify-start text-xs"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
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

      {/* View Covered Service Modal */}
      {showViewModal && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Covered Service Details</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowViewModal(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                View details of the selected covered service.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Plan</Label>
                  <p className="text-sm font-medium">{selectedService.plan.name} ({selectedService.plan.plan_type})</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Facility</Label>
                  <p className="text-sm font-medium">{selectedService.facility.facility_name} ({selectedService.facility.hcp_code})</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Service</Label>
                  <p className="text-sm text-gray-900">{selectedService.service_type.service_name}</p>
                  <p className="text-sm text-gray-500 mt-1">{selectedService.service_type.service_category}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Facility Price</Label>
                  <p className="text-sm font-medium">₦{selectedService.facility_price.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Limit Count</Label>
                  <p className="text-sm font-medium">{selectedService.limit_count || "Unlimited"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <StatusIndicator status={selectedService.status} />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created</Label>
                  <p className="text-sm font-medium">{new Date(selectedService.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
                  <p className="text-sm font-medium">{new Date(selectedService.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
