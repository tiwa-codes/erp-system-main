"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  ArrowLeft, 
  Download, 
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react"
import {

export const dynamic = 'force-dynamic'
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ClaimService {
  id: string
  enrollee: string
  enrolleeId: string
  service: string
  approvalCode: string
  amount: number
  status: string
  date: string
}

export default function AuditProviderPage() {
  const router = useRouter()
  const params = useParams()
  const providerId = params.providerId as string
  
  // Fetch provider details
  const { data: providerData } = useQuery({
    queryKey: ["provider", providerId],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${providerId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider details")
      }
      return res.json()
    },
  })

  const provider = providerData?.provider
  
  // Mock data for the provider detail view
  const [claimServices] = useState<ClaimService[]>([
    {
      id: "1",
      enrollee: "John Doe",
      enrolleeId: "ENR001",
      service: "Consultation",
      approvalCode: "APR/2025/07/23",
      amount: 4000,
      status: "Pending",
      date: "23/07/2025"
    },
    {
      id: "2",
      enrollee: "Jane Smith",
      enrolleeId: "ENR002",
      service: "Lab Test",
      approvalCode: "APR/2025/07/24",
      amount: 15000,
      status: "Vetted",
      date: "24/07/2025"
    },
    {
      id: "3",
      enrollee: "Mike Johnson",
      enrolleeId: "ENR003",
      service: "Surgery",
      approvalCode: "APR/2025/07/25",
      amount: 250000,
      status: "Rejected",
      date: "25/07/2025"
    },
    {
      id: "4",
      enrollee: "Sarah Wilson",
      enrolleeId: "ENR004",
      service: "X-Ray",
      approvalCode: "APR/2025/07/26",
      amount: 8000,
      status: "Audited",
      date: "26/07/2025"
    }
  ])

  const getStatusTextColor = (status: string) => {
    if (status === 'Vetted') {
      return 'text-green-600'
    }
    if (status === 'Rejected') {
      return 'text-red-600'
    }
    if (status === 'Audited') {
      return 'text-blue-600'
    }
    return 'text-yellow-600' // Pending
  }

  const getActionDropdown = (claim: ClaimService) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => {}}>
            View
          </DropdownMenuItem>
          {claim.status === 'Pending' && (
            <DropdownMenuItem onClick={() => {}}>
              Audit
            </DropdownMenuItem>
          )}
          {claim.status === 'Rejected' && (
            <DropdownMenuItem onClick={() => {}}>
              Review
            </DropdownMenuItem>
          )}
          {claim.status === 'Vetted' && (
            <DropdownMenuItem onClick={() => {}}>
              Audit
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Audit Overview &gt;&gt; {provider?.facility_name || 'Loading...'}
            </h1>
            <p className="text-gray-600">View and audit claims for this provider</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => {}} className="bg-green-600 hover:bg-green-700">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={() => {}} className="bg-red-600 hover:bg-red-700">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle>Claims Details</CardTitle>
          <CardDescription>All claims for this provider</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">APPROVAL CODE</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claimServices.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="text-xs">
                    {claim.date}
                  </TableCell>
                  <TableCell className="text-xs">
                    {claim.enrollee}
                  </TableCell>
                  <TableCell className="text-xs">
                    {claim.enrolleeId}
                  </TableCell>
                  <TableCell className="text-xs">
                    {claim.service}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {claim.approvalCode}
                  </TableCell>
                  <TableCell className="text-xs">
                    ₦{claim.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={`${getStatusTextColor(claim.status)} text-xs`}>
                      {claim.status === 'SUBMITTED' ? 'Pending' : 
                       claim.status === 'UNDER_REVIEW' ? 'Under Review' :
                       claim.status === 'VETTING' ? 'Vetted' :
                       claim.status === 'AUDITED' ? 'Audited' :
                       claim.status === 'APPROVED' ? 'Approved' :
                       claim.status === 'REJECTED' ? 'Rejected' :
                       claim.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getActionDropdown(claim)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600">
              Showing 1 to 4 of 4 results
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <span className="text-sm">
                Page 1 of 1
              </span>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
