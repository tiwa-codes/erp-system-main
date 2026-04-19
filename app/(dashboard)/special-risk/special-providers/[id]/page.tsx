"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowLeft, CheckCircle, XCircle, Edit, Save, X } from "lucide-react"
import Link from "next/link"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { PermissionGate } from "@/components/ui/permission-gate"

export default function SpecialProviderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ["special-provider", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/special-risk/providers/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch provider")
      return res.json()
    },
  })

  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [internalNotes, setInternalNotes] = useState("")

  const provider = data?.data

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/special-risk/providers/${params.id}/approve`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to approve provider")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-provider", params.id] })
      queryClient.invalidateQueries({ queryKey: ["special-providers"] })
      toast({
        title: "Success",
        description: "Provider approved successfully",
      })
      router.push("/special-risk/special-providers")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/special-risk/providers/${params.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to reject provider")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-provider", params.id] })
      queryClient.invalidateQueries({ queryKey: ["special-providers"] })
      toast({
        title: "Success",
        description: "Provider rejected successfully",
      })
      router.push("/special-risk/special-providers")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const payload = {
        internal_notes: notes || undefined,
      }
      const res = await fetch(`/api/special-risk/providers/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const error = await res.json()
        const errorMessage = error.details 
          ? `${error.error || "Validation failed"}: ${JSON.stringify(error.details)}`
          : error.error || "Failed to update notes"
        throw new Error(errorMessage)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-provider", params.id] })
      toast({
        title: "Success",
        description: "Internal notes updated successfully",
      })
      setIsEditingNotes(false)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Initialize notes when provider data loads
  useEffect(() => {
    if (provider?.internal_notes) {
      setInternalNotes(provider.internal_notes)
    }
  }, [provider?.internal_notes])

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

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      FOREIGN_PROVIDER: "bg-blue-100 text-blue-800",
      AMBULANCE_COMPANY: "bg-green-100 text-green-800",
      LOGISTICS_COMPANY: "bg-purple-100 text-purple-800",
    }
    return colors[type] || "bg-gray-100 text-gray-800"
  }

  const serviceDetails = provider.service_details || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/special-risk/special-providers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{provider.company_name}</h1>
            <p className="text-muted-foreground">Provider ID: {provider.provider_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {provider.organization_type && (
            <Badge className={getTypeBadge(provider.organization_type)}>
              {provider.organization_type.replace(/_/g, " ")}
            </Badge>
          )}
          <StatusIndicator status={provider.status} />
          {provider.status !== "APPROVED" && provider.status !== "REJECTED" && (
            <>
              <PermissionGate permission="special-risk.approve">
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </PermissionGate>
              <PermissionGate permission="special-risk.delete">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Are you sure you want to reject this provider?")) {
                      rejectMutation.mutate()
                    }
                  }}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </PermissionGate>
            </>
          )}
          {provider.status !== "APPROVED" && (
            <PermissionGate permission="special-risk.edit">
              <Link href={`/special-risk/special-providers/${params.id}/edit`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </Link>
            </PermissionGate>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Organization Type</p>
              <p className="font-medium">
                {provider.organization_type ? provider.organization_type.replace(/_/g, " ") : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Country</p>
              <p className="font-medium">{provider.country}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Currency</p>
              <p className="font-medium">{provider.currency}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Exchange Rate Source</p>
              <p className="font-medium">
                {provider.exchange_rate_source ? provider.exchange_rate_source.replace(/_/g, " ") : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contact Person</p>
              <p className="font-medium">{provider.contact_person_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contact Email</p>
              <p className="font-medium">{provider.contact_email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contact Phone</p>
              <p className="font-medium">{provider.contact_phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Company Address</p>
              <p className="font-medium">{provider.company_address}</p>
            </div>
            {provider.website && (
              <div>
                <p className="text-sm text-muted-foreground">Website</p>
                <a
                  href={provider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  {provider.website}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance & Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Business Registration Number</p>
              <p className="font-medium">{provider.business_registration_number}</p>
            </div>
            {provider.tax_id_number && (
              <div>
                <p className="text-sm text-muted-foreground">Tax ID Number</p>
                <p className="font-medium">{provider.tax_id_number}</p>
              </div>
            )}
            {provider.license_document_url && (
              <div>
                <p className="text-sm text-muted-foreground">License Document</p>
                <a
                  href={provider.license_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  View Document
                </a>
              </div>
            )}
            {provider.service_agreement_url && (
              <div>
                <p className="text-sm text-muted-foreground">Service Agreement</p>
                <a
                  href={provider.service_agreement_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  View Agreement
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bank & Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Bank Name</p>
              <p className="font-medium">{provider.bank_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bank Country</p>
              <p className="font-medium">{provider.bank_country}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Number</p>
              <p className="font-medium">{provider.account_number}</p>
            </div>
            {provider.swift_code && (
              <div>
                <p className="text-sm text-muted-foreground">SWIFT Code</p>
                <p className="font-medium">{provider.swift_code}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Preferred Payment Method</p>
              <p className="font-medium">{provider.preferred_payment_method}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {provider.organization_type === "FOREIGN_PROVIDER" ? (
                <>
                  {serviceDetails.hospital_type && (
                    <div>
                      <p className="text-sm text-muted-foreground">Hospital Type</p>
                      <p className="font-medium">{serviceDetails.hospital_type}</p>
                    </div>
                  )}
                  {serviceDetails.available_services && (
                    <div>
                      <p className="text-sm text-muted-foreground">Available Services</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(serviceDetails.available_services as string[]).map(
                          (service: string, idx: number) => (
                            <Badge key={idx} variant="secondary">
                              {service}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : provider.organization_type === "AMBULANCE_COMPANY" ? (
                <>
                  {serviceDetails.coverage_area && (
                    <div>
                      <p className="text-sm text-muted-foreground">Coverage Area</p>
                      <p className="font-medium">{serviceDetails.coverage_area}</p>
                    </div>
                  )}
                  {serviceDetails.service_types && (
                    <div>
                      <p className="text-sm text-muted-foreground">Service Types</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(serviceDetails.service_types as string[]).map(
                          (type: string, idx: number) => (
                            <Badge key={idx} variant="secondary">
                              {type}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : provider.organization_type === "LOGISTICS_COMPANY" ? (
                <>
                  {serviceDetails.service_type && (
                    <div>
                      <p className="text-sm text-muted-foreground">Service Type</p>
                      <p className="font-medium">{serviceDetails.service_type}</p>
                    </div>
                  )}
                  {serviceDetails.coverage_area && (
                    <div>
                      <p className="text-sm text-muted-foreground">Coverage Area</p>
                      <p className="font-medium">{serviceDetails.coverage_area}</p>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">No service details available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Internal Notes</CardTitle>
            {!isEditingNotes && (
              <PermissionGate permission="special-risk.edit">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInternalNotes(provider.internal_notes || "")
                    setIsEditingNotes(true)
                  }}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit Notes
                </Button>
              </PermissionGate>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditingNotes ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="internal_notes">Notes</Label>
                <Textarea
                  id="internal_notes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={6}
                  placeholder="Add internal notes about this provider..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    updateNotesMutation.mutate(internalNotes)
                  }}
                  disabled={updateNotesMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save Notes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingNotes(false)
                    setInternalNotes(provider.internal_notes || "")
                  }}
                  disabled={updateNotesMutation.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {provider.internal_notes || "No internal notes added yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
