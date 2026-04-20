"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useToast } from "@/hooks/use-toast"



interface Appointment {
  id: string
  enrollee_name: string
  enrollee_id: string
  principal_account_id: string
  phone_number: string
  plan: string
  appointment_type: string
  reason: string
  scheduled_date: string
  status: string
  specialization: string
  provider_name: string
  created_by: string
  created_at: string
  is_dependent?: boolean
  dependent_id?: string
}

export default function PendingBookingsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") || "")
  const [currentPage, setCurrentPage] = useState(() => {
    const page = parseInt(searchParams.get("page") || "1", 10)
    return Number.isNaN(page) || page < 1 ? 1 : page
  })
  const [limit] = useState(10)

  useEffect(() => {
    const params = new URLSearchParams()

    if (currentPage > 1) {
      params.set("page", currentPage.toString())
    }

    if (searchTerm) {
      params.set("search", searchTerm)
    }

    // Always filter by PENDING on this page
    params.set("status", "PENDING")

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [currentPage, pathname, router, searchTerm])

  const getTimelineUrl = (appointment: Appointment) => {
    const patientId = appointment.is_dependent && appointment.dependent_id
      ? appointment.dependent_id
      : appointment.principal_account_id

    const params = new URLSearchParams({
      type: appointment.is_dependent ? "dependent" : "principal",
      returnTo: pathname
    })

    return `/telemedicine/patient-timeline/${patientId}?${params.toString()}`
  }

  // Fetch PENDING appointments
  const { data: appointmentsData, isLoading, refetch } = useQuery({
    queryKey: ["telemedicine-pending-appointments", currentPage, limit, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        status: "PENDING",
        ...(searchTerm && { search: searchTerm }),
      })
      
      const res = await fetch(`/api/telemedicine/appointments?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch pending appointments")
      }
      return res.json()
    },
  })

  // Mutation for status update
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/telemedicine/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update status")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      })
      queryClient.invalidateQueries({ queryKey: ["telemedicine-pending-appointments"] })
      queryClient.invalidateQueries({ queryKey: ["sidebar-notifications"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleApprove = (id: string) => {
    updateStatusMutation.mutate({ id, status: "SCHEDULED" })
  }

  const handleReject = (id: string) => {
    if (confirm("Are you sure you want to reject this telemedicine request?")) {
      updateStatusMutation.mutate({ id, status: "CANCELLED" })
    }
  }

  const appointments = appointmentsData?.appointments || []
  const pagination = appointmentsData?.pagination

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  const getAppointmentTypeBadge = (type: string) => {
    switch (type) {
      case 'WALK_IN':
        return 'bg-green-100 text-green-800'
      case 'TELE_CONSULTATION':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="telemedicine" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pending Bookings</h1>
            <p className="text-gray-600">Review and approve telemedicine requests from mobile enrollees</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search Enrollee ID</Label>
                <div className="relative">
                  <Input
                    id="search"
                    placeholder="Search by ID"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={handleFilterChange} className="bg-[#0891B2] hover:bg-[#9B1219] w-full md:w-auto">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Telemedicine Requests</CardTitle>
            <CardDescription>Appointments requiring administrative approval</CardDescription>
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
                      <TableHead className="text-xs font-medium text-gray-600">ENROLEE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REQUEST DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">APPOINTMENT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REASON</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SPECIALIZATION</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.length > 0 ? (
                      appointments.map((appointment: Appointment) => (
                        <TableRow key={appointment.id}>
                          <TableCell>
                            <div>
                              <button
                                onClick={() => router.push(getTimelineUrl(appointment))}
                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {appointment.enrollee_name}
                              </button>
                              <div className="text-sm text-gray-500">{appointment.enrollee_id}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span>{new Date(appointment.scheduled_date).toLocaleDateString('en-GB')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(appointment.scheduled_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getAppointmentTypeBadge(appointment.appointment_type)}>
                              {appointment.appointment_type === 'WALK_IN' ? 'Walk-In' : 'Tele-consultation'}
                            </Badge>
                          </TableCell>
                          <TableCell>{appointment.reason || 'Not specified'}</TableCell>
                          <TableCell>{appointment.specialization || 'Not specified'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(appointment.id)}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                disabled={updateStatusMutation.isPending}
                              >
                                {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(appointment.id)}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                disabled={updateStatusMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No pending telemedicine requests found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
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
      </div>
    </PermissionGate>
  )
}
