"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { 
  Plus, 
  Search,
  Shield,
  DollarSign,
  Trash2,
  Save,
  ArrowLeft
} from "lucide-react"
import Link from "next/link"

interface ServiceType {
  id: string
  service_name: string
  service_category: string
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

interface SelectedService {
  id: string
  service_name: string
  service_category: string
  facility_price: string
  limit_count: string
}

export default function AssignCoveredServicesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedPlan, setSelectedPlan] = useState("")
  const [selectedFacility, setSelectedFacility] = useState("")
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])
  const [bulkPrice, setBulkPrice] = useState("")
  const [bulkLimitCount, setBulkLimitCount] = useState("")

  // Get facility from URL params if provided
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const facilityParam = urlParams.get('facility')
    if (facilityParam) {
      setSelectedFacility(facilityParam)
    }
  }, [])

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch service types - only when searching
  const { data: serviceTypesData, isLoading: serviceTypesLoading } = useQuery({
    queryKey: ["service-types", debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearchTerm) {
        params.append("search", debouncedSearchTerm)
      }
      const res = await fetch(`/api/settings/service-types?${params}`)
      if (!res.ok) throw new Error("Failed to fetch service types")
      return res.json()
    },
    enabled: debouncedSearchTerm.length > 0, // Only fetch when searching
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

  // Fetch existing covered services for the selected plan and facility
  const { data: existingServicesData } = useQuery({
    queryKey: ["existing-covered-services", selectedPlan, selectedFacility],
    queryFn: async () => {
      if (!selectedPlan || !selectedFacility) return { existingServices: [] }
      
      const params = new URLSearchParams({
        plan_id: selectedPlan,
        facility_id: selectedFacility
      })
      const res = await fetch(`/api/settings/covered-services?${params}`)
      if (!res.ok) throw new Error("Failed to fetch existing services")
      return res.json()
    },
    enabled: !!selectedPlan && !!selectedFacility,
  })

  // Bulk save mutation
  const bulkSaveMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const res = await fetch('/api/settings/covered-services/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: data })
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save covered services')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Covered services assigned successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["covered-services"] })
      // Clear the form
      setSelectedServices([])
      setSelectedPlan("")
      setSelectedFacility("")
      setBulkPrice("")
      setBulkLimitCount("")
      setSearchTerm("")
    },
    onError: (error: any) => {
      // Check if it's a duplicate service error
      if (error.message.includes("already exist")) {
        toast({
          title: "Service Already Exists",
          description: "One or more services already exist for this plan and facility combination. Please check your selection and try again.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to assign covered services",
          variant: "destructive",
        })
      }
    },
  })

  const serviceTypes: ServiceType[] = serviceTypesData?.serviceTypes || []
  const plans: Plan[] = plansData?.plans || []
  const providers: Provider[] = providersData?.providers || []
  const existingServices = existingServicesData?.coveredServices || []

  const handleAddService = (service: ServiceType) => {
    // Check if service is already added to the current selection
    if (selectedServices.some(s => s.id === service.id)) {
      toast({
        title: "Service Already Added",
        description: "This service has already been added to the list.",
        variant: "destructive",
      })
      return
    }

    // Check if service already exists for the selected plan and facility
    if (selectedPlan && selectedFacility) {
      const alreadyExists = existingServices.some((existing: any) => 
        existing.service_type_id === service.id
      )
      
      if (alreadyExists) {
        toast({
          title: "Service Already Exists",
          description: `This service already exists for the selected plan and facility. Please choose a different service or modify the existing one.`,
          variant: "destructive",
        })
        return
      }
    }

    const newService: SelectedService = {
      id: service.id,
      service_name: service.service_name,
      service_category: service.service_category,
      facility_price: bulkPrice || "",
      limit_count: bulkLimitCount || ""
    }

    setSelectedServices(prev => [...prev, newService])
  }

  const handleRemoveService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId))
  }

  const handleUpdateService = (serviceId: string, field: 'facility_price' | 'limit_count', value: string) => {
    setSelectedServices(prev => 
      prev.map(s => 
        s.id === serviceId ? { ...s, [field]: value } : s
      )
    )
  }

  const handleBulkUpdate = () => {
    if (!bulkPrice && !bulkLimitCount) {
      toast({
        title: "No Changes",
        description: "Please enter a price or limit count to apply to all services.",
        variant: "destructive",
      })
      return
    }

    setSelectedServices(prev => 
      prev.map(s => ({
        ...s,
        facility_price: bulkPrice || s.facility_price,
        limit_count: bulkLimitCount || s.limit_count
      }))
    )

    toast({
      title: "Bulk Update Applied",
      description: "Changes have been applied to all services.",
    })
  }

  const handleSaveAll = () => {
    // Validate required fields
    if (!selectedPlan || !selectedFacility) {
      toast({
        title: "Validation Error",
        description: "Please select a plan and facility.",
        variant: "destructive",
      })
      return
    }

    if (selectedServices.length === 0) {
      toast({
        title: "No Services",
        description: "Please add at least one service.",
        variant: "destructive",
      })
      return
    }

    // Validate all services have required fields
    const invalidServices = selectedServices.filter(s => !s.facility_price || !s.limit_count)
    if (invalidServices.length > 0) {
      toast({
        title: "Validation Error",
        description: "All services must have facility price and limit count.",
        variant: "destructive",
      })
      return
    }

    // Prepare data for API
    const servicesToSave = selectedServices.map(service => ({
      plan_id: selectedPlan,
      facility_id: selectedFacility,
      service_type_id: service.id,
      facility_price: parseFloat(service.facility_price) || 0,
      limit_count: parseInt(service.limit_count) || 0
    }))

    bulkSaveMutation.mutate(servicesToSave)
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings/covered-services">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assign Covered Services</h1>
            <p className="text-gray-600 mt-1">Assign services to plans and facilities with pricing</p>
          </div>
        </div>
      </div>

      {/* Plan and Facility Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Plan & Facility Selection</CardTitle>
          <CardDescription>
            Select the plan and facility for service assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Select Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
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
              <Label htmlFor="facility">Select Facility</Label>
              <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Facility" />
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
          </div>
        </CardContent>
      </Card>

      {/* Service Search and Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Service Search & Selection</CardTitle>
          <CardDescription>
            Search and select services to assign to the plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Service List */}
          <div className="max-h-60 overflow-y-auto border rounded-lg">
            {!debouncedSearchTerm ? (
              <div className="text-center text-gray-500 py-8">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>Start typing to search for services...</p>
              </div>
            ) : serviceTypesLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : serviceTypes.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No services found for "{debouncedSearchTerm}".
              </div>
            ) : (
              <div className="divide-y">
                {serviceTypes.map((service) => {
                  const isAlreadySelected = selectedServices.some(s => s.id === service.id)
                  const alreadyExists = selectedPlan && selectedFacility && existingServices.some((existing: any) => 
                    existing.service_type_id === service.id
                  )
                  const isDisabled = isAlreadySelected || alreadyExists
                  
                  return (
                    <div key={service.id} className={`p-3 hover:bg-gray-50 flex items-center justify-between ${
                      alreadyExists ? 'bg-red-50 border-l-4 border-red-200' : ''
                    }`}>
                      <div className="flex-1">
                        <div className="font-medium">{service.service_name}</div>
                        <div className="text-sm text-gray-500">{service.service_category}</div>
                        {alreadyExists && (
                          <div className="text-xs text-red-600 mt-1">
                            ⚠️ Already exists for this plan and facility
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddService(service)}
                        disabled={isDisabled}
                        variant={alreadyExists ? "destructive" : "default"}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {isAlreadySelected ? "Added" : alreadyExists ? "Exists" : "Add"}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Pricing</CardTitle>
          <CardDescription>
            Set default price and limit count for all services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bulk_price">Default Price (₦)</Label>
              <Input
                id="bulk_price"
                type="number"
                placeholder="Enter default price"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk_limit">Default Limit Count</Label>
              <Input
                id="bulk_limit"
                type="number"
                placeholder="Enter default limit"
                value={bulkLimitCount}
                onChange={(e) => setBulkLimitCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={handleBulkUpdate} className="w-full">
                Apply to All Services
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Services Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Selected Services ({selectedServices.length})
          </CardTitle>
          <CardDescription>
            Manage pricing and limits for selected services
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedServices.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No services selected. Search and add services above.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SERVICE NAME</TableHead>
                      <TableHead>CATEGORY</TableHead>
                      <TableHead>FACILITY PRICE (₦)</TableHead>
                      <TableHead>LIMIT COUNT</TableHead>
                      <TableHead>ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div className="font-medium">{service.service_name}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {service.service_category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            placeholder="Enter price"
                            value={service.facility_price}
                            onChange={(e) => handleUpdateService(service.id, 'facility_price', e.target.value)}
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            placeholder="Enter limit"
                            value={service.limit_count}
                            onChange={(e) => handleUpdateService(service.id, 'limit_count', e.target.value)}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveService(service.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Save Button */}
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleSaveAll} 
                  disabled={bulkSaveMutation.isPending}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {bulkSaveMutation.isPending ? "Saving..." : "Save All Services"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}