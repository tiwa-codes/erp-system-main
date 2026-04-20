"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  ArrowLeft,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Shield,
  Search,
  MoreHorizontal,
  X
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import {


  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Claim {
  id: string
  claim_number: string
  enrollee_id: string
  principal_id?: string
  principal?: {
    id: string
    first_name: string
    last_name: string
    enrollee_id: string
  }
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string[]
  }
  claim_type: string
  amount: number
  status: string
  submitted_at: string
  processed_at?: string
}

interface ClaimService {
  id: string
  service_name: string
  amount: number
  status: string
  approval_code: string
}

export default function Vetter1ProviderDetailsPage({ params }: { params: { providerId: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const { providerId } = params
  
  const [selectedClaimForModal, setSelectedClaimForModal] = useState<Claim | null>(null)
  const [showClaimDetailsModal, setShowClaimDetailsModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 10

  // Fetch provider details
  const { data: providerData, isLoading: providerLoading } = useQuery({
    queryKey: ["provider", providerId],
    queryFn: async () => {
      const res = await fetch(`/api/providers/${providerId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider details")
      }
      return res.json()
    },
  })

  const provider = providerData

  // Fetch all claims for this provider
  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ["provider-claims", providerId],
    queryFn: async () => {
      const params = new URLSearchParams({
        provider: providerId,
        limit: '100' // Get all claims for this provider
      })
      
      const res = await fetch(`/api/claims/vetter1?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider claims")
      }
      return res.json()
    },
  })

  const claims = claimsData?.claims || []

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'text-gray-600'
    
    switch (status.toLowerCase()) {
      case 'submitted':
      case 'under_review':
        return 'text-yellow-600'
      case 'vetting':
        return 'text-blue-600'
      case 'approved':
        return 'text-green-600'
      case 'rejected':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  // Get action dropdown for individual claim
  const getActionDropdown = (claim: Claim) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem 
            onClick={() => router.push(`/claims/vetter1/${claim.id}`)}
            className="w-full justify-start text-xs"
          >
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => router.push(`/claims/vetter1/${claim.id}`)}
            className="w-full justify-start text-xs"
          >
            Vet Claim
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => router.push(`/operation-desk/audit-claim/${claim.id}`)}
            className="w-full justify-start text-xs"
          >
            Audit Claim
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Excel file is being generated...",
    })
  }

  if (providerLoading || claimsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
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
                  Claims Overview {'>>'} {provider.facility_name}
                </h1>
                <p className="text-gray-600">View and manage claims for this provider</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleExport} 
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
          </div>
        </div>

          {/* Claims Table */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Claims</CardTitle>
              <CardDescription>
                All claims for {provider.facility_name} ({claims.length} claims)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-gray-600">CLAIM ID</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                    <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim: any) => (
                    <TableRow key={claim.id}>
                      <TableCell className="font-medium">
                        {claim.claim_number}
                      </TableCell>
                      <TableCell>
                        {claim.enrollee_name || (claim.principal ? 
                          `${claim.principal.first_name} ${claim.principal.last_name}` : 
                          'Unknown Enrollee'
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {claim.enrollee_id}
                      </TableCell>
                      <TableCell>
                        ₦{claim.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={getStatusBadgeColor(claim.status)}>
                          {claim.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(claim.submitted_at).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell>
                        {getActionDropdown(claim)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-gray-600">
                  Showing {claims.length} results
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {Math.ceil(claims.length / limit)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= Math.ceil(claims.length / limit)}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
      </div>
    </PermissionGate>
  )
}
