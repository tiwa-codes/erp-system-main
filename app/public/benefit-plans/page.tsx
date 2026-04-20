"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {


    Loader2,
    CheckCircle,
    Edit3,
    ArrowRight,
    ChevronDown,
    ChevronRight,
    Info,
    Briefcase,
    Store,
    Users,
    Check,
    Plus,
    X,
    XCircle,
    HelpCircle
} from "lucide-react"

// --- Interfaces ---

interface PackageLimit {
    id: string
    plan_id: string
    category: string
    service_name?: string | null
    amount: number
    default_price?: number | null
    input_type: string
    limit_type: "PRICE" | "FREQUENCY"
    limit_frequency?: string | null
    coverage_status: "COVERED" | "NOT_COVERED"
    is_customizable: boolean
}

interface Plan {
    id: string
    name: string
    classification: "SME" | "RETAIL" | "CORPORATE" | "GENERAL" | "CUSTOM"
    premium_amount: number | null
    benefit_config: PackageLimit[]
}

interface Category {
    id: string
    name: string
}

// --- Main Component ---

export default function PublicBenefitPlansPage() {
    const [activeTab, setActiveTab] = useState("SME")
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

    // Custom Plan State
    const [customMode, setCustomMode] = useState(false)
    const [basePlanId, setBasePlanId] = useState<string>("")
    const [customForm, setCustomForm] = useState({
        organization_name: "",
        plan_name: "",
        premium_amount: "",
        submitter_name: "",
        submitter_email: "",
        submitter_phone: "",
        overrides: {} as Record<string, any>, // key: config_id
        added_services: [] as Array<{
            category: string
            service_name: string
            coverage_status: "COVERED" | "NOT_COVERED"
            limit_type: "PRICE" | "FREQUENCY"
            limit_frequency?: string | null
            amount: number
        }>,
        removed_services: {} as Record<string, boolean>
    })
    const [newServiceDrafts, setNewServiceDrafts] = useState<Record<string, string>>({})
    const [newServiceCoverage, setNewServiceCoverage] = useState<Record<string, "COVERED" | "NOT_COVERED">>({})

    // Load Categories
    const [categories, setCategories] = useState<Category[]>([])
    useEffect(() => {
        fetch('/benefit_package_categories.json')
            .then(res => res.json())
            .then(data => setCategories(data))
            .catch(console.error)
    }, [])

    // Fetch Plans
    const { data: plansData, isLoading } = useQuery({
        queryKey: ["public-plans"],
        queryFn: async () => {
            const res = await fetch("/api/public/benefit-plans")
            if (!res.ok) throw new Error("Failed to fetch plans")
            return res.json()
        }
    })

    const plans = (plansData?.plans || []) as Plan[]

    // Filter Plans by Tab
    const displayPlans = useMemo(() => {
        // Sort logic: Silver < Gold < Diamond < Platinum
        const PLAN_ORDER = ["SILVER", "GOLD", "DIAMOND", "PLATINUM"]
        const getRank = (name: string) => {
            const upper = name.toUpperCase()
            const idx = PLAN_ORDER.findIndex(r => upper.includes(r))
            return idx === -1 ? 99 : idx
        }

        return plans
            .filter(p => p.classification === activeTab)
            .sort((a, b) => getRank(a.name) - getRank(b.name))
    }, [plans, activeTab])

    // Helper to extract data for Matrix
    // We need to efficiently lookup limits for (Plan, Category) and (Plan, Service)
    const getLimit = (plan: Plan, cat: string, svc?: string | null) => {
        return plan.benefit_config.find(c => c.category === cat && (svc ? c.service_name === svc : !c.service_name))
    }

    const getServices = (cat: string) => {
        // Collect all unique services for this category from ALL displayed plans
        // to ensure the matrix rows are consistent even if one plan lacks a service config
        const serviceNames = new Set<string>()
        displayPlans.forEach(p => {
            p.benefit_config
                .filter(c => c.category === cat && !!c.service_name)
                .forEach(c => serviceNames.add(c.service_name!))
        })
        return Array.from(serviceNames).sort()
    }

    const toggleExpand = (catId: string) => {
        const next = new Set(expandedCategories)
        if (next.has(catId)) next.delete(catId)
        else next.add(catId)
        setExpandedCategories(next)
    }

    const handleCustomize = (plan: Plan) => {
        setBasePlanId(plan.id)
        setCustomForm({
            organization_name: "",
            plan_name: `Custom ${plan.name}`,
            premium_amount: plan.premium_amount?.toString() || "",
            submitter_name: "",
            submitter_email: "",
            submitter_phone: "",
            overrides: {},
            added_services: [],
            removed_services: {}
        })
        setCustomMode(true)
        setNewServiceDrafts({})
        setNewServiceCoverage({})
    }

    // --- Render ---

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-20">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/logo.jpg" alt="Logo" className="h-8 w-auto" />
                        <span className="font-bold text-gray-900 text-lg">Aspirage</span>
                    </div>
                    {customMode && (
                        <Button variant="ghost" onClick={() => setCustomMode(false)}>Exit Custom Mode</Button>
                    )}
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-8">
                {!customMode && (
                    <div className="text-center space-y-4">
                        <h1 className="text-4xl font-extrabold text-gray-900">Compare Benefit Plans</h1>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Detailed breakdown of coverage limits and benefits across our {activeTab.toLowerCase()} tiers.
                        </p>
                    </div>
                )}

                {/* Custom Form Header */}
                {customMode && (
                    <Card className="bg-blue-50 border-blue-100 mb-8">
                        <CardContent className="p-6">
                            <h2 className="text-2xl font-bold text-blue-900 mb-4">Request Custom Proposal</h2>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <Label>Organization</Label>
                                    <Input className="bg-white" value={customForm.organization_name} onChange={e => setCustomForm(p => ({ ...p, organization_name: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Contact Name</Label>
                                    <Input className="bg-white" value={customForm.submitter_name} onChange={e => setCustomForm(p => ({ ...p, submitter_name: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Email</Label>
                                    <Input className="bg-white" value={customForm.submitter_email} onChange={e => setCustomForm(p => ({ ...p, submitter_email: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Phone</Label>
                                    <Input className="bg-white" value={customForm.submitter_phone} onChange={e => setCustomForm(p => ({ ...p, submitter_phone: e.target.value }))} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Tabs Control */}
                {!customMode && (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex justify-center">
                        <TabsList className="grid grid-cols-3 w-[400px]">
                            <TabsTrigger value="SME">SME</TabsTrigger>
                            <TabsTrigger value="RETAIL">Retail</TabsTrigger>
                            <TabsTrigger value="CORPORATE">Corporate</TabsTrigger>
                        </TabsList>
                    </Tabs>
                )}

                {/* Comparison Matrix */}
                {displayPlans.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-lg border border-dashed">
                        <p className="text-gray-500">No plans found for this category.</p>
                    </div>
                ) : (
                    <div className="border rounded-xl shadow-lg bg-white overflow-hidden ring-1 ring-gray-100">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                                        <TableHead className="w-[300px] bg-gray-50/80 sticky left-0 z-10 border-r py-6">
                                            <span className="text-lg font-bold text-gray-800">Benefits Category</span>
                                        </TableHead>
                                        {displayPlans.map(plan => (
                                            <TableHead key={plan.id} className="text-center min-w-[200px] py-6 align-top">
                                                {customMode && basePlanId === plan.id ? (
                                                    <div className="space-y-2">
                                                        <Badge className="bg-[#BE1522]">Base Plan</Badge>
                                                        <div className="text-xl font-bold text-gray-900">{plan.name}</div>
                                                    </div>
                                                ) : customMode ? (
                                                    <div className="opacity-40">
                                                        <div className="text-xl font-bold text-gray-500">{plan.name}</div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2 group">
                                                        <div className="text-xl font-bold text-gray-900">{plan.name}</div>
                                                        {plan.premium_amount && (
                                                            <div className="text-sm font-medium text-blue-600">
                                                                ₦{plan.premium_amount.toLocaleString()} <span className="text-gray-400 font-normal">/yr</span>
                                                            </div>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => handleCustomize(plan)}
                                                        >
                                                            Customize
                                                            <ArrowRight className="h-3 w-3 ml-1" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories.map(cat => {
                                        const isExpanded = expandedCategories.has(cat.id)
                                        const baseServices = getServices(cat.name)
                                        const addedServices = customMode
                                            ? customForm.added_services
                                                .filter(svc => svc.category === cat.name)
                                                .map(svc => svc.service_name)
                                            : []
                                        const mergedServices = Array.from(new Set([...baseServices, ...addedServices]))
                                        const services = customMode
                                            ? mergedServices.filter(name => !customForm.removed_services[`${cat.name}::${name}`])
                                            : mergedServices
                                        const hasServices = services.length > 0

                                        return (
                                            <>
                                                {/* Category Row */}
                                                <TableRow key={cat.id} className="hover:bg-gray-50/50 group">
                                                    <TableCell className="font-semibold text-gray-700 bg-white sticky left-0 z-10 border-r align-top">
                                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => hasServices && toggleExpand(cat.id)}>
                                                            {hasServices && (
                                                                isExpanded ? <ChevronDown className="h-4 w-4 text-blue-500" /> : <ChevronRight className="h-4 w-4 text-gray-400" />
                                                            )}
                                                            <span className={!hasServices ? "ml-6" : ""}>{cat.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    {displayPlans.map(plan => {
                                                        const limit = getLimit(plan, cat.name)
                                                        const override = limit ? customForm.overrides[limit.id] : null
                                                        const displayLimit = override ? { ...limit, ...override } : limit
                                                        let content = <span className="text-gray-400 text-sm">-</span>

                                                        if (displayLimit) {
                                                            if (displayLimit.limit_type === "FREQUENCY") {
                                                                content = <span className="font-medium text-gray-900">{displayLimit.limit_frequency || "As needed"}</span>
                                                            } else if (displayLimit.amount > 0) {
                                                                content = <span className="font-medium text-gray-900">₦{displayLimit.amount.toLocaleString()}</span>
                                                            } else {
                                                                content = <span className="text-gray-500 italic">Covered</span>
                                                            }
                                                        }

                                                        if (customMode && basePlanId === plan.id && displayLimit) {
                                                            return (
                                                                <TableCell key={`${plan.id}-${cat.id}`} className="text-center border-l align-top">
                                                                    <div className="space-y-2">
                                                                        <Select
                                                                            value={displayLimit.limit_type}
                                                                            onValueChange={(val) => {
                                                                                setCustomForm(p => ({
                                                                                    ...p,
                                                                                    overrides: {
                                                                                        ...p.overrides,
                                                                                        [displayLimit.id]: {
                                                                                            ...(p.overrides[displayLimit.id] || {}),
                                                                                            limit_type: val,
                                                                                            limit_frequency: val === "FREQUENCY" ? (displayLimit.limit_frequency || "") : null,
                                                                                            amount: val === "PRICE" ? (displayLimit.amount || 0) : 0
                                                                                        }
                                                                                    }
                                                                                }))
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="h-8 w-[150px] mx-auto">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="PRICE">Price</SelectItem>
                                                                                <SelectItem value="FREQUENCY">Frequency</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        {displayLimit.limit_type === "FREQUENCY" ? (
                                                                            <Input
                                                                                value={displayLimit.limit_frequency || ""}
                                                                                onChange={e => {
                                                                                    const value = e.target.value
                                                                                    setCustomForm(p => ({
                                                                                        ...p,
                                                                                        overrides: {
                                                                                            ...p.overrides,
                                                                                            [displayLimit.id]: {
                                                                                                ...(p.overrides[displayLimit.id] || {}),
                                                                                                limit_type: "FREQUENCY",
                                                                                                limit_frequency: value,
                                                                                                amount: 0
                                                                                            }
                                                                                        }
                                                                                    }))
                                                                                }}
                                                                                className="h-8 w-[160px] mx-auto"
                                                                                placeholder="e.g. 1 Session"
                                                                            />
                                                                        ) : (
                                                                            <Input
                                                                                type="number"
                                                                                value={displayLimit.amount ?? 0}
                                                                                onChange={e => {
                                                                                    const value = Number(e.target.value || 0)
                                                                                    setCustomForm(p => ({
                                                                                        ...p,
                                                                                        overrides: {
                                                                                            ...p.overrides,
                                                                                            [displayLimit.id]: {
                                                                                                ...(p.overrides[displayLimit.id] || {}),
                                                                                                limit_type: "PRICE",
                                                                                                amount: value
                                                                                            }
                                                                                        }
                                                                                    }))
                                                                                }}
                                                                                className="h-8 w-[140px] mx-auto"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            )
                                                        }

                                                        return (
                                                            <TableCell key={`${plan.id}-${cat.id}`} className="text-center border-l align-top">
                                                                {content}
                                                            </TableCell>
                                                        )
                                                    })}
                                                </TableRow>

                                                {/* Services Expansion */}
                                                {isExpanded && services.map((svcName, idx) => {
                                                    const addedService = customMode
                                                        ? customForm.added_services.find(svc => svc.category === cat.name && svc.service_name === svcName)
                                                        : null
                                                    const serviceKey = `${cat.name}::${svcName}`

                                                    return (
                                                        <TableRow key={`${cat.id}-svc-${idx}`} className="bg-gray-50/30 text-sm">
                                                            <TableCell className="pl-12 text-gray-600 bg-gray-50/30 sticky left-0 z-0 border-r">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span>{svcName}</span>
                                                                    {customMode && basePlanId && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 text-gray-400 hover:text-red-600"
                                                                            onClick={() => {
                                                                                if (addedService) {
                                                                                    setCustomForm(p => ({
                                                                                        ...p,
                                                                                        added_services: p.added_services.filter(svc => !(svc.category === cat.name && svc.service_name === svcName))
                                                                                    }))
                                                                                    return
                                                                                }
                                                                                setCustomForm(p => ({
                                                                                    ...p,
                                                                                    removed_services: {
                                                                                        ...p.removed_services,
                                                                                        [serviceKey]: true
                                                                                    }
                                                                                }))
                                                                            }}
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            {displayPlans.map(plan => {
                                                                const svcConfig = getLimit(plan, cat.name, svcName)
                                                                const isBasePlanColumn = customMode && basePlanId === plan.id

                                                                if (isBasePlanColumn) {
                                                                    if (svcConfig) {
                                                                        const override = customForm.overrides[svcConfig.id]
                                                                        const currentStatus = override?.coverage_status || svcConfig.coverage_status
                                                                        const isActive = currentStatus === "COVERED"

                                                                        return (
                                                                            <TableCell key={`${plan.id}-${svcName}`} className="text-center border-l">
                                                                                <div
                                                                                    className="cursor-pointer p-1 rounded hover:bg-gray-100 inline-block"
                                                                                    onClick={() => {
                                                                                        const newStatus = isActive ? "NOT_COVERED" : "COVERED"
                                                                                        setCustomForm(p => ({
                                                                                            ...p,
                                                                                            overrides: {
                                                                                                ...p.overrides,
                                                                                                [svcConfig.id]: { coverage_status: newStatus }
                                                                                            }
                                                                                        }))
                                                                                    }}
                                                                                >
                                                                                    {isActive
                                                                                        ? <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                                                                                        : <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                                                                                    }
                                                                                </div>
                                                                            </TableCell>
                                                                        )
                                                                    }

                                                                    if (addedService) {
                                                                        const isActive = addedService.coverage_status === "COVERED"
                                                                        return (
                                                                            <TableCell key={`${plan.id}-${svcName}`} className="text-center border-l">
                                                                                <div
                                                                                    className="cursor-pointer p-1 rounded hover:bg-gray-100 inline-block"
                                                                                    onClick={() => {
                                                                                        const newStatus = isActive ? "NOT_COVERED" : "COVERED"
                                                                                        setCustomForm(p => ({
                                                                                            ...p,
                                                                                            added_services: p.added_services.map(svc => {
                                                                                                if (svc.category === cat.name && svc.service_name === svcName) {
                                                                                                    return { ...svc, coverage_status: newStatus }
                                                                                                }
                                                                                                return svc
                                                                                            })
                                                                                        }))
                                                                                    }}
                                                                                >
                                                                                    {isActive
                                                                                        ? <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                                                                                        : <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                                                                                    }
                                                                                </div>
                                                                            </TableCell>
                                                                        )
                                                                    }
                                                                }

                                                                if (!svcConfig) {
                                                                    return (
                                                                        <TableCell key={`${plan.id}-${svcName}`} className="text-center border-l">
                                                                            <span className="text-gray-300 text-xs">-</span>
                                                                        </TableCell>
                                                                    )
                                                                }

                                                                const isCovered = svcConfig.coverage_status === "COVERED"
                                                                const isExplicitNotCovered = svcConfig.coverage_status === "NOT_COVERED"
                                                                const icon = isCovered
                                                                    ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                                                    : <span className="text-gray-300 text-xs">-</span>

                                                                return (
                                                                    <TableCell key={`${plan.id}-${svcName}`} className="text-center border-l">
                                                                        {isExplicitNotCovered ? <XCircle className="h-4 w-4 text-red-200 mx-auto" /> : icon}
                                                                    </TableCell>
                                                                )
                                                            })}
                                                        </TableRow>
                                                    )
                                                })}
                                                {isExpanded && customMode && basePlanId && (
                                                    <TableRow className="bg-gray-50/30">
                                                        <TableCell colSpan={displayPlans.length + 1} className="border-t">
                                                            <div className="flex flex-wrap items-center gap-2 py-2">
                                                                <Input
                                                                    value={newServiceDrafts[cat.id] || ""}
                                                                    onChange={e => setNewServiceDrafts(p => ({ ...p, [cat.id]: e.target.value }))}
                                                                    className="h-8 w-[240px]"
                                                                    placeholder="Add service name"
                                                                />
                                                                <Select
                                                                    value={newServiceCoverage[cat.id] || "COVERED"}
                                                                    onValueChange={(val) => setNewServiceCoverage(p => ({ ...p, [cat.id]: val as any }))}
                                                                >
                                                                    <SelectTrigger className="h-8 w-[150px]">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="COVERED">Covered</SelectItem>
                                                                        <SelectItem value="NOT_COVERED">Not Covered</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        const draft = (newServiceDrafts[cat.id] || "").trim()
                                                                        if (!draft) return
                                                                        if (services.includes(draft)) return
                                                                        const coverage = newServiceCoverage[cat.id] || "COVERED"
                                                                        setCustomForm(p => ({
                                                                            ...p,
                                                                            added_services: [
                                                                                ...p.added_services,
                                                                                {
                                                                                    category: cat.name,
                                                                                    service_name: draft,
                                                                                    coverage_status: coverage,
                                                                                    limit_type: "PRICE",
                                                                                    limit_frequency: null,
                                                                                    amount: 0
                                                                                }
                                                                            ]
                                                                        }))
                                                                        setNewServiceDrafts(p => ({ ...p, [cat.id]: "" }))
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3 mr-1" />
                                                                    Add Service
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                {/* Submit Actions */}
                {customMode && (
                    <div className="flex justify-end gap-4 mt-8 sticky bottom-8 z-20">
                        <Button variant="outline" size="lg" className="shadow-lg bg-white" onClick={() => setCustomMode(false)}>
                            Cancel Customization
                        </Button>
                        <SubmitButton
                            form={customForm}
                            basePlanId={basePlanId}
                            basePlanConfigs={displayPlans.find(p => p.id === basePlanId)?.benefit_config || []}
                            onSuccess={() => setCustomMode(false)}
                        />
                    </div>
                )}

            </div>
        </div>
    )
}

function SubmitButton({ form, basePlanId, basePlanConfigs, onSuccess }: any) {
    const mutation = useMutation({
        mutationFn: async () => {
            // Merge logic
            const removed = form.removed_services || {}
            const filteredConfigs = basePlanConfigs.filter((c: any) => {
                if (!c.service_name) return true
                const key = `${c.category}::${c.service_name}`
                return !removed[key]
            })

            const finalConfigs = filteredConfigs.map((c: any) => {
                const override = form.overrides[c.id]
                if (override) return { ...c, ...override }
                return c
            })

            const addedConfigs = (form.added_services || []).map((svc: any) => ({
                category: svc.category,
                service_name: svc.service_name,
                amount: svc.amount ?? 0,
                default_price: null,
                input_type: "NUMBER",
                is_customizable: true,
                limit_type: svc.limit_type,
                limit_frequency: svc.limit_frequency,
                coverage_status: svc.coverage_status
            }))

            const mergedConfigs = [...finalConfigs, ...addedConfigs]

            const payload = {
                organization_name: form.organization_name,
                plan_name: form.plan_name,
                submitter_name: form.submitter_name,
                submitter_email: form.submitter_email,
                submitter_phone: form.submitter_phone,
                base_plan_id: basePlanId,
                premium_amount: parseFloat(form.premium_amount) || 0,
                benefit_config: mergedConfigs.map((c: any) => ({
                    category: c.category,
                    service_name: c.service_name,
                    amount: c.amount,
                    default_price: c.default_price,
                    input_type: c.input_type,
                    is_customizable: c.is_customizable,
                    limit_type: c.limit_type,
                    limit_frequency: c.limit_frequency,
                    coverage_status: c.coverage_status
                }))
            }

            const res = await fetch("/api/public/custom-plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            if (!res.ok) throw new Error((await res.json()).error)
            return res.json()
        },
        onSuccess: () => {
            toast.success("Proposal Submitted Successfully")
            onSuccess()
        },
        onError: (e: any) => toast.error(e.message)
    })

    return (
        <Button
            size="lg"
            className="bg-[#BE1522] hover:bg-[#9B1219] shadow-xl"
            disabled={mutation.isPending || !form.organization_name || !form.submitter_name}
            onClick={() => mutation.mutate()}
        >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Proposal
        </Button>
    )
}


