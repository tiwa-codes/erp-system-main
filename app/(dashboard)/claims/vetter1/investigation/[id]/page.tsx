"use client"

export const dynamic = 'force-dynamic'

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
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  Shield,
  Download,
  BarChart3,
  PieChart,
  ArrowLeft,
  Send,
  Upload,
  MessageSquare
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"



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
  fraud_alerts: Array<{
    id: string
    alert_type: string
    severity: string
    description: string
    status: string
  }>
}

interface InvestigationSummary {
  claim_id: string
  provider_name: string
  amount: number
  enrollee_name: string
  service_type: string
  flags: number
  date: string
  enrollee_id: string
  summary: string
  key_findings: string[]
}

export default function InvestigationWorkspacePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { id } = params

  const [investigationComment, setInvestigationComment] = useState("")
  const [actionType, setActionType] = useState("")

  // Fetch claim data for investigation
  const {
    data: claim,
    isLoading,
    error
  } = useQuery({
    queryKey: ["investigation-claim", id],
    queryFn: async () => {
      const res = await fetch(`/api/claims/investigation/${id}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claim for investigation")
      }
      return res.json() as Promise<Claim>
    },
  })

  // Fetch recent claims from same provider
  const { data: recentClaimsData } = useQuery({
    queryKey: ["recent-claims", claim?.provider_id],
    queryFn: async () => {
      if (!claim?.provider_id) return { claims: [] }
      const res = await fetch(`/api/claims/provider/${claim.provider_id}/recent`)
      if (!res.ok) {
        throw new Error("Failed to fetch recent claims")
      }
      return res.json()
    },
    enabled: !!claim?.provider_id
  })

  // Mock investigation summary data
  const investigationSummary: InvestigationSummary = {
    claim_id: claim?.claim_number || "CLM/LH/009",
    provider_name: claim?.provider?.facility_name || "Limi Hospital",
    amount: claim?.amount || 70000,
    enrollee_name: claim?.principal ? `${claim.principal.first_name} ${claim.principal.last_name}` : "Yusuf Yusuf",
    service_type: claim?.claim_type || "CT Scan",
    flags: claim?.fraud_alerts?.length || 3,
    date: claim?.submitted_at ? new Date(claim.submitted_at).toLocaleDateString('en-GB') : "23-08-2025",
    enrollee_id: claim?.principal?.enrollee_id || "CHJ/CC/001",
    summary: "Limi Hospital has been flagged for suspicious billing patterns including duplicate claims, unusually high costs for routine procedures, and claims submitted for services on dates when the facility was closed.",
    key_findings: [
      "15 Duplicate claims submitted within 30 days",
      "Claims for N80,000 in CT Scan on a Sunday when facility was closed",
      "Average claim amount 120% higher than industry standard"
    ]
  }

  // Submit investigation action
  const submitActionMutation = useMutation({
    mutationFn: async (data: { action: string; comment: string }) => {
      const res = await fetch(`/api/claims/investigation/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        throw new Error("Failed to submit investigation action")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Investigation action submitted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["investigation-claim", id] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit investigation action",
        variant: "destructive",
      })
    },
  })

  const handleSubmitAction = () => {
    if (!actionType) {
      toast({
        title: "Error",
        description: "Please select an action type",
        variant: "destructive",
      })
      return
    }

    submitActionMutation.mutate({
      action: actionType,
      comment: investigationComment
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !claim) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load claim for investigation</p>
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
            <p className="text-gray-600">Investigation Workspace &gt;&gt; Claim {investigationSummary.claim_id}</p>
          </div>
        </div>

        {/* Claim Details */}
        <Card>
          <CardHeader>
            <CardTitle>Claim Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Claim ID</label>
                  <p className="text-lg font-semibold">{investigationSummary.claim_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Provider Name</label>
                  <p className="text-lg">{investigationSummary.provider_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="text-lg font-semibold text-green-600">₦{investigationSummary.amount.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Enrollee Name</label>
                  <p className="text-lg">{investigationSummary.enrollee_name}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Service Type</label>
                  <p className="text-lg">{investigationSummary.service_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Flags</label>
                  <p className="text-lg">{investigationSummary.flags} Flags</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date</label>
                  <p className="text-lg">{investigationSummary.date}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Enrollee ID</label>
                  <p className="text-lg">{investigationSummary.enrollee_id}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Investigation Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Investigation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">{investigationSummary.summary}</p>
          </CardContent>
        </Card>

        {/* Key Findings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Key Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {investigationSummary.key_findings.map((finding, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-red-600 mt-1">•</span>
                  <span className="text-gray-700">{finding}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Investigation Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Investigation Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={() => setActionType("approve")}
                className={`${actionType === "approve" ? "bg-green-600" : "bg-green-100 text-green-600"} hover:bg-green-700`}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => setActionType("investigate")}
                className={`${actionType === "investigate" ? "bg-yellow-600" : "bg-yellow-100 text-yellow-600"} hover:bg-yellow-700`}
              >
                <Send className="h-4 w-4 mr-2" />
                Send to Investigation
              </Button>
              <Button
                onClick={() => setActionType("reject")}
                className={`${actionType === "reject" ? "bg-red-600" : "bg-red-100 text-red-600"} hover:bg-red-700`}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Add Comment</label>
              <Textarea
                placeholder="Add your investigation notes..."
                value={investigationComment}
                onChange={(e) => setInvestigationComment(e.target.value)}
                className="min-h-[100px] mt-2"
              />
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleSubmitAction}
                disabled={submitActionMutation.isPending || !actionType}
                className="bg-[#BE1522] hover:bg-[#9B1219] px-8 py-3"
              >
                {submitActionMutation.isPending ? "Submitting..." : "Submit Investigation Action"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Claims from Same Provider */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Claims &gt;&gt; {investigationSummary.provider_name}</CardTitle>
                <CardDescription>Recent claims from the same provider</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentClaimsData?.claims ? (
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
                    <TableHead className="text-xs font-medium text-gray-600">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentClaimsData.claims.map((recentClaim: any) => (
                    <TableRow key={recentClaim.id}>
                      <TableCell>
                        {new Date(recentClaim.submitted_at).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell>
                        {recentClaim.principal ? 
                          `${recentClaim.principal.first_name} ${recentClaim.principal.last_name}` : 
                          recentClaim.enrollee_id
                        }
                      </TableCell>
                      <TableCell>
                        {recentClaim.enrollee_id}
                      </TableCell>
                      <TableCell>
                        {recentClaim.claim_type}
                      </TableCell>
                      <TableCell className="font-medium">
                        {recentClaim.claim_number}
                      </TableCell>
                      <TableCell>
                        ₦{recentClaim.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          recentClaim.status === 'FLAGGED' ? 'bg-red-100 text-red-800' :
                          recentClaim.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          recentClaim.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {recentClaim.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => router.push(`/claims/investigation/${recentClaim.id}`)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Investigate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-gray-500 text-center py-8">No recent claims found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
