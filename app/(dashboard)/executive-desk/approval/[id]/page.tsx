"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, Clock, XCircle, FileText, Download, Loader2, ClipboardList, AlertTriangle } from "lucide-react"
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

export default function ProviderApprovalPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const id = params.id as string
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(50)
  const [showApproveAllDialog, setShowApproveAllDialog] = useState(false)
  const [bulkComments, setBulkComments] = useState("")
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [selectedApprovalCode, setSelectedApprovalCode] = useState<string>("")

  // Fetch claims for this provider
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["approval-provider-claims", id, currentPage],
    queryFn: async () => {
      const res = await fetch(`/api/executive-desk/approval?provider=${id}&page=${currentPage}&limit=${limit}`)
      if (!res.ok) throw new Error("Failed to fetch claims")
      return res.json()
    }
  })

  const claims = claimsData?.claims || []
  // Get provider name from the first claim if available, or just a generic title
  const providerName = claims.length > 0 ? claims[0].provider_name : "Provider"

  // Count pending claims at approval stage
  const pendingClaims = claims.filter((c: any) =>
    c.status === 'AUDIT_COMPLETED'
  )

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (data: { provider_id: string; comments: string }) => {
      const res = await fetch('/api/executive-desk/approval/bulk-approve', {
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
      queryClient.invalidateQueries({ queryKey: ['approval-provider-claims', id] })
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
      provider_id: id,
      comments: bulkComments || "Bulk approved by MD"
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>
      case 'AUDIT_COMPLETED':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending Approval</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Overview
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{providerName}</h1>
          <p className="text-gray-600">Approve claims for this provider</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Claims List</CardTitle>
            <CardDescription>
              Showing {claims.length} claims
            </CardDescription>
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
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export List
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No claims found for this provider.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CLAIM ID</TableHead>
                  <TableHead>ENROLLEE</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>ENCOUNTER CODE</TableHead>
                  <TableHead>AMOUNT</TableHead>
                  <TableHead>SUBMITTED</TableHead>
                  <TableHead className="text-right">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim: any) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">{claim.claim_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{claim.enrollee_name}</span>
                          {claim.is_primary_hospital === false && (
                            <div title="Non-Primary Hospital: Potential Fraud/Misuse">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600 animate-pulse" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{claim.enrollee_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(claim.status)}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-blue-600">{claim.encounter_code || claim.claim_number}</TableCell>
                    <TableCell>₦{Number(claim.amount).toLocaleString()}</TableCell>
                    <TableCell>{new Date(claim.submitted_at).toLocaleString('en-GB')}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => router.push(`/executive-desk/approval/process/${claim.id}`)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Process
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 font-bold text-purple-600"
                        onClick={() => {
                          setSelectedApprovalCode(claim.claim_number || claim.id)
                          setShowAuditModal(true)
                        }}
                      >
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Audit Log
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bulk Approve Confirmation Dialog */}
      <Dialog open={showApproveAllDialog} onOpenChange={setShowApproveAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve All Pending Claims</DialogTitle>
            <DialogDescription>
              You are about to approve {pendingClaims.length} pending claim(s) for {providerName}.
              This action will finalize all claims and make them ready for settlement.
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

      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Claim Audit Trail: {selectedApprovalCode}</DialogTitle>
          </DialogHeader>
          <AuditTrailView approvalCode={selectedApprovalCode} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
