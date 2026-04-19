"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  ArrowLeft,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Shield,
  Search,
  MoreHorizontal,
  X
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Claim {
  id: string
  claim_number: string
  enrollee_id: string
  principal_id?: string
  principal?: {
    id: string
    first_name: string
    last_name: string
    enrollee_id: string
  }
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string[]
  }
  claim_type: string
  amount: number
  status: string
  submitted_at: string
  processed_at?: string
  approval_code?: string
  service_type?: string
  approval_codes?: Array<{
    approval_code: string
    service_items: ClaimService[]
  }>
}

interface ClaimService {
  id: string
  service_name: string
  amount: number
  service_amount?: number | string
  status: string
  approval_code?: string
  is_initial?: boolean // Flag to identify post-approval services
  added_at?: string
  added_by?: {
    first_name?: string
    last_name?: string
  } | string
}

export default function ClaimDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { id } = params

  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [showClaimDetailsModal, setShowClaimDetailsModal] = useState(false)
  const [selectedClaimForModal, setSelectedClaimForModal] = useState<Claim | null>(null)

  // Fetch claim data
  const {
    data: claimData,
    isLoading,
    error
  } = useQuery({
    queryKey: ["claim-details", id],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${id}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claim")
      }
      return res.json() as Promise<{ claim: Claim }>
    },
  })

  // Fetch related claims from same provider
  const { data: relatedClaimsData } = useQuery({
    queryKey: ["related-claims", claimData?.claim?.provider_id],
    queryFn: async () => {
      if (!claimData?.claim?.provider_id) return { claims: [] }
      const res = await fetch(`/api/claims/provider/${claimData.claim.provider_id}?page=${currentPage}&limit=${limit}`)
      if (!res.ok) {
        throw new Error("Failed to fetch related claims")
      }
      return res.json()
    },
    enabled: !!claimData?.claim?.provider_id
  })

  const claim = claimData?.claim
  const relatedClaims = relatedClaimsData?.claims || []
  const pagination = relatedClaimsData?.pagination

  // Get claim services from approval codes
  const claimServices: ClaimService[] = claim?.approval_codes && claim.approval_codes.length > 0
    ? claim.approval_codes.flatMap(approvalCode => 
        approvalCode.service_items.map(service => ({
          id: service.id,
          service_name: service.service_name,
          amount: Number(service.service_amount ?? service.amount ?? 0),
          status: claim.status || "PENDING",
          approval_code: approvalCode.approval_code,
          is_initial: service.is_initial,
          added_at: service.added_at?.toString(),
          added_by: typeof service.added_by === "string"
            ? service.added_by
            : service.added_by
              ? `${service.added_by.first_name || ""} ${service.added_by.last_name || ""}`.trim()
              : undefined
        }))
      )
    : []

  // Get status text color
  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'text-gray-600'
    
    switch (status.toLowerCase()) {
      case 'pending':
        return 'text-yellow-600'
      case 'rejected':
        return 'text-red-600'
      case 'flagged':
        return 'text-red-600'
      case 'vetted':
        return 'text-green-600'
      case 'approved':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  // Get action dropdown - horizontal dropdown icon
  const getActionDropdown = (service: ClaimService) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem 
            onClick={() => {
              if (claim) {
                setSelectedClaimForModal(claim as Claim)
                setShowClaimDetailsModal(true)
              }
            }}
            className="w-full justify-start text-xs"
          >
            View
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => router.push(`/claims/vetter/${id}`)}
            className="w-full justify-start text-xs"
          >
            Vet
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => {
              if (service.status.toLowerCase() !== 'flagged') {
                toast({
                  title: "Action Not Allowed",
                  description: "Investigation can only be triggered for flagged claims.",
                  variant: "destructive",
                })
              } else {
                router.push(`/claims/investigation/${id}`)
              }
            }}
            className="w-full justify-start text-xs"
          >
            Investigate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Calculate total amount
  const totalAmount = claimServices.reduce((sum, service) => {
    return service.status.toLowerCase() !== 'rejected' ? sum + service.amount : sum
  }, 0)

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Excel file is being generated...",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
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

  return (
    <PermissionGate module="claims" action="view">
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
                <h1 className="text-3xl font-bold text-gray-900">
                  Claims Overview &gt;&gt; {claim.provider.facility_name}
                </h1>
                <p className="text-gray-600">View and manage claims for this provider</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleExport} 
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>

          {/* Claims Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">APPROVAL CODE</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                    <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claimServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        {new Date(claim.submitted_at).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell>
                        {claim.principal ? 
                          `${claim.principal.first_name} ${claim.principal.last_name}` : 
                          'Unknown Enrollee'
                        }
                      </TableCell>
                      <TableCell className="font-mono">
                        {claim.enrollee_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={service.is_initial === false ? "text-red-600 font-semibold" : ""}>
                            {service.service_name}
                          </span>
                          {service.is_initial === false && (
                            <Badge variant="destructive" className="text-xs">Added Later</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {service.approval_code || '-'}
                      </TableCell>
                      <TableCell>
                        ₦{service.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={getStatusBadgeColor(service.status)}>
                          {service.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getActionDropdown(service)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-gray-600">
                  Showing 1 of {claimServices.length} result
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {Math.ceil(claimServices.length / limit)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= Math.ceil(claimServices.length / limit)}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
      </div>

      {/* Claim Details Modal */}
      {showClaimDetailsModal && selectedClaimForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-blue-600">Claim Details</h2>
                <p className="text-blue-600">Claim Details &gt;&gt; {selectedClaimForModal.principal ? 
                  `${selectedClaimForModal.principal.first_name} ${selectedClaimForModal.principal.last_name}` : 
                  'Unknown Enrollee'
                }</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowClaimDetailsModal(false)
                  setSelectedClaimForModal(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Claim Details Content */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {/* Left Column */}
                <div className="space-y-2">
                  <p><span className="font-semibold">Approval Code:</span> {selectedClaimForModal.approval_code || 'APR/2025/07/23'}</p>
                  <p><span className="font-semibold">Date of Claim:</span> {new Date(selectedClaimForModal.submitted_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p><span className="font-semibold">Service Type:</span> {selectedClaimForModal.claim_type || 'Consultation'}</p>
                  <p><span className="font-semibold">Amount:</span> ₦{selectedClaimForModal.amount?.toLocaleString() || '4,000'}</p>
                  <p>
                    <span className="font-semibold">Status:</span>{' '}
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                      {selectedClaimForModal.status || 'Pending'}
                    </span>
                  </p>
                  <p><span className="font-semibold">Price Limit Used:</span> ₦430,500</p>
                </div>

                {/* Right Column */}
                <div className="space-y-2">
                  <p><span className="font-semibold">Enrollee:</span> {selectedClaimForModal.principal ? 
                    `${selectedClaimForModal.principal.first_name} ${selectedClaimForModal.principal.last_name} (${selectedClaimForModal.principal.enrollee_id})` : 
                    'Unknown Enrollee'
                  }</p>
                  <p><span className="font-semibold">Provider:</span> {selectedClaimForModal.provider?.facility_name || 'Limi Hospital'}</p>
                  <p><span className="font-semibold">Band:</span> Band C</p>
                  <p><span className="font-semibold">Plan:</span> Gold SME</p>
                  <p><span className="font-semibold">Date of Service:</span> {new Date(selectedClaimForModal.submitted_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p><span className="font-semibold">Price Limit Remaining:</span> ₦570,500</p>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <h3 className="text-base font-semibold text-blue-600">Claim Description</h3>
                <p className="text-sm">Patient treated for Malaria with full blood test and consultation.</p>
              </div>

              <div className="border-t pt-6 flex justify-center">
                <Button 
                  className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
                  onClick={() => {
                    setShowClaimDetailsModal(false)
                    setSelectedClaimForModal(null)
                    router.push(`/claims/vetter/${id}`)
                  }}
                >
                  Vet
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PermissionGate>
  )
}
