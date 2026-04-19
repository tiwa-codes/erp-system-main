"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"
import { BandSelector } from "@/components/ui/band-selector"
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  FileText,
  Upload,
  DollarSign,
  MoreHorizontal,
  X,
  Send
} from "lucide-react"

interface Plan {
  id: string
  plan_id?: string
  name: string
  description?: string
  plan_type: "INDIVIDUAL" | "FAMILY" | "CORPORATE"
  classification: "GENERAL" | "CUSTOM"
  premium_amount: number
  annual_limit: number
  band_type?: string
  assigned_bands?: string[]
  status: "DRAFT" | "IN_PROGRESS" | "PENDING_APPROVAL" | "COMPLETE" | "ACTIVE" | "INACTIVE" | "SUSPENDED"
  approval_stage?: "UNDERWRITING" | "SPECIAL_RISK" | "MD" | null
  organization?: {
    name: string
  }
  created_at: string
  updated_at: string
}

export default function PlansManagementPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    plan_type: "",
    premium_amount: "",
    annual_limit: "",
    classification: "GENERAL",
    band_type: ""
  })
  const [selectedBands, setSelectedBands] = useState<string[]>([])

  // Fetch band labels
  const { data: bandLabelsData } = useQuery({
    queryKey: ["band-labels"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/band-labels?status=ACTIVE")
      if (!res.ok) throw new Error("Failed to fetch band labels")
      return res.json()
    }
  })

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      setDebouncedSearchTerm(searchTerm.trim())
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch plans
  const { data: plansData, isPending, isFetching, refetch } = useQuery({
    queryKey: ["plans", currentPage, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        search: debouncedSearchTerm,
        classification: "GENERAL",
      })
      const res = await fetch(`/api/underwriting/plans?${params}`)
      if (!res.ok) throw new Error("Failed to fetch plans")
      return res.json()
    },
  })

  // Create plan mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/underwriting/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        const errorMessage = error.details 
          ? `${error.error || "Validation failed"}: ${JSON.stringify(error.details)}`
          : error.error || "Failed to create plan"
        throw new Error(errorMessage)
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["plans"] })
      setShowAddModal(false)
      setFormData({
        name: "",
        description: "",
        plan_type: "",
        premium_amount: "",
        annual_limit: "",
        classification: "GENERAL",
        band_type: ""
      })
      setSelectedBands([])
    },
    onError: (error: any) => {
      // Check if it's a duplicate plan error
      if (error.message.includes("already exists")) {
        toast({
          title: "Plan Already Exists",
          description: "A plan with this name already exists. Please choose a different name.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create plan",
          variant: "destructive",
        })
      }
    },
  })

  // Submit plan to Special Services mutation
  const submitToSpecialRiskMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/underwriting/plans/${planId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to submit plan to Special Services')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan submitted to Special Services successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["plans"] })
      refetch()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit plan to Special Services",
        variant: "destructive",
      })
    },
  })

  // Update plan mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/underwriting/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update plan')
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Plan updated successfully",
      })
      // Invalidate all plans queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["plans"] })
      queryClient.invalidateQueries({ queryKey: ["plans", currentPage, debouncedSearchTerm] })
      // Force refetch current query
      refetch()
      setShowEditModal(false)
      setSelectedPlan(null)
      setFormData({
        name: "",
        description: "",
        plan_type: "",
        premium_amount: "",
        annual_limit: "",
        classification: "GENERAL",
        band_type: ""
      })
      setSelectedBands([])
    },
    onError: (error: any) => {
      // Check if it's a duplicate plan error
      if (error.message.includes("already exists")) {
        toast({
          title: "Plan Already Exists",
          description: "A plan with this name already exists. Please choose a different name.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update plan",
          variant: "destructive",
        })
      }
    },
  })

  // Delete plan mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/underwriting/plans/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || error.error || 'Failed to delete plan')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["plans"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete plan",
        variant: "destructive",
      })
    },
  })

  // Change status mutation
  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await fetch(`/api/underwriting/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (!res.ok) throw new Error('Failed to update plan status')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan status updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["plans"] })
      setShowChangeStatusModal(false)
      setSelectedPlan(null)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan status",
        variant: "destructive",
      })
    },
  })

  const plans: Plan[] = plansData?.plans || []
  const pagination = plansData?.pagination || {
    page: currentPage,
    limit: 10,
    total: plansData?.totalCount || 0,
    pages: Math.ceil((plansData?.totalCount || 0) / 10)
  }
  // API already handles search + pagination; use server results directly
  const filteredPlans = plans

  const handleAddPlan = () => {
    // Validate required fields
    if (!formData.name || !formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Plan name is required",
        variant: "destructive"
      })
      return
    }

    const isCustomSpecialService = false
    const premiumAmount = parseFloat(formData.premium_amount)
    const annualLimit = parseFloat(formData.annual_limit)

    if (!isCustomSpecialService && !formData.plan_type) {
      toast({
        title: "Validation Error",
        description: "Plan type is required",
        variant: "destructive"
      })
      return
    }

    if (!isCustomSpecialService && (isNaN(premiumAmount) || premiumAmount <= 0)) {
      toast({
        title: "Validation Error",
        description: "Premium amount must be a positive number",
        variant: "destructive"
      })
      return
    }

    if (!isCustomSpecialService && (isNaN(annualLimit) || annualLimit <= 0)) {
      toast({
        title: "Validation Error",
        description: "Annual limit must be a positive number",
        variant: "destructive"
      })
      return
    }

    const dataToSubmit = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      plan_type: formData.plan_type,
      premium_amount: premiumAmount,
      annual_limit: annualLimit,
      classification: "GENERAL",
      assigned_bands: selectedBands.length > 0 ? selectedBands : undefined,
      band_type: formData.band_type || undefined,
    }

    console.log("Submitting plan data:", dataToSubmit)
    createMutation.mutate(dataToSubmit)
  }

  const handleEditPlan = () => {
    if (selectedPlan) {
      const dataToSubmit = {
        ...formData,
        premium_amount: parseFloat(formData.premium_amount) || 0,
        annual_limit: parseFloat(formData.annual_limit) || 0,
        assigned_bands: selectedBands
      }
      updateMutation.mutate({ id: selectedPlan.id, data: dataToSubmit })
    }
  }

  const handleViewClick = (plan: Plan) => {
    setSelectedPlan(plan)
    setShowViewModal(true)
  }

  const handleEditClick = (plan: Plan) => {
    setSelectedPlan(plan)
      setFormData({
        name: plan.name,
        description: plan.description || "",
        plan_type: plan.plan_type,
        premium_amount: plan.premium_amount.toString(),
        annual_limit: plan.annual_limit.toString(),
        classification: plan.classification || "GENERAL",
        band_type: plan.band_type || ""
      })
    setSelectedBands(plan.assigned_bands || [])
    setShowEditModal(true)
  }

  const handleChangeStatusClick = (plan: Plan) => {
    setSelectedPlan(plan)
    setShowChangeStatusModal(true)
  }

  const handleDeleteClick = (plan: Plan) => {
    if (window.confirm(`Are you sure you want to permanently delete "${plan.name}"?`)) {
      deleteMutation.mutate(plan.id)
    }
  }

  const handleCustomizeClick = (plan: Plan) => {
    router.push(`/underwriting/plans/${plan.id}/customize`)
  }

  const handleSubmitToSpecialRisk = (plan: Plan) => {
    if (confirm(`Are you sure you want to submit "${plan.name}" to Special Services?`)) {
      submitToSpecialRiskMutation.mutate(plan.id)
    }
  }

  const handleBulkUploadSuccess = (data: any[]) => {
    toast({
      title: "Bulk upload completed",
      description: `Successfully uploaded ${data.length} plans`,
    })
    queryClient.invalidateQueries({ queryKey: ["plans"] })
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-500"
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800"
      case "PENDING_APPROVAL":
        return "bg-yellow-100 text-yellow-800"
      case "COMPLETE":
        return "bg-emerald-100 text-emerald-800"
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-gray-100 text-gray-800"
      case "SUSPENDED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getClassificationBadgeColor = (classification: string) => {
    switch (classification) {
      case "CUSTOM":
        return "bg-orange-100 text-orange-800"
      case "GENERAL":
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  const planStatusOptions = [
    { value: "DRAFT", label: "Draft" },
    { value: "IN_PROGRESS", label: "In Progress (Custom setup)" },
    { value: "PENDING_APPROVAL", label: "Pending Approval (Special Services)" },
    { value: "COMPLETE", label: "Complete / Ready" },
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "SUSPENDED", label: "Suspended" },
  ]

  const getPlanTypeBadgeColor = (type: string) => {
    switch (type) {
      case "INDIVIDUAL":
        return "bg-blue-100 text-blue-800"
      case "FAMILY":
        return "bg-purple-100 text-purple-800"
      case "CORPORATE":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isPending && !plansData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans Management</h1>
          <p className="text-gray-600 mt-1">Create and manage insurance plans</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="text-blue-600"
            onClick={() => setShowBulkUploadModal(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-[#BE1522] hover:bg-[#9B1219]">
            <Plus className="h-4 w-4 mr-2" />
            Add New Plan
          </Button>
        </div>
      </div>
      <p className="text-sm text-gray-600 max-w-2xl">
        This page is for standard underwriting plans. Use Underwriting → Custom Plans for custom special-service sheet plans.
      </p>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search plans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Insurance Plans</CardTitle>
            {isFetching && (
              <span className="text-xs text-gray-500">Loading table...</span>
            )}
          </div>
          <CardDescription className="mt-2">
            Manage all insurance plans and their configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">PLAN NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PLAN TYPE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PLAN CATEGORY</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ASSIGNED BANDS</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No plans found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div>
                          <div className="text-sm text-gray-900">{plan.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">{plan.plan_type}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getClassificationBadgeColor(plan.classification)}>
                          {plan.classification === "CUSTOM" ? "Custom (Special Services → MD)" : "General"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {plan.assigned_bands && plan.assigned_bands.length > 0 ? (
                            plan.assigned_bands.map((band: string) => (
                              <Badge key={band} variant="secondary" className="text-xs">
                                {band}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">No bands assigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-900">₦{plan.premium_amount.toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Annual Limit: ₦{plan.annual_limit.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={plan.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleViewClick(plan)}
                              className="w-full justify-start text-xs"
                            >
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEditClick(plan)}
                              className="w-full justify-start text-xs"
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleCustomizeClick(plan)}
                              className="w-full justify-start text-xs"
                            >
                              Customize
                            </DropdownMenuItem>
                            {plan.classification === "CUSTOM" && 
                             (plan.status === "IN_PROGRESS" || plan.status === "DRAFT") && 
                             plan.approval_stage !== "SPECIAL_RISK" && (
                              <DropdownMenuItem 
                                onClick={() => handleSubmitToSpecialRisk(plan)}
                                className="w-full justify-start text-xs text-blue-600"
                                disabled={submitToSpecialRiskMutation.isPending}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Submit to Special Services
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => handleChangeStatusClick(plan)}
                              className="w-full justify-start text-xs"
                            >
                              Change Status
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(plan)}
                              className="w-full justify-start text-xs text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Plan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {pagination && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="bg-[#BE1522] text-white">
                  {pagination.page}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Plan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Add New Plan</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                Create a new insurance plan with all necessary details.
              </CardDescription>
            </CardHeader>
            <CardContent>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name</Label>
                <Input
                  id="name"
                  placeholder="Enter plan name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan_type">Plan Type</Label>
                <Select
                  value={formData.plan_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, plan_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Family or Individual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="FAMILY">Family</SelectItem>
                    <SelectItem value="CORPORATE">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Enter plan description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="premium_amount">Plan Cost (₦)</Label>
                <Input
                  id="premium_amount"
                  type="number"
                  placeholder="Enter plan cost"
                  value={formData.premium_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, premium_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annual_limit">Annual Limit (₦)</Label>
                <Input
                  id="annual_limit"
                  type="number"
                  placeholder="Enter annual limit"
                  value={formData.annual_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, annual_limit: e.target.value }))}
                />
              </div>
            </div>
            <BandSelector
              selectedBands={selectedBands}
              onBandsChange={setSelectedBands}
              className="mt-4"
            />
          </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setShowAddModal(false)
                }}>
                  Cancel
                </Button>
                <Button onClick={handleAddPlan} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Plan Modal */}
      {showEditModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Edit Plan</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                Update the plan information.
              </CardDescription>
            </CardHeader>
            <CardContent>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_name">Plan Name</Label>
                <Input
                  id="edit_name"
                  placeholder="Enter plan name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_plan_type">Plan Type</Label>
                <Select 
                  value={formData.plan_type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, plan_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Family or Individual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="FAMILY">Family</SelectItem>
                    <SelectItem value="CORPORATE">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Input
                id="edit_description"
                placeholder="Enter plan description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_premium_amount">Plan Cost (₦)</Label>
                <Input
                  id="edit_premium_amount"
                  type="number"
                  placeholder="Enter plan cost"
                  value={formData.premium_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, premium_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_annual_limit">Annual Limit (₦)</Label>
                <Input
                  id="edit_annual_limit"
                  type="number"
                  placeholder="Enter annual limit"
                  value={formData.annual_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, annual_limit: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_band_type">Band Type (Legacy)</Label>
              <Select 
                value={formData.band_type} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, band_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select band type" />
                </SelectTrigger>
                <SelectContent>
                  {bandLabelsData?.band_labels?.map((bandLabel: any) => (
                    <SelectItem key={bandLabel.id} value={bandLabel.label}>
                      {bandLabel.label}
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="Band A">Band A</SelectItem>
                      <SelectItem value="Band B+C">Band B+C</SelectItem>
                      <SelectItem value="Band A+B+C">Band A+B+C</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <BandSelector
              selectedBands={selectedBands}
              onBandsChange={setSelectedBands}
              className="mt-4"
            />
          </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditPlan} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Plan Modal */}
      {showViewModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Plan Details</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowViewModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                View details of the selected plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Plan Name</Label>
                  <p className="text-sm font-medium">{selectedPlan.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Description</Label>
                  <p className="text-sm">{selectedPlan.description || "No description provided"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Plan Type</Label>
                    <Badge className={getPlanTypeBadgeColor(selectedPlan.plan_type)}>
                      {selectedPlan.plan_type}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <Badge className={getStatusBadgeColor(selectedPlan.status)}>
                      {selectedPlan.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Plan Workflow</Label>
                  <Badge className={getClassificationBadgeColor(selectedPlan.classification)}>
                    {selectedPlan.classification === "CUSTOM" ? "Custom (Special Services → MD)" : "General"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Premium Amount</Label>
                    <p className="text-sm font-medium">₦{selectedPlan.premium_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Annual Limit</Label>
                    <p className="text-sm font-medium">₦{selectedPlan.annual_limit.toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Organization</Label>
                  <p className="text-sm">{selectedPlan.organization?.name || "No organization assigned"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Assigned Bands</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedPlan.assigned_bands && selectedPlan.assigned_bands.length > 0 ? (
                      selectedPlan.assigned_bands.map((band: string) => (
                        <Badge key={band} variant="secondary" className="text-xs">
                          {band}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No bands assigned</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Created At</Label>
                    <p className="text-sm">{new Date(selectedPlan.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
                    <p className="text-sm">{new Date(selectedPlan.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Change Status Modal */}
      {showChangeStatusModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Change Plan Status</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowChangeStatusModal(false)
                    setSelectedPlan(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                Change status for {selectedPlan.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Current Status</Label>
                  <div className="mt-1">
                    <StatusIndicator status={selectedPlan.status} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="newStatus" className="text-sm font-medium text-gray-500">New Status</Label>
                  <Select
                    value={selectedPlan.status}
                    onValueChange={(value) => setSelectedPlan(prev => prev ? { ...prev, status: value as any } : null)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                    {planStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowChangeStatusModal(false)
                      setSelectedPlan(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedPlan) {
                        changeStatusMutation.mutate({
                          id: selectedPlan.id,
                          status: selectedPlan.status
                        })
                      }
                    }}
                    disabled={changeStatusMutation.isPending}
                  >
                    {changeStatusMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      'Update Status'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        module="settings"
        submodule="plans"
        onUploadSuccess={handleBulkUploadSuccess}
        uploadEndpoint="/api/settings/bulk-upload"
        sampleFileName="plans-sample.xlsx"
        acceptedColumns={["Plan Name", "Plan Type", "Premium Amount", "Annual Limit", "Description", "Assigned Bands"]}
        maxFileSize={200}
      />
    </div>
  )
}
