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



interface Plan {
  id: string
  name: string
  description?: string
  plan_type: string
  status: "ACTIVE" | "INACTIVE"
  created_at: string
  _count: {
    covered_services: number
  }
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

interface CoveredService {
  id: string
  facility_price: number
  limit_count?: number | null
}

export default function FacilityPlansPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const params = useParams()
  const facilityId = params.id as string
  
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
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

  // Fetch plans for this facility
  const { data: plansData, isLoading } = useQuery({
    queryKey: ["facility-plans", facilityId, currentPage, pageSize, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        facility_id: facilityId,
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm
      })
      const res = await fetch(`/api/settings/facility-plans?${params}`)
      if (!res.ok) throw new Error("Failed to fetch plans")
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
      queryClient.invalidateQueries({ queryKey: ["facility-covered-services"] })
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
      queryClient.invalidateQueries({ queryKey: ["facility-covered-services"] })
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
  const plans: Plan[] = plansData?.plans || []
  const pagination = plansData?.pagination || {
    page: currentPage,
    limit: pageSize,
    total: plansData?.totalCount || 0,
    pages: Math.ceil((plansData?.totalCount || 0) / pageSize)
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

  const handleViewClick = (plan: Plan) => {
    setSelectedPlan(plan)
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
          <Link href="/settings/covered-services">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Facilities
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-6 w-6 text-blue-600" />
              {facility?.facility_name} - Plans
            </h1>
            <p className="text-gray-600 mt-1">
              View plans available at {facility?.facility_name} ({facility?.hcp_code})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/settings/covered-services/assign?facility=${facilityId}`}>
            <Button className="bg-[#BE1522] hover:bg-[#9B1219]">
              <Plus className="h-4 w-4 mr-2" />
              Add Services
            </Button>
          </Link>
        </div>
      </div>

      {/* Facility Info */}
      {facility && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Facility Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Address</Label>
                <p className="text-sm font-medium">{facility.address}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Phone</Label>
                <p className="text-sm font-medium">{facility.phone_number}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Email</Label>
                <p className="text-sm font-medium">{facility.email}</p>
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
            <Users className="h-5 w-5 text-blue-600" />
            Plans ({plans.length})
          </CardTitle>
          <CardDescription className="mt-2">
            Plans available at {facility?.facility_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">PLAN NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PLAN TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DESCRIPTION</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">COVERED SERVICES</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No plans found for this facility.
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div>
                          <div className="text-sm text-gray-900">{plan.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm text-gray-900">{plan.plan_type}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 max-w-xs truncate">
                          {plan.description || "No description"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-gray-900">{plan._count?.covered_services || 0}</span>
                          <span className="text-sm text-gray-500">services</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={plan.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link 
                                href={`/settings/covered-services/facility/${facilityId}/plan/${plan.id}`}
                                className="w-full justify-start text-xs"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Services
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleViewClick(plan)}
                              className="w-full justify-start text-xs"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
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

      {/* View Plan Modal */}
      {showViewModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Plan Details</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowViewModal(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                View details of the selected plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Plan Name</Label>
                  <p className="text-sm font-medium">{selectedPlan.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Plan Type</Label>
                  <p className="text-sm font-medium">{selectedPlan.plan_type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Description</Label>
                  <p className="text-sm text-gray-900">{selectedPlan.description || "No description"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Covered Services</Label>
                  <p className="text-sm font-medium">{selectedPlan._count?.covered_services || 0} services</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <StatusIndicator status={selectedPlan.status} />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created</Label>
                  <p className="text-sm font-medium">{new Date(selectedPlan.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
