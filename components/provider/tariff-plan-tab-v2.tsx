"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CategorySidebar } from "@/components/provider/category-sidebar"
import { ServiceListPanel } from "@/components/provider/service-list-panel"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"
import { Plus, Upload, Search, X, XCircle, CheckCircle, Send } from "lucide-react"

interface TariffPlanTabV2Props {
    providerId: string
    mode?: 'provider' | 'provider-management' // provider = agreement flow, provider-management = admin tooling
}

interface PlanCategory {
    id: string
    name: string
}

interface TariffPlanService {
    id: string
    service_id: string
    service_name: string
    category_id: string
    category_name: string
    price: number
    original_price?: number | string | null
    service_type: number
    status: string
    created_at: string
    updated_at: string
}

interface InlineManualServiceRow {
    id: string
    service_name: string
    custom_price: string
}

const INLINE_DRAFT_STORAGE_PREFIX = "provider-inline-manual-draft"

export function TariffPlanTabV2({ providerId, mode = 'provider-management' }: TariffPlanTabV2Props) {
    const { data: session } = useSession()
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState("all")
    const [planCategories, setPlanCategories] = useState<PlanCategory[]>([])
    const [showBulkUpload, setShowBulkUpload] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    const [showUploadTariff, setShowUploadTariff] = useState(false)

    // Determine which buttons to show based on mode
    const showAddService = mode === 'provider' || mode === 'provider-management'
    const showBulkUploadBtn = mode === 'provider-management'
    const showUploadTariffBtn = false
    const showViewUploadedTariffBtn = false
    const showDownloadTariff = mode === 'provider-management'
    const showProviderSubmitActions = mode === 'provider'
    const showHeaderActions = !showProviderSubmitActions

    // Add Service form state
    const [formData, setFormData] = useState({
        service_id: "",
        service_name: "",
        category_id: "",
        price: 0,
        is_primary: false,
        is_secondary: false
    })
    const [serviceSearchTerm, setServiceSearchTerm] = useState("")
    const [showServiceResults, setShowServiceResults] = useState(false)
    const [selectedService, setSelectedService] = useState<any>(null)

    // Upload Tariff state
    const [selectedTariffFile, setSelectedTariffFile] = useState<File | null>(null)
    const [inlineManualRows, setInlineManualRows] = useState<InlineManualServiceRow[]>([])
    const inlineManualRowsRef = useRef<InlineManualServiceRow[]>([])
    const inlineDraftTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
    const inlinePersistInFlightRef = useRef<Record<string, boolean>>({})
    const initialPriceByServiceRef = useRef<Record<string, number>>({})
    const customPriceInputRef = useRef<Record<string, string>>({})
    const customPriceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
    const [customPriceInputState, setCustomPriceInputState] = useState<Record<string, string>>({})

    // Upload Tariff mutation
    const uploadTariffMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('provider_id', providerId)

            const res = await fetch('/api/provider/tariff-plan/bulk-upload', {
                method: 'POST',
                body: formData
            })

            const contentType = res.headers.get('content-type') || ''
            const isJson = contentType.includes('application/json')
            const payload = isJson ? await res.json() : null

            if (!res.ok) {
                throw new Error(payload?.error || payload?.message || `Upload failed (${res.status})`)
            }

            return payload
        },
        onSuccess: (data) => {
            toast({
                title: "Upload successful",
                description: data?.message || "Tariff file uploaded and processed successfully"
            })
            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services"] })
            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all"] })
            queryClient.invalidateQueries({ queryKey: ["provider-tariff-plan", providerId] })
            setShowUploadTariff(false)
            setSelectedTariffFile(null)
            
            // Reset file input to allow re-upload of same file if needed
            const fileInput = document.getElementById('tariff-file-upload') as HTMLInputElement
            if (fileInput) {
                fileInput.value = ''
            }
        },
        onError: (error: Error) => {
            toast({
                title: "Upload failed",
                description: error.message,
                variant: "destructive"
            })
            // Reset file selection on error to allow retry
            setSelectedTariffFile(null)
            const fileInput = document.getElementById('tariff-file-upload') as HTMLInputElement
            if (fileInput) {
                fileInput.value = ''
            }
        }
    })

    const handleTariffFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedTariffFile(file)
        }
    }

    const handleUploadTariff = () => {
        if (selectedTariffFile) {
            uploadTariffMutation.mutate(selectedTariffFile)
        }
    }

    const handleDownloadUploadedTariff = async () => {
        try {
            const res = await fetch(`/api/provider/download-tariff-file/${providerId}`)
            if (!res.ok) {
                let message = "No uploaded tariff file found for this provider."
                try {
                    const payload = await res.json()
                    if (payload?.error) message = payload.error
                } catch {
                    // no-op
                }
                toast({
                    title: "Unable to download uploaded tariff",
                    description: message,
                    variant: "destructive",
                })
                return
            }

            const blob = await res.blob()
            const disposition = res.headers.get("content-disposition") || ""
            const match = disposition.match(/filename=\"?([^\";]+)\"?/i)
            const filename = match?.[1] || `uploaded-tariff-${providerId}.xlsx`

            const url = window.URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = filename
            link.click()
            window.URL.revokeObjectURL(url)
        } catch {
            toast({
                title: "Download failed",
                description: "Failed to download the uploaded tariff file",
                variant: "destructive",
            })
        }
    }

    // Fetch plan categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch('/plan_categories.json')
                const categories = await response.json()
                setPlanCategories(categories)
            } catch (error) {
                console.error("Error fetching categories:", error)
            }
        }
        fetchCategories()
    }, [])

    // Fetch ALL tariff plan services (for category counts)
    const { data: allServicesData, isLoading: isLoadingAll, error: allServicesError } = useQuery({
        queryKey: ["tariff-plan-services-all", providerId],
        queryFn: async () => {
            if (!providerId) throw new Error("Provider ID is required")
            const res = await fetch(`/api/provider/tariff-plan/services?providerId=${providerId}`)
            if (!res.ok) {
                let message = "Failed to fetch services"
                try {
                    const payload = await res.json()
                    if (payload?.error) message = payload.error
                } catch {
                    // no-op
                }
                throw new Error(message)
            }
            return res.json()
        },
        enabled: !!providerId
    })

    // Fetch filtered tariff plan services
    const { data: servicesData, isLoading } = useQuery({
        queryKey: ["tariff-plan-services", providerId, selectedCategory, filterStatus],
        queryFn: async () => {
            if (!providerId) throw new Error("Provider ID is required")

            const params = new URLSearchParams({ providerId })
            if (selectedCategory) params.append("category", selectedCategory)
            if (filterStatus !== "all") params.append("status", filterStatus)

            const res = await fetch(`/api/provider/tariff-plan/services?${params}`)
            if (!res.ok) throw new Error("Failed to fetch services")
            return res.json()
        },
        enabled: !!providerId && !!selectedCategory && selectedCategory !== "all"
    })

    // Search services from service types
    const { data: searchServicesData, isLoading: isLoadingSearchServices } = useQuery({
        queryKey: ["service-types-search", serviceSearchTerm],
        queryFn: async () => {
            if (!serviceSearchTerm || serviceSearchTerm.length < 2) return []
            const res = await fetch(`/api/settings/service-types?search=${encodeURIComponent(serviceSearchTerm)}`)
            if (!res.ok) throw new Error("Failed to search services")
            const data = await res.json()
            return data.serviceTypes || []
        },
        enabled: serviceSearchTerm.length >= 2
    })

    const allServices: TariffPlanService[] = Array.isArray(allServicesData?.services)
        ? allServicesData.services.filter((service: any): service is TariffPlanService => Boolean(service?.id))
        : []
    const services: TariffPlanService[] =
        selectedCategory && selectedCategory !== "all"
            ? (Array.isArray(servicesData?.services)
                ? servicesData.services.filter((service: any): service is TariffPlanService => Boolean(service?.id))
                : [])
            : allServices
    const searchServices = searchServicesData || []

    const { data: tariffPlanData, refetch: refetchTariffPlan } = useQuery({
        queryKey: ["provider-tariff-plan", providerId],
        queryFn: async () => {
            if (!providerId) return null
            const res = await fetch(`/api/provider/tariff-plan?providerId=${providerId}`)
            if (!res.ok) {
                let message = "Failed to fetch tariff plan"
                try {
                    const payload = await res.json()
                    if (payload?.error) message = payload.error
                } catch {
                    // no-op
                }
                throw new Error(message)
            }
            return res.json()
        },
        enabled: !!providerId,
    })

    const { data: tariffFileStatusData } = useQuery({
        queryKey: ["provider-tariff-file-status", providerId],
        queryFn: async () => {
            if (!providerId) return { exists: false }
            const res = await fetch(`/api/provider/tariff-file-status/${providerId}`)
            if (!res.ok) throw new Error("Failed to fetch tariff file status")
            return res.json()
        },
        enabled: !!providerId && showProviderSubmitActions,
    })

    const tariffPlan = tariffPlanData?.tariffPlan
    const inlineDraftStorageKey = `${INLINE_DRAFT_STORAGE_PREFIX}:${providerId}`
    const hasUploadedTariff = showProviderSubmitActions ? (!!tariffFileStatusData?.exists || allServices.length > 0) : true
    const providerServicesForTable = hasUploadedTariff ? allServices : []
    const canSubmitPlan =
        !!providerId &&
        ["DRAFT", "REJECTED", "IN_PROGRESS"].includes((tariffPlan?.status || "DRAFT").toUpperCase()) &&
        providerServicesForTable.some((s) => s.price > 0)

    const resolveOriginalPrice = (service: TariffPlanService) => {
        if (service.original_price !== null && service.original_price !== undefined) {
            const parsed = Number(service.original_price)
            if (!Number.isNaN(parsed)) return parsed
        }
        return service.price
    }

    useEffect(() => {
        inlineManualRowsRef.current = inlineManualRows
    }, [inlineManualRows])

    useEffect(() => {
        if (!showProviderSubmitActions || !providerId) return
        if (typeof window === "undefined") return

        try {
            const raw = window.localStorage.getItem(inlineDraftStorageKey)
            if (!raw) return
            const parsed = JSON.parse(raw)
            if (!Array.isArray(parsed)) return

            const restored = parsed
                .filter((row: any) => typeof row?.id === "string")
                .map((row: any) => ({
                    id: String(row.id),
                    service_name: String(row.service_name || ""),
                    custom_price: String(row.custom_price || ""),
                })) as InlineManualServiceRow[]

            if (restored.length > 0) {
                setInlineManualRows(restored)
            }
        } catch {
            // Ignore malformed local draft payload
        }
    }, [inlineDraftStorageKey, providerId, showProviderSubmitActions])

    useEffect(() => {
        if (!showProviderSubmitActions || !providerId) return
        if (typeof window === "undefined") return

        if (inlineManualRows.length === 0) {
            window.localStorage.removeItem(inlineDraftStorageKey)
            return
        }

        window.localStorage.setItem(inlineDraftStorageKey, JSON.stringify(inlineManualRows))
    }, [inlineManualRows, inlineDraftStorageKey, providerId, showProviderSubmitActions])

    useEffect(() => {
        return () => {
            Object.values(customPriceTimersRef.current).forEach((timer) => clearTimeout(timer))
            Object.values(inlineDraftTimersRef.current).forEach((timer) => clearTimeout(timer))
        }
    }, [])

    useEffect(() => {
        let hasRefMutation = false
        let hasStateMutation = false
        const nextInputState: Record<string, string> = { ...customPriceInputRef.current }

        for (const service of allServices) {
            if (initialPriceByServiceRef.current[service.id] === undefined) {
                initialPriceByServiceRef.current[service.id] = resolveOriginalPrice(service)
                hasRefMutation = true
            }

            const baseline = initialPriceByServiceRef.current[service.id]
            if (service.price !== baseline && !customPriceInputRef.current[service.id]) {
                customPriceInputRef.current[service.id] = String(service.price)
                nextInputState[service.id] = String(service.price)
                hasRefMutation = true
                hasStateMutation = true
            }
        }

        if (hasRefMutation) {
            customPriceInputRef.current = { ...customPriceInputRef.current }
        }

        if (hasStateMutation) {
            setCustomPriceInputState((prev) => {
                const prevKeys = Object.keys(prev)
                const nextKeys = Object.keys(nextInputState)
                if (prevKeys.length !== nextKeys.length) return nextInputState
                for (const key of nextKeys) {
                    if (prev[key] !== nextInputState[key]) return nextInputState
                }
                return prev
            })
        }
    }, [allServices])

    // Calculate service count by category
    const serviceCountByCategory = allServices.reduce((acc, service) => {
        const categoryId = service.category_id || "uncategorized"
        acc[categoryId] = (acc[categoryId] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    // Add service mutation
    const addServiceMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`/api/provider/tariff-plan/services`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, provider_id: providerId })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Failed to add service")
            }
            return res.json()
        },
        onSuccess: async (newService) => {
            // Sync to global service pool
            try {
                await fetch('/api/underwriting/plans/sync-services', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        providerId,
                        services: [newService.service]
                    })
                })
            } catch (error) {
                console.error('Failed to sync service to global pool:', error)
                // Don't block the success flow if sync fails
            }

            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services"] })
            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all"] })
            setShowAddForm(false)
            setFormData({
                service_id: "",
                service_name: "",
                category_id: "",
                price: 0,
                is_primary: false,
                is_secondary: false
            })
            setSelectedService(null)
            setServiceSearchTerm("")
            toast({ title: "Success", description: "Service added successfully" })
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to add service",
                variant: "destructive"
            })
        }
    })

    const submitTariffPlanMutation = useMutation({
        mutationFn: async (isCustomized: boolean) => {
            let tariffPlanId = tariffPlan?.id

            // Some legacy providers can have active tariff services without a draft plan record.
            // In that case, create a new draft version before submit so workflow can continue.
            if (!tariffPlanId) {
                const createRes = await fetch(`/api/provider/tariff-plan`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ provider_id: providerId }),
                })
                const createPayload = await createRes.json().catch(() => ({}))
                if (!createRes.ok) {
                    throw new Error(createPayload?.error || "Failed to initialize tariff plan")
                }
                tariffPlanId = createPayload?.tariffPlan?.id
            }

            if (!tariffPlanId) {
                throw new Error("Tariff plan could not be initialized. Please try again.")
            }

            const res = await fetch(`/api/provider/tariff-plan/${tariffPlanId}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_customized: isCustomized }),
            })
            const payload = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(payload?.error || "Failed to submit tariff plan")
            return payload
        },
        onSuccess: async (_, isCustomized) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["provider-tariff-plan", providerId] }),
                queryClient.invalidateQueries({ queryKey: ["tariff-plan-services", providerId] }),
                queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all", providerId] }),
                queryClient.invalidateQueries({ queryKey: ["pending-tariff-plans"] }),
            ])
            await refetchTariffPlan()
            toast({
                title: "Submitted",
                description: isCustomized
                    ? "Tariff customization submitted to Tariff Negotiation."
                    : "Tariff accepted and sent to MSA Approval.",
            })
        },
        onError: (error: Error) => {
            toast({
                title: "Submission failed",
                description: error.message,
                variant: "destructive",
            })
        },
    })

    const handleAcceptAllTariffs = () => {
        const hasInlineEdits = inlineManualRows.some((r) => r.service_name.trim() || r.custom_price.trim())
        if (hasInlineEdits) {
            toast({
                title: "Use Save & Send Custom Tariff",
                description: "You added manual services. Submit as custom tariff for negotiation review.",
                variant: "destructive",
            })
            return
        }

        if (!canSubmitPlan) {
            toast({
                title: "Unable to submit",
                description: "Add or upload services with valid prices before accepting.",
                variant: "destructive",
            })
            return
        }
        if (!confirm("Confirm acceptance of all CJHMO tariff prices? This will send directly to MSA Approval.")) return
        submitTariffPlanMutation.mutate(false)
    }

    const handleSaveAndSubmit = async () => {
        const inlineRowsSaved = await persistInlineManualRows()
        if (!inlineRowsSaved) return

        if (!canSubmitPlan) {
            toast({
                title: "Unable to submit",
                description: "Add or upload services with valid prices before submitting.",
                variant: "destructive",
            })
            return
        }
        if (!confirm("Submit customized tariff for negotiation review?")) return
        submitTariffPlanMutation.mutate(true)
    }

    // Update service mutation
    const updateServiceMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await fetch(`/api/provider/tariff-plan/services/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            })
            if (!res.ok) throw new Error("Failed to update service")
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services"] })
            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all"] })
            toast({ title: "Success", description: "Service updated successfully" })
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update service",
                variant: "destructive"
            })
        }
    })

    const saveDraftMutation = useMutation({
        mutationFn: async (serviceId: string) => {
            if (!tariffPlan?.id) return

            await fetch(`/api/provider/tariff-plan/${tariffPlan.id}/save-draft`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ services: [serviceId] }),
            })
        },
    })

    const updateCustomPriceMutation = useMutation({
        mutationFn: async ({ serviceId, price }: { serviceId: string; price: number }) => {
            const res = await fetch(`/api/provider/tariff-plan/services/${serviceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ price }),
            })

            if (!res.ok) {
                let errorMessage = "Failed to auto-save custom tariff"
                try {
                    const payload = await res.json()
                    if (payload?.error) errorMessage = payload.error
                } catch {
                    // no-op
                }
                throw new Error(errorMessage)
            }

            await saveDraftMutation.mutateAsync(serviceId)
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services"] })
            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all"] })
            queryClient.invalidateQueries({ queryKey: ["provider-tariff-plan", providerId] })
        },
        onError: (error: Error) => {
            toast({
                title: "Auto-save failed",
                description: error.message,
                variant: "destructive",
            })
        },
    })

    const handleCustomTariffChange = (serviceId: string, rawValue: string) => {
        customPriceInputRef.current[serviceId] = rawValue
        setCustomPriceInputState({ ...customPriceInputRef.current })

        if (customPriceTimersRef.current[serviceId]) {
            clearTimeout(customPriceTimersRef.current[serviceId])
        }

        customPriceTimersRef.current[serviceId] = setTimeout(() => {
            const service = allServices.find((s) => s.id === serviceId)
            if (!service) return

            const baseline = initialPriceByServiceRef.current[serviceId] ?? service.price
            const trimmed = rawValue.trim()
            const numeric = Number(trimmed)

            let targetPrice = baseline
            if (trimmed !== "") {
                if (Number.isNaN(numeric) || numeric <= 0) {
                    return
                }
                targetPrice = numeric
            }

            if (targetPrice === service.price) return

            updateCustomPriceMutation.mutate({
                serviceId,
                price: targetPrice,
            })
        }, 600)
    }

    const handleServiceSearch = (value: string) => {
        setServiceSearchTerm(value)
        setShowServiceResults(value.length >= 2)
    }

    const handleSelectService = (service: any) => {
        setSelectedService(service)
        setServiceSearchTerm(service.service_name)
        setShowServiceResults(false)

        // Find category ID from category name
        const category = planCategories.find(c => c.name === service.service_category)

        setFormData({
            service_id: service.service_id,
            service_name: service.service_name,
            category_id: category?.id || service.service_category,
            price: 0,
            is_primary: false,
            is_secondary: false
        })
    }

    const handleClearService = () => {
        setSelectedService(null)
        setServiceSearchTerm("")
        setFormData({
            service_id: "",
            service_name: "",
            category_id: "",
            price: 0,
            is_primary: false,
            is_secondary: false
        })
    }

    const handleSubmitForm = () => {
        const categoryId = formData.category_id || (selectedCategory && selectedCategory !== "all" ? selectedCategory : "")

        if (!formData.service_name || !categoryId || formData.price <= 0) {
            toast({
                title: "Validation Error",
                description: "Please fill in all required fields (Service Name, Category, and Price greater than 0)",
                variant: "destructive",
            })
            return
        }

        // Generate service_id from service_name if not provided.
        // For provider agreement flow, prefix manual_ so reviewers can identify added services.
        const normalizedServiceId = formData.service_id || formData.service_name.toLowerCase().replace(/\s+/g, '_')
        const service_id = mode === "provider" ? `manual_${normalizedServiceId}` : normalizedServiceId

        // Check for duplicate service
        const serviceExists = allServices.some(s => s.service_id === service_id)
        if (serviceExists) {
            toast({
                title: "Service Already Exists",
                description: `Service "${formData.service_name}" has already been added to the tariff plan`,
                variant: "destructive",
            })
            return
        }

        const submitData = {
            service_id,
            service_name: formData.service_name,
            category_id: categoryId,
            price: formData.price,
            service_type: formData.is_primary ? 1 : null
        }

        addServiceMutation.mutate(submitData)
    }

    const handleBulkUploadSuccess = (data: any[], processedCount?: number) => {
        toast({
            title: "Success",
            description: `Successfully uploaded ${processedCount || data.length} tariff plan services`,
        })
        queryClient.invalidateQueries({ queryKey: ["tariff-plan-services"] })
        queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all"] })
        setShowBulkUpload(false)
    }

    const handleExportTemplate = () => {
        window.location.href = `/api/provider/tariff-plan/export-template?providerId=${providerId}`
    }

    const handleExportCategory = (categoryId: string) => {
        window.location.href = `/api/provider/tariff-plan/export-category?providerId=${providerId}&categoryId=${categoryId}`
    }

    const handleAddService = () => {
        if (showProviderSubmitActions) {
            setInlineManualRows((prev) => [
                ...prev,
                {
                    id: `inline_manual_${Date.now()}_${prev.length}`,
                    service_name: "",
                    custom_price: "",
                },
            ])
            return
        }

        setShowAddForm(true)
    }

    const handleInlineManualRowChange = (
        rowId: string,
        field: "service_name" | "custom_price",
        value: string
    ) => {
        setInlineManualRows((prev) =>
            prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
        )

        if (inlineDraftTimersRef.current[rowId]) {
            clearTimeout(inlineDraftTimersRef.current[rowId])
        }

        inlineDraftTimersRef.current[rowId] = setTimeout(() => {
            autoSaveInlineManualRow(rowId)
        }, 500)
    }

    const autoSaveInlineManualRow = async (rowId: string) => {
        if (inlinePersistInFlightRef.current[rowId]) return

        const row = inlineManualRowsRef.current.find((r) => r.id === rowId)
        if (!row) return

        const serviceName = row.service_name.trim()
        const customPrice = Number(row.custom_price)

        // Keep partial inputs in local draft only; persist server draft once row is valid.
        if (!serviceName || Number.isNaN(customPrice) || customPrice <= 0) {
            return
        }

        const normalizedServiceId = serviceName.toLowerCase().replace(/\s+/g, "_")
        const service_id = `manual_${normalizedServiceId}`

        inlinePersistInFlightRef.current[rowId] = true

        try {
            const existingService = allServices.find((s) => s.service_id === service_id)

            if (existingService) {
                const res = await fetch(`/api/provider/tariff-plan/services/${existingService.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ service_name: serviceName, price: customPrice }),
                })

                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}))
                    throw new Error(payload?.error || "Failed to auto-save draft row")
                }
            } else {
                const res = await fetch(`/api/provider/tariff-plan/services`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        provider_id: providerId,
                        service_id,
                        service_name: serviceName,
                        category_id: "OTH",
                        price: customPrice,
                        service_type: null,
                    }),
                })

                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}))
                    throw new Error(payload?.error || "Failed to auto-save draft row")
                }
            }

            setInlineManualRows((prev) => prev.filter((r) => r.id !== rowId))
            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services", providerId] })
            queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all", providerId] })
            queryClient.invalidateQueries({ queryKey: ["provider-tariff-plan", providerId] })
        } catch (error) {
            toast({
                title: "Draft auto-save failed",
                description: error instanceof Error ? error.message : "Unable to auto-save added row",
                variant: "destructive",
            })
        } finally {
            inlinePersistInFlightRef.current[rowId] = false
        }
    }

    const createManualServiceFromRow = async (row: InlineManualServiceRow) => {
        const serviceName = row.service_name.trim()
        const customPrice = Number(row.custom_price)

        if (!serviceName || Number.isNaN(customPrice) || customPrice <= 0) {
            return false
        }

        const normalizedServiceId = serviceName.toLowerCase().replace(/\s+/g, "_")
        const service_id = `manual_${normalizedServiceId}`

        const serviceExists = allServices.some((s) => s.service_id === service_id)
        if (serviceExists) {
            toast({
                title: "Service Already Exists",
                description: `Service \"${serviceName}\" has already been added to the tariff plan`,
                variant: "destructive",
            })
            return true
        }

        await addServiceMutation.mutateAsync({
            service_id,
            service_name: serviceName,
            category_id: "OTH",
            price: customPrice,
            service_type: null,
        })

        return true
    }

    const persistInlineManualRows = async () => {
        if (inlineManualRows.length === 0) return true

        for (const row of inlineManualRows) {
            const hasAnyValue = row.service_name.trim() || row.custom_price.trim()
            if (!hasAnyValue) continue

            const serviceName = row.service_name.trim()
            const customPrice = Number(row.custom_price)
            if (!serviceName || Number.isNaN(customPrice) || customPrice <= 0) {
                toast({
                    title: "Validation Error",
                    description: "Each added row must include Service Name and Custom Tariff greater than 0.",
                    variant: "destructive",
                })
                return false
            }
        }

        try {
            for (const row of inlineManualRows) {
                const hasAnyValue = row.service_name.trim() || row.custom_price.trim()
                if (!hasAnyValue) continue
                await createManualServiceFromRow(row)
            }

            setInlineManualRows([])
            return true
        } catch (error) {
            toast({
                title: "Unable to save new rows",
                description: error instanceof Error ? error.message : "Failed to save inline services",
                variant: "destructive",
            })
            return false
        }
    }

    const handleDownloadTariff = async () => {
        try {
            const res = await fetch(`/api/provider/tariff-plan/export-all?providerId=${providerId}`)
            if (!res.ok) {
                let message = "No tariff services found for this provider."
                try {
                    const data = await res.json()
                    if (data?.error) message = data.error
                } catch {
                    // no-op
                }
                toast({
                    title: "Unable to download tariff",
                    description: message,
                    variant: "destructive"
                })
                return
            }
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `tariff-${providerId}.xlsx`
            a.click()
            window.URL.revokeObjectURL(url)
            toast({
                title: "Download successful",
                description: "All provider tariff services downloaded and arranged by category."
            })
        } catch (error) {
            toast({
                title: "Download failed",
                description: "Failed to download tariff services",
                variant: "destructive"
            })
        }
    }

    if (!providerId) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-yellow-800 font-semibold">Provider ID Required</p>
                        <p className="text-yellow-600 mt-2">
                            No provider ID was provided. Please select a provider to continue.
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {showProviderSubmitActions ? "Tariff Agreement" : "Tariff Plan Management"}
                    </h2>
                    <p className="text-gray-600">
                        {showProviderSubmitActions
                            ? "Review CJHMO Tariff below. If you disagree with any service, enter your preferred price in the Custom Tariffs column and submit."
                            : "Manage service prices and categories for this provider"}
                    </p>
                    {tariffPlan?.status && (
                        <div className="mt-2">
                            <Badge variant={showProviderSubmitActions ? "default" : "secondary"} className={showProviderSubmitActions ? "bg-yellow-500 text-black" : ""}>
                                {showProviderSubmitActions && ["DRAFT", "IN_PROGRESS"].includes((tariffPlan.status || "").toUpperCase())
                                    ? "PENDING"
                                    : (tariffPlan.status || "").replace(/_/g, " ")}
                                {showProviderSubmitActions ? "" : tariffPlan?.approval_stage ? ` · ${tariffPlan.approval_stage}` : ""}
                            </Badge>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    {showProviderSubmitActions && showHeaderActions && (
                        <>
                            <Button
                                onClick={handleAcceptAllTariffs}
                                variant="outline"
                                disabled={submitTariffPlanMutation.isPending || !canSubmitPlan}
                                title="Accept CJHMO default tariff and send for MSA approval"
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Accept All Tariffs
                            </Button>
                            <Button
                                onClick={handleSaveAndSubmit}
                                className="bg-[#BE1522] hover:bg-[#9B1219]"
                                disabled={submitTariffPlanMutation.isPending || !canSubmitPlan}
                                title="Submit customized tariff for negotiation"
                            >
                                <Send className="h-4 w-4 mr-2" />
                                Save & Send Custom Tariff
                            </Button>
                        </>
                    )}
                    {showAddService && showHeaderActions && (
                        <Button onClick={handleAddService} variant={showProviderSubmitActions ? "outline" : "default"} className={showProviderSubmitActions ? "" : "bg-[#BE1522] hover:bg-[#9B1219]"}>
                            <Plus className="h-4 w-4 mr-2" />
                            {showProviderSubmitActions ? "Add New Service" : "Add Service"}
                        </Button>
                    )}
                    {showBulkUploadBtn && (
                        <Button onClick={() => setShowBulkUpload(true)} variant="outline">
                            <Upload className="h-4 w-4 mr-2" />
                            Bulk Upload
                        </Button>
                    )}
                    {showUploadTariffBtn && (
                        <Button onClick={() => setShowUploadTariff(true)} variant="default" className="bg-[#BE1522] hover:bg-[#9B1219]">
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Tariff
                        </Button>
                    )}
                    {showViewUploadedTariffBtn && (
                        <Button onClick={handleDownloadUploadedTariff} variant="outline">
                            <Upload className="h-4 w-4 mr-2 rotate-180" />
                            View Uploaded Tariff
                        </Button>
                    )}
                    {showDownloadTariff && (
                        <Button onClick={handleDownloadTariff} variant="outline">
                            <Upload className="h-4 w-4 mr-2 rotate-180" />
                            Download Tariff
                        </Button>
                    )}
                </div>
            </div>

            {showProviderSubmitActions && (tariffPlan?.status || "").toUpperCase() === "REJECTED" && tariffPlan?.rejection_reason && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                        <p className="text-sm font-semibold text-red-800">Tariff plan returned for correction</p>
                        <p className="text-sm text-red-700 mt-1">{tariffPlan.rejection_reason}</p>
                    </CardContent>
                </Card>
            )}

            {showProviderSubmitActions ? (
                <div className="space-y-4">
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-[#4A4A4A] text-white">
                                        <th className="text-left px-4 py-3 border border-gray-300">Services</th>
                                        <th className="text-left px-4 py-3 border border-gray-300">Tariffs (₦)</th>
                                        <th className="text-left px-4 py-3 border border-gray-300">Custom Tariffs (₦)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoadingAll ? (
                                        <tr>
                                            <td className="px-4 py-6 border border-gray-200 text-center text-gray-500" colSpan={3}>
                                                Loading tariffs...
                                            </td>
                                        </tr>
                                    ) : allServicesError ? (
                                        <tr>
                                            <td className="px-4 py-6 border border-gray-200 text-center text-red-600" colSpan={3}>
                                                {allServicesError instanceof Error
                                                    ? allServicesError.message
                                                    : "Unable to load tariff services. Please contact Provider Management."}
                                            </td>
                                        </tr>
                                    ) : providerServicesForTable.length === 0 ? (
                                        <tr>
                                            <td className="px-4 py-6 border border-gray-200 text-center text-gray-500" colSpan={3}>
                                                No tariff services available yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {providerServicesForTable.map((service) => {
                                                const baseline = initialPriceByServiceRef.current[service.id] ?? resolveOriginalPrice(service)
                                                const serviceIsManual = (service.service_id || "").toLowerCase().startsWith("manual_")
                                                const customInput = customPriceInputState[service.id] ?? (service.price !== baseline ? String(service.price) : "")

                                                return (
                                                    <tr key={service.id} className={serviceIsManual ? "bg-orange-50" : ""}>
                                                        <td className="px-4 py-3 border border-gray-200">
                                                            <div className="flex items-center gap-2">
                                                                <span>{service.service_name}</span>
                                                                {serviceIsManual && (
                                                                    <Badge className="bg-orange-500 text-white">Manual</Badge>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 border border-gray-200">{serviceIsManual ? "-" : baseline}</td>
                                                        <td className="px-4 py-3 border border-gray-200">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                placeholder="Optional"
                                                                value={customInput}
                                                                onChange={(e) => handleCustomTariffChange(service.id, e.target.value)}
                                                                className="w-[170px]"
                                                            />
                                                        </td>
                                                    </tr>
                                                )
                                            })}

                                            {inlineManualRows.map((row) => (
                                                <tr key={row.id} className="bg-orange-50">
                                                    <td className="px-4 py-3 border border-gray-200">
                                                        <Input
                                                            placeholder="Enter service name"
                                                            value={row.service_name}
                                                            onChange={(e) => handleInlineManualRowChange(row.id, "service_name", e.target.value)}
                                                            className="w-full"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 border border-gray-200 text-gray-500">-</td>
                                                    <td className="px-4 py-3 border border-gray-200">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            placeholder="Enter custom tariff"
                                                            value={row.custom_price}
                                                            onChange={(e) => handleInlineManualRowChange(row.id, "custom_price", e.target.value)}
                                                            className="w-[170px]"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                        onClick={handleAcceptAllTariffs}
                        variant="outline"
                        disabled={submitTariffPlanMutation.isPending || !canSubmitPlan}
                        title="Accept CJHMO default tariff and send for MSA approval"
                    >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept All Tariffs
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSaveAndSubmit}
                            className="bg-[#BE1522] hover:bg-[#9B1219]"
                            disabled={submitTariffPlanMutation.isPending || !canSubmitPlan}
                            title="Submit customized tariff for negotiation"
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Save & Send Custom Tariff
                        </Button>
                        <Button onClick={handleAddService} variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Add New Service
                        </Button>
                    </div>
                </div>
                </div>
            ) : (
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Column: Category Sidebar (30%) */}
                    <div className="col-span-12 lg:col-span-4">
                        <CategorySidebar
                            categories={Array.isArray(planCategories) ? planCategories : []}
                            selectedCategory={selectedCategory}
                            onSelectCategory={setSelectedCategory}
                            onExportCategory={handleExportCategory}
                            serviceCountByCategory={serviceCountByCategory}
                            isLoading={isLoadingAll}
                        />
                    </div>

                    {/* Right Column: Service List Panel (70%) */}
                    <div className="col-span-12 lg:col-span-8">
                        <ServiceListPanel
                            services={Array.isArray(services) ? services : []}
                            selectedCategory={selectedCategory}
                            currentUserRole={session?.user?.role || ""}
                            onUpdatePrice={(serviceId, newPrice) => {
                                updateServiceMutation.mutate({
                                    id: serviceId,
                                    data: { price: newPrice }
                                })
                            }}
                            onUpdateServiceType={(serviceId, serviceType) => {
                                updateServiceMutation.mutate({
                                    id: serviceId,
                                    data: { service_type: serviceType }
                                })
                            }}
                            onToggleStatus={(serviceId) => {
                                const service = services.find(s => s.id === serviceId)
                                if (service) {
                                    const newStatus = service.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                                    updateServiceMutation.mutate({
                                        id: serviceId,
                                        data: { status: newStatus }
                                    })
                                }
                            }}
                            onApproveService={(serviceId) => {
                                updateServiceMutation.mutate({
                                    id: serviceId,
                                    data: { status: "ACTIVE" }
                                })
                                toast({ title: "Service Approved", description: "Service has been activated" })
                            }}
                            onRejectService={(serviceId) => {
                                updateServiceMutation.mutate({
                                    id: serviceId,
                                    data: { status: "INACTIVE" }
                                })
                                toast({ title: "Service Rejected", description: "Service has been deactivated" })
                            }}
                            onApproveAll={(categoryId) => {
                                toast({
                                    title: "Approve All",
                                    description: `Approving all services${categoryId ? " in category" : ""}...`,
                                })
                                // TODO: Implement approve all API
                            }}
                            onRejectAll={(categoryId) => {
                                toast({
                                    title: "Reject All",
                                    description: `Rejecting all services${categoryId ? " in category" : ""}...`,
                                })
                                // TODO: Implement reject all API
                            }}
                            filterStatus={filterStatus}
                            onFilterChange={setFilterStatus}
                            isLoading={isLoading}
                        />
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            <BulkUploadModal
                isOpen={showBulkUpload}
                onClose={() => setShowBulkUpload(false)}
                module="provider"
                submodule="tariff-plan"
                onUploadSuccess={handleBulkUploadSuccess}
                uploadEndpoint="/api/provider/tariff-plan/bulk-upload"
                sampleFileName="tariff-plan-services-sample.xlsx"
                acceptedColumns={["Service Name", "Service Price", "Category ID", "Service Type"]}
                requiredColumns={["Service Name", "Service Price"]}
                providerId={providerId}
            />

            {/* Add Service Modal */}
            {showAddForm && !showProviderSubmitActions && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="text-blue-600">Add Tariff Plan Service</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAddForm(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardTitle>
                            <CardDescription>Add a new service to the tariff plan</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Category Selection */}
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category *</Label>
                                    <Select
                                        value={formData.category_id}
                                        onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {planCategories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.name} (ID: {cat.id})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="service_name">Enter Service Name *</Label>
                                    <div className="relative">
                                        <div className="relative">
                                            <Input
                                                id="service_name"
                                                placeholder="Enter service name..."
                                                value={formData.service_name}
                                                onChange={(e) => setFormData(prev => ({ ...prev, service_name: e.target.value }))}
                                                className="pr-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="price">Price *</Label>
                                    <Input
                                        id="price"
                                        type="number"
                                        value={formData.price}
                                        onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="is_primary"
                                            checked={formData.is_primary}
                                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_primary: checked as boolean }))}
                                        />
                                        <Label htmlFor="is_primary">Primary Service</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="is_secondary"
                                            checked={formData.is_secondary}
                                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_secondary: checked as boolean }))}
                                        />
                                        <Label htmlFor="is_secondary">Secondary Service</Label>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmitForm}
                                    disabled={addServiceMutation.isPending}
                                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                                >
                                    {addServiceMutation.isPending ? "Adding..." : "Add Service"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Upload Tariff Modal */}
            {showUploadTariff && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                Upload Tariff File
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowUploadTariff(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardTitle>
                            <CardDescription>Upload an Excel file with your tariff prices. The system will parse and save the services.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-sm font-medium text-gray-900 mb-2">
                                        Drop your Excel file here or click to browse
                                    </p>
                                    <p className="text-xs text-gray-500 mb-4">
                                        Accepts .xlsx and .xls files
                                    </p>
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleTariffFileSelect}
                                        className="hidden"
                                        id="tariff-file-upload"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => document.getElementById('tariff-file-upload')?.click()}
                                    >
                                        Select File
                                    </Button>
                                </div>

                                {selectedTariffFile && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm font-medium text-blue-900">Selected File:</p>
                                        <p className="text-sm text-blue-700">{selectedTariffFile.name}</p>
                                        <p className="text-xs text-blue-600 mt-1">
                                            {(selectedTariffFile.size / 1024).toFixed(2)} KB
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="outline" onClick={() => setShowUploadTariff(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleUploadTariff}
                                        disabled={!selectedTariffFile || uploadTariffMutation.isPending}
                                        className="bg-[#BE1522] hover:bg-[#9B1219]"
                                    >
                                        {uploadTariffMutation.isPending ? "Uploading..." : "Upload & Parse"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
