"use client"

export const dynamic = 'force-dynamic'

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
import { ApprovalCodeTimeline } from "@/components/approval-code-timeline"



interface ApprovalCodeDetails {
    approval_code: string
    enrollee: string
    provider: string
    service: string
    diagnosis: string
    amount: string
    admission_required: boolean
    date: string
    generated_by: string
    linked_claim: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL'
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
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to verify approval code')
            }
            return res.json()
        },
        onSuccess: (data) => {
            setVerificationResult(data.approval_details)
            setIsVerifying(false)
            toast({
                title: "Success",
                description: "Approval code verified successfully",
            })
        },
        onError: (error: any) => {
            setVerificationResult(null)
            setIsVerifying(false)
            let errorMessage = "Failed to verify approval code"

            if (error.message) {
                errorMessage = error.message
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
        switch (status?.toUpperCase()) {
            case 'PENDING':
                return 'bg-yellow-100 text-yellow-800'
            case 'APPROVED':
                return 'bg-green-100 text-green-800'
            case 'REJECTED':
                return 'bg-red-100 text-red-800'
            case 'PARTIAL':
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
        <PermissionGate module="claims" action="view">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Verify Approval Code</h1>
                        <p className="text-gray-600">Verify and check approval code details for claims</p>
                    </div>
                </div>

                {/* Verification Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Verify Approval Code</CardTitle>
                        <CardDescription className="mt-2">Enter an approval code or encounter code to verify its details and status</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Approval Code Input */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Input
                                    placeholder="Enter approval code (e.g., APR-209334 or ENC2510270001)"
                                    value={approvalCode}
                                    onChange={(e) => setApprovalCode(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleVerifyCode()}
                                    className="font-mono"
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
                            <div className="mt-6 border-t pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Code Details</h3>
                                    <Badge className={getStatusBadgeColor(verificationResult.status)}>
                                        {verificationResult.status}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Approval Code */}
                                    <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg">
                                        <label className="text-sm font-medium text-gray-600">Code:</label>
                                        <p className="text-xl font-mono font-bold text-blue-600 mt-1">{verificationResult.approval_code}</p>
                                    </div>

                                    {/* Enrollee */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <User className="h-4 w-4 text-gray-600" />
                                            <label className="text-sm font-medium text-gray-600">Enrollee:</label>
                                        </div>
                                        <p className="text-sm font-semibold">{verificationResult.enrollee}</p>
                                    </div>

                                    {/* Provider */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Building2 className="h-4 w-4 text-gray-600" />
                                            <label className="text-sm font-medium text-gray-600">Provider:</label>
                                        </div>
                                        <p className="text-sm font-semibold">{verificationResult.provider}</p>
                                    </div>

                                    {/* Service */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="h-4 w-4 text-gray-600" />
                                            <label className="text-sm font-medium text-gray-600">Service:</label>
                                        </div>
                                        <p className="text-sm">{verificationResult.service}</p>
                                    </div>

                                    {/* Diagnosis */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <AlertCircle className="h-4 w-4 text-gray-600" />
                                            <label className="text-sm font-medium text-gray-600">Diagnosis:</label>
                                        </div>
                                        <p className="text-sm">{verificationResult.diagnosis}</p>
                                    </div>

                                    {/* Amount */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Amount:</label>
                                        <p className="text-sm font-semibold text-green-600">₦{parseFloat(verificationResult.amount).toLocaleString()}</p>
                                    </div>

                                    {/* Admission Required */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-600">Admission Required:</label>
                                        <p className="mt-1">
                                            <Badge className={verificationResult.admission_required ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}>
                                                {verificationResult.admission_required ? 'Yes' : 'No'}
                                            </Badge>
                                        </p>
                                    </div>

                                    {/* Date */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Calendar className="h-4 w-4 text-gray-600" />
                                            <label className="text-sm font-medium text-gray-600">Date Generated:</label>
                                        </div>
                                        <p className="text-sm">{verificationResult.date}</p>
                                    </div>

                                    {/* Generated By */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <User className="h-4 w-4 text-gray-600" />
                                            <label className="text-sm font-medium text-gray-600">Generated By:</label>
                                        </div>
                                        <p className="text-sm">{verificationResult.generated_by}</p>
                                    </div>

                                    {/* Linked Claim */}
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-gray-600">Linked Claim:</label>
                                        <p className="text-sm font-mono mt-1">{verificationResult.linked_claim}</p>
                                    </div>
                                </div>

                                {/* Status Information */}
                                <div className="mt-6">
                                    {verificationResult.status === 'APPROVED' && (
                                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm text-green-900 font-semibold">Approved</p>
                                                    <p className="text-sm text-green-700 mt-1">This code has been approved and can be used for claims.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {verificationResult.status === 'REJECTED' && (
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm text-red-900 font-semibold">Rejected</p>
                                                    <p className="text-sm text-red-700 mt-1">This code has been rejected and cannot be used.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {verificationResult.status === 'PARTIAL' && (
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm text-blue-900 font-semibold">Partially Approved</p>
                                                    <p className="text-sm text-blue-700 mt-1">This code has been partially approved. Some services may be excluded.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {verificationResult.status === 'PENDING' && (
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm text-yellow-900 font-semibold">Active Encounter Code</p>
                                                    <p className="text-sm text-yellow-700 mt-1">This is an active encounter code awaiting claim submission or processing.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                            <p>1. Enter the approval code or encounter code in the input field above</p>
                            <p>2. Click "Verify" or press Enter to check the code</p>
                            <p>3. View the detailed information about the code</p>
                            <p>4. Check the status: PENDING (active), APPROVED, REJECTED, or PARTIAL</p>
                            <div className="mt-4 pt-4 border-t">
                                <p className="text-xs text-gray-500">
                                    <strong>Note:</strong> Approval codes start with "APR-" while encounter codes start with "ENC".
                                    Both types can be verified using this tool.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Timeline Section - Show when verification result exists */}
                {verificationResult && (
                    <ApprovalCodeTimeline approvalCode={verificationResult.approval_code} />
                )}
            </div>
        </PermissionGate>
    )
}
