"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  User,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Building2,
  FileText,
  Users,
  UserPlus,
  Trash2
} from "lucide-react"
import { toast } from "sonner"
import { CompactFileUpload } from "@/components/ui/compact-file-upload"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronsUpDown, Search as SearchIcon, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Dependent {
  first_name: string
  last_name: string
  middle_name: string
  date_of_birth: string
  gender: string
  relationship: string
  profile_picture: File | null
}

interface PrincipalFormData {
  // Personal Information
  first_name: string
  last_name: string
  middle_name: string
  gender: string
  date_of_birth: string
  phone_number: string
  email: string
  residential_address: string

  // Organization Information
  organization_id: string
  organization_name: string
  organization_code: string
  organization_email: string
  organization_phone: string
  organization_address: string

  // Plan Information
  plan_id: string
  plan_name: string
  plan_type: string

  // Health Information
  primary_hospital: string
  hospital_address: string

  // Additional Information
  remarks: string
}

export default function PublicPrincipalRegistrationPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentSection, setCurrentSection] = useState(1)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [dependents, setDependents] = useState<Dependent[]>([])

  const [formData, setFormData] = useState<PrincipalFormData>({
    first_name: "",
    last_name: "",
    middle_name: "",
    gender: "",
    date_of_birth: "",
    phone_number: "",
    email: "",
    residential_address: "",
    organization_id: "",
    organization_name: "",
    organization_code: "",
    organization_email: "",
    organization_phone: "",
    organization_address: "",
    plan_id: "",
    plan_name: "",
    plan_type: "",
    primary_hospital: "",
    hospital_address: "",
    remarks: ""
  })

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Fetch organizations
  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/public/organizations")
      if (!res.ok) throw new Error("Failed to fetch organizations")
      return res.json()
    },
  })

  // Fetch plans
  const { data: plansData } = useQuery({
    queryKey: ["plans", formData.organization_id],
    queryFn: async () => {
      if (!formData.organization_id) return { plans: [] }
      const res = await fetch(`/api/public/plans?organizationId=${formData.organization_id}`)
      if (!res.ok) throw new Error("Failed to fetch plans")
      return res.json()
    },
    enabled: !!formData.organization_id,
  })

  const organizations = organizationsData?.organizations || []
  const plans = plansData?.plans || []

  // Provider Search State
  const [providerSearch, setProviderSearch] = useState("")
  const [debouncedProviderSearch, setDebouncedProviderSearch] = useState("")
  const [isProviderOpen, setIsProviderOpen] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProviderSearch(providerSearch)
    }, 500)
    return () => clearTimeout(timer)
  }, [providerSearch])

  // Get current plan's bands and derive allowed bands
  const selectedPlan = plans.find((p: any) => p.id === formData.plan_id)

  const derivedBands = React.useMemo(() => {
    if (!selectedPlan?.assigned_bands) return []
    const explicit = selectedPlan.assigned_bands as string[]
    const expanded = new Set(explicit)

    // Band Logic: A includes B, C; B includes C
    if (explicit.includes('A')) {
      expanded.add('B')
      expanded.add('C')
    }
    if (explicit.includes('B')) {
      expanded.add('C')
    }

    return Array.from(expanded)
  }, [selectedPlan])

  // Fetch Providers
  const { data: providersData, isLoading: isLoadingProviders } = useQuery({
    queryKey: ["public-providers", debouncedProviderSearch, derivedBands],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedProviderSearch) params.append("search", debouncedProviderSearch)
      if (derivedBands.length > 0) params.append("bands", derivedBands.join(","))

      const res = await fetch(`/api/public/providers?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch providers")
      return res.json()
    },
    enabled: !!formData.plan_id // Only fetch if Plan is selected (to know bands)
  })

  const providers = providersData?.providers || []

  const handleInputChange = (field: keyof PrincipalFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validateSection = (section: number): boolean => {
    const errors: Record<string, string> = {}

    if (section === 1) {
      if (!formData.first_name.trim()) errors.first_name = "First name is required"
      if (!formData.last_name.trim()) errors.last_name = "Last name is required"
      if (!formData.gender) errors.gender = "Gender is required"
      if (!formData.date_of_birth) errors.date_of_birth = "Date of birth is required"
      if (!formData.phone_number.trim()) errors.phone_number = "Phone number is required"
      if (!formData.email.trim()) errors.email = "Email is required"
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = "Invalid email format"
      }
      if (!formData.residential_address.trim()) errors.residential_address = "Address is required"

      // MANDATORY PICTURE UPLOAD
      if (uploadedFiles.length === 0) {
        errors.profile_picture = "Profile picture is required"
      }
    }

    if (section === 2) {
      if (!formData.organization_id) errors.organization_id = "Organization selection is required"
      if (!formData.plan_id) errors.plan_id = "Plan selection is required"
    }

    // Validate dependents section (Section 3) for family plans
    if (section === 3 && formData.plan_type?.toLowerCase().includes('family')) {
      dependents.forEach((dependent, index) => {
        if (!dependent.first_name.trim()) {
          errors[`dependent_${index}_first_name`] = `Dependent ${index + 1}: First name is required`
        }
        if (!dependent.last_name.trim()) {
          errors[`dependent_${index}_last_name`] = `Dependent ${index + 1}: Last name is required`
        }
        if (!dependent.date_of_birth) {
          errors[`dependent_${index}_dob`] = `Dependent ${index + 1}: Date of birth is required`
        }
        if (!dependent.gender) {
          errors[`dependent_${index}_gender`] = `Dependent ${index + 1}: Gender is required`
        }
        if (!dependent.relationship) {
          errors[`dependent_${index}_relationship`] = `Dependent ${index + 1}: Relationship is required`
        }
        if (!dependent.profile_picture) {
          errors[`dependent_${index}_picture`] = `Dependent ${index + 1}: Profile picture is required`
        }
      })
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    if (validateSection(currentSection)) {
      const maxSection = formData.plan_type?.toLowerCase().includes('family') ? 4 : 3
      setCurrentSection(prev => Math.min(prev + 1, maxSection))
    } else {
      toast.error("Please fill in all required fields")
    }
  }

  const handlePrevious = () => {
    setCurrentSection(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateSection(currentSection)) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      // Upload profile picture if provided
      let profilePictureUrl = ""
      if (uploadedFiles.length > 0) {
        const uploadFormData = new FormData()
        uploadedFiles.forEach((file) => {
          uploadFormData.append("files", file)
        })
        uploadFormData.append("folder", "principal_profiles")
        uploadFormData.append("resourceType", "image")

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: uploadFormData,
        })

        let uploadResult;
        try {
          const text = await uploadResponse.text()
          try {
            uploadResult = JSON.parse(text)
          } catch (e) {
            console.error('Upload response parse error:', text.slice(0, 100))
            throw new Error(uploadResponse.status === 413 ? "File is too large" : "Server upload error")
          }
        } catch (e: any) {
          throw new Error(e.message || "Failed to upload profile picture")
        }

        if (!uploadResponse.ok) {
          throw new Error(uploadResult?.error || "Failed to upload profile picture")
        }

        if (uploadResult.data?.[0]?.secure_url) {
          profilePictureUrl = uploadResult.data[0].secure_url
        }
      }

      // Upload dependent pictures if any (only for family plans)
      const isFamilyPlan = formData.plan_type?.toLowerCase().includes('family')
      let dependentsWithPictures: any[] = []

      if (isFamilyPlan && dependents.length > 0) {
        dependentsWithPictures = await Promise.all(
          dependents.map(async (dependent) => {
            let dependentPictureUrl = ""
            if (dependent.profile_picture) {
              const depUploadFormData = new FormData()
              depUploadFormData.append("files", dependent.profile_picture)
              depUploadFormData.append("folder", "dependent_profiles")
              depUploadFormData.append("resourceType", "image")

              const depUploadResponse = await fetch("/api/upload", {
                method: "POST",
                body: depUploadFormData,
              })

              let depUploadResult;
              try {
                const text = await depUploadResponse.text()
                try {
                  depUploadResult = JSON.parse(text)
                } catch (e) {
                  console.error('Dependent upload parse error:', text.slice(0, 100))
                  throw new Error(depUploadResponse.status === 413 ? "File is too large" : "Server upload error")
                }
              } catch (e: any) {
                throw new Error(e.message || "Failed to upload dependent picture")
              }

              if (!depUploadResponse.ok) {
                throw new Error(depUploadResult?.error || "Failed to upload dependent picture")
              }
              if (depUploadResult.data?.[0]?.secure_url) {
                dependentPictureUrl = depUploadResult.data[0].secure_url
              }
            }

            return {
              first_name: dependent.first_name,
              last_name: dependent.last_name,
              middle_name: dependent.middle_name,
              date_of_birth: dependent.date_of_birth, // Already in YYYY-MM-DD format from input
              gender: dependent.gender,
              relationship: dependent.relationship,
              profile_picture: dependentPictureUrl,
            }
          })
        )
      }

      // Normalize date format to ISO (YYYY-MM-DD) for consistent API handling
      // This ensures compatibility across all browsers, especially mobile
      const normalizedFormData: any = {
        ...formData,
        date_of_birth: formData.date_of_birth, // HTML date input already returns YYYY-MM-DD
        profile_picture: profilePictureUrl,
      }

      // Only include dependents if it's a family plan and there are dependents
      if (isFamilyPlan && dependentsWithPictures.length > 0) {
        normalizedFormData.dependents = dependentsWithPictures
      }

      // Submit registration
      const response = await fetch("/api/public/principal-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedFormData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Registration failed")
      }

      const result = await response.json()

      toast.success("Registration submitted successfully! We will contact you shortly.")

      // Reset form
      setFormData({
        first_name: "",
        last_name: "",
        middle_name: "",
        gender: "",
        date_of_birth: "",
        phone_number: "",
        email: "",
        residential_address: "",
        organization_id: "",
        organization_name: "",
        organization_code: "",
        organization_email: "",
        organization_phone: "",
        organization_address: "",
        plan_id: "",
        plan_name: "",
        plan_type: "",
        primary_hospital: "",
        hospital_address: "",
        remarks: ""
      })
      setUploadedFiles([])
      setCurrentSection(1)

      // Optionally redirect to a success page
      // router.push("/registration-success")

    } catch (error: any) {
      console.error("Registration error:", error)
      toast.error(error.message || "Failed to submit registration. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getSectionIcon = (section: number) => {
    switch (section) {
      case 1:
        return <User className="h-6 w-6" />
      case 2:
        return <Building2 className="h-6 w-6" />
      case 3:
        return <FileText className="h-6 w-6" />
      default:
        return null
    }
  }

  const getSectionTitle = (section: number) => {
    switch (section) {
      case 1:
        return "Personal Information"
      case 2:
        return "Organization & Plan Details"
      case 3:
        return "Review & Submit"
      default:
        return ""
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-[#BE1522] p-4 rounded-full">
              <User className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Principal Registration
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Register as a Principal enrollee to access healthcare services. Please fill out the form below.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${step === currentSection
                      ? "bg-[#BE1522] text-white"
                      : step < currentSection
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-500"
                      }`}
                  >
                    {step < currentSection ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <span className="font-semibold">{step}</span>
                    )}
                  </div>
                  <span className="text-xs mt-2 text-gray-600 hidden sm:block">
                    {step === 1 ? "Personal" : step === 2 ? "Organization" : "Review"}
                  </span>
                </div>
                {step < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${step < currentSection ? "bg-green-600" : "bg-gray-200"
                      }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              {getSectionIcon(currentSection)}
              <div>
                <CardTitle className="text-2xl">{getSectionTitle(currentSection)}</CardTitle>
                <CardDescription className="text-blue-100">
                  Step {currentSection} of 3
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <form
              onSubmit={handleSubmit}
              onSubmit={handleSubmit}
            // Removed onKeyDown handler to prevent interference with Select/Button interactions
            >
              {/* Section 1: Personal Information */}
              {currentSection === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">
                        First Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="first_name"
                        placeholder="John"
                        value={formData.first_name}
                        onChange={(e) => handleInputChange("first_name", e.target.value)}
                        className={validationErrors.first_name ? "border-red-500" : ""}
                      />
                      {validationErrors.first_name && (
                        <p className="text-xs text-red-500">{validationErrors.first_name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="last_name">
                        Last Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="last_name"
                        placeholder="Doe"
                        value={formData.last_name}
                        onChange={(e) => handleInputChange("last_name", e.target.value)}
                        className={validationErrors.last_name ? "border-red-500" : ""}
                      />
                      {validationErrors.last_name && (
                        <p className="text-xs text-red-500">{validationErrors.last_name}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="middle_name">Middle Name</Label>
                      <Input
                        id="middle_name"
                        placeholder="Michael"
                        value={formData.middle_name}
                        onChange={(e) => handleInputChange("middle_name", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender">
                        Gender <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value) => handleInputChange("gender", value)}
                      >
                        <SelectTrigger className={validationErrors.gender ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {validationErrors.gender && (
                        <p className="text-xs text-red-500">{validationErrors.gender}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">
                      Date of Birth <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                      className={validationErrors.date_of_birth ? "border-red-500" : ""}
                    />
                    {validationErrors.date_of_birth && (
                      <p className="text-xs text-red-500">{validationErrors.date_of_birth}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone_number">
                        Phone Number <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="phone_number"
                          placeholder="+234 801 234 5678"
                          value={formData.phone_number}
                          onChange={(e) => handleInputChange("phone_number", e.target.value)}
                          className={`pl-10 ${validationErrors.phone_number ? "border-red-500" : ""}`}
                        />
                      </div>
                      {validationErrors.phone_number && (
                        <p className="text-xs text-red-500">{validationErrors.phone_number}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email Address <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="john.doe@example.com"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          className={`pl-10 ${validationErrors.email ? "border-red-500" : ""}`}
                        />
                      </div>
                      {validationErrors.email && (
                        <p className="text-xs text-red-500">{validationErrors.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="residential_address">
                      Residential Address <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="residential_address"
                      placeholder="Enter your full residential address..."
                      value={formData.residential_address}
                      onChange={(e) => handleInputChange("residential_address", e.target.value)}
                      className={validationErrors.residential_address ? "border-red-500" : ""}
                      rows={3}
                    />
                    {validationErrors.residential_address && (
                      <p className="text-xs text-red-500">{validationErrors.residential_address}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Profile Picture <span className="text-red-500">*</span>
                    </Label>
                    <CompactFileUpload
                      onUpload={setUploadedFiles}
                      onRemove={() => setUploadedFiles([])}
                      acceptedTypes={["image/png", "image/jpeg", "image/jpg"]}
                      maxFiles={1}
                      maxSize={4 * 1024 * 1024}
                      folder="principal_profiles"
                      resourceType="image"
                      label="Upload a profile picture (PNG, JPG - Max 4MB)"
                    />
                    {validationErrors.profile_picture && (
                      <p className="text-xs text-red-500">{validationErrors.profile_picture}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Section 2: Organization & Plan Details */}
              {currentSection === 2 && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-blue-900 mb-1">Organization Information</h3>
                        <p className="text-sm text-blue-700">
                          Please provide your organization details. If you don't have an organization code, leave it blank and we'll assist you.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organization_id">
                      Select Organization <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.organization_id}
                      onValueChange={(value) => {
                        const selectedOrg = organizations.find((org: any) => org.id === value)
                        if (selectedOrg) {
                          setFormData(prev => ({
                            ...prev,
                            organization_id: value,
                            organization_name: selectedOrg.name,
                            organization_code: selectedOrg.code || "",
                            organization_email: selectedOrg.email || "",
                            organization_phone: selectedOrg.phone || "",
                            organization_address: selectedOrg.address || "",
                          }))
                        }
                      }}
                    >
                      <SelectTrigger className={validationErrors.organization_id ? "border-red-500" : ""}>
                        <SelectValue placeholder="Choose your organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org: any) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name} ({org.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.organization_id && (
                      <p className="text-xs text-red-500">{validationErrors.organization_id}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="organization_code">Organization Code</Label>
                      <Input
                        id="organization_code"
                        placeholder="Auto-filled from organization"
                        value={formData.organization_code}
                        readOnly
                        className="bg-gray-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500">Auto-filled when you select an organization</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organization_email">Organization Email</Label>
                      <Input
                        id="organization_email"
                        type="email"
                        placeholder="Auto-filled from organization"
                        value={formData.organization_email}
                        readOnly
                        className="bg-gray-50 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="organization_phone">Organization Phone</Label>
                      <Input
                        id="organization_phone"
                        placeholder="Auto-filled from organization"
                        value={formData.organization_phone}
                        readOnly
                        className="bg-gray-50 cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="plan_id">
                        Select Plan <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.plan_id}
                        onValueChange={(value) => {
                          const selectedPlan = plans.find((plan: any) => plan.id === value)
                          if (selectedPlan) {
                            setFormData(prev => ({
                              ...prev,
                              plan_id: value,
                              plan_name: selectedPlan.name,
                              plan_type: selectedPlan.plan_type || "",
                            }))
                          }
                        }}
                        disabled={!formData.organization_id}
                      >
                        <SelectTrigger className={validationErrors.plan_id ? "border-red-500" : ""}>
                          <SelectValue placeholder={formData.organization_id ? "Choose your plan" : "Select organization first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((plan: any) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.plan_id && (
                        <p className="text-xs text-red-500">{validationErrors.plan_id}</p>
                      )}
                      {!formData.organization_id && (
                        <p className="text-xs text-gray-500">Please select an organization first</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organization_address">Organization Address</Label>
                    <Textarea
                      id="organization_address"
                      placeholder="Auto-filled from organization"
                      value={formData.organization_address}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                      rows={2}
                    />
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Healthcare Preference</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="primary_hospital">Primary Hospital (Optional)</Label>
                        <Popover open={isProviderOpen} onOpenChange={setIsProviderOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isProviderOpen}
                              className="w-full justify-between"
                              disabled={!formData.plan_id}
                            >
                              {formData.primary_hospital || (formData.plan_id ? "Select hospital..." : "Select plan first")}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command shouldFilter={false}>
                              <div className="flex items-center border-b px-3">
                                <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <CommandInput
                                  placeholder="Search hospital name..."
                                  value={providerSearch}
                                  onValueChange={setProviderSearch}
                                />
                              </div>
                              <CommandList>
                                <CommandEmpty>
                                  {isLoadingProviders ? "Loading..." : "No hospital found."}
                                </CommandEmpty>
                                <CommandGroup>
                                  {providers.map((provider: any) => (
                                    <CommandItem
                                      key={provider.id}
                                      value={provider.facility_name}
                                      className="data-[disabled]:opacity-100 data-[disabled]:pointer-events-auto cursor-pointer"
                                      onSelect={() => {
                                        setFormData(prev => ({
                                          ...prev,
                                          primary_hospital: provider.facility_name,
                                          hospital_address: provider.address
                                        }))
                                        setIsProviderOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.primary_hospital === provider.facility_name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{provider.facility_name}</span>
                                        <span className="text-xs text-gray-500">{provider.address}</span>
                                        {provider.band && <span className="text-xs text-blue-500">Band {provider.band}</span>}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {!formData.plan_id && <p className="text-xs text-gray-500">Select a plan to see available hospitals.</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hospital_address">Hospital Address (Optional)</Label>
                        <Input
                          id="hospital_address"
                          placeholder="Hospital address"
                          value={formData.hospital_address}
                          onChange={(e) => handleInputChange("hospital_address", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Dependents (Family Plan Only) */}
              {currentSection === 3 && formData.plan_type?.toLowerCase().includes('family') && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-blue-900">Family Plan - Add Dependents</h3>
                        <p className="text-sm text-blue-700 mt-1">
                          You can add up to 5 dependents to your family plan. Each dependent must have a profile picture.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Existing Dependents */}
                  {dependents.map((dependent, index) => (
                    <Card key={index} className="border-2">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Dependent {index + 1}</CardTitle>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDependents(prev => prev.filter((_, i) => i !== index))
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Profile Picture */}
                        <div className="space-y-2">
                          <Label>Profile Picture <span className="text-red-500">*</span></Label>
                          <CompactFileUpload
                            onUpload={(files) => {
                              if (files.length > 0) {
                                setDependents(prev => prev.map((dep, i) =>
                                  i === index ? { ...dep, profile_picture: files[0] } : dep
                                ))
                              }
                            }}
                            maxFiles={1}
                            maxSize={4 * 1024 * 1024}
                            accept="image/*"
                          />
                          {dependent.profile_picture && (
                            <p className="text-sm text-green-600">✓ Picture uploaded</p>
                          )}
                        </div>

                        {/* Name Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>First Name <span className="text-red-500">*</span></Label>
                            <Input
                              value={dependent.first_name}
                              onChange={(e) => {
                                setDependents(prev => prev.map((dep, i) =>
                                  i === index ? { ...dep, first_name: e.target.value } : dep
                                ))
                              }}
                              placeholder="Enter first name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Last Name <span className="text-red-500">*</span></Label>
                            <Input
                              value={dependent.last_name}
                              onChange={(e) => {
                                setDependents(prev => prev.map((dep, i) =>
                                  i === index ? { ...dep, last_name: e.target.value } : dep
                                ))
                              }}
                              placeholder="Enter last name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Middle Name</Label>
                            <Input
                              value={dependent.middle_name}
                              onChange={(e) => {
                                setDependents(prev => prev.map((dep, i) =>
                                  i === index ? { ...dep, middle_name: e.target.value } : dep
                                ))
                              }}
                              placeholder="Enter middle name"
                            />
                          </div>
                        </div>

                        {/* Other Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Date of Birth <span className="text-red-500">*</span></Label>
                            <Input
                              type="date"
                              value={dependent.date_of_birth}
                              onChange={(e) => {
                                setDependents(prev => prev.map((dep, i) =>
                                  i === index ? { ...dep, date_of_birth: e.target.value } : dep
                                ))
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Gender <span className="text-red-500">*</span></Label>
                            <Select
                              value={dependent.gender}
                              onValueChange={(value) => {
                                setDependents(prev => prev.map((dep, i) =>
                                  i === index ? { ...dep, gender: value } : dep
                                ))
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Relationship <span className="text-red-500">*</span></Label>
                            <Select
                              value={dependent.relationship}
                              onValueChange={(value) => {
                                setDependents(prev => prev.map((dep, i) =>
                                  i === index ? { ...dep, relationship: value } : dep
                                ))
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select relationship" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SPOUSE">Spouse</SelectItem>
                                <SelectItem value="CHILD">Child</SelectItem>
                                <SelectItem value="PARENT">Parent</SelectItem>
                                <SelectItem value="SIBLING">Sibling</SelectItem>
                                <SelectItem value="OTHER">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Add Dependent Button */}
                  {dependents.length < 5 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-2"
                      onClick={() => {
                        setDependents(prev => [...prev, {
                          first_name: "",
                          last_name: "",
                          middle_name: "",
                          date_of_birth: "",
                          gender: "",
                          relationship: "",
                          profile_picture: null,
                        }])
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Dependent ({dependents.length}/5)
                    </Button>
                  )}

                  {dependents.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No dependents added yet</p>
                      <p className="text-sm">Click the button above to add a dependent</p>
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: Review & Submit (for non-family plans) OR Section 4 (for family plans) */}
              {((currentSection === 3 && !formData.plan_type?.toLowerCase().includes('family')) || currentSection === 4) && (
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-green-900 mb-1">Ready to Submit</h3>
                        <p className="text-sm text-green-700">
                          Please review your information below and click Submit to complete your registration.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Review Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-medium">{`${formData.first_name} ${formData.middle_name} ${formData.last_name}`.trim()}</span>

                        <span className="text-gray-600">Gender:</span>
                        <span className="font-medium">{formData.gender}</span>

                        <span className="text-gray-600">Date of Birth:</span>
                        <span className="font-medium">{formData.date_of_birth}</span>

                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium">{formData.phone_number}</span>

                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium">{formData.email}</span>

                        <span className="text-gray-600">Address:</span>
                        <span className="font-medium">{formData.residential_address}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Organization & Plan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-600">Organization:</span>
                        <span className="font-medium">{formData.organization_name}</span>

                        {formData.organization_code && (
                          <>
                            <span className="text-gray-600">Organization Code:</span>
                            <span className="font-medium">{formData.organization_code}</span>
                          </>
                        )}

                        <span className="text-gray-600">Preferred Plan:</span>
                        <span className="font-medium">{formData.plan_name}</span>

                        {formData.primary_hospital && (
                          <>
                            <span className="text-gray-600">Primary Hospital:</span>
                            <span className="font-medium">{formData.primary_hospital}</span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label htmlFor="remarks">Additional Remarks (Optional)</Label>
                    <Textarea
                      id="remarks"
                      placeholder="Any additional information you'd like to share..."
                      value={formData.remarks}
                      onChange={(e) => handleInputChange("remarks", e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-900 mb-1">Important Notice</p>
                        <p className="text-yellow-700">
                          By submitting this form, you agree to our terms and conditions. We will review your application and contact you via email or phone within 2-3 business days.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between gap-4 mt-8 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentSection === 1 || isSubmitting}
                >
                  Previous
                </Button>

                {currentSection < (formData.plan_type?.toLowerCase().includes('family') ? 4 : 3) ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      handleSubmit(e as any)
                    }}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Submit Registration
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer Info */}
        {/* <div className="text-center mt-8 text-sm text-gray-600">
          <p>
            Need help? Contact us at{" "}
            <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
              support@example.com
            </a>
          </p>
        </div> */}
      </div>
    </div>
  )
}
