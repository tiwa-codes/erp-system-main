"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Search, CheckCircle, AlertCircle, Copy, ArrowLeft, XCircle, Loader2, Save, Stethoscope, Pill, History } from "lucide-react"
import Link from "next/link"
import { PreviousEncounterModal } from "@/components/call-centre/PreviousEncounterModal"

export const dynamic = 'force-dynamic'

// Helper to classify a service as drug/pharmaceutical based on its category or name
const isDrug = (service: any): boolean => {
    const category = (service.category || service.category_id || service.service_category || "").toLowerCase()
    const name = (service.name || service.service_name || "").toLowerCase()
    return category.includes("drug") || category.includes("pharma") || category === "drg" ||
        name.includes("capsule") || name.includes("tablet") || name.includes("syrup") ||
        name.includes("injection") || name.includes("suspension") || name.includes("mg ") ||
        name.includes("mcg ") || name.endsWith(" mg") || name.endsWith(" mcg")
}

export default function EditManualApprovalCodePage() {
    const router = useRouter()
    const params = useParams()
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const codeId = params.id as string

    // Form State
    const [providerId, setProviderId] = useState("")
    const [providerName, setProviderName] = useState("")
    const [enrolleeName, setEnrolleeName] = useState("")
    const [enrolleeIdentifier, setEnrolleeIdentifier] = useState("")
    const [beneficiary, setBeneficiary] = useState<any>(null)
    // const [enrolleeId, setEnrolleeId] = useState("") 
    const [diagnosis, setDiagnosis] = useState("")
    const [clinicalEncounter, setClinicalEncounter] = useState("")
    const [approvalCode, setApprovalCode] = useState("")
    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const [diagnosisSearchTerm, setDiagnosisSearchTerm] = useState("")
    const [debouncedDiagnosisSearch, setDebouncedDiagnosisSearch] = useState("")
    const [showDiagnosisResults, setShowDiagnosisResults] = useState(false)
    const [selectedDiagnoses, setSelectedDiagnoses] = useState<Array<{
        code: string
        description: string
        category?: string
    }>>([])
    const [useCustomDiagnosis, setUseCustomDiagnosis] = useState(false)

    // Service State
    const [services, setServices] = useState<any[]>([])
    const [isAdHoc, setIsAdHoc] = useState(false)
    const [newServiceName, setNewServiceName] = useState("")
    const [newServicePrice, setNewServicePrice] = useState("")
    const [newServiceQuantity, setNewServiceQuantity] = useState("1")
    // Tariff state
    const [tariffType, setTariffType] = useState<"PRIVATE" | "NHIA">("PRIVATE")
    const [selectedTariffService, setSelectedTariffService] = useState<any>(null)

    // Search States
    const [serviceSearchTerm, setServiceSearchTerm] = useState("")
    const [drugSearchTerm, setDrugSearchTerm] = useState("")
    const [showServiceResults, setShowServiceResults] = useState(false)
    const [showDrugResults, setShowDrugResults] = useState(false)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (!target.closest('.diagnosis-search-container')) {
                setShowDiagnosisResults(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Fetch Code Details
    const { data: codeData, isLoading: isLoadingCode } = useQuery({
        queryKey: ["manual-code", codeId],
        queryFn: async () => {
            const res = await fetch(`/api/call-centre/manual-codes/${codeId}`)
            if (!res.ok) throw new Error("Failed to fetch code")
            return res.json()
        }
    })

    // Populate State
    useEffect(() => {
        if (codeData?.code) {
            const code = codeData.code
            setProviderId(code.provider_id || "")
            setProviderName(code.hospital || "") // Or provider name if available
            setEnrolleeName(code.enrollee_name)
            setEnrolleeIdentifier(code.enrollee_id || "")
            setBeneficiary(code.beneficiary || null)
            setApprovalCode(code.approval_code)
            const diagnosisText = (code.diagnosis || "").trim()
            const parsedDiagnoses = diagnosisText
                ? diagnosisText.split(";").map((entry: string) => entry.trim()).filter(Boolean).map((entry: string) => {
                    const match = entry.match(/^([A-Za-z0-9.]+)\s*-\s*(.+)$/)
                    if (!match) return null
                    return {
                        code: match[1].trim(),
                        description: match[2].trim()
                    }
                }).filter(Boolean) as Array<{ code: string; description: string; category?: string }>
                : []

            setDiagnosis(diagnosisText)
            setSelectedDiagnoses(parsedDiagnoses)
            setUseCustomDiagnosis(diagnosisText.length > 0 && parsedDiagnoses.length === 0)
            setDiagnosisSearchTerm("")
            setShowDiagnosisResults(false)
            setClinicalEncounter(code.clinical_encounter || "")

            // Map service items
            if (code.service_items) {
                setServices(code.service_items.map((item: any) => ({
                    id: item.id,
                    service_id: item.service_id || null,
                    name: item.service_name,
                    amount: Number(item.service_amount),
                    quantity: Number(item.quantity) || 1,
                    is_ad_hoc: item.is_ad_hoc,
                    category: item.category || null,
                    category_id: item.category || null,
                    service_category: item.category === "DRG" ? "Drugs / Pharmaceuticals" : "Medical Services"
                })))
            }
        }
    }, [codeData])

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedDiagnosisSearch(diagnosisSearchTerm)
        }, 300)
        return () => clearTimeout(timer)
    }, [diagnosisSearchTerm])

    const { data: diagnosisData } = useQuery({
        queryKey: ["diagnosis", debouncedDiagnosisSearch],
        queryFn: async () => {
            if (!debouncedDiagnosisSearch || debouncedDiagnosisSearch.length < 2) {
                return { diagnoses: [] }
            }

            const res = await fetch(`/api/diagnosis/search?q=${encodeURIComponent(debouncedDiagnosisSearch)}`)
            if (!res.ok) {
                throw new Error("Failed to fetch diagnosis")
            }
            return res.json()
        },
        enabled: !!debouncedDiagnosisSearch && debouncedDiagnosisSearch.length >= 2,
    })

    // Fetch Tariff Services (Provider Specific)
    const { data: tariffServices, isLoading: isLoadingServices } = useQuery({
        queryKey: ["services", tariffType, providerId, serviceSearchTerm, drugSearchTerm, enrolleeIdentifier],
        queryFn: async () => {
            const params = new URLSearchParams()
            const activeSearch = serviceSearchTerm || drugSearchTerm
            if (activeSearch) params.append('search', activeSearch)
            if (enrolleeIdentifier) params.append('enrollee_id', enrolleeIdentifier)

            if (tariffType === "NHIA") {
                const res = await fetch(`/api/settings/service-types/nhia?${params}`)
                return res.json()
            } else if (providerId) {
                // Fetch provider specific tariff
                const res = await fetch(`/api/provider/${providerId}/tariff-services?${params}`)
                return res.json()
            }
            return { services: [] }
        },
        enabled: (!!providerId || tariffType === "NHIA") && (
            showServiceResults === true ||
            showDrugResults === true ||
            !!serviceSearchTerm ||
            !!drugSearchTerm
        )
    })

    const formatLimitAmount = (value: any) => {
        const num = Number(value)
        if (!Number.isFinite(num)) return "N/A"
        return `₦${num.toLocaleString()}`
    }

    const serviceResults = (tariffServices?.services || []).filter((s: any) => {
        if (isDrug(s)) return false
        if (!serviceSearchTerm) return true
        return (s.service_name || s.name || "").toLowerCase().includes(serviceSearchTerm.toLowerCase())
    })

    const drugResults = (tariffServices?.services || []).filter((s: any) => {
        if (!isDrug(s)) return false
        if (!drugSearchTerm) return true
        return (s.service_name || s.name || "").toLowerCase().includes(drugSearchTerm.toLowerCase())
    })

    const handleDiagnosisSearch = (value: string) => {
        setDiagnosisSearchTerm(value)
        setShowDiagnosisResults(value.length >= 2)
        setUseCustomDiagnosis(false)
    }

    const handleSelectDiagnosis = (diag: any) => {
        setSelectedDiagnoses(prev => {
            if (prev.some(item => item.code === diag.code)) {
                return prev
            }

            const updatedDiagnoses = [
                ...prev,
                {
                    code: diag.code,
                    description: diag.description,
                    category: diag.category
                }
            ]

            setDiagnosis(updatedDiagnoses.map(item => `${item.code} - ${item.description}`).join("; "))
            return updatedDiagnoses
        })
        setDiagnosisSearchTerm("")
        setShowDiagnosisResults(false)
    }

    const handleRemoveDiagnosis = (code: string) => {
        setSelectedDiagnoses(prev => {
            const updatedDiagnoses = prev.filter(item => item.code !== code)
            setDiagnosis(updatedDiagnoses.map(item => `${item.code} - ${item.description}`).join("; "))
            return updatedDiagnoses
        })
    }

    const handleClearDiagnosis = () => {
        setSelectedDiagnoses([])
        setDiagnosisSearchTerm("")
        setDiagnosis("")
        setShowDiagnosisResults(false)
        setUseCustomDiagnosis(false)
    }

    const handleUseCustomDiagnosis = () => {
        setUseCustomDiagnosis(true)
        setSelectedDiagnoses([])
        setDiagnosisSearchTerm("")
        setDiagnosis("")
        setShowDiagnosisResults(false)
    }

    // Handlers for Service Search
    const handleServiceSelect = (service: any, drugMode = false) => {
        const normalized = {
            id: service.id, // Tariff ID
            service_id: service.service_id || service.id,
            name: service.service_name || service.name,
            amount: Number(service.price || service.amount || 0),
            quantity: 1,
            category: service.category || service.category_id || null,
            category_id: service.category_id || service.category || null,
            service_category: service.service_category || service.category_name || null
        }
        setSelectedTariffService(normalized)
        setNewServiceQuantity("1")
        if (drugMode) {
            setDrugSearchTerm(normalized.name)
            setServiceSearchTerm("")
        } else {
            setServiceSearchTerm(normalized.name)
            setDrugSearchTerm("")
        }
        setShowServiceResults(false)
        setShowDrugResults(false)
    }

    // Add Service to List
    const handleAddService = () => {
        if (isAdHoc) {
            if (!newServiceName || !newServicePrice) return
            setServices([...services, {
                id: `new-${Date.now()}`,
                name: newServiceName,
                amount: Number(newServicePrice),
                quantity: Number(newServiceQuantity) || 1,
                is_ad_hoc: true
            }])
            setNewServiceName("")
            setNewServicePrice("")
            setNewServiceQuantity("1")
        } else {
            // Tariff Service
            if (selectedTariffService) {
                setServices([...services, {
                    ...selectedTariffService,
                    quantity: Number(newServiceQuantity) || 1,
                    is_ad_hoc: false,
                    // If we need to track that it's a NEW item vs existing, the ID structure helps.
                    // But API will just replace all items.
                }])
                setSelectedTariffService(null)
                setServiceSearchTerm("")
                setDrugSearchTerm("")
                setNewServiceQuantity("1")
            }
        }
    }

    const handleRemoveService = (index: number) => {
        const newS = [...services]
        newS.splice(index, 1)
        setServices(newS)
    }

    // Update Request
    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`/api/call-centre/manual-codes/${codeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            })
            if (!res.ok) throw new Error("Failed to update code")
            return res.json()
        },
        onSuccess: (data) => {
            toast({ title: "Success", description: "Approval Code Updated" })
            queryClient.invalidateQueries({ queryKey: ["manual-code", codeId] })
            router.push('/call-centre/manual-code')
        },
        onError: () => {
            toast({ variant: "destructive", title: "Error", description: "Failed to update code" })
        }
    })

    // Calculate Total
    const totalAmount = services.reduce((sum, s) => sum + (s.amount * (s.quantity || 1)), 0)

    if (isLoadingCode) {
        return <div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="p-6 space-y-6">
            <div className="mb-6">
                <Link href="/call-centre/manual-code">
                    <Button variant="ghost" size="sm" className="gap-2">
                        <ArrowLeft className="h-4 w-4" /> Back to History
                    </Button>
                </Link>
            </div>

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Edit Approval Code</h1>
                    <p className="text-muted-foreground">View details and update services for {approvalCode}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-lg px-3 py-1 bg-gray-100">
                        {approvalCode}
                    </Badge>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Request Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {beneficiary && (
                                <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800 border-l-4 border-blue-500 space-y-3">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="space-y-1">
                                            <p className="font-bold">
                                                {beneficiary.first_name} {beneficiary.last_name}
                                                {beneficiary.is_dependent && <span className="text-xs font-normal ml-2">(Dependent)</span>}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-blue-700">
                                                <p>
                                                    ID: <span className="font-medium">{beneficiary.enrollee_id || enrolleeIdentifier || "N/A"}</span>
                                                </p>
                                                <p>
                                                    Organization: <span className="font-medium">{beneficiary.organization?.name || "N/A"}</span>
                                                </p>
                                                <p>
                                                    Plan: <span className="font-medium">{beneficiary.plan?.name || "N/A"}</span>
                                                </p>
                                                <p>
                                                    Age: <span className="font-medium">{calculateAge(beneficiary.date_of_birth)}</span>
                                                </p>
                                                <p>
                                                    Account Type: <span className="font-medium">{beneficiary.account_type || "N/A"}</span>
                                                </p>
                                                <p>
                                                    Gender: <span className="font-medium">{beneficiary.gender || "N/A"}</span>
                                                </p>
                                                <p>
                                                    Marital Status: <span className="font-medium">{beneficiary.marital_status || "N/A"}</span>
                                                </p>
                                                <p>
                                                    Phone: <span className="font-medium">{beneficiary.phone_number || "N/A"}</span>
                                                </p>
                                                <p>
                                                    Email: <span className="font-medium">{beneficiary.email || "N/A"}</span>
                                                </p>
                                                <p className="md:col-span-2">
                                                    Expires: <span className="font-medium">{beneficiary.end_date ? new Date(beneficiary.end_date).toLocaleDateString('en-GB') : "N/A"}</span>
                                                </p>
                                            </div>
                                            {beneficiary.is_dependent && beneficiary.principal_name && (
                                                <p className="text-xs mt-1">Principal: {beneficiary.principal_name}</p>
                                            )}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs gap-1 h-7 border-blue-300 hover:bg-blue-100 shrink-0"
                                            onClick={() => setShowHistoryModal(true)}
                                        >
                                            <History className="h-3.5 w-3.5" />
                                            Previous Encounter
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-gray-500">Provider / Hospital</Label>
                                    <div className="font-medium text-lg">{providerName}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-gray-500">Enrollee</Label>
                                    <div className="font-medium text-lg">{enrolleeName}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-gray-500">Enrollee ID</Label>
                                    <div className="font-medium text-base">{enrolleeIdentifier || "-"}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="diagnosis">Diagnosis</Label>
                                {!useCustomDiagnosis ? (
                                    <div className="relative diagnosis-search-container">
                                        <div className="relative">
                                            <Input
                                                id="diagnosis"
                                                placeholder="Search ICD-10 diagnosis and select multiple..."
                                                value={diagnosisSearchTerm}
                                                onChange={(e) => handleDiagnosisSearch(e.target.value)}
                                                onFocus={() => setShowDiagnosisResults(diagnosisSearchTerm.length >= 2)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                    }
                                                }}
                                            />
                                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                            {selectedDiagnoses.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={handleClearDiagnosis}
                                                    className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                    title="Clear all selected diagnoses"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>

                                        {showDiagnosisResults && diagnosisData?.diagnoses && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {diagnosisData.diagnoses.length > 0 ? (
                                                    diagnosisData.diagnoses.map((diag: any) => (
                                                        <div
                                                            key={diag.code}
                                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                            onClick={() => handleSelectDiagnosis(diag)}
                                                        >
                                                            <div className="font-medium text-gray-900">
                                                                {diag.code} - {diag.description}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-3 text-gray-500 text-sm">
                                                        No diagnosis found. Try a different search term.
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {selectedDiagnoses.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {selectedDiagnoses.map((diag) => (
                                                    <Badge key={diag.code} variant="secondary" className="gap-1 pr-1">
                                                        <span className="max-w-[320px] truncate" title={`${diag.code} - ${diag.description}`}>
                                                            {diag.code} - {diag.description}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDiagnosis(diag.code)}
                                                            className="rounded-sm hover:bg-black/10 p-0.5"
                                                            aria-label={`Remove ${diag.code}`}
                                                        >
                                                            <XCircle className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <Textarea
                                        id="diagnosis"
                                        value={diagnosis}
                                        onChange={(e) => setDiagnosis(e.target.value)}
                                        placeholder="Add or update diagnosis..."
                                        rows={3}
                                    />
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                    <input
                                        type="checkbox"
                                        id="useCustomDiagnosis"
                                        checked={useCustomDiagnosis}
                                        onChange={(e) => e.target.checked ? handleUseCustomDiagnosis() : setUseCustomDiagnosis(false)}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <Label htmlFor="useCustomDiagnosis" className="cursor-pointer text-sm font-normal">
                                        Use Custom Diagnosis
                                    </Label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="clinicalEncounter">Clinical Findings / Encounter Notes</Label>
                                <Textarea
                                    id="clinicalEncounter"
                                    value={clinicalEncounter}
                                    onChange={(e) => setClinicalEncounter(e.target.value)}
                                    placeholder="Add clinical findings or encounter notes..."
                                    rows={4}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Services</CardTitle>
                            <CardDescription>Add, remove or update services.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Service Adder */}
                            <div className="bg-gray-50 p-4 rounded-lg space-y-4 border">
                                <div className="flex gap-4 items-center">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="adhoc"
                                            checked={isAdHoc}
                                            onChange={(e) => setIsAdHoc(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <Label htmlFor="adhoc" className="cursor-pointer font-medium">Add Ad-Hoc / Custom Service</Label>
                                    </div>

                                    {!isAdHoc && (
                                        <div className="flex items-center gap-2 ml-auto">
                                            <Label className="text-xs text-muted-foreground">Tariff:</Label>
                                            <Select value={tariffType} onValueChange={(v: any) => setTariffType(v)}>
                                                <SelectTrigger className="h-8 w-[100px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="PRIVATE">Private</SelectItem>
                                                    <SelectItem value="NHIA">NHIA</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 items-end">
                                    {isAdHoc ? (
                                        <>
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-xs">Service Name</Label>
                                                <Input
                                                    value={newServiceName}
                                                    onChange={(e) => setNewServiceName(e.target.value)}
                                                    placeholder="e.g. Special Treatment X"
                                                />
                                            </div>
                                            <div className="w-[150px] space-y-1">
                                                <Label className="text-xs">Price (₦)</Label>
                                                <Input
                                                    type="number"
                                                    value={newServicePrice}
                                                    onChange={(e) => setNewServicePrice(e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="w-[100px] space-y-1">
                                                <Label className="text-xs">Qty</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={newServiceQuantity}
                                                    onChange={(e) => setNewServiceQuantity(e.target.value)}
                                                    placeholder="1"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs">Select Service / Drug</Label>
                                            {!providerId && tariffType !== "NHIA" ? (
                                                <div className="text-sm text-muted-foreground p-2 border rounded bg-gray-100">
                                                    Provider not linked properly to fetch tariff.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    <div className="relative service-search-container">
                                                        <div className="relative">
                                                            <Input
                                                                placeholder="Search medical service..."
                                                                value={serviceSearchTerm}
                                                                onChange={(e) => {
                                                                    setServiceSearchTerm(e.target.value)
                                                                    setDrugSearchTerm("")
                                                                    setShowServiceResults(true)
                                                                    setShowDrugResults(false)
                                                                    if (!e.target.value) setSelectedTariffService(null)
                                                                }}
                                                                onFocus={() => {
                                                                    setShowServiceResults(true)
                                                                    setShowDrugResults(false)
                                                                }}
                                                            />
                                                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                                        </div>
                                                        {showServiceResults && (
                                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                                {isLoadingServices ? (
                                                                    <div className="px-4 py-3 text-gray-500 text-sm flex items-center gap-2">
                                                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                                                    </div>
                                                                ) : serviceResults.length > 0 ? (
                                                                    serviceResults.map((s: any) => (
                                                                        <div
                                                                            key={s.id}
                                                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                                            onClick={() => handleServiceSelect(s, false)}
                                                                        >
                                                                            <div className="flex justify-between">
                                                                                <span className="font-medium text-gray-900">{s.service_name || s.name}</span>
                                                                                <span className="font-bold text-gray-700">₦{Number(s.price || s.amount || 0).toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-500">{s.category_name || s.service_category}</div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-4 py-3 text-gray-500 text-sm">No services found.</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="relative drug-search-container">
                                                        <div className="relative">
                                                            <Input
                                                                placeholder="Search drugs..."
                                                                value={drugSearchTerm}
                                                                onChange={(e) => {
                                                                    setDrugSearchTerm(e.target.value)
                                                                    setServiceSearchTerm("")
                                                                    setShowDrugResults(true)
                                                                    setShowServiceResults(false)
                                                                    if (!e.target.value) setSelectedTariffService(null)
                                                                }}
                                                                onFocus={() => {
                                                                    setShowDrugResults(true)
                                                                    setShowServiceResults(false)
                                                                }}
                                                            />
                                                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                                        </div>
                                                        {showDrugResults && (
                                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                                {isLoadingServices ? (
                                                                    <div className="px-4 py-3 text-gray-500 text-sm flex items-center gap-2">
                                                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                                                    </div>
                                                                ) : drugResults.length > 0 ? (
                                                                    drugResults.map((s: any) => (
                                                                        <div
                                                                            key={s.id}
                                                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                                            onClick={() => handleServiceSelect(s, true)}
                                                                        >
                                                                            <div className="flex justify-between">
                                                                                <span className="font-medium text-gray-900">{s.service_name || s.name}</span>
                                                                                <span className="font-bold text-gray-700">₦{Number(s.price || s.amount || 0).toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-500">{s.category_name || s.service_category}</div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-4 py-3 text-gray-500 text-sm">No drugs found.</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-[80px]">
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={newServiceQuantity}
                                                            onChange={(e) => setNewServiceQuantity(e.target.value)}
                                                            placeholder="Qty"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <Button onClick={handleAddService} disabled={isAdHoc ? (!newServiceName || !newServicePrice) : !selectedTariffService}>
                                        <Plus className="h-4 w-4 mr-2" /> Add
                                    </Button>
                                </div>
                            </div>

                            {/* Services Table — separated by type */}
                            {(() => {
                                // Build indexed list so mutations always use the original index in `services`
                                const indexed = services.map((s, i) => ({ s, i }))
                                const medical = indexed.filter(({ s }) => !isDrug(s))
                                const drugs   = indexed.filter(({ s }) =>  isDrug(s))

                                const ServiceRow = ({ s, idx }: { s: typeof services[0], idx: number }) => (
                                    <TableRow key={idx} className={s.is_ad_hoc ? "bg-orange-50 border-l-4 border-l-orange-500" : ""}>
                                        <TableCell className="font-medium">{s.name}</TableCell>
                                        <TableCell>
                                            {s.is_ad_hoc ? (
                                                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-100">Manual</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-100">Tariff</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                min="1"
                                                className="w-[60px] h-8 text-right ml-auto"
                                                value={s.quantity}
                                                onChange={(e) => {
                                                    const newS = [...services]
                                                    newS[idx].quantity = Number(e.target.value) || 1
                                                    setServices(newS)
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center">
                                                <span className="text-gray-500 mr-1">₦</span>
                                                <Input
                                                    type="number"
                                                    className="w-[90px] h-8 text-right"
                                                    value={s.amount}
                                                    onChange={(e) => {
                                                        const newS = [...services]
                                                        newS[idx].amount = Number(e.target.value)
                                                        setServices(newS)
                                                    }}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-gray-700">
                                            ₦{(s.amount * (s.quantity || 1)).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveService(idx)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )

                                const SectionTable = ({ rows, label, icon, iconColor }: { rows: typeof indexed; label: string; icon: React.ReactNode; iconColor: string }) => (
                                    <div>
                                        <div className={`flex items-center gap-2 mb-2 font-semibold text-sm ${iconColor}`}>
                                            {icon}
                                            {label}
                                        </div>
                                        <div className="border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Service</TableHead>
                                                        <TableHead className="w-[100px]">Type</TableHead>
                                                        <TableHead className="w-[80px] text-right">Qty</TableHead>
                                                        <TableHead className="text-right">Price</TableHead>
                                                        <TableHead className="text-right">Total</TableHead>
                                                        <TableHead className="w-[50px]"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {rows.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-4 text-sm">
                                                                None
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        rows.map(({ s, i }) => <ServiceRow key={i} s={s} idx={i} />)
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )

                                return (
                                    <div className="space-y-4">
                                        <SectionTable
                                            rows={medical}
                                            label="Medical Services"
                                            iconColor="text-blue-700"
                                            icon={<Stethoscope className="h-4 w-4" />}
                                        />
                                        <SectionTable
                                            rows={drugs}
                                            label="Drugs / Pharmaceuticals"
                                            iconColor="text-purple-700"
                                            icon={<Pill className="h-4 w-4" />}
                                        />
                                    </div>
                                )
                            })()}

                            <div className="flex justify-between items-center pt-4 border-t">
                                <span className="text-lg font-medium">Total Amount</span>
                                <span className="text-2xl font-bold text-primary">₦{totalAmount.toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button
                                className="w-full bg-[#BE1522] hover:bg-[#9B1219] text-lg py-6"
                                disabled={services.length === 0 || updateMutation.isPending}
                                onClick={() => updateMutation.mutate({
                                    diagnosis,
                                    clinical_encounter: clinicalEncounter,
                                    services,
                                    claim_amount: totalAmount
                                })}
                            >
                                {updateMutation.isPending ? "Updating..." : "Update Code"}
                            </Button>

                            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border">
                                <div className="flex gap-2">
                                    <AlertCircle className="h-4 w-4 text-blue-500" />
                                    <p>Updating will overwrite the service list and recalculate the total amount.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {beneficiary && (
                <PreviousEncounterModal
                    isOpen={showHistoryModal}
                    onOpenChange={setShowHistoryModal}
                    enrolleeId={beneficiary.enrollee_id || enrolleeIdentifier || beneficiary.id || ""}
                    enrolleeName={`${beneficiary.first_name || enrolleeName} ${beneficiary.last_name || ""}`.trim()}
                />
            )}
        </div>
    )
}
    const calculateAge = (dateOfBirth?: string | Date | null) => {
        if (!dateOfBirth) return "N/A"
        const dob = new Date(dateOfBirth)
        if (Number.isNaN(dob.getTime())) return "N/A"
        const today = new Date()
        let age = today.getFullYear() - dob.getFullYear()
        const monthDiff = today.getMonth() - dob.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--
        }
        return age >= 0 ? String(age) : "N/A"
    }
