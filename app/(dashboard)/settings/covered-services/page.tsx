"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusIndicator } from "@/components/ui/status-indicator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  Shield,
  Upload,
  DollarSign,
  ArrowRight,
  MoreHorizontal,
  XCircle,
  Building2,
  Users
} from "lucide-react"
import Link from "next/link"

export const dynamic = 'force-dynamic'

interface Facility {
  id: string
  facility_name: string
  hcp_code: string
  address: string
  phone_number: string
  email: string
  status: "ACTIVE" | "INACTIVE"
  created_at: string
  _count: {
    plan_bands: number
  }
}

export default function CoveredServicesPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch facilities with covered services count
  const { data: facilitiesData, isLoading } = useQuery({
    queryKey: ["facilities-with-services", currentPage, pageSize, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm
      })
      const res = await fetch(`/api/providers?${params}`)
      if (!res.ok) throw new Error("Failed to fetch facilities")
      return res.json()
    },
  })

  const facilities: Facility[] = facilitiesData?.providers || []
  const pagination = facilitiesData?.pagination || {
    page: currentPage,
    limit: pageSize,
    total: facilitiesData?.totalCount || 0,
    pages: Math.ceil((facilitiesData?.totalCount || 0) / pageSize)
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Covered Services</h1>
          <p className="text-gray-600 mt-1">Manage services covered by facilities</p>
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
          <Link href="/settings/covered-services/assign">
            <Button className="bg-[#BE1522] hover:bg-[#9B1219]">
              <Plus className="h-4 w-4 mr-2" />
              Assign Services
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search facilities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Facilities Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Facilities
          </CardTitle>
          <CardDescription className="mt-2">
            Select a facility to view and manage its covered services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">FACILITY NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">HCP CODE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ADDRESS</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">CONTACT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">PLANS</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facilities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No facilities found.
                    </TableCell>
                  </TableRow>
                ) : (
                  facilities.map((facility) => (
                    <TableRow key={facility.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-red-400">
                              {facility.facility_name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-900">{facility.facility_name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">{facility.hcp_code}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 max-w-xs truncate">
                          {facility.address}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-gray-900">{facility.phone_number}</div>
                          <div className="text-gray-500">{facility.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-gray-900">{facility._count?.plan_bands || 0}</span>
                          <span className="text-sm text-gray-500">plans</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={facility.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link 
                                href={`/settings/covered-services/facility/${facility.id}`}
                                className="w-full justify-start text-xs"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Plans
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link 
                                href={`/settings/covered-services/assign?facility=${facility.id}`}
                                className="w-full justify-start text-xs"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Services
                              </Link>
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

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        module="settings"
        submodule="covered-services"
        onUploadSuccess={() => {}}
        uploadEndpoint="/api/settings/bulk-upload"
        sampleFileName="covered-services-sample.xlsx"
        acceptedColumns={["Plan Name (or ID)", "Facility Name (or ID)", "Service Name (or ID)", "Facility Price", "Limit Count"]}
        maxFileSize={200}
      />
    </div>
  )
}
