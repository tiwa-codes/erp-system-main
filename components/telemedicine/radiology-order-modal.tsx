"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, X, Loader2 } from "lucide-react"

interface RadiologyOrderModalProps {
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

export default function RadiologyOrderModal({ isOpen, onClose, appointment, onSuccess }: RadiologyOrderModalProps) {
  const { toast } = useToast()
  
  const [formData, setFormData] = useState({
    facility_id: "",
    test_name: ""
  })
  
  const [radiologySearchTerm, setRadiologySearchTerm] = useState("")
  const [debouncedRadiologySearch, setDebouncedRadiologySearch] = useState("")
  const [selectedRadiology, setSelectedRadiology] = useState<Facility | null>(null)
  const [showRadiologyResults, setShowRadiologyResults] = useState(false)
  
  // Service search states
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [debouncedServiceSearch, setDebouncedServiceSearch] = useState("")
  const [showServiceResults, setShowServiceResults] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)

  // Debounce radiology search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRadiologySearch(radiologySearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [radiologySearchTerm])

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
      if (!target.closest('.radiology-search-container')) {
        setShowRadiologyResults(false)
      }
      if (!target.closest('.service-search-container')) {
        setShowServiceResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch radiology facilities
  const { data: facilitiesData } = useQuery({
    queryKey: ["telemedicine-facilities-radiology", debouncedRadiologySearch],
    queryFn: async () => {
      const searchParam = debouncedRadiologySearch ? `?search=${encodeURIComponent(debouncedRadiologySearch)}&facility_type=RADIOLOGY` : "?facility_type=RADIOLOGY"
      const res = await fetch(`/api/telemedicine/facilities${searchParam}`)
      if (!res.ok) {
        throw new Error("Failed to fetch radiology facilities")
      }
      return res.json()
    },
    enabled: isOpen
  })

  const radiologyFacilities = facilitiesData?.facilities || []

  // Fetch radiology services from selected facility's tariff plan
  const { data: radiologyServicesData, isLoading: isLoadingRadiologyServices } = useQuery({
    queryKey: ["radiology-services", debouncedServiceSearch, formData.facility_id],
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

  const radiologyServices = radiologyServicesData?.services || []

  // Create radiology order mutation
  const createRadiologyOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/telemedicine/appointments/${appointment.id}/radiology-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create radiology order")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Radiology Order Created Successfully",
        description: "The radiology order has been sent to the facility.",
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
    setRadiologySearchTerm("")
    setSelectedRadiology(null)
    setShowRadiologyResults(false)
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

  const handleRadiologySearch = (value: string) => {
    setRadiologySearchTerm(value)
    setShowRadiologyResults(true)
  }

  const handleSelectRadiology = (radiology: Facility) => {
    setSelectedRadiology(radiology)
    setFormData(prev => ({ ...prev, facility_id: radiology.id }))
    setRadiologySearchTerm(radiology.facility_name)
    setShowRadiologyResults(false)
  }

  const handleClearRadiology = () => {
    setSelectedRadiology(null)
    setRadiologySearchTerm("")
    setFormData(prev => ({ ...prev, facility_id: "" }))
    setShowRadiologyResults(false)
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

    createRadiologyOrderMutation.mutate(submissionData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-green-600">Add Radiology Order</span>
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
            {/* Search Radiology Facility */}
            <div className="relative radiology-search-container">
              <Label htmlFor="radiology_search">Search Radiology Facility *</Label>
              <div className="relative">
                <Input
                  id="radiology_search"
                  placeholder="Search and select radiology facility"
                  value={radiologySearchTerm}
                  onChange={(e) => handleRadiologySearch(e.target.value)}
                  onFocus={() => setShowRadiologyResults(true)}
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                {selectedRadiology && (
                  <button
                    type="button"
                    onClick={handleClearRadiology}
                    className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Radiology Search Results Dropdown */}
              {showRadiologyResults && radiologyFacilities && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {radiologyFacilities.length > 0 ? (
                    radiologyFacilities.map((radiology: Facility) => (
                      <div
                        key={radiology.id}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => handleSelectRadiology(radiology)}
                      >
                        <div className="font-medium text-gray-900">{radiology.facility_name}</div>
                        <div className="text-sm text-gray-500">{radiology.facility_type}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-sm">
                      No radiology facilities found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Search Test */}
            <div className="space-y-2">
              <Label htmlFor="test_name">Search Test *</Label>
              {!formData.facility_id && (
                <p className="text-xs text-amber-600 mb-2">Please select a radiology facility first to see available tests</p>
              )}
              <div className="relative service-search-container">
                <Input
                  id="test_name"
                  placeholder={formData.facility_id ? "Search and select radiology service (e.g., X-Ray, CT, MRI)" : "Select radiology facility first"}
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
                        title: "Select Radiology Facility First",
                        description: "Please select a radiology facility before searching for tests",
                        variant: "destructive",
                      })
                    }
                  }}
                  disabled={!formData.facility_id}
                />
                
                {/* Service Search Results */}
                {showServiceResults && radiologyServices.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {radiologyServices.map((service: any) => (
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
                
                {showServiceResults && debouncedServiceSearch.length >= 2 && isLoadingRadiologyServices && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Searching services...</span>
                    </div>
                  </div>
                )}
                
                {showServiceResults && debouncedServiceSearch.length >= 2 && !isLoadingRadiologyServices && radiologyServices.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                    <p className="text-sm text-gray-600">No radiology services found. You can still type manually.</p>
                  </div>
                )}
              </div>
              
              {/* Manual test entry if not found */}
              {!selectedService && serviceSearchTerm && (
                <Input
                  placeholder="Or enter test name manually"
                  value={formData.test_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, test_name: e.target.value }))}
                />
              )}
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
                disabled={createRadiologyOrderMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {createRadiologyOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Order
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
