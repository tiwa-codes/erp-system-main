"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Calendar,
  DollarSign,
  Flag,
  Search,
  MoreVertical
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import {


  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface InvestigationClaim {
  id: string
  claim_id: string
  provider_name: string
  amount: number
  enrollee_name: string
  enrollee_id: string
  service_type: string
  flags: number
  date: string
  risk_score: number
  triggered_rules: string[]
  risk_factors: string[]
  provider_history: string
  comments: string[]
}

interface RecentClaim {
  id: string
  date: string
  enrollee_name: string
  enrollee_id: string
  service: string
  approval_code: string
  amount: number
  status: string
}

export default function InvestigationWorkspacePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { id } = params

  const [newComment, setNewComment] = useState("")

  // Fetch investigation claim details
  const { data: claimData, isLoading } = useQuery({
    queryKey: ["investigation-claim", id],
    queryFn: async () => {
      const res = await fetch(`/api/claims/fraud/investigation/${id}`)
      if (!res.ok) {
        throw new Error("Failed to fetch investigation claim")
      }
      return res.json()
    },
  })

  // Fetch recent claims for the same provider
  const { data: recentClaimsData } = useQuery({
    queryKey: ["recent-claims", claimData?.claim?.provider_id],
    queryFn: async () => {
      if (!claimData?.claim?.provider_id) return { claims: [] }
      
      const res = await fetch(`/api/claims/fraud/recent/${claimData.claim.provider_id}`)
      if (!res.ok) {
        throw new Error("Failed to fetch recent claims")
      }
      return res.json()
    },
    enabled: !!claimData?.claim?.provider_id
  })

  const claim = claimData?.claim
  const recentClaims = recentClaimsData?.claims || []

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const res = await fetch(`/api/claims/fraud/investigation/${id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      })
      if (!res.ok) {
        throw new Error('Failed to add comment')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Comment added successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["investigation-claim", id] })
      setNewComment("")
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      })
    },
  })

  // Handle claim actions
  const handleClaimAction = async (action: 'approve' | 'investigate' | 'reject') => {
    try {
      const res = await fetch(`/api/claims/fraud/investigation/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!res.ok) {
        throw new Error(`Failed to ${action} claim`)
      }

      toast({
        title: "Success",
        description: `Claim ${action}d successfully`,
      })
      
      queryClient.invalidateQueries({ queryKey: ["investigation-claim", id] })
      router.push('/claims/fraud')
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} claim`,
        variant: "destructive",
      })
    }
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return
    addCommentMutation.mutate(newComment)
  }

  const handleInvestigateClaim = (claimId: string) => {
    router.push(`/claims/fraud/investigation/${claimId}`)
  }

  // Get action dropdown
  const getActionDropdown = (claim: RecentClaim) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleInvestigateClaim(claim.id)}>
            <Search className="h-4 w-4 mr-2" />
            Investigate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
    <PermissionGate module="claims" action="fraud_detection">
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
            <h1 className="text-3xl font-bold text-gray-900">Investigation Workspace</h1>
            <p className="text-gray-600">Claim {claim.claim_id}</p>
          </div>
        </div>

        {/* Claim Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Claim Details
                </CardTitle>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleClaimAction('approve')}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  Approve
                </Button>
                <Button 
                  onClick={() => handleClaimAction('investigate')}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Send to Investigation
                </Button>
                <Button 
                  onClick={() => handleClaimAction('reject')}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Reject
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Claim ID</label>
                  <p className="text-lg font-semibold">{claim.claim_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Provider Name</label>
                  <p className="text-lg">{claim.provider_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="text-lg font-semibold text-green-600">₦{claim.amount.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Enrollee Name</label>
                  <p className="text-lg">{claim.enrollee_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Service Type</label>
                  <p className="text-lg">{claim.service_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Flags</label>
                  <p className="text-lg">{claim.flags} Flags</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date</label>
                  <p className="text-lg">{new Date(claim.date).toLocaleDateString('en-GB')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Enrollee ID</label>
                  <p className="text-lg">{claim.enrollee_id}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Risk Score</label>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-red-600">{claim.risk_score}%</span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-red-600">HIGH RISK</p>
                      <p className="text-sm text-gray-600">Model Score 0.95 - top reasons below</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Triggered Rules</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {claim.triggered_rules.map((rule: string, index: number) => (
                      <Badge key={index} variant="outline" className="bg-gray-100">
                        {rule}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Investigation Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              Investigation Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Key Findings</h4>
                <ul className="list-disc list-inside space-y-1">
                  {claim.risk_factors.map((factor: string, index: number) => (
                    <li key={index} className="text-sm text-gray-700">{factor}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Provider History & Notes</h4>
                <p className="text-sm text-gray-700">{claim.provider_history}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Add Comment</h4>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add your investigation notes..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button 
                    onClick={handleAddComment}
                    disabled={addCommentMutation.isPending}
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                  >
                    {addCommentMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Claims */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Recent Claims - {claim.provider_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEE NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">APPROVAL CODE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentClaims.map((recentClaim: RecentClaim) => (
                  <TableRow key={recentClaim.id}>
                    <TableCell>
                      {new Date(recentClaim.date).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {recentClaim.enrollee_name}
                    </TableCell>
                    <TableCell>
                      {recentClaim.enrollee_id}
                    </TableCell>
                    <TableCell>
                      {recentClaim.service}
                    </TableCell>
                    <TableCell>
                      {recentClaim.approval_code}
                    </TableCell>
                    <TableCell>
                      ₦{recentClaim.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-red-100 text-red-800">
                        {recentClaim.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getActionDropdown(recentClaim)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
