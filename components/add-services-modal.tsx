"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, X, Loader2, Search, PenLine } from "lucide-react"

interface Service {
  id: string
  service_name: string
  service_category: string
  facility_price: number
}

interface AddServicesModalProps {
  isOpen: boolean
  onClose: () => void
  approvalCodeId: string
  approvalCode: string
  currentAmount: number
  apiEndpoint: string // Either '/api/call-centre/approval-codes' or '/api/providers/approval-codes'
  onSuccess?: () => void
}

export function AddServicesModal({
  isOpen,
  onClose,
  approvalCodeId,
  approvalCode,
  currentAmount,
  apiEndpoint,
  onSuccess
}: AddServicesModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [debouncedServiceSearch, setDebouncedServiceSearch] = useState("")
  const [selectedServices, setSelectedServices] = useState<Array<{ service_name: string; service_amount: number; quantity?: number }>>([])
  
  // Manual service entry state
  const [manualServiceName, setManualServiceName] = useState("")
  const [manualServiceAmount, setManualServiceAmount] = useState("")
  const [manualServiceQuantity, setManualServiceQuantity] = useState("")
  const [showQuantityField, setShowQuantityField] = useState(false)
  
  // Debounce service search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedServiceSearch(serviceSearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [serviceSearchTerm])

  // Fetch available services
  const { data: servicesData, isLoading: isLoadingServices } = useQuery({
    queryKey: ["services", debouncedServiceSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedServiceSearch) {
        params.append("search", debouncedServiceSearch)
      }
      const res = await fetch(`/api/services?${params}`)
      if (!res.ok) throw new Error("Failed to fetch services")
      return res.json()
    },
    enabled: isOpen
  })

  const services: Service[] = servicesData?.services || []

  // Add service to selection
  const handleAddService = (service: Service) => {
    const existing = selectedServices.find(s => s.service_name === service.service_name)
    if (existing) {
      toast({
        title: "Service already added",
        description: "This service is already in your selection",
        variant: "destructive"
      })
      return
    }

    setSelectedServices([
      ...selectedServices,
      {
        service_name: service.service_name,
        service_amount: service.facility_price
      }
    ])
  }

  // Remove service from selection
  const handleRemoveService = (serviceName: string) => {
    setSelectedServices(selectedServices.filter(s => s.service_name !== serviceName))
  }

  // Update service amount
  const handleUpdateAmount = (serviceName: string, newAmount: number) => {
    setSelectedServices(selectedServices.map(s => 
      s.service_name === serviceName 
        ? { ...s, service_amount: newAmount }
        : s
    ))
  }

  // Update service quantity
  const handleUpdateQuantity = (serviceName: string, newQuantity: number) => {
    setSelectedServices(selectedServices.map(s => 
      s.service_name === serviceName 
        ? { ...s, quantity: newQuantity }
        : s
    ))
  }

  // Add manual service
  const handleAddManualService = () => {
    if (!manualServiceName.trim()) {
      toast({
        title: "Service name required",
        description: "Please enter a service name",
        variant: "destructive"
      })
      return
    }

    if (!manualServiceAmount || parseFloat(manualServiceAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid service amount",
        variant: "destructive"
      })
      return
    }

    const existing = selectedServices.find(s => s.service_name === manualServiceName.trim())
    if (existing) {
      toast({
        title: "Service already added",
        description: "This service is already in your selection",
        variant: "destructive"
      })
      return
    }

    const newService: { service_name: string; service_amount: number; quantity?: number } = {
      service_name: manualServiceName.trim(),
      service_amount: parseFloat(manualServiceAmount)
    }

    // Add quantity if provided and show quantity field is checked
    if (showQuantityField && manualServiceQuantity && parseFloat(manualServiceQuantity) > 0) {
      newService.quantity = parseFloat(manualServiceQuantity)
      // Optionally include quantity in service name for display
      newService.service_name = `${manualServiceName.trim()} (Qty: ${manualServiceQuantity})`
    }

    setSelectedServices([...selectedServices, newService])
    
    // Clear manual entry fields
    setManualServiceName("")
    setManualServiceAmount("")
    setManualServiceQuantity("")
    setShowQuantityField(false)

    toast({
      title: "Service added",
      description: "Custom service added successfully"
    })
  }

  // Calculate total
  const newServicesTotal = selectedServices.reduce((sum, s) => sum + s.service_amount, 0)
  const updatedTotal = currentAmount + newServicesTotal

  // Mutation to add services
  const addServicesMutation = useMutation({
    mutationFn: async (services: Array<{ service_name: string; service_amount: number }>) => {
      const res = await fetch(`${apiEndpoint}/${approvalCodeId}/add-services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to add services")
      }
      return res.json()
    },
    onSuccess: (data) => {
      // Check if response indicates services were sent for approval (provider endpoint)
      // or directly added (call centre endpoint)
      if (data.data?.provider_request) {
        toast({
          title: "Services Submitted for Approval",
          description: (
            <div className="space-y-1">
              <p>{data.message}</p>
              <p className="text-sm">Request ID: <span className="font-mono">{data.data.provider_request.request_id}</span></p>
              <p className="text-xs text-gray-500 mt-2">These services will be added to the approval code once approved by Call Centre</p>
            </div>
          ),
          duration: 8000
        })
      } else {
        toast({
          title: "Success",
          description: data.message || "Services added successfully to approval code"
        })
      }
      queryClient.invalidateQueries({ queryKey: ["approval-codes"] })
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
      queryClient.invalidateQueries({ queryKey: ["call-centre-requests"] })
      setSelectedServices([])
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add services",
        variant: "destructive"
      })
    }
  })

  const handleSubmit = () => {
    if (selectedServices.length === 0) {
      toast({
        title: "No services selected",
        description: "Please add at least one service",
        variant: "destructive"
      })
      return
    }

    // Clean the services data to only include required fields
    const cleanedServices = selectedServices.map(service => ({
      service_name: service.service_name,
      service_amount: service.service_amount
    }))

    addServicesMutation.mutate(cleanedServices)
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Add Services to Approval Code</CardTitle>
              <CardDescription className="mt-1">
                Approval Code: <span className="font-mono font-bold text-blue-600">{approvalCode}</span>
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Current & Updated Total */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Current Total</p>
                <p className="text-2xl font-bold text-gray-900">₦{currentAmount.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600">New Services</p>
                <p className="text-2xl font-bold text-blue-900">₦{newServicesTotal.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600">Updated Total</p>
                <p className="text-2xl font-bold text-green-900">₦{updatedTotal.toLocaleString()}</p>
              </div>
            </div>

            {/* Selected Services */}
            {selectedServices.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                    {selectedServices.length}
                  </span>
                  Selected Services (to be added)
                </h3>
                <div className="space-y-2">
                  {selectedServices.map((service, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{service.service_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={service.service_amount}
                          onChange={(e) => handleUpdateAmount(service.service_name, parseFloat(e.target.value) || 0)}
                          className="w-32"
                          min="0"
                          step="0.01"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveService(service.service_name)}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Service Search */}
            <Tabs defaultValue="search" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">
                  <Search className="h-4 w-4 mr-2" />
                  Search Services
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <PenLine className="h-4 w-4 mr-2" />
                  Manual Entry
                </TabsTrigger>
              </TabsList>

              {/* Search Services Tab */}
              <TabsContent value="search" className="space-y-4">
                <div>
                  <Label htmlFor="service-search">Search Services</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="service-search"
                    placeholder="Search for services to add..."
                    value={serviceSearchTerm}
                    onChange={(e) => setServiceSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Available Services */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Available Services</h3>
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  {isLoadingServices ? (
                    <div className="text-center py-8 text-gray-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading services...
                    </div>
                  ) : services.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No services found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {services.map((service) => {
                        const isSelected = selectedServices.some(s => s.service_name === service.service_name)
                        return (
                          <div
                            key={service.id}
                            className={`p-4 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{service.service_name}</p>
                                <p className="text-sm text-gray-500">{service.service_category}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <p className="font-semibold text-gray-900">₦{service.facility_price.toLocaleString()}</p>
                                <Button
                                  size="sm"
                                  onClick={() => handleAddService(service)}
                                  disabled={isSelected}
                                  variant={isSelected ? "secondary" : "default"}
                                >
                                  {isSelected ? (
                                    <>
                                      <Badge variant="secondary">Added</Badge>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Manual Entry Tab */}
            <TabsContent value="manual" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Add Custom Service</h3>
                <p className="text-sm text-blue-700">
                  Use this to add services that aren't listed in the system. Enter the agreed service details below.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="manual-service-name">Service Name *</Label>
                  <Input
                    id="manual-service-name"
                    placeholder="e.g., Special X-Ray, Custom Consultation"
                    value={manualServiceName}
                    onChange={(e) => setManualServiceName(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="manual-service-amount">Agreed Price (₦) *</Label>
                  <Input
                    id="manual-service-amount"
                    type="number"
                    placeholder="0.00"
                    value={manualServiceAmount}
                    onChange={(e) => setManualServiceAmount(e.target.value)}
                    className="mt-1"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <Label htmlFor="show-quantity" className="flex items-center gap-2">
                    <input
                      id="show-quantity"
                      type="checkbox"
                      checked={showQuantityField}
                      onChange={(e) => setShowQuantityField(e.target.checked)}
                      className="h-4 w-4"
                    />
                    This is a drug (requires quantity)
                  </Label>
                  {showQuantityField && (
                    <Input
                      id="manual-service-quantity"
                      type="number"
                      placeholder="Quantity"
                      value={manualServiceQuantity}
                      onChange={(e) => setManualServiceQuantity(e.target.value)}
                      className="mt-2"
                      min="1"
                      step="1"
                    />
                  )}
                </div>
              </div>

              <Button 
                onClick={handleAddManualService}
                className="w-full"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Service to List
              </Button>
            </TabsContent>
          </Tabs>
          </div>

          {/* Footer with action buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t mt-6">
            <Button variant="outline" onClick={onClose} disabled={addServicesMutation.isPending}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={selectedServices.length === 0 || addServicesMutation.isPending}
            >
              {addServicesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding Services...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add {selectedServices.length} Service{selectedServices.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
