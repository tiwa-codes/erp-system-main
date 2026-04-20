"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  Building2,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"



interface ApprovalCode {
  id: string
  claim_number: string
  requested_by: string
  hospital: string
  services: string
  amount: number
  status: 'NEW' | 'PROCESSED'
  date: string
  claim_id: string
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string
    address: string
    phone_whatsapp: string
    email: string
  }
  principal: {
    id: string
    enrollee_id: string
    first_name: string
    last_name: string
    phone_number: string
    email: string
    residential_address: string
  }
}

export default function ApprovalCodeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const approvalCodeId = params.id as string

  // Fetch approval code details
  const { data: approvalCode, isLoading, error } = useQuery({
    queryKey: ["approval-code", approvalCodeId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/approval-codes/${approvalCodeId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch approval code")
      }
      return res.json()
    },
    enabled: !!approvalCodeId,
  })

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-yellow-100 text-yellow-800'
      case 'PROCESSED':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !approvalCode) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Approval Code Not Found</h2>
          <p className="text-gray-600 mb-4">The requested approval code could not be found.</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
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
            <h1 className="text-3xl font-bold text-gray-900">Approval Code Details</h1>
            <p className="text-gray-600">View detailed information about the approval code</p>
          </div>
        </div>

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Approval Code Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {approvalCode.claim_number || '-'}
                </div>
                <div className="text-sm text-gray-600">Approval Code</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ₦{approvalCode.amount?.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-gray-600">Amount</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Badge className={getStatusBadgeColor(approvalCode.status)}>
                  {approvalCode.status}
                </Badge>
                <div className="text-sm text-gray-600 mt-2">Status</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {new Date(approvalCode.date).toLocaleDateString('en-GB')}
                </div>
                <div className="text-sm text-gray-600">Date</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provider Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Provider Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Facility Name</label>
                <p className="text-lg font-semibold">{approvalCode.provider?.facility_name || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Facility Type</label>
                <p className="text-lg">{approvalCode.provider?.facility_type || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Address</label>
                <p className="text-lg">{approvalCode.provider?.address || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Phone</label>
                <p className="text-lg">{approvalCode.provider?.phone_whatsapp || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-lg">{approvalCode.provider?.email || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Principal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Principal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Enrollee ID</label>
                <p className="text-lg font-semibold">{approvalCode.principal?.enrollee_id || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Full Name</label>
                <p className="text-lg">
                  {approvalCode.principal?.first_name && approvalCode.principal?.last_name 
                    ? `${approvalCode.principal.first_name} ${approvalCode.principal.last_name}`
                    : '-'
                  }
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Phone</label>
                <p className="text-lg">{approvalCode.principal?.phone_number || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-lg">{approvalCode.principal?.email || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Address</label>
                <p className="text-lg">{approvalCode.principal?.residential_address || '-'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Service Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Services Requested</label>
                <p className="text-lg">{approvalCode.services || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Requested By</label>
                <p className="text-lg">{approvalCode.requested_by || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Request Date</label>
                <p className="text-lg">{new Date(approvalCode.date).toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
