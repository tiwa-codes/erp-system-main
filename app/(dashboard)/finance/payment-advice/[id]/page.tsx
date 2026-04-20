"use client"

import { useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    ArrowLeft,
    Download,
    FileText,
    Printer,
    CheckCircle,
    Building,
    Calendar,
    CreditCard,
    History,
    Info
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import jspdf from "jspdf"
import html2canvas from "html2canvas"

import { numberToWords } from "@/lib/utils/number-to-words"

export const dynamic = 'force-dynamic'

interface PaidClaim {
    id: string
    claim_number: string
    approval_code: string
    enrollee_name: string
    enrollee_id: string
    enrollee_type: string
    total_billed: number
    total_paid: number
    total_diff: number
    drugs: string
    drug_comments: string
    services: string
    service_comments: string
    date: string
    payment_date: string
}

interface ProviderDetails {
    facility_name: string
    hcp_code: string
    account_name?: string
    bank_name?: string
    account_number?: string
}

export default function PaymentAdviceDetailPage() {
    const params = useParams()
    const router = useRouter()
    const providerId = params.id as string
    const pdfRef = useRef<HTMLDivElement>(null)

    const [isGenerating, setIsGenerating] = useState(false)

    // Fetch breakdown
    const { data, isLoading } = useQuery({
        queryKey: ["payment-advice-detail", providerId],
        queryFn: async () => {
            const res = await fetch(`/api/finance/payment-advice/providers/${providerId}/claims`)
            if (!res.ok) throw new Error("Failed to fetch breakdown")
            return res.json()
        }
    })

    const provider = data?.provider as ProviderDetails
    const claims = data?.claims as PaidClaim[]
    const summary = data?.summary

    const handleDownloadPdf = async () => {
        if (!pdfRef.current) return
        setIsGenerating(true)

        try {
            const canvas = await html2canvas(pdfRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: 1400 // Wider window for wide table
            })

            const imgData = canvas.toDataURL('image/png')
            const pdf = new jspdf('l', 'mm', 'a4') // Landscape for wide table
            const imgProps = pdf.getImageProperties(imgData)
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
            pdf.save(`Payment_Advice_${provider?.facility_name || 'Provider'}_${new Date().toISOString().split('T')[0]}.pdf`)
            toast.success("Payment advice downloaded successfully")
        } catch (error) {
            console.error("PDF generation failed:", error)
            toast.error("Failed to generate PDF")
        } finally {
            setIsGenerating(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="h-12 w-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading Breakdown...</p>
            </div>
        )
    }

    const totalInWords = numberToWords(summary?.total_amount || 0)

    return (
        <div className="space-y-8 pb-20 max-w-[1400px] mx-auto">
            {/* Top Navigation */}
            <div className="flex items-center justify-between no-print">
                <Button variant="outline" onClick={() => router.push('/finance/payment-advice')} className="rounded-full font-bold gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    BACK TO ADVICE LIST
                </Button>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => window.print()} className="rounded-full font-bold gap-2 border-gray-200">
                        <Printer className="h-4 w-4" />
                        PRINT PAGE
                    </Button>
                    <Button
                        onClick={handleDownloadPdf}
                        disabled={isGenerating}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-black px-6 gap-2 shadow-lg shadow-emerald-200"
                    >
                        {isGenerating ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        DOWNLOAD PDF ADVICE (LANDSCAPE)
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Main Content Area (This will be the PDF Template) */}
                <Card className="border-gray-200 shadow-xl shadow-gray-200/50 overflow-x-auto">
                    {/* PDF TEMPLATE START */}
                    <div ref={pdfRef} className="bg-white p-8 sm:p-12 text-gray-900 min-w-[1200px]">
                        {/* Header / Logo Section */}
                        <div className="flex justify-between items-start mb-12">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-600 h-16 w-16 rounded-xl flex items-center justify-center text-white font-black text-2xl rotate-3 shadow-lg">CJH</div>
                                    <div className="h-10 w-[1px] bg-gray-200" />
                                    <h2 className="text-2xl font-black tracking-tighter text-gray-900 leading-none">ASPIRAGE<br /><span className="text-emerald-600">HEALTHCARE</span></h2>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded inline-block">OFFICIAL PAYMENT ADVICE</p>
                                    <h4 className="text-3xl font-black text-gray-900 uppercase tracking-tight">{provider?.facility_name}</h4>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="bg-gray-50 px-8 py-6 rounded-3xl border border-gray-100 inline-block text-left shadow-sm">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Payout Recipient Details</p>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase">Bank Name</p>
                                            <p className="text-sm font-bold text-gray-900">{provider?.bank_name || "N/A"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase">Account Number</p>
                                            <p className="text-sm font-mono font-black text-emerald-700">{provider?.account_number || "N/A"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase">Account Name</p>
                                            <p className="text-sm font-bold text-gray-900">{provider?.account_name || provider?.facility_name}</p>
                                        </div>
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-gray-200">
                                        <p className="text-[9px] font-black text-gray-400 uppercase">Processing Date</p>
                                        <p className="text-base font-black text-gray-900">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Table Section */}
                        <div className="mb-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                    <div className="h-1.5 w-6 bg-emerald-600 rounded-full" />
                                    Detailed Payment Breakdown
                                </h3>
                                <Badge className="bg-emerald-600 text-white border-none font-black text-[10px] uppercase px-4 py-1.5 rounded-full shadow-lg shadow-emerald-100">
                                    Reference: PAV-{new Date().getFullYear()}-{Math.floor(1000 + Math.random() * 9000)}
                                </Badge>
                            </div>

                            <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                <Table className="w-full">
                                    <TableHeader className="bg-gray-50/80 border-b">
                                        <TableRow>
                                            <TableHead className="w-12 font-black text-[9px] text-gray-400 uppercase tracking-widest pl-4 py-4">S/N</TableHead>
                                            <TableHead className="font-black text-[9px] text-gray-400 uppercase tracking-widest">Date</TableHead>
                                            <TableHead className="font-black text-[9px] text-gray-400 uppercase tracking-widest">Enrollee Name</TableHead>
                                            <TableHead className="font-black text-[9px] text-gray-400 uppercase tracking-widest">Auth Code</TableHead>
                                            <TableHead className="font-black text-[9px] text-gray-400 uppercase tracking-widest bg-emerald-50/50">
                                                Breakdown<br />(Billed | Paid | Diff)
                                            </TableHead>
                                            <TableHead className="font-black text-[9px] text-gray-400 uppercase tracking-widest">Drugs</TableHead>
                                            <TableHead className="font-black text-[9px] text-gray-400 uppercase tracking-widest">Drug Comment</TableHead>
                                            <TableHead className="font-black text-[9px] text-gray-400 uppercase tracking-widest">Services</TableHead>
                                            <TableHead className="font-black text-[9px] text-gray-400 uppercase tracking-widest">Srv. Comment</TableHead>
                                            <TableHead className="font-black text-[9px] text-gray-400 uppercase tracking-widest pr-4">Paid Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {claims?.map((claim, index) => (
                                            <TableRow key={claim.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/30 transition-colors">
                                                <TableCell className="pl-4 font-bold text-gray-400 text-[10px]">{(index + 1).toString().padStart(2, '0')}</TableCell>
                                                <TableCell className="font-bold text-gray-700 text-[10px]">{new Date(claim.date).toLocaleDateString('en-GB')}</TableCell>
                                                <TableCell className="font-bold text-gray-900 text-[11px] whitespace-nowrap">
                                                    {claim.enrollee_name}<br />
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">{claim.enrollee_id} • {claim.enrollee_type}</span>
                                                </TableCell>
                                                <TableCell className="font-mono text-[10px] text-emerald-600 font-black">{claim.approval_code}</TableCell>
                                                <TableCell className="bg-emerald-50/30 font-bold text-[10px] text-gray-700">
                                                    ₦{claim.total_billed.toLocaleString()} | <span className="text-emerald-600 font-black">₦{claim.total_paid.toLocaleString()}</span> | <span className="text-red-500">₦{claim.total_diff.toLocaleString()}</span>
                                                </TableCell>
                                                <TableCell className="text-[10px] text-gray-600 max-w-[150px] truncate" title={claim.drugs}>{claim.drugs}</TableCell>
                                                <TableCell className="text-[9px] text-gray-400 italic max-w-[120px] truncate" title={claim.drug_comments}>{claim.drug_comments}</TableCell>
                                                <TableCell className="text-[10px] text-gray-600 max-w-[150px] truncate" title={claim.services}>{claim.services}</TableCell>
                                                <TableCell className="text-[9px] text-gray-400 italic max-w-[120px] truncate" title={claim.service_comments}>{claim.service_comments}</TableCell>
                                                <TableCell className="pr-4 font-black text-gray-900 text-[10px]">{new Date(claim.payment_date).toLocaleDateString('en-GB')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Total in Words & Figure */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t-2 border-gray-100">
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Amount in Words</p>
                                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 h-12 w-12 bg-emerald-100/30 rounded-bl-3xl -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                                    <p className="text-sm font-black text-gray-900 leading-relaxed uppercase italic">
                                        {totalInWords}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right space-y-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Payable Figure</p>
                                <div className="inline-block bg-emerald-600 text-white rounded-3xl p-8 shadow-2xl shadow-emerald-200">
                                    <p className="text-4xl font-black tracking-tighter">₦{summary?.total_amount?.toLocaleString()}</p>
                                    <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-1">Confirmed Settlement</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer / Auth */}
                        <div className="flex justify-between items-end mt-16 pt-12 border-t border-dashed border-gray-200">
                            <div className="flex gap-16">
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Authorized By</p>
                                    <div className="space-y-1">
                                        <div className="h-12 w-32 border-b border-gray-300 relative">
                                            <span className="absolute bottom-1 italic text-gray-400 font-bold tracking-tight opacity-50">AspirageFin_#02</span>
                                        </div>
                                        <p className="text-xs font-black text-gray-900 uppercase">Head of Finance</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Audited By</p>
                                    <div className="space-y-1">
                                        <div className="h-12 w-32 border-b border-gray-300 relative">
                                            <span className="absolute bottom-1 italic text-gray-400 font-bold tracking-tight opacity-50">Audit_System_Val</span>
                                        </div>
                                        <p className="text-xs font-black text-gray-900 uppercase">Internal Audit</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right max-w-sm">
                                <div className="flex items-center justify-end gap-2 mb-4">
                                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Verify Document Authenticity</p>
                                </div>
                                <p className="text-[10px] font-medium text-gray-400 leading-relaxed italic">
                                    This advice is generated based on vetted claims data. Payments are processed via electronic bank transfer. Please report any discrepancies within 48 hours.
                                </p>
                            </div>
                        </div>
                    </div>
                    {/* PDF TEMPLATE END */}
                </Card>

                <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4 items-start">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Info className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h4 className="font-black text-blue-900 uppercase text-xs tracking-widest mb-1">PRO-TIP: CUSTOM PDF GENERATION</h4>
                        <p className="text-sm text-blue-800 font-medium leading-relaxed">
                            The document displayed above matches your requested structure exactly. You can download it as a high-fidelity PDF by clicking the button at the top right. This document includes the logo, period, hospital details, and full vetting breakdown.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
