"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { StatusText } from "@/components/ui/status-text"
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  User,
  Building,
  CreditCard,
  Activity
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useRouter } from "next/navigation"

export const dynamic = 'force-dynamic'

interface ServiceRequest {
  id: string
  service_name: string
  amount: number
  coverage: 'COVERED' | 'EXCEEDED' | 'NOT_COVERED'
}

interface ApprovalRequest {
  id: string
  request_id: string
  enrollee_id: string
  enrollee_name: string
  organization: string
  plan: string
  diagnosis: string
  provider_name: string
  hospital_name: string
  provider_bands?: string[]
  services: ServiceRequest[]
  total_amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  date: string
  admission_required: boolean
}

export default function GenerateCodePage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  
  // Get request ID from URL params
  const [requestId, setRequestId] = useState<string>("")
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Form state for approval
  const [approvalForm, setApprovalForm] = useState({
    diagnosis: "",
    admission_required: false,
    services: [] as ServiceRequest[]
  })

  // Get request ID from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const id = urlParams.get('id')
    if (id) {
      setRequestId(id)
      fetchApprovalRequest(id)
    }
  }, [])

  // Fetch approval request details
  const fetchApprovalRequest = async (id: string) => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/call-centre/provider-requests/${id}`)
      if (!res.ok) {
        throw new Error('Failed to fetch request details')
      }
      const data = await res.json()
      setApprovalRequest(data.request)
      
      // Initialize form with request data
      setApprovalForm({
        diagnosis: data.request.diagnosis || "",
        admission_required: data.request.admission_required || false,
        services: data.request.services || []
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch request details",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Approve request mutation
  const approveRequestMutation = useMutation({
    mutationFn: async (approvalData: any) => {
      const res = await fetch(`/api/call-centre/provider-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvalData)
      })
      if (!res.ok) {
        throw new Error('Failed to approve request')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Request Approved",
        description: `Approval code ${data.approval_code} generated successfully`,
      })
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
      queryClient.invalidateQueries({ queryKey: ["call-centre-metrics"] })
      router.push('/call-centre')
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive",
      })
    },
  })

  // Reject request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async (rejectionData: any) => {
      const res = await fetch(`/api/call-centre/provider-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rejectionData)
      })
      if (!res.ok) {
        throw new Error('Failed to reject request')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Request Rejected",
        description: "Request has been rejected successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
      router.push('/call-centre')
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive",
      })
    },
  })

  const handleApprove = () => {
    if (!approvalRequest) return

    const approvalData = {
      diagnosis: approvalForm.diagnosis,
      admission_required: approvalForm.admission_required,
      services: approvalForm.services,
      status: 'APPROVED'
    }

    approveRequestMutation.mutate(approvalData)
  }

  const handleReject = () => {
    if (!approvalRequest) return

    const rejectionData = {
      status: 'REJECTED',
      reason: 'Rejected by call centre'
    }

    rejectRequestMutation.mutate(rejectionData)
  }

  const handleServiceCoverageChange = (serviceId: string, coverage: 'COVERED' | 'EXCEEDED' | 'NOT_COVERED') => {
    setApprovalForm(prev => ({
      ...prev,
      services: prev.services.map(service => 
        service.id === serviceId ? { ...service, coverage } : service
      )
    }))
  }

  const formatAmount = (amount: number) => {
    return `₦${amount.toLocaleString()}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!approvalRequest) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Request Not Found</h2>
          <p className="text-gray-600 mb-4">The requested approval code request could not be found.</p>
          <Button onClick={() => router.push('/call-centre')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Call Centre
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate module="call-centre" action="approve">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/call-centre')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Generate Code</h1>
              <p className="text-gray-600">Review and approve approval code request</p>
            </div>
          </div>
        </div>

        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Request from {approvalRequest.provider_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enrollee Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Enrollee ID</label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={approvalRequest.enrollee_id} 
                    readOnly 
                    className="font-mono"
                  />
                  <StatusIndicator status="ACTIVE" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Enrollee Name</label>
                <Input value={approvalRequest.enrollee_name} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Organization</label>
                <Input value={approvalRequest.organization} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Plan</label>
                <Input value={approvalRequest.plan} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Provider Band</label>
                <Input value={approvalRequest.provider_bands?.join(", ") || "-"} readOnly />
              </div>
            </div>

            {/* Diagnosis */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Diagnosis</label>
              <Input 
                placeholder="Diagnosis"
                value={approvalForm.diagnosis}
                onChange={(e) => setApprovalForm(prev => ({ ...prev, diagnosis: e.target.value }))}
              />
            </div>

            {/* Previous Encounter and Admission */}
            <div className="flex items-center justify-between">
              <Button variant="outline" className="text-blue-600 border-blue-600">
                Previous Encounter
              </Button>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="admission"
                  checked={approvalForm.admission_required}
                  onChange={(e) => setApprovalForm(prev => ({ ...prev, admission_required: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="admission" className="text-sm font-medium">Admission?</label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Requested */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Service Requested</CardTitle>
            <CardDescription>Services</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">SERVICES</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">COVERAGE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalForm.services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.service_name}</TableCell>
                    <TableCell className="font-semibold text-green-600">
                      {formatAmount(service.amount)}
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={service.coverage} 
                        onValueChange={(value: 'COVERED' | 'EXCEEDED' | 'NOT_COVERED') => 
                          handleServiceCoverageChange(service.id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COVERED">Covered</SelectItem>
                          <SelectItem value="EXCEEDED">Exceeded</SelectItem>
                          <SelectItem value="NOT_COVERED">Not Covered</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={rejectRequestMutation.isPending}
            className="px-8"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {rejectRequestMutation.isPending ? "Rejecting..." : "Reject"}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={approveRequestMutation.isPending}
            className="bg-[#BE1522] hover:bg-[#9B1219] px-8"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {approveRequestMutation.isPending ? "Generating..." : "Generate Code"}
          </Button>
        </div>
      </div>
    </PermissionGate>
  )
}
