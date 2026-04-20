"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, Loader2 } from "lucide-react"

interface LabOrderModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: any
  onSuccess: () => void
}

interface Facility {
  id: string
  facility_name: string
  facility_type: string
}

export default function LabOrderModal({ isOpen, onClose, appointment, onSuccess }: LabOrderModalProps) {
  const { toast } = useToast()
  
  const [formData, setFormData] = useState({
    facility_id: "",
    test_name: ""
  })
  
  const [labSearchTerm, setLabSearchTerm] = useState("")
  const [debouncedLabSearch, setDebouncedLabSearch] = useState("")
  const [selectedLab, setSelectedLab] = useState<Facility | null>(null)
  const [showLabResults, setShowLabResults] = useState(false)
  
  // Service search states
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [debouncedServiceSearch, setDebouncedServiceSearch] = useState("")
  const [showServiceResults, setShowServiceResults] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)

  // Debounce lab search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLabSearch(labSearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [labSearchTerm])

  // Debounce service search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedServiceSearch(serviceSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [serviceSearchTerm])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.lab-search-container')) {
        setShowLabResults(false)
      }
      if (!target.closest('.service-search-container')) {
        setShowServiceResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch lab facilities
  const { data: facilitiesData } = useQuery({
    queryKey: ["telemedicine-facilities", debouncedLabSearch],
    queryFn: async () => {
      const searchParam = debouncedLabSearch ? `?search=${encodeURIComponent(debouncedLabSearch)}&facility_type=LAB` : "?facility_type=LAB"
      const res = await fetch(`/api/telemedicine/facilities${searchParam}`)
      if (!res.ok) {
        throw new Error("Failed to fetch lab facilities")
      }
      return res.json()
    },
    enabled: isOpen
  })

  const labFacilities = facilitiesData?.facilities || []

  // Fetch lab services from selected facility's tariff plan
  const { data: labServicesData, isLoading: isLoadingLabServices } = useQuery({
    queryKey: ["lab-services", debouncedServiceSearch, formData.facility_id],
    queryFn: async () => {
      if (!debouncedServiceSearch || debouncedServiceSearch.length < 2 || !formData.facility_id) {
        return { services: [] }
      }
      
      // Fetch services from the selected facility's tariff plan
      const res = await fetch(`/api/telemedicine/facilities/${formData.facility_id}/tariff-plan`)
      if (!res.ok) throw new Error("Failed to fetch facility tariff plan")
      const data = await res.json()
      
      // Filter services by search term (case-insensitive)
      const filteredServices = (data.services || []).filter((service: any) =>
        service.service_name.toLowerCase().includes(debouncedServiceSearch.toLowerCase())
      )
      
      return { services: filteredServices }
    },
    enabled: debouncedServiceSearch.length >= 2 && isOpen && !!formData.facility_id
  })

  const labServices = labServicesData?.services || []

  // Create lab order mutation
  const createLabOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/telemedicine/appointments/${appointment.id}/lab-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create lab order")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Lab Order Created Successfully",
        description: "The lab order has been sent to the facility.",
      })
      onSuccess()
      onClose()
      resetForm()
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
      facility_id: "",
      test_name: ""
    })
    setLabSearchTerm("")
    setSelectedLab(null)
    setShowLabResults(false)
    setServiceSearchTerm("")
    setSelectedService(null)
    setShowServiceResults(false)
  }

  const handleServiceSelect = (service: any) => {
    setSelectedService(service)
    setFormData(prev => ({ ...prev, test_name: service.service_name }))
    setServiceSearchTerm(service.service_name)
    setShowServiceResults(false)
  }

  const handleLabSearch = (value: string) => {
    setLabSearchTerm(value)
    setShowLabResults(true)
  }

  const handleSelectLab = (lab: Facility) => {
    setSelectedLab(lab)
    setFormData(prev => ({ ...prev, facility_id: lab.id }))
    setLabSearchTerm(lab.facility_name)
    setShowLabResults(false)
  }

  const handleClearLab = () => {
    setSelectedLab(null)
    setLabSearchTerm("")
    setFormData(prev => ({ ...prev, facility_id: "" }))
    setShowLabResults(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.facility_id || !formData.test_name) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    const submissionData = {
      ...formData,
      requested_by: "Provider" // This will be set from session in API
    }

    createLabOrderMutation.mutate(submissionData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-blue-600">Add Order</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Search Lab */}
            <div className="relative lab-search-container">
              <Label htmlFor="lab_search">Search Lab *</Label>
              <div className="relative">
                <Input
                  id="lab_search"
                  placeholder="Search and select"
                  value={labSearchTerm}
                  onChange={(e) => handleLabSearch(e.target.value)}
                  onFocus={() => setShowLabResults(true)}
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                {selectedLab && (
                  <button
                    type="button"
                    onClick={handleClearLab}
                    className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Lab Search Results Dropdown */}
              {showLabResults && labFacilities && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {labFacilities.length > 0 ? (
                    labFacilities.map((lab: Facility) => (
                      <div
                        key={lab.id}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => handleSelectLab(lab)}
                      >
                        <div className="font-medium text-gray-900">{lab.facility_name}</div>
                        <div className="text-sm text-gray-500">{lab.facility_type}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-sm">
                      No lab facilities found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Search Test */}
            <div className="space-y-2">
              <Label htmlFor="test_name">Search Test *</Label>
              {!formData.facility_id && (
                <p className="text-xs text-amber-600 mb-2">Please select a lab facility first to see available tests</p>
              )}
              <div className="relative service-search-container">
                <Input
                  id="test_name"
                  placeholder={formData.facility_id ? "Search and select lab service" : "Select lab facility first"}
                  value={serviceSearchTerm}
                  onChange={(e) => {
                    setServiceSearchTerm(e.target.value)
                    setShowServiceResults(true)
                    if (!e.target.value) {
                      setSelectedService(null)
                      setFormData(prev => ({ ...prev, test_name: "" }))
                    }
                  }}
                  onFocus={() => {
                    if (formData.facility_id) {
                      setShowServiceResults(true)
                    } else {
                      toast({
                        title: "Select Lab Facility First",
                        description: "Please select a lab facility before searching for tests",
                        variant: "destructive",
                      })
                    }
                  }}
                  disabled={!formData.facility_id}
                />
                
                {/* Service Search Results */}
                {showServiceResults && labServices.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {labServices.map((service: any) => (
                      <div
                        key={service.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => handleServiceSelect(service)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{service.service_name}</p>
                            <p className="text-xs text-gray-500">
                              {service.service_category}
                              {service.current_price && ` • ₦${service.current_price.toLocaleString()}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {showServiceResults && debouncedServiceSearch.length >= 2 && isLoadingLabServices && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Searching services...</span>
                    </div>
                  </div>
                )}
                
                {showServiceResults && debouncedServiceSearch.length >= 2 && !isLoadingLabServices && labServices.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                    <p className="text-sm text-gray-600">No lab services found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createLabOrderMutation.isPending}
                className="bg-[#0891B2] hover:bg-[#9B1219]"
              >
                {createLabOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
