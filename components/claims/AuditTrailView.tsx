"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, Building2, CheckCircle2, Circle, AlertCircle, Calendar, Hash } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineEvent {
    id: string
    stage: string
    stage_display: string
    timestamp: string
    delay_minutes: number | null
    delay_formatted: string | null
    performed_by: {
        type: 'user' | 'provider'
        name: string
        email?: string
        id?: string
    } | null
}

const ORDERED_STAGES = [
    'REQUESTED',
    'APPROVED',
    'CLAIM_SUBMITTED',
    'VETTER1_COMPLETED',
    'VETTER2_COMPLETED',
    'AUDIT_COMPLETED',
    'MD_APPROVED',
    'FINANCE_PAID'
]

const STAGE_LABELS: Record<string, string> = {
    'REQUESTED': 'Requested',
    'APPROVED': 'Approved',
    'CLAIM_SUBMITTED': 'Sent to Vetter 1',
    'VETTER1_COMPLETED': 'Vetter 1 Vetted',
    'VETTER2_COMPLETED': 'Vetter 2 Vetted',
    'AUDIT_COMPLETED': 'Audit Audited',
    'MD_APPROVED': 'MD Approves',
    'FINANCE_PAID': 'Finance Paid'
}

interface AuditTrailViewProps {
    approvalCode: string
}

export function AuditTrailView({ approvalCode }: AuditTrailViewProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["approval-code-timeline", approvalCode],
        queryFn: async () => {
            const encodedCode = encodeURIComponent(approvalCode)
            const res = await fetch(`/api/call-centre/approval-codes/${encodedCode}/timeline`)
            if (!res.ok) {
                if (res.status === 404) throw new Error("Approval code not found")
                throw new Error("Failed to fetch timeline")
            }
            return res.json()
        },
        enabled: !!approvalCode,
        retry: false
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (error) {
        return (
            <Card className="border-red-200 bg-red-50">
                <CardContent className="flex items-center justify-center py-10 text-red-600 font-medium">
                    <AlertCircle className="h-5 w-5 mr-3" />
                    <span>{error.message}</span>
                </CardContent>
            </Card>
        )
    }

    const timeline: TimelineEvent[] = data?.timeline || []

    // Map existing events to their stages
    const eventMap = new Map<string, TimelineEvent>()
    timeline.forEach(event => eventMap.set(event.stage, event))

    return (
        <Card className="border-gray-200 shadow-lg overflow-hidden">
            <CardHeader className="bg-gray-50 border-b pb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <Clock className="h-6 w-6 text-blue-600" />
                            Approval Trail: <span className="text-blue-600">{approvalCode}</span>
                        </CardTitle>
                        <p className="text-gray-500 font-medium text-sm mt-1 uppercase tracking-wider">
                            Full audit history from request to payment
                        </p>
                    </div>
                    <Badge variant="outline" className="h-8 px-4 border-blue-200 text-blue-700 bg-blue-50 font-black">
                        #{approvalCode}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-8">
                <div className="relative">
                    {/* Vertical line with gradient */}
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 via-gray-200 to-gray-200"></div>

                    {/* Timeline events */}
                    <div className="space-y-4 pb-6">
                        {ORDERED_STAGES.map((stageKey, index) => {
                            const event = eventMap.get(stageKey)
                            const isCompleted = !!event
                            const label = STAGE_LABELS[stageKey] || stageKey
                            const romanNumeral = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][index]

                            return (
                                <div key={stageKey} className="group transition-all duration-300">
                                    <div className={cn(
                                        "flex flex-col md:flex-row md:items-center gap-2 p-4 rounded-xl border transition-all",
                                        isCompleted
                                            ? "border-blue-100 bg-white shadow-sm ring-1 ring-blue-50/50"
                                            : "border-gray-100 bg-gray-50/30 opacity-60"
                                    )}>
                                        <div className="flex items-center gap-3 flex-1">
                                            <span className="text-blue-600 font-black text-sm w-6">{romanNumeral}.</span>

                                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                                {isCompleted ? (
                                                    <span className="font-bold text-gray-400">
                                                        {new Date(event.timestamp).toLocaleString('en-GB', {
                                                            dateStyle: 'medium',
                                                            timeStyle: 'short'
                                                        })}
                                                    </span>
                                                ) : (
                                                    <span className="font-black text-orange-400 italic uppercase tracking-tighter text-xs">PENDING</span>
                                                )}

                                                <h4 className={cn(
                                                    "font-bold",
                                                    isCompleted ? "text-gray-900" : "text-gray-400"
                                                )}>
                                                    {label}
                                                </h4>

                                                {isCompleted && (
                                                    <span className="flex items-center gap-1 text-gray-600">
                                                        — By {event.performed_by?.type === 'provider' ? 'provider' : 'user'}
                                                        <span className="font-black text-blue-700 ml-1">
                                                            {event.performed_by?.name || "System"}
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {isCompleted && event.delay_formatted && (
                                            <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1 rounded-full border border-orange-100 ml-9 md:ml-0">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span className="text-[11px] font-black whitespace-nowrap uppercase tracking-wider">
                                                    {event.delay_formatted} delayed
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
