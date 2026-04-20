"use client"

export const dynamic = 'force-dynamic'

import { useRef, useState, useEffect, useMemo } from "react"
import { QRCodeCanvas } from "qrcode.react"
import html2canvas from "html2canvas"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Search,
  Save,
  QrCode,
  Share2,
  Copy,
  Download,
  X,
  ExternalLink,
  Briefcase,
  Users,
  Store,
  Eye
} from "lucide-react"
import { cn } from "@/lib/utils"



// --- Interfaces ---

interface Plan {
  id: string
  name: string
  classification: "SME" | "RETAIL" | "CORPORATE" | "GENERAL" | "CUSTOM"
}

interface PackageLimit {
  id: string
  plan_id: string
  category: string
  service_name?: string | null
  amount: number
  default_price?: number | null
  input_type: "NUMBER" | "DROPDOWN" | "ALPHANUMERIC"
  limit_type: "PRICE" | "FREQUENCY"
  limit_frequency?: string | null
  coverage_status: "COVERED" | "NOT_COVERED"
  is_customizable: boolean
  status: "ACTIVE" | "INACTIVE"
}

interface Category {
  id: string
  name: string
}

// --- Main Page Component ---

export default function BenefitPackagePage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [planSearch, setPlanSearch] = useState("")

  // Load Categories
  useEffect(() => {
    fetch('/benefit_package_categories.json')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => {
        console.error('Error loading categories:', err)
        // Fallback or retry logic could go here
      })
  }, [])

  // Queries
  const { data: plansData, isLoading: isLoadingPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/plans")
      if (!res.ok) throw new Error("Failed to fetch plans")
      return res.json()
    }
  })

  // Group plans by classification
  const groupedPlans = useMemo(() => {
    const plans = (plansData?.plans || []) as Plan[]
    const filtered = plans.filter(p => p.name.toLowerCase().includes(planSearch.toLowerCase()))

    return {
      SME: filtered.filter(p => p.classification === "SME"),
      RETAIL: filtered.filter(p => p.classification === "RETAIL"),
      CORPORATE: filtered.filter(p => p.classification === "CORPORATE"),
      OTHER: filtered.filter(p => !["SME", "RETAIL", "CORPORATE"].includes(p.classification))
    }
  }, [plansData, planSearch])

  // --- Render Methods ---

  if (selectedPlan) {
    return (
      <PlanConfigView
        plan={selectedPlan}
        categories={categories}
        onBack={() => setSelectedPlan(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Benefit Package</h1>
          <p className="text-gray-500 mt-1">Manage benefit limits, categories, and service coverage.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateModal(true)} className="bg-[#0891B2] hover:bg-[#9B1219]">
            <Plus className="h-4 w-4 mr-2" />
            Create Package
          </Button>
          <Button variant="outline" onClick={() => window.open('/public/benefit-plans', '_blank')}>
            <Eye className="h-4 w-4 mr-2" />
            Public Page
          </Button>
          <Button variant="outline" onClick={() => setShowShareModal(true)}>
            <QrCode className="h-4 w-4 mr-2" />
            Share / QR
          </Button>
        </div>
      </div>

      {/* Plan Selection View */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search plans..."
          className="pl-10 max-w-md"
          value={planSearch}
          onChange={e => setPlanSearch(e.target.value)}
        />
      </div>

      {isLoadingPlans ? (
        <div className="text-center py-12 text-gray-500">Loading plans...</div>
      ) : (
        <div className="space-y-8">
          <PlanGroup title="SME Plans" plans={groupedPlans.SME} icon={<Briefcase className="h-5 w-5 text-blue-600" />} onSelect={setSelectedPlan} />
          <PlanGroup title="Retail Plans" plans={groupedPlans.RETAIL} icon={<Store className="h-5 w-5 text-green-600" />} onSelect={setSelectedPlan} />
          <PlanGroup title="Corporate Plans" plans={groupedPlans.CORPORATE} icon={<Users className="h-5 w-5 text-purple-600" />} onSelect={setSelectedPlan} />
          {groupedPlans.OTHER.length > 0 && (
            <PlanGroup title="Other Plans" plans={groupedPlans.OTHER} icon={<Briefcase className="h-5 w-5 text-gray-600" />} onSelect={setSelectedPlan} />
          )}
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}
      
      {/* Create Modal */}
      {showCreateModal && (
        <CreateBenefitPackageModal
          categories={categories}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ["plans"] })
            toast({ title: "Success", description: "Benefit package created successfully." })
          }}
        />
      )}
    </div>
  )
}

function PlanGroup({ title, plans, icon, onSelect }: { title: string, plans: Plan[], icon: React.ReactNode, onSelect: (p: Plan) => void }) {
  if (plans.length === 0) return null
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        {icon}
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{plans.length}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(plan => (
          <Card key={plan.id} className="hover:shadow-md transition-shadow cursor-pointer border-gray-200" onClick={() => onSelect(plan)}>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-1 capitalize">{plan.classification.toLowerCase()}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// --- Configuration View ---

function PlanConfigView({ plan, categories, onBack }: { plan: Plan, categories: Category[], onBack: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Determine which categories are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = (catId: string) => {
    setExpanded(prev => ({ ...prev, [catId]: !prev[catId] }))
  }

  // Fetch Limits
  const { data: limitsData, isLoading } = useQuery({
    queryKey: ["package-limits", plan.id],
    queryFn: async () => {
      const res = await fetch(`/api/settings/package-limits?plan_id=${plan.id}&limit=1000`)
      if (!res.ok) throw new Error("Failed to fetch limits")
      return res.json()
    }
  })

  const limits = (limitsData?.packageLimits || []) as PackageLimit[]

  // Helper to get limit for category (service_name is null/empty)
  const getCategoryLimit = (catName: string) => {
    return limits.find(l => l.category === catName && !l.service_name)
  }

  // Helper to get services for category
  const getCategoryServices = (catName: string) => {
    return limits.filter(l => l.category === catName && !!l.service_name)
  }

  // Mutations
  const saveLimitMutation = useMutation({
    mutationFn: async (data: any) => {
      const isUpdate = !!data.id
      const url = isUpdate ? `/api/settings/package-limits?id=${data.id}` : '/api/settings/package-limits'
      const method = isUpdate ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["package-limits", plan.id] })
      toast({ title: "Saved", description: "Changes saved successfully." })
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message })
    }
  })

  const deleteLimitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/package-limits/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error("Failed to delete")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["package-limits", plan.id] })
      toast({ title: "Deleted", description: "Service limit removed." })
    }
  })

  // Handler for saving Category Limit (Upsert)
  const handleSaveCategoryLimit = (catName: string, values: Partial<PackageLimit>) => {
    const existing = getCategoryLimit(catName)
    saveLimitMutation.mutate({
      id: existing?.id,
      plan_id: plan.id,
      category: catName,
      service_name: null,
      ...values,
      amount: parseFloat(values.amount?.toString() || "0"),
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
          <p className="text-gray-500 text-sm">Configure categories and services</p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {plan.classification}
          </Badge>
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const isExpanded = expanded[cat.id]
          const catLimit = getCategoryLimit(cat.name)
          const services = getCategoryServices(cat.name)

          return (
            <Card key={cat.id} className={cn("transition-all duration-200 border-l-4", catLimit ? "border-l-green-500" : "border-l-gray-300")}>
              <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(cat.id)}>
                <div onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id); }}>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                  <div className="text-sm text-gray-500 flex gap-4 mt-1">
                    <span>
                      {catLimit?.limit_type === "FREQUENCY" ? (
                        <>Limit: {catLimit.limit_frequency || "Unspecified"}</>
                      ) : (
                        <>Limit: ₦{catLimit?.amount?.toLocaleString() || "0"}</>
                      )}
                    </span>
                    <span>Services: {services.length}</span>
                  </div>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {/* Quick Edit Category Limit Inline could go here, but putting inside expansion for cleaner UI */}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t bg-gray-50/50 p-6 space-y-6">
                  {/* Category Level Configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-md border shadow-sm">
                    <div className="space-y-2">
                      <Label>Limit Type</Label>
                      <Select
                        defaultValue={catLimit?.limit_type || "PRICE"}
                        onValueChange={(val) => handleSaveCategoryLimit(cat.name, {
                          limit_type: val as any,
                          amount: catLimit?.amount || 0,
                          limit_frequency: catLimit?.limit_frequency
                        })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRICE">Price Limit (₦)</SelectItem>
                          <SelectItem value="FREQUENCY">Frequency / Rate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(!catLimit || catLimit.limit_type === "PRICE") ? (
                      <div className="space-y-2">
                        <Label>Amount (₦)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            defaultValue={catLimit?.amount || ""}
                            placeholder="0.00"
                            onBlur={(e) => handleSaveCategoryLimit(cat.name, {
                              amount: parseFloat(e.target.value),
                              limit_type: "PRICE"
                            })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Input
                          defaultValue={catLimit?.limit_frequency || ""}
                          placeholder="e.g. 1 Session / Year"
                          onBlur={(e) => handleSaveCategoryLimit(cat.name, {
                            limit_frequency: e.target.value,
                            limit_type: "FREQUENCY",
                            amount: 0
                          })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Services List */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-700">Services</h4>
                      <Button size="sm" variant="outline" onClick={() => {
                        // Quick add placeholder
                        saveLimitMutation.mutate({
                          plan_id: plan.id,
                          category: cat.name,
                          service_name: "New Service",
                          amount: 0,
                          limit_type: "PRICE",
                          limit_frequency: null,
                          coverage_status: "COVERED"
                        })
                      }}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
                      </Button>
                    </div>

                    {services.length === 0 ? (
                      <p className="text-sm text-gray-400 italic py-2">No specific services configured.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Service Name</TableHead>
                            <TableHead>Coverage</TableHead>
                            <TableHead>Limit Type</TableHead>
                            <TableHead>Limit Value</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services.map(svc => (
                            <ServiceRow
                              key={svc.id}
                              service={svc}
                              onSave={(updates) => saveLimitMutation.mutate({
                                ...svc,
                                ...updates,
                                plan_id: plan.id,
                                category: cat.name
                              })}
                              onDelete={() => deleteLimitMutation.mutate(svc.id)}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function ServiceRow({ service, onSave, onDelete }: { service: PackageLimit, onSave: (u: any) => void, onDelete: () => void }) {
  const [name, setName] = useState(service.service_name || "")
  const [amount, setAmount] = useState(service.amount.toString())
  const [limitType, setLimitType] = useState<PackageLimit["limit_type"]>(service.limit_type || "PRICE")
  const [frequency, setFrequency] = useState(service.limit_frequency || "")

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => { if (name !== service.service_name) onSave({ service_name: name }) }}
          className="h-8 w-[200px]"
        />
      </TableCell>
      <TableCell>
        <Select
          defaultValue={service.coverage_status}
          onValueChange={(val) => onSave({ coverage_status: val })}
        >
          <SelectTrigger className={cn("h-8 w-[140px]", service.coverage_status === "COVERED" ? "text-green-600" : "text-red-600")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COVERED">Covered</SelectItem>
            <SelectItem value="NOT_COVERED">Not Covered</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={limitType}
          onValueChange={(val) => {
            const next = val as PackageLimit["limit_type"]
            setLimitType(next)
            if (next === "PRICE") {
              onSave({ limit_type: next, limit_frequency: null, amount: Number(amount || 0) })
            } else {
              onSave({ limit_type: next, limit_frequency: frequency, amount: 0 })
            }
          }}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PRICE">Price</SelectItem>
            <SelectItem value="FREQUENCY">Frequency</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {limitType === "FREQUENCY" ? (
          <Input
            value={frequency}
            onChange={e => setFrequency(e.target.value)}
            onBlur={() => onSave({ limit_type: "FREQUENCY", limit_frequency: frequency, amount: 0 })}
            className="h-8 w-[160px]"
            placeholder="e.g. 1 Session"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">ƒ,İ</span>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onBlur={() => { if (parseFloat(amount) !== service.amount) onSave({ limit_type: "PRICE", amount: parseFloat(amount || "0") }) }}
              className="h-8 w-[120px]"
              placeholder="Optional"
            />
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function CreateBenefitPackageModal({ categories, onClose, onSuccess }: { categories: Category[], onClose: () => void, onSuccess: () => void }) {
  const { toast } = useToast()
  const [selectedPlan, setSelectedPlan] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [serviceName, setServiceName] = useState<string>("")
  const [limitType, setLimitType] = useState<"PRICE" | "FREQUENCY">("PRICE")
  const [amount, setAmount] = useState<string>("")
  const [frequency, setFrequency] = useState<string>("")
  const [coverageStatus, setCoverageStatus] = useState<"COVERED" | "NOT_COVERED">("COVERED")
  const [isLoading, setIsLoading] = useState(false)

  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/plans")
      if (!res.ok) throw new Error("Failed to fetch plans")
      return res.json()
    }
  })

  const plans = (plansData?.plans || []) as Plan[]

  const handleCreate = async () => {
    if (!selectedPlan) {
      toast({ variant: "destructive", title: "Error", description: "Please select a plan" })
      return
    }
    if (!selectedCategory) {
      toast({ variant: "destructive", title: "Error", description: "Please select a category" })
      return
    }
    if (limitType === "PRICE" && !amount) {
      toast({ variant: "destructive", title: "Error", description: "Please enter an amount" })
      return
    }
    if (limitType === "FREQUENCY" && !frequency) {
      toast({ variant: "destructive", title: "Error", description: "Please enter frequency" })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/settings/package-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: selectedPlan,
          category: selectedCategory,
          service_name: serviceName || null,
          amount: limitType === "PRICE" ? parseFloat(amount) : 0,
          limit_type: limitType,
          limit_frequency: limitType === "FREQUENCY" ? frequency : null,
          coverage_status: coverageStatus,
          is_customizable: true,
          status: "ACTIVE"
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create benefit package")
      }

      onSuccess()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-lg">Create Benefit Package</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Plan Selection */}
          <div className="space-y-2">
            <Label>Plan *</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Name */}
          <div className="space-y-2">
            <Label>Service Name (Optional)</Label>
            <Input
              placeholder="e.g., General Consultation"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Coverage Status */}
          <div className="space-y-2">
            <Label>Coverage Status</Label>
            <Select value={coverageStatus} onValueChange={(v) => setCoverageStatus(v as any)} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COVERED">Covered</SelectItem>
                <SelectItem value="NOT_COVERED">Not Covered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Limit Type */}
          <div className="space-y-2">
            <Label>Limit Type</Label>
            <Select value={limitType} onValueChange={(v) => setLimitType(v as any)} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRICE">Price Limit (₦)</SelectItem>
                <SelectItem value="FREQUENCY">Frequency / Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount or Frequency */}
          {limitType === "PRICE" ? (
            <div className="space-y-2">
              <Label>Amount (₦) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isLoading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Frequency *</Label>
              <Input
                placeholder="e.g., 1 Session / Year"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading} className="flex-1 bg-[#0891B2] hover:bg-[#9B1219]">
              {isLoading ? "Creating..." : "Create Package"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ShareModal({ onClose }: { onClose: () => void }) {
  const qrRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const handleDownload = async () => {
    if (!qrRef.current) return
    try {
      const canvas = await html2canvas(qrRef.current)
      const url = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = url
      link.download = "benefit-plans-qr.png"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast({ title: "Downloaded", description: "QR Code saved to device." })
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to download QR." })
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/public/benefit-plans`)
    toast({ title: "Copied", description: "Link copied to clipboard." })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-lg">Share Public Link</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex justify-center bg-white p-4 items-center bg-gray-50 rounded-lg" ref={qrRef}>
            <QRCodeCanvas
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/public/benefit-plans`}
              size={200}
              level="H"
              includeMargin
            />
          </div>
          <p className="text-center text-sm text-gray-500">
            Anyone with this link/code can view the public benefit plans.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" /> Copy Link
            </Button>
            <Button onClick={handleDownload} className="bg-[#0891B2] hover:bg-[#9B1219]">
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

