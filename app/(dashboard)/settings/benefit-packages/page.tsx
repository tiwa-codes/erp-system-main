"use client"

export const dynamic = 'force-dynamic'

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Search, Plus, Trash2, ChevronRight, Briefcase, Store, Users, Edit, X } from "lucide-react"
import { cn } from "@/lib/utils"



interface BenefitService {
  id: string
  name: string
  limit_type: "PRICE" | "FREQUENCY"
  limit_value?: number
  limit_frequency?: string
  coverage_status: "COVERED" | "NOT_COVERED"
}

interface BenefitCategory {
  id: string
  name: string
  description?: string
  price_limit?: number | string | null
  services: BenefitService[]
}

interface BenefitPackage {
  id: string
  name: string
  classification: "SME" | "RETAIL" | "CORPORATE"
  description?: string
  price?: number
  categories: BenefitCategory[]
}

const formatNairaValue = (value?: number | string | null) => {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return "₦0"
  return `₦${parsed.toLocaleString()}`
}

export default function BenefitPackagesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<BenefitPackage | null>(null)

  const { data: packagesData } = useQuery({
    queryKey: ["benefit-packages"],
    queryFn: async () => {
      const res = await fetch("/api/settings/benefit-packages")
      if (!res.ok) throw new Error("Failed to fetch packages")
      return res.json()
    }
  })

  const packages = (packagesData?.packages || []) as BenefitPackage[]

  const grouped = useMemo(() => {
    const filtered = packages.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    return {
      SME: filtered.filter(p => p.classification === "SME"),
      RETAIL: filtered.filter(p => p.classification === "RETAIL"),
      CORPORATE: filtered.filter(p => p.classification === "CORPORATE")
    }
  }, [packages, search])

  if (selectedPackage) {
    return (
      <PackageDetailView
        package={selectedPackage}
        onBack={() => setSelectedPackage(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Benefit Packages</h1>
          <p className="text-gray-500 mt-1">Create and manage benefit packages with hierarchical categories and services.</p>
        </div>
        <CreatePackageModal
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["benefit-packages"] })
            toast({ title: "Success", description: "Benefit package created successfully" })
          }}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search packages..."
          className="pl-10 max-w-md"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Package Groups */}
      <div className="space-y-8">
        <PackageGroup
          title="SME Plans"
          packages={grouped.SME}
          icon={<Briefcase className="h-5 w-5 text-blue-600" />}
          onSelect={setSelectedPackage}
        />
        <PackageGroup
          title="Retail Plans"
          packages={grouped.RETAIL}
          icon={<Store className="h-5 w-5 text-green-600" />}
          onSelect={setSelectedPackage}
        />
        <PackageGroup
          title="Corporate Plans"
          packages={grouped.CORPORATE}
          icon={<Users className="h-5 w-5 text-purple-600" />}
          onSelect={setSelectedPackage}
        />
      </div>
    </div>
  )
}

function PackageGroup({
  title,
  packages,
  icon,
  onSelect
}: {
  title: string
  packages: BenefitPackage[]
  icon: React.ReactNode
  onSelect: (p: BenefitPackage) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/benefit-packages/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete package")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benefit-packages"] })
      toast({ title: "Success", description: "Package deleted successfully" })
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message })
    }
  })

  if (packages.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        {icon}
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{packages.length}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map(pkg => (
          <Card
            key={pkg.id}
            className="hover:shadow-md transition-shadow cursor-pointer border-gray-200"
            onClick={() => onSelect(pkg)}
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{pkg.categories.length} categories</p>
                {pkg.price && (
                  <p className="text-xs text-gray-600 mt-1">Price: ₦{pkg.price.toLocaleString()}</p>
                )}
                {pkg.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-1">{pkg.description}</p>
                )}
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <EditPackageModal
                  package={pkg}
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["benefit-packages"] })
                    toast({ title: "Success", description: "Package updated successfully" })
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500"
                  onClick={() => deleteMutation.mutate(pkg.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function CreatePackageModal({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    classification: "SME",
    description: "",
    price: ""
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Package name is required" })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/settings/benefit-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          classification: formData.classification,
          description: formData.description,
          price: formData.price ? parseFloat(formData.price) : null
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create package")
      }

      onSuccess()
      setFormData({ name: "", classification: "SME", description: "", price: "" })
      setOpen(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#BE1522] hover:bg-[#9B1219]">
          <Plus className="h-4 w-4 mr-2" />
          Create Package
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Benefit Package</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Package Name *</Label>
            <Input
              placeholder="e.g., Gold"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Classification *</Label>
            <Select value={formData.classification} onValueChange={(v) => setFormData({...formData, classification: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SME">SME</SelectItem>
                <SelectItem value="RETAIL">Retail</SelectItem>
                <SelectItem value="CORPORATE">Corporate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Price (₦)</Label>
            <Input
              type="number"
              placeholder="Optional - package price"
              value={formData.price}
              onChange={e => setFormData({...formData, price: e.target.value})}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Input
              placeholder="Describe this package..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              disabled={isLoading}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create Package"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditPackageModal({ package: pkg, onSuccess }: { package: BenefitPackage; onSuccess: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: pkg.name,
    price: pkg.price?.toString() || ""
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleUpdate = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Package name is required" })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/settings/benefit-packages/${pkg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          price: formData.price ? parseFloat(formData.price) : null
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update package")
      }

      onSuccess()
      setOpen(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Package</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Package Name *</Label>
            <Input
              placeholder="e.g., Gold"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Price (₦)</Label>
            <Input
              type="number"
              placeholder="Optional - package price"
              value={formData.price}
              onChange={e => setFormData({...formData, price: e.target.value})}
              disabled={isLoading}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleUpdate}
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : "Update Package"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PackageDetailView({ package: pkg, onBack }: { package: BenefitPackage; onBack: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: detailData, isLoading, refetch } = useQuery({
    queryKey: ["benefit-package", pkg.id],
    queryFn: async () => {
      const res = await fetch(`/api/settings/benefit-packages/${pkg.id}`)
      if (!res.ok) throw new Error("Failed to fetch package")
      return res.json()
    }
  })

  const pkgDetail = (detailData?.package || pkg) as BenefitPackage

  const toggleExpand = (catId: string) => {
    const next = new Set(expanded)
    if (next.has(catId)) next.delete(catId)
    else next.add(catId)
    setExpanded(next)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          ←
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pkgDetail.name}</h1>
          <p className="text-gray-500 text-sm">Configure categories and services for this package</p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {pkgDetail.classification}
          </Badge>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Categories</h2>
          <CreateCategoryModal
            packageId={pkgDetail.id}
            onSuccess={() => {
              refetch()
              toast({ title: "Success", description: "Category created successfully" })
            }}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading categories...</div>
        ) : pkgDetail.categories.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p- text-center text-gray-500">
              No categories yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pkgDetail.categories.map(cat => (
              <CategoryCard
                key={cat.id}
                category={cat}
                packageId={pkgDetail.id}
                isExpanded={expanded.has(cat.id)}
                onToggle={() => toggleExpand(cat.id)}
                onRefresh={() => refetch()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryCard({
  category,
  packageId,
  isExpanded,
  onToggle,
  onRefresh
}: {
  category: BenefitCategory
  packageId: string
  isExpanded: boolean
  onToggle: () => void
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const res = await fetch(`/api/settings/benefit-packages/${packageId}/categories/${categoryId}`, {
        method: "DELETE"
      })
      if (!res.ok) throw new Error("Failed to delete category")
      return res.json()
    },
    onSuccess: () => {
      onRefresh()
      toast({ title: "Success", description: "Category deleted successfully" })
    }
  })

  return (
    <Card className="border-l-4 border-l-gray-300 hover:border-l-blue-500 transition-colors">
      <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <span>{isExpanded ? "▼" : "▶"}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">{category.name}</h3>
          <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-3">
            <span>{category.services.length} services</span>
            <span>Category Limit: {category.price_limit != null ? formatNairaValue(category.price_limit) : "Unlimited"}</span>
          </div>
        </div>
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <EditCategoryModal
            packageId={packageId}
            category={category}
            onSuccess={onRefresh}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500"
            onClick={() => deleteCategoryMutation.mutate(category.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t bg-gray-50/50 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-gray-700">Services</h4>
            <CreateServiceModal
              packageId={packageId}
              categoryId={category.id}
              onSuccess={onRefresh}
            />
          </div>

          {category.services.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No services yet. Add one to get started.</p>
          ) : (
            <div className="space-y-2">
              {category.services.map(service => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  packageId={packageId}
                  categoryId={category.id}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function ServiceRow({
  service,
  packageId,
  categoryId,
  onRefresh
}: {
  service: BenefitService
  packageId: string
  categoryId: string
  onRefresh: () => void
}) {
  const { toast } = useToast()

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const res = await fetch(
        `/api/settings/benefit-packages/${packageId}/categories/${categoryId}/services/${serviceId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete service")
      return res.json()
    },
    onSuccess: () => {
      onRefresh()
      toast({ title: "Success", description: "Service deleted successfully" })
    }
  })

  return (
    <Card className="p-4 bg-white border">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-medium text-gray-800">{service.name}</h4>
          <div className="flex gap-4 mt-2 text-xs text-gray-600">
            <span>Type: {service.limit_type}</span>
            <span>Coverage: {service.coverage_status}</span>
            {service.limit_type === "PRICE" && service.limit_value && (
              <span>Limit: ₦{service.limit_value.toLocaleString()}</span>
            )}
            {service.limit_type === "FREQUENCY" && service.limit_frequency && (
              <span>Limit: {service.limit_frequency}</span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500"
          onClick={() => deleteServiceMutation.mutate(service.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}

function EditCategoryModal({
  packageId,
  category,
  onSuccess,
}: {
  packageId: string
  category: BenefitCategory
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description || "")
  const [priceLimit, setPriceLimit] = useState(
    category.price_limit != null ? String(category.price_limit) : ""
  )
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Category name is required" })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/settings/benefit-packages/${packageId}/categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price_limit: priceLimit ? Number(priceLimit) : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update category")
      }

      onSuccess()
      setOpen(false)
      toast({ title: "Success", description: "Category updated successfully" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setName(category.name)
          setDescription(category.description || "")
          setPriceLimit(category.price_limit != null ? String(category.price_limit) : "")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Category Name *</Label>
            <Input
              placeholder="e.g., Laboratory Services"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Category Price Limit (₦)</Label>
            <Input
              type="number"
              min="0"
              placeholder="Optional - category cap for all services"
              value={priceLimit}
              onChange={e => setPriceLimit(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Input
              placeholder="Describe this category..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button className="w-full" onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Category"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateCategoryModal({
  packageId,
  onSuccess
}: {
  packageId: string
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [priceLimit, setPriceLimit] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Category name is required" })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/settings/benefit-packages/${packageId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price_limit: priceLimit ? Number(priceLimit) : null,
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create category")
      }

      onSuccess()
      setName("")
      setDescription("")
      setPriceLimit("")
      setOpen(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Category Name *</Label>
            <Input
              placeholder="e.g., Laboratory Services"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Category Price Limit (₦)</Label>
            <Input
              type="number"
              min="0"
              placeholder="Optional - category cap for all services"
              value={priceLimit}
              onChange={e => setPriceLimit(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Input
              placeholder="Describe this category..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button className="w-full" onClick={handleCreate} disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Category"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateServiceModal({
  packageId,
  categoryId,
  onSuccess
}: {
  packageId: string
  categoryId: string
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    description: string
    limit_type: "PRICE" | "FREQUENCY"
    limit_value: string
    limit_frequency: string
    coverage_status: "COVERED" | "NOT_COVERED"
  }>({
    name: "",
    description: "",
    limit_type: "PRICE",
    limit_value: "",
    limit_frequency: "",
    coverage_status: "COVERED"
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Service name is required" })
      return
    }

    // Only validate limits if COVERED
    if (formData.coverage_status === "COVERED") {
      if (formData.limit_type === "PRICE" && !formData.limit_value) {
        toast({ variant: "destructive", title: "Error", description: "Price limit is required for covered services" })
        return
      }

      if (formData.limit_type === "FREQUENCY" && !formData.limit_frequency) {
        toast({ variant: "destructive", title: "Error", description: "Frequency is required for covered services" })
        return
      }
    }

    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/settings/benefit-packages/${packageId}/categories/${categoryId}/services`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            limit_type: formData.coverage_status === "COVERED" ? formData.limit_type : null,
            limit_value: formData.coverage_status === "COVERED" && formData.limit_type === "PRICE" ? parseFloat(formData.limit_value) : null,
            limit_frequency: formData.coverage_status === "COVERED" && formData.limit_type === "FREQUENCY" ? formData.limit_frequency : null,
            coverage_status: formData.coverage_status
          })
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create service")
      }

      onSuccess()
      setFormData({
        name: "",
        description: "",
        limit_type: "PRICE",
        limit_value: "",
        limit_frequency: "",
        coverage_status: "COVERED"
      })
      setOpen(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-green-600 hover:bg-green-700">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Service</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Service Name *</Label>
            <Input
              placeholder="e.g., Blood Test"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Input
              placeholder="Additional details..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Coverage Status</Label>
            <Select value={formData.coverage_status} onValueChange={(v) => setFormData({...formData, coverage_status: v as any})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COVERED">Covered</SelectItem>
                <SelectItem value="NOT_COVERED">Not Covered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.coverage_status === "COVERED" && (
            <>
              <div>
                <Label>Limit Type *</Label>
                <Select
                  value={formData.limit_type}
                  onValueChange={(v) => setFormData({...formData, limit_type: v as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRICE">Price Limit (₦)</SelectItem>
                    <SelectItem value="FREQUENCY">Frequency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.limit_type === "PRICE" ? (
                <div>
                  <Label>Amount (₦) *</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={formData.limit_value}
                    onChange={e => setFormData({...formData, limit_value: e.target.value})}
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <div>
                  <Label>Frequency *</Label>
                  <Input
                    placeholder="e.g., 1 Session/Year"
                    value={formData.limit_frequency}
                    onChange={e => setFormData({...formData, limit_frequency: e.target.value})}
                    disabled={isLoading}
                  />
                </div>
              )}
            </>
          )}

          <Button className="w-full" onClick={handleCreate} disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Service"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
