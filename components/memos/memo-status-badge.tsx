'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, XCircle, FileText, Send } from 'lucide-react'

interface MemoStatusBadgeProps {
    status: string
    deptOversightApprover?: string | null
    executiveApprover?: string | null
}

export function MemoStatusBadge({
    status,
    deptOversightApprover,
    executiveApprover
}: MemoStatusBadgeProps) {
    const getStatusConfig = () => {
        switch (status) {
            case 'DRAFT':
                return {
                    label: 'Draft',
                    icon: FileText,
                    className: 'bg-gray-100 text-gray-800 border-gray-300'
                }
            case 'PENDING_DEPT_OVERSIGHT':
                return {
                    label: 'Pending Department Oversight',
                    icon: Clock,
                    className: 'bg-yellow-100 text-yellow-800 border-yellow-300'
                }
            case 'PENDING_EXECUTIVE':
                return {
                    label: 'Pending Executive Approval',
                    icon: Send,
                    className: 'bg-blue-100 text-blue-800 border-blue-300'
                }
            case 'APPROVED':
                return {
                    label: 'Approved',
                    icon: CheckCircle2,
                    className: 'bg-green-100 text-green-800 border-green-300'
                }
            case 'REJECTED':
                return {
                    label: 'Rejected',
                    icon: XCircle,
                    className: 'bg-red-100 text-red-800 border-red-300'
                }
            default:
                return {
                    label: status,
                    icon: FileText,
                    className: 'bg-gray-100 text-gray-800 border-gray-300'
                }
        }
    }

    const config = getStatusConfig()
    const Icon = config.icon

    return (
        <div className="flex flex-col gap-2">
            <Badge variant="outline" className={`${config.className} flex items-center gap-1 w-fit`}>
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>

            {/* Show approval chain */}
            {(deptOversightApprover || executiveApprover) && (
                <div className="text-xs text-gray-600 space-y-1">
                    {deptOversightApprover && (
                        <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span>Confirmed by {deptOversightApprover}</span>
                        </div>
                    )}
                    {executiveApprover && (
                        <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span>Approved by {executiveApprover}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
