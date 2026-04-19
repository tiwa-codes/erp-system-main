"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Save, Building2, Phone, Mail, MapPin, FileText, Upload, User, Shield, Clock, Stethoscope } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { FileUpload } from "@/components/ui/file-upload"
import { BandSelector } from "@/components/ui/band-selector"

interface Provider {
  id: string
  // Section 1: Basic Information
  partnership_interest?: string
  facility_name: string
  address: string
  phone_whatsapp: string
  email: string
  medical_director_name: string
  hmo_coordinator_name: string
  hmo_coordinator_phone: string
  hmo_coordinator_email: string
  year_of_incorporation: string
  facility_reg_number: string
  practice: string
  proprietor_partners: string
  hcp_code?: string
  
  // Section 2: Service Delivery
  hours_of_operation?: string
  other_branches?: string
  emergency_care_services?: string[]
  facility_type?: string[]
  personnel_licensed?: string
  blood_bank_available?: string
  blood_sourcing_method?: string
  radiology_lab_services?: string[]
  other_services?: string[]
  
  // Section 3: Banking Information
  account_name?: string
  account_number?: string
  designation?: string
  date?: string
  
  // Document URLs
  cac_registration_url?: string
  nhis_accreditation_url?: string
  professional_indemnity_url?: string
  state_facility_registration_url?: string
  
  // Band selection
  selected_bands?: string[]
  
  status: string
  created_at: string
  updated_at: string
}

interface EditProviderPageProps {
  params: {
    id: string
  }
}

export default function EditProviderPage({ params }: EditProviderPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Form state - matching the new structure
  const [form, setForm] = useState({
    // Section 1: Basic Information
    partnership_interest: "",
    facility_name: "",
    address: "",
    phone_whatsapp: "",
    email: "",
    medical_director_name: "",
    hmo_coordinator_name: "",
    hmo_coordinator_phone: "",
    hmo_coordinator_email: "",
    year_of_incorporation: "",
    facility_reg_number: "",
    practice: "",
    proprietor_partners: "",
    hcp_code: "",
    
    // Section 2: Service Delivery
    hours_of_operation: "",
    other_branches: "",
    emergency_care_services: [] as string[],
    facility_type: [] as string[],
    personnel_licensed: "",
    blood_bank_available: "",
    blood_sourcing_method: "",
    radiology_lab_services: [] as string[],
    other_services: [] as string[],
    
    // Section 3: Banking Information
    account_name: "",
    account_number: "",
    designation: "",
    date: "",
    
    // Document uploads
    cac_registration: null as File | null,
    nhis_accreditation: null as File | null,
    professional_indemnity: null as File | null,
    state_facility_registration: null as File | null,
    
    // Band selection
    selected_bands: [] as string[],
    
    status: "PENDING_APPROVAL"
  })

  // Handle checkbox changes for arrays
  const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      [field]: checked 
        ? [...(prev[field as keyof typeof prev] as string[]), value]
        : (prev[field as keyof typeof prev] as string[]).filter(item => item !== value)
    }))
  }

  // Handle file uploads
  const handleFileUpload = (field: string, file: File | null) => {
    setForm(prev => ({ ...prev, [field]: file }))
  }

  // Fetch provider data
  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const res = await fetch(`/api/providers/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          const provider: Provider = data.provider
          setForm({
            // Section 1: Basic Information
            partnership_interest: provider.partnership_interest || "",
            facility_name: provider.facility_name,
            address: provider.address,
            phone_whatsapp: provider.phone_whatsapp,
            email: provider.email,
            medical_director_name: provider.medical_director_name,
            hmo_coordinator_name: provider.hmo_coordinator_name,
            hmo_coordinator_phone: provider.hmo_coordinator_phone,
            hmo_coordinator_email: provider.hmo_coordinator_email,
            year_of_incorporation: provider.year_of_incorporation,
            facility_reg_number: provider.facility_reg_number,
            practice: provider.practice,
            proprietor_partners: provider.proprietor_partners,
            hcp_code: provider.hcp_code || "",
            
            // Section 2: Service Delivery
            hours_of_operation: provider.hours_of_operation || "",
            other_branches: provider.other_branches || "",
            emergency_care_services: provider.emergency_care_services || [],
            facility_type: provider.facility_type || [],
            personnel_licensed: provider.personnel_licensed || "",
            blood_bank_available: provider.blood_bank_available || "",
            blood_sourcing_method: provider.blood_sourcing_method || "",
            radiology_lab_services: provider.radiology_lab_services || [],
            other_services: provider.other_services || [],
            
            // Section 3: Banking Information
            account_name: provider.account_name || "",
            account_number: provider.account_number || "",
            designation: provider.designation || "",
            date: provider.date ? new Date(provider.date).toISOString().split('T')[0] : "",
            
            // Document uploads (set to null for now, URLs are already stored)
            cac_registration: null,
            nhis_accreditation: null,
            professional_indemnity: null,
            state_facility_registration: null,
            
            // Band selection
            selected_bands: provider.selected_bands || [],
            
            status: provider.status
          })
        }
      } catch (error) {
        console.error('Error fetching provider:', error)
      }
    }

    fetchProvider()
  }, [params.id])

  // Update provider mutation
  const updateProviderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/providers/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update provider")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["providers"] })
      queryClient.invalidateQueries({ queryKey: ["provider-metrics"] })
      router.push("/provider")
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update provider",
        variant: "destructive",
      })
    },
  })

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Upload documents
      const documentUrls: { [key: string]: string } = {}
      
      const documents = [
        { field: 'cac_registration', file: form.cac_registration },
        { field: 'nhis_accreditation', file: form.nhis_accreditation },
        { field: 'professional_indemnity', file: form.professional_indemnity },
        { field: 'state_facility_registration', file: form.state_facility_registration }
      ]

      for (const doc of documents) {
        if (doc.file) {
          const formData = new FormData()
          formData.append("files", doc.file)
          
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          })
          
          if (uploadRes.ok) {
            const uploadResult = await uploadRes.json()
            documentUrls[doc.field] = uploadResult.data[0].secure_url
          }
        }
      }
      
      // Prepare submit data
      const submitData = {
        ...form,
        documents: documentUrls
      }
      
      updateProviderMutation.mutate(submitData)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload documents",
        variant: "destructive",
      })
    }
  }

  return (
    <PermissionGate module="provider" action="edit">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Providers
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Provider</h1>
            <p className="text-gray-600">Update healthcare provider information</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Information - EXACTLY from screenshot */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Section 1 of 3 - Basic Information
              </CardTitle>
              <CardDescription>
                Basic details of the healthcare provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Partnership Interest */}
              <div>
                <Label htmlFor="partnership_interest">Are you interested in exploring a working partnership with us?</Label>
                <Select value={form.partnership_interest} onValueChange={(value) => setForm(prev => ({ ...prev, partnership_interest: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                    <SelectItem value="MAYBE">Maybe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Facility Name */}
              <div>
                <Label htmlFor="facility_name">Name of Facility</Label>
                <Input
                  id="facility_name"
                  value={form.facility_name}
                  onChange={(e) => setForm(prev => ({ ...prev, facility_name: e.target.value }))}
                  placeholder="Enter facility name"
                />
              </div>

              {/* Address */}
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter full address..."
                  className="min-h-[100px]"
                />
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone_whatsapp">Phone Number (WhatsApp)</Label>
                  <Input
                    id="phone_whatsapp"
                    value={form.phone_whatsapp}
                    onChange={(e) => setForm(prev => ({ ...prev, phone_whatsapp: e.target.value }))}
                    placeholder="+234 801 234 5678"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="facility@example.com"
                  />
                </div>
              </div>

              {/* Medical Director */}
              <div>
                <Label htmlFor="medical_director_name">Name of Medical Director/Managing Director/Lead</Label>
                <Input
                  id="medical_director_name"
                  value={form.medical_director_name}
                  onChange={(e) => setForm(prev => ({ ...prev, medical_director_name: e.target.value }))}
                  placeholder="Enter medical director name"
                />
              </div>

              {/* HMO Coordinator Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium text-gray-900">HMO Desk Coordinator/Focal Person/Liaison:</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="hmo_coordinator_name">Full Name</Label>
                    <Input
                      id="hmo_coordinator_name"
                      value={form.hmo_coordinator_name}
                      onChange={(e) => setForm(prev => ({ ...prev, hmo_coordinator_name: e.target.value }))}
                      placeholder="Enter full name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="hmo_coordinator_phone">Phone Number</Label>
                    <Input
                      id="hmo_coordinator_phone"
                      value={form.hmo_coordinator_phone}
                      onChange={(e) => setForm(prev => ({ ...prev, hmo_coordinator_phone: e.target.value }))}
                      placeholder="+234 801 234 5678"
                    />
                  </div>

                  <div>
                    <Label htmlFor="hmo_coordinator_email">Email Address</Label>
                    <Input
                      id="hmo_coordinator_email"
                      type="email"
                      value={form.hmo_coordinator_email}
                      onChange={(e) => setForm(prev => ({ ...prev, hmo_coordinator_email: e.target.value }))}
                      placeholder="coordinator@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="year_of_incorporation">Year of Incorporation/Registration</Label>
                  <Input
                    id="year_of_incorporation"
                    value={form.year_of_incorporation}
                    onChange={(e) => setForm(prev => ({ ...prev, year_of_incorporation: e.target.value }))}
                    placeholder="e.g., 2020"
                  />
                </div>

                <div>
                  <Label htmlFor="facility_reg_number">Facility Reg. No.</Label>
                  <Input
                    id="facility_reg_number"
                    value={form.facility_reg_number}
                    onChange={(e) => setForm(prev => ({ ...prev, facility_reg_number: e.target.value }))}
                    placeholder="Enter facility registration number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="practice">Practice</Label>
                  <Input
                    id="practice"
                    value={form.practice}
                    onChange={(e) => setForm(prev => ({ ...prev, practice: e.target.value }))}
                    placeholder="Enter practice type"
                  />
                </div>

                <div>
                  <Label htmlFor="hcp_code">HCP Code</Label>
                  <Input
                    id="hcp_code"
                    value={form.hcp_code}
                    onChange={(e) => setForm(prev => ({ ...prev, hcp_code: e.target.value }))}
                    placeholder="Enter HCP code"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="proprietor_partners">Name of proprietor or list the names of current partners if it's a partnership</Label>
                <Textarea
                  id="proprietor_partners"
                  value={form.proprietor_partners}
                  onChange={(e) => setForm(prev => ({ ...prev, proprietor_partners: e.target.value }))}
                  placeholder="Enter proprietor/partners names..."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Service Delivery - EXACTLY from screenshot */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-blue-600" />
                Section 2 of 3 - Service Delivery
              </CardTitle>
              <CardDescription>
                Service delivery and operational information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hours of Operation */}
              <div>
                <Label htmlFor="hours_of_operation">Hours of Operation</Label>
                <Input
                  id="hours_of_operation"
                  value={form.hours_of_operation}
                  onChange={(e) => setForm(prev => ({ ...prev, hours_of_operation: e.target.value }))}
                  placeholder="e.g., 24/7 or 8:00 AM - 6:00 PM"
                />
              </div>

              {/* Other Branches */}
              <div>
                <Label htmlFor="other_branches">Please List Other Branches of your Hospital (If any)</Label>
                <Textarea
                  id="other_branches"
                  value={form.other_branches}
                  onChange={(e) => setForm(prev => ({ ...prev, other_branches: e.target.value }))}
                  placeholder="List other branches if any..."
                  className="min-h-[100px]"
                />
              </div>

              {/* Emergency Care Services */}
              <div>
                <Label className="text-base font-medium">Emergency Care Services. Tick as available</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="trauma_care"
                        checked={form.emergency_care_services.includes("TRAUMA_CARE")}
                        onCheckedChange={(checked) => handleCheckboxChange("emergency_care_services", "TRAUMA_CARE", checked as boolean)}
                      />
                      <Label htmlFor="trauma_care">Trauma Care</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="cardiac_emergency"
                        checked={form.emergency_care_services.includes("CARDIAC_EMERGENCY")}
                        onCheckedChange={(checked) => handleCheckboxChange("emergency_care_services", "CARDIAC_EMERGENCY", checked as boolean)}
                      />
                      <Label htmlFor="cardiac_emergency">Cardiac Emergency</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pediatric_emergency"
                        checked={form.emergency_care_services.includes("PEDIATRIC_EMERGENCY")}
                        onCheckedChange={(checked) => handleCheckboxChange("emergency_care_services", "PEDIATRIC_EMERGENCY", checked as boolean)}
                      />
                      <Label htmlFor="pediatric_emergency">Pediatric Emergency</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="obstetric_emergency"
                        checked={form.emergency_care_services.includes("OBSTETRIC_EMERGENCY")}
                        onCheckedChange={(checked) => handleCheckboxChange("emergency_care_services", "OBSTETRIC_EMERGENCY", checked as boolean)}
                      />
                      <Label htmlFor="obstetric_emergency">Obstetric Emergency</Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="neurological_emergency"
                        checked={form.emergency_care_services.includes("NEUROLOGICAL_EMERGENCY")}
                        onCheckedChange={(checked) => handleCheckboxChange("emergency_care_services", "NEUROLOGICAL_EMERGENCY", checked as boolean)}
                      />
                      <Label htmlFor="neurological_emergency">Neurological Emergency</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="respiratory_emergency"
                        checked={form.emergency_care_services.includes("RESPIRATORY_EMERGENCY")}
                        onCheckedChange={(checked) => handleCheckboxChange("emergency_care_services", "RESPIRATORY_EMERGENCY", checked as boolean)}
                      />
                      <Label htmlFor="respiratory_emergency">Respiratory Emergency</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="general_emergency"
                        checked={form.emergency_care_services.includes("GENERAL_EMERGENCY")}
                        onCheckedChange={(checked) => handleCheckboxChange("emergency_care_services", "GENERAL_EMERGENCY", checked as boolean)}
                      />
                      <Label htmlFor="general_emergency">General Emergency</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="burn_care"
                        checked={form.emergency_care_services.includes("BURN_CARE")}
                        onCheckedChange={(checked) => handleCheckboxChange("emergency_care_services", "BURN_CARE", checked as boolean)}
                      />
                      <Label htmlFor="burn_care">Burn Care</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Facility Type - EXACTLY from screenshot */}
              <div>
                <Label className="text-base font-medium">What type of facility do you operate? Tick as applicable</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="primary_care"
                        checked={form.facility_type.includes("PRIMARY_CARE")}
                        onCheckedChange={(checked) => handleCheckboxChange("facility_type", "PRIMARY_CARE", checked as boolean)}
                      />
                      <Label htmlFor="primary_care">PRIMARY CARE/CLINIC</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pharmaceutical"
                        checked={form.facility_type.includes("PHARMACEUTICAL")}
                        onCheckedChange={(checked) => handleCheckboxChange("facility_type", "PHARMACEUTICAL", checked as boolean)}
                      />
                      <Label htmlFor="pharmaceutical">PHARMACEUTICAL SERVICES</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="physiotherapy"
                        checked={form.facility_type.includes("PHYSIOTHERAPY")}
                        onCheckedChange={(checked) => handleCheckboxChange("facility_type", "PHYSIOTHERAPY", checked as boolean)}
                      />
                      <Label htmlFor="physiotherapy">PHYSIOTHERAPY CLINIC</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="psychiatry"
                        checked={form.facility_type.includes("PSYCHIATRY")}
                        onCheckedChange={(checked) => handleCheckboxChange("facility_type", "PSYCHIATRY", checked as boolean)}
                      />
                      <Label htmlFor="psychiatry">PSYCHIATRY/PSYCHOLOGICAL SERVICES</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="others_facility"
                        checked={form.facility_type.includes("OTHERS")}
                        onCheckedChange={(checked) => handleCheckboxChange("facility_type", "OTHERS", checked as boolean)}
                      />
                      <Label htmlFor="others_facility">OTHERS</Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="secondary_care"
                        checked={form.facility_type.includes("SECONDARY_CARE")}
                        onCheckedChange={(checked) => handleCheckboxChange("facility_type", "SECONDARY_CARE", checked as boolean)}
                      />
                      <Label htmlFor="secondary_care">SECONDARY CARE</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="optical"
                        checked={form.facility_type.includes("OPTICAL")}
                        onCheckedChange={(checked) => handleCheckboxChange("facility_type", "OPTICAL", checked as boolean)}
                      />
                      <Label htmlFor="optical">OPTICAL CLINIC</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="dental"
                        checked={form.facility_type.includes("DENTAL")}
                        onCheckedChange={(checked) => handleCheckboxChange("facility_type", "DENTAL", checked as boolean)}
                      />
                      <Label htmlFor="dental">DENTAL CLINIC</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="diagnostics"
                        checked={form.facility_type.includes("DIAGNOSTICS")}
                        onCheckedChange={(checked) => handleCheckboxChange("facility_type", "DIAGNOSTICS", checked as boolean)}
                      />
                      <Label htmlFor="diagnostics">DIAGNOSTICS</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personnel License */}
              <div>
                <Label htmlFor="personnel_licensed">Are your health care personnel duly licensed to practice in Nigeria?</Label>
                <Select value={form.personnel_licensed} onValueChange={(value) => setForm(prev => ({ ...prev, personnel_licensed: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                    <SelectItem value="PARTIAL">Partially</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Blood Bank */}
              <div>
                <Label htmlFor="blood_bank_available">Blood Bank Available?</Label>
                <Select value={form.blood_bank_available} onValueChange={(value) => setForm(prev => ({ ...prev, blood_bank_available: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Blood Sourcing */}
              {form.blood_bank_available === "NO" && (
                <div>
                  <Label htmlFor="blood_sourcing_method">If no, How do you source for Blood?</Label>
                  <Input
                    id="blood_sourcing_method"
                    value={form.blood_sourcing_method}
                    onChange={(e) => setForm(prev => ({ ...prev, blood_sourcing_method: e.target.value }))}
                    placeholder="Describe blood sourcing method"
                  />
                </div>
              )}

              {/* Radiology/Lab Services - EXACTLY from screenshot */}
              <div>
                <Label className="text-base font-medium">Radiology/Laboratory investigations offered. Tick as appropriate</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="ultrasound"
                        checked={form.radiology_lab_services.includes("ULTRASOUND")}
                        onCheckedChange={(checked) => handleCheckboxChange("radiology_lab_services", "ULTRASOUND", checked as boolean)}
                      />
                      <Label htmlFor="ultrasound">ULTRASOUND</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="ecg"
                        checked={form.radiology_lab_services.includes("ECG")}
                        onCheckedChange={(checked) => handleCheckboxChange("radiology_lab_services", "ECG", checked as boolean)}
                      />
                      <Label htmlFor="ecg">ECG</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="eeg"
                        checked={form.radiology_lab_services.includes("EEG")}
                        onCheckedChange={(checked) => handleCheckboxChange("radiology_lab_services", "EEG", checked as boolean)}
                      />
                      <Label htmlFor="eeg">EEG</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="basic_lab"
                        checked={form.radiology_lab_services.includes("BASIC_LAB")}
                        onCheckedChange={(checked) => handleCheckboxChange("radiology_lab_services", "BASIC_LAB", checked as boolean)}
                      />
                      <Label htmlFor="basic_lab">Basic Lab Investigations</Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="echo"
                        checked={form.radiology_lab_services.includes("ECHO")}
                        onCheckedChange={(checked) => handleCheckboxChange("radiology_lab_services", "ECHO", checked as boolean)}
                      />
                      <Label htmlFor="echo">ECHO</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="ct_scan"
                        checked={form.radiology_lab_services.includes("CT_SCAN")}
                        onCheckedChange={(checked) => handleCheckboxChange("radiology_lab_services", "CT_SCAN", checked as boolean)}
                      />
                      <Label htmlFor="ct_scan">CT SCAN</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mri"
                        checked={form.radiology_lab_services.includes("MRI")}
                        onCheckedChange={(checked) => handleCheckboxChange("radiology_lab_services", "MRI", checked as boolean)}
                      />
                      <Label htmlFor="mri">MRI</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="advanced_lab"
                        checked={form.radiology_lab_services.includes("ADVANCED_LAB")}
                        onCheckedChange={(checked) => handleCheckboxChange("radiology_lab_services", "ADVANCED_LAB", checked as boolean)}
                      />
                      <Label htmlFor="advanced_lab">Advanced Lab Investigations</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other Services - EXACTLY from screenshot */}
              <div>
                <Label className="text-base font-medium">Other Services - For Hospitals, in terms of availability. Tick as appropriate</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="vaccines"
                        checked={form.other_services.includes("VACCINES")}
                        onCheckedChange={(checked) => handleCheckboxChange("other_services", "VACCINES", checked as boolean)}
                      />
                      <Label htmlFor="vaccines">Vaccines</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="phototherapy"
                        checked={form.other_services.includes("PHOTOTHERAPY")}
                        onCheckedChange={(checked) => handleCheckboxChange("other_services", "PHOTOTHERAPY", checked as boolean)}
                      />
                      <Label htmlFor="phototherapy">Phototherapy</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="optical_services"
                        checked={form.other_services.includes("OPTICAL_SERVICES")}
                        onCheckedChange={(checked) => handleCheckboxChange("other_services", "OPTICAL_SERVICES", checked as boolean)}
                      />
                      <Label htmlFor="optical_services">Optical Services</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="others_services"
                        checked={form.other_services.includes("OTHERS")}
                        onCheckedChange={(checked) => handleCheckboxChange("other_services", "OTHERS", checked as boolean)}
                      />
                      <Label htmlFor="others_services">Others</Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="incubator_care"
                        checked={form.other_services.includes("INCUBATOR_CARE")}
                        onCheckedChange={(checked) => handleCheckboxChange("other_services", "INCUBATOR_CARE", checked as boolean)}
                      />
                      <Label htmlFor="incubator_care">Incubator care</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="physiotherapy_services"
                        checked={form.other_services.includes("PHYSIOTHERAPY")}
                        onCheckedChange={(checked) => handleCheckboxChange("other_services", "PHYSIOTHERAPY", checked as boolean)}
                      />
                      <Label htmlFor="physiotherapy_services">Physiotherapy</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="dental_services"
                        checked={form.other_services.includes("DENTAL_SERVICES")}
                        onCheckedChange={(checked) => handleCheckboxChange("other_services", "DENTAL_SERVICES", checked as boolean)}
                      />
                      <Label htmlFor="dental_services">Dental Services</Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Bank Details - EXACTLY from screenshot */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl font-bold text-blue-600">₦</span>
                Section 3 of 3 - Bank Details
              </CardTitle>
              <CardDescription>
                Banking information and document uploads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bank Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="account_name">Account Name</Label>
                  <Input
                    id="account_name"
                    value={form.account_name}
                    onChange={(e) => setForm(prev => ({ ...prev, account_name: e.target.value }))}
                    placeholder="Enter account name"
                  />
                </div>

                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={form.account_number}
                    onChange={(e) => setForm(prev => ({ ...prev, account_number: e.target.value }))}
                    placeholder="Enter account number"
                  />
                </div>

                <div>
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    value={form.designation}
                    onChange={(e) => setForm(prev => ({ ...prev, designation: e.target.value }))}
                    placeholder="Enter designation"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="date">Date (dd-mm-yyyy)</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              {/* Document Uploads - EXACTLY from screenshot */}
              <div>
                <Label className="text-base font-medium">Please kindly attach copies of the under-listed documents in PDF format:</Label>
                
                <div className="space-y-4 mt-4">
                  {/* CAC Registration */}
                  <div>
                    <Label htmlFor="cac_registration" className="text-sm font-medium">CAC Registration</Label>
                    <div className="flex gap-2 mt-1">
                      <FileUpload
                        onUpload={(files) => handleFileUpload("cac_registration", files[0] || null)}
                        onRemove={() => handleFileUpload("cac_registration", null)}
                        acceptedTypes={["application/pdf"]}
                        maxFiles={1}
                      />
                      <Input
                        placeholder="No file selected"
                        value={form.cac_registration?.name || "No file selected"}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* NHIS Accreditation */}
                  <div>
                    <Label htmlFor="nhis_accreditation" className="text-sm font-medium">NHIS Accreditation Certificate</Label>
                    <div className="flex gap-2 mt-1">
                      <FileUpload
                        onUpload={(files) => handleFileUpload("nhis_accreditation", files[0] || null)}
                        onRemove={() => handleFileUpload("nhis_accreditation", null)}
                        acceptedTypes={["application/pdf"]}
                        maxFiles={1}
                      />
                      <Input
                        placeholder="No file selected"
                        value={form.nhis_accreditation?.name || "No file selected"}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* Professional Indemnity */}
                  <div>
                    <Label htmlFor="professional_indemnity" className="text-sm font-medium">Professional Indemnity Schedule</Label>
                    <div className="flex gap-2 mt-1">
                      <FileUpload
                        onUpload={(files) => handleFileUpload("professional_indemnity", files[0] || null)}
                        onRemove={() => handleFileUpload("professional_indemnity", null)}
                        acceptedTypes={["application/pdf"]}
                        maxFiles={1}
                      />
                      <Input
                        placeholder="No file selected"
                        value={form.professional_indemnity?.name || "No file selected"}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* State Facility Registration */}
                  <div>
                    <Label htmlFor="state_facility_registration" className="text-sm font-medium">State Facility Registration Certificate</Label>
                    <div className="flex gap-2 mt-1">
                      <FileUpload
                        onUpload={(files) => handleFileUpload("state_facility_registration", files[0] || null)}
                        onRemove={() => handleFileUpload("state_facility_registration", null)}
                        acceptedTypes={["application/pdf"]}
                        maxFiles={1}
                      />
                      <Input
                        placeholder="No file selected"
                        value={form.state_facility_registration?.name || "No file selected"}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Band Selection */}
          <BandSelector
            selectedBands={form.selected_bands}
            onBandsChange={(bands) => setForm(prev => ({ ...prev, selected_bands: bands }))}
            className="mt-6"
          />

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateProviderMutation.isPending}
              className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
            >
              {updateProviderMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Provider
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PermissionGate>
  )
}
