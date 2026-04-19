"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Edit, Trash2, Calendar, MapPin, Phone, Mail, User } from "lucide-react"

interface ViewDependentProps {
  dependent: any
  onEdit: () => void
  onDelete: () => void
}

export function ViewDependent({ dependent, onEdit, onDelete }: ViewDependentProps) {
  const [activeTab, setActiveTab] = useState("timeline")

  // Fetch dependent timeline/audit logs
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["dependent-timeline", dependent.id],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/dependents/${dependent.id}/timeline`)
      if (!res.ok) throw new Error("Failed to fetch timeline")
      return res.json()
    },
    enabled: !!dependent.id
  })

  // Fetch dependent claims
  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ["dependent-claims", dependent.id],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/dependents/${dependent.id}/claims`)
      if (!res.ok) throw new Error("Failed to fetch claims")
      return res.json()
    },
    enabled: !!dependent.id
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-red-100 text-red-800"
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRelationshipColor = (relationship: string) => {
    switch (relationship) {
      case "SPOUSE":
        return "bg-blue-100 text-blue-800"
      case "CHILD":
        return "bg-purple-100 text-purple-800"
      case "PARENT":
        return "bg-orange-100 text-orange-800"
      case "SIBLING":
        return "bg-pink-100 text-pink-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    
    return age
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={dependent.profile_picture} />
            <AvatarFallback>
              {dependent.first_name?.[0]}{dependent.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">
              {dependent.first_name} {dependent.last_name}
            </h2>
            <p className="text-muted-foreground">ID: {dependent.dependent_id}</p>
            <Badge className={getStatusColor(dependent.status)}>
              {dependent.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Dependent Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* Personal Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Gender:</span>
                  <p className="font-medium">{dependent.gender || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Age:</span>
                  <p className="font-medium">
                    {dependent.date_of_birth ? calculateAge(dependent.date_of_birth) : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">DOB:</span>
                  <p className="font-medium">
                    {dependent.date_of_birth ? formatDate(dependent.date_of_birth) : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Relationship:</span>
                  <Badge className={getRelationshipColor(dependent.relationship)}>
                    {dependent.relationship}
                  </Badge>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                {dependent.phone_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{dependent.phone_number}</span>
                  </div>
                )}
                {dependent.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{dependent.email}</span>
                  </div>
                )}
                {dependent.residential_address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{dependent.residential_address}</span>
                  </div>
                )}
                {dependent.state && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{dependent.state}, {dependent.lga}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Organization:</span>
                  <p className="font-medium">{dependent.principal?.organization?.name || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Account Type:</span>
                  <p className="font-medium">{dependent.principal?.account_type || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Plan:</span>
                  <p className="font-medium">{dependent.principal?.plan?.name || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Primary Hospital:</span>
                  <p className="font-medium">{dependent.principal?.primary_hospital || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Start Date:</span>
                  <p className="font-medium">
                    {dependent.principal?.start_date ? formatDate(dependent.principal.start_date) : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">End Date:</span>
                  <p className="font-medium">
                    {dependent.principal?.end_date ? formatDate(dependent.principal.end_date) : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Registered On:</span>
                  <p className="font-medium">{formatDate(dependent.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created By:</span>
                  <p className="font-medium">
                    {dependent.created_by?.first_name} {dependent.created_by?.last_name}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Timeline and Data */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
              <TabsTrigger value="dependents">Dependents</TabsTrigger>
              <TabsTrigger value="claims">Claims</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {timelineLoading ? (
                    <div className="text-center py-4">Loading timeline...</div>
                  ) : timelineData?.timeline?.length > 0 ? (
                    <div className="space-y-4">
                      {timelineData.timeline.map((event: any, index: number) => (
                        <div key={index} className="flex items-start gap-4">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{event.description}</p>
                              <span className="text-sm text-muted-foreground">
                                {formatDate(event.created_at)}
                              </span>
                            </div>
                            {event.details && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {event.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No timeline events found
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plan" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Plan Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {dependent.principal?.plan ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground">Plan Name:</span>
                        <p className="font-medium">{dependent.principal.plan.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hospital:</span>
                        <p className="font-medium">{dependent.principal.primary_hospital || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Plan Start:</span>
                        <p className="font-medium">
                          {dependent.principal.start_date ? formatDate(dependent.principal.start_date) : "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expires:</span>
                        <p className="font-medium">
                          {dependent.principal.end_date ? formatDate(dependent.principal.end_date) : "N/A"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No plan assigned
                    </div>
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
                  {claimsLoading ? (
                    <div className="text-center py-4">Loading claims...</div>
                  ) : claimsData?.claims?.length > 0 ? (
                    <div className="space-y-4">
                      {claimsData.claims.map((claim: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{claim.service_type}</p>
                              <p className="text-sm text-muted-foreground">{claim.hospital_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">₦{claim.amount?.toLocaleString()}</p>
                              <Badge className={claim.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {claim.status}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            {formatDate(claim.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No claims found
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4 text-muted-foreground">
                    Audit logs will be implemented
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
