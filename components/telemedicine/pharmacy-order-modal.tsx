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

interface PharmacyOrderModalProps {
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

const FREQUENCY_OPTIONS = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "Three times daily" },
  { value: "four_times_daily", label: "Four times daily" },
  { value: "every_6_hours", label: "Every 6 hours" },
  { value: "every_8_hours", label: "Every 8 hours" },
  { value: "every_12_hours", label: "Every 12 hours" },
  { value: "at_bedtime", label: "At bedtime" },
  { value: "as_needed", label: "As needed (PRN)" },
  { value: "before_meals", label: "Before meals" },
  { value: "after_meals", label: "After meals" },
  { value: "with_food", label: "With food" },
  { value: "on_empty_stomach", label: "On empty stomach" }
]

export default function PharmacyOrderModal({ isOpen, onClose, appointment, onSuccess }: PharmacyOrderModalProps) {
  const { toast } = useToast()
  
  const [formData, setFormData] = useState({
    facility_id: "",
    medication: "",
    dose: "",
    quantity: "",
    duration: "",
    frequency: ""
  })
  
  const [pharmacySearchTerm, setPharmacySearchTerm] = useState("")
  const [debouncedPharmacySearch, setDebouncedPharmacySearch] = useState("")
  const [selectedPharmacy, setSelectedPharmacy] = useState<Facility | null>(null)
  const [showPharmacyResults, setShowPharmacyResults] = useState(false)
  
  // Service search states
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [debouncedServiceSearch, setDebouncedServiceSearch] = useState("")
  const [showServiceResults, setShowServiceResults] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)

  // Debounce pharmacy search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPharmacySearch(pharmacySearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [pharmacySearchTerm])

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
      if (!target.closest('.pharmacy-search-container')) {
        setShowPharmacyResults(false)
      }
      if (!target.closest('.service-search-container')) {
        setShowServiceResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch pharmacy facilities
  const { data: facilitiesData } = useQuery({
    queryKey: ["telemedicine-facilities", debouncedPharmacySearch],
    queryFn: async () => {
      const searchParam = debouncedPharmacySearch ? `?search=${encodeURIComponent(debouncedPharmacySearch)}&facility_type=PHARMACY` : "?facility_type=PHARMACY"
      const res = await fetch(`/api/telemedicine/facilities${searchParam}`)
      if (!res.ok) {
        throw new Error("Failed to fetch pharmacy facilities")
      }
      return res.json()
    },
    enabled: isOpen
  })

  const pharmacyFacilities = facilitiesData?.facilities || []

  // Fetch pharmacy services from selected facility's tariff plan
  const { data: pharmacyServicesData, isLoading: isLoadingPharmacyServices } = useQuery({
    queryKey: ["pharmacy-services", debouncedServiceSearch, formData.facility_id],
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

  const pharmacyServices = pharmacyServicesData?.services || []

  // Create pharmacy order mutation
  const createPharmacyOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/telemedicine/appointments/${appointment.id}/pharmacy-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create pharmacy order")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Pharmacy Order Created Successfully",
        description: "The pharmacy order has been sent to the facility.",
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
      medication: "",
      dose: "",
      quantity: "",
      duration: "",
      frequency: ""
    })
    setPharmacySearchTerm("")
    setSelectedPharmacy(null)
    setShowPharmacyResults(false)
    setServiceSearchTerm("")
    setSelectedService(null)
    setShowServiceResults(false)
  }

  const handleServiceSelect = (service: any) => {
    setSelectedService(service)
    setFormData(prev => ({ ...prev, medication: service.service_name }))
    setServiceSearchTerm(service.service_name)
    setShowServiceResults(false)
  }

  const handlePharmacySearch = (value: string) => {
    setPharmacySearchTerm(value)
    setShowPharmacyResults(true)
  }

  const handleSelectPharmacy = (pharmacy: Facility) => {
    setSelectedPharmacy(pharmacy)
    setFormData(prev => ({ ...prev, facility_id: pharmacy.id }))
    setPharmacySearchTerm(pharmacy.facility_name)
    setShowPharmacyResults(false)
  }

  const handleClearPharmacy = () => {
    setSelectedPharmacy(null)
    setPharmacySearchTerm("")
    setFormData(prev => ({ ...prev, facility_id: "" }))
    setShowPharmacyResults(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.facility_id || !formData.medication || !formData.dose || !formData.quantity || !formData.duration || !formData.frequency) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    const submissionData = {
      ...formData,
      quantity: parseInt(formData.quantity),
      requested_by: "Provider" // This will be set from session in API
    }

    createPharmacyOrderMutation.mutate(submissionData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-purple-600">Add Prescription</span>
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
            {/* Search Pharmacy */}
            <div className="relative pharmacy-search-container">
              <Label htmlFor="pharmacy_search">Search Pharmacy *</Label>
              <div className="relative">
                <Input
                  id="pharmacy_search"
                  placeholder="Search and select pharmacy"
                  value={pharmacySearchTerm}
                  onChange={(e) => handlePharmacySearch(e.target.value)}
                  onFocus={() => setShowPharmacyResults(true)}
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                {selectedPharmacy && (
                  <button
                    type="button"
                    onClick={handleClearPharmacy}
                    className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Pharmacy Search Results Dropdown */}
              {showPharmacyResults && pharmacyFacilities && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {pharmacyFacilities.length > 0 ? (
                    pharmacyFacilities.map((pharmacy: Facility) => (
                      <div
                        key={pharmacy.id}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => handleSelectPharmacy(pharmacy)}
                      >
                        <div className="font-medium text-gray-900">{pharmacy.facility_name}</div>
                        <div className="text-sm text-gray-500">{pharmacy.facility_type}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-sm">
                      No pharmacy facilities found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Search Medication */}
            <div className="space-y-2">
              <Label htmlFor="medication">Medication *</Label>
              {!formData.facility_id && (
                <p className="text-xs text-amber-600 mb-2">Please select a pharmacy first to see available medications</p>
              )}
              <div className="relative service-search-container">
                <Input
                  id="medication"
                  placeholder={formData.facility_id ? "Search and select medication" : "Select pharmacy first"}
                  value={serviceSearchTerm}
                  onChange={(e) => {
                    setServiceSearchTerm(e.target.value)
                    setShowServiceResults(true)
                    if (!e.target.value) {
                      setSelectedService(null)
                      setFormData(prev => ({ ...prev, medication: "" }))
                    }
                  }}
                  onFocus={() => {
                    if (formData.facility_id) {
                      setShowServiceResults(true)
                    } else {
                      toast({
                        title: "Select Pharmacy First",
                        description: "Please select a pharmacy facility before searching for medications",
                        variant: "destructive",
                      })
                    }
                  }}
                  disabled={!formData.facility_id}
                />
                
                {/* Service Search Results */}
                {showServiceResults && pharmacyServices.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {pharmacyServices.map((service: any) => (
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
                
                {/* No Results Message */}
                {showServiceResults && debouncedServiceSearch && pharmacyServices.length === 0 && !isLoadingPharmacyServices && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    <div className="px-4 py-3 text-gray-500 text-sm">
                      No medications found. You can still type manually.
                    </div>
                  </div>
                )}
              </div>
              
              {/* Manual medication entry if not found */}
              {!selectedService && serviceSearchTerm && (
                <Input
                  placeholder="Or enter medication name manually"
                  value={formData.medication}
                  onChange={(e) => setFormData(prev => ({ ...prev, medication: e.target.value }))}
                />
              )}
            </div>

            {/* Dose */}
            <div className="space-y-2">
              <Label htmlFor="dose">Dose/Strength *</Label>
              <Input
                id="dose"
                placeholder="e.g., 500mg, 10ml, 2 tablets"
                value={formData.dose}
                onChange={(e) => setFormData(prev => ({ ...prev, dose: e.target.value }))}
                required
              />
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="e.g., 30 (number of units)"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                required
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration *</Label>
              <Input
                id="duration"
                placeholder="e.g., 7 days, 2 weeks, 1 month"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                required
              />
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent className="z-[70]" position="popper">
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                disabled={createPharmacyOrderMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {createPharmacyOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Order
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
