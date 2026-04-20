"use client"

export const dynamic = 'force-dynamic'

import React, { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ArrowLeft, Save, User, Building2, Calendar, Phone, Mail, MapPin, Hospital, Upload } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { CompactFileUpload } from "@/components/ui/compact-file-upload"



const principalSchema = z.object({
  enrollee_id: z.string().min(1, "Enrollee ID is required"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  middle_name: z.string().optional(),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  residential_address: z.string().optional(),
  profile_picture: z.string().optional(),
  organization_id: z.string().min(1, "Organization is required"),
  plan_id: z.string().optional(),
  account_type: z.string().min(1, "Account type is required"),
  primary_hospital: z.string().optional(),
  hospital_address: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

type PrincipalFormData = z.infer<typeof principalSchema>

interface Organization {
  id: string
  name: string
  code: string
  organization_code?: string
  contact_info?: any
  organization_plans?: Array<{
    id: string
    plan_id: string
    is_default: boolean
    plan: {
      id: string
      name: string
      plan_type?: string
    }
  }>
}

interface Plan {
  id: string
  name: string
  premium_amount?: number
  plan_id?: string
}

interface Principal {
  id: string
  enrollee_id: string
  first_name: string
  last_name: string
  middle_name?: string
  gender?: string
  date_of_birth?: string
  phone_number?: string
  email?: string
  residential_address?: string
  profile_picture?: string
  organization_id: string
  plan_id?: string
  account_type: string
  primary_hospital?: string
  hospital_address?: string
  start_date?: string
  end_date?: string
  status: string
  organization?: {
    id: string
    name: string
    code: string
  }
  plan?: {
    id: string
    plan_id?: string
    name: string
    premium_amount?: number
  }
}

export default function EditPrincipalPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { id } = params
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [currentPictureUrl, setCurrentPictureUrl] = useState<string>("")
  const form = useForm<PrincipalFormData>({
    resolver: zodResolver(principalSchema),
    defaultValues: {
      enrollee_id: "",
      first_name: "",
      last_name: "",
      middle_name: "",
      gender: "",
      date_of_birth: "",
      phone_number: "",
      email: "",
      residential_address: "",
      profile_picture: "",
      organization_id: "",
      plan_id: "",
      account_type: "",
      primary_hospital: "",
      hospital_address: "",
      start_date: "",
      end_date: "",
    },
  })

  // Fetch principal data
  const {
    data: principal,
    isLoading: isLoadingPrincipal,
    error: principalError,
  } = useQuery({
    queryKey: ["principal", id],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/principals/${id}`)
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to fetch principal")
      }
      return res.json()
    },
    enabled: !!id,
  })

  // Fetch organizations
  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations?limit=10000")
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
      const res = await fetch("/api/underwriting/plans?limit=10000&status=all")
      if (!res.ok) {
        throw new Error("Failed to fetch plans")
      }
      return res.json()
    },
  })

  // Update principal mutation
  const updatePrincipalMutation = useMutation({
    mutationFn: async (data: PrincipalFormData) => {
      const res = await fetch(`/api/underwriting/principals/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update principal")
      }

      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Principal Updated",
        description: "Principal account has been successfully updated.",
      })
      queryClient.invalidateQueries({ queryKey: ["principals"] })
      queryClient.invalidateQueries({ queryKey: ["principal", id] })
      router.push("/underwriting/principals")
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Principal",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Populate form when principal data is loaded
  useEffect(() => {
    if (principal) {
      // Helper function to format date for input field
      const formatDateForInput = (date: any): string => {
        if (!date) return ""
        // If it's already a string in YYYY-MM-DD format, return it
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date
        }
        // If it's a Date object or ISO string, convert it
        try {
          const dateObj = date instanceof Date ? date : new Date(date)
          if (!isNaN(dateObj.getTime())) {
            return dateObj.toISOString().split('T')[0]
          }
        } catch (e) {
          console.error('Error formatting date:', e)
        }
        return ""
      }

      form.reset({
        enrollee_id: principal.enrollee_id || "",
        first_name: principal.first_name || "",
        last_name: principal.last_name || "",
        middle_name: principal.middle_name || "",
        gender: principal.gender || "",
        date_of_birth: formatDateForInput(principal.date_of_birth),
        phone_number: principal.phone_number || "",
        email: principal.email || "",
        residential_address: principal.residential_address || "",
        profile_picture: principal.profile_picture || "",
        organization_id: principal.organization?.id || principal.organization_id || "",
        plan_id: principal.plan?.id || principal.plan_id || principal.plan?.plan_id || "none",
        account_type: normalizeAccountType(principal.account_type || "PRINCIPAL") || "PRINCIPAL",
        primary_hospital: principal.primary_hospital || "",
        hospital_address: principal.hospital_address || "",
        start_date: formatDateForInput(principal.start_date),
        end_date: formatDateForInput(principal.end_date),
      })
      setCurrentPictureUrl(principal.profile_picture || "")
    }
  }, [principal, form])

  useEffect(() => {
    if (!principal) return

    const currentOrgId = principal.organization?.id || principal.organization_id || ""
    const currentPlanId = principal.plan?.id || principal.plan_id || principal.plan?.plan_id || "none"

    if (!form.getValues("organization_id") && currentOrgId) {
      form.setValue("organization_id", currentOrgId)
    }

    const existingPlanValue = form.getValues("plan_id")
    if ((!existingPlanValue || existingPlanValue === "") && currentPlanId) {
      form.setValue("plan_id", currentPlanId)
    }
  }, [principal, form])

  const organizations: Organization[] = organizationsData?.organizations || []
  const allPlans: Plan[] = plansData?.plans || []
  const watchedOrganizationId = useWatch({ control: form.control, name: "organization_id" })
  const role = (session?.user?.role || "").toString().toUpperCase()
  const canEditEnrolleeId = ["ADMIN", "SUPER_ADMIN"].includes(role)
  const normalizeAccountType = (value?: string) => {
    const normalized = (value || "").trim().toUpperCase()
    return normalized === "PRINCIPAL" ? "PRINCIPAL" : ""
  }

  const organizationsWithCurrent = useMemo(() => {
    if (!principal) return organizations

    const effectiveOrgId = principal.organization_id || principal.organization?.id
    if (!effectiveOrgId) return organizations

    const exists = organizations.some((org) => org.id === effectiveOrgId)
    if (exists) return organizations

    return [
      {
        id: effectiveOrgId,
        name: principal.organization?.name || "Current Organization",
        code: principal.organization?.code || "N/A",
        organization_plans: [],
      } as Organization,
      ...organizations,
    ]
  }, [organizations, principal])

  const allPlansWithCurrent = useMemo(() => {
    if (!principal) return allPlans

    const currentPlanId = principal.plan?.id || principal.plan_id || principal.plan?.plan_id
    if (!currentPlanId) return allPlans

    const exists = allPlans.some((plan: any) => plan.id === currentPlanId || plan.plan_id === currentPlanId)
    if (exists) return allPlans

    return [
      {
        id: principal.plan?.id || currentPlanId,
        plan_id: currentPlanId,
        name: principal.plan?.name || "Current Plan",
        premium_amount: Number(principal.plan?.premium_amount || 0),
      } as Plan,
      ...allPlans,
    ]
  }, [allPlans, principal])

  const normalizedCurrentOrganizationId = useMemo(() => {
    if (!principal) return ""

    const candidateOrgValue = principal.organization?.id || principal.organization_id || principal.organization?.code || ""
    if (!candidateOrgValue) return ""

    return (
      organizationsWithCurrent.find((org: any) =>
        org.id === candidateOrgValue ||
        org.code === candidateOrgValue ||
        org.organization_code === candidateOrgValue ||
        org.organization_id === candidateOrgValue
      )?.id || candidateOrgValue
    )
  }, [principal, organizationsWithCurrent])

  const normalizedCurrentPlanId = useMemo(() => {
    if (!principal) return "none"
    const candidatePlanValue = principal.plan?.id || principal.plan_id || principal.plan?.plan_id || ""
    if (!candidatePlanValue) return "none"
    return (
      allPlansWithCurrent.find((plan: any) => plan.id === candidatePlanValue || plan.plan_id === candidatePlanValue)?.id ||
      candidatePlanValue
    )
  }, [principal, allPlansWithCurrent])

  const selectedOrganizationId = watchedOrganizationId || normalizedCurrentOrganizationId || ""

  // Normalize legacy org/plan identifiers to canonical IDs once options are loaded.
  useEffect(() => {
    if (!principal) return

    const currentOrgValue = form.getValues("organization_id")
    const candidateOrgValue = currentOrgValue || principal.organization?.id || principal.organization_id || ""
    const normalizedOrg = organizationsWithCurrent.find((org: any) =>
      org.id === candidateOrgValue ||
      org.code === candidateOrgValue ||
      org.organization_code === candidateOrgValue ||
      org.organization_id === candidateOrgValue
    )?.id || candidateOrgValue

    if (normalizedOrg && normalizedOrg !== currentOrgValue) {
      form.setValue("organization_id", normalizedOrg, { shouldDirty: false })
    }

    const currentPlanValue = form.getValues("plan_id")
    const candidatePlanValue =
      currentPlanValue && currentPlanValue !== "none"
        ? currentPlanValue
        : principal.plan?.id || principal.plan_id || principal.plan?.plan_id || ""

    const normalizedPlan = allPlansWithCurrent.find((plan: any) =>
      plan.id === candidatePlanValue || plan.plan_id === candidatePlanValue
    )?.id || candidatePlanValue

    const nextPlanValue = normalizedPlan || "none"
    if (nextPlanValue !== currentPlanValue) {
      form.setValue("plan_id", nextPlanValue, { shouldDirty: false })
    }

    const currentAccountType = form.getValues("account_type")
    const normalizedAccountType = normalizeAccountType(currentAccountType || principal.account_type || "PRINCIPAL")
    if (normalizedAccountType && normalizedAccountType !== currentAccountType) {
      form.setValue("account_type", normalizedAccountType, { shouldDirty: false })
    }
  }, [principal, organizationsWithCurrent, allPlansWithCurrent, form])

  // Filter plans based on selected organization
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([])

  // Initialize available plans when principal data loads
  useEffect(() => {
    if (!selectedOrganizationId) {
      setAvailablePlans([])
      return
    }

    const selectedOrg = organizationsWithCurrent.find((org: any) => org.id === selectedOrganizationId)
    const currentStartDate = form.getValues("start_date")
    const currentEndDate = form.getValues("end_date")
    const orgStartDate = selectedOrg?.contact_info?.startDate || ""
    const orgEndDate = selectedOrg?.contact_info?.endDate || ""
    if (!currentStartDate && orgStartDate) {
      form.setValue("start_date", orgStartDate, { shouldDirty: false })
    }
    if (!currentEndDate && orgEndDate) {
      form.setValue("end_date", orgEndDate, { shouldDirty: false })
    }

    if (selectedOrg?.organization_plans && selectedOrg.organization_plans.length > 0) {
      const orgPlanIds = selectedOrg.organization_plans.map((op: any) => op.plan_id)
      const filteredPlans = allPlansWithCurrent.filter(
        (plan: any) => orgPlanIds.includes(plan.id) || orgPlanIds.includes(plan.plan_id)
      )
      setAvailablePlans(filteredPlans)
      return
    }

    // Fallback: if org plans are missing, still show the principal's current plan.
    const principalOrganizationCandidates = [
      principal?.organization?.id,
      principal?.organization_id,
      principal?.organization?.code,
    ].filter((value): value is string => Boolean(value))

    if (principalOrganizationCandidates.includes(selectedOrganizationId)) {
      const byPrincipalPlanId = allPlansWithCurrent.find(
        (plan: any) => plan.id === principal.plan_id || plan.plan_id === principal.plan_id
      )

      if (byPrincipalPlanId) {
        setAvailablePlans([byPrincipalPlanId as Plan])
        return
      }

      if (principal?.plan) {
        setAvailablePlans([principal.plan as Plan])
        return
      }
    }

    if (principal?.plan && principal.organization?.id === selectedOrganizationId) {
      setAvailablePlans([principal.plan as Plan])
      return
    }

    setAvailablePlans([])
  }, [selectedOrganizationId, organizationsWithCurrent, allPlansWithCurrent, principal])

  // Ensure current plan is always present in selectable plans for edit flow
  useEffect(() => {
    const currentPlanId = form.getValues("plan_id")
    if (!currentPlanId || currentPlanId === "none") return
    if (availablePlans.some((plan: any) => plan.id === currentPlanId || plan.plan_id === currentPlanId)) return

    const currentPlan = allPlansWithCurrent.find(
      (plan: any) => plan.id === currentPlanId || plan.plan_id === currentPlanId
    )

    if (currentPlan) {
      setAvailablePlans((prev) => {
        if (prev.some((plan: any) => plan.id === currentPlan.id || plan.plan_id === currentPlan.plan_id)) {
          return prev
        }
        return [currentPlan as Plan, ...prev]
      })
    }
  }, [allPlansWithCurrent, availablePlans, form])

  const onSubmit = async (data: PrincipalFormData) => {
    // Prevent double submission
    if (updatePrincipalMutation.isPending) {
      return
    }

    // Handle profile picture upload
    let profilePictureUrl = currentPictureUrl
    if (uploadedFiles.length > 0) {
      const formData = new FormData()
      uploadedFiles.forEach((file) => {
        formData.append("files", file)
      })
      formData.append("folder", "principal_profiles")
      formData.append("resourceType", "image")

      try {
        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        const uploadResult = await uploadResponse.json()
        if (uploadResult.data?.[0]?.secure_url) {
          profilePictureUrl = uploadResult.data[0].secure_url
        }
      } catch (error) {
        console.error("Error uploading profile picture:", error)
        toast({
          title: "Upload Error",
          description: "Failed to upload profile picture. Please try again.",
          variant: "destructive",
        })
        return
      }
    }

    // Convert "none" back to empty string for API
    const submitData = {
      ...data,
      plan_id: data.plan_id === "none" ? "" : data.plan_id,
      profile_picture: profilePictureUrl,
    }
    updatePrincipalMutation.mutate(submitData)
  }

  if (isLoadingPrincipal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (principalError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Error loading principal: {(principalError as Error).message}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  if (!principal) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">Principal not found</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  return (
    <PermissionGate module="underwriting" action="edit">
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
            <h1 className="text-3xl font-bold text-gray-900">Edit Principal Account</h1>
            <p className="text-gray-600">
              Update principal account for {principal.first_name} {principal.last_name}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="enrollee_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Enrollee ID</FormLabel>
                        <FormControl>
                          <Input placeholder="CJH/CC/001" {...field} disabled={!canEditEnrolleeId} />
                        </FormControl>
                        <FormDescription>
                          {canEditEnrolleeId
                            ? "Admins can edit Enrollee ID. If it already exists, save will fail with a duplicate warning."
                            : "Only admins can edit Enrollee ID."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="middle_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Middle Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Michael" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MALE">Male</SelectItem>
                            <SelectItem value="FEMALE">Female</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date_of_birth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+234 801 234 5678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john.doe@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="residential_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residential Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter full residential address..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Profile Picture
                  </label>
                  {currentPictureUrl && uploadedFiles.length === 0 && (
                    <div className="mb-2 p-2 border rounded">
                      <p className="text-sm text-muted-foreground mb-1">Current Picture:</p>
                      <img
                        src={currentPictureUrl}
                        alt="Current profile"
                        className="w-24 h-24 object-cover rounded"
                      />
                    </div>
                  )}
                  <CompactFileUpload
                    onUpload={setUploadedFiles}
                    onRemove={() => setUploadedFiles([])}
                    acceptedTypes={["image/png", "image/jpeg", "image/jpg"]}
                    maxFiles={1}
                    maxSize={5 * 1024 * 1024}
                    folder="principal_profiles"
                    resourceType="image"
                    label="Upload a new profile picture (PNG, JPG - Max 5MB)"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Organization and Plan Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Organization & Plan Information
                </CardTitle>
                <CardDescription>
                  Organization and plan details for the principal account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="organization_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization</FormLabel>
                        <Select onValueChange={(value) => {
                          const selectedOrg = organizationsWithCurrent.find((org) => org.id === value) as any

                          // Update form field
                          field.onChange(value)

                          // Filter and set available plans immediately
                          if (selectedOrg && selectedOrg.organization_plans && selectedOrg.organization_plans.length > 0) {
                            const orgPlanIds = selectedOrg.organization_plans.map((op: any) => op.plan_id)
                            const filteredPlans = allPlansWithCurrent.filter(
                              (plan: any) => orgPlanIds.includes(plan.id) || (plan.plan_id ? orgPlanIds.includes(plan.plan_id) : false)
                            )
                            setAvailablePlans(filteredPlans)

                            const startDateFromOrg = selectedOrg.contact_info?.startDate || ""
                            const endDateFromOrg = selectedOrg.contact_info?.endDate || ""
                            if (startDateFromOrg) {
                              form.setValue("start_date", startDateFromOrg)
                            }
                            if (endDateFromOrg) {
                              form.setValue("end_date", endDateFromOrg)
                            }

                            // Auto-select the first available plan if only one is available
                            if (selectedOrg.organization_plans.length === 1) {
                              form.setValue('plan_id', selectedOrg.organization_plans[0].plan_id)
                            } else {
                              // Reset plan selection if current plan is not available
                              const currentPlanId = form.getValues('plan_id')
                              const currentPlan = allPlansWithCurrent.find(
                                (plan: any) => plan.id === currentPlanId || plan.plan_id === currentPlanId
                              )
                              const currentPlanBackendId = currentPlan?.id || currentPlan?.plan_id || currentPlanId
                              if (currentPlanId && currentPlanId !== "none" && !orgPlanIds.includes(currentPlanBackendId)) {
                                form.setValue('plan_id', "none")
                              }
                            }
                          } else {
                            setAvailablePlans([])
                            form.setValue('plan_id', "none")
                          }
                        }} value={field.value || normalizedCurrentOrganizationId || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select organization" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {organizationsWithCurrent.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name} ({org.code || org.organization_code || "N/A"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plan_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || normalizedCurrentPlanId || "none"}
                          disabled={availablePlans.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={
                                availablePlans.length === 0
                                  ? "Select organization first"
                                  : "Select plan (optional)"
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Plan</SelectItem>
                            {availablePlans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} - ₦{Number(plan.premium_amount || 0).toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {availablePlans.length === 0 && form.getValues('organization_id') && (
                          <p className="text-sm text-amber-600 mt-1">
                            No plans available for this organization
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="account_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={normalizeAccountType(field.value || principal?.account_type || "PRINCIPAL")}
                        >
                          <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PRINCIPAL">Principal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                <FormField
                  control={form.control}
                  name="primary_hospital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Hospital</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter primary hospital name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hospital_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hospital Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter hospital address..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

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
                disabled={updatePrincipalMutation.isPending}
                className="bg-[#0891B2] hover:bg-[#9B1219]"
              >
                {updatePrincipalMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Principal Account
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </PermissionGate>
  )
}
