"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/ui/permission-gate"
import { 

export const dynamic = 'force-dynamic'
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  History, 
  Loader2, 
  AlertCircle,
  User,
  Building2,
  Calendar,
  DollarSign
} from "lucide-react"

interface Service {
  service_name: string
  service_type?: number
  amount: number
  is_covered: boolean
  coverage_limit?: number
  coverage_bands?: string[]
}

interface RequestDetails {
  id: string
  request_id: string
  provider_id: string
  enrollee_id: string
  hospital: string
  services: Service[]
  amount: number
  diagnosis: string | null
  status: string
  created_at: string
  provider: {
    id: string
    facility_name: string
  }
  enrollee: {
    id: string
    enrollee_id: string
    first_name: string
    last_name: string
    plan: {
      name: string
      band_type: string
    }
  }
  previous_encounters?: Array<{
    code: string
    hospital: string
    services: string
    amount: number
    status: string
    created_at: string
    claim?: {
      status: string
    }
  }>
  previous_approval_codes?: Array<{
    approval_code: string
    hospital: string
    services: string
    amount: number
    status: string
    created_at: string
  }>
}

export default function ViewRequestPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const requestId = searchParams.get("id")

  const [showEncountersModal, setShowEncountersModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({})
  const [rejectReason, setRejectReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Fetch request details
  const { data: requestData, isLoading, error } = useQuery({
    queryKey: ["provider-request", requestId],
    queryFn: async () => {
      const res = await fetch(`/api/call-centre/provider-requests/${requestId}`)
      if (!res.ok) throw new Error("Failed to fetch request details")
      const data = await res.json()
      return data.request as RequestDetails
    },
    enabled: !!requestId,
  })

  // Initialize selected services when data loads
  useEffect(() => {
    if (requestData?.services) {
      const serviceSelection: Record<string, boolean> = {}
      requestData.services.forEach((_, index) => {
        serviceSelection[`${index}`] = true
      })
      setSelectedServices(serviceSelection)
    }
  }, [requestData])

  const handleApproveRequest = async () => {
    if (!requestData) return
    
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/call-centre/provider-requests/${requestData.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: requestData.services.map((service, index) => ({
            ...service,
            is_approved: selectedServices[`${index}`],
            rejection_reason: !selectedServices[`${index}`] ? 'Service not covered or not selected' : undefined
          })),
          diagnosis: requestData.diagnosis,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve request')
      }

      const result = await res.json()
      
      toast({
        title: "Success",
        description: result.message || "Request approved successfully",
      })

      router.push('/call-centre/requests')
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setShowApproveModal(false)
    }
  }

  const handleRejectRequest = async () => {
    if (!requestData) return
    
    if (!rejectReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      })
      return
    }
    
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/call-centre/provider-requests/${requestData.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reject request')
      }

      const result = await res.json()
      
      toast({
        title: "Success",
        description: result.message || "Request rejected successfully",
      })

      router.push('/call-centre/requests')
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setShowRejectModal(false)
    }
  }

  if (!requestId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invalid Request</h2>
          <p className="text-gray-600 mb-4">No request ID provided</p>
          <Button onClick={() => router.push('/call-centre/requests')}>
            Back to Requests
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !requestData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Request</h2>
          <p className="text-gray-600 mb-4">Failed to load request details</p>
          <Button onClick={() => router.push('/call-centre/requests')}>
            Back to Requests
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate module="call-centre" action="view">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/call-centre/requests')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Request from {requestData.provider.facility_name}</h1>
              <p className="text-gray-600">Request ID: {requestData.request_id}</p>
            </div>
          </div>
          <Badge className={
            requestData.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
            requestData.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
            requestData.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }>
            {requestData.status}
          </Badge>
        </div>

        {/* Enrollee & Provider Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Enrollee Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 font-semibold mb-3">
                  <User className="h-5 w-5" />
                  <h3>Enrollee Information</h3>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Enrollee ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={requestData.enrollee.enrollee_id} readOnly className="font-mono" />
                    <Badge variant="outline">ACTIVE</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Enrollee Name</label>
                  <Input 
                    value={`${requestData.enrollee.first_name} ${requestData.enrollee.last_name}`} 
                    readOnly 
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Organization</label>
                    <Input value="Taj Bank" readOnly className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Plan</label>
                    <Input value={requestData.enrollee.plan.name} readOnly className="mt-1" />
                  </div>
                </div>
              </div>

              {/* Request Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 font-semibold mb-3">
                  <Building2 className="h-5 w-5" />
                  <h3>Request Information</h3>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Hospital</label>
                  <Input value={requestData.hospital} readOnly className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Amount</label>
                    <Input 
                      value={`₦${requestData.amount.toLocaleString()}`} 
                      readOnly 
                      className="mt-1 font-semibold text-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Date</label>
                    <Input 
                      value={new Date(requestData.created_at).toLocaleDateString('en-GB')} 
                      readOnly 
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Is Principal or Dependent?</label>
                  <Input value="Principal" readOnly className="mt-1" />
                </div>
              </div>
            </div>

            {/* Diagnosis */}
            {requestData.diagnosis && (
              <div className="mt-6">
                <label className="text-xs font-medium text-gray-500">Diagnosis</label>
                <Textarea value={requestData.diagnosis} readOnly className="mt-1" rows={2} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Services Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-blue-600">Service Requested</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEncountersModal(true)}
              >
                <History className="h-4 w-4 mr-2" />
                Previous Encounter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">SERVICES</TableHead>
                    <TableHead className="font-semibold">AMOUNT</TableHead>
                    <TableHead className="font-semibold">COVERAGE</TableHead>
                    <TableHead className="font-semibold">REMARKS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestData.services.map((service, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{service.service_name}</TableCell>
                      <TableCell className="font-semibold">₦{service.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        {service.is_covered ? (
                          <Badge className="bg-green-100 text-green-800">
                            Covered
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            Exceeded
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {service.coverage_limit ? `Limit: ₦${service.coverage_limit.toLocaleString()}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {requestData.status === 'PENDING' && (
          <PermissionGate module="call-centre" action="edit">
            <div className="flex justify-end gap-4">
              <Button
                variant="destructive"
                size="lg"
                onClick={() => setShowRejectModal(true)}
                disabled={isProcessing}
              >
                <XCircle className="h-5 w-5 mr-2" />
                Reject
              </Button>
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setShowApproveModal(true)}
                disabled={isProcessing}
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Approve Services
              </Button>
            </div>
          </PermissionGate>
        )}

        {/* Previous Encounters Modal */}
        <Dialog open={showEncountersModal} onOpenChange={setShowEncountersModal}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Previous Encounters</DialogTitle>
              <DialogDescription>
                Service history for {requestData.enrollee.first_name} {requestData.enrollee.last_name}
              </DialogDescription>
            </DialogHeader>

            {requestData.previous_encounters && requestData.previous_encounters.length > 0 ? (
              <div className="space-y-4">
                {requestData.previous_encounters.map((encounter, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-blue-600">{encounter.code}</p>
                        <p className="text-sm text-gray-600">{encounter.hospital}</p>
                      </div>
                      <div className="text-right">
                        <Badge className={
                          encounter.claim?.status === 'PAID' ? 'bg-green-100 text-green-800' :
                          encounter.claim?.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {encounter.claim?.status || encounter.status}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(encounter.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 mb-2">
                      <p className="font-medium">Services:</p>
                      <p className="text-sm">{encounter.services}</p>
                    </div>
                    <p className="text-sm font-semibold text-green-600">
                      ₦{encounter.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No previous encounters found</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEncountersModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve Modal */}
        <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Approve Services</DialogTitle>
              <DialogDescription>
                Select services to approve. Unselected services will be rejected.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                {requestData.services.map((service, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                    <Checkbox
                      checked={selectedServices[`${index}`]}
                      onCheckedChange={(checked) =>
                        setSelectedServices((prev) => ({
                          ...prev,
                          [`${index}`]: checked as boolean,
                        }))
                      }
                    />
                    <div className="flex-1">
                      <p className="font-medium">{service.service_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-semibold text-green-600">
                          ₦{service.amount.toLocaleString()}
                        </p>
                        {service.is_covered ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">Covered</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 text-xs">Not Covered</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Selected Services:</span>
                  <span className="font-semibold">
                    {Object.values(selectedServices).filter(Boolean).length} / {requestData.services.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Total Amount:</span>
                  <span className="font-semibold text-green-600">
                    ₦{requestData.services
                      .filter((_, index) => selectedServices[`${index}`])
                      .reduce((sum, service) => sum + service.amount, 0)
                      .toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveModal(false)}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApproveRequest}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Approve Selected
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Request</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this request
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectRequest}
                disabled={!rejectReason.trim() || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Reject Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  )
}
