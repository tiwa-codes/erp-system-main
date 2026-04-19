"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  MoreHorizontal,
  X
} from "lucide-react"

interface RiskProfile {
  id: string
  provider_id: string
  provider: {
    facility_name: string
    hcp_code: string
  }
  risk_score: number
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  assessment_date: string
  last_reviewed: string
  status: "ACTIVE" | "INACTIVE"
  notes?: string
  created_at: string
  updated_at: string
}

interface Provider {
  id: string
  facility_name: string
  hcp_code: string
}

export default function RiskManagementPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedRisk, setSelectedRisk] = useState<RiskProfile | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Form state
  const [formData, setFormData] = useState({
    provider_id: "",
    risk_score: "",
    risk_level: "",
    assessment_date: "",
    notes: ""
  })

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch risk profiles
  const { data: riskProfilesData, isLoading } = useQuery({
    queryKey: ["risk-profiles", currentPage, pageSize, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm
      })
      const res = await fetch(`/api/settings/risk-management?${params}`)
      if (!res.ok) throw new Error("Failed to fetch risk profiles")
      return res.json()
    },
  })

  // Fetch providers
  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers")
      if (!res.ok) throw new Error("Failed to fetch providers")
      return res.json()
    },
  })

  // Create risk profile mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/settings/risk-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to create risk profile')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Risk profile created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["risk-profiles"] })
      setShowAddModal(false)
      setFormData({
        provider_id: "",
        risk_score: "",
        risk_level: "",
        assessment_date: "",
        notes: ""
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create risk profile",
        variant: "destructive",
      })
    },
  })

  // Update risk profile mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/settings/risk-management/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update risk profile')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Risk profile updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["risk-profiles"] })
      setShowEditModal(false)
      setSelectedRisk(null)
      setFormData({
        provider_id: "",
        risk_score: "",
        risk_level: "",
        assessment_date: "",
        notes: ""
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update risk profile",
        variant: "destructive",
      })
    },
  })

  // Delete risk profile mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/risk-management/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete risk profile')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Risk profile deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["risk-profiles"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete risk profile",
        variant: "destructive",
      })
    },
  })

  const riskProfiles: RiskProfile[] = riskProfilesData?.riskProfiles || []
  const pagination = riskProfilesData?.pagination || {
    page: currentPage,
    limit: pageSize,
    total: riskProfilesData?.totalCount || 0,
    pages: Math.ceil((riskProfilesData?.totalCount || 0) / pageSize)
  }
  const providers: Provider[] = providersData?.providers || []

  const handleAddRisk = () => {
    // Validate required fields
    if (!formData.provider_id || !formData.risk_score || !formData.risk_level || !formData.assessment_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    const dataToSubmit = {
      ...formData,
      risk_score: parseFloat(formData.risk_score) || 0
    }
    createMutation.mutate(dataToSubmit)
  }

  const handleEditRisk = () => {
    if (selectedRisk) {
      // Validate required fields
      if (!formData.provider_id || !formData.risk_score || !formData.risk_level || !formData.assessment_date) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive",
        })
        return
      }

      const dataToSubmit = {
        ...formData,
        risk_score: parseFloat(formData.risk_score) || 0
      }
      updateMutation.mutate({ id: selectedRisk.id, data: dataToSubmit })
    }
  }

  const handleEditClick = (risk: RiskProfile) => {
    setSelectedRisk(risk)
    setFormData({
      provider_id: risk.provider_id,
      risk_score: risk.risk_score.toString(),
      risk_level: risk.risk_level,
      assessment_date: risk.assessment_date.split('T')[0],
      notes: risk.notes || ""
    })
    setShowEditModal(true)
  }

  const handleDeleteClick = (id: string) => {
    if (confirm("Are you sure you want to delete this risk profile?")) {
      deleteMutation.mutate(id)
    }
  }

  const handleViewClick = (risk: RiskProfile) => {
    setSelectedRisk(risk)
    setShowViewModal(true)
  }

  const getRiskLevelBadgeColor = (level: string) => {
    switch (level) {
      case "LOW":
        return "bg-green-100 text-green-800"
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800"
      case "HIGH":
        return "bg-orange-100 text-orange-800"
      case "CRITICAL":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRiskScoreIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="h-4 w-4 text-red-600" />
    if (score >= 60) return <Activity className="h-4 w-4 text-orange-600" />
    if (score >= 40) return <TrendingDown className="h-4 w-4 text-yellow-600" />
    return <TrendingDown className="h-4 w-4 text-green-600" />
  }

  if (isLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Risk Management</h1>
          <p className="text-gray-600 mt-1">Manage provider risk profiles and assessments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddModal(true)} className="bg-[#BE1522] hover:bg-[#9B1219]">
            <Plus className="h-4 w-4 mr-2" />
            Add Tariff Plan
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search risk profiles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tariff Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Tariff Plans
          </CardTitle>
          <CardDescription>
            Monitor and manage provider tariff plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">RISK SCORE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">RISK LEVEL</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ASSESSMENT DATE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">LAST REVIEWED</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No risk profiles found.
                    </TableCell>
                  </TableRow>
                ) : (
                  riskProfiles.map((risk) => (
                    <TableRow key={risk.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-red-400">
                              {risk.provider.facility_name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                        <div>
                            <div className="font-medium text-gray-900">{risk.provider.facility_name}</div>
                          <div className="text-sm text-gray-500">{risk.provider.hcp_code}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRiskScoreIcon(risk.risk_score)}
                          <span className="font-medium">{risk.risk_score}/100</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRiskLevelBadgeColor(risk.risk_level)}>
                          {risk.risk_level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{new Date(risk.assessment_date).toLocaleDateString()}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{new Date(risk.last_reviewed).toLocaleDateString()}</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                            onClick={() => handleViewClick(risk)}
                              className="w-full justify-start text-xs"
                            >
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                            onClick={() => handleEditClick(risk)}
                              className="w-full justify-start text-xs"
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                            onClick={() => handleDeleteClick(risk.id)}
                              className="text-red-600 w-full justify-start text-xs"
                            >
                              Delete
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

      {/* Add Tariff Plan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Add Tariff Plan</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
              Create a new risk profile for a provider.
              </CardDescription>
            </CardHeader>
            <CardContent>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="provider_id">Select Provider</Label>
              <Select 
                value={formData.provider_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, provider_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.facility_name} ({provider.hcp_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="risk_score">Risk Score (0-100)</Label>
                <Input
                  id="risk_score"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Enter risk score"
                  value={formData.risk_score}
                  onChange={(e) => setFormData(prev => ({ ...prev, risk_score: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk_level">Risk Level</Label>
                <Select 
                  value={formData.risk_level} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, risk_level: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment_date">Assessment Date</Label>
              <Input
                id="assessment_date"
                type="date"
                value={formData.assessment_date}
                onChange={(e) => setFormData(prev => ({ ...prev, assessment_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Enter assessment notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
              <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRisk} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Save"}
            </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Tariff Plan Modal */}
      {showEditModal && selectedRisk && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Edit Tariff Plan</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
              Update the risk profile information.
              </CardDescription>
            </CardHeader>
            <CardContent>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_provider_id">Select Provider</Label>
              <Select 
                value={formData.provider_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, provider_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.facility_name} ({provider.hcp_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_risk_score">Risk Score (0-100)</Label>
                <Input
                  id="edit_risk_score"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Enter risk score"
                  value={formData.risk_score}
                  onChange={(e) => setFormData(prev => ({ ...prev, risk_score: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_risk_level">Risk Level</Label>
                <Select 
                  value={formData.risk_level} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, risk_level: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_assessment_date">Assessment Date</Label>
              <Input
                id="edit_assessment_date"
                type="date"
                value={formData.assessment_date}
                onChange={(e) => setFormData(prev => ({ ...prev, assessment_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes (Optional)</Label>
              <Input
                id="edit_notes"
                placeholder="Enter assessment notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
              <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRisk} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Tariff Plan Modal */}
      {showViewModal && selectedRisk && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Tariff Plan Details</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowViewModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
              View details of the selected risk profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Provider</Label>
                  <p className="text-sm font-medium">{selectedRisk.provider.facility_name} ({selectedRisk.provider.hcp_code})</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Risk Score</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getRiskScoreIcon(selectedRisk.risk_score)}
                    <span className="text-sm font-medium">{selectedRisk.risk_score}/100</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Risk Level</Label>
                  <Badge className={getRiskLevelBadgeColor(selectedRisk.risk_level)}>
                    {selectedRisk.risk_level}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Assessment Date</Label>
                  <p className="text-sm">{new Date(selectedRisk.assessment_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Last Reviewed</Label>
                  <p className="text-sm">{new Date(selectedRisk.last_reviewed).toLocaleDateString()}</p>
                </div>
                {selectedRisk.notes && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Notes</Label>
                    <p className="text-sm">{selectedRisk.notes}</p>
                  </div>
                )}
              </div>
              </div>
            </CardContent>
          </Card>
            </div>
          )}
    </div>
  )
}
