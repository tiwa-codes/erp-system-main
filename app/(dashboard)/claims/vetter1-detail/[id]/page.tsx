"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  ArrowLeft,
  Download,
  MoreVertical,
  Eye,
  Phone,
  MapPin,
  Calendar
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import {

export const dynamic = 'force-dynamic'
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface PrincipalData {
  id: string
  enrollee_id: string
  first_name: string
  last_name: string
  phone_number: string
  date_of_birth: string
  gender: string
  residential_address: string
  email: string
  organization: {
    id: string
    name: string
    code: string
  }
  plan: {
    id: string
    name: string
  }
  status: string
  created_at: string
  _count: {
    dependents: number
    claims: number
  }
}

export default function Vetter1DetailPage() {
  const router = useRouter()
  const params = useParams()
  const providerId = params.id as string
  
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Fetch provider information
  const { data: providerData, isLoading: providerLoading } = useQuery({
    queryKey: ["provider", providerId],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${providerId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider")
      }
      return res.json()
    },
  })

  // Fetch principals (enrollees) 
  const { data: principalsData, isLoading: principalsLoading } = useQuery({
    queryKey: ["principals", currentPage, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })
      
      const res = await fetch(`/api/underwriting/principals?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch principals")
      }
      return res.json()
    },
    enabled: !!providerId
  })

  const provider = providerData
  const principals = principalsData?.principals || []
  const pagination = principalsData?.pagination

  // Handle export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        export: 'true'
      })
      
      const res = await fetch(`/api/underwriting/principals?${params}`)
      if (!res.ok) {
        throw new Error("Failed to export principals")
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `principals-${provider?.facility_name || 'provider'}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  // Get action dropdown for principal
  const getActionDropdown = (principal: PrincipalData) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => router.push(`/claims/vetter1/${principal.id}`)}>
            View Claims
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {/* Add edit functionality */}}>
            View Details
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (providerLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Provider not found</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <PermissionGate module="claims" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Vetter1 Details {'>>'} {provider.facility_name}
              </h1>
              <p className="text-gray-600">View enrollees for this provider</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleExport} 
              className="bg-green-600 hover:bg-red-600"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Provider Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Provider Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Facility Name</label>
                <p className="text-lg font-semibold">{provider.facility_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Facility Type</label>
                <p className="text-lg font-semibold">{provider.facility_type?.join(', ') || 'General'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Registration Number</label>
                <p className="text-lg font-semibold">{provider.registration_number || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Contact Phone</label>
                <p className="text-lg font-semibold flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {provider.contact_phone || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Principals Table */}
        <Card>
          <CardHeader>
            <CardTitle>Principals (Enrollees)</CardTitle>
            <CardDescription>
              List of principals for vetting reference
            </CardDescription>
          </CardHeader>
          <CardContent>
            {principalsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ENROLLEE ID</TableHead>
                      <TableHead>NAME</TableHead>
                      <TableHead>PHONE</TableHead>
                      <TableHead>DATE OF BIRTH</TableHead>
                      <TableHead>ORGANIZATION</TableHead>
                      <TableHead>PLAN</TableHead>
                      <TableHead>STATUS</TableHead>
                      <TableHead>ENROLLED</TableHead>
                      <TableHead className="text-right">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {principals.map((principal: PrincipalData) => (
                      <TableRow key={principal.id}>
                        <TableCell className="font-medium">
                          {principal.enrollee_id}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {principal.first_name} {principal.last_name}
                            </div>
                            {principal.gender && (
                              <div className="text-xs text-gray-500">
                                {principal.gender}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {principal.phone_number ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {principal.phone_number}
                            </div>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {principal.date_of_birth ? (
                            new Date(principal.date_of_birth).toLocaleDateString()
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {principal.organization?.name || <span className="text-gray-400">N/A</span>}
                        </TableCell>
                        <TableCell>
                          {principal.plan?.name || <span className="text-gray-400">N/A</span>}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            principal.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                            principal.status === 'INACTIVE' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {principal.status || 'Unknown'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(principal.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {getActionDropdown(principal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="flex items-center px-3 py-1 text-sm">
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

