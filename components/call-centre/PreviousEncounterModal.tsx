"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Pill, Stethoscope, Search, History } from "lucide-react"
import { Input } from "@/components/ui/input"
import { StatusIndicator } from "@/components/ui/status-indicator"

interface PreviousEncounterModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    enrolleeId: string
    enrolleeName: string
}

export function PreviousEncounterModal({
    isOpen,
    onOpenChange,
    enrolleeId,
    enrolleeName,
}: PreviousEncounterModalProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const limit = 10
    const resolvedEnrolleeId = (enrolleeId || "").trim()

    const { data, isLoading, error } = useQuery({
        queryKey: ["encounter-history", resolvedEnrolleeId, currentPage, searchTerm],
        queryFn: async () => {
            const params = new URLSearchParams({
                enrollee_id: resolvedEnrolleeId,
                page: currentPage.toString(),
                limit: limit.toString(),
                search: searchTerm,
            })
            const res = await fetch(`/api/call-centre/encounter-history?${params}`)
            if (!res.ok) throw new Error("Failed to fetch encounter history")
            return res.json()
        },
        enabled: isOpen && !!resolvedEnrolleeId,
    })

    const encounters = data?.encounters || []
    const pagination = data?.pagination

    const isDrug = (serviceName: string) => {
        const name = serviceName.toLowerCase()
        return (
            name.includes("tablet") ||
            name.includes("capsule") ||
            name.includes("syrup") ||
            name.includes("injection") ||
            name.includes("pill") ||
            name.includes("cream") ||
            name.includes("ointment") ||
            name.includes("suspension")
        )
    }

    const parseServices = (servicesJson: any) => {
        try {
            if (!servicesJson) return { services: [], drugs: [] }
            const servicesArray = Array.isArray(servicesJson)
                ? servicesJson
                : typeof servicesJson === "string"
                    ? JSON.parse(servicesJson)
                    : []

            const services: string[] = []
            const drugs: string[] = []

            servicesArray.forEach((s: any) => {
                const name = s.service_name || s.name || ""
                const cat = (s.category || "").toLowerCase()
                const isADrug =
                    cat === "drg" || cat.includes("drug") || cat.includes("pharmacy") || isDrug(name)
                if (isADrug) {
                    drugs.push(name)
                } else {
                    services.push(name)
                }
            })

            return { services, drugs }
        } catch (e) {
            return { services: [String(servicesJson)], drugs: [] }
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-blue-600" />
                        <DialogTitle>Encounter History: {enrolleeName}</DialogTitle>
                    </div>
                    <DialogDescription>
                        Showing previous encounters and requests for {enrolleeName} ({enrolleeId})
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-4 py-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search history by hospital, diagnosis or service..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    {data?.pagination && (
                        <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-2 rounded-md">
                            Total Records: {data.pagination.total}
                        </div>
                    )}
                </div>

                {data?.utilization && !isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 flex flex-col justify-center">
                            <p className="text-[10px] uppercase text-blue-600 font-bold tracking-wider mb-1">Annual Limit</p>
                            <p className="text-2xl font-black text-blue-900 leading-none">
                                ₦{data.utilization.total_limit.toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/50 flex flex-col justify-center">
                            <div className="flex justify-between items-start">
                                <p className="text-[10px] uppercase text-orange-600 font-bold tracking-wider mb-1">Utilized (YTD)</p>
                                <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">
                                    {data.utilization.utilization_percentage.toFixed(1)}%
                                </Badge>
                            </div>
                            <p className="text-2xl font-black text-orange-700 leading-none">
                                ₦{data.utilization.amount_utilized.toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50 flex flex-col justify-center">
                            <p className="text-[10px] uppercase text-emerald-600 font-bold tracking-wider mb-1">Remaining Balance</p>
                            <p className="text-2xl font-black text-emerald-700 leading-none">
                                ₦{data.utilization.balance.toLocaleString()}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-auto rounded-md border">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            <p className="text-sm text-gray-500">Loading history...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-red-600">
                            <History className="h-10 w-10 mb-2 opacity-50" />
                            <p>Unable to load encounter history right now.</p>
                        </div>
                    ) : encounters.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <History className="h-10 w-10 mb-2 opacity-20" />
                            <p>
                                {resolvedEnrolleeId
                                    ? "No encounter history found for this enrollee."
                                    : "No valid enrollee selected. Pick an enrollee and try again."}
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="sticky top-0 bg-white">
                                <TableRow>
                                    <TableHead className="w-[100px]">DATE</TableHead>
                                    <TableHead>HOSPITAL</TableHead>
                                    <TableHead>APPROVAL CODE</TableHead>
                                    <TableHead>DIAGNOSIS</TableHead>
                                    <TableHead>SERVICES</TableHead>
                                    <TableHead>DRUGS</TableHead>
                                    <TableHead>AMOUNT</TableHead>
                                    <TableHead>STATUS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {encounters.map((encounter: any) => {
                                    const { services, drugs } = parseServices(encounter.services)
                                    const isDeleted = String(encounter.status || "").toUpperCase() === "DELETED"
                                    return (
                                        <TableRow
                                            key={encounter.id}
                                            className={isDeleted ? "bg-red-50/60 hover:bg-red-50 text-red-900" : undefined}
                                        >
                                            <TableCell className="whitespace-nowrap font-medium">
                                                {new Date(encounter.created_at).toLocaleDateString("en-GB")}
                                            </TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={encounter.hospital}>
                                                {encounter.hospital}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                {encounter.approval_code ? (
                                                    <Badge variant="outline" className="text-[10px] font-mono">
                                                        {encounter.approval_code}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={encounter.diagnosis}>
                                                {encounter.diagnosis || "-"}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {services.length > 0 ? (
                                                        services.map((s, i) => (
                                                            <Badge key={i} variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
                                                                <Stethoscope className="h-2 w-2 mr-1" /> {s}
                                                            </Badge>
                                                        ))
                                                    ) : "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {drugs.length > 0 ? (
                                                        drugs.map((d, i) => (
                                                            <Badge key={i} variant="secondary" className="text-[10px] bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                                                                <Pill className="h-2 w-2 mr-1" /> {d}
                                                            </Badge>
                                                        ))
                                                    ) : "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold text-gray-900">
                                                ₦{parseFloat(encounter.amount || 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <StatusIndicator
                                                    status={isDeleted ? "DELETED" : encounter.status}
                                                    className={isDeleted ? "font-semibold" : undefined}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between py-4 border-t mt-auto">
                        <p className="text-xs text-gray-500">
                            Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            <span className="text-xs font-medium">
                                Page {currentPage} of {pagination.pages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                                disabled={currentPage === pagination.pages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
