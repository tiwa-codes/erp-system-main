"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Search, 
  Filter, 
  Download,
  Upload,
  Calendar,
  ChevronDown,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Send,
  MoreHorizontal
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"

export const dynamic = 'force-dynamic'

interface FlaggedClaim {
  id: string
  claim_number: string
  date: string
  provider: {
    facility_name: string
  }
  amount: number
  risk_score: number
  flags_count: number
  triggered_rules: string[]
  risk_factors: string[]
  provider_history: {
    previous_claims: number
    past_investigations: number
  }
  status?: string
}

export default function FraudDetectionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedProvider, setSelectedProvider] = useState("")
  const [claimId, setClaimId] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedClaim, setSelectedClaim] = useState<FlaggedClaim | null>(null)
  const [comment, setComment] = useState("")
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)

  // Fetch flagged claims
  const { data: claimsData, isLoading } = useQuery({
    queryKey: ["flagged-claims", currentPage, startDate, endDate, selectedProvider, claimId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedProvider && { provider: selectedProvider }),
        ...(claimId && { claim_id: claimId }),
      })
      
      const res = await fetch(`/api/claims/fraud/flagged?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch flagged claims")
      }
      return res.json()
    },
  })

  const claims = claimsData?.claims || []
  const pagination = claimsData?.pagination

  // Fetch providers for dropdown
  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers")
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  const providers = providersData?.providers || []

  // Approve claim mutation
  const approveClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const res = await fetch(`/api/claims/fraud/investigation/${claimId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment })
      })
      if (!res.ok) {
        throw new Error("Failed to approve claim")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Claim approved successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["flagged-claims"] })
      setSelectedClaim(null)
      setComment("")
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve claim",
        variant: "destructive",
      })
    },
  })

  // Send to investigation mutation
  const investigateClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const res = await fetch(`/api/claims/fraud/investigation/${claimId}/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment })
      })
      if (!res.ok) {
        throw new Error("Failed to send claim for investigation")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Claim sent for investigation",
      })
      queryClient.invalidateQueries({ queryKey: ["flagged-claims"] })
      setSelectedClaim(null)
      setComment("")
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send claim for investigation",
        variant: "destructive",
      })
    },
  })

  // Reject claim mutation
  const rejectClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const res = await fetch(`/api/claims/fraud/investigation/${claimId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment })
      })
      if (!res.ok) {
        throw new Error("Failed to reject claim")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Claim rejected successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["flagged-claims"] })
      setSelectedClaim(null)
      setComment("")
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject claim",
        variant: "destructive",
      })
    },
  })

  // Save comment mutation
  const saveCommentMutation = useMutation({
    mutationFn: async ({ claimId, comment }: { claimId: string; comment: string }) => {
      const res = await fetch(`/api/claims/fraud/investigation/${claimId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment })
      })
      if (!res.ok) {
        throw new Error("Failed to save comment")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Comment saved successfully",
      })
      setComment("")
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save comment",
        variant: "destructive",
      })
    },
  })

  const handleInvestigate = (claim: FlaggedClaim) => {
    router.push(`/fraud-detection/flagged-claims/investigation/${claim.id}`)
  }

  const handleApprove = () => {
    if (selectedClaim) {
      approveClaimMutation.mutate(selectedClaim.id)
    }
  }

  const handleInvestigateAction = () => {
    if (selectedClaim) {
      investigateClaimMutation.mutate(selectedClaim.id)
    }
  }

  const handleReject = () => {
    if (selectedClaim) {
      rejectClaimMutation.mutate(selectedClaim.id)
    }
  }

  const handleSaveComment = () => {
    if (selectedClaim && comment.trim()) {
      saveCommentMutation.mutate({ claimId: selectedClaim.id, comment })
    }
  }

  const handleExportExcel = () => {
    // TODO: Implement Excel export
    toast({
      title: "Export Started",
      description: "Excel export will be downloaded shortly",
    })
  }

  // Create test data mutation
  const createTestDataMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/claims/fraud/test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        throw new Error('Failed to create test data')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      })
      queryClient.invalidateQueries({ queryKey: ["flagged-claims"] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create test data",
        variant: "destructive",
      })
    },
  })

  const handleBulkUpload = () => {
    setShowBulkUploadModal(true)
  }

  const handleBulkUploadSuccess = (data: any[]) => {
    toast({
      title: "Bulk Upload Successful",
      description: `${data.length} flagged claims uploaded successfully`,
    })
    queryClient.invalidateQueries({ queryKey: ["flagged-claims"] })
    setShowBulkUploadModal(false)
  }

  const handleCreateTestData = () => {
    createTestDataMutation.mutate()
  }

  const handleApplyFilter = () => {
    setCurrentPage(1)
  }

  const getRiskBadgeColor = (riskScore: number) => {
    if (riskScore >= 90) return 'bg-red-100 text-red-800'
    if (riskScore >= 70) return 'bg-orange-100 text-orange-800'
    if (riskScore >= 50) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getRiskLevel = (riskScore: number) => {
    if (riskScore >= 90) return 'HIGH RISK'
    if (riskScore >= 70) return 'MEDIUM RISK'
    if (riskScore >= 50) return 'LOW RISK'
    return 'MINIMAL RISK'
  }

  return (
    <PermissionGate module="claims" action="fraud_detection">
      <div className="space-y-6">
        {/* Filter by Risk Level */}
        <Card>
          <CardHeader>
            <CardTitle>Filter by Risk Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <div className="relative">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pr-8"
                  />
                  <Calendar className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <div className="relative">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pr-8"
                  />
                  <Calendar className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Provider</label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.map((provider: any) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.facility_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Claim ID</label>
                <div className="relative">
                  <Input
                    placeholder="Claim ID"
                    value={claimId}
                    onChange={(e) => setClaimId(e.target.value)}
                    className="pr-8"
                  />
                  {claimId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-6 w-6 p-0"
                      onClick={() => setClaimId("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyFilter} className="bg-[#BE1522] hover:bg-[#9B1219]">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filter
                </Button>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleBulkUpload} className="bg-[#BE1522] hover:bg-[#9B1219]">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              <Button 
                onClick={handleCreateTestData}
                disabled={createTestDataMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {createTestDataMutation.isPending ? "Creating..." : "Create Test Data"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Flagged Claims */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Flagged Claims</CardTitle>
                <CardDescription className="mt-2">Claims flagged by fraud detection system</CardDescription>
              </div>
              <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700">
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CLAIM ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">RISK %</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">FLAGS</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((claim: FlaggedClaim) => (
                      <TableRow key={claim.id}>
                        <TableCell>{new Date(claim.date).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-blue-600"
                            onClick={() => setSelectedClaim(claim)}
                          >
                            {claim.claim_number}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-red-400">
                                {claim.provider.facility_name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{claim.provider.facility_name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>₦{claim.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={getRiskBadgeColor(claim.risk_score)}>
                            {claim.risk_score}%
                          </Badge>
                        </TableCell>
                        <TableCell>{claim.flags_count} Flag{claim.flags_count !== 1 ? 's' : ''}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => setSelectedClaim(claim)}
                                className="w-full justify-start text-xs"
                              >
                                View Details
                              </DropdownMenuItem>
                              {(claim.status !== 'APPROVED' && claim.status !== undefined) && (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedClaim(claim)
                                      handleApprove()
                                    }}
                                    className="w-full justify-start text-xs"
                                  >
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedClaim(claim)
                                      handleInvestigateAction()
                                    }}
                                    className="w-full justify-start text-xs"
                                  >
                                    Send to Investigation
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedClaim(claim)
                                      handleReject()
                                    }}
                                    className="text-red-600 w-full justify-start text-xs"
                                  >
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                        disabled={pagination.page === pagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detailed Claim View */}
        {selectedClaim && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {selectedClaim.claim_number} - ₦{selectedClaim.amount.toLocaleString()}
                  </CardTitle>
                  <CardDescription>
                    {selectedClaim.provider.facility_name} • {new Date(selectedClaim.date).toLocaleDateString('en-GB')}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={approveClaimMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={handleInvestigateAction}
                    disabled={investigateClaimMutation.isPending}
                    className="bg-yellow-600 hover:bg-yellow-700"
                    size="sm"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send to Investigation
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={rejectClaimMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                    size="sm"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Assessment */}
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-2">
                      <span className="text-2xl font-bold text-red-600">{selectedClaim.risk_score}%</span>
                    </div>
                    <p className="text-sm font-medium text-red-600">{getRiskLevel(selectedClaim.risk_score)}</p>
                    <p className="text-xs text-gray-600">Model Score 0.95 - top reasons below.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Triggered Rules</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedClaim.triggered_rules.map((rule, index) => (
                        <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-800">
                          {rule}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Details and Actions */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Top Risk Factors</h4>
                    <div className="space-y-2">
                      {selectedClaim.risk_factors.map((factor, index) => (
                        <p key={index} className="text-sm text-gray-600">{factor}</p>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Provider history & notes</h4>
                    <p className="text-sm text-gray-600">
                      {selectedClaim.provider.facility_name} - previous claims: {selectedClaim.provider_history.previous_claims} • past investigations: {selectedClaim.provider_history.past_investigations}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Add Comment</label>
                    <Textarea
                      placeholder="Add your comment here..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="mt-1"
                    />
                    <Button
                      onClick={handleSaveComment}
                      disabled={saveCommentMutation.isPending || !comment.trim()}
                      className="mt-2 bg-[#BE1522] hover:bg-[#9B1219]"
                      size="sm"
                    >
                      {saveCommentMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        module="fraud-detection"
        onUploadSuccess={handleBulkUploadSuccess}
        uploadEndpoint="/api/claims/fraud/bulk-upload"
        sampleFileName="flagged-claims-sample.xlsx"
        acceptedColumns={[
          "claim_number",
          "provider_id",
          "amount",
          "risk_score",
          "flags_count",
          "triggered_rules",
          "risk_factors"
        ]}
      />
    </PermissionGate>
  )
}
