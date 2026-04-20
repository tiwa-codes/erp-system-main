"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  X,
  ClipboardList
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AuditTrailView } from "@/components/claims/AuditTrailView"



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
  // Manual-code fields
  code_deleted?: boolean
  manual_code?: string | null
}

interface ClaimService {
  id: string
  service_name: string
  amount: number
  status: string
  approval_code: string
}

export default function Vetter1DetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const billType = (searchParams.get("bill_type") || "auto") as "auto" | "manual"
  const { toast } = useToast()
  const { id } = params

  const [selectedClaimForModal, setSelectedClaimForModal] = useState<Claim | null>(null)
  const [selectedClaimForAudit, setSelectedClaimForAudit] = useState<Claim | null>(null)
  const [showClaimDetailsModal, setShowClaimDetailsModal] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 10

  // Fetch claims for this provider from Vetter1 API
  const { data: claimsData, isLoading, error } = useQuery({
    queryKey: ["vetter1-claims", id, billType],
    queryFn: async () => {
      const params = new URLSearchParams({
        provider: id,
        limit: "100",
        bill_type: billType,
      });

      const res = await fetch(`/api/claims/vetter1?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider claims")
      }
      return res.json()
    },
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const claims = claimsData?.claims || []
  const pagination = claimsData?.pagination || { page: currentPage, limit, total: claims.length, pages: 1 }

  // Helper function to get provider information from first claim
  const providerName = claims.length > 0 ? claims[0].provider_name : "Provider"
  const navigateToVetting = (claimId: string) => {
    const currentQuery = searchParams.toString()
    const returnTo = currentQuery ? `${pathname}?${currentQuery}` : pathname
    router.push(`/claims/vetter1/vetter/${claimId}?returnTo=${encodeURIComponent(returnTo)}`)
  }

  // Create simple service data from claims
  const claimServices: ClaimService[] = claims.map((claim: any, index: number) => ({
    id: claim.id,
    service_name: 'General Service',
    amount: Number(claim.amount || 0),
    status: claim.status, // Use the actual status from the claim
    approval_code: claim.claim_number
  }))

  // Get status badge with proper mapping
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      NEW: { color: "bg-orange-100 text-orange-800", icon: Clock, label: "New" },
      SUBMITTED: { color: "bg-blue-100 text-blue-800", icon: Clock, label: "Submitted" },
      UNDER_REVIEW: { color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle, label: "Under Review" },
      VETTING: { color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle, label: "Vetting" },
      VETTER1_COMPLETED: { color: "bg-purple-100 text-purple-800", icon: CheckCircle, label: "Vetter1 Completed" },
      VETTER2_COMPLETED: { color: "bg-indigo-100 text-indigo-800", icon: CheckCircle, label: "Vetter2 Completed" },
      AUDIT_COMPLETED: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Audit Completed" },
      APPROVED: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Approved" },
      REJECTED: { color: "bg-red-100 text-red-800", icon: XCircle, label: "Rejected" },
      DELETED: { color: "bg-red-100 text-red-800", icon: XCircle, label: "Deleted" },
      PAID: { color: "bg-purple-100 text-purple-800", icon: CheckCircle, label: "Paid" },
      FLAGGED: { color: "bg-red-100 text-red-800", icon: AlertTriangle, label: "Flagged" },
      PENDING: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pending" },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-100 text-gray-800",
      icon: AlertTriangle,
      label: status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    }
    const Icon = config.icon

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  // Get action dropdown
  const getActionDropdown = (service: ClaimService) => {
    const claim = claims.find((c: any) => c.id === service.id)
    const isCodeDeleted = !!(claim as any)?.code_deleted
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
          {!isCodeDeleted && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  navigateToVetting(service.id)
                }}
                className="w-full justify-start text-xs"
              >
                Vet
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedClaimForAudit(claim as Claim)
                  setShowAuditModal(true)
                }}
                className="w-full justify-start text-xs"
              >
                Audit Log
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

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

  if (claims.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">No claims found for this provider</p>
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
              onClick={() => router.push(`/claims/vetter1${billType === "manual" ? "?tab=manual" : ""}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Vetter 1 &gt;&gt; {billType === "manual" ? "Manual Bills" : "Auto Bills"} &gt;&gt; {providerName}
              </h1>
              <p className="text-gray-600">View and manage {billType === "manual" ? "manual approval code" : "auto"} claims for this provider</p>
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

        {/* Claims List */}

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <CardTitle>Claims List</CardTitle>
            <CardDescription>
              All claims for {providerName}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENCOUNTER CODE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">COMMENTS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimServices.map((service) => {
                  const claim = claims.find((c: any) => c.id === service.id)
                  const isCodeDeleted = !!(claim as any)?.code_deleted
                  return (
                    <TableRow key={service.id} className={isCodeDeleted ? "opacity-60 bg-gray-50" : undefined}>
                      <TableCell>
                        {claim ? new Date(claim.submitted_at).toLocaleString('en-GB') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {isCodeDeleted ? (
                            <span className="text-left text-gray-700">
                              {claim?.enrollee_name || 'Unknown Enrollee'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => claim && navigateToVetting(claim.id)}
                              className="text-left text-blue-700 hover:text-blue-900 hover:underline"
                            >
                              {claim?.enrollee_name || 'Unknown Enrollee'}
                            </button>
                          )}
                          {claim?.is_primary_hospital === false && (
                            <div title="Non-Primary Hospital: Potential Fraud/Misuse">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600 animate-pulse" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {claim?.enrollee_id || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {service.service_name}
                      </TableCell>
                      <TableCell className="font-mono">
                        {claim?.encounter_code || '-'}
                      </TableCell>
                      <TableCell>
                        ₦{service.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(isCodeDeleted ? "DELETED" : service.status)}
                      </TableCell>
                      <TableCell>
                        {claim?.vetting_records?.[0]?.findings ? (
                          <div className="max-w-xs">
                            <p className="text-xs text-gray-600 truncate" title={claim.vetting_records[0].findings}>
                              {claim.vetting_records[0].findings}
                            </p>
                            {claim.vetting_records[0].recommendations === 'REJECTED' && (
                              <Badge variant="destructive" className="text-xs mt-1">
                                Rejected
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getActionDropdown(service)}
                      </TableCell>
                    </TableRow>
                  )
                })}
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
        {/* Audit Log Modal */}
        <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Claim Audit Trail: {selectedClaimForAudit?.claim_number}</DialogTitle>
            </DialogHeader>
            {selectedClaimForAudit && (
              <AuditTrailView approvalCode={selectedClaimForAudit.claim_number} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  )
}
