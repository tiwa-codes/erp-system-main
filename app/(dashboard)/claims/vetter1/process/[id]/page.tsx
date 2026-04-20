"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  FileText,
  DollarSign,
  User,
  Calendar,
  Building,
  CreditCard
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { PriceEditor } from "@/components/claims/PriceEditor"

export const dynamic = 'force-dynamic'

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

interface ClaimedService {
  id: string
  service_name: string
  claimed_band: string
  allowed_band: string
  verdict: 'COVERED' | 'NOT_COVERED'
  claimed_amount: number
  tariff_amount: number
  price_verdict: 'MATCH' | 'ABOVE_TARIFF' | 'BELOW_TARIFF'
}

export default function Vetter1ProcessPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  
  const claimId = params.id as string
  
  // State for vetting form
  const [vettingComments, setVettingComments] = useState("")
  const [vettingOutcome, setVettingOutcome] = useState("")
  const [claimedServices, setClaimedServices] = useState<ClaimedService[]>([])

  // Check if user is Claims Processor (can edit price)
  const userRole = session?.user?.role
  const canEditPrice = userRole === 'CLAIMS_PROCESSOR' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN'

  // Fetch claim details
  const { data: claimData, isLoading } = useQuery({
    queryKey: ["claim-details", claimId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch claim details")
      }
      return res.json()
    },
  })

  const claim = claimData?.claim

  // Mock claimed services data (replace with real API call)
  useEffect(() => {
    if (claim) {
      setClaimedServices([
        {
          id: "1",
          service_name: "Appendectomy",
          claimed_band: "Band A",
          allowed_band: "Band C",
          verdict: "NOT_COVERED",
          claimed_amount: 120000,
          tariff_amount: 100000,
          price_verdict: "ABOVE_TARIFF"
        },
        {
          id: "2",
          service_name: "Admission (2 days)",
          claimed_band: "Band A",
          allowed_band: "Band C",
          verdict: "COVERED",
          claimed_amount: 30000,
          tariff_amount: 30000,
          price_verdict: "MATCH"
        },
        {
          id: "3",
          service_name: "Wound Dressing",
          claimed_band: "Band A",
          allowed_band: "Band C",
          verdict: "COVERED",
          claimed_amount: 15000,
          tariff_amount: 12000,
          price_verdict: "ABOVE_TARIFF"
        },
        {
          id: "4",
          service_name: "Lab Test - LFT",
          claimed_band: "Band A",
          allowed_band: "Not in Plan",
          verdict: "NOT_COVERED",
          claimed_amount: 25000,
          tariff_amount: 20000,
          price_verdict: "ABOVE_TARIFF"
        }
      ])
    }
  }, [claim])

  // Submit vetting mutation
  const submitVettingMutation = useMutation({
    mutationFn: async (vettingData: any) => {
      const res = await fetch(`/api/claims/${claimId}/vet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vettingData),
      })
      if (!res.ok) {
        throw new Error("Failed to submit vetting")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Vetting decision submitted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["claim-details"] })
      queryClient.invalidateQueries({ queryKey: ["vetter1-claims"] })
      // Redirect to enrollee list for this provider instead of main vetter page
      if (claim?.provider_id) {
        router.push(`/claims/vetter1/${claim.provider_id}`)
      } else {
        router.push("/claims/vetter1")
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit vetting decision",
        variant: "destructive",
      })
    },
  })

  const handleSubmitVetting = () => {
    if (!vettingOutcome) {
      toast({
        title: "Error",
        description: "Please select a vetting outcome",
        variant: "destructive",
      })
      return
    }

    submitVettingMutation.mutate({
      outcome: vettingOutcome,
      comments: vettingComments,
      services: claimedServices
    })
  }

  // Handle coverage verdict change
  const handleCoverageVerdictChange = (serviceId: string, verdict: 'COVERED' | 'NOT_COVERED') => {
    setClaimedServices(prev => 
      prev.map(service => 
        service.id === serviceId 
          ? { ...service, verdict }
          : service
      )
    )
  }

  // Handle price verdict change
  const handlePriceVerdictChange = (serviceId: string, verdict: 'MATCH' | 'ABOVE_TARIFF' | 'BELOW_TARIFF') => {
    setClaimedServices(prev => 
      prev.map(service => 
        service.id === serviceId 
          ? { ...service, price_verdict: verdict }
          : service
      )
    )
  }

  // Get verdict dropdown
  const getVerdictDropdown = (serviceId: string, verdict: string) => {
        return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto p-1">
            <div className="flex items-center">
              {verdict === 'COVERED' ? (
          <div className="flex items-center text-green-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>✓ Covered</span>
          </div>
              ) : (
          <div className="flex items-center text-red-600">
            <XCircle className="h-4 w-4 mr-1" />
            <span>✗ Not Covered</span>
                </div>
              )}
            <ChevronDown className="h-3 w-3 ml-1" />
          </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem 
            onClick={() => handleCoverageVerdictChange(serviceId, 'COVERED')}
            className="w-full justify-start text-xs"
          >
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Covered
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleCoverageVerdictChange(serviceId, 'NOT_COVERED')}
            className="w-full justify-start text-xs"
          >
            <XCircle className="h-4 w-4 mr-2 text-red-600" />
            Not Covered
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Get price verdict dropdown
  const getPriceVerdictDropdown = (serviceId: string, verdict: string) => {
        return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto p-1">
            <div className="flex items-center">
              {verdict === 'MATCH' ? (
          <div className="flex items-center text-green-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>✓ Match</span>
          </div>
              ) : verdict === 'ABOVE_TARIFF' ? (
          <div className="flex items-center text-orange-600">
            <AlertTriangle className="h-4 w-4 mr-1" />
            <span>! Above Tariff</span>
          </div>
              ) : (
          <div className="flex items-center text-blue-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>✓ Below Tariff</span>
                </div>
              )}
            <ChevronDown className="h-3 w-3 ml-1" />
          </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem 
            onClick={() => handlePriceVerdictChange(serviceId, 'MATCH')}
            className="w-full justify-start text-xs"
          >
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Match
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handlePriceVerdictChange(serviceId, 'ABOVE_TARIFF')}
            className="w-full justify-start text-xs"
          >
            <AlertTriangle className="h-4 w-4 mr-2 text-orange-600" />
            Above Tariff
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Claim Not Found</h2>
          <p className="text-gray-600 mb-4">The requested claim could not be found.</p>
          <Button onClick={() => router.push("/claims/vetter1")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vetter 1
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate module="claims" action="vet">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                // Go back to enrollee list for this provider
                if (claim?.provider_id) {
                  router.push(`/claims/vetter1/${claim.provider_id}`)
                } else {
                  router.push("/claims/vetter1")
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vetter 1 - Claims Processing</h1>
              <p className="text-gray-600">Comprehensive claim validation and vetting</p>
            </div>
          </div>
        </div>

        {/* Claim Header Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Claim Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Approval Code</span>
                </div>
                <p className="text-lg font-semibold">{claim.claim_number || 'APR1234567'}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Enrollee</span>
                </div>
                <p className="text-lg font-semibold">
                  {claim.principal ? 
                    `${claim.principal.first_name} ${claim.principal.last_name} (${claim.principal.enrollee_id})` : 
                    `${claim.enrollee_id}`
                  }
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Claim ID</span>
                </div>
                <p className="text-lg font-semibold">{claim.id}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Hospital</span>
                </div>
                <p className="text-lg font-semibold">{claim.provider?.facility_name || 'Limi Hospital'}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Date of Submission</span>
                </div>
                <p className="text-lg font-semibold">{new Date(claim.submitted_at).toLocaleDateString('en-GB')}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Plan Type</span>
                </div>
                <p className="text-lg font-semibold">Basic Family</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Service Type</span>
                </div>
                <p className="text-lg font-semibold">{claim.claim_type || 'Lab'}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Plan Band</span>
                </div>
                <p className="text-lg font-semibold">Band C</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claimed Services vs Plan Coverage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              Claimed Services vs Plan Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">Service</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">Claimed Band</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">Allowed Band</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">Verdict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimedServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.service_name}</TableCell>
                    <TableCell>{service.claimed_band}</TableCell>
                    <TableCell>{service.allowed_band}</TableCell>
                    <TableCell>{getVerdictDropdown(service.id, service.verdict)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Price Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Price Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">Service</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">Claimed Amount</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">Tariff Amount</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">Verdict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimedServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.service_name}</TableCell>
                    <TableCell>₦{service.claimed_amount.toLocaleString()}</TableCell>
                    <TableCell>₦{service.tariff_amount.toLocaleString()}</TableCell>
                    <TableCell>{getPriceVerdictDropdown(service.id, service.price_verdict)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Price Editor - Only visible for Claims Processor */}
        {canEditPrice && claim && (
          <PriceEditor
            claimId={claimId}
            currentAmount={claim.amount}
            originalAmount={claim.amount}
            onSave={(newAmount, reason) => {
              // Refresh claim data after price update
              queryClient.invalidateQueries({ queryKey: ["claim-details", claimId] })
              toast({
                title: "Success",
                description: "Price updated successfully",
              })
            }}
            canEdit={canEditPrice}
            stage="vetter1"
          />
        )}

        {/* Vetting Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Vetter 1 Comments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add your remarks, red flags or clarifications."
              value={vettingComments}
              onChange={(e) => setVettingComments(e.target.value)}
              className="min-h-[120px]"
            />
          </CardContent>
        </Card>

        {/* Final Vetting Action */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              Final Vetter 1 Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Select value={vettingOutcome} onValueChange={setVettingOutcome}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="--Select Vetter 1 Outcome--" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">Approve</SelectItem>
                  <SelectItem value="REJECTED">Reject</SelectItem>
                  <SelectItem value="FLAGGED">Flag for Investigation</SelectItem>
                  <SelectItem value="PENDING_MORE_INFO">Pending More Information</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                onClick={handleSubmitVetting}
                disabled={submitVettingMutation.isPending || !vettingOutcome}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitVettingMutation.isPending ? "Submitting..." : "Submit Vetter 1 Decision"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
