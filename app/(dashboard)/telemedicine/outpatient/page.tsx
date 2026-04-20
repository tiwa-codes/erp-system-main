"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  Plus,
  FileText
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"



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

export default function OutpatientPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") || "")
  const [selectedStatus, setSelectedStatus] = useState(() => searchParams.get("status") || "all")
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

    if (selectedStatus !== "all") {
      params.set("status", selectedStatus)
    }

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [currentPage, pathname, router, searchTerm, selectedStatus])

  const getTimelineUrl = (appointment: Appointment) => {
    const patientId = appointment.is_dependent && appointment.dependent_id
      ? appointment.dependent_id
      : appointment.principal_account_id

    // Build the full URL string for navigation back - properly encode search params
    const currentUrl = searchParams.toString() 
      ? `${pathname}?${searchParams.toString()}` 
      : pathname
    
    const params = new URLSearchParams({
      type: appointment.is_dependent ? "dependent" : "principal",
      returnTo: currentUrl
    })

    return `/telemedicine/patient-timeline/${patientId}?${params.toString()}`
  }

  // Fetch appointments
  const { data: appointmentsData, isLoading, refetch } = useQuery({
    queryKey: ["telemedicine-appointments", currentPage, limit, searchTerm, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      })
      
      const res = await fetch(`/api/telemedicine/appointments?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch appointments")
      }
      return res.json()
    },
  })

  const appointments = appointmentsData?.appointments || []
  const pagination = appointmentsData?.pagination

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800'
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      case 'NO_SHOW':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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
            <h1 className="text-3xl font-bold text-gray-900">Outpatients</h1>
            <p className="text-gray-600">Manage scheduled appointments and document enrollee interactions</p>
          </div>
          <PermissionGate module="telemedicine" action="add">
            <Button 
              onClick={() => router.push("/telemedicine/scheduled-appointment")}
              className="bg-[#BE1522] hover:bg-[#9B1219]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Schedule Appointment
            </Button>
          </PermissionGate>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="NO_SHOW">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  placeholder="dd-mm-yy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  placeholder="dd-mm-yy"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleFilterChange} className="bg-[#BE1522] hover:bg-[#9B1219]">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Outpatients</CardTitle>
            <CardDescription>Manage appointments and document enrollee interactions</CardDescription>
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
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">APPOINTMENT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REASON</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SPECIALIZATION</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((appointment: Appointment) => (
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
                          <Badge className={getStatusBadgeColor(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(getTimelineUrl(appointment))}
                            className="flex items-center gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            View Timeline
                          </Button>
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

      </div>
    </PermissionGate>
  )
}
