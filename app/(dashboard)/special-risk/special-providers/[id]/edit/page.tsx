"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUpload } from "@/components/ui/file-upload"
import { ArrowLeft, Save, Building2, CreditCard, FileText } from "lucide-react"
import Link from "next/link"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useFileUpload } from "@/hooks/use-file-upload"

export default function EditSpecialProviderPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch provider data
  const { data: providerData, isLoading } = useQuery({
    queryKey: ["special-provider", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/special-risk/providers/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch provider")
      return res.json()
    },
  })

  const provider = providerData?.data

  // Fetch form options
  const { data: formOptions } = useQuery({
    queryKey: ["special-provider-form-options"],
    queryFn: async () => {
      const res = await fetch("/api/special-risk/providers/add")
      if (!res.ok) throw new Error("Failed to fetch form options")
      return res.json()
    },
  })

  // Fetch organizations
  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations?limit=1000")
      if (!res.ok) throw new Error("Failed to fetch organizations")
      return res.json()
    },
  })

  const organizations = organizationsData?.organizations || []

  // File upload hooks
  const { uploadSingleFile } = useFileUpload({
    folder: "special-providers/documents",
    resourceType: "auto",
  })

  const { uploadSingleFile: uploadServiceAgreement } = useFileUpload({
    folder: "special-providers/documents",
    resourceType: "auto",
  })

  const [form, setForm] = useState({
    organization_id: "",
    company_name: "",
    country: "",
    currency: "",
    exchange_rate_source: "",
    contact_person_name: "",
    contact_email: "",
    contact_phone: "",
    company_address: "",
    website: "",
    business_registration_number: "",
    license_document_url: "",
    service_agreement_url: "",
    tax_id_number: "",
    bank_name: "",
    bank_country: "",
    account_number: "",
    swift_code: "",
    preferred_payment_method: "",
    default_exchange_rate: "",
    internal_notes: "",
  })

  // Service details state
  const [serviceDetails, setServiceDetails] = useState({
    hospital_type: "",
    available_services: [] as string[],
    coverage_area: "",
    service_types: [] as string[],
    service_type: "",
    coverage_area_logistics: "",
  })

  // Initialize form when provider data loads
  useEffect(() => {
    if (provider) {
      const serviceDetailsData = provider.service_details || {}
      setForm({
        organization_id: provider.organization_id || "",
        company_name: provider.company_name || "",
        country: provider.country || "",
        currency: provider.currency || "",
        exchange_rate_source: provider.exchange_rate_source || "",
        contact_person_name: provider.contact_person_name || "",
        contact_email: provider.contact_email || "",
        contact_phone: provider.contact_phone || "",
        company_address: provider.company_address || "",
        website: provider.website || "",
        business_registration_number: provider.business_registration_number || "",
        license_document_url: provider.license_document_url || "",
        service_agreement_url: provider.service_agreement_url || "",
        tax_id_number: provider.tax_id_number || "",
        bank_name: provider.bank_name || "",
        bank_country: provider.bank_country || "",
        account_number: provider.account_number || "",
        swift_code: provider.swift_code || "",
        preferred_payment_method: provider.preferred_payment_method || "",
        default_exchange_rate: provider.default_exchange_rate?.toString() || "",
        internal_notes: provider.internal_notes || "",
      })

      if (provider.organization_type === "FOREIGN_PROVIDER") {
        setServiceDetails({
          hospital_type: serviceDetailsData.hospital_type || "",
          available_services: serviceDetailsData.available_services || [],
          coverage_area: "",
          service_types: [],
          service_type: "",
          coverage_area_logistics: "",
        })
      } else if (provider.organization_type === "AMBULANCE_COMPANY") {
        setServiceDetails({
          hospital_type: "",
          available_services: [],
          coverage_area: serviceDetailsData.coverage_area || "",
          service_types: serviceDetailsData.service_types || [],
          service_type: "",
          coverage_area_logistics: "",
        })
      } else if (provider.organization_type === "LOGISTICS_COMPANY") {
        setServiceDetails({
          hospital_type: "",
          available_services: [],
          coverage_area: "",
          service_types: [],
          service_type: serviceDetailsData.service_type || "",
          coverage_area_logistics: serviceDetailsData.coverage_area || "",
        })
      }
    }
  }, [provider])

  // Handle license document upload
  const handleLicenseUpload = async (files: File[]) => {
    if (files.length === 0) return
    const file = files[0]
    try {
      const result = await uploadSingleFile(file)
      setForm((prev) => ({ ...prev, license_document_url: result.secure_url }))
      toast({
        title: "Success",
        description: "License document uploaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload license document",
        variant: "destructive",
      })
    }
  }

  // Handle service agreement upload
  const handleServiceAgreementUpload = async (files: File[]) => {
    if (files.length === 0) return
    const file = files[0]
    try {
      const result = await uploadServiceAgreement(file)
      setForm((prev) => ({ ...prev, service_agreement_url: result.secure_url }))
      toast({
        title: "Success",
        description: "Service agreement uploaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload service agreement",
        variant: "destructive",
      })
    }
  }

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/special-risk/providers/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        const errorMessage = error.details 
          ? `${error.error || "Validation failed"}: ${JSON.stringify(error.details)}`
          : error.error || "Failed to update special provider"
        throw new Error(errorMessage)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-provider", params.id] })
      queryClient.invalidateQueries({ queryKey: ["special-providers"] })
      toast({
        title: "Success",
        description: "Special provider updated successfully",
      })
      router.push(`/special-risk/special-providers/${params.id}`)
    },
    onError: (error: Error) => {
      console.error("Update error:", error)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!provider) return

    // Build service_details based on organization type
    let serviceDetailsPayload: any = {}
    if (provider.organization_type === "FOREIGN_PROVIDER") {
      serviceDetailsPayload = {
        hospital_type: serviceDetails.hospital_type,
        available_services: serviceDetails.available_services,
      }
    } else if (provider.organization_type === "AMBULANCE_COMPANY") {
      serviceDetailsPayload = {
        coverage_area: serviceDetails.coverage_area,
        service_types: serviceDetails.service_types,
      }
    } else if (provider.organization_type === "LOGISTICS_COMPANY") {
      serviceDetailsPayload = {
        service_type: serviceDetails.service_type,
        coverage_area: serviceDetails.coverage_area_logistics,
      }
    }

    const payload: any = {
      organization_id: form.organization_id && form.organization_id.trim() ? form.organization_id.trim() : undefined,
      company_name: form.company_name && form.company_name.trim() ? form.company_name.trim() : undefined,
      country: form.country && form.country.trim() ? form.country.trim() : undefined,
      currency: form.currency && form.currency.trim() ? form.currency.trim() : undefined,
      exchange_rate_source: form.exchange_rate_source || undefined,
      contact_person_name: form.contact_person_name && form.contact_person_name.trim() ? form.contact_person_name.trim() : undefined,
      contact_email: form.contact_email && form.contact_email.trim() ? form.contact_email.trim() : undefined,
      contact_phone: form.contact_phone && form.contact_phone.trim() ? form.contact_phone.trim() : undefined,
      company_address: form.company_address && form.company_address.trim() ? form.company_address.trim() : undefined,
      website: form.website && form.website.trim() ? form.website.trim() : "",
      business_registration_number: form.business_registration_number && form.business_registration_number.trim() ? form.business_registration_number.trim() : undefined,
      license_document_url: form.license_document_url && form.license_document_url.trim() ? form.license_document_url.trim() : "",
      service_agreement_url: form.service_agreement_url && form.service_agreement_url.trim() ? form.service_agreement_url.trim() : "",
      tax_id_number: form.tax_id_number && form.tax_id_number.trim() ? form.tax_id_number.trim() : undefined,
      bank_name: form.bank_name && form.bank_name.trim() ? form.bank_name.trim() : undefined,
      bank_country: form.bank_country && form.bank_country.trim() ? form.bank_country.trim() : undefined,
      account_number: form.account_number && form.account_number.trim() ? form.account_number.trim() : undefined,
      swift_code: form.swift_code && form.swift_code.trim() ? form.swift_code.trim() : undefined,
      preferred_payment_method: form.preferred_payment_method && form.preferred_payment_method.trim() ? form.preferred_payment_method.trim() : undefined,
      service_details: serviceDetailsPayload,
      default_exchange_rate: form.default_exchange_rate && form.default_exchange_rate.trim() ? parseFloat(form.default_exchange_rate) : undefined,
      internal_notes: form.internal_notes && form.internal_notes.trim() ? form.internal_notes.trim() : undefined,
    }

    // Remove undefined values (but keep empty strings for URL fields)
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key]
      }
    })

    updateMutation.mutate(payload)
  }

  const handleServiceCheckbox = (service: string, checked: boolean) => {
    if (provider?.organization_type === "FOREIGN_PROVIDER") {
      setServiceDetails((prev) => ({
        ...prev,
        available_services: checked
          ? [...prev.available_services, service]
          : prev.available_services.filter((s) => s !== service),
      }))
    } else if (provider?.organization_type === "AMBULANCE_COMPANY") {
      setServiceDetails((prev) => ({
        ...prev,
        service_types: checked
          ? [...prev.service_types, service]
          : prev.service_types.filter((s) => s !== service),
      }))
    }
  }

  const options = formOptions?.data || {}

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!provider) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Provider not found</p>
        <Link href="/special-risk/special-providers">
          <Button variant="outline" className="mt-4">
            Back to International Coverage
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/special-risk/special-providers/${params.id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Special Provider</h1>
            <p className="text-muted-foreground">Provider ID: {provider.provider_id}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organization Selection (Optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Link to Existing Organization (Optional)
            </CardTitle>
            <CardDescription>Select an existing organization to link this special provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="organization_id">Organization</Label>
              <Select
                value={form.organization_id || "none"}
                onValueChange={(value) => setForm((prev) => ({ ...prev, organization_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - Create New</SelectItem>
                  {organizations.map((org: any) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.organization_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>Company and contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="organization_type">Organization Type</Label>
                <Input
                  id="organization_type"
                  value={provider.organization_type?.replace(/_/g, " ") || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">Cannot be changed after creation</p>
              </div>

              <div>
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={form.currency}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, currency: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.currencies?.map((curr: string) => (
                      <SelectItem key={curr} value={curr}>
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="exchange_rate_source">Exchange Rate Source *</Label>
                <Select
                  value={form.exchange_rate_source}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, exchange_rate_source: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select exchange rate source" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.exchange_rate_sources?.map((source: any) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.exchange_rate_source && form.exchange_rate_source !== "AUTOMATIC_API" && (
                <div>
                  <Label htmlFor="default_exchange_rate">Default Exchange Rate</Label>
                  <Input
                    id="default_exchange_rate"
                    type="number"
                    step="0.0001"
                    value={form.default_exchange_rate}
                    onChange={(e) => setForm((prev) => ({ ...prev, default_exchange_rate: e.target.value }))}
                    placeholder="e.g., 1500.00"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="contact_person_name">Contact Person Name *</Label>
                <Input
                  id="contact_person_name"
                  value={form.contact_person_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_person_name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="contact_email">Contact Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="contact_phone">Contact Phone *</Label>
                <Input
                  id="contact_phone"
                  value={form.contact_phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="company_address">Company Address *</Label>
                <Textarea
                  id="company_address"
                  value={form.company_address}
                  onChange={(e) => setForm((prev) => ({ ...prev, company_address: e.target.value }))}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Details - Dynamic based on organization type */}
        {provider.organization_type && (
          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
              <CardDescription>
                {provider.organization_type === "FOREIGN_PROVIDER" && "Hospital type and available services"}
                {provider.organization_type === "AMBULANCE_COMPANY" && "Coverage area and service types"}
                {provider.organization_type === "LOGISTICS_COMPANY" && "Service type and coverage area"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {provider.organization_type === "FOREIGN_PROVIDER" && (
                <>
                  <div>
                    <Label htmlFor="hospital_type">Hospital Type *</Label>
                    <Input
                      id="hospital_type"
                      value={serviceDetails.hospital_type}
                      onChange={(e) =>
                        setServiceDetails((prev) => ({ ...prev, hospital_type: e.target.value }))
                      }
                      required
                      placeholder="e.g., General Hospital, Specialist Clinic"
                    />
                  </div>
                  <div>
                    <Label>Available Services *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                      {[
                        "Emergency Care",
                        "Surgery",
                        "Cardiology",
                        "Orthopedics",
                        "Pediatrics",
                        "Maternity",
                        "ICU",
                        "Laboratory",
                        "Radiology",
                        "Pharmacy",
                      ].map((service) => (
                        <div key={service} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`service-${service}`}
                            checked={serviceDetails.available_services.includes(service)}
                            onChange={(e) => handleServiceCheckbox(service, e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor={`service-${service}`} className="text-sm">
                            {service}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {provider.organization_type === "AMBULANCE_COMPANY" && (
                <>
                  <div>
                    <Label htmlFor="coverage_area">Coverage Area *</Label>
                    <Input
                      id="coverage_area"
                      value={serviceDetails.coverage_area}
                      onChange={(e) =>
                        setServiceDetails((prev) => ({ ...prev, coverage_area: e.target.value }))
                      }
                      required
                      placeholder="e.g., Lagos, Abuja, Nationwide"
                    />
                  </div>
                  <div>
                    <Label>Service Types *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                      {["Emergency", "Non-Emergency", "Air Ambulance", "Ground Transport", "Medical Escort"].map(
                        (type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`type-${type}`}
                              checked={serviceDetails.service_types.includes(type)}
                              onChange={(e) => handleServiceCheckbox(type, e.target.checked)}
                              className="rounded"
                            />
                            <label htmlFor={`type-${type}`} className="text-sm">
                              {type}
                            </label>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </>
              )}

              {provider.organization_type === "LOGISTICS_COMPANY" && (
                <>
                  <div>
                    <Label htmlFor="service_type">Service Type *</Label>
                    <Input
                      id="service_type"
                      value={serviceDetails.service_type}
                      onChange={(e) =>
                        setServiceDetails((prev) => ({ ...prev, service_type: e.target.value }))
                      }
                      required
                      placeholder="e.g., Medical Equipment Transport, Sample Collection"
                    />
                  </div>
                  <div>
                    <Label htmlFor="coverage_area_logistics">Coverage Area *</Label>
                    <Input
                      id="coverage_area_logistics"
                      value={serviceDetails.coverage_area_logistics}
                      onChange={(e) =>
                        setServiceDetails((prev) => ({ ...prev, coverage_area_logistics: e.target.value }))
                      }
                      required
                      placeholder="e.g., Lagos, Abuja, Nationwide"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Compliance & Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compliance & Documents
            </CardTitle>
            <CardDescription>Business registration and legal documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="business_registration_number">Business Registration Number *</Label>
                <Input
                  id="business_registration_number"
                  value={form.business_registration_number}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, business_registration_number: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="tax_id_number">Tax ID Number</Label>
                <Input
                  id="tax_id_number"
                  value={form.tax_id_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, tax_id_number: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="license_document">License Document</Label>
                <FileUpload
                  onUpload={handleLicenseUpload}
                  onRemove={() => {
                    setForm((prev) => ({ ...prev, license_document_url: "" }))
                  }}
                  acceptedTypes={["application/pdf", "image/*"]}
                  maxFiles={1}
                  maxSize={10 * 1024 * 1024}
                  folder="special-providers/documents"
                  resourceType="auto"
                />
                {form.license_document_url && (
                  <div className="mt-2">
                    <p className="text-xs text-green-600">✓ Document uploaded</p>
                    <a
                      href={form.license_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View current document
                    </a>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="service_agreement">Service Agreement</Label>
                <FileUpload
                  onUpload={handleServiceAgreementUpload}
                  onRemove={() => {
                    setForm((prev) => ({ ...prev, service_agreement_url: "" }))
                  }}
                  acceptedTypes={["application/pdf", "image/*"]}
                  maxFiles={1}
                  maxSize={10 * 1024 * 1024}
                  folder="special-providers/documents"
                  resourceType="auto"
                />
                {form.service_agreement_url && (
                  <div className="mt-2">
                    <p className="text-xs text-green-600">✓ Document uploaded</p>
                    <a
                      href={form.service_agreement_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View current document
                    </a>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank & Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bank & Payment Details
            </CardTitle>
            <CardDescription>Banking information for payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="bank_name">Bank Name *</Label>
                <Input
                  id="bank_name"
                  value={form.bank_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, bank_name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="bank_country">Bank Country *</Label>
                <Input
                  id="bank_country"
                  value={form.bank_country}
                  onChange={(e) => setForm((prev) => ({ ...prev, bank_country: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="account_number">Account Number *</Label>
                <Input
                  id="account_number"
                  value={form.account_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, account_number: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="swift_code">SWIFT Code</Label>
                <Input
                  id="swift_code"
                  value={form.swift_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, swift_code: e.target.value }))}
                  placeholder="e.g., CHASUS33"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="preferred_payment_method">Preferred Payment Method *</Label>
                <Input
                  id="preferred_payment_method"
                  value={form.preferred_payment_method}
                  onChange={(e) => setForm((prev) => ({ ...prev, preferred_payment_method: e.target.value }))}
                  required
                  placeholder="e.g., Bank Transfer, Wire Transfer, ACH"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Internal Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
            <CardDescription>Add internal notes about this provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="internal_notes">Notes</Label>
              <Textarea
                id="internal_notes"
                value={form.internal_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, internal_notes: e.target.value }))}
                rows={6}
                placeholder="Add internal notes about this provider..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href={`/special-risk/special-providers/${params.id}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <PermissionGate permission="special-risk.edit">
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Updating..." : "Update Provider"}
            </Button>
          </PermissionGate>
        </div>
      </form>
    </div>
  )
}
