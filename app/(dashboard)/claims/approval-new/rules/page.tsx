"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  Shield,
  Download,
  BarChart3,
  PieChart,
  Plus,
  Settings,
  MoreVertical,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FraudRule {
  id: string
  name: string
  description: string
  category: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  conditions: string[]
  auto_action: string
  triggered_count: number
  is_active: boolean
  risk_score_weight: number
  created_at: string
  created_by: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
}

export default function RulesManagementPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedSeverity, setSelectedSeverity] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // State for create rule modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRule, setEditingRule] = useState<FraudRule | null>(null)
  const [ruleForm, setRuleForm] = useState({
    name: "",
    category: "",
    description: "",
    field: "",
    operator: "",
    value: "",
    metrics: "",
    severity: "MEDIUM",
    risk_score_weight: 50,
    conditions: [] as string[],
    auto_actions: {
      flag_claim: false,
      hold_payment: false,
      create_investigation: false,
      others: false
    }
  })

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch fraud rules
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ["fraud-rules", currentPage, limit, debouncedSearchTerm, selectedSeverity, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedSeverity !== "all" && { severity: selectedSeverity }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })
      
      const res = await fetch(`/api/claims/fraud/rules?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch fraud rules")
      }
      return res.json()
    },
  })

  const rules = rulesData?.rules || []
  const pagination = rulesData?.pagination

  // Toggle rule status
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const res = await fetch(`/api/claims/fraud/rules/${ruleId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      })
      if (!res.ok) {
        throw new Error("Failed to toggle rule status")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Rule status updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["fraud-rules"] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update rule status",
        variant: "destructive",
      })
    },
  })

  const handleToggleRule = (ruleId: string, currentStatus: boolean) => {
    toggleRuleMutation.mutate({
      ruleId,
      isActive: !currentStatus
    })
  }

  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: any) => {
      const res = await fetch('/api/claims/fraud/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      })
      if (!res.ok) {
        throw new Error('Failed to create rule')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Rule created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["fraud-rules"] })
      setShowCreateModal(false)
      setRuleForm({
        name: "",
        category: "",
        description: "",
        field: "",
        operator: "",
        value: "",
        metrics: "",
        severity: "MEDIUM",
        risk_score_weight: 50,
        conditions: [],
        auto_actions: {
          flag_claim: false,
          hold_payment: false,
          create_investigation: false,
          others: false
        }
      })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create rule",
        variant: "destructive",
      })
    },
  })

  // Delete rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch(`/api/claims/fraud/rules/${ruleId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error("Failed to delete rule")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Rule deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["fraud-rules"] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete rule",
        variant: "destructive",
      })
    },
  })

  // Update rule
  const updateRuleMutation = useMutation({
    mutationFn: async ({ ruleId, ruleData }: { ruleId: string; ruleData: any }) => {
      const res = await fetch(`/api/claims/fraud/rules/${ruleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruleData),
      })
      if (!res.ok) {
        throw new Error("Failed to update rule")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Rule updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["fraud-rules"] })
      setShowEditModal(false)
      setEditingRule(null)
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update rule",
        variant: "destructive",
      })
    },
  })

  const handleCreateRule = () => {
    if (!ruleForm.name || !ruleForm.category) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      })
      return
    }

    createRuleMutation.mutate(ruleForm)
  }

  const handleEditRule = (rule: FraudRule) => {
    setEditingRule(rule)
    setRuleForm({
      name: rule.name,
      category: rule.category,
      description: rule.description,
      field: "",
      operator: "",
      value: "",
      metrics: "",
      severity: rule.severity,
      risk_score_weight: rule.risk_score_weight,
      conditions: rule.conditions,
      auto_actions: {
        flag_claim: false,
        hold_payment: false,
        create_investigation: false,
        others: false
      }
    })
    setShowEditModal(true)
  }

  const handleUpdateRule = () => {
    if (!ruleForm.name || !ruleForm.category || !editingRule) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      })
      return
    }

    updateRuleMutation.mutate({
      ruleId: editingRule.id,
      ruleData: ruleForm
    })
  }

  const handleDeleteRule = (ruleId: string) => {
    if (window.confirm("Are you sure you want to delete this rule?")) {
      deleteRuleMutation.mutate(ruleId)
    }
  }

  const addCondition = () => {
    if (ruleForm.field && ruleForm.operator && ruleForm.value) {
      const condition = `${ruleForm.field} ${ruleForm.operator} ${ruleForm.value}`
      setRuleForm({
        ...ruleForm,
        conditions: [...ruleForm.conditions, condition],
        field: "",
        operator: "",
        value: ""
      })
    }
  }

  const removeCondition = (index: number) => {
    setRuleForm({
      ...ruleForm,
      conditions: ruleForm.conditions.filter((_, i) => i !== index)
    })
  }

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Get severity badge color
  const getSeverityBadgeColor = (severity: string) => {
    if (!severity) return 'bg-gray-100 text-gray-800'
    
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="claims" action="fraud_detection">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rules & Model Management</h1>
            <p className="text-gray-600">Create, edit, and manage fraud detection rules</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Rule Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Search Provider</label>
                <Input
                  placeholder="Search by name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Severity</label>
                <Select value={selectedSeverity} onValueChange={(value) => {
                  setSelectedSeverity(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">From</label>
                <Input
                  type="date"
                  placeholder="dd-mm-yyyy"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <Input
                  type="date"
                  placeholder="dd-mm-yyyy"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleFilterChange} className="bg-green-600 hover:bg-green-700">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create Rule Button */}
        <PermissionGate module="claims" action="add">
          <div className="flex justify-start">
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </div>
        </PermissionGate>

        {/* Fraud Detection Rules */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fraud Detection Rules</CardTitle>
                <CardDescription>Manage fraud detection rules and their settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {rules.map((rule: FraudRule) => (
                    <div key={rule.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={() => handleToggleRule(rule.id, rule.is_active)}
                            className="data-[state=checked]:bg-green-600"
                          />
                          <Badge className={getSeverityBadgeColor(rule.severity)}>
                            {rule.severity}
                          </Badge>
                          <div>
                            <h3 className="font-semibold text-lg">{rule.name}</h3>
                            <p className="text-sm text-gray-600">{rule.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-sm">
                                <strong>Auto Action:</strong> {rule.auto_action}
                              </span>
                              <span className="text-sm text-green-600">
                                <strong>Triggered:</strong> {rule.triggered_count} times today
                              </span>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem 
                              onClick={() => handleEditRule(rule)}
                              className="w-full justify-start text-xs"
                            >
                              Edit Rule
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600 w-full justify-start text-xs"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              Delete Rule
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                        disabled={pagination.page === pagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Rule Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Create New Rule</CardTitle>
                <CardDescription>manage rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Rule Configuration */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Rule Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Rule Name</label>
                      <Input
                        placeholder="enter rule name"
                        value={ruleForm.name}
                        onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <Select value={ruleForm.category} onValueChange={(value) => 
                        setRuleForm({ ...ruleForm, category: value })
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="duplicate">Duplicate Claims</SelectItem>
                          <SelectItem value="billing">Billing Patterns</SelectItem>
                          <SelectItem value="service">Service Limits</SelectItem>
                          <SelectItem value="provider">Provider Behavior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-sm font-medium">Description (optional)</label>
                    <Textarea
                      placeholder="Rule description"
                      value={ruleForm.description}
                      onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>

                {/* Condition */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Condition</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Field (Service name)</label>
                      <Select value={ruleForm.field} onValueChange={(value) => 
                        setRuleForm({ ...ruleForm, field: value })
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="CT Scan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ct_scan">CT Scan</SelectItem>
                          <SelectItem value="mri">MRI</SelectItem>
                          <SelectItem value="xray">X-Ray</SelectItem>
                          <SelectItem value="lab_test">Lab Test</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Operator</label>
                      <Select value={ruleForm.operator} onValueChange={(value) => 
                        setRuleForm({ ...ruleForm, operator: value })
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="Greater than" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="greater_than">Greater than</SelectItem>
                          <SelectItem value="less_than">Less than</SelectItem>
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="not_equals">Not equals</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Value</label>
                      <Input
                        placeholder="Input value"
                        value={ruleForm.value}
                        onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Metrics</label>
                      <Input
                        placeholder="enter metrics"
                        value={ruleForm.metrics}
                        onChange={(e) => setRuleForm({ ...ruleForm, metrics: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600"
                      onClick={() => removeCondition(ruleForm.conditions.length - 1)}
                      disabled={ruleForm.conditions.length === 0}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Remove Condition
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-blue-600"
                      onClick={addCondition}
                      disabled={!ruleForm.field || !ruleForm.operator || !ruleForm.value}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Condition
                    </Button>
                  </div>
                  
                  {/* Display added conditions */}
                  {ruleForm.conditions.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Added Conditions:</h4>
                      <div className="space-y-2">
                        {ruleForm.conditions.map((condition, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm">{condition}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600"
                              onClick={() => removeCondition(index)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rule Settings */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Rule Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Severity Level</label>
                      <Select value={ruleForm.severity} onValueChange={(value) => 
                        setRuleForm({ ...ruleForm, severity: value })
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="LOW">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Risk Score Weight</label>
                      <Input
                        placeholder="0 - 100"
                        type="number"
                        min="0"
                        max="100"
                        value={ruleForm.risk_score_weight}
                        onChange={(e) => setRuleForm({ ...ruleForm, risk_score_weight: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                {/* Automated Actions */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Automated Actions</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="flag_claim"
                        checked={ruleForm.auto_actions.flag_claim}
                        onChange={(e) => setRuleForm({
                          ...ruleForm,
                          auto_actions: { ...ruleForm.auto_actions, flag_claim: e.target.checked }
                        })}
                      />
                      <label htmlFor="flag_claim" className="text-sm">Flag Claim for manual review</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="hold_payment"
                        checked={ruleForm.auto_actions.hold_payment}
                        onChange={(e) => setRuleForm({
                          ...ruleForm,
                          auto_actions: { ...ruleForm.auto_actions, hold_payment: e.target.checked }
                        })}
                      />
                      <label htmlFor="hold_payment" className="text-sm">Hold Payment Processing</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="create_investigation"
                        checked={ruleForm.auto_actions.create_investigation}
                        onChange={(e) => setRuleForm({
                          ...ruleForm,
                          auto_actions: { ...ruleForm.auto_actions, create_investigation: e.target.checked }
                        })}
                      />
                      <label htmlFor="create_investigation" className="text-sm">Create Investigation Case</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="others"
                        checked={ruleForm.auto_actions.others}
                        onChange={(e) => setRuleForm({
                          ...ruleForm,
                          auto_actions: { ...ruleForm.auto_actions, others: e.target.checked }
                        })}
                      />
                      <label htmlFor="others" className="text-sm">Others</label>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateRule}
                    disabled={createRuleMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createRuleMutation.isPending ? "Saving..." : "Save Rule"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit Rule Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Edit Rule</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowEditModal(false)
                        setEditingRule(null)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Rule Information */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Rule Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Rule Name</label>
                        <Input
                          placeholder="Enter rule name"
                          value={ruleForm.name}
                          onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Category</label>
                        <Select value={ruleForm.category} onValueChange={(value) => 
                          setRuleForm({ ...ruleForm, category: value })
                        }>
                          <SelectTrigger>
                            <SelectValue placeholder="select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Duplicate Claims">Duplicate Claims</SelectItem>
                            <SelectItem value="Billing Patterns">Billing Patterns</SelectItem>
                            <SelectItem value="Provider Patterns">Provider Patterns</SelectItem>
                            <SelectItem value="Service Limits">Service Limits</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Enter rule description"
                        value={ruleForm.description}
                        onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Condition */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Condition</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Field (Service name)</label>
                        <Select value={ruleForm.field} onValueChange={(value) => 
                          setRuleForm({ ...ruleForm, field: value })
                        }>
                          <SelectTrigger>
                            <SelectValue placeholder="CT Scan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CT Scan">CT Scan</SelectItem>
                            <SelectItem value="MRI">MRI</SelectItem>
                            <SelectItem value="X-Ray">X-Ray</SelectItem>
                            <SelectItem value="Blood Test">Blood Test</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Operator</label>
                        <Select value={ruleForm.operator} onValueChange={(value) => 
                          setRuleForm({ ...ruleForm, operator: value })
                        }>
                          <SelectTrigger>
                            <SelectValue placeholder="Greater than" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="greater_than">Greater than</SelectItem>
                            <SelectItem value="less_than">Less than</SelectItem>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="not_equals">Not equals</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Value</label>
                        <Input
                          placeholder="Input value"
                          value={ruleForm.value}
                          onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Metrics</label>
                        <Input
                          placeholder="enter metrics"
                          value={ruleForm.metrics}
                          onChange={(e) => setRuleForm({ ...ruleForm, metrics: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600"
                        onClick={() => removeCondition(ruleForm.conditions.length - 1)}
                        disabled={ruleForm.conditions.length === 0}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Remove Condition
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-blue-600"
                        onClick={addCondition}
                        disabled={!ruleForm.field || !ruleForm.operator || !ruleForm.value}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Condition
                      </Button>
                    </div>
                    
                    {/* Display added conditions */}
                    {ruleForm.conditions.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Added Conditions:</h4>
                        <div className="space-y-2">
                          {ruleForm.conditions.map((condition, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <span className="text-sm">{condition}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600"
                                onClick={() => removeCondition(index)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rule Settings */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Rule Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Severity Level</label>
                        <Select value={ruleForm.severity} onValueChange={(value) => 
                          setRuleForm({ ...ruleForm, severity: value })
                        }>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CRITICAL">Critical</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="LOW">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Risk Score Weight</label>
                        <Input
                          placeholder="0 - 100"
                          type="number"
                          min="0"
                          max="100"
                          value={ruleForm.risk_score_weight}
                          onChange={(e) => setRuleForm({ ...ruleForm, risk_score_weight: parseInt(e.target.value) || 50 })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowEditModal(false)
                        setEditingRule(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpdateRule}
                      disabled={updateRuleMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {updateRuleMutation.isPending ? "Updating..." : "Update Rule"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
