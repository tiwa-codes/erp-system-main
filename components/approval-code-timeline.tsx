"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, Building2, CheckCircle2, Circle, AlertCircle, Calendar } from "lucide-react"
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

interface ApprovalCodeTimelineProps {
    approvalCode: string
}

export function ApprovalCodeTimeline({ approvalCode }: ApprovalCodeTimelineProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["approval-code-timeline", approvalCode],
        queryFn: async () => {
            const encodedCode = encodeURIComponent(approvalCode)
            const res = await fetch(`/api/call-centre/approval-codes/${encodedCode}/timeline`)
            if (!res.ok) {
                throw new Error("Failed to fetch timeline")
            }
            return res.json()
        },
        enabled: !!approvalCode
    })

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Approval Code Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error || !data?.timeline) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Approval Code Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8 text-gray-500">
                        <AlertCircle className="h-5 w-5 mr-2" />
                        <span>No timeline data available</span>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const timeline: TimelineEvent[] = data.timeline

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Approval Code Timeline</CardTitle>
                <p className="text-sm text-gray-600">Track the complete lifecycle of this approval code</p>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                    {/* Timeline events */}
                    <div className="space-y-6">
                        {timeline.map((event, index) => {
                            const isCompleted = true // All events in timeline are completed
                            const isLast = index === timeline.length - 1

                            return (
                                <div key={event.id} className="relative pl-12">
                                    {/* Timeline dot */}
                                    <div className={cn(
                                        "absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2",
                                        isCompleted ? "bg-green-100 border-green-500" : "bg-gray-100 border-gray-300"
                                    )}>
                                        {isCompleted ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <Circle className="h-4 w-4 text-gray-400" />
                                        )}
                                    </div>

                                    {/* Event content */}
                                    <div className={cn(
                                        "bg-white border rounded-lg p-4",
                                        isCompleted ? "border-green-200" : "border-gray-200"
                                    )}>
                                        {/* Stage name and delay */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="font-bold text-gray-900">{event.stage_display}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {event.performed_by && (
                                                        <span className="text-xs text-gray-500 italic">
                                                            By {event.performed_by.type === 'provider' ? 'provider' : event.performed_by.name}
                                                        </span>
                                                    )}
                                                    {event.delay_formatted && index > 0 && (
                                                        <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                                            {event.delay_formatted} delayed
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Badge className={cn(
                                                "text-[10px] h-5",
                                                isCompleted ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                            )}>
                                                {isCompleted ? "Completed" : "Pending"}
                                            </Badge>
                                        </div>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                                            <div className="flex items-center">
                                                <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                                                <span>{new Date(event.timestamp).toLocaleString('en-GB', {
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short'
                                                })}</span>
                                            </div>

                                            {event.performed_by && (
                                                <div className="flex items-center">
                                                    {event.performed_by.type === 'user' ? (
                                                        <>
                                                            <User className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                                                            <span>{event.performed_by.name}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Building2 className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                                                            <span>{event.performed_by.name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* No events message */}
                    {timeline.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <Circle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                            <p>No timeline events recorded yet</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
