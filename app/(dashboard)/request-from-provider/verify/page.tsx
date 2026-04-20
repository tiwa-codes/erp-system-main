"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Search,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building2,
  Calendar,
  FileText,
  AlertCircle
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

export const dynamic = 'force-dynamic'

interface ApprovalCodeDetails {
  enrollee: string
  provider: string
  service: string
  date: string
  linked_claim: string
  status: 'ACTIVE' | 'EXPIRED' | 'USED'
}

export default function VerifyApprovalCodePage() {
  const { toast } = useToast()
  
  // State for verification
  const [approvalCode, setApprovalCode] = useState("")
  const [verificationResult, setVerificationResult] = useState<ApprovalCodeDetails | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Verify approval code mutation
  const verifyApprovalMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`/api/call-centre/verify-approval/${code}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        throw new Error('Failed to verify approval code')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setVerificationResult(data.approval_details)
      toast({
        title: "Success",
        description: "Approval code verified successfully",
      })
    },
    onError: (error: any) => {
      setVerificationResult(null)
      let errorMessage = "Failed to verify approval code"
      
      if (error.message) {
        if (error.message.includes("not found")) {
          errorMessage = "Approval code not found. Please check the code and try again."
        } else if (error.message.includes("expired")) {
          errorMessage = "This approval code has expired and is no longer valid."
        } else if (error.message.includes("used")) {
          errorMessage = "This approval code has already been used."
        } else if (error.message.includes("cancelled")) {
          errorMessage = "This approval code has been cancelled."
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      })
    },
  })

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'EXPIRED':
        return 'bg-red-100 text-red-800'
      case 'USED':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleVerifyCode = () => {
    if (!approvalCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter an approval code",
        variant: "destructive",
      })
      return
    }

    setIsVerifying(true)
    verifyApprovalMutation.mutate(approvalCode.trim())
  }

  const handleClearVerification = () => {
    setApprovalCode("")
    setVerificationResult(null)
  }

  return (
    <PermissionGate module="call-centre" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Verify Approval Code</h1>
            <p className="text-gray-600">Verify and check approval code details</p>
          </div>
        </div>

        {/* Verification Form */}
        <Card>
          <CardHeader>
            <CardTitle>Verify Approval Code</CardTitle>
            <CardDescription className="mt-2">Enter an approval code to verify its details and status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Approval Code Input */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter approval code (e.g., APR-209334)"
                  value={approvalCode}
                  onChange={(e) => setApprovalCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleVerifyCode()}
                />
              </div>
              <Button
                onClick={handleVerifyCode}
                disabled={verifyApprovalMutation.isPending || !approvalCode.trim()}
                className="bg-[#BE1522] hover:bg-[#9B1219]"
              >
                {verifyApprovalMutation.isPending ? "Verifying..." : "Verify"}
              </Button>
            </div>

            {/* Verification Result */}
            {verificationResult && (
              <div className="mt-6">
                <h3 className="text-blue-600 font-semibold mb-4">Approval Code Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Enrollee:</label>
                    <p className="text-sm font-semibold">{verificationResult.enrollee}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Provider:</label>
                    <p className="text-sm font-semibold">{verificationResult.provider}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Service:</label>
                    <p className="text-sm font-semibold">{verificationResult.service}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Date:</label>
                    <p className="text-sm">{verificationResult.date}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Linked Claim:</label>
                    <p className="text-sm font-mono">{verificationResult.linked_claim}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-600">Status:</label>
                    <div className="mt-1">
                      <Badge className={getStatusBadgeColor(verificationResult.status)}>
                        {verificationResult.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {verificationResult && (
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={handleClearVerification}
                >
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              How to Use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <p>1. Enter the approval code in the input field above</p>
              <p>2. Click "Verify" or press Enter to check the code</p>
              <p>3. View the detailed information about the approval code</p>
              <p>4. Check the status to see if the code is active, expired, or used</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
