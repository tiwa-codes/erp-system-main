"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionGate } from "@/components/ui/permission-gate"
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Users, 
  FileText,
  Clock,
  Edit,
  Trash2,
  ExternalLink,
  Activity,
  Shield,
  TrendingUp,
  ArrowLeft,
  Download
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"



interface OrganizationViewPageProps {
  params: { id: string }
}

export default function OrganizationViewPage({ params }: OrganizationViewPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [isDownloadingIDCards, setIsDownloadingIDCards] = useState(false)
  const [isExportingOrganization, setIsExportingOrganization] = useState(false)

  // Fetch organization data
  const { data: organizationData, isLoading } = useQuery({
    queryKey: ["organization", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch organization')
      return res.json()
    }
  })

  // Fetch organization principals
  const { data: principalsData } = useQuery({
    queryKey: ["organization-principals", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${params.id}/principals`)
      if (!res.ok) throw new Error('Failed to fetch principals')
      return res.json()
    }
  })

  // Fetch organization dependents
  const { data: dependentsData } = useQuery({
    queryKey: ["organization-dependents", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${params.id}/dependents`)
      if (!res.ok) throw new Error('Failed to fetch dependents')
      return res.json()
    }
  })

  // Fetch organization claims
  const { data: claimsData } = useQuery({
    queryKey: ["organization-claims", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${params.id}/claims`)
      if (!res.ok) throw new Error('Failed to fetch claims')
      return res.json()
    }
  })

  // Fetch liability summary
  const { data: liabilityData } = useQuery({
    queryKey: ["organization-liability", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/organizations/${params.id}/liability`)
      if (!res.ok) throw new Error('Failed to fetch liability summary')
      return res.json()
    }
  })

  const organization = organizationData
  const principals = principalsData?.principals || []
  const dependents = dependentsData?.dependents || []
  const claims = claimsData?.claims || []
  const liability = liabilityData?.liability

  const handleBulkIDCardDownload = async () => {
    setIsDownloadingIDCards(true)
    try {
      const response = await fetch('/api/id-card/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: params.id })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to download ID cards')
      }

      // Get the blob from response
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ID_Cards_${organization?.code || organization?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: `Successfully downloaded ID cards for ${principals.length + dependents.length} enrollees`,
      })
    } catch (error: any) {
      console.error('Error downloading ID cards:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to download ID cards",
        variant: "destructive"
      })
    } finally {
      setIsDownloadingIDCards(false)
    }
  }

  const handleExportOrganization = async () => {
    setIsExportingOrganization(true)
    try {
      const response = await fetch(`/api/organizations/${params.id}/export`)
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to export organization records')
      }

      const csvContent = await response.text()
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `organization-${organization?.code || params.id}-enrollees-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: "Organization principals and dependents exported successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export organization records",
        variant: "destructive",
      })
    } finally {
      setIsExportingOrganization(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading organization...</p>
        </div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Organization not found</p>
        <Button 
          onClick={() => router.back()} 
          className="mt-4"
          variant="outline"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    )
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'INACTIVE':
        return 'bg-red-100 text-red-800'
      case 'SUSPENDED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPlanStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800'
      case 'PENDING_APPROVAL':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETE':
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'INACTIVE':
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getAccountTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'CORPORATE':
        return 'bg-blue-100 text-blue-800'
      case 'INDIVIDUAL':
        return 'bg-green-100 text-green-800'
      case 'GOVERNMENT':
        return 'bg-purple-100 text-purple-800'
      case 'NGO':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="underwriting" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
              <p className="text-sm text-gray-600">Organization Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PermissionGate module="underwriting" action="view">
              <Button
                variant="outline"
                onClick={handleExportOrganization}
                disabled={isExportingOrganization || principals.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExportingOrganization ? 'Exporting...' : 'Export'}
              </Button>
            </PermissionGate>
            <PermissionGate module="underwriting" action="view">
              <Button 
                variant="outline"
                onClick={handleBulkIDCardDownload}
                disabled={isDownloadingIDCards || (principals.length + dependents.length === 0)}
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloadingIDCards ? 'Downloading...' : 'Download All ID Cards'}
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Organization Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Organization Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Organization Code</h3>
                  <p className="text-lg font-semibold">{organization.code || "N/A"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Organization Type</h3>
                  <Badge className={getAccountTypeBadgeColor(organization.type)}>
                    {organization.type}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <Badge className={getStatusBadgeColor(organization.status)}>
                    {organization.status}
                  </Badge>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Contact Person</h3>
                  <p className="text-lg">{organization.contact_info?.contact_person || "N/A"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Phone Number</h3>
                  <p className="text-lg">{organization.contact_info?.phone_number || "N/A"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <p className="text-lg">{organization.contact_info?.email || "N/A"}</p>
                </div>
              </div>

              {/* Location & Dates */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Location</h3>
                  <p className="text-lg">{organization.contact_info?.state || "N/A"}, {organization.contact_info?.lga || "N/A"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Created Date</h3>
                  <p className="text-lg">{organization.created_at ? new Date(organization.created_at).toLocaleDateString() : "N/A"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Last Updated</h3>
                  <p className="text-lg">{organization.updated_at ? new Date(organization.updated_at).toLocaleDateString() : "N/A"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Created By</h3>
                  <p className="text-lg">
                    {organization.created_by
                      ? `${organization.created_by.first_name} ${organization.created_by.last_name}`.trim()
                      : "System"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {liability && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Liability Summary
              </CardTitle>
              <p className="text-sm text-gray-500">
                Total liability reflects the sum of all assigned plans.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-dashed border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs uppercase text-gray-500">Total Annual Limit</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    ₦{liability.totalAnnualLimit.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Plans: {liability.planCount}</p>
                </div>
                <div className="rounded-lg border border-dashed border-slate-100 bg-white p-4">
                  <p className="text-xs uppercase text-gray-500">Total Used</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    ₦{liability.totalUsed.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Utilization {liability.utilization}%</p>
                </div>
                <div className="rounded-lg border border-dashed border-green-100 bg-green-50 p-4">
                  <p className="text-xs uppercase text-gray-500">Limit Breaches</p>
                  <Badge className={liability.limitBreaches ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                    {liability.limitBreaches ? "At least one plan exceeded limits" : "Within limits"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                {liability.plans.length > 0 ? (
                  liability.plans.map((plan: { planId: string; planName: string; planType?: string; status?: string; activePrincipals: number; totalPrincipals: number; totalLimit: number; annualLimit?: number; utilized: number; totalUsed?: number; remaining: number; utilization?: number; warnings?: string[] }) => (
                    <div key={plan.planId} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">{plan.planName}</p>
                          <p className="text-xs text-gray-500">{plan.planType || "—"}</p>
                        </div>
                        <Badge className={getPlanStatusBadgeColor(plan.status || "ACTIVE")}>
                          {(plan.status || "ACTIVE").replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Annual Limit</span>
                          <span>Used</span>
                          <span>Remaining</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold text-gray-900">
                          <span>₦{(plan.annualLimit ?? plan.totalLimit).toLocaleString()}</span>
                          <span>₦{(plan.totalUsed ?? plan.utilized).toLocaleString()}</span>
                          <span>₦{plan.remaining.toLocaleString()}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-[#0891B2]"
                            style={{ width: `${Math.min(plan.utilization ?? 0, 100)}%` }}
                            aria-label={`Utilization ${plan.utilization ?? 0}%`}
                          />
                        </div>
                        <p className="text-xs text-gray-500">Utilization: {plan.utilization ?? 0}%</p>
                        {(plan.warnings?.length ?? 0) > 0 && (
                          <p className="text-xs text-orange-700">Warning: {plan.warnings?.[0]}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No plan usage data available.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for detailed information */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="principals">Principals ({principals.length})</TabsTrigger>
            <TabsTrigger value="dependents">Dependents ({dependents.length})</TabsTrigger>
            <TabsTrigger value="claims">Claims ({claims.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Enrollee Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Principals</span>
                      <span className="font-semibold">{principals.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Dependents</span>
                      <span className="font-semibold">{dependents.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Enrollees</span>
                      <span className="font-semibold">{principals.length + dependents.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity / Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm">Organization created</p>
                        <p className="text-xs text-gray-500">{new Date(organization.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-[#0891B2] rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm">Total Enrollees</p>
                        <p className="text-xs text-gray-500 font-semibold">{principals.length + dependents.length} (Principals: {principals.length}, Dependents: {dependents.length})</p>
                      </div>
                    </div>
                    {organization.updated_at !== organization.created_at && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="text-sm">Last updated</p>
                          <p className="text-xs text-gray-500">{new Date(organization.updated_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="principals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Principals</CardTitle>
              </CardHeader>
              <CardContent>
                {principals.length > 0 ? (
                  <div className="space-y-4">
                    {principals.map((principal: any) => (
                      <div key={principal.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{principal.first_name} {principal.last_name}</h3>
                            <p className="text-sm text-gray-600">ID: {principal.enrollee_id}</p>
                            <p className="text-sm text-gray-600">Dependents: {principal.dependents?.length || 0}</p>
                          </div>
                          <Badge className={getStatusBadgeColor(principal.status)}>
                            {principal.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">No principals found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dependents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Dependents</CardTitle>
              </CardHeader>
              <CardContent>
                {dependents.length > 0 ? (
                  <div className="space-y-4">
                    {dependents.map((dependent: any) => (
                      <div key={dependent.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{dependent.first_name} {dependent.last_name}</h3>
                            <p className="text-sm text-gray-600">ID: {dependent.dependent_id}</p>
                            <p className="text-sm text-gray-600">Principal: {dependent.principal?.first_name} {dependent.principal?.last_name}</p>
                          </div>
                          <Badge className={getStatusBadgeColor(dependent.status)}>
                            {dependent.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">No dependents found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="claims" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Claims</CardTitle>
              </CardHeader>
              <CardContent>
                {claims.length > 0 ? (
                  <div className="space-y-4">
                    {claims.map((claim: any) => (
                      <div key={claim.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">Claim #{claim.claim_number}</h3>
                            <p className="text-sm text-gray-600">Enrollee: {claim.principal?.first_name} {claim.principal?.last_name} ({claim.principal?.enrollee_id})</p>
                            <p className="text-sm text-gray-600">Provider: {claim.provider?.facility_name}</p>
                            <p className="text-sm text-gray-600">Amount: ₦{claim.amount?.toLocaleString()}</p>
                            <p className="text-sm text-gray-600">Date: {new Date(claim.created_at).toLocaleDateString()}</p>
                          </div>
                          <Badge className={getStatusBadgeColor(claim.status)}>
                            {claim.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">No claims found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  )
}
