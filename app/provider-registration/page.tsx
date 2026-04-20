"use client"

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Building2, 
  Upload, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  FileText,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Users,
  Stethoscope,
  Shield,
  Save
} from "lucide-react"
import { toast } from "sonner"



interface ProviderFormData {
  // Section 1: Basic Information
  partnership_interest: string
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
  hcp_code: string
  
  // Section 2: Service Delivery
  hours_of_operation: string
  other_branches: string
  emergency_care_services: string[]
  facility_type: string[]
  personnel_licensed: string
  blood_bank_available: string
  blood_sourcing_method: string
  radiology_lab_services: string[]
  other_services: string[]
  
  // Section 3: Banking Information
  bank_name: string
  account_name: string
  account_number: string
  
  // Documents (file uploads)
  documents: {
    cac_registration?: File
    nhis_accreditation?: File
    professional_indemnity?: File
    state_facility_registration?: File
    others?: File
  }
}

export default function PublicProviderRegistrationPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentSection, setCurrentSection] = useState(1)
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  
  const [formData, setFormData] = useState<ProviderFormData>({
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
    hours_of_operation: "",
    other_branches: "",
    emergency_care_services: [],
    facility_type: [],
    personnel_licensed: "",
    blood_bank_available: "",
    blood_sourcing_method: "",
    radiology_lab_services: [],
    other_services: [],
    bank_name: "",
    account_name: "",
    account_number: "",
    documents: {}
  })

  const handleInputChange = (field: keyof ProviderFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleArrayChange = (field: keyof ProviderFormData, value: string, checked: boolean) => {
    setFormData(prev => {
      const currentArray = (prev[field] as string[]) || []
      if (checked) {
        return { ...prev, [field]: [...currentArray, value] }
      } else {
        return { ...prev, [field]: currentArray.filter(item => item !== value) }
      }
    })
  }

  const handleFileUpload = (field: keyof ProviderFormData['documents'], file: File) => {
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [field]: file
      }
    }))
  }

  const validateSection = (section: number): boolean => {
    const invalidFields: string[] = []
    
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    // Phone validation regex (supports various formats)
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/
    
    if (section === 1) {
      // All fields are optional — only validate formats when values are provided
      if (formData.email && !emailRegex.test(formData.email)) {
        invalidFields.push("Email Address (invalid format)")
      }
      if (formData.hmo_coordinator_email && !emailRegex.test(formData.hmo_coordinator_email)) {
        invalidFields.push("HMO Coordinator Email (invalid format)")
      }
      if (formData.phone_whatsapp && !phoneRegex.test(formData.phone_whatsapp)) {
        invalidFields.push("Phone Number (invalid format)")
      }
      if (formData.hmo_coordinator_phone && !phoneRegex.test(formData.hmo_coordinator_phone)) {
        invalidFields.push("HMO Coordinator Phone (invalid format)")
      }
      if (formData.year_of_incorporation) {
        const year = parseInt(formData.year_of_incorporation)
        const currentYear = new Date().getFullYear()
        if (isNaN(year) || year < 1900 || year > currentYear) {
          invalidFields.push("Year of Incorporation (invalid year)")
        }
      }
    } else if (section === 3) {
      // Validate account number format only if provided
      if (formData.account_number && !/^\d+$/.test(formData.account_number)) {
        invalidFields.push("Account Number (must be numeric)")
      }
      if (!declarationAccepted) {
        invalidFields.push("Declaration checkbox")
      }
    }
    
    if (invalidFields.length > 0) {
      toast.error("Invalid Field Format", {
        description: `Please correct: ${invalidFields.join(", ")}`,
      })
      return false
    }

    return true
  }

  const nextSection = () => {
    try {
      // Validate current section before proceeding
      if (!validateSection(currentSection)) {
        // Validation failed - toast already shown by validateSection
        return
      }
      
      // Only proceed if validation passed and not on last section
      if (currentSection < 3) {
        setCurrentSection(currentSection + 1)
      }
    } catch (error) {
      toast.error("Navigation Error", {
        description: "An error occurred while navigating to the next section. Please try again.",
      })
    }
  }

  const prevSection = () => {
    if (currentSection > 1) {
      setCurrentSection(currentSection - 1)
    }
  }

  const handleSubmit = async () => {
    if (!validateSection(currentSection)) {
      return
    }

    if (!declarationAccepted) {
      toast.error("Declaration Required", {
        description: "Please accept the declaration statement before submitting.",
      })
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Create FormData for file uploads
      const submitData = new FormData()
      
      // Add all form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'documents') {
          // Handle file uploads separately
          Object.entries(value).forEach(([docKey, file]) => {
            if (file) {
              submitData.append(`documents.${docKey}`, file)
            }
          })
        } else if (Array.isArray(value)) {
          submitData.append(key, JSON.stringify(value))
        } else {
          submitData.append(key, value as string)
        }
      })
      
      submitData.append('status', 'PENDING_APPROVAL')
      submitData.append('account_type', 'PROVIDER')
      submitData.append('declaration_accepted', declarationAccepted ? 'true' : 'false')

      const response = await fetch('/api/public/provider-registration', {
        method: 'POST',
        body: submitData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success("Registration Submitted Successfully", {
          description: "Your provider registration has been submitted for review. You will be notified once it's approved.",
        })
        
        // Reset form
        setFormData({
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
          hours_of_operation: "",
          other_branches: "",
          emergency_care_services: [],
          facility_type: [],
          personnel_licensed: "",
          blood_bank_available: "",
          blood_sourcing_method: "",
          radiology_lab_services: [],
          other_services: [],
          bank_name: "",
          account_name: "",
          account_number: "",
          documents: {}
        })
        setDeclarationAccepted(false)
        setCurrentSection(1)
      } else {
        // Show specific error message from API
        let errorMessage = result.error || result.message || "An error occurred while submitting your registration."
        
        // Handle specific error patterns
        if (errorMessage.includes("string didn't match the expected pattern")) {
          errorMessage = "Invalid data format detected. Please check your email addresses, phone numbers, and other fields for correct formatting."
        } else if (errorMessage.includes("already exists")) {
          errorMessage = "A provider with this facility name or email already exists. Please use different details."
        } else if (errorMessage.includes("required")) {
          errorMessage = "Please fill in all required fields before submitting."
        } else if (errorMessage.includes("validation")) {
          errorMessage = "Please check your input data and ensure all fields are filled correctly."
        }

        toast.error("Registration Failed", {
          description: errorMessage,
        })
      }
    } catch (error) {
      let errorMessage = "An error occurred while submitting your registration."
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your internet connection and try again."
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out. Please try again."
        } else if (error.message.includes("string didn't match the expected pattern")) {
          errorMessage = "Invalid data format detected. Please check your email addresses, phone numbers, and other fields for correct formatting."
        } else if (error.message.includes('validation')) {
          errorMessage = "Please check your input data and ensure all fields are filled correctly."
        } else {
          errorMessage = error.message
        }
      }
      
      toast.error("Registration Failed", {
        description: errorMessage,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getSectionTitle = () => {
    switch (currentSection) {
      case 1: return "Section 1 of 3 - Basic Information"
      case 2: return "Section 2 of 3 - Service Delivery"
      case 3: return "Section 3 of 3 - Bank Details"
      default: return ""
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Building2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Provider Registration</h1>
          </div>
          <p className="text-gray-600">Join our network of healthcare providers</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[1, 2, 3].map((section) => (
              <div key={section} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentSection >= section ? 'bg-[#BE1522] text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {currentSection > section ? <CheckCircle className="h-4 w-4" /> : section}
                </div>
                <span className={`ml-2 text-sm ${
                  currentSection >= section ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {section === 1 ? 'Basic Information' : 
                   section === 2 ? 'Service Delivery' : 'Bank Details'}
                </span>
                {section < 3 && <div className="w-8 h-0.5 bg-gray-300 ml-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Form Sections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentSection === 1 && <Building2 className="h-5 w-5 text-blue-600" />}
              {currentSection === 2 && <Stethoscope className="h-5 w-5 text-blue-600" />}
              {currentSection === 3 && <span className="text-xl font-bold text-blue-600">₦</span>}
              {getSectionTitle()}
            </CardTitle>
            <CardDescription>
              {currentSection === 1 && "Basic details of the healthcare provider"}
              {currentSection === 2 && "Service delivery and operational information"}
              {currentSection === 3 && "Banking information and required document uploads"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Section 1: Basic Information */}
            {currentSection === 1 && (
              <div className="space-y-4">
                {/* Partnership Interest */}
                <div>
                  <Label htmlFor="partnership_interest">Are you interested in exploring a working partnership with us?</Label>
                  <Select value={formData.partnership_interest} onValueChange={(value) => handleInputChange('partnership_interest', value)}>
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
                    value={formData.facility_name}
                    onChange={(e) => handleInputChange('facility_name', e.target.value)}
                    placeholder="Enter facility name"
                  />
                </div>

                {/* Address */}
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
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
                      value={formData.phone_whatsapp}
                      onChange={(e) => handleInputChange('phone_whatsapp', e.target.value)}
                      placeholder="+234 801 234 5678"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="facility@example.com"
                    />
                  </div>
                </div>

                {/* Medical Director */}
                <div>
                  <Label htmlFor="medical_director_name">Name of Medical Director/Managing Director/Lead</Label>
                  <Input
                    id="medical_director_name"
                    value={formData.medical_director_name}
                    onChange={(e) => handleInputChange('medical_director_name', e.target.value)}
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
                        value={formData.hmo_coordinator_name}
                        onChange={(e) => handleInputChange('hmo_coordinator_name', e.target.value)}
                        placeholder="Enter full name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="hmo_coordinator_phone">Phone Number</Label>
                      <Input
                        id="hmo_coordinator_phone"
                        value={formData.hmo_coordinator_phone}
                        onChange={(e) => handleInputChange('hmo_coordinator_phone', e.target.value)}
                        placeholder="+234 801 234 5678"
                      />
                    </div>

                    <div>
                      <Label htmlFor="hmo_coordinator_email">Email Address</Label>
                      <Input
                        id="hmo_coordinator_email"
                        type="email"
                        value={formData.hmo_coordinator_email}
                        onChange={(e) => handleInputChange('hmo_coordinator_email', e.target.value)}
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
                      value={formData.year_of_incorporation}
                      onChange={(e) => handleInputChange('year_of_incorporation', e.target.value)}
                      placeholder="e.g., 2020"
                    />
                  </div>

                  <div>
                    <Label htmlFor="facility_reg_number">Facility Reg. No.</Label>
                    <Input
                      id="facility_reg_number"
                      value={formData.facility_reg_number}
                      onChange={(e) => handleInputChange('facility_reg_number', e.target.value)}
                      placeholder="Enter facility registration number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="practice">Practice</Label>
                    <Input
                      id="practice"
                      value={formData.practice}
                      onChange={(e) => handleInputChange('practice', e.target.value)}
                      placeholder="Enter practice type"
                    />
                  </div>

                  <div>
                    <Label htmlFor="hcp_code">HCP Code</Label>
                    <Input
                      id="hcp_code"
                      value={formData.hcp_code}
                      onChange={(e) => handleInputChange('hcp_code', e.target.value)}
                      placeholder="Enter HCP code"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="proprietor_partners">Name of proprietor or list the names of current partners if it's a partnership</Label>
                  <Textarea
                    id="proprietor_partners"
                    value={formData.proprietor_partners}
                    onChange={(e) => handleInputChange('proprietor_partners', e.target.value)}
                    placeholder="Enter proprietor/partners names..."
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            )}

            {/* Section 2: Service Delivery */}
            {currentSection === 2 && (
              <div className="space-y-6">
                {/* Hours of Operation */}
                <div>
                  <Label htmlFor="hours_of_operation">Hours of Operation</Label>
                  <Input
                    id="hours_of_operation"
                    value={formData.hours_of_operation}
                    onChange={(e) => handleInputChange('hours_of_operation', e.target.value)}
                    placeholder="e.g., 24/7 or 8:00 AM - 6:00 PM"
                  />
                </div>

                {/* Other Branches */}
                <div>
                  <Label htmlFor="other_branches">Please List Other Branches of your Hospital (If any)</Label>
                  <Textarea
                    id="other_branches"
                    value={formData.other_branches}
                    onChange={(e) => handleInputChange('other_branches', e.target.value)}
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
                          checked={formData.emergency_care_services.includes("TRAUMA_CARE")}
                          onCheckedChange={(checked) => handleArrayChange('emergency_care_services', "TRAUMA_CARE", checked as boolean)}
                        />
                        <Label htmlFor="trauma_care">Trauma Care</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="cardiac_emergency"
                          checked={formData.emergency_care_services.includes("CARDIAC_EMERGENCY")}
                          onCheckedChange={(checked) => handleArrayChange('emergency_care_services', "CARDIAC_EMERGENCY", checked as boolean)}
                        />
                        <Label htmlFor="cardiac_emergency">Cardiac Emergency</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="pediatric_emergency"
                          checked={formData.emergency_care_services.includes("PEDIATRIC_EMERGENCY")}
                          onCheckedChange={(checked) => handleArrayChange('emergency_care_services', "PEDIATRIC_EMERGENCY", checked as boolean)}
                        />
                        <Label htmlFor="pediatric_emergency">Pediatric Emergency</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="obstetric_emergency"
                          checked={formData.emergency_care_services.includes("OBSTETRIC_EMERGENCY")}
                          onCheckedChange={(checked) => handleArrayChange('emergency_care_services', "OBSTETRIC_EMERGENCY", checked as boolean)}
                        />
                        <Label htmlFor="obstetric_emergency">Obstetric Emergency</Label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="neurological_emergency"
                          checked={formData.emergency_care_services.includes("NEUROLOGICAL_EMERGENCY")}
                          onCheckedChange={(checked) => handleArrayChange('emergency_care_services', "NEUROLOGICAL_EMERGENCY", checked as boolean)}
                        />
                        <Label htmlFor="neurological_emergency">Neurological Emergency</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="respiratory_emergency"
                          checked={formData.emergency_care_services.includes("RESPIRATORY_EMERGENCY")}
                          onCheckedChange={(checked) => handleArrayChange('emergency_care_services', "RESPIRATORY_EMERGENCY", checked as boolean)}
                        />
                        <Label htmlFor="respiratory_emergency">Respiratory Emergency</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="general_emergency"
                          checked={formData.emergency_care_services.includes("GENERAL_EMERGENCY")}
                          onCheckedChange={(checked) => handleArrayChange('emergency_care_services', "GENERAL_EMERGENCY", checked as boolean)}
                        />
                        <Label htmlFor="general_emergency">General Emergency</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="burn_care"
                          checked={formData.emergency_care_services.includes("BURN_CARE")}
                          onCheckedChange={(checked) => handleArrayChange('emergency_care_services', "BURN_CARE", checked as boolean)}
                        />
                        <Label htmlFor="burn_care">Burn Care</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Facility Type */}
                <div>
                  <Label className="text-base font-medium">What type of facility do you operate? Tick as applicable</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="primary_care"
                          checked={formData.facility_type.includes("PRIMARY_CARE")}
                          onCheckedChange={(checked) => handleArrayChange('facility_type', "PRIMARY_CARE", checked as boolean)}
                        />
                        <Label htmlFor="primary_care">PRIMARY CARE/CLINIC</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="pharmaceutical"
                          checked={formData.facility_type.includes("PHARMACEUTICAL")}
                          onCheckedChange={(checked) => handleArrayChange('facility_type', "PHARMACEUTICAL", checked as boolean)}
                        />
                        <Label htmlFor="pharmaceutical">PHARMACEUTICAL SERVICES</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="physiotherapy"
                          checked={formData.facility_type.includes("PHYSIOTHERAPY")}
                          onCheckedChange={(checked) => handleArrayChange('facility_type', "PHYSIOTHERAPY", checked as boolean)}
                        />
                        <Label htmlFor="physiotherapy">PHYSIOTHERAPY CLINIC</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="psychiatry"
                          checked={formData.facility_type.includes("PSYCHIATRY")}
                          onCheckedChange={(checked) => handleArrayChange('facility_type', "PSYCHIATRY", checked as boolean)}
                        />
                        <Label htmlFor="psychiatry">PSYCHIATRY/PSYCHOLOGICAL SERVICES</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="others_facility"
                          checked={formData.facility_type.includes("OTHERS")}
                          onCheckedChange={(checked) => handleArrayChange('facility_type', "OTHERS", checked as boolean)}
                        />
                        <Label htmlFor="others_facility">OTHERS</Label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="secondary_care"
                          checked={formData.facility_type.includes("SECONDARY_CARE")}
                          onCheckedChange={(checked) => handleArrayChange('facility_type', "SECONDARY_CARE", checked as boolean)}
                        />
                        <Label htmlFor="secondary_care">SECONDARY CARE</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="optical"
                          checked={formData.facility_type.includes("OPTICAL")}
                          onCheckedChange={(checked) => handleArrayChange('facility_type', "OPTICAL", checked as boolean)}
                        />
                        <Label htmlFor="optical">OPTICAL CLINIC</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="dental"
                          checked={formData.facility_type.includes("DENTAL")}
                          onCheckedChange={(checked) => handleArrayChange('facility_type', "DENTAL", checked as boolean)}
                        />
                        <Label htmlFor="dental">DENTAL CLINIC</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="diagnostics"
                          checked={formData.facility_type.includes("DIAGNOSTICS")}
                          onCheckedChange={(checked) => handleArrayChange('facility_type', "DIAGNOSTICS", checked as boolean)}
                        />
                        <Label htmlFor="diagnostics">DIAGNOSTICS</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personnel License */}
                <div>
                  <Label htmlFor="personnel_licensed">Are your health care personnel duly licensed to practice in Nigeria?</Label>
                  <Select value={formData.personnel_licensed} onValueChange={(value) => handleInputChange('personnel_licensed', value)}>
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
                  <Select value={formData.blood_bank_available} onValueChange={(value) => handleInputChange('blood_bank_available', value)}>
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
                {formData.blood_bank_available === "NO" && (
                  <div>
                    <Label htmlFor="blood_sourcing_method">If no, How do you source for Blood?</Label>
                    <Input
                      id="blood_sourcing_method"
                      value={formData.blood_sourcing_method}
                      onChange={(e) => handleInputChange('blood_sourcing_method', e.target.value)}
                      placeholder="Describe blood sourcing method"
                    />
                  </div>
                )}

                {/* Radiology/Lab Services */}
                <div>
                  <Label className="text-base font-medium">Radiology/Laboratory investigations offered. Tick as appropriate</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="ultrasound"
                          checked={formData.radiology_lab_services.includes("ULTRASOUND")}
                          onCheckedChange={(checked) => handleArrayChange('radiology_lab_services', "ULTRASOUND", checked as boolean)}
                        />
                        <Label htmlFor="ultrasound">ULTRASOUND</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="ecg"
                          checked={formData.radiology_lab_services.includes("ECG")}
                          onCheckedChange={(checked) => handleArrayChange('radiology_lab_services', "ECG", checked as boolean)}
                        />
                        <Label htmlFor="ecg">ECG</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="eeg"
                          checked={formData.radiology_lab_services.includes("EEG")}
                          onCheckedChange={(checked) => handleArrayChange('radiology_lab_services', "EEG", checked as boolean)}
                        />
                        <Label htmlFor="eeg">EEG</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="basic_lab"
                          checked={formData.radiology_lab_services.includes("BASIC_LAB")}
                          onCheckedChange={(checked) => handleArrayChange('radiology_lab_services', "BASIC_LAB", checked as boolean)}
                        />
                        <Label htmlFor="basic_lab">Basic Lab Investigations</Label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="echo"
                          checked={formData.radiology_lab_services.includes("ECHO")}
                          onCheckedChange={(checked) => handleArrayChange('radiology_lab_services', "ECHO", checked as boolean)}
                        />
                        <Label htmlFor="echo">ECHO</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="ct_scan"
                          checked={formData.radiology_lab_services.includes("CT_SCAN")}
                          onCheckedChange={(checked) => handleArrayChange('radiology_lab_services', "CT_SCAN", checked as boolean)}
                        />
                        <Label htmlFor="ct_scan">CT SCAN</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mri"
                          checked={formData.radiology_lab_services.includes("MRI")}
                          onCheckedChange={(checked) => handleArrayChange('radiology_lab_services', "MRI", checked as boolean)}
                        />
                        <Label htmlFor="mri">MRI</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="advanced_lab"
                          checked={formData.radiology_lab_services.includes("ADVANCED_LAB")}
                          onCheckedChange={(checked) => handleArrayChange('radiology_lab_services', "ADVANCED_LAB", checked as boolean)}
                        />
                        <Label htmlFor="advanced_lab">Advanced Lab Investigations</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Other Services */}
                <div>
                  <Label className="text-base font-medium">Other Services - For Hospitals, in terms of availability. Tick as appropriate</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="vaccines"
                          checked={formData.other_services.includes("VACCINES")}
                          onCheckedChange={(checked) => handleArrayChange('other_services', "VACCINES", checked as boolean)}
                        />
                        <Label htmlFor="vaccines">Vaccines</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="phototherapy"
                          checked={formData.other_services.includes("PHOTOTHERAPY")}
                          onCheckedChange={(checked) => handleArrayChange('other_services', "PHOTOTHERAPY", checked as boolean)}
                        />
                        <Label htmlFor="phototherapy">Phototherapy</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="optical_services"
                          checked={formData.other_services.includes("OPTICAL_SERVICES")}
                          onCheckedChange={(checked) => handleArrayChange('other_services', "OPTICAL_SERVICES", checked as boolean)}
                        />
                        <Label htmlFor="optical_services">Optical Services</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="others_services"
                          checked={formData.other_services.includes("OTHERS")}
                          onCheckedChange={(checked) => handleArrayChange('other_services', "OTHERS", checked as boolean)}
                        />
                        <Label htmlFor="others_services">Others</Label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="incubator_care"
                          checked={formData.other_services.includes("INCUBATOR_CARE")}
                          onCheckedChange={(checked) => handleArrayChange('other_services', "INCUBATOR_CARE", checked as boolean)}
                        />
                        <Label htmlFor="incubator_care">Incubator care</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="physiotherapy_services"
                          checked={formData.other_services.includes("PHYSIOTHERAPY")}
                          onCheckedChange={(checked) => handleArrayChange('other_services', "PHYSIOTHERAPY", checked as boolean)}
                        />
                        <Label htmlFor="physiotherapy_services">Physiotherapy</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="dental_services"
                          checked={formData.other_services.includes("DENTAL_SERVICES")}
                          onCheckedChange={(checked) => handleArrayChange('other_services', "DENTAL_SERVICES", checked as boolean)}
                        />
                        <Label htmlFor="dental_services">Dental Services</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Banking Information & Documents */}
            {currentSection === 3 && (
              <div className="space-y-6">
                {/* Bank Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => handleInputChange('bank_name', e.target.value)}
                      placeholder="Enter bank name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="account_name">Account Name</Label>
                    <Input
                      id="account_name"
                      value={formData.account_name}
                      onChange={(e) => handleInputChange('account_name', e.target.value)}
                      placeholder="Enter account name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="account_number">Account Number</Label>
                    <Input
                      id="account_number"
                      value={formData.account_number}
                      onChange={(e) => handleInputChange('account_number', e.target.value)}
                      placeholder="Enter account number"
                    />
                  </div>
                </div>

                {/* Document Uploads */}
                <div>
                  <Label className="text-base font-medium">Please kindly attach copies of the under-listed documents in PDF format:</Label>
                  
                  <div className="space-y-4 mt-4">
                    {/* CAC Registration */}
                    <div>
                      <Label htmlFor="cac_registration" className="text-sm font-medium">CAC Registration</Label>
                      <div className="mt-1">
                        <Input
                          id="cac_registration"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload('cac_registration', file)
                          }}
                        />
                        {formData.documents.cac_registration && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ {formData.documents.cac_registration.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* NHIS Accreditation */}
                    <div>
                      <Label htmlFor="nhis_accreditation" className="text-sm font-medium">NHIS Accreditation Certificate</Label>
                      <div className="mt-1">
                        <Input
                          id="nhis_accreditation"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload('nhis_accreditation', file)
                          }}
                        />
                        {formData.documents.nhis_accreditation && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ {formData.documents.nhis_accreditation.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Professional Indemnity */}
                    <div>
                      <Label htmlFor="professional_indemnity" className="text-sm font-medium">Professional Indemnity Schedule</Label>
                      <div className="mt-1">
                        <Input
                          id="professional_indemnity"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload('professional_indemnity', file)
                          }}
                        />
                        {formData.documents.professional_indemnity && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ {formData.documents.professional_indemnity.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* State Facility Registration */}
                    <div>
                      <Label htmlFor="state_facility_registration" className="text-sm font-medium">State Facility Registration Certificate</Label>
                      <div className="mt-1">
                        <Input
                          id="state_facility_registration"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload('state_facility_registration', file)
                          }}
                        />
                        {formData.documents.state_facility_registration && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ {formData.documents.state_facility_registration.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Other Supporting Document */}
                    <div>
                      <Label htmlFor="others" className="text-sm font-medium">Others</Label>
                      <div className="mt-1">
                        <Input
                          id="others"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload('others', file)
                          }}
                        />
                        {formData.documents.others && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ {formData.documents.others.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 p-4 bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="declaration_accepted"
                      checked={declarationAccepted}
                      onCheckedChange={(checked) => setDeclarationAccepted(checked === true)}
                    />
                    <Label htmlFor="declaration_accepted" className="text-sm leading-relaxed font-normal cursor-pointer">
                      We hereby declare that the information furnished in this claims form is true and correct to the best of my knowledge and belief.
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button
                onClick={prevSection}
                disabled={currentSection === 1}
                variant="outline"
              >
                Previous
              </Button>
              
              {currentSection < 3 ? (
                <Button onClick={nextSection}>
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !declarationAccepted}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Submit Registration
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>By submitting this form, you agree to our terms and conditions.</p>
          <p>Your registration will be reviewed and you will be notified of the outcome.</p>
        </div>
      </div>
    </div>
  )
}
