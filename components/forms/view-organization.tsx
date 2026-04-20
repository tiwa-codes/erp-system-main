"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  TrendingUp
} from "lucide-react"

interface ViewOrganizationProps {
  organization: any
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function ViewOrganization({ organization, onClose, onEdit, onDelete }: ViewOrganizationProps) {
  const [activeTab, setActiveTab] = useState("timeline")

  // Fetch detailed organization data
  const { data: orgDetails, isLoading } = useQuery({
    queryKey: ["organization", organization.id],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organization.id}`)
      if (!res.ok) throw new Error("Failed to fetch organization details")
      return res.json()
    }
  })

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800"
      case "INACTIVE": return "bg-yellow-100 text-yellow-800"
      case "SUSPENDED": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getAccountTypeBadgeColor = (accountType: string) => {
    switch (accountType) {
      case "CORPORATE": return "bg-blue-100 text-blue-800"
      case "INDIVIDUAL": return "bg-purple-100 text-purple-800"
      case "GOVERNMENT": return "bg-green-100 text-green-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "Not provided"
    return new Date(dateString).toLocaleDateString()
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "Not provided"
    return new Date(dateString).toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const org = orgDetails || organization
  const contactInfo = org.contact_info || {}

  return (
    <div className="space-y-6">
      {/* Organization Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
            {contactInfo.logoUrl ? (
              <img src={contactInfo.logoUrl} alt={org.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-gray-600" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{org.name}</h2>
            <p className="text-gray-600">ID: {org.organization_code || org.code}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getStatusBadgeColor(org.status)}>
                {org.status}
              </Badge>
              <Badge className={getAccountTypeBadgeColor(org.type || org.account_type)}>
                {org.type || org.account_type}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button 
            variant="outline" 
            onClick={onEdit}
            className="border-blue-500 text-blue-600 hover:bg-blue-50"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            onClick={onDelete}
            className="border-red-500 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Organization Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Contact Person</p>
                <p className="text-sm text-gray-600">{contactInfo.contactPerson || org.contact_person}</p>
              </div>
            </div>
            
            {(contactInfo.contactNumber || org.contact_number) && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Phone</p>
                  <p className="text-sm text-gray-600">{contactInfo.contactNumber || org.contact_number}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-600">{contactInfo.email || org.email}</p>
              </div>
            </div>

            {(contactInfo.headOfficeAddress || org.head_office_address) && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Head Office</p>
                  <p className="text-sm text-gray-600">{contactInfo.headOfficeAddress || org.head_office_address}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location & Contract Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location & Contract
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Location</p>
                <p className="text-sm text-gray-600">{contactInfo.state || org.state}, {contactInfo.lga || org.lga}</p>
              </div>
            </div>

            {(contactInfo.startDate || org.start_date) && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Start Date</p>
                  <p className="text-sm text-gray-600">{formatDate(contactInfo.startDate || org.start_date)}</p>
                </div>
              </div>
            )}

            {(contactInfo.endDate || org.end_date) && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">End Date</p>
                  <p className="text-sm text-gray-600">{formatDate(contactInfo.endDate || org.end_date)}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Auto Renewal</p>
                <p className="text-sm text-gray-600">{(contactInfo.autoRenewal || org.auto_renewal) ? "Yes" : "No"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Created</p>
                <p className="text-sm text-gray-600">{formatDateTime(org.created_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Uploaded Files Section */}
      {contactInfo.uploadedFileUrls && contactInfo.uploadedFileUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Organization Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contactInfo.uploadedFileUrls.map((url: string, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                      <img 
                        src={url} 
                        alt={`Document ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling!.style.display = 'flex'
                        }}
                      />
                      <FileText className="h-6 w-6 text-gray-500" style={{ display: 'none' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {contactInfo.uploadedFiles?.[index]?.name || `Document ${index + 1}`}
                      </p>
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View File
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Principals</p>
                <p className="text-2xl font-bold text-gray-900">{org.principals_count || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Principals</p>
                <p className="text-2xl font-bold text-gray-900">{org.active_principals_count || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Plans</p>
                <p className="text-2xl font-bold text-gray-900">{org.plans_count || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Plans</p>
                <p className="text-2xl font-bold text-gray-900">{org.active_plans_count || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="enrollees">Enrollees</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {org.audit_logs?.map((log: any, index: number) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="w-2 h-2 bg-[#0891B2] rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {log.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-gray-500">{formatDateTime(log.created_at)}</p>
                      </div>
                      <p className="text-sm text-gray-600">
                        {log.user?.first_name} {log.user?.last_name} ({log.user?.email})
                      </p>
                      {log.details && (
                        <p className="text-xs text-gray-500 mt-1">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {(!org.audit_logs || org.audit_logs.length === 0) && (
                  <p className="text-gray-500 text-center py-8">No activity recorded yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Plans</CardTitle>
            </CardHeader>
            <CardContent>
              {org.plans?.length > 0 ? (
                <div className="space-y-4">
                  {org.plans.map((plan: any) => (
                    <div key={plan.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{plan.name}</h4>
                          <p className="text-sm text-gray-600">{plan.description}</p>
                        </div>
                        <Badge className={getStatusBadgeColor(plan.status)}>
                          {plan.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No plans assigned yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Enrollees</CardTitle>
            </CardHeader>
            <CardContent>
              {org.principals?.length > 0 ? (
                <div className="space-y-4">
                  {org.principals.map((principal: any) => (
                    <div key={principal.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{principal.first_name} {principal.last_name}</h4>
                          <p className="text-sm text-gray-600">{principal.email}</p>
                        </div>
                        <Badge className={getStatusBadgeColor(principal.status)}>
                          {principal.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No enrollees yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {org.audit_logs?.map((log: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{log.action}</h4>
                      <p className="text-xs text-gray-500">{formatDateTime(log.created_at)}</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      Performed by: {log.user?.first_name} {log.user?.last_name} ({log.user?.email})
                    </p>
                    {log.details && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
                {(!org.audit_logs || org.audit_logs.length === 0) && (
                  <p className="text-gray-500 text-center py-8">No audit logs available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
