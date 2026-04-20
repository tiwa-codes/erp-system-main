"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Plus, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  X,
  Loader2,
  Building2,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Users,
  FileText,
  TestTube,
  Scan,
  Pill,
  Calculator,
  Settings,
  Download,
  Upload
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import * as XLSX from 'xlsx'



// Service Price Update Component
interface ServicePriceUpdateProps {
  service: any
  facilityId: string
  onPriceUpdate: (serviceId: string, newPrice: number) => void
}

function ServicePriceUpdate({ service, facilityId, onPriceUpdate }: ServicePriceUpdateProps) {
  const [newPrice, setNewPrice] = useState(service.current_price || 0)
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()
  
  const handleUpdatePrice = async () => {
    if (newPrice <= 0) {
      toast({
        title: "Invalid Price",
        description: "Price must be greater than 0",
        variant: "destructive",
      })
      return
    }
    
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/telemedicine/facilities/${facilityId}/tariff-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          price: newPrice
        })
      })
      
      if (response.ok) {
        toast({
          title: "Price Updated",
          description: `${service.service_name} price updated to ₦${newPrice.toLocaleString()}`,
        })
        
        onPriceUpdate(service.id, newPrice)
      } else {
        throw new Error('Failed to update price')
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update service price",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }
  
  return (
    <TableRow>
      <TableCell className="font-medium">{service.service_name}</TableCell>
      <TableCell>
        <Badge className="bg-blue-100 text-blue-800">
          {service.service_category}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">
        ₦{service.current_price?.toLocaleString() || 'Not Set'}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          placeholder="Enter price"
          value={newPrice}
          onChange={(e) => setNewPrice(Number(e.target.value))}
          className="w-32"
        />
      </TableCell>
      <TableCell>
        <Button 
          size="sm" 
          className="bg-[#BE1522] hover:bg-[#9B1219]"
          onClick={handleUpdatePrice}
          disabled={isUpdating}
        >
          <Settings className="h-4 w-4 mr-1" />
          {isUpdating ? "Updating..." : "Update"}
        </Button>
      </TableCell>
    </TableRow>
  )
}

interface Facility {
  id: string
  facility_name: string
  phone_number: string
  email: string
  facility_type: string
  status: string
  created_at: string
  selected_bands?: string[]
}

interface Service {
  id: string
  type: 'LAB' | 'RADIOLOGY' | 'PHARMACY'
  service_name: string
  patient_name: string
  patient_id: string
  patient_phone: string
  amount: number
  status: string
  created_at: string
  completed_at?: string
  requested_by: string
  results?: string
  notes?: string
}

interface FacilityStats {
  total_services: number
  lab_orders: number
  radiology_orders: number
  pharmacy_orders: number
  total_amount: number
  pending_services: number
  completed_services: number
  rejected_services: number
}

const calculateFacilityStats = (services: Service[]): FacilityStats => {
  return {
    total_services: services.length,
    lab_orders: services.filter((service) => service.type === "LAB").length,
    radiology_orders: services.filter((service) => service.type === "RADIOLOGY").length,
    pharmacy_orders: services.filter((service) => service.type === "PHARMACY").length,
    total_amount: services.reduce((sum, service) => sum + Number(service.amount || 0), 0),
    pending_services: services.filter((service) => service.status === "PENDING").length,
    completed_services: services.filter((service) => service.status === "COMPLETED").length,
    rejected_services: services.filter((service) => service.status === "REJECTED").length,
  }
}

// Available bands for selection
const AVAILABLE_BANDS = [
  { value: "Band A", label: "Band A" },
  { value: "Band B", label: "Band B" },
  { value: "Band C", label: "Band C" },
  { value: "Band D", label: "Band D" }
]

export default function ManageFacilitiesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // State for modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showServicesModal, setShowServicesModal] = useState(false)
  const [showTariffModal, setShowTariffModal] = useState(false)
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [facilityServices, setFacilityServices] = useState<Service[]>([])
  const [facilityStats, setFacilityStats] = useState<FacilityStats | null>(null)
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  const [facilityTariffs, setFacilityTariffs] = useState<any[]>([])
  const [isLoadingTariffs, setIsLoadingTariffs] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // Services modal date filter state
  const [servicesDateFrom, setServicesDateFrom] = useState("")
  const [servicesDateTo, setServicesDateTo] = useState("")
  const [allFacilityServices, setAllFacilityServices] = useState<Service[]>([])
  
  const [formData, setFormData] = useState({
    facility_name: "",
    phone_number: "",
    email: "",
    facility_type: "",
    selected_bands: [] as string[]
  })

  // Fetch facilities
  const { data: facilitiesData, isLoading, refetch } = useQuery({
    queryKey: ["telemedicine-facilities", currentPage, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })
      
      const res = await fetch(`/api/telemedicine/facilities?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch facilities")
      }
      return res.json()
    },
  })

  const facilities = facilitiesData?.facilities || []
  const pagination = facilitiesData?.pagination

  // Add facility mutation
  const addFacilityMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/telemedicine/facilities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to add facility")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Facility Added Successfully",
        description: "The facility has been added to the system.",
      })
      setShowAddModal(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Edit facility mutation
  const editFacilityMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/telemedicine/facilities/${selectedFacility?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update facility")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Facility Updated Successfully",
        description: "The facility has been updated.",
      })
      setShowEditModal(false)
      setSelectedFacility(null)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Delete facility mutation
  const deleteFacilityMutation = useMutation({
    mutationFn: async (facilityId: string) => {
      const res = await fetch(`/api/telemedicine/facilities/${facilityId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete facility")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Facility Deleted Successfully",
        description: "The facility has been deleted from the system.",
      })
      refetch()
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const resetForm = () => {
    setFormData({
      facility_name: "",
      phone_number: "",
      email: "",
      facility_type: "",
      selected_bands: []
    })
  }

  const handleAddClick = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleEditClick = (facility: Facility) => {
    setSelectedFacility(facility)
    setFormData({
      facility_name: facility.facility_name,
      phone_number: facility.phone_number,
      email: facility.email,
      facility_type: facility.facility_type,
      selected_bands: facility.selected_bands || []
    })
    setShowEditModal(true)
  }

  const handleViewClick = (facility: Facility) => {
    setSelectedFacility(facility)
    setShowViewModal(true)
  }

  const handleViewServicesClick = async (facility: Facility) => {
    setSelectedFacility(facility)
    setIsLoadingServices(true)
    setShowServicesModal(true)
    setServicesDateFrom("")
    setServicesDateTo("")
    
    try {
      const res = await fetch(`/api/telemedicine/facilities/${facility.id}/services`)
      if (!res.ok) {
        throw new Error('Failed to fetch facility services')
      }
      
      const data = await res.json()
      const services: Service[] = data.services || []
      setAllFacilityServices(services)
      setFacilityServices(services)
      setFacilityStats(calculateFacilityStats(services))
    } catch (error) {
      console.error('Error fetching facility services:', error)
      toast({
        title: "Error",
        description: "Failed to fetch facility services",
        variant: "destructive",
      })
    } finally {
      setIsLoadingServices(false)
    }
  }

  const handleServicesDateFilter = () => {
    if (!servicesDateFrom && !servicesDateTo) {
      setFacilityServices(allFacilityServices)
      setFacilityStats(calculateFacilityStats(allFacilityServices))
      return
    }
    const from = servicesDateFrom ? new Date(servicesDateFrom) : null
    const to = servicesDateTo ? new Date(servicesDateTo + "T23:59:59") : null
    const filteredServices = allFacilityServices.filter((s) => {
      const d = new Date(s.created_at)
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })
    setFacilityServices(filteredServices)
    setFacilityStats(calculateFacilityStats(filteredServices))
  }

  const handleServicesClearFilter = () => {
    setServicesDateFrom("")
    setServicesDateTo("")
    setFacilityServices(allFacilityServices)
    setFacilityStats(calculateFacilityStats(allFacilityServices))
  }

  const handleTariffPlanClick = async (facility: Facility) => {
    setSelectedFacility(facility)
    setIsLoadingTariffs(true)
    setShowTariffModal(true)
    
    try {
      const res = await fetch(`/api/telemedicine/facilities/${facility.id}/tariff-plan`)
      if (!res.ok) {
        throw new Error('Failed to fetch facility tariff plan')
      }
      
      const data = await res.json()
      setFacilityTariffs(data.services || [])
    } catch (error) {
      console.error('Error fetching facility tariff plan:', error)
      toast({
        title: "Error",
        description: "Failed to fetch facility tariff plan",
        variant: "destructive",
      })
    } finally {
      setIsLoadingTariffs(false)
    }
  }

  const handleExportTariffPlan = () => {
    if (facilityTariffs.length === 0) {
      toast({
        title: "No Data to Export",
        description: "No services found for this facility",
        variant: "destructive",
      })
      return
    }

    try {
      const exportData = [
        ['Service Name', 'Price'],
        ...facilityTariffs.map(service => [
          service.service_name,
          service.current_price || 0
        ])
      ]

      const worksheet = XLSX.utils.aoa_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tariff Plan')
      
      // Generate Excel file
      const fileName = `${selectedFacility?.facility_name || 'facility'}-tariff-plan.xlsx`
      XLSX.writeFile(workbook, fileName)

      toast({
        title: "Export Successful",
        description: `Tariff plan exported for ${selectedFacility?.facility_name}`,
      })
    } catch (error) {
      console.error('Error exporting tariff plan:', error)
      toast({
        title: "Export Error",
        description: error instanceof Error ? error.message : "Failed to export tariff plan. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleImportTariffPlan = async (file: File) => {
    try {
      // Validate file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (!fileExtension || !['xlsx', 'xls'].includes(fileExtension)) {
        toast({
          title: "Invalid File Format",
          description: "Please upload an Excel file (.xlsx or .xls)",
          variant: "destructive",
        })
        return
      }

      if (!selectedFacility) {
        toast({
          title: "Error",
          description: "Please select a facility first",
          variant: "destructive",
        })
        return
      }

      setIsLoadingTariffs(true)

      // Upload Excel file to bulk upload API
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/telemedicine/facilities/${selectedFacility.id}/tariff-plan/bulk-upload`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload tariff plan')
      }

      toast({
        title: "Import Complete",
        description: result.message || `Successfully processed ${result.stats?.success || 0} services`,
      })

      // Show errors if any
      if (result.errors && result.errors.length > 0) {
        toast({
          title: "Some Errors Occurred",
          description: `${result.errors.length} services had errors. Check console for details.`,
          variant: "destructive",
        })
        console.error('Import errors:', result.errors)
      }

      // Refresh the tariff data
      handleTariffPlanClick(selectedFacility)

    } catch (error) {
      console.error('Error processing Excel file:', error)
      toast({
        title: "Import Error",
        description: error instanceof Error ? error.message : "Failed to process the Excel file",
        variant: "destructive",
      })
    } finally {
      setIsLoadingTariffs(false)
    }
  }

  const handlePriceUpdate = (serviceId: string, newPrice: number) => {
    setFacilityTariffs(prev => 
      prev.map(s => 
        s.id === serviceId 
          ? { ...s, current_price: newPrice }
          : s
      )
    )
  }

  const handleDeleteClick = (facility: Facility) => {
    if (confirm(`Are you sure you want to delete ${facility.facility_name}?`)) {
      deleteFacilityMutation.mutate(facility.id)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.facility_name || !formData.phone_number || !formData.email || !formData.facility_type) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (formData.selected_bands.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one band for this facility",
        variant: "destructive",
      })
      return
    }

    if (showEditModal) {
      editFacilityMutation.mutate(formData)
    } else {
      addFacilityMutation.mutate(formData)
    }
  }

  const handleBandToggle = (band: string) => {
    setFormData(prev => ({
      ...prev,
      selected_bands: prev.selected_bands.includes(band)
        ? prev.selected_bands.filter(b => b !== band)
        : [...prev.selected_bands, band]
    }))
  }

  const getFacilityTypeBadge = (type: string) => {
    switch (type) {
      case 'LAB':
        return 'bg-blue-100 text-blue-800'
      case 'RADIOLOGY':
        return 'bg-green-100 text-green-800'
      case 'PHARMACY':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'INACTIVE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'LAB':
        return <TestTube className="h-4 w-4 text-blue-600" />
      case 'RADIOLOGY':
        return <Scan className="h-4 w-4 text-green-600" />
      case 'PHARMACY':
        return <Pill className="h-4 w-4 text-purple-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const getServiceStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="telemedicine" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Facilities</h1>
            <p className="text-gray-600">Manage telemedicine facilities for Lab, Radiology, and Pharmacy</p>
          </div>
          <PermissionGate module="telemedicine" action="add">
            <Button 
              onClick={handleAddClick}
              className="bg-[#BE1522] hover:bg-[#9B1219]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Facility
            </Button>
          </PermissionGate>
        </div>

        {/* Facilities Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Facilities</CardTitle>
            <CardDescription>Manage telemedicine facilities and their details</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">S/N</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">FACILITY NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PHONE NUMBER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">EMAIL</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">TYPE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CREATED DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facilities.map((facility: Facility, index: number) => (
                      <TableRow key={facility.id}>
                        <TableCell>{((currentPage - 1) * limit) + index + 1}</TableCell>
                        <TableCell className="font-medium">{facility.facility_name}</TableCell>
                        <TableCell>{facility.phone_number}</TableCell>
                        <TableCell>{facility.email}</TableCell>
                        <TableCell>
                          <Badge className={getFacilityTypeBadge(facility.facility_type)}>
                            {facility.facility_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(facility.created_at).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(facility.status)}>
                            {facility.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewClick(facility)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewServicesClick(facility)}>
                                <Activity className="h-4 w-4 mr-2" />
                                View All Services
                              </DropdownMenuItem>
                              <PermissionGate module="telemedicine" action="edit">
                                <DropdownMenuItem onClick={() => handleTariffPlanClick(facility)}>
                                  <Calculator className="h-4 w-4 mr-2" />
                                  Tariff Plan
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="telemedicine" action="edit">
                                <DropdownMenuItem onClick={() => handleEditClick(facility)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="telemedicine" action="delete">
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteClick(facility)}
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
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
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

        {/* Add Facility Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Add Facility</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="facility_type">Select Type *</Label>
                    <Select
                      value={formData.facility_type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, facility_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LAB">Lab</SelectItem>
                        <SelectItem value="RADIOLOGY">Radiology</SelectItem>
                        <SelectItem value="PHARMACY">Pharmacy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facility_name">Facility Name *</Label>
                    <Input
                      id="facility_name"
                      value={formData.facility_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, facility_name: e.target.value }))}
                      placeholder="enter name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number *</Label>
                    <Input
                      id="phone_number"
                      value={formData.phone_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="enter phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="enter mail"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Select Bands *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_BANDS.map((band) => (
                        <div key={band.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`band-${band.value}`}
                            checked={formData.selected_bands.includes(band.value)}
                            onCheckedChange={() => handleBandToggle(band.value)}
                          />
                          <Label
                            htmlFor={`band-${band.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {band.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Select the bands this facility can serve. Patients will only be able to use this facility if their plan is under one of the selected bands.
                    </p>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addFacilityMutation.isPending}
                      className="bg-[#BE1522] hover:bg-[#9B1219]"
                    >
                      {addFacilityMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit Facility Modal */}
        {showEditModal && selectedFacility && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Edit Facility</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedFacility(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_facility_type">Select Type *</Label>
                    <Select
                      value={formData.facility_type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, facility_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LAB">Lab</SelectItem>
                        <SelectItem value="RADIOLOGY">Radiology</SelectItem>
                        <SelectItem value="PHARMACY">Pharmacy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_facility_name">Facility Name *</Label>
                    <Input
                      id="edit_facility_name"
                      value={formData.facility_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, facility_name: e.target.value }))}
                      placeholder="enter name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_phone_number">Phone Number *</Label>
                    <Input
                      id="edit_phone_number"
                      value={formData.phone_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="enter phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_email">Email *</Label>
                    <Input
                      id="edit_email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="enter mail"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Select Bands *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_BANDS.map((band) => (
                        <div key={`edit-band-${band.value}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-band-${band.value}`}
                            checked={formData.selected_bands.includes(band.value)}
                            onCheckedChange={() => handleBandToggle(band.value)}
                          />
                          <Label
                            htmlFor={`edit-band-${band.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {band.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Select the bands this facility can serve. Patients will only be able to use this facility if their plan is under one of the selected bands.
                    </p>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowEditModal(false)
                        setSelectedFacility(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={editFacilityMutation.isPending}
                      className="bg-[#BE1522] hover:bg-[#9B1219]"
                    >
                      {editFacilityMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Facility Modal */}
        {showViewModal && selectedFacility && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Facility Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowViewModal(false)
                      setSelectedFacility(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Facility Name</Label>
                    <p className="text-lg font-semibold">{selectedFacility.facility_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Phone Number</Label>
                    <p className="text-lg">{selectedFacility.phone_number}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Email</Label>
                    <p className="text-lg">{selectedFacility.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Type</Label>
                    <Badge className={getFacilityTypeBadge(selectedFacility.facility_type)}>
                      {selectedFacility.facility_type}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Status</Label>
                    <Badge className={getStatusBadge(selectedFacility.status)}>
                      {selectedFacility.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Created Date</Label>
                    <p className="text-lg">{new Date(selectedFacility.created_at).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Selected Bands</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(selectedFacility.selected_bands || []).length > 0 ? (
                        (selectedFacility.selected_bands || []).map((band: string) => (
                          <Badge key={band} className="bg-blue-100 text-blue-800">
                            {band}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No bands selected</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Facility Services Modal */}
        {showServicesModal && selectedFacility && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <span className="text-blue-600">{selectedFacility.facility_name} - All Services</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowServicesModal(false)
                      setSelectedFacility(null)
                      setFacilityServices([])
                      setAllFacilityServices([])
                      setFacilityStats(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Complete overview of all services sent to this facility
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[calc(90vh-200px)]">
                {isLoadingServices ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Loading services...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Statistics Cards */}
                    {facilityStats && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium">Total Services</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-600">{facilityStats.total_services}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium">Total Amount</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">₦{Number(facilityStats.total_amount || 0).toLocaleString()}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium">Completed</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">{facilityStats.completed_services}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-yellow-600" />
                              <span className="text-sm font-medium">Pending</span>
                            </div>
                            <p className="text-2xl font-bold text-yellow-600">{facilityStats.pending_services}</p>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Service Type Breakdown */}
                    {facilityStats && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Service Type Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                              <TestTube className="h-5 w-5 text-blue-600" />
                              <div>
                                <p className="font-medium">Lab Orders</p>
                                <p className="text-sm text-gray-600">{facilityStats.lab_orders} orders</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                              <Scan className="h-5 w-5 text-green-600" />
                              <div>
                                <p className="font-medium">Radiology Orders</p>
                                <p className="text-sm text-gray-600">{facilityStats.radiology_orders} orders</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                              <Pill className="h-5 w-5 text-purple-600" />
                              <div>
                                <p className="font-medium">Pharmacy Orders</p>
                                <p className="text-sm text-gray-600">{facilityStats.pharmacy_orders} orders</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Services Table */}
                    <Card>
                      <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <CardTitle className="text-lg">All Services ({facilityServices.length})</CardTitle>
                            <CardDescription>
                              Complete list of all services sent to {selectedFacility.facility_name}
                            </CardDescription>
                          </div>
                          {/* Date filter */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 whitespace-nowrap">From</span>
                              <input
                                type="date"
                                value={servicesDateFrom}
                                onChange={(e) => setServicesDateFrom(e.target.value)}
                                className="text-xs border rounded px-2 py-1 h-7 focus:outline-none focus:ring-1 focus:ring-red-700"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 whitespace-nowrap">To</span>
                              <input
                                type="date"
                                value={servicesDateTo}
                                onChange={(e) => setServicesDateTo(e.target.value)}
                                className="text-xs border rounded px-2 py-1 h-7 focus:outline-none focus:ring-1 focus:ring-red-700"
                              />
                            </div>
                            <Button size="sm" className="h-7 text-xs bg-[#BE1522] hover:bg-[#9B1219]" onClick={handleServicesDateFilter}>
                              Apply
                            </Button>
                            {(servicesDateFrom || servicesDateTo) && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleServicesClearFilter}>
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {facilityServices.length === 0 ? (
                          <div className="text-center py-8">
                            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No services have been sent to this facility yet.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs font-medium text-gray-600">SERVICE TYPE</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">SERVICE NAME</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">PATIENT</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">PATIENT ID</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">REQUESTED BY</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {facilityServices.map((service, index) => (
                                  <TableRow key={service.id}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {getServiceTypeIcon(service.type)}
                                        <span className="text-sm font-medium">{service.type}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{service.service_name}</TableCell>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{service.patient_name}</p>
                                        <p className="text-sm text-gray-500">{service.patient_phone}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{service.patient_id}</TableCell>
                                    <TableCell className="font-medium">₦{Number(service.amount || 0).toLocaleString()}</TableCell>
                                    <TableCell>
                                      <Badge className={getServiceStatusBadge(service.status)}>
                                        {service.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{service.requested_by}</TableCell>
                                    <TableCell>
                                      <div>
                                        <p className="text-sm">{new Date(service.created_at).toLocaleDateString('en-GB')}</p>
                                        <p className="text-xs text-gray-500">{new Date(service.created_at).toLocaleTimeString('en-GB')}</p>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Facility Tariff Plan Modal */}
        {showTariffModal && selectedFacility && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-blue-600" />
                    <span className="text-blue-600">{selectedFacility.facility_name} - Tariff Plan</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowTariffModal(false)
                      setSelectedFacility(null)
                      setFacilityTariffs([])
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Set pricing for {selectedFacility.facility_type} services at this facility
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[calc(90vh-200px)]">
                {isLoadingTariffs ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Loading tariff plan...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Service Category Filter */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Service Category</CardTitle>
                        <CardDescription>
                          {selectedFacility.facility_type === 'LAB' && 'Laboratory Services'}
                          {selectedFacility.facility_type === 'RADIOLOGY' && 'Radiology Services'}
                          {selectedFacility.facility_type === 'PHARMACY' && 'Drugs and Pharmaceutical'}
                        </CardDescription>
                      </CardHeader>
                    </Card>

                    {/* Services Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Services Pricing ({facilityTariffs.length})</CardTitle>
                        <CardDescription>
                          Set prices for services available at this {selectedFacility.facility_type.toLowerCase()} facility
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {facilityTariffs.length === 0 ? (
                          <div className="text-center py-8">
                            <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 mb-4">No services found for this facility.</p>
                            <p className="text-sm text-gray-400 mb-6">
                              Upload services using the buttons below or add them manually.
                            </p>
                            <Button
                              onClick={() => {
                                const input = document.createElement('input')
                                input.type = 'file'
                                input.accept = '.xlsx,.xls'
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0]
                                  if (file) {
                                    handleImportTariffPlan(file)
                                  }
                                }
                                input.click()
                              }}
                              disabled={isLoadingTariffs}
                              className="bg-[#BE1522] hover:bg-[#9B1219]"
                            >
                              {isLoadingTariffs ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4 mr-2" />
                              )}
                              {isLoadingTariffs ? 'Uploading...' : 'Upload Tariff Plan'}
                            </Button>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs font-medium text-gray-600">SERVICE NAME</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">CATEGORY</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">CURRENT PRICE</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">NEW PRICE</TableHead>
                                  <TableHead className="text-xs font-medium text-gray-600">ACTIONS</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {facilityTariffs.map((service, index) => (
                                  <ServicePriceUpdate
                                    key={service.id}
                                    service={service}
                                    facilityId={selectedFacility?.id || ''}
                                    onPriceUpdate={handlePriceUpdate}
                                  />
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Bulk Actions - Always visible */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Bulk Actions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 flex-wrap">
                          <Button 
                            onClick={handleExportTariffPlan}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={facilityTariffs.length === 0}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Export Pricing
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              const input = document.createElement('input')
                              input.type = 'file'
                              input.accept = '.xlsx,.xls'
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0]
                                if (file) {
                                  handleImportTariffPlan(file)
                                }
                              }
                              input.click()
                            }}
                            disabled={isLoadingTariffs}
                          >
                            {isLoadingTariffs ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {isLoadingTariffs ? 'Uploading...' : 'Upload Tariff Plan'}
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              try {
                                const sampleData = [
                                  ['Service Name', 'Price'],
                                  ['Blood Test', 5000],
                                  ['X-Ray', 15000],
                                  ['Pain Relief', 2000]
                                ]
                                
                                const worksheet = XLSX.utils.aoa_to_sheet(sampleData)
                                const workbook = XLSX.utils.book_new()
                                XLSX.utils.book_append_sheet(workbook, worksheet, 'Tariff Plan')
                                
                                // Generate Excel file
                                XLSX.writeFile(workbook, 'tariff-plan-sample.xlsx')
                                
                                toast({
                                  title: "Sample Downloaded",
                                  description: "Use this Excel template to upload your tariff plan",
                                })
                              } catch (error) {
                                console.error('Error generating sample file:', error)
                                toast({
                                  title: "Error",
                                  description: error instanceof Error ? error.message : "Failed to generate sample file",
                                  variant: "destructive",
                                })
                              }
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Download Sample
                          </Button>
                        </div>
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Export:</strong> Download current pricing as Excel<br/>
                            <strong>Upload:</strong> Upload Excel file with Service Name and Price columns<br/>
                            <strong>Sample:</strong> Download Excel template with correct format<br/>
                            <strong>Note:</strong> Only Service Name and Price are required. Services will be created automatically if they don't exist.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
