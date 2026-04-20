"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Search, CheckCircle, AlertCircle, Copy, ArrowLeft, XCircle, Loader2, History, Pill, Stethoscope } from "lucide-react"
import Link from "next/link"
import { PreviousEncounterModal } from "@/components/call-centre/PreviousEncounterModal"



export default function ManualApprovalCodePage() {
    const router = useRouter()
    const { toast } = useToast()

    // Form State
    const [providerId, setProviderId] = useState("")
    const [providerName, setProviderName] = useState("")
    const [providerBands, setProviderBands] = useState<string[]>([])
    const [enrollee, setEnrollee] = useState<any>(null)
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string>("")
    const [diagnosis, setDiagnosis] = useState("")
    const [clinicalEncounter, setClinicalEncounter] = useState("")

    // ICD-10 Diagnosis search states
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
    const [providerSearchTerm, setProviderSearchTerm] = useState("")
    const [showProviderResults, setShowProviderResults] = useState(false)

    const [serviceSearchTerm, setServiceSearchTerm] = useState("")
    const [debouncedServiceSearch, setDebouncedServiceSearch] = useState("")
    const [cachedServices, setCachedServices] = useState<any[]>([])
    const [showServiceResults, setShowServiceResults] = useState(false)

    const [drugSearchTerm, setDrugSearchTerm] = useState("")
    const [debouncedDrugSearch, setDebouncedDrugSearch] = useState("")
    const [showDrugResults, setShowDrugResults] = useState(false)

    const [enrolleeSearchTerm, setEnrolleeSearchTerm] = useState("")
    const [debouncedEnrolleeSearch, setDebouncedEnrolleeSearch] = useState("")
    const [showEnrolleeResults, setShowEnrolleeResults] = useState(false)

    // Generated Code State
    const [successCode, setSuccessCode] = useState("")
    const [showHistoryModal, setShowHistoryModal] = useState(false)

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

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (!target.closest('.provider-search-container')) {
                setShowProviderResults(false)
            }
            if (!target.closest('.enrollee-search-container')) {
                setShowEnrolleeResults(false)
            }
            if (!target.closest('.service-search-container')) {
                setShowServiceResults(false)
            }
            if (!target.closest('.drug-search-container')) {
                setShowDrugResults(false)
            }
            if (!target.closest('.diagnosis-search-container')) {
                setShowDiagnosisResults(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedEnrolleeSearch(enrolleeSearchTerm)
        }, 400)
        return () => clearTimeout(timer)
    }, [enrolleeSearchTerm])

    // Debounce service search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedServiceSearch(serviceSearchTerm)
        }, 300)
        return () => clearTimeout(timer)
    }, [serviceSearchTerm])

    // Debounce drug search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedDrugSearch(drugSearchTerm)
        }, 300)
        return () => clearTimeout(timer)
    }, [drugSearchTerm])

    // Debounce diagnosis search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedDiagnosisSearch(diagnosisSearchTerm)
        }, 300)
        return () => clearTimeout(timer)
    }, [diagnosisSearchTerm])

    // Fetch Providers
    const { data: providersData, isLoading: isLoadingProviders } = useQuery({
        queryKey: ["providers", providerSearchTerm],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (providerSearchTerm) params.append('search', providerSearchTerm)
            params.append('limit', '50') // Fetch top 50 matches

            const res = await fetch(`/api/providers?${params}`)
            return res.json()
        },
        enabled: showProviderResults // Only fetch when searching/dropdown open
    })

    // Fetch Enrollees (Principals + Dependents)
    const { data: enrolleesData, isLoading: isLoadingEnrollees } = useQuery({
        queryKey: ["enrollees", debouncedEnrolleeSearch],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (debouncedEnrolleeSearch) params.append('search', debouncedEnrolleeSearch)
            const res = await fetch(`/api/underwriting/principals?${params}`)
            if (!res.ok) {
                throw new Error("Failed to fetch enrollees")
            }
            return res.json()
        },
        enabled: showEnrolleeResults
    })

    // Fetch ICD-10 Diagnosis
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

    const enrolleeIdentifier = enrollee?.enrollee_id || selectedBeneficiaryId || enrollee?.id || ""

    const canSearchTariffServices = (tariffType === "NHIA" || !!providerId) && !!enrolleeIdentifier

    // Fetch Tariff Services (Provider Specific)
    const { data: tariffServices, isLoading: isLoadingServices } = useQuery({
        queryKey: ["services", tariffType, providerId, debouncedServiceSearch, debouncedDrugSearch, enrolleeIdentifier],
        queryFn: async () => {
            const params = new URLSearchParams()
            // Use whichever search term is active
            const activeSearch = debouncedServiceSearch || debouncedDrugSearch
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
        enabled: canSearchTariffServices && (showServiceResults === true || showDrugResults === true || !!debouncedServiceSearch || !!debouncedDrugSearch),
        staleTime: 1000 * 20
    })

    useEffect(() => {
        setCachedServices([])
        setSelectedTariffService(null)
    }, [enrolleeIdentifier, providerId, tariffType])

    useEffect(() => {
        if (!serviceSearchTerm && (tariffServices?.services || []).length > 0) {
            setCachedServices(tariffServices.services)
        }
    }, [serviceSearchTerm, tariffServices?.services])

    const serviceResults = (() => {
        const baseServices = (tariffServices?.services || []).length > 0
            ? tariffServices.services
            : cachedServices

        const normalizeForSearch = (value: string) => value.trim().toLowerCase()

        // Helper to check if a service is a drug
        const isDrug = (s: any) => {
            const cat = (s.category_name || s.service_category || s.category_id || '').toLowerCase()
            const name = (s.service_name || s.name || '').toLowerCase()
            return cat.includes('drug') || cat.includes('pharmacy') || cat.includes('medication') || cat === 'drg' ||
                name.includes('tablet') || name.includes('capsule') || name.includes('syrup') || name.includes('injection')
        }

        if (serviceSearchTerm) {
            const query = normalizeForSearch(serviceSearchTerm)
            return baseServices.filter((service: any) => {
                const name = normalizeForSearch(service.service_name || service.name || '')
                return name.includes(query) && !isDrug(service)
            })
        }
        return baseServices.filter((s: any) => !isDrug(s))
    })()

    const drugResults = (() => {
        const baseServices = (tariffServices?.services || []).length > 0
            ? tariffServices.services
            : cachedServices

        const normalizeForSearch = (value: string) => value.trim().toLowerCase()

        const isDrug = (s: any) => {
            const cat = (s.category_name || s.service_category || s.category_id || '').toLowerCase()
            const name = (s.service_name || s.name || '').toLowerCase()
            return cat.includes('drug') || cat.includes('pharmacy') || cat.includes('medication') || cat === 'drg' ||
                name.includes('tablet') || name.includes('capsule') || name.includes('syrup') || name.includes('injection')
        }

        if (drugSearchTerm) {
            const query = normalizeForSearch(drugSearchTerm)
            return baseServices.filter((service: any) => {
                const name = normalizeForSearch(service.service_name || service.name || '')
                return name.includes(query) && isDrug(service)
            })
        }
        return baseServices.filter((s: any) => isDrug(s))
    })()

    // Handlers for Provider Search
    const handleProviderSelect = (provider: any) => {
        setProviderId(provider.id)
        setProviderName(provider.facility_name)
        setProviderBands(Array.isArray(provider.selected_bands) ? provider.selected_bands : [])
        setProviderSearchTerm(provider.facility_name)
        setShowProviderResults(false)
        // Reset service selection when provider changes
        setSelectedTariffService(null)
        setServiceSearchTerm("")
    }

    const handleSelectEnrollee = (entry: any) => {
        setEnrollee(entry)
        setSelectedBeneficiaryId(entry.id)
        setEnrolleeSearchTerm(`${entry.first_name} ${entry.last_name}`)
        setShowEnrolleeResults(false)
    }

    const handleClearProvider = () => {
        setProviderId("")
        setProviderName("")
        setProviderBands([])
        setProviderSearchTerm("")
        setSelectedTariffService(null)
    }

    // Diagnosis search handlers
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

    const handleRemoveDiagnosis = (code: string) => {
        setSelectedDiagnoses(prev => {
            const updatedDiagnoses = prev.filter(item => item.code !== code)
            setDiagnosis(updatedDiagnoses.map(item => `${item.code} - ${item.description}`).join("; "))
            return updatedDiagnoses
        })
    }

    // Handlers for Service Search
    const handleServiceSelect = (service: any, isDrugContext: boolean) => {
        if (service.selectable === false || service.coverage_status === "LIMIT_EXCEEDED" || service.coverage === "LIMIT_EXCEEDED") {
            toast({
                title: "Category Limit Reached",
                description: service.status_message || "This category has reached its configured limit for the enrollee.",
                variant: "destructive",
            })
            return
        }

        // Normalize service object fields since endpoints might differ slightly
        const normalized = {
            id: service.id, // Tariff ID
            name: service.service_name || service.name,
            amount: Number(service.price || service.amount || 0),
            quantity: 1,
            is_drug: isDrugContext
        }
        setSelectedTariffService(normalized)
        setNewServiceQuantity("1")
        if (isDrugContext) {
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
                is_ad_hoc: true,
                is_drug: false
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
                    is_ad_hoc: false
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

    // Submit
    const submitMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/call-centre/manual-codes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            })
            if (!res.ok) throw new Error("Failed to generate code")
            return res.json()
        },
        onSuccess: (data) => {
            setSuccessCode(data.approval_code)
            toast({ title: "Success", description: "Manual Approval Code Generated" })
        },
        onError: () => {
            toast({ variant: "destructive", title: "Error", description: "Failed to generate code" })
        }
    })

    // Calculate Total
    const totalAmount = services.reduce((sum, s) => sum + (s.amount * (s.quantity || 1)), 0)
    const formatLimitAmount = (value: any) => {
        const num = Number(value)
        if (!Number.isFinite(num)) return "N/A"
        return `₦${num.toLocaleString()}`
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
                    <h1 className="text-3xl font-bold tracking-tight">Generate Approval Code</h1>
                    <p className="text-muted-foreground">Manually create approval codes for ad-hoc or tariff requests.</p>
                </div>
            </div>

            {successCode ? (
                // Success View
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-6 flex flex-col items-center justify-center space-y-4">
                        <CheckCircle className="h-16 w-16 text-green-600" />
                        <h2 className="text-2xl font-bold text-green-800">Code Generated Successfully!</h2>
                        <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                            <span className="text-4xl font-mono font-bold text-gray-900">{successCode}</span>
                            <Button variant="ghost" size="icon" onClick={() => {
                                navigator.clipboard.writeText(successCode)
                                toast({ title: "Copied!" })
                            }}>
                                <Copy className="h-5 w-5" />
                            </Button>
                        </div>
                        <Button onClick={() => {
                            setSuccessCode("")
                            setServices([])
                            setEnrollee(null)
                            setProviderId("")
                            setSelectedBeneficiaryId("")
                            setEnrolleeSearchTerm("")
                            setShowEnrolleeResults(false)
                            setProviderName("")
                            setProviderBands([])
                            setProviderSearchTerm("")
                            setDiagnosis("")
                            setDiagnosisSearchTerm("")
                            setSelectedDiagnoses([])
                            setUseCustomDiagnosis(false)
                        }}>Generate Another</Button>
                    </CardContent>
                </Card>
            ) : (

                <div className="space-y-6">

                    {/* Left Column: Details */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Request Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Provider Search */}
                                <div className="space-y-2">
                                    <Label>Provider / Hospital</Label>
                                    <div className="relative provider-search-container">
                                        <div className="relative">
                                            <Input
                                                placeholder="Search provider by name..."
                                                value={providerSearchTerm}
                                                onChange={(e) => {
                                                    setProviderSearchTerm(e.target.value)
                                                    setShowProviderResults(true)
                                                    if (!e.target.value) setProviderId("")
                                                }}
                                                onFocus={() => setShowProviderResults(true)}
                                            />
                                            {providerId ? (
                                                <button
                                                    type="button"
                                                    onClick={handleClearProvider}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </button>
                                            ) : (
                                                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                            )}
                                        </div>

                                        {/* Dropdown Results */}
                                        {showProviderResults && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {isLoadingProviders ? (
                                                    <div className="px-4 py-3 text-gray-500 text-sm flex items-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                                    </div>
                                                ) : (providersData?.providers || []).length > 0 ? (
                                                    (providersData?.providers || []).map((p: any) => (
                                                        <div
                                                            key={p.id}
                                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                            onClick={() => handleProviderSelect(p)}
                                                        >
                                                            <div className="font-medium text-gray-900">{p.facility_name}</div>
                                                            <div className="text-xs text-gray-500">{p.facility_type} • {p.location || 'No Location'}</div>
                                                            <div className="text-xs text-blue-600">
                                                                Provider Band: {Array.isArray(p.selected_bands) && p.selected_bands.length > 0 ? p.selected_bands.join(", ") : "Not assigned"}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-3 text-gray-500 text-sm">No providers found.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {providerId && (
                                        <div className="bg-emerald-50 p-3 rounded-md text-sm text-emerald-800 border-l-4 border-emerald-500">
                                            <p className="font-semibold">{providerName}</p>
                                            <p className="text-xs mt-1">
                                                Provider Band: <span className="font-medium">{providerBands.length > 0 ? providerBands.join(", ") : "Not assigned"}</span>
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Enrollee Search & Selection */}
                                <div className="space-y-2 relative enrollee-search-container">
                                    <Label>Enrollee (Principal or Dependent)</Label>
                                    <div className="relative">
                                        <Input
                                            value={enrolleeSearchTerm}
                                            onChange={(e) => {
                                                setEnrolleeSearchTerm(e.target.value)
                                                setShowEnrolleeResults(true)
                                            }}
                                            onFocus={() => setShowEnrolleeResults(true)}
                                            placeholder="Search by name or ID..."
                                            className="pr-10"
                                        />
                                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    </div>

                                    {showEnrolleeResults && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {isLoadingEnrollees ? (
                                                <div className="px-4 py-3 text-gray-500 text-sm flex items-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                                </div>
                                            ) : ((!enrolleesData?.principals?.length && !enrolleesData?.dependents?.length) ? (
                                                <div className="px-4 py-3 text-gray-500 text-sm">No enrollees found.</div>
                                            ) : (
                                                <>
                                                    {enrolleesData?.principals?.map((principal: any) => (
                                                        <div
                                                            key={principal.id}
                                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                            onClick={() => handleSelectEnrollee(principal)}
                                                        >
                                                            <div className="font-medium text-gray-900">
                                                                {principal.first_name} {principal.last_name}
                                                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">PRINCIPAL</span>
                                                            </div>
                                                            <div className="text-xs text-gray-500">ID: {principal.enrollee_id}</div>
                                                            <div className="text-xs text-gray-500">{principal.organization?.name}</div>
                                                        </div>
                                                    ))}
                                                    {enrolleesData?.dependents?.map((dependent: any) => (
                                                        <div
                                                            key={dependent.id}
                                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                            onClick={() => handleSelectEnrollee({
                                                                id: dependent.id,
                                                                enrollee_id: dependent.dependent_id,
                                                                first_name: dependent.first_name,
                                                                last_name: dependent.last_name,
                                                                date_of_birth: dependent.date_of_birth || null,
                                                                phone_number: dependent.phone_number || dependent.principal?.phone_number || null,
                                                                email: dependent.email || dependent.principal?.email || null,
                                                                account_type: dependent.principal?.account_type || null,
                                                                organization: dependent.principal?.organization,
                                                                plan: dependent.principal?.plan,
                                                                gender: dependent.gender || dependent.principal?.gender || null,
                                                                marital_status: dependent.principal?.marital_status || null,
                                                                end_date: dependent.principal?.end_date || null,
                                                                is_dependent: true,
                                                                principal_name: `${dependent.principal?.first_name} ${dependent.principal?.last_name}`
                                                            })}
                                                        >
                                                            <div className="font-medium text-gray-900">
                                                                {dependent.first_name} {dependent.last_name}
                                                                <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">DEPENDENT</span>
                                                            </div>
                                                            <div className="text-xs text-gray-500">ID: {dependent.dependent_id}</div>
                                                            <div className="text-xs text-gray-500">
                                                                Principal: {dependent.principal?.first_name} {dependent.principal?.last_name}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </>
                                            ))}
                                        </div>
                                    )}

                                    {enrollee && (
                                        <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800 border-l-4 border-blue-500 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <p className="font-bold">
                                                        {enrollee.first_name} {enrollee.last_name}
                                                        {enrollee.is_dependent && <span className="text-xs font-normal ml-2">(Dependent)</span>}
                                                    </p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-blue-700">
                                                        <p>
                                                            ID: <span className="font-medium">{enrollee.enrollee_id || selectedBeneficiaryId || "N/A"}</span>
                                                        </p>
                                                        <p>
                                                            Organization: <span className="font-medium">{enrollee.organization?.name || "N/A"}</span>
                                                        </p>
                                                        <p>
                                                            Plan: <span className="font-medium">{enrollee.plan?.name || "N/A"}</span>
                                                        </p>
                                                        <p>
                                                            Age: <span className="font-medium">{calculateAge(enrollee.date_of_birth)}</span>
                                                        </p>
                                                        <p>
                                                            Account Type: <span className="font-medium">{enrollee.account_type || "N/A"}</span>
                                                        </p>
                                                        <p>
                                                            Gender: <span className="font-medium">{enrollee.gender || "N/A"}</span>
                                                        </p>
                                                        <p>
                                                            Marital Status: <span className="font-medium">{enrollee.marital_status || "N/A"}</span>
                                                        </p>
                                                        <p>
                                                            Phone: <span className="font-medium">{enrollee.phone_number || "N/A"}</span>
                                                        </p>
                                                        <p>
                                                            Email: <span className="font-medium">{enrollee.email || "N/A"}</span>
                                                        </p>
                                                        <p className="md:col-span-2">
                                                            Expires: <span className="font-medium">{enrollee.end_date ? new Date(enrollee.end_date).toLocaleDateString('en-GB') : "N/A"}</span>
                                                        </p>
                                                    </div>
                                                    {enrollee.is_dependent && enrollee.principal_name && (
                                                        <p className="text-xs mt-1">Principal: {enrollee.principal_name}</p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs gap-1 h-7 border-blue-300 hover:bg-blue-100"
                                                    onClick={() => setShowHistoryModal(true)}
                                                >
                                                    <History className="h-3.5 w-3.5" />
                                                    Previous Encounter
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ICD-10 Diagnosis Search */}
                                <div className="space-y-2">
                                    <Label htmlFor="diagnosis">Diagnosis *</Label>
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

                                            {/* ICD-10 Search Results Dropdown */}
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
                                            value={diagnosis}
                                            onChange={(e) => setDiagnosis(e.target.value)}
                                            placeholder="Enter custom diagnosis..."
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

                                {/* Clinical Encounter */}
                                <div className="space-y-2">
                                    <Label htmlFor="clinicalEncounter">Clinical Encounter</Label>
                                    <Textarea
                                        id="clinicalEncounter"
                                        value={clinicalEncounter}
                                        onChange={(e) => setClinicalEncounter(e.target.value)}
                                        placeholder="Enter clinical encounter details..."
                                        rows={4}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Services</CardTitle>
                                <CardDescription>Add services from tariff or manually.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Service Adder */}
                                <div className="bg-gray-50 p-4 rounded-lg space-y-4 border">
                                    <div className="flex gap-4 items-center mb-2">
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

                                    {isAdHoc ? (
                                        <div className="flex gap-2 items-end">
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
                                            <Button onClick={handleAddService} disabled={!newServiceName || !newServicePrice}>
                                                <Plus className="h-4 w-4 mr-2" /> Add
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {/* Medical Services Search */}
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-blue-700 flex items-center gap-2">
                                                    <Stethoscope className="h-3.5 w-3.5" />
                                                    Medical Services
                                                </Label>
                                                {!canSearchTariffServices ? (
                                                    <div className="text-[10px] text-muted-foreground p-2 border rounded bg-gray-100 italic">
                                                        {!enrolleeIdentifier ? "Select enrollee first" : "Select provider first"}
                                                    </div>
                                                ) : (
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
                                                                            className={`px-4 py-3 border-b border-gray-100 last:border-b-0 ${s.selectable === false ? 'bg-gray-50 cursor-not-allowed opacity-70' : 'hover:bg-gray-50 cursor-pointer'}`}
                                                                            onClick={() => handleServiceSelect(s, false)}
                                                                        >
                                                                            <div className="flex justify-between">
                                                                                <span className="font-medium text-gray-900">{s.service_name || s.name}</span>
                                                                                <span className="font-bold text-blue-600">₦{Number(s.price || s.amount || 0).toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-500">{s.category_name || s.service_category}</div>
                                                                            <div className="mt-1 text-[10px] text-gray-600">
                                                                                Limit: {formatLimitAmount(s.category_price_limit)} / {s.category_frequency_limit ?? "N/A"}x | Used: {formatLimitAmount(s.category_used_amount)} / {s.category_used_frequency ?? 0}x | Balance: {formatLimitAmount(s.category_balance_amount)} / {s.category_balance_frequency ?? "N/A"}x
                                                                            </div>
                                                                            {s.selectable === false && (
                                                                                <div className="mt-1 text-[10px] text-red-600 font-medium">
                                                                                    {s.status_message || "Category limit exhausted"}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-4 py-3 text-gray-500 text-sm">No services found.</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Drugs Search */}
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-green-700 flex items-center gap-2">
                                                    <Pill className="h-3.5 w-3.5" />
                                                    Drugs / Pharmaceuticals
                                                </Label>
                                                {!canSearchTariffServices ? (
                                                    <div className="text-[10px] text-muted-foreground p-2 border rounded bg-gray-100 italic">
                                                        {!enrolleeIdentifier ? "Select enrollee first" : "Select provider first"}
                                                    </div>
                                                ) : (
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
                                                                            className={`px-4 py-3 border-b border-gray-100 last:border-b-0 ${s.selectable === false ? 'bg-gray-50 cursor-not-allowed opacity-70' : 'hover:bg-gray-50 cursor-pointer'}`}
                                                                            onClick={() => handleServiceSelect(s, true)}
                                                                        >
                                                                            <div className="flex justify-between">
                                                                                <span className="font-medium text-gray-900">{s.service_name || s.name}</span>
                                                                                <span className="font-bold text-green-600">₦{Number(s.price || s.amount || 0).toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-500">{s.category_name || s.service_category}</div>
                                                                            <div className="mt-1 text-[10px] text-gray-600">
                                                                                Limit: {formatLimitAmount(s.category_price_limit)} / {s.category_frequency_limit ?? "N/A"}x | Used: {formatLimitAmount(s.category_used_amount)} / {s.category_used_frequency ?? 0}x | Balance: {formatLimitAmount(s.category_balance_amount)} / {s.category_balance_frequency ?? "N/A"}x
                                                                            </div>
                                                                            {s.selectable === false && (
                                                                                <div className="mt-1 text-[10px] text-red-600 font-medium">
                                                                                    {s.status_message || "Category limit exhausted"}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-4 py-3 text-gray-500 text-sm">No drugs found.</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quantity and Add Button (Full Width span) */}
                                            <div className="lg:col-span-2 flex gap-4 items-end justify-end mt-2 pt-2 border-t border-gray-100">
                                                {selectedTariffService && (
                                                    <div className="mr-auto text-sm bg-blue-50 px-3 py-1 rounded-full border border-blue-100 text-blue-700 flex items-center gap-2">
                                                        <span className="font-semibold">Selected:</span> {selectedTariffService.name}
                                                    </div>
                                                )}
                                                <div className="w-[100px] space-y-1">
                                                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Qty</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={newServiceQuantity}
                                                        onChange={(e) => setNewServiceQuantity(e.target.value)}
                                                        className="h-9"
                                                    />
                                                </div>
                                                <Button
                                                    onClick={handleAddService}
                                                    disabled={!selectedTariffService}
                                                    className="h-9 bg-[#BE1522] hover:bg-[#9B1219]"
                                                >
                                                    <Plus className="h-4 w-4 mr-2" /> Add Selection
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Services Table */}
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
                                            {services.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                        No services added yet.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {services.map((s, idx) => {
                                                const isDrug = (s as any).is_drug === true
                                                const isAdHoc = s.is_ad_hoc === true

                                                return (
                                                    <TableRow
                                                        key={idx}
                                                        className={
                                                            isAdHoc
                                                                ? "bg-orange-50 border-l-4 border-l-orange-500"
                                                                : isDrug
                                                                    ? "bg-green-50 border-l-4 border-l-green-500"
                                                                    : "bg-blue-50 border-l-4 border-l-blue-500"
                                                        }
                                                    >
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-gray-900">{s.name}</span>
                                                                {isDrug && (
                                                                    <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
                                                                        <Pill className="h-3 w-3" /> PHARMACEUTICAL
                                                                    </span>
                                                                )}
                                                                {!isDrug && !isAdHoc && (
                                                                    <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                                                                        <Stethoscope className="h-3 w-3" /> MEDICAL SERVICE
                                                                    </span>
                                                                )}
                                                                {isAdHoc && (
                                                                    <span className="text-[10px] text-orange-600 font-semibold italic">MANUAL ENTRY</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {isAdHoc ? (
                                                                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-100">Manual</Badge>
                                                            ) : isDrug ? (
                                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-100">Drug</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-100">Tariff</Badge>
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
                                                        <TableCell className="text-right text-gray-500">
                                                            ₦{s.amount.toLocaleString()}
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
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t">
                                    <span className="text-lg font-medium">Total Amount</span>
                                    <span className="text-2xl font-bold text-primary">₦{services.reduce((sum, s) => sum + (s.amount * (s.quantity || 1)), 0).toLocaleString()}</span>
                                </div>
                                <div className="pt-3 border-t">
                                    <Button
                                        className="w-full bg-[#BE1522] hover:bg-[#9B1219] text-lg py-6"
                                        disabled={!providerId || !enrollee || services.length === 0 || submitMutation.isPending}
                                        onClick={() => {
                                            submitMutation.mutate({
                                                provider_id: providerId,
                                                provider_name: providerName,
                                                enrollee_id: enrollee?.enrollee_id || selectedBeneficiaryId || enrollee?.id,
                                                diagnosis,
                                                clinical_encounter: clinicalEncounter,
                                                services,
                                                claim_amount: totalAmount
                                            })
                                        }}
                                    >
                                        {submitMutation.isPending ? "Generating..." : "Generate Code"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border">
                                <div className="flex gap-2">
                                    <AlertCircle className="h-4 w-4 text-blue-500" />
                                    <p>This will create a PENDING Approval Code. Claims vetting can load this code to process payments.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Previous Encounter Modal */}
            {enrollee && (
                <PreviousEncounterModal
                    isOpen={showHistoryModal}
                    onOpenChange={setShowHistoryModal}
                    enrolleeId={enrollee?.enrollee_id || selectedBeneficiaryId || enrollee?.id || ""}
                    enrolleeName={`${enrollee.first_name} ${enrollee.last_name}`}
                />
            )}
        </div>
    )
}
