"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
    Download,
    Search,
    FileText,
    Users,
    Building,
    CreditCard,
    History,
    TrendingUp,
    DollarSign,
    ChevronRight,
    Filter,
    ArrowLeft,
    Calendar,
    Printer
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import jspdf from "jspdf"
import html2canvas from "html2canvas"



interface ProviderPayment {
    provider_id: string
    provider_name: string
    provider_code: string
    total_enrollees: number
    total_amount: number
    paid_claims_count: number
}

interface PaymentAdviceMetrics {
    paid_providers: number
    total_payout_amount: number
    paid_enrollees: number
}

export default function PaymentAdvicePage() {
    const router = useRouter()
    const queryClient = useQueryClient()

    // State
    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [limit] = useState(10)
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm)
            setCurrentPage(1)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Fetch metrics
    const { data: metricsData } = useQuery({
        queryKey: ["payment-advice-metrics"],
        queryFn: async () => {
            const res = await fetch("/api/finance/payment-advice/metrics")
            if (!res.ok) throw new Error("Failed to fetch metrics")
            return res.json()
        }
    })

    // Fetch providers
    const { data: providersData, isLoading } = useQuery({
        queryKey: ["payment-advice-providers", currentPage, debouncedSearchTerm],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: limit.toString(),
                search: debouncedSearchTerm
            })
            const res = await fetch(`/api/finance/payment-advice/providers?${params}`)
            if (!res.ok) throw new Error("Failed to fetch providers")
            return res.json()
        }
    })

    const metrics = metricsData?.metrics as PaymentAdviceMetrics
    const providers = providersData?.providers as ProviderPayment[]
    const pagination = providersData?.pagination

    const handleGenerateAdvice = async (providerId: string) => {
        setIsGeneratingPdf(true)
        setSelectedProviderId(providerId)

        try {
            // Fetch breakdown
            const res = await fetch(`/api/finance/payment-advice/providers/${providerId}/claims`)
            if (!res.ok) throw new Error("Failed to fetch payment breakdown")
            const data = await res.json()

            // In a real implementation, we'd render a hidden template and use html2canvas + jspdf
            // Or use a server-side PDF generator. For now, we'll simulate the download or redirect to a detail page.
            // The USER wants a "Detailed table view (List of providers paid)", so let's redirect to a details page first.
            router.push(`/finance/payment-advice/${providerId}`)
        } catch (error) {
            toast.error("Failed to generate payment advice")
            console.error(error)
        } finally {
            setIsGeneratingPdf(false)
            setSelectedProviderId(null)
        }
    }

    return (
        <PermissionGate module="finance" action="view">
            <div className="space-y-8 pb-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-xs text-gray-400 font-black tracking-widest uppercase">Finance Management</p>
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Payment Advice</h1>
                        <p className="text-gray-500 font-medium">Generate and manage payment breakdowns for settled providers</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => router.push('/finance/settlement')} className="gap-2 border-gray-200 hover:bg-gray-50 font-bold">
                            <ArrowLeft className="h-4 w-4" />
                            BACK TO SETTLEMENT
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 font-black gap-2 shadow-lg shadow-emerald-200">
                            <Download className="h-4 w-4" />
                            EXPORT ALL PAID
                        </Button>
                    </div>
                </div>

                {/* Dashoard Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none shadow-xl shadow-gray-200/50 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Building className="h-24 w-24" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-100">Paid Providers</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black mb-1">{metrics?.paid_providers || 0}</div>
                            <p className="text-emerald-100/80 text-sm font-medium">Distinct facilities settled</p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-gray-200/50 bg-white overflow-hidden relative group">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400">Total Payout Volume</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-gray-900 mb-1">
                                <span className="text-lg font-bold mr-1">₦</span>
                                {metrics?.total_payout_amount?.toLocaleString() || "0"}
                            </div>
                            <p className="text-gray-400 text-sm font-medium">Total funds disbursed to date</p>
                        </CardContent>
                        <div className="h-1 bg-emerald-500 absolute bottom-0 left-0 right-0" />
                    </Card>

                    <Card className="border-none shadow-xl shadow-gray-200/50 bg-white overflow-hidden relative group">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400">Paid Enrollees</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-gray-900 mb-1">{metrics?.paid_enrollees || 0}</div>
                            <p className="text-gray-400 text-sm font-medium">Members covered in settlements</p>
                        </CardContent>
                        <div className="h-1 bg-[#0891B2] absolute bottom-0 left-0 right-0" />
                    </Card>
                </div>

                {/* Detailed Table Section */}
                <Card className="border-gray-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-gray-50/50 border-b p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <CardTitle className="text-xl font-bold text-gray-900">Paid Providers History</CardTitle>
                                <p className="text-sm text-gray-500 font-medium">A complete list of facilities that have received payments</p>
                            </div>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="relative flex-1 md:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search provider name or code..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 h-10 border-gray-200 focus:ring-emerald-500 focus:border-emerald-500 rounded-lg font-medium"
                                    />
                                </div>
                                <Button variant="outline" className="h-10 border-gray-200 font-bold gap-2">
                                    <Filter className="h-4 w-4" />
                                    FILTER
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="h-10 w-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                                <p className="text-gray-400 font-bold text-sm tracking-widest uppercase">Fetching Payment Records...</p>
                            </div>
                        ) : providers && providers.length > 0 ? (
                            <Table>
                                <TableHeader className="bg-gray-50/50">
                                    <TableRow className="border-b border-gray-100">
                                        <TableHead className="font-black text-[10px] text-gray-400 uppercase tracking-widest pl-6 py-4">Facility Information</TableHead>
                                        <TableHead className="font-black text-[10px] text-gray-400 uppercase tracking-widest">Enrollees Paid</TableHead>
                                        <TableHead className="font-black text-[10px] text-gray-400 uppercase tracking-widest">Total Amount Paid</TableHead>
                                        <TableHead className="font-black text-[10px] text-gray-400 uppercase tracking-widest">Claims Count</TableHead>
                                        <TableHead className="font-black text-[10px] text-gray-400 uppercase tracking-widest text-right pr-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {providers.map((p) => (
                                        <TableRow key={p.provider_id} className="hover:bg-gray-50/50 transition-colors group">
                                            <TableCell className="pl-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 font-black group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                                        <Building className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black text-gray-900 leading-tight">{p.provider_name}</p>
                                                        <p className="text-xs font-bold text-gray-400 tracking-wider">HCP CODE: {p.provider_code}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-blue-500" />
                                                    <span className="text-sm font-bold text-gray-700">{p.total_enrollees}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-base font-black text-emerald-600">₦{p.total_amount.toLocaleString()}</span>
                                                    <span className="text-[10px] font-black text-gray-300 uppercase letter tracking-tighter">Settled Amount</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 font-black px-2 py-0.5 rounded-md">
                                                    {p.paid_claims_count} CLAIMS
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button
                                                    onClick={() => handleGenerateAdvice(p.provider_id)}
                                                    disabled={isGeneratingPdf && selectedProviderId === p.provider_id}
                                                    className="bg-gray-900 hover:bg-black text-white rounded-full px-6 font-black text-xs gap-2 shadow-lg shadow-gray-200 group-hover:bg-emerald-600 group-hover:shadow-emerald-100 transition-all"
                                                >
                                                    {isGeneratingPdf && selectedProviderId === p.provider_id ? (
                                                        <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <FileText className="h-3.5 w-3.5" />
                                                    )}
                                                    VIEW ADVICE
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="h-20 w-20 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                                    <Search className="h-10 w-10 text-gray-200" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900">No Payment Records Found</h3>
                                <p className="text-gray-400 font-medium max-w-sm text-center">We couldn't find any paid providers matching your criteria. Try adjusting your filters.</p>
                                <Button variant="outline" onClick={() => setSearchTerm("")} className="mt-4 font-bold border-gray-200 rounded-full px-8 hover:bg-gray-50 transition-all">
                                    CLEAR SEARCH
                                </Button>
                            </div>
                        )}
                    </CardContent>
                    {pagination && pagination.pages > 1 && (
                        <div className="border-t p-4 flex items-center justify-between bg-gray-50/30">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                Showing PAGE {pagination.page} OF {pagination.pages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    className="font-bold border-gray-200 rounded-full h-8 px-4"
                                >
                                    PREVIOUS
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page === pagination.pages}
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                                    className="font-bold border-gray-200 rounded-full h-8 px-4"
                                >
                                    NEXT
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </PermissionGate>
    )
}
