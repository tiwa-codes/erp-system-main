"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  History,
  Loader2,
  AlertCircle
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"



interface DetailedRequest {
  id: string
  request_id: string
  provider_id: string
  enrollee_id: string
  hospital: string
  services: Array<{
    id?: string
    service_name: string
    service_type?: number
    amount: number
    quantity?: number
    tariff_price?: number        // Original tariff price
    negotiated_price?: number    // Provider's proposed price
    is_negotiable?: boolean      // Flag for zero-price services
    final_price?: number         // Price to use (negotiated or tariff)
    is_covered: boolean
    coverage_limit?: number
    coverage_bands?: string[]
    coverage?: string
    coverage_status?: string
    coverageReason?: string
    rejection_reason?: string
    remarks?: string
    is_ad_hoc?: boolean
    is_added_after_approval?: boolean
  }>
  amount: number
  diagnosis: string | null
  status: string
  created_at: string
  enrollee_name?: string
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
    organization?: {
      name: string
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
  beneficiary_id?: string | null
  beneficiary_name?: string | null
  is_dependent?: boolean
  original_approval_code?: string | null
  is_added_after_approval_request?: boolean
}

export default function ViewRequestPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const requestId = params.id as string

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({})
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({}) // Track edited prices
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({}) // Track edited quantities
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({})
  const [rejectReason, setRejectReason] = useState("")
  const [validationError, setValidationError] = useState<string>("")

  // Fetch request details
  const { data: request, isLoading, error } = useQuery({
    queryKey: ['provider-request-detail', requestId],
    queryFn: async () => {
      const res = await fetch(`/api/call-centre/provider-requests/${requestId}`)
      if (!res.ok) throw new Error('Failed to fetch request details')
      const data = await res.json()
      return data.request as DetailedRequest
    }
  })

  // Initialize selected services and edited prices when request loads
  useEffect(() => {
    if (request) {
      const serviceSelection: Record<string, boolean> = {}
      const prices: Record<string, number> = {}
      const quantities: Record<string, number> = {}
      const reasons: Record<string, string> = {}

      request.services.forEach((service, index) => {
        // For PENDING requests, all services are checked by default (eligible)
        // For already processed requests, use existing coverage status
        if (request.status === 'PENDING') {
          serviceSelection[`${index}`] = true // All checked by default for PENDING
        } else {
          const coverage = service.coverage || service.coverage_status
          const defaultApproved = coverage
            ? ['COVERED', 'EXCEEDED', 'LIMIT_EXCEEDED'].includes(coverage)
            : !!service.is_covered
          serviceSelection[`${index}`] = defaultApproved
        }
        
        // Initialize edited price with negotiated price or final price for ALL services
        prices[`${index}`] = service.negotiated_price || service.final_price || service.amount
        // Initialize quantity
        quantities[`${index}`] = service.quantity || 1
        
        if (service.rejection_reason || service.remarks) {
          reasons[`${index}`] = service.rejection_reason || service.remarks || ""
        }
      })

      setSelectedServices(serviceSelection)
      setEditedPrices(prices)
      setEditedQuantities(quantities)
      setRejectionReasons(reasons)
    }
  }, [request])

  const handleConfirmRequest = async () => {
    if (!request) return

    // Validate: Check if any rejected service is missing remarks
    const missingRemarks: number[] = []
    request.services.forEach((_, index) => {
      if (!selectedServices[`${index}`] && !rejectionReasons[`${index}`]?.trim()) {
        missingRemarks.push(index + 1)
      }
    })

    if (missingRemarks.length > 0) {
      setValidationError(`Remarks are required for rejected services (Service ${missingRemarks.join(', ')})`)
      toast({
        title: "Validation Error",
        description: `Remarks are required for rejected services. Please provide rejection reasons for service(s) ${missingRemarks.join(', ')}.`,
        variant: "destructive",
      })
      return
    }

    setValidationError("")

    try {
      const res = await fetch(`/api/call-centre/provider-requests/${request.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          services: request.services.map((service, index) => ({
            ...service,
            id: service.id || `${index}`,
            is_approved: selectedServices[`${index}`],
            approved_price: editedPrices[`${index}`],
            quantity: editedQuantities[`${index}`] || service.quantity || 1,
            rejection_reason: !selectedServices[`${index}`]
              ? (rejectionReasons[`${index}`] || service.rejection_reason || service.remarks || 'Service not covered or not selected')
              : undefined
          })),
          diagnosis: request.diagnosis,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve request')
      }

      const result = await res.json()

      toast({
        title: "Success",
        description: result.message || "Request processed successfully",
      })

      // Refresh the request data to show updated status and colors
      queryClient.invalidateQueries({ queryKey: ['provider-request-detail', requestId] })

      // Navigate back to requests page after a brief delay to show updates
      setTimeout(() => {
        router.push('/call-centre/requests')
      }, 1500)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      })
    }
  }

  const handleRejectRequest = async () => {
    if (!request) return

    if (!rejectReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      })
      return
    }

    try {
      const res = await fetch(`/api/call-centre/provider-requests/${request.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: rejectReason,
        }),
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

      // Navigate back to requests page
      router.push('/call-centre/requests')
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="h-12 w-12 text-red-600 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Request Not Found</h2>
        <p className="text-gray-600 mb-4">The request you're looking for doesn't exist.</p>
        <Button onClick={() => router.push('/call-centre/requests')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Requests
        </Button>
      </div>
    )
  }

  const dependentStatus = request.is_dependent ? "Dependent" : "Principal"

  return (
    <PermissionGate module="call-centre" action="view">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/call-centre/requests')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Request from {request.provider.facility_name}</h1>
              <p className="text-sm text-gray-600">Request #{request.request_id}</p>
            </div>
          </div>
          <Badge className={
            request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
              request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                  request.status === 'PARTIAL' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
          }>
            {request.status}
          </Badge>
        </div>

        {/* Enrollee & Provider Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-3">Enrollee Information</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">Enrollee ID</label>
                    <p className="text-sm font-semibold font-mono">{request.enrollee_id}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="text-xs bg-green-100 text-green-800">ACTIVE</Badge>
                      <Badge className="text-xs bg-blue-100 text-blue-800">
                        {dependentStatus}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Enrollee Name</label>
                    <p className="text-sm font-semibold">{request.enrollee_name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Organization</label>
                    <p className="text-sm">{request.enrollee.organization?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Plan</label>
                    <p className="text-sm font-semibold">{request.enrollee.plan.name}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-3">Request Details</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">Amount</label>
                    <p className="text-lg font-bold text-gray-900">â‚¦{request.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Is Principal or Dependent?</label>
                    <p className="text-sm">{dependentStatus}</p>
                  </div>
                  {request.original_approval_code && (
                    <div>
                      <label className="text-xs text-gray-500">Original Approval Code</label>
                      <p className="text-sm font-semibold text-blue-700">{request.original_approval_code}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Diagnosis Card */}
        {request.diagnosis && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Diagnosis</h3>
              <p className="text-sm">{request.diagnosis}</p>
            </CardContent>
          </Card>
        )}

        {/* Previous Encounter Button */}
        <div className="flex justify-start">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/call-centre/previous-encounters?enrollee_id=${encodeURIComponent(request.enrollee.enrollee_id)}`)
            }
          >
            <History className="h-4 w-4 mr-2" />
            Previous Encounter
          </Button>
        </div>

        {/* Services Card - Inline Editable Table for PENDING, Read-only for others */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Service Requested</CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="text-sm font-semibold mb-4">Services</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SERVICE</TableHead>
                    <TableHead>QTY</TableHead>
                    <TableHead>AMOUNT</TableHead>
                    <TableHead>ELIGIBILITY</TableHead>
                    <TableHead>REMARKS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.services.map((service, index) => {
                    const isNegotiable = service.is_negotiable || service.tariff_price === 0 || service.amount === 0
                    const displayPrice = service.negotiated_price || service.final_price || service.amount
                    const coverageStatus = service.coverage || service.coverage_status || (service.is_covered ? 'COVERED' : 'NOT_COVERED')
                    const isRejected = coverageStatus === 'REJECTED' || coverageStatus === 'NOT_COVERED'
                    const isSelected = selectedServices[`${index}`] ?? true
                    const isPending = request.status === 'PENDING'
                    const isAddedAfterApproval = service.is_added_after_approval === true
                    const currentQuantity = editedQuantities[`${index}`] ?? service.quantity ?? 1
                    const currentPrice = editedPrices[`${index}`] ?? displayPrice

                    return (
                      <TableRow
                        key={index}
                        className={
                          !isSelected && isPending
                            ? "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500"
                            : isRejected && !isPending
                              ? "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500"
                              : isAddedAfterApproval
                                ? "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500"
                              : isNegotiable
                                ? "bg-orange-100 hover:bg-orange-200 border-l-4 border-l-orange-500"
                                : ""
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{service.service_name}</span>
                            {isNegotiable && (
                              <Badge className="bg-orange-500 text-white text-xs">
                                Negotiable
                              </Badge>
                            )}
                            {isAddedAfterApproval && (
                              <Badge className="bg-[#BE1522] text-white text-xs">
                                Added Service
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <Input
                              type="number"
                              min="1"
                              value={currentQuantity}
                              onChange={(e) => {
                                const qty = parseInt(e.target.value) || 1
                                setEditedQuantities(prev => ({
                                  ...prev,
                                  [`${index}`]: qty
                                }))
                              }}
                              className="w-20 h-8 text-sm"
                            />
                          ) : (
                            <span className="text-sm">{currentQuantity}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPending && isSelected ? (
                            <div className="space-y-1">
                              {isNegotiable && (
                                <div className="text-xs text-gray-500">
                                  Tariff: ₦{(service.tariff_price || 0).toLocaleString()}
                                </div>
                              )}
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={currentPrice}
                                onChange={(e) => {
                                  const price = parseFloat(e.target.value) || 0
                                  setEditedPrices(prev => ({
                                    ...prev,
                                    [`${index}`]: price
                                  }))
                                }}
                                className={`w-32 h-8 text-sm ${isNegotiable ? 'border-orange-300 text-orange-700' : ''}`}
                                placeholder="Enter price"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {isNegotiable && (
                                <div className="text-xs text-gray-500">
                                  Tariff: ₦{(service.tariff_price || 0).toLocaleString()}
                                </div>
                              )}
                              <span className="font-semibold">₦{currentPrice.toLocaleString()}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                // Handle boolean or "indeterminate" values - convert to boolean
                                const isChecked = checked === true
                                setSelectedServices(prev => ({
                                  ...prev,
                                  [`${index}`]: isChecked
                                }))
                                // Clear validation error when checkbox changes
                                if (validationError) {
                                  setValidationError("")
                                }
                              }}
                            />
                          ) : (
                            <Badge className={
                              coverageStatus === 'COVERED' ? "bg-green-100 text-green-800" :
                                coverageStatus === 'LIMIT_EXCEEDED' || coverageStatus === 'EXCEEDED' ? "bg-orange-100 text-orange-800" :
                                  "bg-red-100 text-red-800"
                            }>
                              {coverageStatus === 'COVERED' ? 'Covered' :
                                coverageStatus === 'LIMIT_EXCEEDED' || coverageStatus === 'EXCEEDED' ? 'Limit Exceeded' :
                                  coverageStatus === 'REJECTED' ? 'Rejected' : 'Not Covered'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {isPending ? (
                              <Input
                                value={rejectionReasons[`${index}`] || ""}
                                onChange={(e) => {
                                  setRejectionReasons(prev => ({
                                    ...prev,
                                    [`${index}`]: e.target.value
                                  }))
                                  // Clear validation error when remarks are entered
                                  if (validationError && e.target.value.trim()) {
                                    setValidationError("")
                                  }
                                }}
                                placeholder={!isSelected ? "Required: Enter rejection reason" : "Optional remarks"}
                                className={`text-sm ${!isSelected ? 'border-red-300 focus:border-red-500 bg-red-50' : ''} ${!isSelected && !rejectionReasons[`${index}`]?.trim() ? 'ring-2 ring-red-500' : ''}`}
                                required={!isSelected}
                                aria-required={!isSelected}
                              />
                            ) : (
                              <span className="text-sm text-gray-600">
                                {service.rejection_reason || service.remarks || service.coverageReason || (service.coverage_limit ? `Limit: ₦${service.coverage_limit.toLocaleString()}` : '')}
                              </span>
                            )}
                            {!isSelected && isPending && (
                              <span className="text-xs text-red-600 font-medium">* Required</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Running Total Summary — includes ALL service categories (drugs + services) */}
            {(() => {
              const isPending = request.status === 'PENDING'
              const rows = request.services.map((service, index) => {
                const isSelected = isPending
                  ? (selectedServices[`${index}`] ?? true)
                  : ['COVERED', 'EXCEEDED', 'LIMIT_EXCEEDED'].includes(service.coverage || service.coverage_status || '')
                const price = isPending
                  ? (editedPrices[`${index}`] ?? service.negotiated_price ?? service.final_price ?? service.amount)
                  : service.amount
                const qty = isPending
                  ? (editedQuantities[`${index}`] ?? service.quantity ?? 1)
                  : (service.quantity ?? 1)
                const cat = (service as any).category_id || (service as any).service_category || ''
                const isDrug = cat === 'DRG' || String(cat).toLowerCase().includes('drug') || String(cat).toLowerCase().includes('pharma')
                return { isSelected, price: Number(price) || 0, qty: Number(qty) || 1, isDrug }
              })

              const serviceTotal = rows
                .filter(r => r.isSelected && !r.isDrug)
                .reduce((sum, r) => sum + r.price * r.qty, 0)
              const drugTotal = rows
                .filter(r => r.isSelected && r.isDrug)
                .reduce((sum, r) => sum + r.price * r.qty, 0)
              const grandTotal = serviceTotal + drugTotal

              return (
                <div className="mt-3 flex justify-end">
                  <div className="bg-gray-50 border rounded-lg px-4 py-3 text-sm space-y-1 min-w-[280px]">
                    <div className="flex justify-between text-gray-600">
                      <span>Medical Services</span>
                      <span className="font-medium">₦{serviceTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Drugs / Pharmaceuticals</span>
                      <span className="font-medium">₦{drugTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                      <span>{isPending ? 'Selected Total' : 'Approved Total'}</span>
                      <span>₦{grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )
            })()}
            {validationError && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
                <div className="flex items-start gap-2">
                  <span className="font-semibold">⚠️ Validation Error:</span>
                  <span>{validationError}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {request.status === 'PENDING' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-center gap-4">
                <PermissionGate module="call-centre" action="edit">
                  <Button
                    size="lg"
                    className="bg-[#BE1522] hover:bg-[#9B1219] min-w-[200px]"
                    onClick={handleConfirmRequest}
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Confirm
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="min-w-[200px]"
                    onClick={() => setShowRejectModal(true)}
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Reject Request
                  </Button>
                </PermissionGate>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Previous encounters now live on the dedicated history page */}
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
                disabled={!rejectReason.trim()}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  )
}
