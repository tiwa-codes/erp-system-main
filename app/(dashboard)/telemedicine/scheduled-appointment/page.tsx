"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, Clock, Search, X, Loader2 } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

interface Enrollee {
  id: string
  enrollee_id: string
  name: string
  phone_number: string
  plan: string
  region: string
  type?: 'Principal' | 'Dependent'
  principal_id?: string
}

export default function ScheduledAppointmentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    enrollee_id: "",
    reason: "",
    appointment_type: "WALK_IN",
    scheduled_date: "",
    specialization: "",
    state: "",
    lga: ""
  })
  
  const [nigerianStates, setNigerianStates] = useState<Record<string, string[]>>({})
  const [availableLGAs, setAvailableLGAs] = useState<string[]>([])
  
  const [enrolleeSearchTerm, setEnrolleeSearchTerm] = useState("")
  const [debouncedEnrolleeSearch, setDebouncedEnrolleeSearch] = useState("")
  const [selectedEnrollee, setSelectedEnrollee] = useState<Enrollee | null>(null)
  const [showEnrolleeResults, setShowEnrolleeResults] = useState(false)

  // Load Nigerian states and LGAs
  useEffect(() => {
    fetch('/nigerian-states.json')
      .then(res => res.json())
      .then(data => {
        setNigerianStates(data)
      })
      .catch(err => console.error('Error loading states:', err))
  }, [])

  // Update available LGAs when state changes
  useEffect(() => {
    if (formData.state && nigerianStates[formData.state]) {
      setAvailableLGAs(nigerianStates[formData.state])
      // Reset LGA when state changes
      setFormData(prev => ({ ...prev, lga: "" }))
    } else {
      setAvailableLGAs([])
    }
  }, [formData.state, nigerianStates])

  // Debounce enrollee search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEnrolleeSearch(enrolleeSearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [enrolleeSearchTerm])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.enrollee-search-container')) {
        setShowEnrolleeResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch enrollees for search
  const { data: enrolleesData } = useQuery({
    queryKey: ["enrollees", debouncedEnrolleeSearch],
    queryFn: async () => {
      const searchParam = debouncedEnrolleeSearch ? `?search=${encodeURIComponent(debouncedEnrolleeSearch)}` : ""
      const res = await fetch(`/api/call-centre/enrollees${searchParam}`)
      if (!res.ok) {
        throw new Error("Failed to fetch enrollees")
      }
      return res.json()
    },
    enabled: true
  })

  const enrollees = enrolleesData?.enrollees || []

  const scheduleAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/telemedicine/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to schedule appointment")
      }

      return res.json()
    },
    onSuccess: () => {
      // Invalidate and refetch appointments data
      queryClient.invalidateQueries({ queryKey: ["telemedicine-appointments"] })
      
      toast({
        title: "Appointment Scheduled Successfully",
        description: "The appointment has been scheduled and the enrollee will be notified.",
      })
      router.push("/telemedicine/outpatient")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEnrolleeSearch = (value: string) => {
    setEnrolleeSearchTerm(value)
    setShowEnrolleeResults(true)
  }

  const handleSelectEnrollee = (enrollee: Enrollee) => {
    setSelectedEnrollee(enrollee)
    setFormData(prev => ({ ...prev, enrollee_id: enrollee.id }))
    setEnrolleeSearchTerm(enrollee.name)
    setShowEnrolleeResults(false)
  }

  const handleClearEnrollee = () => {
    setSelectedEnrollee(null)
    setEnrolleeSearchTerm("")
    setFormData(prev => ({ ...prev, enrollee_id: "" }))
    setShowEnrolleeResults(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.enrollee_id || !formData.scheduled_date || !formData.specialization) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Enrollee, Date, and Specialization)",
        variant: "destructive",
      })
      return
    }

    const submissionData = {
      ...formData,
      scheduled_date: new Date(formData.scheduled_date).toISOString(),
      // Only include state and lga if state is selected
      state: formData.state || null,
      lga: formData.lga || null
    }

    scheduleAppointmentMutation.mutate(submissionData)
  }

  return (
    <PermissionGate module="telemedicine" action="add">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Schedule Appointment</h1>
            <p className="text-gray-600">Schedule appointments for enrollees</p>
          </div>
        </div>

        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule Appointment
            </CardTitle>
            <CardDescription>
              Fill in the details to schedule an appointment for an enrollee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Enrollee Search */}
              <div className="relative enrollee-search-container">
                <Label htmlFor="enrollee_search">Search Enrollee *</Label>
                <div className="relative">
                  <Input
                    id="enrollee_search"
                    placeholder="Search by ID, Name, Phone Number..."
                    value={enrolleeSearchTerm}
                    onChange={(e) => handleEnrolleeSearch(e.target.value)}
                    onFocus={() => setShowEnrolleeResults(true)}
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  {selectedEnrollee && (
                    <button
                      type="button"
                      onClick={handleClearEnrollee}
                      className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {/* Search Results Dropdown */}
                {showEnrolleeResults && enrollees && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {enrollees.length > 0 ? (
                      enrollees.map((enrollee: Enrollee) => (
                        <div
                          key={`enrollee-${enrollee.id}`}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => handleSelectEnrollee(enrollee)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-gray-900">
                                  {enrollee.name}
                                </div>
                                {enrollee.type === 'Dependent' ? (
                                  <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                                    Dependent
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                    Principal
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                ID: {enrollee.enrollee_id} | Phone: {enrollee.phone_number}
                                {enrollee.type === 'Dependent' && enrollee.principal_id && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    • Principal: {enrollee.principal_id}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                Plan: {enrollee.plan} | Region: {enrollee.region}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500 text-sm">
                        No results found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reason (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => handleInputChange("reason", e.target.value)}
                  placeholder="Enter reason for appointment..."
                  rows={3}
                />
              </div>

              {/* Specialization */}
              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization *</Label>
                <Select
                  value={formData.specialization}
                  onValueChange={(value) => handleInputChange("specialization", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Crown Jewel OPD">Crown Jewel OPD</SelectItem>
                    <SelectItem value="Cardiography">Cardiography</SelectItem>
                    <SelectItem value="Dermatology">Dermatology</SelectItem>
                    <SelectItem value="Paediatric">Paediatric</SelectItem>
                    <SelectItem value="Gynaecology">Gynaecology</SelectItem>
                    <SelectItem value="Mental Health Physician">Mental Health Physician</SelectItem>
                    <SelectItem value="Endocrinology">Endocrinology</SelectItem>
                    <SelectItem value="Neurology">Neurology</SelectItem>
                    <SelectItem value="Family Physician">Family Physician</SelectItem>
                    <SelectItem value="Gastroenterologist">Gastroenterologist</SelectItem>
                    <SelectItem value="Nephrologist">Nephrologist</SelectItem>
                    <SelectItem value="Hemato Oncologist">Hemato Oncologist</SelectItem>
                    <SelectItem value="Pulmonologist">Pulmonologist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Appointment Type */}
              <div className="space-y-2">
                <Label htmlFor="appointment_type">Appointment Type *</Label>
                <Select
                  value={formData.appointment_type}
                  onValueChange={(value) => handleInputChange("appointment_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select appointment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WALK_IN">Walk-In</SelectItem>
                    <SelectItem value="TELE_CONSULTATION">Tele-Consultation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => handleInputChange("state", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(nigerianStates).sort().map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* LGA (Local Government Area) - Only show if state is selected */}
              {formData.state && availableLGAs.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="lga">Local Government Area (LGA)</Label>
                  <Select
                    value={formData.lga}
                    onValueChange={(value) => handleInputChange("lga", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select LGA (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLGAs.sort().map((lga) => (
                        <SelectItem key={lga} value={lga}>
                          {lga}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="scheduled_date">Date *</Label>
                <div className="relative">
                  <Input
                    id="scheduled_date"
                    type="datetime-local"
                    value={formData.scheduled_date}
                    onChange={(e) => handleInputChange("scheduled_date", e.target.value)}
                    className="pr-10"
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/telemedicine/outpatient")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={scheduleAppointmentMutation.isPending}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  {scheduleAppointmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Schedule Appointment
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
