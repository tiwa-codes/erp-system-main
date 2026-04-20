"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft, 
  User, 
  Building2, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  Hospital,
  FileText,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"



interface Claim {
  id: string
  claim_number: string
  enrollee_id: string
  principal_id?: string
  principal?: {
    id: string
    enrollee_id: string
    first_name: string
    last_name: string
    middle_name?: string
    phone_number?: string
    email?: string
    organization: {
      id: string
      name: string
      code: string
    }
    plan?: {
      id: string
      name: string
      plan_type: string
      premium_amount: number
      annual_limit: number
    }
  }
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string[]
    address?: string
    phone_whatsapp?: string
    email?: string
  }
  claim_type: string
  amount: number
  status: string
  submitted_at: string
  processed_at?: string
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
  created_by?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  vetting_records: Array<{
    id: string
    vetting_type: string
    status: string
    findings?: string
    recommendations?: string
    completed_at?: string
    vetter: {
      id: string
      first_name: string
      last_name: string
      email: string
    }
  }>
  audit_records: Array<{
    id: string
    audit_type: string
    status: string
    findings?: string
    completed_at?: string
    auditor: {
      id: string
      first_name: string
      last_name: string
      email: string
    }
  }>
  fraud_alerts: Array<{
    id: string
    alert_type: string
    severity: string
    description: string
    status: string
    created_at: string
  }>
}

export default function ClaimDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params

  // Fetch claim data
  const {
    data: claimData,
    isLoading,
    error
  } = useQuery({
    queryKey: ["claim", id],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${id}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claim")
      }
      return res.json() as Promise<{ claim: Claim }>
    },
  })

  const claim = claimData?.claim

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    console.error('Error fetching claim:', error)
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load claim details</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Claim not found</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    
    switch (status.toLowerCase()) {
      case 'submitted':
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'vetting':
        return 'bg-blue-100 text-blue-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'paid':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="claims" action="view">
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
            <h1 className="text-3xl font-bold text-gray-900">Claim Details</h1>
            <p className="text-gray-600">View claim information and processing history</p>
          </div>
        </div>

        {/* Claim Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Claim Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Approval Code</label>
                  <p className="text-lg font-semibold">{claim.claim_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date of Claim</label>
                  <p className="text-lg">
                    {claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString('en-GB') : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Service Type</label>
                  <p className="text-lg">{claim.claim_type || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="text-lg font-semibold text-green-600">₦{claim.amount ? claim.amount.toLocaleString() : '0'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <Badge className={getStatusBadgeColor(claim.status)}>
                    {claim.status ? claim.status.replace('_', ' ') : 'Unknown'}
                  </Badge>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Enrollee</label>
                  <p className="text-lg">
                    {claim.principal ? 
                      `${claim.principal?.first_name || ''} ${claim.principal?.last_name || ''}`.trim() || 'N/A' : 
                      claim.enrollee_id || 'N/A'
                    }
                  </p>
                  {claim.principal?.enrollee_id && (
                    <p className="text-sm text-gray-500">({claim.principal?.enrollee_id || 'N/A'})</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Provider</label>
                  <p className="text-lg">{claim.provider?.facility_name || 'Unknown Provider'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Plan</label>
                  <p className="text-lg">{claim.principal?.plan?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date of Service</label>
                  <p className="text-lg">
                    {claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString('en-GB') : 'N/A'}
                  </p>
                </div>
                {claim.rejection_reason && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Rejection Reason</label>
                    <p className="text-lg text-red-600">{claim.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Information */}
        <Tabs defaultValue="principal" className="space-y-4">
          <TabsList>
            <TabsTrigger value="principal">Principal Details</TabsTrigger>
            <TabsTrigger value="provider">Provider Details</TabsTrigger>
            <TabsTrigger value="vetting">Vetting History</TabsTrigger>
            <TabsTrigger value="audit">Audit History</TabsTrigger>
            <TabsTrigger value="fraud">Fraud Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="principal">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Principal Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                {claim.principal ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Full Name</label>
                        <p className="text-lg">
                          {claim.principal?.first_name || ''} {claim.principal?.middle_name || ''} {claim.principal?.last_name || ''}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Enrollee ID</label>
                        <p className="text-lg">{claim.principal?.enrollee_id || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Organization</label>
                        <p className="text-lg">{claim.principal?.organization?.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Phone Number</label>
                        <p className="text-lg">{claim.principal?.phone_number || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-lg">{claim.principal?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Plan Details</label>
                        {claim.principal?.plan ? (
                          <div className="space-y-1">
                            <p className="text-lg">{claim.principal?.plan?.name || 'N/A'}</p>
                            <p className="text-sm text-gray-500">
                              {claim.principal?.plan?.plan_type || 'Unknown'} - ₦{claim.principal?.plan?.premium_amount ? claim.principal.plan.premium_amount.toLocaleString() : '0'}
                            </p>
                            <p className="text-sm text-gray-500">
                              Annual Limit: ₦{claim.principal?.plan?.annual_limit ? claim.principal.plan.annual_limit.toLocaleString() : '0'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-lg">No plan assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No principal information available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="provider">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Provider Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Provider Name</label>
                      <p className="text-lg">{claim.provider?.facility_name || 'Unknown Provider'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Facility Type</label>
                      <p className="text-lg">{claim.provider?.facility_type?.join(', ') || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Address</label>
                      <p className="text-lg">{claim.provider?.address || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone Number</label>
                      <p className="text-lg">{claim.provider?.phone_whatsapp || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-lg">{claim.provider?.email || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vetting">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  Vetting History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {claim.vetting_records && claim.vetting_records.length > 0 ? (
                  <div className="space-y-4">
                    {claim.vetting_records.map((record) => (
                      <div key={record.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusBadgeColor(record.status)}>
                              {record.status ? record.status.replace('_', ' ') : 'Unknown'}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {record.vetting_type ? record.vetting_type.replace('_', ' ') : 'Unknown'}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {record.completed_at ? 
                              new Date(record.completed_at).toLocaleDateString('en-GB') : 
                              'In Progress'
                            }
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Vetted by</label>
                            <p className="text-sm">
                              {record.vetter?.first_name || ''} {record.vetter?.last_name || ''}
                            </p>
                          </div>
                          {record.findings && (
                            <div>
                              <label className="text-sm font-medium text-gray-500">Findings</label>
                              <p className="text-sm">{record.findings}</p>
                            </div>
                          )}
                          {record.recommendations && (
                            <div>
                              <label className="text-sm font-medium text-gray-500">Recommendations</label>
                              <p className="text-sm">{record.recommendations}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No vetting records available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Audit History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {claim.audit_records && claim.audit_records.length > 0 ? (
                  <div className="space-y-4">
                    {claim.audit_records.map((record) => (
                      <div key={record.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusBadgeColor(record.status)}>
                              {record.status ? record.status.replace('_', ' ') : 'Unknown'}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {record.audit_type ? record.audit_type.replace('_', ' ') : 'Unknown'}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {record.completed_at ? 
                              new Date(record.completed_at).toLocaleDateString('en-GB') : 
                              'In Progress'
                            }
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Audited by</label>
                            <p className="text-sm">
                              {record.auditor?.first_name || ''} {record.auditor?.last_name || ''}
                            </p>
                          </div>
                          {record.findings && (
                            <div>
                              <label className="text-sm font-medium text-gray-500">Findings</label>
                              <p className="text-sm">{record.findings}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No audit records available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fraud">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-blue-600" />
                  Fraud Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {claim.fraud_alerts && claim.fraud_alerts.length > 0 ? (
                  <div className="space-y-4">
                    {claim.fraud_alerts.map((alert) => (
                      <div key={alert.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusBadgeColor(alert.status)}>
                              {alert.status}
                            </Badge>
                            <Badge variant="outline">
                              {alert.severity}
                            </Badge>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(alert.created_at).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Alert Type</label>
                            <p className="text-sm">{alert.alert_type ? alert.alert_type.replace('_', ' ') : 'Unknown'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Description</label>
                            <p className="text-sm">{alert.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No fraud alerts</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  )
}
