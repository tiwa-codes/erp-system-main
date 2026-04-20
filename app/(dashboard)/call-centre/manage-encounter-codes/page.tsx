"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Plus,
  Search,
  Download,
  Eye,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  XCircle
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useRouter } from "next/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"



export default function ManageEncounterCodesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()

  // State for filters and pagination
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  // Form state for generating codes
  const [formData, setFormData] = useState({
    enrollee_id: "",
    enrollee_name: "",
    organization: "",
    plan: ""
  })

  // Search states for enrollee
  const [enrolleeSearchTerm, setEnrolleeSearchTerm] = useState("")
  const [debouncedEnrolleeSearch, setDebouncedEnrolleeSearch] = useState("")
  const [showEnrolleeResults, setShowEnrolleeResults] = useState(false)
  const [selectedEnrollee, setSelectedEnrollee] = useState<any>(null)


  // Fetch encounter codes
  const { data: codesData, isLoading, refetch } = useQuery({
    queryKey: ["encounter-codes", search, status, currentPage, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (status) params.append("status", status)
      params.append("page", currentPage.toString())
      params.append("limit", pageSize.toString())

      const res = await fetch(`/api/call-centre/encounter-codes?${params}`)
      if (!res.ok) throw new Error("Failed to fetch encounter codes")
      return res.json()
    }
  })

  const encounterCodes = codesData?.encounter_codes || []
  const pagination = codesData?.pagination

  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEnrolleeSearch(enrolleeSearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [enrolleeSearchTerm])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.enrollee-search-container')) {
        setShowEnrolleeResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch enrollees for search
  const { data: enrolleesData } = useQuery({
    queryKey: ["enrollees", debouncedEnrolleeSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedEnrolleeSearch) {
        params.append('search', debouncedEnrolleeSearch)
      }
      const res = await fetch(`/api/call-centre/enrollees?${params}`)
      if (!res.ok) throw new Error("Failed to fetch enrollees")
      return res.json()
    },
    enabled: showGenerateModal,
  })






  // Handle search
  const handleSearch = (value: string) => {
    setSearch(value)
    setCurrentPage(1) // Reset to first page when searching
  }

  // Handle status filter
  const handleStatusChange = (value: string) => {
    setStatus(value === "all" ? "" : value)
    setCurrentPage(1) // Reset to first page when filtering
  }

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // Handle export
  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Exporting encounter codes to Excel...",
    })
    // TODO: Implement export functionality
  }

  // Handle view details
  const handleViewDetails = (codeId: string) => {
    // TODO: Implement view details modal or navigation
    toast({
      title: "View Details",
      description: `Viewing details for code ${codeId}`,
    })
  }

  // Selection handlers
  const handleSelectEnrollee = (enrollee: any) => {
    setSelectedEnrollee(enrollee)
    setFormData(prev => ({
      ...prev,
      enrollee_id: enrollee.enrollee_id,
      enrollee_name: enrollee.name || `${enrollee.first_name || ''} ${enrollee.last_name || ''}`.trim(),
      organization: typeof enrollee.organization === 'string' ? enrollee.organization : enrollee.organization?.name || '',
      plan: typeof enrollee.plan === 'string' ? enrollee.plan : enrollee.plan?.name || ''
    }))
    setEnrolleeSearchTerm(enrollee.name || `${enrollee.first_name || ''} ${enrollee.last_name || ''}`.trim())
    setShowEnrolleeResults(false)
  }



  // Generate code mutation
  const generateCodeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/call-centre/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to generate code')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Encounter code generated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["encounter-codes"] })
      setShowGenerateModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate code",
        variant: "destructive",
      })
    }
  })

  const resetForm = () => {
    setFormData({
      enrollee_id: "",
      enrollee_name: "",
      organization: "",
      plan: ""
    })
    setSelectedEnrollee(null)
    setEnrolleeSearchTerm("")
  }

  const handleGenerateCode = () => {
    if (!formData.enrollee_id || !formData.enrollee_name) {
      toast({
        title: "Validation Error",
        description: "Please select an enrollee",
        variant: "destructive",
      })
      return
    }

    const approvalData = {
      enrollee_id: formData.enrollee_id,
      enrollee_name: formData.enrollee_name,
      organization: formData.organization,
      plan: formData.plan
    }

    generateCodeMutation.mutate(approvalData)
  }

  // Get status badge color for encounter codes
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "NEW": return "bg-blue-100 text-blue-800"
      case "USED": return "bg-orange-100 text-orange-800"
      case "EXPIRED": return "bg-yellow-100 text-yellow-800"
      case "CANCELLED": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <PermissionGate module="call-centre" action="view">
      <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manage Encounter Codes</h1>
            <p className="text-gray-600 mt-1">View and manage all generated encounter codes</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={() => setShowGenerateModal(true)}
              className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Generate New Code
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by code, enrollee, hospital..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="USED">Used</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Results Count */}
              <div className="flex items-center text-sm text-gray-600">
                {pagination && (
                  <>
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} codes
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Encounter Codes Table */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Encounter Codes</CardTitle>
            <CardDescription>
              All generated encounter codes with their current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">ENCOUNTER CODE</TableHead>
                      <TableHead className="text-xs">ENROLLEE</TableHead>
                      <TableHead className="text-xs">ORGANIZATION</TableHead>
                      <TableHead className="text-xs">STATUS</TableHead>
                      <TableHead className="text-xs">GENERATED BY</TableHead>
                      <TableHead className="text-xs">DATE</TableHead>
                      <TableHead className="text-right text-xs">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {encounterCodes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                          No encounter codes found
                        </TableCell>
                      </TableRow>
                    ) : (
                      encounterCodes.map((code: any) => (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span>{code.encounter_code}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(code.encounter_code)
                                  toast({
                                    title: "Copied!",
                                    description: "Encounter code copied to clipboard",
                                  })
                                }}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>
                              <div className="font-medium">{code.enrollee_name}</div>
                              <div className="text-xs text-gray-500">{code.enrollee_id}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>
                              <div className="font-medium">{code.organization}</div>
                              <div className="text-xs text-gray-500">{code.plan}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(code.status)}`}>
                              {code.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{code.generated_by}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(code.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(code.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
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
            )}

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {pagination.pages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === pagination.pages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generate Code Modal */}
        <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-blue-600 text-xl">Generate Encounter Code</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Enrollee Selection */}
              <div className="relative enrollee-search-container">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Enrollee Name *</label>
                <div className="relative">
                  <Input
                    placeholder="Search by name, ID, phone..."
                    value={enrolleeSearchTerm}
                    onChange={(e) => setEnrolleeSearchTerm(e.target.value)}
                    onFocus={() => setShowEnrolleeResults(true)}
                    className="pr-20"
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  {selectedEnrollee && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEnrollee(null)
                        setFormData(prev => ({ ...prev, enrollee_id: "", enrollee_name: "", organization: "", plan: "" }))
                        setEnrolleeSearchTerm("")
                      }}
                      className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Enrollee Search Results */}
                {showEnrolleeResults && enrolleesData && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {(!enrolleesData.enrollees?.length) ? (
                      <div className="p-3 text-sm text-gray-500">No enrollees found</div>
                    ) : (
                      enrolleesData.enrollees.map((enrollee: any) => (
                        <div
                          key={`${enrollee.type}-${enrollee.id}`}
                          onClick={() => handleSelectEnrollee(enrollee)}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">
                                {enrollee.name}
                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                                  enrollee.type === 'Dependent'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>{enrollee.type?.toUpperCase()}</span>
                              </div>
                              <div className="text-sm text-gray-500">ID: {enrollee.enrollee_id}</div>
                              {enrollee.type === 'Dependent' && enrollee.principal_id && (
                                <div className="text-sm text-gray-500">Principal ID: {enrollee.principal_id}</div>
                              )}
                              <div className="text-sm text-gray-500">{enrollee.organization}</div>
                            </div>
                            <StatusIndicator status="ACTIVE" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>



              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowGenerateModal(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateCode}
                  disabled={generateCodeMutation.isPending}
                  className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
                >
                  {generateCodeMutation.isPending ? "Generating..." : "Generate Code"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </PermissionGate>
  )
}
