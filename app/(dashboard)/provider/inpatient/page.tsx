"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Search, 
  Filter, 
  Eye, 
  Edit,
  Trash2,
  Plus,
  Download,
  Building2,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MoreHorizontal
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { MetricCard } from "@/components/ui/metric-card"
import { AddInPatientForm } from "@/components/forms/add-inpatient-form"
import { ViewInPatientModal } from "@/components/forms/view-inpatient-form"
import { EditInPatientModal } from "@/components/forms/edit-inpatient-form"



interface InPatient {
  id: string
  patient_id: string
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string[]
  }
  admission_date: string
  discharge_date?: string
  diagnosis?: string
  treatment?: string
  status: string
  created_at: string
}

export default function InPatientManagementPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedInPatientId, setSelectedInPatientId] = useState<string | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch in-patients
  const { data: inPatientsData, isLoading } = useQuery({
    queryKey: ["in-patients", currentPage, limit, debouncedSearchTerm, selectedProvider, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      })
      
      const res = await fetch(`/api/providers/in-patients?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch in-patients")
      }
      return res.json()
    },
  })

  // Fetch providers for filter
  const { data: providersData } = useQuery({
    queryKey: ["active-providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers/active")
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  // Fetch in-patient metrics
  const { data: metricsData } = useQuery({
    queryKey: ["in-patient-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/providers/in-patients/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch in-patient metrics")
      }
      return res.json()
    },
  })

  const inPatients = inPatientsData?.in_patients || []
  const pagination = inPatientsData?.pagination
  const providers = providersData?.providers || []
  const metrics = metricsData || {
    total_admissions: 0,
    current_admissions: 0,
    discharged_today: 0,
    average_length_of_stay: 0
  }

  // Delete in-patient mutation
  const deleteInPatientMutation = useMutation({
    mutationFn: async (inPatientId: string) => {
      const res = await fetch(`/api/providers/in-patients/${inPatientId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error("Failed to delete in-patient record")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "In-patient record deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["in-patients"] })
      queryClient.invalidateQueries({ queryKey: ["in-patient-metrics"] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete in-patient record",
        variant: "destructive",
      })
    },
  })

  const handleDeleteInPatient = (inPatientId: string, patientId: string) => {
    if (window.confirm(`Are you sure you want to delete in-patient record for ${patientId}?`)) {
      deleteInPatientMutation.mutate(inPatientId)
    }
  }

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle export
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params = new URLSearchParams({
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        format
      })
      
      const res = await fetch(`/api/providers/in-patients/export?${params}`)
      if (!res.ok) {
        throw new Error(`Failed to export ${format}`)
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `in-patients-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Success",
        description: `${format.toUpperCase()} report exported successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to export ${format}`,
        variant: "destructive",
      })
    }
  }

  const handleView = (id: string) => {
    setSelectedInPatientId(id)
    setShowViewModal(true)
  }

  const handleEdit = (id: string) => {
    setSelectedInPatientId(id)
    setShowEditModal(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this in-patient record?")) {
      try {
        const res = await fetch(`/api/providers/in-patients/${id}`, {
          method: "DELETE",
        })

        if (!res.ok) {
          throw new Error("Failed to delete in-patient record")
        }

        toast({
          title: "Success",
          description: "In-patient record deleted successfully",
        })
        queryClient.invalidateQueries({ queryKey: ["in-patients"] })
        queryClient.invalidateQueries({ queryKey: ["in-patient-metrics"] })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete in-patient record",
          variant: "destructive",
        })
      }
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'admitted':
        return 'bg-blue-100 text-blue-800'
      case 'discharged':
        return 'bg-green-100 text-green-800'
      case 'transferred':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate length of stay
  const calculateLengthOfStay = (admissionDate: string, dischargeDate?: string) => {
    const admission = new Date(admissionDate)
    const discharge = dischargeDate ? new Date(dischargeDate) : new Date()
    const diffTime = Math.abs(discharge.getTime() - admission.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">In-patient Management</h1>
            <p className="text-gray-600">Manage in-patient admissions and records</p>
          </div>
          <PermissionGate module="provider" action="add">
            <Button onClick={() => setShowAddModal(true)} className="bg-[#BE1522] hover:bg-[#9B1219]">
              <Plus className="h-4 w-4 mr-2" />
              Add In-patient
            </Button>
          </PermissionGate>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Admissions"
            value={metrics.total_admissions}
            icon={Users}
            trend={{ value: 15, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Current Admissions"
            value={metrics.current_admissions}
            icon={Building2}
            trend={{ value: 8, isPositive: true }}
            description="vs last month"
          />
          <MetricCard
            title="Discharged Today"
            value={metrics.discharged_today}
            icon={CheckCircle}
            trend={{ value: 5, isPositive: true }}
            description="vs yesterday"
          />
          <MetricCard
            title="Avg. Length of Stay"
            value={`${metrics.average_length_of_stay} days`}
            icon={Clock}
            trend={{ value: 2, isPositive: false }}
            description="vs last month"
          />
        </div>

        {/* Filters */}
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-1">
                <Input
                  placeholder="Search by patient ID"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <Select value={selectedProvider} onValueChange={(value) => {
                  setSelectedProvider(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.map((provider: any) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.facility_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={selectedStatus} onValueChange={(value) => {
                  setSelectedStatus(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ADMITTED">Admitted</SelectItem>
                    <SelectItem value="DISCHARGED">Discharged</SelectItem>
                    <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleFilterChange} className="bg-[#BE1522] hover:bg-[#9B1219] text-white">
                <Filter className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* In-patients Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>In-patient Records</CardTitle>
                <CardDescription className="mt-2">Manage in-patient admissions and discharges</CardDescription>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">PATIENT ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ADMISSION DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DISCHARGE DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">LENGTH OF STAY</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DIAGNOSIS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inPatients.map((inPatient: InPatient) => (
                      <TableRow key={inPatient.id}>
                        <TableCell className="font-medium">{inPatient.patient_id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-red-400">
                                {inPatient.provider.facility_name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{inPatient.provider.facility_name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(inPatient.admission_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {inPatient.discharge_date ? 
                            new Date(inPatient.discharge_date).toLocaleDateString() : 
                            "---"
                          }
                        </TableCell>
                        <TableCell>
                          {calculateLengthOfStay(inPatient.admission_date, inPatient.discharge_date)} days
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {inPatient.diagnosis || "---"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-900">
                            {inPatient.status.replace('_', ' ').charAt(0).toUpperCase() + inPatient.status.replace('_', ' ').slice(1).toLowerCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <PermissionGate module="provider" action="view">
                                <DropdownMenuItem 
                                  onClick={() => handleView(inPatient.id)}
                                  className="w-full justify-start text-xs"
                                >
                                  View
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="provider" action="edit">
                                <DropdownMenuItem 
                                  onClick={() => handleEdit(inPatient.id)}
                                  className="w-full justify-start text-xs"
                                >
                                  Edit
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="provider" action="delete">
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(inPatient.id)}
                                  className="text-red-600 w-full justify-start text-xs"
                                >
                                  Delete
                                </DropdownMenuItem>
                              </PermissionGate>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

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

        {/* Add In-Patient Modal */}
        <AddInPatientForm 
          isOpen={showAddModal} 
          onClose={() => setShowAddModal(false)} 
        />

        {/* View In-Patient Modal */}
        <ViewInPatientModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false)
            setSelectedInPatientId(null)
          }}
          inpatientId={selectedInPatientId}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Edit In-Patient Modal */}
        <EditInPatientModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedInPatientId(null)
          }}
          inpatientId={selectedInPatientId}
        />
      </div>
    </PermissionGate>
  )
}
