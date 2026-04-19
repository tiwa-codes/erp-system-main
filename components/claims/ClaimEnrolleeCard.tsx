import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Building, Calendar, CreditCard, Shield, Clock, ClipboardList, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AuditTrailView } from "./AuditTrailView"
import { cn } from "@/lib/utils"

interface EnrolleeData {
    first_name: string
    last_name: string
    enrollee_id: string
    gender?: string
    age?: number
    account_type?: string
    start_date?: string | Date
    end_date?: string | Date
    organization?: {
        name: string
    }
    plan?: {
        name: string
        plan_type: string
        annual_limit: number
    }
}

interface ClaimEnrolleeCardProps {
    principal?: EnrolleeData
    beneficiary?: any
    enrollee_id: string
    enrollee_band?: string
    utilization?: {
        amount_utilized: number
        balance: number
    }
    approvalCode?: string // The code to fetch audit trail
    encounterCode?: string // The actual code to display as Encounter Code
    isPrimaryHospital?: boolean
}

export function ClaimEnrolleeCard({
    principal,
    beneficiary,
    enrollee_id,
    enrollee_band,
    utilization,
    approvalCode,
    encounterCode,
    isPrimaryHospital = true
}: ClaimEnrolleeCardProps) {
    const [showAuditModal, setShowAuditModal] = useState(false)
    const isDependent = !!beneficiary
    const displayName = isDependent
        ? `${beneficiary.first_name} ${beneficiary.last_name}`
        : principal
            ? `${principal.first_name} ${principal.last_name}`
            : enrollee_id

    const displayId = isDependent ? beneficiary.dependent_id || enrollee_id : principal?.enrollee_id || enrollee_id
    const gender = principal?.gender || 'N/A'
    const age = principal?.age || 'N/A'
    const orgName = principal?.organization?.name || 'N/A'
    const planName = principal?.plan?.name || 'N/A'
    const accountType = principal?.account_type || (isDependent ? 'DEPENDENT' : 'PRINCIPAL')

    const formatDate = (date?: string | Date) => {
        if (!date) return 'N/A'
        return new Date(date).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short'
        })
    }

    return (
        <Card className={cn(
            "overflow-hidden shadow-sm",
            isPrimaryHospital ? "border-blue-100" : "border-red-200"
        )}>
            <CardHeader className={cn(
                "py-3 border-b",
                isPrimaryHospital ? "bg-blue-50/50 border-blue-100" : "bg-red-50/50 border-red-200"
            )}>
                <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                        {!isPrimaryHospital && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold uppercase animate-pulse">
                                <AlertTriangle className="h-3 w-3" />
                                Fraud/Misuse Alert: Non-Primary Hospital
                            </div>
                        )}
                        <User className={cn("h-5 w-5", isPrimaryHospital ? "text-blue-600" : "text-red-600")} />
                        <span className={cn(
                            "font-bold",
                            isPrimaryHospital ? "text-blue-900" : "text-red-900"
                        )}>
                            Enrollee Information
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAuditModal(true)}
                            className="h-7 text-[10px] font-bold gap-1 bg-white hover:bg-white/80 border-blue-200 text-blue-700 shadow-sm"
                        >
                            <ClipboardList className="h-3.5 w-3.5" />
                            AUDIT LOG
                        </Button>
                        <Badge variant={accountType === 'PRINCIPAL' ? 'default' : 'outline'} className="uppercase text-[10px]">
                            {accountType}
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                {!isPrimaryHospital && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-red-800">Fraud & Misuse Indicator</p>
                            <p className="text-xs text-red-700">
                                This enrollee's primary hospital is not where this claim is coming from.
                                Please verify the legitimacy of this service to prevent fraud and misuse.
                            </p>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Info */}
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</p>
                            <p className="text-lg font-bold text-gray-900">{displayName}</p>
                        </div>
                        <div className="flex gap-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollee ID</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <CreditCard className="h-4 w-4 text-gray-400" />
                                    <span className="font-semibold text-gray-700">{displayId}</span>
                                </div>
                            </div>
                            <div className="pl-4 border-l">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Gender / Age</p>
                                <p className="font-semibold text-gray-700 mt-1">{gender} / {age} yrs</p>
                            </div>
                        </div>
                    </div>

                    {/* Org & Plan */}
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <Building className="h-4 w-4 text-gray-400" />
                                <span className="font-semibold text-gray-700">{orgName}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Benefit Plan</p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <Shield className="h-4 w-4 text-blue-400" />
                                <span className="font-semibold text-blue-700">{planName}</span>
                                <Badge variant="secondary" className="ml-1 px-1 h-4 text-[9px] uppercase">
                                    {principal?.plan?.plan_type || 'N/A'}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Dates & Status */}
                    <div className="space-y-3">
                        <div className="flex gap-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Validity Period</p>
                                <div className="flex items-center gap-1.5 mt-1 font-semibold text-gray-700">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    <span>{formatDate(principal?.start_date)} - {formatDate(principal?.end_date)}</span>
                                </div>
                            </div>
                        </div>

                        {encounterCode && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-100 mb-2">
                                <p className="text-[10px] font-bold text-blue-700 uppercase">Encounter Code</p>
                                <p className="text-sm font-black text-blue-900 font-mono">
                                    {encounterCode}
                                </p>
                            </div>
                        )}

                        {utilization && (
                            <div className="p-2 bg-green-50 rounded border border-green-100">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-bold text-green-700 uppercase">Limit Balance</p>
                                        <p className="text-lg font-black text-green-700 leading-none">
                                            ₦{utilization.balance.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-green-600 uppercase">Utilized</p>
                                        <p className="text-xs font-bold text-orange-600 leading-none">
                                            ₦{utilization.amount_utilized.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="w-full bg-green-200 h-1 mt-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-green-600 h-full"
                                        style={{
                                            width: `${Math.min(100, (utilization.amount_utilized / (utilization.amount_utilized + utilization.balance || 1)) * 100)}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Claim Audit Trail: {approvalCode || enrollee_id}</DialogTitle>
                        </DialogHeader>
                        <AuditTrailView approvalCode={approvalCode || enrollee_id} />
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}

