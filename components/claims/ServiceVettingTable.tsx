import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Trash2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    ChevronDown,
    Info
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface ServiceItem {
    id: string
    service_name: string
    claimed_amount: number
    tariff_amount: number
    vetted_amount?: number
    quantity?: number       // number of units billed
    unit_price?: number     // per-unit price (claimed_amount / quantity)
    verdict: 'COVERED' | 'NOT_COVERED' | 'APPROVED' | 'REJECTED'
    price_verdict: 'MATCH' | 'ABOVE_TARIFF' | 'BELOW_TARIFF'
    category?: 'DRUG' | 'SERVICE' | string
    is_deleted?: boolean
    rejection_reason?: string
    is_ad_hoc?: boolean
    modified_by_name?: string // tracks who last changed vetted_amount
}

/**
 * Determines whether a service item is a drug/medication.
 * Handles all category variants stored across the system:
 *   'DRG' (DB code), 'DRUG', 'Drugs / Pharmaceuticals',
 *   'Drugs and Pharmaceutical', 'medication', 'pharmacy', etc.
 * Falls back to service name keywords when category is absent.
 */
export function isDrugItem(category?: string, serviceName?: string): boolean {
    const cat = (category || '').toLowerCase().trim()
    if (
        cat === 'drg' ||
        cat === 'drug' ||
        cat === 'drugs' ||
        cat.includes('drug') ||
        cat.includes('medication') ||
        cat.includes('pharmacy') ||
        cat.includes('pharmaceutical')
    ) {
        return true
    }
    // Fallback: infer from service name for ad-hoc / manual entries
    const name = (serviceName || '').toLowerCase()
    return (
        name.includes('tablet') ||
        name.includes('capsule') ||
        name.includes('syrup') ||
        name.includes('injection') ||
        name.includes('suspension') ||
        name.includes('infusion') ||
        name.includes('drug') ||
        name.includes('medication') ||
        name.includes('ampoule') ||
        name.includes('suppository')
    )
}

interface ServiceVettingTableProps {
    title: string
    services: ServiceItem[]
    onUpdateService: (id: string, updates: Partial<ServiceItem>) => void
    onDeleteService: (id: string) => void
    canEditPrice?: boolean
    colorScheme?: 'blue' | 'purple'
    currentUserName?: string // name of the logged-in user for modification tracking
}

export function ServiceVettingTable({
    title,
    services,
    onUpdateService,
    onDeleteService,
    canEditPrice = false,
    colorScheme = 'blue',
    currentUserName
}: ServiceVettingTableProps) {

    const accentColor = colorScheme === 'purple' ? 'purple' : 'blue'
    const headerBg = colorScheme === 'purple' ? 'bg-purple-100/50' : 'bg-blue-100/50'
    const headerText = colorScheme === 'purple' ? 'text-purple-900 font-black' : 'text-blue-900 font-black'
    const rowBg = colorScheme === 'purple' ? 'hover:bg-purple-50/30' : 'hover:bg-blue-50/30'

    return (
        <div className="space-y-0 rounded-xl overflow-hidden border border-gray-200 bg-white">
            <div className={`flex items-center justify-between px-5 py-3 ${headerBg} border-b border-gray-200`}>
                <div className="flex items-center gap-2">
                    {colorScheme === 'purple' ? (
                        <div className="p-1.5 bg-purple-600 rounded-lg text-white">
                            <Info className="h-4 w-4" />
                        </div>
                    ) : (
                        <div className="p-1.5 bg-[#BE1522] rounded-lg text-white">
                            <Info className="h-4 w-4" />
                        </div>
                    )}
                    <h3 className={`text-sm uppercase tracking-wider ${headerText}`}>{title}</h3>
                </div>
                <Badge variant="outline" className={`${colorScheme === 'purple' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {services.length} Items
                </Badge>
            </div>

            <div className="overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="w-[30%] pl-5">Service/Description</TableHead>
                            <TableHead className="text-center w-[80px]">Qty</TableHead>
                            <TableHead className="text-right">Requested</TableHead>
                            <TableHead className="text-right">Tariff Price</TableHead>
                            <TableHead className="text-right pr-5">Vetted Amount</TableHead>
                            <TableHead className="text-center">Verdict</TableHead>
                            <TableHead className="w-[80px] text-center"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {services.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-gray-400 italic">
                                    No {title.toLowerCase()} recorded
                                </TableCell>
                            </TableRow>
                        ) : (
                            services.map((service) => {
                                const isDeleted = service.is_deleted
                                const isAdhoc = service.is_ad_hoc
                                const vettedAmount = service.vetted_amount ?? service.claimed_amount

                                const qty = service.quantity ?? 1
                                const unitPrice = service.unit_price ?? service.claimed_amount

                                return (
                                    <TableRow key={service.id} className={`${isDeleted ? 'bg-red-50/80 hover:bg-red-50' : rowBg} transition-colors border-b last:border-0`}>
                                        <TableCell className="pl-5 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-sm font-bold ${isDeleted ? 'text-red-700 line-through' : 'text-gray-900 lowercase first-letter:uppercase'}`}>
                                                    {service.service_name}
                                                </span>
                                                <div className="flex flex-wrap gap-1.5 items-center">
                                                    {isAdhoc && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-200 bg-orange-50 text-orange-700 font-medium">
                                                            AD-HOC
                                                        </Badge>
                                                    )}
                                                    {isDeleted && (
                                                        <Badge variant="destructive" className="text-[9px] h-4 px-1 leading-none bg-red-600 border-none uppercase">
                                                            REJECTED
                                                        </Badge>
                                                    )}
                                                </div>
                                                {service.rejection_reason && (
                                                    <div className="flex items-start gap-1 p-1.5 bg-white/50 rounded border border-red-100 mt-1">
                                                        <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5" />
                                                        <span className="text-[10px] text-red-600 italic font-medium">
                                                            Reason: {service.rejection_reason}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {canEditPrice && !isDeleted ? (
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    className="h-8 w-16 text-center font-bold text-gray-700 bg-gray-50 border-gray-200 focus:ring-gray-400"
                                                    value={qty}
                                                    onChange={(e) => {
                                                        const newQty = Math.max(1, Number(e.target.value) || 1)
                                                        onUpdateService(service.id, {
                                                            quantity: newQty,
                                                            vetted_amount: newQty * unitPrice,
                                                            modified_by_name: currentUserName
                                                        })
                                                    }}
                                                />
                                            ) : (
                                                <span className={`text-sm font-bold ${isDeleted ? 'text-red-400' : 'text-gray-700'}`}>{qty}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className={`text-right text-sm font-medium ${isDeleted ? 'text-red-400' : 'text-gray-600'}`}>
                                            ₦{service.claimed_amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className={`text-right text-sm font-medium ${isDeleted ? 'text-red-400' : 'text-gray-600'}`}>
                                            ₦{service.tariff_amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right pr-5">
                                            {canEditPrice && !isDeleted ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <span className="text-gray-400 font-bold">₦</span>
                                                        <Input
                                                            type="number"
                                                            className="h-9 w-28 text-right font-black text-blue-700 bg-blue-50 border-blue-200 focus:ring-red-700"
                                                            value={vettedAmount}
                                                            onChange={(e) => onUpdateService(service.id, {
                                                                vetted_amount: Number(e.target.value),
                                                                modified_by_name: currentUserName
                                                            })}
                                                        />
                                                    </div>
                                                    {vettedAmount !== service.claimed_amount && (
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                <span>⚠ Modified</span>
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 line-through">
                                                                ₦{service.claimed_amount.toLocaleString()}
                                                            </span>
                                                            {service.modified_by_name && (
                                                                <span className="text-[9px] text-gray-500 italic">
                                                                    by {service.modified_by_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className={`text-sm font-black ${isDeleted ? 'text-red-400' : 'text-gray-900 underline decoration-gray-200 underline-offset-4'}`}>
                                                        ₦{vettedAmount.toLocaleString()}
                                                    </span>
                                                    {!isDeleted && vettedAmount !== service.claimed_amount && (
                                                        <>
                                                            <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">⚠ Modified</span>
                                                            <span className="text-[10px] text-gray-400 line-through">₦{service.claimed_amount.toLocaleString()}</span>
                                                            {service.modified_by_name && (
                                                                <span className="text-[9px] text-gray-500 italic">by {service.modified_by_name}</span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {!isDeleted ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className={`h-8 gap-1.5 px-3 rounded-full border-2 ${service.verdict === 'COVERED' || service.verdict === 'APPROVED' ? 'border-green-100 text-green-700 hover:bg-green-50' : 'border-red-100 text-red-700 hover:bg-red-50'}`}>
                                                            {service.verdict === 'COVERED' || service.verdict === 'APPROVED' ? (
                                                                <>
                                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Covered</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle className="h-3.5 w-3.5" />
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Not Covered</span>
                                                                </>
                                                            )}
                                                            <ChevronDown className="h-3 w-3 opacity-30" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="center" className="w-40 p-1">
                                                        <DropdownMenuItem
                                                            className="gap-2 focus:bg-green-50 focus:text-green-700 cursor-pointer py-2"
                                                            onClick={() => onUpdateService(service.id, { verdict: 'COVERED' })}
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                            <span className="font-bold text-xs">MARK COVERED</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="gap-2 focus:bg-red-50 focus:text-red-700 cursor-pointer py-2"
                                                            onClick={() => onUpdateService(service.id, { verdict: 'NOT_COVERED' })}
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                            <span className="font-bold text-xs">MARK NOT COVERED</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <div className="p-1 px-3 bg-red-100 text-red-600 rounded-full text-[9px] font-black uppercase">REJECTED</div>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-5 text-center">
                                            {!isDeleted ? (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 rounded-full text-red-500 hover:text-white hover:bg-red-600 transition-all shadow-sm hover:shadow"
                                                    onClick={() => onDeleteService(service.id)}
                                                    title="Click to Remove/Delete this service"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-8 w-8 rounded-full border-blue-500 text-blue-500 hover:bg-blue-50"
                                                    onClick={() => onUpdateService(service.id, { is_deleted: false, rejection_reason: undefined })}
                                                    title="Restore Service"
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                        {services.length > 0 && (
                            <TableRow className="bg-gray-100/50 border-t-2 border-gray-200">
                                <TableCell colSpan={4} className="text-right pr-4 py-4 font-black uppercase text-gray-400 text-[10px] tracking-widest">SUBTOTAL VETTED</TableCell>
                                <TableCell className={`text-right pr-5 font-black text-xl ${accentColor === 'purple' ? 'text-purple-700' : 'text-blue-700'}`}>
                                    ₦{services.filter(s => !s.is_deleted && s.verdict !== 'REJECTED').reduce((sum, s) => sum + (s.vetted_amount ?? s.claimed_amount), 0).toLocaleString()}
                                </TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
