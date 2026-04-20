"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  X,
} from "lucide-react"

import { AddHRRuleForm } from "@/components/forms/add-hr-rule-form"
import { EditHRRuleForm } from "@/components/forms/edit-hr-rule-form"
import { ViewHRRule } from "@/components/forms/view-hr-rule"



export default function HRRulesManagementPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedRuleType, setSelectedRuleType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedHRRule, setSelectedHRRule] = useState<any>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch HR rules data
  const { data: hrRulesData, isLoading, refetch } = useQuery({
    queryKey: ["hr-rules", debouncedSearchTerm, selectedRuleType, selectedStatus, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearchTerm) params.append("search", debouncedSearchTerm)
      if (selectedRuleType !== "all") params.append("ruleType", selectedRuleType)
      if (selectedStatus !== "all") params.append("isActive", selectedStatus)
      params.append("page", currentPage.toString())
      params.append("limit", "10")
      
      const res = await fetch(`/api/hr/rules?${params}`)
      if (!res.ok) throw new Error("Failed to fetch HR rules")
      return res.json()
    }
  })

  const hrRules = hrRulesData?.hrRules || []
  const pagination = hrRulesData?.pagination

  // Delete HR rule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hr/rules/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete HR rule')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "HR Rule deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["hr-rules"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete HR rule",
        variant: "destructive"
      })
    }
  })

  // Toggle HR rule status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string, is_active: boolean }) => {
      const res = await fetch(`/api/hr/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active })
      })
      if (!res.ok) throw new Error('Failed to update HR rule status')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "HR Rule status updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["hr-rules"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update HR rule status",
        variant: "destructive"
      })
    }
  })

  const handleDelete = async (hrRule: any) => {
    if (!confirm(`Delete HR rule "${hrRule.title}"?`)) return
    
    try {
      await deleteMutation.mutateAsync(hrRule.id)
    } catch (error) {
      console.error('Error deleting HR rule:', error)
    }
  }

  const handleEdit = (hrRule: any) => {
    setSelectedHRRule(hrRule)
    setShowEditModal(true)
  }

  const handleView = (hrRule: any) => {
    setSelectedHRRule(hrRule)
    setShowViewModal(true)
  }

  const handleToggleStatus = (hrRule: any) => {
    toggleStatusMutation.mutate({ id: hrRule.id, is_active: !hrRule.is_active })
  }

  const getRuleTypeColor = (ruleType: string) => {
    switch (ruleType) {
      case 'ATTENDANCE': return 'default'
      case 'LEAVE_APPROVAL': return 'secondary'
      case 'PAYROLL': return 'default'
      case 'CLAIMS_VALIDATION': return 'destructive'
      case 'EMPLOYEE_ONBOARDING': return 'default'
      case 'PERFORMANCE': return 'secondary'
      case 'COMPLIANCE': return 'destructive'
      default: return 'default'
    }
  }

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    )
  }

  const exportHRRules = () => {
    const csvContent = [
      ['Name', 'Rule Type', 'Status', 'Priority', 'Created Date'],
      ...hrRules.map((hrRule: any) => [
        hrRule.name,
        hrRule.rule_type,
        hrRule.is_active ? 'Active' : 'Inactive',
        hrRule.priority,
        new Date(hrRule.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hr-rules-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">HR Rules Management</h1>
          <p className="text-gray-600">Manage HR rules for claims validation and process automation</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportHRRules} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-[#0891B2] hover:bg-[#9B1219] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add HR Rule
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search HR rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Rule Type</label>
              <Select value={selectedRuleType} onValueChange={setSelectedRuleType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Rule Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rule Types</SelectItem>
                  <SelectItem value="ATTENDANCE">Attendance</SelectItem>
                  <SelectItem value="LEAVE_APPROVAL">Leave Approval</SelectItem>
                  <SelectItem value="PAYROLL">Payroll</SelectItem>
                  <SelectItem value="CLAIMS_VALIDATION">Claims Validation</SelectItem>
                  <SelectItem value="EMPLOYEE_ONBOARDING">Employee Onboarding</SelectItem>
                  <SelectItem value="PERFORMANCE">Performance</SelectItem>
                  <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HR Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            HR Rules ({pagination?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading HR rules...</div>
          ) : hrRules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No HR rules found. Create your first HR rule to get started.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-gray-600">Name</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">Rule Type</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">Status</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">Priority</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">Created By</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hrRules.map((hrRule: any) => (
                    <TableRow key={hrRule.id}>
                      <TableCell className="font-medium">
                        <div className="max-w-xs truncate" title={hrRule.name}>
                          {hrRule.name}
                        </div>
                        {hrRule.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs" title={hrRule.description}>
                            {hrRule.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRuleTypeColor(hrRule.rule_type)}>
                          {hrRule.rule_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(hrRule.is_active)}
                          <Badge variant={hrRule.is_active ? 'default' : 'secondary'}>
                            {hrRule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-gray-400" />
                          {hrRule.priority}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hrRule.created_by ? (
                          <div>
                            <div className="font-medium">
                              {hrRule.created_by.first_name} {hrRule.created_by.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {hrRule.created_by.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(hrRule.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(hrRule)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(hrRule)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(hrRule)}>
                              {hrRule.is_active ? (
                                <>
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(hrRule)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} HR rules
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                      disabled={currentPage === pagination.pages}
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

      {/* Add HR Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Add New HR Rule</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddHRRuleForm 
                onSuccess={() => {
                  setShowAddModal(false)
                  refetch()
                }}
                onCancel={() => setShowAddModal(false)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit HR Rule Modal */}
      {showEditModal && selectedHRRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Edit HR Rule</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedHRRule(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EditHRRuleForm 
                hrRule={selectedHRRule}
                onSuccess={() => {
                  setShowEditModal(false)
                  setSelectedHRRule(null)
                  refetch()
                }}
                onCancel={() => {
                  setShowEditModal(false)
                  setSelectedHRRule(null)
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* View HR Rule Modal */}
      {showViewModal && selectedHRRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">View HR Rule</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowViewModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ViewHRRule 
                hrRule={selectedHRRule}
                onClose={() => {
                  setShowViewModal(false)
                  setSelectedHRRule(null)
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
