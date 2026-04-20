"use client"

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StateSelect, LGASelect } from "@/components/ui/state-lga-select"
import { ArrowLeft, Save, User, Building2, Calendar, Phone, Mail, MapPin, Hospital, Plus, X, Upload, Search, ArrowUp, Check, ChevronsUpDown } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Checkbox } from "@/components/ui/checkbox"
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
import { cn } from "@/lib/utils"



const SELECTABLE_PLAN_STATUSES = new Set(["ACTIVE", "COMPLETE"])

export default function AddPrincipalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Form state - following memos pattern
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    gender: "",
    date_of_birth: "",
    age: undefined as number | undefined,
    profile_picture: "",
    marital_status: "",
    region: "",
    phone_number: "",
    email: "",
    residential_address: "",
    organization_id: "",
    plan_id: "",
    account_type: "",
    auto_renewal: false,
    primary_hospital: "",
    hospital_address: "",
    start_date: "",
    end_date: "",
    state: "",
    lga: "",
    business_type: "",
    // Medical History
    sickle_cell_disease: false,
    kidney_disease: false,
    epilepsy: false,
    cancer_prostate_cervical: false,
    asthma: false,
    hiv_aids: false,
    surgeries: false,
    diabetes_mellitus: false,
    cataract: false,
    goiter: false,
    peptic_ulcer: false,
    hypertension: false,
    glaucoma: false,
    tuberculosis: false,
    haemorrhoids: false,
    hepatitis: false,
    disease_comments: "",
  })

  // State for file uploads and dependents
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [dependents, setDependents] = useState<Array<{
    full_name: string
    date_of_birth: string
    age: number | undefined
    gender: string
    relationship: string
    preferred_provider_id: string
  }>>([])
  const [showHospitalDropdown, setShowHospitalDropdown] = useState(false)
  const [openOrg, setOpenOrg] = useState(false)

  // Calculate age when date of birth changes
  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return undefined
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  // Watch date of birth to auto-calculate age
  React.useEffect(() => {
    if (form.date_of_birth) {
      const age = calculateAge(form.date_of_birth)
      setForm(prev => {
        if (prev.age !== age) {
          return { ...prev, age }
        }
        return prev
      })
    } else {
      setForm(prev => {
        if (prev.age !== undefined) {
          return { ...prev, age: undefined }
        }
        return prev
      })
    }
  }, [form.date_of_birth])

  // Close hospital dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-hospital-dropdown]')) {
        setShowHospitalDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Add dependent
  const addDependent = () => {
    setDependents([...dependents, {
      full_name: "",
      date_of_birth: "",
      age: undefined,
      gender: "",
      relationship: "",
      preferred_provider_id: ""
    }])
  }

  // Remove dependent
  const removeDependent = (index: number) => {
    setDependents(dependents.filter((_, i) => i !== index))
  }

  // Update dependent
  const updateDependent = (index: number, field: string, value: string | number) => {
    const updatedDependents = [...dependents]
    updatedDependents[index] = { ...updatedDependents[index], [field]: value }

    // Auto-calculate age for dependents
    if (field === "date_of_birth") {
      const age = calculateAge(value as string)
      updatedDependents[index].age = age
    }

    setDependents(updatedDependents)
  }

  // Fetch organizations
  const { data: organizationsData, isLoading: isLoadingOrgs, error: orgsError } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations?limit=1000")
      if (!res.ok) {
        throw new Error("Failed to fetch organizations")
      }
      return res.json()
    },
  })

  // Fetch plans
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/plans?limit=1000")
      if (!res.ok) {
        throw new Error("Failed to fetch plans")
      }
      return res.json()
    },
  })

  // Fetch organization details when organization is selected
  const { data: selectedOrganizationData } = useQuery({
    queryKey: ["organization", form.organization_id],
    queryFn: async () => {
      if (!form.organization_id) return null
      const res = await fetch(`/api/organizations/${form.organization_id}`)
      if (!res.ok) {
        throw new Error("Failed to fetch organization details")
      }
      return res.json()
    },
    enabled: !!form.organization_id
  })

  // Populate form fields when organization is selected
  React.useEffect(() => {
    if (selectedOrganizationData) {
      const contactInfo = selectedOrganizationData.contact_info || {}
      setForm(prev => ({
        ...prev,
        start_date: contactInfo.startDate || "",
        end_date: contactInfo.endDate || "",
        state: contactInfo.state || selectedOrganizationData.state || prev.state,
        lga: contactInfo.lga || selectedOrganizationData.lga || prev.lga,
        region: contactInfo.region || selectedOrganizationData.region || prev.region,
        business_type: contactInfo.business_type || selectedOrganizationData.business_type || prev.business_type,
        // Note: Organizations don't have a default plan, so we leave plan_id empty
        // The user will need to select a plan manually
      }))
    }
  }, [selectedOrganizationData])

  // Fetch providers
  const { data: providersData } = useQuery({
    queryKey: ["active-providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers/active")
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  // Create principal mutation - following memos pattern
  const createPrincipalMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/underwriting/principals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to create principal")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Principal account created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["principals"] })
      router.push("/underwriting/principals")
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create principal",
        variant: "destructive",
      })
    },
  })

  const organizations = React.useMemo(() =>
    organizationsData?.organizations || [],
    [organizationsData?.organizations]
  )
  // Allow finalized plans for registration while still hiding draft/in-progress plans.
  const allPlans = React.useMemo(() =>
    (plansData?.plans || []).filter((plan: any) => SELECTABLE_PLAN_STATUSES.has(plan.status)),
    [plansData?.plans]
  )
  const providers = React.useMemo(() =>
    providersData?.providers || [],
    [providersData?.providers]
  )

  // Filter plans based on selected organization
  const [availablePlans, setAvailablePlans] = useState<any[]>([])

  // Update available plans and auto-populate when organization changes
  React.useEffect(() => {
    // Use selectedOrganizationData if available, as it has the full relation
    const effectiveOrg = selectedOrganizationData || (form.organization_id && organizations.length > 0 ? organizations.find((org: any) => org.id === form.organization_id) : null)

    if (effectiveOrg) {
      if (effectiveOrg.organization_plans && effectiveOrg.organization_plans.length > 0) {
        console.log('✅ [ADD] Found organization_plans:', effectiveOrg.organization_plans.length)
        const orgPlanIds = effectiveOrg.organization_plans.map((op: any) => op.plan_id)
        const filteredPlans = allPlans.filter(
          (plan: any) => orgPlanIds.includes(plan.id) && SELECTABLE_PLAN_STATUSES.has(plan.status)
        )
        setAvailablePlans(filteredPlans)

        // Auto-populate start/end from organization setup if available
        const startDate = effectiveOrg.contact_info?.startDate || ""
        const endDate = effectiveOrg.contact_info?.endDate || ""

        // Auto-select the first available plan if only one is available
        let autoSelectedPlanId = ""
        if (effectiveOrg.organization_plans.length === 1) {
          autoSelectedPlanId = effectiveOrg.organization_plans[0].plan_id
        } else if (form.plan_id && !orgPlanIds.includes(form.plan_id)) {
          // Reset plan selection if current plan is not available
          autoSelectedPlanId = ""
        } else {
          // Keep current plan if it's still available
          autoSelectedPlanId = form.plan_id
        }

        // Only update form if values have actually changed
        setForm(prev => {
          const hasChanges =
            prev.start_date !== (startDate || prev.start_date) ||
            prev.end_date !== (endDate || prev.end_date) ||
            prev.auto_renewal !== true ||
            prev.plan_id !== autoSelectedPlanId

          if (hasChanges) {
            return {
              ...prev,
              start_date: startDate || prev.start_date,
              end_date: endDate || prev.end_date,
              auto_renewal: true,
              plan_id: autoSelectedPlanId
            }
          }
          return prev
        })
      } else {
        setAvailablePlans([])
        setForm(prev => {
          if (prev.plan_id !== "") {
            return { ...prev, plan_id: "" }
          }
          return prev
        })
      }
    } else {
      setAvailablePlans([])
      setForm(prev => {
        if (prev.plan_id !== "") {
          return { ...prev, plan_id: "" }
        }
        return prev
      })
    }
  }, [form.organization_id, organizations, allPlans])

  // Form submission handler - following memos pattern
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent double submission
    if (createPrincipalMutation.isPending) {
      return
    }

    // Validation - following memos pattern
    const missingFields = []
    if (!form.first_name) missingFields.push("First Name")
    if (!form.last_name) missingFields.push("Last Name")
    if (!form.phone_number) missingFields.push("Phone Number")
    if (!form.email) missingFields.push("Email")
    if (!form.residential_address) missingFields.push("Residential Address")
    if (!form.organization_id) missingFields.push("Organization")
    if (!form.plan_id) missingFields.push("Plan")
    if (!form.state) missingFields.push("State")
    if (!form.start_date) missingFields.push("Start Date")
    if (!form.end_date) missingFields.push("End Date")

    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    try {
      let profilePictureUrl = ""

      // Upload profile picture if files are selected
      if (uploadedFiles.length > 0) {
        const formData = new FormData()
        uploadedFiles.forEach((file) => {
          formData.append("files", file)
        })

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!uploadRes.ok) {
          throw new Error("Failed to upload profile picture")
        }

        const uploadResult = await uploadRes.json()
        profilePictureUrl = uploadResult.data[0].secure_url
      }

      // Prepare submit data
      const submitData = {
        ...form,
        account_type: form.account_type ? "PRINCIPAL" : undefined,
        plan_id: form.plan_id === "none" ? "" : form.plan_id,
        profile_picture: profilePictureUrl,
        dependents: dependents.map(dependent => {
          // Split full_name into first_name and last_name
          const nameParts = dependent.full_name.trim().split(' ')
          const first_name = nameParts[0] || ''
          const last_name = nameParts.slice(1).join(' ') || ''

          return {
            ...dependent,
            first_name,
            last_name,
            // Remove full_name as it's not needed in the API
            full_name: undefined,
            // Include preferred_provider_id if set
            preferred_provider_id: dependent.preferred_provider_id || undefined
          }
        }),
      }

      createPrincipalMutation.mutate(submitData)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      })
    }
  }


  return (
    <PermissionGate module="underwriting" action="add">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add Principal Account</h1>
            <p className="text-gray-600">Create a new principal account for an enrollee</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Basic personal details of the principal account holder
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Account Type */}
              <div>
                <Label htmlFor="account_type">Account Type</Label>
                <Select value={form.account_type} onValueChange={(value) => setForm(prev => ({ ...prev, account_type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="FAMILY">Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>


              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(e) => setForm(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="John"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(e) => setForm(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Doe"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="middle_name">Middle Name</Label>
                  <Input
                    id="middle_name"
                    value={form.middle_name}
                    onChange={(e) => setForm(prev => ({ ...prev, middle_name: e.target.value }))}
                    placeholder="Michael"
                  />
                </div>
              </div>

              {/* Date of Birth and Age */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    placeholder="dd-mm-yyyy"
                  />
                </div>

                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    placeholder="auto-calc"
                    value={form.age || ""}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>

              {/* Profile Picture */}
              <div>
                <CompactFileUpload
                  onUpload={setUploadedFiles}
                  onRemove={() => setUploadedFiles([])}
                  acceptedTypes={["image/*"]}
                  maxFiles={1}
                  maxSize={5 * 1024 * 1024} // 5MB
                  folder="profile-pictures"
                  resourceType="image"
                  label="Profile Picture"
                />
              </div>

              {/* Marital Status and Location */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="marital_status">Marital Status</Label>
                  <Select value={form.marital_status} onValueChange={(value) => setForm(prev => ({ ...prev, marital_status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select marital status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE">Single</SelectItem>
                      <SelectItem value="MARRIED">Married</SelectItem>
                      <SelectItem value="DIVORCED">Divorced</SelectItem>
                      <SelectItem value="WIDOWED">Widowed</SelectItem>
                      <SelectItem value="SEPARATED">Separated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>State</Label>
                    <StateSelect
                      value={form.state}
                      onValueChange={(value) => setForm(prev => ({ ...prev, state: value }))}
                      placeholder="Select state"
                      required
                    />
                  </div>
                  <div>
                    <Label>LGA</Label>
                    <LGASelect
                      state={form.state}
                      value={form.lga}
                      onValueChange={(value) => setForm(prev => ({ ...prev, lga: value }))}
                      placeholder="Select LGA"
                    />
                  </div>
                  <div>
                    <Label htmlFor="business_type">Business Type</Label>
                    <Input
                      id="business_type"
                      value={form.business_type}
                      onChange={(e) => setForm(prev => ({ ...prev, business_type: e.target.value }))}
                      placeholder="Enter business type"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={form.region}
                    onValueChange={(value) => setForm(prev => ({ ...prev, region: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="North Central">North Central</SelectItem>
                      <SelectItem value="North East">North East</SelectItem>
                      <SelectItem value="North West">North West</SelectItem>
                      <SelectItem value="South East">South East</SelectItem>
                      <SelectItem value="South South">South South</SelectItem>
                      <SelectItem value="South West">South West</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-600" />
                Contact Information
              </CardTitle>
              <CardDescription>
                Contact details for the principal account holder
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone_number">Phone Number*</Label>
                  <Input
                    id="phone_number"
                    value={form.phone_number}
                    onChange={(e) => setForm(prev => ({ ...prev, phone_number: e.target.value }))}
                    placeholder="+234 801 234 5678"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address*</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john.doe@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="residential_address">Residential Address*</Label>
                <Textarea
                  id="residential_address"
                  value={form.residential_address}
                  onChange={(e) => setForm(prev => ({ ...prev, residential_address: e.target.value }))}
                  placeholder="Enter full residential address..."
                  className="min-h-[100px]"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Organization Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Organization Information
              </CardTitle>
              <CardDescription>
                Organization and plan details for the principal account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="organization_id">Organization Name *</Label>
                <Popover open={openOrg} onOpenChange={setOpenOrg}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openOrg}
                      className="w-full justify-between"
                    >
                      {form.organization_id
                        ? organizationsData?.organizations?.find((org: any) => org.id === form.organization_id)?.name
                        : "Select organization..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search organization..." />
                      <CommandList>
                        <CommandEmpty>No organization found.</CommandEmpty>
                        <CommandGroup>
                          {organizationsData?.organizations?.map((org: any) => (
                            <CommandItem
                              key={org.id}
                              value={org.name}
                              className="data-[disabled]:opacity-100 data-[disabled]:pointer-events-auto cursor-pointer"
                              onSelect={() => {
                                const value = org.id // Use ID for logic

                                // Auto-populate organization data logic (copied from previous Select)
                                const selectedOrg = organizationsData?.organizations?.find((o: any) => o.id === value)
                                if (selectedOrg) {
                                  let autoSelectedPlanId = ""
                                  if (selectedOrg.organization_plans && selectedOrg.organization_plans.length === 1) {
                                    autoSelectedPlanId = selectedOrg.organization_plans[0].plan_id
                                  }

                                  const startDate = selectedOrg.contact_info?.startDate || ""
                                  const endDate = selectedOrg.contact_info?.endDate || ""

                                  setForm(prev => ({
                                    ...prev,
                                    organization_id: value,
                                    plan_id: autoSelectedPlanId,
                                    start_date: startDate || prev.start_date,
                                    end_date: endDate || prev.end_date,
                                    auto_renewal: true
                                  }))
                                } else {
                                  setForm(prev => ({ ...prev, organization_id: value }))
                                }
                                setOpenOrg(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.organization_id === org.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {org.name} ({org.code})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plan_id">Plan *</Label>
                  <Select
                    value={form.plan_id}
                    onValueChange={(value) => setForm(prev => ({ ...prev, plan_id: value }))}
                    disabled={availablePlans.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        availablePlans.length === 0
                          ? "Select organization first"
                          : "Select plan"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlans.map((plan: any) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - ₦{plan.premium_amount.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availablePlans.length === 0 && form.organization_id && (
                    <p className="text-sm text-amber-600 mt-1">
                      No plans available for this organization
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.auto_renewal}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, auto_renewal: checked as boolean }))}
                  />
                  <Label>Auto Renewal</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hospital Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hospital className="h-5 w-5 text-blue-600" />
                Hospital Information
              </CardTitle>
              <CardDescription>
                Primary hospital and medical facility details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="primary_hospital">Search Hospital</Label>
                <div className="relative">
                  <Input
                    id="primary_hospital"
                    placeholder="Search hospital by name..."
                    value={form.primary_hospital}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, primary_hospital: e.target.value }))
                      setShowHospitalDropdown(e.target.value.length > 0)
                    }}
                    onFocus={() => setShowHospitalDropdown(form.primary_hospital.length > 0)}
                    className="pr-10"
                    data-hospital-dropdown
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                </div>
                {/* Hospital suggestions dropdown */}
                {showHospitalDropdown && form.primary_hospital && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-md bg-white shadow-lg z-10" data-hospital-dropdown>
                    {/* Show all providers that match the search */}
                    {providers.filter((provider: any) =>
                      provider.facility_name.toLowerCase().includes(form.primary_hospital.toLowerCase())
                    ).slice(0, 10).map((provider: any) => (
                      <div
                        key={provider.id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => {
                          setForm(prev => ({ ...prev, primary_hospital: provider.facility_name }))
                          setShowHospitalDropdown(false)
                        }}
                      >
                        {provider.facility_name}
                      </div>
                    ))}
                    {providers.filter((provider: any) =>
                      provider.facility_name.toLowerCase().includes(form.primary_hospital.toLowerCase())
                    ).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          No providers found matching "{form.primary_hospital}"
                        </div>
                      )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Dependents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Add Dependents
              </CardTitle>
              <CardDescription>
                Add dependent family members to the principal account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dependents.map((dependent, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-4 p-4 border rounded-lg">
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      placeholder="Full Name"
                      value={dependent.full_name}
                      onChange={(e) => updateDependent(index, "full_name", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={dependent.date_of_birth}
                      onChange={(e) => updateDependent(index, "date_of_birth", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Age (auto calc)</Label>
                    <Input
                      placeholder="auto calc"
                      value={dependent.age || ""}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>

                  <div>
                    <Label>Gender</Label>
                    <Select
                      value={dependent.gender}
                      onValueChange={(value) => updateDependent(index, "gender", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Relationship</Label>
                    <Select
                      value={dependent.relationship}
                      onValueChange={(value) => updateDependent(index, "relationship", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SPOUSE">Spouse</SelectItem>
                        <SelectItem value="SON">Son</SelectItem>
                        <SelectItem value="DAUGHTER">Daughter</SelectItem>
                        <SelectItem value="PARENT">Parent</SelectItem>
                        <SelectItem value="SIBLING">Sibling</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                        <SelectItem value="EXTRA_DEPENDENT">Extra Dependent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Preferred Provider/Hospital</Label>
                    <Select
                      value={dependent.preferred_provider_id || undefined}
                      onValueChange={(value) => updateDependent(index, "preferred_provider_id", value === "NONE" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">None</SelectItem>
                        {providers.map((provider: any) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.facility_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeDependent(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addDependent}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Dependent
              </Button>
            </CardContent>
          </Card>

          {/* Medical History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hospital className="h-5 w-5 text-blue-600" />
                Medical History
              </CardTitle>
              <CardDescription>
                Select any medical conditions that apply
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.sickle_cell_disease}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, sickle_cell_disease: checked as boolean }))}
                  />
                  <Label>Sickle Cell Disease</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.kidney_disease}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, kidney_disease: checked as boolean }))}
                  />
                  <Label>Kidney Disease</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.epilepsy}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, epilepsy: checked as boolean }))}
                  />
                  <Label>Epilepsy</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.cancer_prostate_cervical}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, cancer_prostate_cervical: checked as boolean }))}
                  />
                  <Label>Cancer (Prostate Cervical)</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.asthma}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, asthma: checked as boolean }))}
                  />
                  <Label>Asthma</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.hiv_aids}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, hiv_aids: checked as boolean }))}
                  />
                  <Label>HIV/AIDS</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.surgeries}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, surgeries: checked as boolean }))}
                  />
                  <Label>Surgeries</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.diabetes_mellitus}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, diabetes_mellitus: checked as boolean }))}
                  />
                  <Label>Diabetes Mellitus</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.cataract}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, cataract: checked as boolean }))}
                  />
                  <Label>Cataract</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.goiter}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, goiter: checked as boolean }))}
                  />
                  <Label>Goiter</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.peptic_ulcer}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, peptic_ulcer: checked as boolean }))}
                  />
                  <Label>Peptic Ulcer</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.hypertension}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, hypertension: checked as boolean }))}
                  />
                  <Label>Hypertension</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.glaucoma}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, glaucoma: checked as boolean }))}
                  />
                  <Label>Glaucoma</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.tuberculosis}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, tuberculosis: checked as boolean }))}
                  />
                  <Label>Tuberculosis</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.haemorrhoids}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, haemorrhoids: checked as boolean }))}
                  />
                  <Label>Haemorrhoids</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={form.hepatitis}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, hepatitis: checked as boolean }))}
                  />
                  <Label>Hepatitis</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="disease_comments">Add Disease Comment</Label>
                <Textarea
                  id="disease_comments"
                  value={form.disease_comments}
                  onChange={(e) => setForm(prev => ({ ...prev, disease_comments: e.target.value }))}
                  placeholder="Add any additional comments about medical conditions..."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2"
            >
              <ArrowUp className="h-4 w-4" />
              Scroll to Top
            </Button>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPrincipalMutation.isPending}
                className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
              >
                {createPrincipalMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </PermissionGate>
  )
}
