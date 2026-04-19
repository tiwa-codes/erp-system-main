"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  TestTube,
  Stethoscope,
  Pill,
  Send,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Eye,
  Download,
  FileImage,
  Copy
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"

interface Patient {
  id: string
  enrollee_id: string
  first_name: string
  last_name: string
  gender: string
  date_of_birth: string
  phone_number: string
  email: string
  residential_address: string
  plan: {
    name: string
  }
  organization: {
    name: string
  }
}

interface ClinicalEncounter {
  id: string
  presenting_complaints: string
  clinical_notes: string
  assessment: string
  diagnosis: string
  plan_notes: string
  created_at: string
  status?: string
  created_by: {
    first_name: string
    last_name: string
  }
}

interface FacilityOption {
  id: string
  facility_name: string
  facility_type: string
}

export default function PatientTimelinePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const patientId = params.id as string
  
  // Check if this is a dependent or principal from URL search params
  const patientType = searchParams.get('type') || 'principal'
  const isDependent = patientType === 'dependent'
  const returnTo = searchParams.get("returnTo") || "/telemedicine/outpatient"
  
  const [selectedTab, setSelectedTab] = useState("clinical-encounter")
  const [expandedEncounters, setExpandedEncounters] = useState<string[]>([])
  const [showAddEncounterModal, setShowAddEncounterModal] = useState(false)
  const [currentEncounterId, setCurrentEncounterId] = useState<string | null>(null)
  const [showAddLabModal, setShowAddLabModal] = useState(false)
  const [showAddRadiologyModal, setShowAddRadiologyModal] = useState(false)
  const [showAddPrescriptionModal, setShowAddPrescriptionModal] = useState(false)
  const [showAddReferralModal, setShowAddReferralModal] = useState(false)
  
  const [clinicalEncounterData, setClinicalEncounterData] = useState({
    presenting_complaints: "",
    clinical_notes: "",
    assessment: "",
    diagnosis: "",
    plan_notes: ""
  })
  
  const [labOrderData, setLabOrderData] = useState({
    facility_id: "",
    test_names: [] as string[],
    requested_by: ""
  })
  
  const [radiologyOrderData, setRadiologyOrderData] = useState({
    facility_id: "",
    test_names: [] as string[],
    requested_by: ""
  })
  
  // Lab service search states
  const [labServiceSearchTerm, setLabServiceSearchTerm] = useState("")
  const [debouncedLabServiceSearch, setDebouncedLabServiceSearch] = useState("")
  const [showLabServiceResults, setShowLabServiceResults] = useState(false)
  const [selectedLabServices, setSelectedLabServices] = useState<any[]>([])
  
  // Radiology service search states
  const [radiologyServiceSearchTerm, setRadiologyServiceSearchTerm] = useState("")
  const [debouncedRadiologyServiceSearch, setDebouncedRadiologyServiceSearch] = useState("")
  const [showRadiologyServiceResults, setShowRadiologyServiceResults] = useState(false)
  const [selectedRadiologyServices, setSelectedRadiologyServices] = useState<any[]>([])
  
  const [prescriptionData, setPrescriptionData] = useState({
    facility_id: "",
    delivery_address: "",
    requested_by: ""
  })
  
  // Medications list - each medication has its own fields
  const [medicationsList, setMedicationsList] = useState<Array<{
    id: string
    medication: string
    medication_id: string
    price: number
    dose: string
    quantity: string
    duration: string
    frequency: string
  }>>([])
  
  // Current medication being added
  const [currentMedication, setCurrentMedication] = useState({
    medication: "",
    medication_id: "",
    price: 0,
    dose: "",
    quantity: "",
    duration: "",
    frequency: ""
  })
  
  // Pharmacy tariff plan medications
  const [pharmacyTariffMedications, setPharmacyTariffMedications] = useState<any[]>([])
  const [pharmacyMedicationSearchTerm, setPharmacyMedicationSearchTerm] = useState("")
  const [showPharmacyMedicationResults, setShowPharmacyMedicationResults] = useState(false)
  
  const [referralData, setReferralData] = useState({
    referral_type: "",
    reason: "",
    requested_by: ""
  })

  // Results modal state
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [orderResults, setOrderResults] = useState<any>(null)

  // ICD-10 diagnosis search state
  const [diagnosisSearch, setDiagnosisSearch] = useState("")
  const [debouncedDiagnosisSearch, setDebouncedDiagnosisSearch] = useState("")
  const [showDiagnosisSuggestions, setShowDiagnosisSuggestions] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDiagnosisSearch(diagnosisSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [diagnosisSearch])

  // Fetch patient details - handle both principals and dependents
  const { data: patientData, isLoading: patientLoading } = useQuery({
    queryKey: ["patient", patientId, isDependent],
    queryFn: async () => {
      const endpoint = isDependent 
        ? `/api/underwriting/dependents/${patientId}`
        : `/api/underwriting/principals/${patientId}`
      const res = await fetch(endpoint)
      if (!res.ok) {
        throw new Error("Failed to fetch patient details")
      }
      const data = await res.json()
      
      // Normalize dependent data to match principal structure for the UI
      if (isDependent) {
        return {
          id: data.id,
          enrollee_id: data.dependent_id,
          first_name: data.first_name,
          last_name: data.last_name,
          gender: data.gender,
          date_of_birth: data.date_of_birth,
          phone_number: data.phone_number,
          email: data.email,
          residential_address: data.residential_address,
          plan: data.principal?.plan || null,
          organization: data.principal?.organization || null,
          is_dependent: true,
          principal: data.principal
        }
      }
      return data
    },
    enabled: !!patientId
  })

  // Fetch patient's appointments
  const { data: appointmentsData } = useQuery({
    queryKey: ["patient-appointments", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/telemedicine/appointments?enrollee_id=${patientId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch appointments")
      }
      return res.json()
    },
    enabled: !!patientId
  })

  // Fetch clinical encounters
  const { data: encountersData, isLoading: encountersLoading, refetch } = useQuery({
    queryKey: ["patient-clinical-encounters", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/telemedicine/patients/${patientId}/clinical-encounters`)
      if (!res.ok) {
        throw new Error("Failed to fetch clinical encounters")
      }
      return res.json()
    },
    enabled: !!patientId
  })

  // ICD-10 diagnosis search
  const { data: icdData } = useQuery({
    queryKey: ["icd10-diagnoses", debouncedDiagnosisSearch],
    queryFn: async () => {
      const res = await fetch(`/api/telemedicine/diagnoses?search=${encodeURIComponent(debouncedDiagnosisSearch)}`)
      if (!res.ok) throw new Error("Failed to fetch diagnoses")
      return res.json()
    },
    enabled: debouncedDiagnosisSearch.length >= 2,
  })
  const icdSuggestions: { id: string; code: string; description: string }[] = icdData?.diagnoses || []

  // Fetch facilities for lab and radiology orders
  const { data: facilitiesData } = useQuery({
    queryKey: ["telemedicine-facilities"],
    queryFn: async () => {
      const res = await fetch("/api/telemedicine/facilities")
      if (!res.ok) {
        throw new Error("Failed to fetch facilities")
      }
      return res.json()
    }
  })

  // Fetch lab orders for this patient
  const { data: labOrdersData } = useQuery({
    queryKey: ["patient-lab-orders", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/telemedicine/patients/${patientId}/lab-orders`)
      if (!res.ok) {
        throw new Error("Failed to fetch lab orders")
      }
      return res.json()
    },
    enabled: !!patientId
  })

  // Fetch radiology orders for this patient
  const { data: radiologyOrdersData } = useQuery({
    queryKey: ["patient-radiology-orders", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/telemedicine/patients/${patientId}/radiology-orders`)
      if (!res.ok) {
        throw new Error("Failed to fetch radiology orders")
      }
      return res.json()
    },
    enabled: !!patientId
  })

  // Fetch pharmacy orders for this patient
  const { data: pharmacyOrdersData } = useQuery({
    queryKey: ["patient-pharmacy-orders", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/telemedicine/patients/${patientId}/pharmacy-orders`)
      if (!res.ok) {
        throw new Error("Failed to fetch pharmacy orders")
      }
      return res.json()
    },
    enabled: !!patientId
  })

  // Fetch referrals for this patient
  const { data: referralsData } = useQuery({
    queryKey: ["patient-referrals", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/telemedicine/patients/${patientId}/referrals`)
      if (!res.ok) {
        throw new Error("Failed to fetch referrals")
      }
      return res.json()
    },
    enabled: !!patientId
  })

  const patient: Patient = patientData
  const encounters: ClinicalEncounter[] = encountersData?.encounters || []
  const facilities: FacilityOption[] = facilitiesData?.facilities || []
  const labOrders = labOrdersData?.labOrders || []
  const radiologyOrders = radiologyOrdersData?.radiologyOrders || []
  const pharmacyOrders = pharmacyOrdersData?.pharmacyOrders || []
  const referrals = referralsData?.referrals || []

  // Auto-populate requested_by from logged-in user
  useEffect(() => {
    if (session?.user?.name) {
      setLabOrderData(prev => ({
        ...prev,
        requested_by: session.user.name
      }))
      setRadiologyOrderData(prev => ({
        ...prev,
        requested_by: session.user.name
      }))
      setPrescriptionData(prev => ({
        ...prev,
        requested_by: session.user.name
      }))
    }
  }, [session?.user?.name])

  // Debounce lab service search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLabServiceSearch(labServiceSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [labServiceSearchTerm])

  // Debounce radiology service search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRadiologyServiceSearch(radiologyServiceSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [radiologyServiceSearchTerm])

  // Fetch lab services from Service Type settings
  const { data: labServicesData, isLoading: isLoadingLabServices } = useQuery({
    queryKey: ["lab-services", debouncedLabServiceSearch],
    queryFn: async () => {
      if (!debouncedLabServiceSearch || debouncedLabServiceSearch.length < 2) return { serviceTypes: [] }
      
      const res = await fetch(`/api/settings/service-types?search=${encodeURIComponent(debouncedLabServiceSearch)}&category=LAB`)
      if (!res.ok) throw new Error("Failed to fetch lab services")
      return res.json()
    },
    enabled: debouncedLabServiceSearch.length >= 2
  })

  const labServices = labServicesData?.serviceTypes || []

  // Fetch radiology services from Service Type settings
  const { data: radiologyServicesData, isLoading: isLoadingRadiologyServices } = useQuery({
    queryKey: ["radiology-services", debouncedRadiologyServiceSearch],
    queryFn: async () => {
      if (!debouncedRadiologyServiceSearch || debouncedRadiologyServiceSearch.length < 2) return { serviceTypes: [] }
      
      const res = await fetch(`/api/settings/service-types?search=${encodeURIComponent(debouncedRadiologyServiceSearch)}&category=RAD`)
      if (!res.ok) throw new Error("Failed to fetch radiology services")
      return res.json()
    },
    enabled: debouncedRadiologyServiceSearch.length >= 2
  })

  const radiologyServices = radiologyServicesData?.serviceTypes || []

  // Close service search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.lab-service-search-container') && 
          !target.closest('.radiology-service-search-container') &&
          !target.closest('.pharmacy-medication-search-container')) {
        setShowLabServiceResults(false)
        setShowRadiologyServiceResults(false)
        setShowPharmacyMedicationResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Fetch pharmacy tariff plan when facility is selected
  const { data: pharmacyTariffData, isLoading: isLoadingPharmacyTariff } = useQuery({
    queryKey: ["pharmacy-tariff", prescriptionData.facility_id],
    queryFn: async () => {
      if (!prescriptionData.facility_id) return { services: [] }
      
      const res = await fetch(`/api/telemedicine/facilities/${prescriptionData.facility_id}/tariff-plan`)
      if (!res.ok) throw new Error("Failed to fetch pharmacy tariff plan")
      return res.json()
    },
    enabled: !!prescriptionData.facility_id
  })

  // Update pharmacy tariff medications when data is fetched
  useEffect(() => {
    if (pharmacyTariffData?.services) {
      setPharmacyTariffMedications(pharmacyTariffData.services)
    } else {
      setPharmacyTariffMedications([])
    }
  }, [pharmacyTariffData])

  // Filter medications based on search term
  const filteredPharmacyMedications = pharmacyMedicationSearchTerm
    ? pharmacyTariffMedications.filter((med: any) =>
        med.service_name.toLowerCase().includes(pharmacyMedicationSearchTerm.toLowerCase())
      )
    : pharmacyTariffMedications

  // Clinical encounter mutation
  const clinicalEncounterMutation = useMutation({
    mutationFn: async (data: any) => {
      // Get the most recent appointment for this patient
      const appointments = appointmentsData?.appointments || []
      const latestAppointment = appointments[0] // Assuming appointments are sorted by date desc
      
      if (!latestAppointment) {
        throw new Error("No appointment found for this patient")
      }

      const res = await fetch(`/api/telemedicine/patients/${patientId}/clinical-encounter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save clinical encounter")
      }

      return res.json()
    },
    onSuccess: (data: any) => {
      const status = data.encounter?.status || data.clinicalEncounter?.status || 'COMPLETED'
      toast({
        title: status === 'COMPLETED' ? "Clinical Encounter Completed" : "Progress Saved",
        description: status === 'COMPLETED' 
          ? "The clinical encounter has been completed and saved." 
          : "The clinical encounter has been saved as in-progress. You can continue later.",
      })
      
      if (status === 'COMPLETED') {
        setShowAddEncounterModal(false)
        setCurrentEncounterId(null)
        setClinicalEncounterData({
          presenting_complaints: "",
          clinical_notes: "",
          assessment: "",
          diagnosis: "",
          plan_notes: ""
        })
      } else {
        // Update currentEncounterId to the returned encounter ID so future saves update the same encounter
        const encounterId = data.encounter?.id || data.clinicalEncounter?.id
        if (encounterId) {
          setCurrentEncounterId(encounterId)
        }
      }
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

  // Lab order mutation
  const labOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      // Get the most recent appointment for this patient
      const appointments = appointmentsData?.appointments || []
      const latestAppointment = appointments[0] // Assuming appointments are sorted by date desc
      
      if (!latestAppointment) {
        throw new Error("No appointment found for this patient")
      }

      // Validate facility and services
      if (!data.facility_id) {
        throw new Error("Please select a lab facility")
      }

      const testNames = data.test_names || []
      if (testNames.length === 0) {
        throw new Error("Please select at least one lab test")
      }

      const results = []
      const errors = []

      // Create orders for each service
      for (const testName of testNames) {
        try {
      const res = await fetch(`/api/telemedicine/appointments/${latestAppointment.id}/lab-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
            body: JSON.stringify({
              facility_id: data.facility_id,
              test_name: testName,
              requested_by: data.requested_by
            }),
      })

      if (!res.ok) {
        const error = await res.json()
        // Check if it's a band validation error
        if (error.band_validation && !error.band_validation.is_accessible) {
              errors.push(`Band Access Error for ${testName}: ${error.band_validation.message}`)
            } else {
              errors.push(error.error || `Failed to create lab order for ${testName}`)
      }
          } else {
            const result = await res.json()
            results.push(result)
          }
        } catch (error) {
          errors.push(`Error creating order for ${testName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // If all failed, throw error
      if (results.length === 0 && errors.length > 0) {
        throw new Error(errors.join('; '))
      }

      // If some succeeded and some failed, return partial success
      if (errors.length > 0) {
        return {
          success: true,
          partial: true,
          results,
          errors,
          message: `Created ${results.length} order(s) successfully. ${errors.length} order(s) failed.`
        }
      }

      return {
        success: true,
        results,
        message: `Successfully created ${results.length} lab order(s). Email sent to facility and EHR requests created.`
      }
    },
    onSuccess: (data) => {
      toast({
        title: data.partial ? "Lab Orders Partially Created" : "Lab Orders Created",
        description: data.message || "The lab orders have been created successfully.",
        variant: data.partial ? "default" : "default"
      })
      if (data.errors && data.errors.length > 0) {
        // Show errors in a separate toast
        toast({
          title: "Some Orders Failed",
          description: data.errors.join('; '),
          variant: "destructive"
        })
      }
      setShowAddLabModal(false)
      setLabOrderData({
        facility_id: "",
        test_names: [],
        requested_by: session?.user?.name || ""
      })
      setSelectedLabServices([])
      setLabServiceSearchTerm("")
      // Invalidate and refetch lab orders
      queryClient.invalidateQueries({ queryKey: ["patient-lab-orders", patientId] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Radiology order mutation
  const radiologyOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      // Get the most recent appointment for this patient
      const appointments = appointmentsData?.appointments || []
      const latestAppointment = appointments[0] // Assuming appointments are sorted by date desc
      
      if (!latestAppointment) {
        throw new Error("No appointment found for this patient")
      }

      // Validate facility and services
      if (!data.facility_id) {
        throw new Error("Please select a radiology facility")
      }

      const testNames = data.test_names || []
      if (testNames.length === 0) {
        throw new Error("Please select at least one radiology test")
      }

      const results = []
      const errors = []

      // Create orders for each service
      for (const testName of testNames) {
        try {
      const res = await fetch(`/api/telemedicine/appointments/${latestAppointment.id}/radiology-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
            body: JSON.stringify({
              facility_id: data.facility_id,
              test_name: testName,
              requested_by: data.requested_by
            }),
      })

      if (!res.ok) {
        const error = await res.json()
        // Check if it's a band validation error
        if (error.band_validation && !error.band_validation.is_accessible) {
              errors.push(`Band Access Error for ${testName}: ${error.band_validation.message}`)
            } else {
              errors.push(error.error || `Failed to create radiology order for ${testName}`)
      }
          } else {
            const result = await res.json()
            results.push(result)
          }
        } catch (error) {
          errors.push(`Error creating order for ${testName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // If all failed, throw error
      if (results.length === 0 && errors.length > 0) {
        throw new Error(errors.join('; '))
      }

      // If some succeeded and some failed, return partial success
      if (errors.length > 0) {
        return {
          success: true,
          partial: true,
          results,
          errors,
          message: `Created ${results.length} order(s) successfully. ${errors.length} order(s) failed.`
        }
      }

      return {
        success: true,
        results,
        message: `Successfully created ${results.length} radiology order(s). Email sent to facility and EHR requests created.`
      }
    },
    onSuccess: (data) => {
      toast({
        title: data.partial ? "Radiology Orders Partially Created" : "Radiology Orders Created",
        description: data.message || "The radiology orders have been created successfully.",
        variant: data.partial ? "default" : "default"
      })
      if (data.errors && data.errors.length > 0) {
        // Show errors in a separate toast
        toast({
          title: "Some Orders Failed",
          description: data.errors.join('; '),
          variant: "destructive"
        })
      }
      setShowAddRadiologyModal(false)
      setRadiologyOrderData({
        facility_id: "",
        test_names: [],
        requested_by: session?.user?.name || ""
      })
      setRadiologyServiceSearchTerm("")
      setSelectedRadiologyServices([])
      // Invalidate and refetch radiology orders
      queryClient.invalidateQueries({ queryKey: ["patient-radiology-orders", patientId] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Prescription mutation - sends all medications in one API call
  const prescriptionMutation = useMutation({
    mutationFn: async (data: any) => {
      // Get the most recent appointment for this patient
      const appointments = appointmentsData?.appointments || []
      const latestAppointment = appointments[0] // Assuming appointments are sorted by date desc
      
      if (!latestAppointment) {
        throw new Error("No appointment found for this patient")
      }

      // Validate facility and medications
      if (!data.facility_id) {
        throw new Error("Please select a pharmacy")
      }

      const medications = data.medications || []
      if (medications.length === 0) {
        throw new Error("Please add at least one medication")
      }

      // Send all medications in one API call
      const res = await fetch(`/api/telemedicine/appointments/${latestAppointment.id}/pharmacy-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facility_id: data.facility_id,
          medications: medications.map((med: any) => ({
            medication: med.medication,
            medication_id: med.medication_id,
            dose: med.dose,
            quantity: parseInt(med.quantity),
            duration: med.duration,
            frequency: med.frequency,
            price: med.price
          })),
          delivery_address: data.delivery_address || undefined,
          requested_by: data.requested_by
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create prescriptions")
      }

      const result = await res.json()
      return result
    },
    onSuccess: (data) => {
      toast({
        title: "Prescriptions Created",
        description: data.message || "The prescriptions have been created successfully. A single email has been sent to the pharmacy with all medications.",
        variant: "default"
      })
      setShowAddPrescriptionModal(false)
      setPrescriptionData({
        facility_id: "",
        delivery_address: "",
        requested_by: session?.user?.name || ""
      })
      setMedicationsList([])
      setCurrentMedication({
        medication: "",
        medication_id: "",
        price: 0,
        dose: "",
        quantity: "",
        duration: "",
        frequency: ""
      })
      setPharmacyMedicationSearchTerm("")
      // Invalidate and refetch pharmacy orders
      queryClient.invalidateQueries({ queryKey: ["patient-pharmacy-orders", patientId] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Referral mutation
  const referralMutation = useMutation({
    mutationFn: async (data: any) => {
      // Get the most recent appointment for this patient
      const appointments = appointmentsData?.appointments || []
      const latestAppointment = appointments[0] // Assuming appointments are sorted by date desc
      
      if (!latestAppointment) {
        throw new Error("No appointment found for this patient")
      }

      const res = await fetch(`/api/telemedicine/appointments/${latestAppointment.id}/referral`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create referral")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Referral Created",
        description: "The referral has been created successfully.",
      })
      setShowAddReferralModal(false)
      setReferralData({
        referral_type: "",
        reason: "",
        requested_by: ""
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleAddEncounterSubmit = (e: React.FormEvent, saveStatus: 'IN_PROGRESS' | 'COMPLETED') => {
    e.preventDefault()
    clinicalEncounterMutation.mutate({
      ...clinicalEncounterData,
      status: saveStatus,
      encounter_id: currentEncounterId
    })
  }

  const handleEditEncounter = (encounter: ClinicalEncounter) => {
    setClinicalEncounterData({
      presenting_complaints: encounter.presenting_complaints || "",
      clinical_notes: encounter.clinical_notes || "",
      assessment: encounter.assessment || "",
      diagnosis: encounter.diagnosis || "",
      plan_notes: encounter.plan_notes || ""
    })
    setCurrentEncounterId(encounter.id)
    setShowAddEncounterModal(true)
  }

  const handleAddLabSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate facility
    if (!labOrderData.facility_id) {
      toast({
        title: "Error",
        description: "Please select a lab facility",
        variant: "destructive",
      })
      return
    }

    // Validate services
    if (!labOrderData.test_names || labOrderData.test_names.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one lab test",
        variant: "destructive",
      })
      return
    }

    labOrderMutation.mutate(labOrderData)
  }

  const handleLabServiceToggle = (service: any, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation()
    }
    
    const serviceName = service.service_name
    setSelectedLabServices(prev => {
      const isSelected = prev.some(s => s.service_name === serviceName)
      if (isSelected) {
        // Remove service
        return prev.filter(s => s.service_name !== serviceName)
      } else {
        // Add service
        return [...prev, service]
      }
    })
  }

  // Update test_names when selectedLabServices changes
  useEffect(() => {
    setLabOrderData(prev => ({
      ...prev,
      test_names: selectedLabServices.map(s => s.service_name)
    }))
  }, [selectedLabServices])

  const handleAddRadiologySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate facility
    if (!radiologyOrderData.facility_id) {
      toast({
        title: "Error",
        description: "Please select a radiology facility",
        variant: "destructive",
      })
      return
    }

    // Validate services
    if (!radiologyOrderData.test_names || radiologyOrderData.test_names.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one radiology test",
        variant: "destructive",
      })
      return
    }

    radiologyOrderMutation.mutate(radiologyOrderData)
  }

  const handleRadiologyServiceToggle = (service: any, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation()
    }
    
    const serviceName = service.service_name
    setSelectedRadiologyServices(prev => {
      const isSelected = prev.some(s => s.service_name === serviceName)
      if (isSelected) {
        // Remove service
        return prev.filter(s => s.service_name !== serviceName)
      } else {
        // Add service
        return [...prev, service]
      }
    })
  }

  // Update test_names when selectedRadiologyServices changes
  useEffect(() => {
    setRadiologyOrderData(prev => ({
      ...prev,
      test_names: selectedRadiologyServices.map(s => s.service_name)
    }))
  }, [selectedRadiologyServices])

  // Reset current medication when pharmacy changes
  useEffect(() => {
    if (prescriptionData.facility_id) {
      setCurrentMedication({
        medication: "",
        medication_id: "",
        price: 0,
        dose: "",
        quantity: "",
        duration: "",
        frequency: ""
      })
      setMedicationsList([])
    }
  }, [prescriptionData.facility_id])

  // Handler to add medication to list
  const handleAddMedication = () => {
    if (!currentMedication.medication || !currentMedication.medication_id) {
      toast({
        title: "Error",
        description: "Please select a medication",
        variant: "destructive",
      })
      return
    }

    if (!currentMedication.dose || !currentMedication.quantity || 
        !currentMedication.duration || !currentMedication.frequency) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (dose, quantity, duration, frequency)",
        variant: "destructive",
      })
      return
    }

    // Add medication to list
    setMedicationsList(prev => [...prev, {
      id: `med-${Date.now()}-${Math.random()}`,
      medication: currentMedication.medication,
      medication_id: currentMedication.medication_id,
      price: currentMedication.price,
      dose: currentMedication.dose,
      quantity: currentMedication.quantity,
      duration: currentMedication.duration,
      frequency: currentMedication.frequency
    }])

    // Reset current medication
    setCurrentMedication({
      medication: "",
      medication_id: "",
      price: 0,
      dose: "",
      quantity: "",
      duration: "",
      frequency: ""
    })
    setPharmacyMedicationSearchTerm("")
    setShowPharmacyMedicationResults(false)
  }

  // Handler to remove medication from list
  const handleRemoveMedication = (medicationId: string) => {
    setMedicationsList(prev => prev.filter(m => m.id !== medicationId))
  }

  // Handler to select medication from tariff plan
  const handleSelectMedication = (medication: any) => {
    setCurrentMedication(prev => ({
      ...prev,
      medication: medication.service_name,
      medication_id: medication.id,
      price: medication.current_price
    }))
    setPharmacyMedicationSearchTerm(medication.service_name)
    setShowPharmacyMedicationResults(false)
  }

  const handleAddPrescriptionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate facility
    if (!prescriptionData.facility_id) {
      toast({
        title: "Error",
        description: "Please select a pharmacy",
        variant: "destructive",
      })
      return
    }

    // Validate medications list
    if (medicationsList.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one medication",
        variant: "destructive",
      })
      return
    }
    
    prescriptionMutation.mutate({
      ...prescriptionData,
      medications: medicationsList
    })
  }

  const handleAddReferralSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    referralMutation.mutate(referralData)
  }



  const handleViewResults = async (order: any) => {
    setSelectedOrder(order)
    setShowResultsModal(true)
    
    try {
      const response = await fetch(`/api/telemedicine/facility-portal/${order.id}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch order results: ${response.status}`)
      }
      
      const data = await response.json()
      setOrderResults(data.order)
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to load order results: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      })
    }
  }

  const handleCloseResultsModal = () => {
    setShowResultsModal(false)
    setSelectedOrder(null)
    setOrderResults(null)
  }

  // Add keyboard support for closing modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showResultsModal) {
        handleCloseResultsModal()
      }
    }

    if (showResultsModal) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [showResultsModal])

  const handleDownloadFile = (fileName: string, fileUrl: string) => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getEncounterStatusBadgeColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const toggleEncounterExpansion = (encounterId: string) => {
    setExpandedEncounters(prev => 
      prev.includes(encounterId) 
        ? prev.filter(id => id !== encounterId)
        : [...prev, encounterId]
    )
  }

  const tabs = [
    { id: "clinical-encounter", name: "Clinical Encounter", icon: FileText },
    { id: "lab-test", name: "Lab Test", icon: TestTube },
    { id: "radiology", name: "Radiology", icon: Stethoscope },
    { id: "prescription", name: "Prescription", icon: Pill },
    { id: "referral", name: "Referral", icon: Send }
  ]

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Patient Not Found</h2>
          <p className="text-gray-600 mt-2">The requested patient could not be found.</p>
          <Button 
            onClick={() => router.push(returnTo)}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Outpatients
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate module="telemedicine" action="view">
      <div className="flex h-screen">
        {/* Left Panel - Patient Information */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 p-6">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(returnTo)}
              className="p-0 h-auto text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isDependent ? 'Dependent Timeline' : 'Principal Timeline'}
            </Button>
            <span className="text-gray-500"> &gt; {patient.first_name} {patient.last_name}</span>
          </div>

          {/* Patient Header */}
          <div className="text-center mb-6">
            <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto mb-4 flex items-center justify-center">
              <User className="h-12 w-12 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{patient.first_name} {patient.last_name}</h2>
            <p className="text-sm text-gray-600">ID: {patient.enrollee_id}</p>
            <Badge className="bg-green-100 text-green-800 mt-2">Active</Badge>
          </div>

          {/* Personal Details */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Gender:</Label>
                  <p className="text-sm">{patient.gender || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">DOB:</Label>
                  <p className="text-sm">{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('en-GB') : 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Phone Number:</Label>
                  <p className="text-sm">{patient.phone_number || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Email Address:</Label>
                  <p className="text-sm">{patient.email || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Residential Address:</Label>
                  <p className="text-sm">{patient.residential_address || 'Not specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Details */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Band Type:</Label>
                  <p className="text-sm">Not specified</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Plan Type:</Label>
                  <p className="text-sm">{patient.plan?.name || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Account Type:</Label>
                  <p className="text-sm">Not specified</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Premium Balance:</Label>
                  <p className="text-sm">Not specified</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Clinical Timeline */}
        <div className="flex-1 p-6">
          {/* Module Navigation Tabs */}
          <div className="flex space-x-1 mb-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTab === tab.id
                      ? 'bg-[#BE1522] text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.name}
                </button>
              )
            })}
          </div>

          {/* Clinical Encounter Tab Content */}
          {selectedTab === "clinical-encounter" && (
            <div className="space-y-6">
              {/* Filter Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Filter
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Input id="type" placeholder="Select type" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input id="start_date" type="date" placeholder="dd-mm-yy" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date</Label>
                      <Input id="end_date" type="date" placeholder="dd-mm-yy" />
                    </div>
                    <div className="flex items-end">
                      <Button className="bg-[#BE1522] hover:bg-[#9B1219]">
                        Search
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-between items-center">
                <Button className="bg-[#BE1522] hover:bg-[#9B1219]">
                  <Phone className="h-4 w-4 mr-2" />
                  Make a call
                </Button>
                <PermissionGate module="telemedicine" action="add">
                  <Button 
                    onClick={() => setShowAddEncounterModal(true)}
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Add Clinical Encounter
                  </Button>
                </PermissionGate>
              </div>

              {/* Previous Clinical Encounters */}
              <Card>
                <CardHeader>
                  <CardTitle>Previous Clinical Encounter ({encounters.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Status Filters */}
                  <div className="flex space-x-2 mb-4">
                    <Button variant="outline" size="sm" className="bg-blue-100 text-blue-800">
                      All
                    </Button>
                    <Button variant="outline" size="sm">
                      In Progress
                    </Button>
                    <Button variant="outline" size="sm">
                      Completed
                    </Button>
                  </div>

                  {/* Encounters List */}
                  <div className="space-y-2">
                    {encounters.map((encounter) => (
                      <div key={encounter.id} className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-medium text-blue-900">
                                  {new Date(encounter.created_at).toLocaleDateString('en-GB')} | {new Date(encounter.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <Badge className={getEncounterStatusBadgeColor(encounter.status || 'COMPLETED')}>
                                  {encounter.status === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
                                </Badge>
                              </div>
                              <div className="text-sm text-blue-700">
                                By: {encounter.created_by.first_name} {encounter.created_by.last_name}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {encounter.status === 'IN_PROGRESS' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditEncounter(encounter)}
                                className="text-xs px-2 py-1 h-auto border-yellow-600 text-yellow-700 hover:bg-yellow-50"
                              >
                                Continue Editing
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleEncounterExpansion(encounter.id)}
                            >
                              {expandedEncounters.includes(encounter.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        {/* Expanded Encounter Details */}
                        {expandedEncounters.includes(encounter.id) && (
                          <div className="mt-4 space-y-3 text-sm">
                            {encounter.presenting_complaints && (
                              <div>
                                <Label className="text-blue-800 font-medium">Presenting Complaints:</Label>
                                <p className="text-blue-700">{encounter.presenting_complaints}</p>
                              </div>
                            )}
                            {encounter.clinical_notes && (
                              <div>
                                <Label className="text-blue-800 font-medium">Clinical Notes:</Label>
                                <p className="text-blue-700">{encounter.clinical_notes}</p>
                              </div>
                            )}
                            {encounter.assessment && (
                              <div>
                                <Label className="text-blue-800 font-medium">Assessment:</Label>
                                <p className="text-blue-700">{encounter.assessment}</p>
                              </div>
                            )}
                            {encounter.diagnosis && (
                              <div>
                                <Label className="text-blue-800 font-medium">Diagnosis:</Label>
                                <p className="text-blue-700">{encounter.diagnosis}</p>
                              </div>
                            )}
                            {encounter.plan_notes && (
                              <div>
                                <Label className="text-blue-800 font-medium">Plan Notes:</Label>
                                <p className="text-blue-700">{encounter.plan_notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Other Tabs Content */}
          {selectedTab !== "clinical-encounter" && (
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {tabs.find(t => t.id === selectedTab)?.name}
                  </h2>
                  <p className="text-gray-600">Manage {tabs.find(t => t.id === selectedTab)?.name.toLowerCase()} for this patient</p>
                </div>
                <PermissionGate module="telemedicine" action="add">
                  <Button 
                    onClick={() => {
                      // Handle add action based on selected tab
                      switch (selectedTab) {
                        case 'lab-test':
                          setShowAddLabModal(true)
                          break
                        case 'radiology':
                          setShowAddRadiologyModal(true)
                          break
                        case 'prescription':
                          setShowAddPrescriptionModal(true)
                          break
                        case 'referral':
                          setShowAddReferralModal(true)
                          break
                        default:
                          toast({
                            title: "Coming Soon",
                            description: `${tabs.find(t => t.id === selectedTab)?.name} functionality will be available soon`
                          })
                      }
                    }}
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add {tabs.find(t => t.id === selectedTab)?.name}
                  </Button>
                </PermissionGate>
              </div>

              {/* Tab Content */}
              <Card>
                <CardHeader>
                  <CardTitle>{tabs.find(t => t.id === selectedTab)?.name} Records</CardTitle>
                  <CardDescription>
                    {selectedTab === 'lab-test' && `${labOrders.length} lab orders`}
                    {selectedTab === 'radiology' && `${radiologyOrders.length} radiology orders`}
                    {selectedTab === 'prescription' && `${pharmacyOrders.length} prescriptions`}
                    {selectedTab === 'referral' && `${referrals.length} referrals`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Lab Test Tab Content */}
                  {selectedTab === 'lab-test' && (
                    <div className="space-y-4">
                      {labOrders.length === 0 ? (
                        <div className="text-center py-8">
                          <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No lab orders found for this patient.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Test Name</TableHead>
                                <TableHead>Facility</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {labOrders.map((order: any) => (
                                <TableRow key={order.id}>
                                  <TableCell className="font-medium">{order.test_name}</TableCell>
                                  <TableCell>{order.facility?.facility_name || 'N/A'}</TableCell>
                                  <TableCell>
                                    {new Date(order.created_at).toLocaleDateString('en-GB')}
                                    <span className="text-xs text-gray-500 block">{order.requested_by}</span>
                                  </TableCell>
                                  <TableCell className="font-semibold">
                                    {order.amount ? `₦${order.amount.toLocaleString()}` : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={getStatusBadgeColor(order.status)}>
                                      {order.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleViewResults(order)}
                                        className="flex items-center gap-1"
                                      >
                                        <Eye className="h-4 w-4" />
                                        View
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Radiology Tab Content */}
                  {selectedTab === 'radiology' && (
                    <div className="space-y-4">
                      {radiologyOrders.length === 0 ? (
                        <div className="text-center py-8">
                          <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No radiology orders found for this patient.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Test Name</TableHead>
                                <TableHead>Facility</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {radiologyOrders.map((order: any) => (
                                <TableRow key={order.id}>
                                  <TableCell className="font-medium">{order.test_name}</TableCell>
                                  <TableCell>{order.facility?.facility_name || 'N/A'}</TableCell>
                                  <TableCell>
                                    {new Date(order.created_at).toLocaleDateString('en-GB')}
                                    <span className="text-xs text-gray-500 block">{order.requested_by}</span>
                                  </TableCell>
                                  <TableCell className="font-semibold">
                                    {order.amount ? `₦${order.amount.toLocaleString()}` : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={getStatusBadgeColor(order.status)}>
                                      {order.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleViewResults(order)}
                                        className="flex items-center gap-1"
                                      >
                                        <Eye className="h-4 w-4" />
                                        View
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Prescription Tab Content */}
                  {selectedTab === 'prescription' && (
                    <div className="space-y-4">
                      {pharmacyOrders.length === 0 ? (
                        <div className="text-center py-8">
                          <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No prescriptions found for this patient.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Medication</TableHead>
                                <TableHead>Facility</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pharmacyOrders.map((order: any) => (
                                <TableRow key={order.id}>
                                  <TableCell className="font-medium">{order.medication}</TableCell>
                                  <TableCell>{order.facility?.facility_name || 'N/A'}</TableCell>
                                  <TableCell>
                                    <div className="text-sm space-y-1">
                                      <div><span className="text-gray-500">Dose:</span> {order.dose || 'N/A'}</div>
                                      <div><span className="text-gray-500">Qty:</span> {order.quantity || 'N/A'} | <span className="text-gray-500">Dur:</span> {order.duration || 'N/A'}</div>
                                      <div><span className="text-gray-500">Freq:</span> {order.frequency || 'N/A'}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {new Date(order.created_at).toLocaleDateString('en-GB')}
                                    <span className="text-xs text-gray-500 block">{order.requested_by}</span>
                                  </TableCell>
                                  <TableCell className="font-semibold">
                                    {order.amount ? `₦${order.amount.toLocaleString()}` : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={getStatusBadgeColor(order.status)}>
                                      {order.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleViewResults(order)}
                                        className="flex items-center gap-1"
                                      >
                                        <Eye className="h-4 w-4" />
                                        View
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Referral Tab Content */}
                  {selectedTab === 'referral' && (
                    <div className="space-y-4">
                      {referrals.length === 0 ? (
                        <div className="text-center py-8">
                          <Send className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No referrals found for this patient.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {referrals.map((referral: any) => (
                            <div key={referral.id} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-semibold">{referral.referral_type}</h4>
                                  <p className="text-sm text-gray-600">{referral.reason}</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(referral.created_at).toLocaleDateString('en-GB')} | {referral.requested_by}
                                  </p>
                                </div>
                                <Badge className={getStatusBadgeColor(referral.status)}>
                                  {referral.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Add Clinical Encounter Modal */}
        {showAddEncounterModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">
                    {currentEncounterId ? 'Continue Clinical Encounter' : 'Add Clinical Encounter'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddEncounterModal(false)
                      setCurrentEncounterId(null)
                      setClinicalEncounterData({
                        presenting_complaints: "",
                        clinical_notes: "",
                        assessment: "",
                        diagnosis: "",
                        plan_notes: ""
                      })
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {currentEncounterId 
                    ? `Continue editing clinical encounter for ${patient.first_name} ${patient.last_name}. You can continue editing this encounter and save your progress.`
                    : `Document clinical encounter for ${patient.first_name} ${patient.last_name}`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => handleAddEncounterSubmit(e, 'COMPLETED')} className="space-y-6">
                  {/* Presenting Complaints */}
                  <div className="space-y-2">
                    <Label htmlFor="presenting_complaints">Presenting Complaints</Label>
                    <Textarea
                      id="presenting_complaints"
                      value={clinicalEncounterData.presenting_complaints}
                      onChange={(e) => setClinicalEncounterData(prev => ({ ...prev, presenting_complaints: e.target.value }))}
                      placeholder="Insert text here..."
                      rows={4}
                    />
                  </div>

                  {/* Clinical Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="clinical_notes">Clinical Notes</Label>
                    <Textarea
                      id="clinical_notes"
                      value={clinicalEncounterData.clinical_notes}
                      onChange={(e) => setClinicalEncounterData(prev => ({ ...prev, clinical_notes: e.target.value }))}
                      placeholder="Insert text here..."
                      rows={4}
                    />
                  </div>

                  {/* Assessment */}
                  <div className="space-y-2">
                    <Label htmlFor="assessment">Assessment</Label>
                    <Textarea
                      id="assessment"
                      value={clinicalEncounterData.assessment}
                      onChange={(e) => setClinicalEncounterData(prev => ({ ...prev, assessment: e.target.value }))}
                      placeholder="Assessment"
                      rows={2}
                    />
                  </div>

                  {/* Diagnosis */}
                  <div className="space-y-2">
                    <Label>Diagnosis</Label>

                    {/* ICD-10 search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        placeholder="Search ICD-10 code or description..."
                        value={diagnosisSearch}
                        onChange={(e) => {
                          setDiagnosisSearch(e.target.value)
                          setShowDiagnosisSuggestions(true)
                        }}
                        onBlur={() => setTimeout(() => setShowDiagnosisSuggestions(false), 200)}
                        onFocus={() => diagnosisSearch.length >= 2 && setShowDiagnosisSuggestions(true)}
                        className="pl-9"
                        autoComplete="off"
                      />
                      {showDiagnosisSuggestions && icdSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {icdSuggestions.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                              onMouseDown={() => {
                                const entry = `${d.code} - ${d.description}`
                                setClinicalEncounterData(prev => ({
                                  ...prev,
                                  diagnosis: prev.diagnosis
                                    ? `${prev.diagnosis}; ${entry}`
                                    : entry,
                                }))
                                setDiagnosisSearch("")
                                setShowDiagnosisSuggestions(false)
                              }}
                            >
                              <span className="font-mono text-blue-600 mr-2">{d.code}</span>
                              <span className="text-gray-700">{d.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Select from ICD-10 above or type a custom diagnosis below</p>

                    {/* Free-form / combined diagnosis value */}
                    <Textarea
                      id="diagnosis"
                      value={clinicalEncounterData.diagnosis}
                      onChange={(e) => setClinicalEncounterData(prev => ({ ...prev, diagnosis: e.target.value }))}
                      placeholder="Diagnosis will appear here — edit freely or type a custom entry"
                      rows={2}
                    />
                  </div>

                  {/* Plan Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="plan_notes">Plan Notes</Label>
                    <Textarea
                      id="plan_notes"
                      value={clinicalEncounterData.plan_notes}
                      onChange={(e) => setClinicalEncounterData(prev => ({ ...prev, plan_notes: e.target.value }))}
                      placeholder="Plan Notes"
                      rows={2}
                    />
                  </div>

                  {/* Plan Actions */}
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Button type="button" variant="outline" className="flex items-center gap-2">
                        <TestTube className="h-4 w-4" />
                        Lab
                      </Button>
                      <Button type="button" variant="outline" className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        Radiology
                      </Button>
                      <Button type="button" variant="outline" className="flex items-center gap-2">
                        <Pill className="h-4 w-4" />
                        Prescription
                      </Button>
                      <Button type="button" variant="outline" className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Referral
                      </Button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center gap-4 pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddEncounterModal(false)
                        setCurrentEncounterId(null)
                        setClinicalEncounterData({
                          presenting_complaints: "",
                          clinical_notes: "",
                          assessment: "",
                          diagnosis: "",
                          plan_notes: ""
                        })
                      }}
                    >
                      Cancel
                    </Button>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => handleAddEncounterSubmit(e as any, 'IN_PROGRESS')}
                        disabled={clinicalEncounterMutation.isPending}
                        className="border-yellow-600 text-yellow-700 hover:bg-yellow-50"
                      >
                        {clinicalEncounterMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        💾 Save as In-Progress
                      </Button>
                      <Button
                        type="button"
                        onClick={(e) => handleAddEncounterSubmit(e as any, 'COMPLETED')}
                        disabled={clinicalEncounterMutation.isPending}
                        className="bg-[#BE1522] hover:bg-[#9B1219]"
                      >
                        {clinicalEncounterMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        ✓ Save as Complete
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Lab Order Modal */}
        {showAddLabModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Add Lab Order</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddLabModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Create a new lab order for {patient?.first_name} {patient?.last_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddLabSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="facility_id">Lab Facility</Label>
                    <Select value={labOrderData.facility_id} onValueChange={(value) => setLabOrderData(prev => ({ ...prev, facility_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lab facility" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.filter((f: FacilityOption) => f.facility_type === 'LAB').map((facility: FacilityOption) => (
                          <SelectItem key={facility.id} value={facility.id}>
                            {facility.facility_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="test_names">Lab Tests (Select Multiple)</Label>
                    <div className="relative lab-service-search-container">
                    <Input
                        id="test_names"
                        placeholder="Search and select lab tests"
                        value={labServiceSearchTerm}
                        onChange={(e) => {
                          setLabServiceSearchTerm(e.target.value)
                          setShowLabServiceResults(true)
                        }}
                        onFocus={() => setShowLabServiceResults(true)}
                      />
                      
                      {/* Lab Service Search Results */}
                      {showLabServiceResults && labServices.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {labServices.map((service: any) => {
                            const isSelected = selectedLabServices.some(s => s.service_name === service.service_name)
                            return (
                              <div
                                key={service.id}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                onClick={(e) => handleLabServiceToggle(service, e)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleLabServiceToggle(service)}
                                      />
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">{service.service_name}</p>
                                      <p className="text-xs text-gray-500">{service.service_category}</p>
                                    </div>
                                  </div>
                                  {service.service_type && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      {service.service_type}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      
                      {showLabServiceResults && debouncedLabServiceSearch.length >= 2 && isLoadingLabServices && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-sm text-gray-600">Searching services...</span>
                          </div>
                        </div>
                      )}
                      
                      {showLabServiceResults && debouncedLabServiceSearch.length >= 2 && !isLoadingLabServices && labServices.length === 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                          <p className="text-sm text-gray-600">No lab services found</p>
                        </div>
                      )}
                    </div>
                    {selectedLabServices.length > 0 && (
                      <div className="mt-2 border rounded-md p-3 bg-gray-50">
                        <p className="text-xs font-medium text-gray-700 mb-2">Selected Tests ({selectedLabServices.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedLabServices.map((service) => (
                            <Badge key={service.id} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                              {service.service_name}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleLabServiceToggle(service, e)
                                }}
                                className="ml-1 hover:bg-gray-300 rounded-full p-0.5 transition-colors"
                                aria-label={`Remove ${service.service_name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="requested_by">Requested By</Label>
                    <Input
                      id="requested_by"
                      value={labOrderData.requested_by || session?.user?.name || ""}
                      disabled
                      className="bg-gray-50 cursor-not-allowed"
                      placeholder="Loading user..."
                    />
                    <p className="text-xs text-gray-500">Automatically set to logged-in user</p>
                  </div>
                  
                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddLabModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={labOrderMutation.isPending}
                      className="bg-[#BE1522] hover:bg-[#9B1219]"
                    >
                      {labOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Lab Order
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Radiology Order Modal */}
        {showAddRadiologyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Add Radiology Order</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddRadiologyModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Create a new radiology order for {patient?.first_name} {patient?.last_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddRadiologySubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="facility_id">Radiology Facility</Label>
                    <Select value={radiologyOrderData.facility_id} onValueChange={(value) => setRadiologyOrderData(prev => ({ ...prev, facility_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select radiology facility" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.filter((f: FacilityOption) => f.facility_type === 'RADIOLOGY').map((facility: FacilityOption) => (
                          <SelectItem key={facility.id} value={facility.id}>
                            {facility.facility_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="test_names">Radiology Tests (Select Multiple)</Label>
                    <div className="relative radiology-service-search-container">
                      <Input
                        id="test_names"
                        placeholder="Search and select radiology tests"
                        value={radiologyServiceSearchTerm}
                        onChange={(e) => {
                          setRadiologyServiceSearchTerm(e.target.value)
                          setShowRadiologyServiceResults(true)
                        }}
                        onFocus={() => setShowRadiologyServiceResults(true)}
                      />
                      
                      {/* Radiology Service Search Results */}
                      {showRadiologyServiceResults && radiologyServices.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {radiologyServices.map((service: any) => {
                            const isSelected = selectedRadiologyServices.some(s => s.service_name === service.service_name)
                            return (
                            <div
                              key={service.id}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                onClick={(e) => handleRadiologyServiceToggle(service, e)}
                            >
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleRadiologyServiceToggle(service)}
                                      />
                                    </div>
                                <div>
                                  <p className="font-medium text-sm">{service.service_name}</p>
                                  <p className="text-xs text-gray-500">{service.service_category}</p>
                                    </div>
                                </div>
                                {service.service_type && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {service.service_type}
                                  </span>
                                )}
                              </div>
                            </div>
                            )
                          })}
                        </div>
                      )}
                      
                      {showRadiologyServiceResults && debouncedRadiologyServiceSearch.length >= 2 && isLoadingRadiologyServices && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-sm text-gray-600">Searching services...</span>
                          </div>
                        </div>
                      )}
                      
                      {showRadiologyServiceResults && debouncedRadiologyServiceSearch.length >= 2 && !isLoadingRadiologyServices && radiologyServices.length === 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                          <p className="text-sm text-gray-600">No radiology services found</p>
                        </div>
                      )}
                    </div>
                    {selectedRadiologyServices.length > 0 && (
                      <div className="mt-2 border rounded-md p-3 bg-gray-50">
                        <p className="text-xs font-medium text-gray-700 mb-2">Selected Tests ({selectedRadiologyServices.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedRadiologyServices.map((service) => (
                            <Badge key={service.id} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                              {service.service_name}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRadiologyServiceToggle(service, e)
                                }}
                                className="ml-1 hover:bg-gray-300 rounded-full p-0.5 transition-colors"
                                aria-label={`Remove ${service.service_name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="requested_by">Requested By</Label>
                    <Input
                      id="requested_by"
                      value={radiologyOrderData.requested_by || session?.user?.name || ""}
                      disabled
                      className="bg-gray-50 cursor-not-allowed"
                      placeholder="Loading user..."
                    />
                    <p className="text-xs text-gray-500">Automatically set to logged-in user</p>
                  </div>
                  
                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddRadiologyModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={radiologyOrderMutation.isPending}
                      className="bg-[#BE1522] hover:bg-[#9B1219]"
                    >
                      {radiologyOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Radiology Order
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Prescription Modal */}
        {showAddPrescriptionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Add Prescription</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddPrescriptionModal(false)
                      setPrescriptionData({
                        facility_id: "",
                        delivery_address: "",
                        requested_by: session?.user?.name || ""
                      })
                      setMedicationsList([])
                      setCurrentMedication({
                        medication: "",
                        medication_id: "",
                        price: 0,
                        dose: "",
                        quantity: "",
                        duration: "",
                        frequency: ""
                      })
                      setPharmacyMedicationSearchTerm("")
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Create a new prescription for {patient?.first_name} {patient?.last_name}. Select pharmacy first, then add medications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddPrescriptionSubmit} className="space-y-6">
                  {/* Step 1: Select Pharmacy */}
                  <div className="space-y-2">
                    <Label htmlFor="facility_id">Pharmacy *</Label>
                    <Select 
                      value={prescriptionData.facility_id} 
                      onValueChange={(value) => {
                        setPrescriptionData(prev => ({ ...prev, facility_id: value }))
                        setMedicationsList([])
                        setCurrentMedication({
                          medication: "",
                          medication_id: "",
                          price: 0,
                          dose: "",
                          quantity: "",
                          duration: "",
                          frequency: ""
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pharmacy first" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.filter((f: FacilityOption) => f.facility_type === 'PHARMACY').map((facility: FacilityOption) => (
                          <SelectItem key={facility.id} value={facility.id}>
                            {facility.facility_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isLoadingPharmacyTariff && prescriptionData.facility_id && (
                      <p className="text-xs text-gray-500">Loading tariff plan...</p>
                    )}
                    {!isLoadingPharmacyTariff && prescriptionData.facility_id && pharmacyTariffMedications.length === 0 && (
                      <p className="text-xs text-amber-600">No medications found in tariff plan for this pharmacy</p>
                    )}
                  </div>

                  {/* Step 2: Add Medications (only if pharmacy is selected) */}
                  {prescriptionData.facility_id && (
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Add Medication</Label>
                        {pharmacyTariffMedications.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {pharmacyTariffMedications.length} medication(s) available in tariff plan
                          </span>
                        )}
                      </div>

                      {/* Medication Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="medication">Select Medication *</Label>
                        <div className="relative pharmacy-medication-search-container">
                          <Input
                            id="medication"
                            placeholder="Search medications from tariff plan..."
                            value={pharmacyMedicationSearchTerm}
                            onChange={(e) => {
                              setPharmacyMedicationSearchTerm(e.target.value)
                              setShowPharmacyMedicationResults(true)
                            }}
                            onFocus={() => setShowPharmacyMedicationResults(true)}
                            disabled={!prescriptionData.facility_id}
                          />
                          
                          {/* Medication Search Results */}
                          {showPharmacyMedicationResults && filteredPharmacyMedications.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {filteredPharmacyMedications.map((medication: any) => (
                                <div
                                  key={medication.id}
                                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                  onClick={() => handleSelectMedication(medication)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-sm">{medication.service_name}</p>
                                      <p className="text-xs text-gray-500">{medication.service_category}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-blue-600">₦{medication.current_price.toLocaleString()}</p>
                                      <p className="text-xs text-gray-500">per unit</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {showPharmacyMedicationResults && pharmacyMedicationSearchTerm && filteredPharmacyMedications.length === 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                              <p className="text-sm text-gray-600">No medications found</p>
                            </div>
                          )}
                        </div>
                        {currentMedication.medication && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{currentMedication.medication}</p>
                                <p className="text-xs text-gray-600">Price: ₦{currentMedication.price.toLocaleString()} per unit</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCurrentMedication({
                                    medication: "",
                                    medication_id: "",
                                    price: 0,
                                    dose: "",
                                    quantity: "",
                                    duration: "",
                                    frequency: ""
                                  })
                                  setPharmacyMedicationSearchTerm("")
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Medication Details (only if medication is selected) */}
                      {currentMedication.medication && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md border">
                          <div className="space-y-2">
                            <Label htmlFor="dose">Dosage *</Label>
                            <Input
                              id="dose"
                              value={currentMedication.dose}
                              onChange={(e) => setCurrentMedication(prev => ({ ...prev, dose: e.target.value }))}
                              placeholder="e.g., 500mg, 10ml, 2 tablets"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="quantity">Quantity *</Label>
                            <Input
                              id="quantity"
                              type="number"
                              min="1"
                              value={currentMedication.quantity}
                              onChange={(e) => setCurrentMedication(prev => ({ ...prev, quantity: e.target.value }))}
                              placeholder="e.g., 30"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="duration">Duration *</Label>
                            <Input
                              id="duration"
                              value={currentMedication.duration}
                              onChange={(e) => setCurrentMedication(prev => ({ ...prev, duration: e.target.value }))}
                              placeholder="e.g., 7 days, 2 weeks"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="frequency">Frequency *</Label>
                            <Select
                              value={currentMedication.frequency}
                              onValueChange={(value) => setCurrentMedication(prev => ({ ...prev, frequency: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="STAT">STAT (Immediately)</SelectItem>
                                <SelectItem value="OD">OD (Once daily)</SelectItem>
                                <SelectItem value="BD">BD (Twice daily)</SelectItem>
                                <SelectItem value="TDS">TDS (Three times daily)</SelectItem>
                                <SelectItem value="QID">QID (Four times daily)</SelectItem>
                                <SelectItem value="QHS">QHS (At bedtime)</SelectItem>
                                <SelectItem value="Q4H">Q4H (Every 4 hours)</SelectItem>
                                <SelectItem value="Q6H">Q6H (Every 6 hours)</SelectItem>
                                <SelectItem value="Q8H">Q8H (Every 8 hours)</SelectItem>
                                <SelectItem value="Q12H">Q12H (Every 12 hours)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="col-span-2">
                            <Button
                              type="button"
                              onClick={handleAddMedication}
                              className="w-full bg-green-600 hover:bg-green-700"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Medication
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Added Medications List */}
                      {medicationsList.length > 0 && (
                        <div className="border-t pt-4 space-y-2">
                          <Label className="text-base font-semibold">Added Medications ({medicationsList.length})</Label>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {medicationsList.map((med) => (
                              <div key={med.id} className="p-3 bg-gray-50 border rounded-md">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <p className="font-semibold text-sm">{med.medication}</p>
                                      <Badge variant="secondary" className="text-xs">
                                        ₦{med.price.toLocaleString()}/unit
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                      <p><span className="font-medium">Dose:</span> {med.dose}</p>
                                      <p><span className="font-medium">Quantity:</span> {med.quantity}</p>
                                      <p><span className="font-medium">Duration:</span> {med.duration}</p>
                                      <p><span className="font-medium">Frequency:</span> {med.frequency}</p>
                                    </div>
                                    <p className="text-xs text-blue-600 mt-1">
                                      Total: ₦{(med.price * parseInt(med.quantity || "0")).toLocaleString()}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveMedication(med.id)}
                                    className="ml-2"
                                  >
                                    <X className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-sm font-semibold text-right">
                              Total Amount: ₦{medicationsList.reduce((sum, med) => sum + (med.price * parseInt(med.quantity || "0")), 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Delivery Address */}
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="delivery_address">Delivery Address (Optional)</Label>
                      {patient?.residential_address && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setPrescriptionData(prev => ({ ...prev, delivery_address: patient.residential_address || "" }))}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Use Patient's Address
                        </Button>
                      )}
                    </div>
                    <Textarea
                      id="delivery_address"
                      value={prescriptionData.delivery_address}
                      onChange={(e) => setPrescriptionData(prev => ({ ...prev, delivery_address: e.target.value }))}
                      placeholder={patient?.residential_address || "Enter delivery address (leave empty to use patient's default address)"}
                      rows={3}
                      className="resize-none"
                    />
                    <p className="text-xs text-gray-500">
                      {patient?.residential_address 
                        ? `Default: ${patient.residential_address}` 
                        : "Leave empty to use patient's default address"}
                    </p>
                  </div>
                  
                  {/* Prescribed By */}
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="requested_by">Prescribed By</Label>
                    <Input
                      id="requested_by"
                      value={prescriptionData.requested_by || session?.user?.name || ""}
                      disabled
                      className="bg-gray-50 cursor-not-allowed"
                      placeholder="Loading user..."
                    />
                    <p className="text-xs text-gray-500">Automatically set to logged-in user</p>
                  </div>
                  
                  {/* Submit Button */}
                  <div className="flex justify-end gap-4 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddPrescriptionModal(false)
                        setPrescriptionData({
                          facility_id: "",
                          delivery_address: "",
                          requested_by: session?.user?.name || ""
                        })
                        setMedicationsList([])
                        setCurrentMedication({
                          medication: "",
                          medication_id: "",
                          price: 0,
                          dose: "",
                          quantity: "",
                          duration: "",
                          frequency: ""
                        })
                        setPharmacyMedicationSearchTerm("")
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={prescriptionMutation.isPending || medicationsList.length === 0}
                      className="bg-[#BE1522] hover:bg-[#9B1219]"
                    >
                      {prescriptionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Prescription{medicationsList.length > 0 && ` (${medicationsList.length} medication${medicationsList.length > 1 ? 's' : ''})`}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Referral Modal */}
        {showAddReferralModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-blue-600">Add Referral</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddReferralModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Create a new referral for {patient?.first_name} {patient?.last_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddReferralSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="referral_type">Referral Type</Label>
                    <Select value={referralData.referral_type} onValueChange={(value) => setReferralData(prev => ({ ...prev, referral_type: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select referral type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SPECIALIST">Specialist</SelectItem>
                        <SelectItem value="HOSPITAL">Hospital</SelectItem>
                        <SelectItem value="EMERGENCY">Emergency</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Referral</Label>
                    <Textarea
                      id="reason"
                      value={referralData.reason}
                      onChange={(e) => setReferralData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Enter reason for referral"
                      rows={3}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="requested_by">Referred By</Label>
                    <Input
                      id="requested_by"
                      value={referralData.requested_by}
                      onChange={(e) => setReferralData(prev => ({ ...prev, requested_by: e.target.value }))}
                      placeholder="Enter referrer name"
                      required
                    />
                  </div>
                  
                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddReferralModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={referralMutation.isPending}
                      className="bg-[#BE1522] hover:bg-[#9B1219]"
                    >
                      {referralMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Referral
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Results Modal */}
        {showResultsModal && orderResults && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              // Only close if clicking the backdrop (not the modal content)
              if (e.target === e.currentTarget) {
                handleCloseResultsModal()
              }
            }}
          >
            <Card 
              className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {orderResults.type === 'LAB' && <TestTube className="h-5 w-5 text-blue-600" />}
                    {orderResults.type === 'RADIOLOGY' && <Stethoscope className="h-5 w-5 text-green-600" />}
                    {orderResults.type === 'PHARMACY' && <Pill className="h-5 w-5 text-purple-600" />}
                    <span className="text-blue-600">View Results - {orderResults.test_name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCloseResultsModal}
                    className="hover:bg-red-50 hover:border-red-200"
                  >
                    <X className="h-4 w-4" />
                    <span className="ml-1 hidden sm:inline">Close</span>
                  </Button>
                </CardTitle>
                <CardDescription>
                  Results submitted by {orderResults.facility?.facility_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="space-y-6">
                  {/* Order Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Order Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Order ID</Label>
                          <p className="font-mono text-sm">{orderResults.id}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Service Type</Label>
                          <p className="font-medium">{orderResults.type}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Test/Service</Label>
                          <p className="font-medium">{orderResults.test_name || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Amount</Label>
                          <p className="font-semibold">₦{(orderResults.amount || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Status</Label>
                          <Badge className={getStatusBadgeColor(orderResults.status)}>
                            {orderResults.status}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Completed Date</Label>
                          <p className="text-sm">{orderResults.completed_at ? new Date(orderResults.completed_at).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Patient Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Patient Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Patient Name</Label>
                          <p className="font-medium">
                            {orderResults.enrollee?.first_name || 'N/A'} {orderResults.enrollee?.last_name || ''}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Patient ID</Label>
                          <p className="font-mono text-sm">{orderResults.enrollee?.enrollee_id || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Phone</Label>
                          <p className="text-sm">{orderResults.enrollee?.phone_number || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Email</Label>
                          <p className="text-sm">{orderResults.enrollee?.email || 'N/A'}</p>
                        </div>
                        {(orderResults.type === 'PHARMACY' || (orderResults.type !== 'LAB' && orderResults.type !== 'RADIOLOGY')) && (
                          <div className="col-span-2">
                            <Label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              Delivery Address
                            </Label>
                            <p className="text-sm mt-1 p-2 bg-gray-50 rounded border min-h-[3rem]">
                              {orderResults.delivery_address || orderResults.enrollee?.residential_address || 'Not specified'}
                            </p>
                            {orderResults.delivery_address && orderResults.enrollee?.residential_address && 
                             orderResults.delivery_address !== orderResults.enrollee.residential_address && (
                              <p className="text-xs text-gray-500 mt-1">
                                <span className="font-medium">Default Address:</span> {orderResults.enrollee.residential_address}
                              </p>
                            )}
                            {!orderResults.delivery_address && orderResults.enrollee?.residential_address && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                Using patient's default address
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Facility Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Facility Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Facility Name</Label>
                          <p className="font-medium">{orderResults.facility?.facility_name || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Phone</Label>
                          <p className="text-sm">{orderResults.facility?.phone_number || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Email</Label>
                          <p className="text-sm">{orderResults.facility?.email || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Requested By</Label>
                          <p className="text-sm">
                            {orderResults.generated_by?.first_name || 'N/A'} {orderResults.generated_by?.last_name || ''}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Results */}
                  {orderResults.results && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Test Results</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="whitespace-pre-wrap">{orderResults.results}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Notes */}
                  {orderResults.notes && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Additional Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="whitespace-pre-wrap">{orderResults.notes}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* File Downloads */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Attached Files</CardTitle>
                      <CardDescription>
                        Download files uploaded by the facility
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* This would be populated with actual file data from the facility portal */}
                        <div className="text-center py-8">
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No files uploaded</p>
                          <p className="text-sm text-gray-400 mt-2">
                            Files uploaded by facilities will appear here
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
