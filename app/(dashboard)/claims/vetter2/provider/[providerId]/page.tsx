"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  ClipboardList,
  History,
  X,
  Loader2
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { AuditTrailView } from "@/components/claims/AuditTrailView"

export const dynamic = 'force-dynamic'

interface Claim {
  id: string
  claim_number: string
  enrollee_name?: string
  enrollee_id: string
  principal_id?: string
  principal?: {
    id: string
    first_name: string
    last_name: string
    enrollee_id: string
  }
  provider_id: string
  provider?: {
    id: string
    facility_name: string
    facility_type: string
  }
  claim_type: string
  amount: number
  status: string
  submitted_at: string
  processed_at?: string
  encounter_code?: string
  is_primary_hospital?: boolean
  vetting_records?: any[]
}

export default function Vetter2ProviderDetailsPage({ params }: { params: { providerId: string } }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { providerId } = params

  const [currentPage, setCurrentPage] = useState(1)
  const [showApproveAllDialog, setShowApproveAllDialog] = useState(false)
  const [bulkComments, setBulkComments] = useState("")
  const [approvingClaimId, setApprovingClaimId] = useState<string | null>(null)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [selectedClaimForAudit, setSelectedClaimForAudit] = useState<Claim | null>(null)
  const limit = 10

  // Fetch provider details
  const { data: providerData, isLoading: providerLoading } = useQuery({
    queryKey: ["provider", providerId],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${providerId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider details")
      }
      return res.json()
    },
  })

  const provider = providerData

  // Fetch all claims for this provider
  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ["provider-claims-vetter2", providerId],
    queryFn: async () => {
      const params = new URLSearchParams({
        provider: providerId,
        limit: '100' // Get all claims for this provider
      })

      const res = await fetch(`/api/claims/vetter2?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider claims")
      }
      return res.json()
    },
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const claims = claimsData?.claims || []

  // Count pending claims
  const pendingClaims = claims.filter((c: Claim) => {
    const status = (c.status || "").toUpperCase()
    return status === "VETTER1_COMPLETED" || status === "VETTING_IN_PROGRESS" || status === "VETTING"
  })

  const approveClaimMutation = useMutation({
    mutationFn: async (data: { claimId: string; comments?: string }) => {
      const res = await fetch(`/api/claims/${data.claimId}/vetter2/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comments: data.comments || "Approved by Vetter 2",
          serviceVerdicts: []
        })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to approve claim")
      }
      return res.json()
    },
    onMutate: (variables) => {
      setApprovingClaimId(variables.claimId)
    },
    onSuccess: () => {
      toast({
        title: "Approved",
        description: "Claim moved to Audit",
      })
      queryClient.invalidateQueries({ queryKey: ["provider-claims-vetter2", providerId] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve claim",
        variant: "destructive",
      })
    },
    onSettled: () => {
      setApprovingClaimId(null)
    }
  })

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (data: { provider_id: string; comments: string }) => {
      const res = await fetch('/api/claims/vetter2/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to bulk approve')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Successfully approved ${data.approved_count} claims`,
      })
      setShowApproveAllDialog(false)
      setBulkComments("")
      queryClient.invalidateQueries({ queryKey: ['provider-claims-vetter2', providerId] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk approve claims",
        variant: "destructive",
      })
    }
  })

  const handleBulkApprove = () => {
    if (pendingClaims.length === 0) {
      toast({
        title: "No Pending Claims",
        description: "There are no pending claims to approve",
        variant: "destructive",
      })
      return
    }
    setShowApproveAllDialog(true)
  }

  const confirmBulkApprove = () => {
    bulkApproveMutation.mutate({
      provider_id: providerId,
      comments: bulkComments || "Bulk approved by Vetter 2"
    })
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'text-gray-600'

    switch (status.toLowerCase()) {
      case 'submitted':
      case 'under_review':
      case 'vetter1_completed':
        return 'text-yellow-600'
      case 'vetting':
        return 'text-blue-600'
      case 'approved':
        return 'text-green-600'
      case 'rejected':
        return 'text-red-600'
      case 'audited':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusLabel = (status: string) => {
    if (!status) return 'Unknown'
    if (status.toUpperCase() === 'VETTER1_COMPLETED') {
      return 'Pending Vetter 2'
    }
    return status
  }

  const handleApproveClaim = (claim: Claim) => {
    approveClaimMutation.mutate({ claimId: claim.id })
  }

  const navigateToVetting = (claimId: string) => {
    const currentQuery = searchParams.toString()
    const returnTo = currentQuery ? `${pathname}?${currentQuery}` : pathname
    router.push(`/claims/vetter2/vetter/${claimId}?returnTo=${encodeURIComponent(returnTo)}`)
  }

  // Get action dropdown for individual claim
  const getActionDropdown = (claim: Claim) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => router.push(`/claims/vetter2/${claim.id}`)}
            className="w-full justify-start text-xs"
          >
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => navigateToVetting(claim.id)}
            className="w-full justify-start text-xs"
          >
            Vet Claim
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleApproveClaim(claim)}
            disabled={
              (approveClaimMutation.isPending && approvingClaimId === claim.id) ||
              !['VETTER1_COMPLETED', 'VETTING', 'VETTING_IN_PROGRESS'].includes((claim.status || "").toUpperCase())
            }
            className="w-full justify-start text-xs"
          >
            {approveClaimMutation.isPending && approvingClaimId === claim.id ? "Approving..." : "Approve Claim"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setSelectedClaimForAudit(claim)
              setShowAuditModal(true)
            }}
            className="w-full justify-start text-xs"
          >
            <ClipboardList className="h-4 w-4 mr-2 text-yellow-600" />
            Audit Log
          </DropdownMenuItem>
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

  if (providerLoading || claimsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Provider not found</p>
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
                Claims Overview {'>>'} {provider.facility_name}
              </h1>
              <p className="text-gray-600">View and manage claims for this provider</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleBulkApprove}
              disabled={pendingClaims.length === 0 || bulkApproveMutation.isPending}
              className="bg-[#BE1522] hover:bg-[#9B1219]"
            >
              {bulkApproveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve All Pending ({pendingClaims.length})
                </>
              )}
            </Button>
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
          <CardHeader>
            <CardTitle>Provider Claims</CardTitle>
            <CardDescription>
              All claims for {provider.facility_name} ({claims.length} claims)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">CLAIM ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENCOUNTER CODE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim: Claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">
                      {claim.claim_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigateToVetting(claim.id)}
                          className="text-left text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          {claim.enrollee_name || (claim.principal ?
                            `${claim.principal.first_name} ${claim.principal.last_name}` :
                            'Unknown Enrollee'
                          )}
                        </button>
                        {claim.is_primary_hospital === false && (
                          <div title="Non-Primary Hospital: Potential Fraud/Misuse">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600 animate-pulse" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {claim.enrollee_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-blue-600">
                      {claim.encounter_code || claim.claim_number}
                    </TableCell>
                    <TableCell>
                      ₦{claim.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className={getStatusBadgeColor(claim.status)}>
                        {getStatusLabel(claim.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(claim.submitted_at).toLocaleString('en-GB')}
                    </TableCell>
                    <TableCell>
                      {getActionDropdown(claim)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-gray-600">
                Showing {claims.length} results
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
                  Page {currentPage} of {Math.ceil(claims.length / limit)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= Math.ceil(claims.length / limit)}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Approve Confirmation Dialog */}
        <Dialog open={showApproveAllDialog} onOpenChange={setShowApproveAllDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve All Pending Claims</DialogTitle>
              <DialogDescription>
                You are about to approve {pendingClaims.length} pending claim(s) for {provider?.facility_name}.
                This action will move all claims to the Audit stage.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Comments (Optional)</label>
                <Textarea
                  placeholder="Add comments for bulk approval..."
                  value={bulkComments}
                  onChange={(e) => setBulkComments(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowApproveAllDialog(false)
                  setBulkComments("")
                }}
                disabled={bulkApproveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmBulkApprove}
                disabled={bulkApproveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {bulkApproveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Approval
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Approve Confirmation Dialog */}
        <Dialog open={showApproveAllDialog} onOpenChange={setShowApproveAllDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approve All Pending Claims</DialogTitle>
                <DialogDescription>
                  You are about to approve {pendingClaims.length} pending claim(s) for {provider?.facility_name}. 
                  This action will move all claims to the Audit stage.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Comments (Optional)</label>
                  <Textarea
                    placeholder="Add comments for bulk approval..."
                    value={bulkComments}
                    onChange={(e) => setBulkComments(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowApproveAllDialog(false)
                    setBulkComments("")
                  }}
                  disabled={bulkApproveMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmBulkApprove}
                  disabled={bulkApproveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {bulkApproveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Approval
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </div>

      {/* Audit Log Modal */}
      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Claim Audit Trail: {selectedClaimForAudit?.claim_number || selectedClaimForAudit?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedClaimForAudit && (
            <AuditTrailView approvalCode={selectedClaimForAudit.claim_number || selectedClaimForAudit.id} />
          )}
        </DialogContent>
      </Dialog>
    </PermissionGate>
  )
}
