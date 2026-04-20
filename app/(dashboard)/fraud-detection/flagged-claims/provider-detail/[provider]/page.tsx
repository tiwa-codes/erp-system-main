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
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  Building2,
  Shield,
  BarChart3,
  PieChart,
  MoreVertical
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"



interface ProviderRiskProfile {
  id: string
  name: string
  location: string
  flags: number
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  risk_trend: Array<{
    date: string
    last_year: number
    this_year: number
  }>
  common_rules: string[]
  claim_types_risk: Array<{
    type: string
    risk: number
  }>
  recent_claims: Array<{
    id: string
    date: string
    enrollee_name: string
    enrollee_id: string
    amount: number
    status: string
  }>
}

export default function ProviderRiskProfilePage({ params }: { params: { provider: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const { provider } = params

  // Fetch provider risk profile
  const {
    data: profileData,
    isLoading,
    error
  } = useQuery({
    queryKey: ["provider-risk-profile", provider],
    queryFn: async () => {
      const res = await fetch(`/api/claims/fraud/provider/${provider}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider risk profile")
      }
      return res.json() as Promise<ProviderRiskProfile>
    },
  })

  // Mock data for demonstration
  const mockProfile: ProviderRiskProfile = {
    id: "1",
    name: "LIMI HOSPITAL",
    location: "AMAC",
    flags: 7,
    status: "ACTIVE",
    risk_trend: [
      { date: "Jul 17", last_year: 120, this_year: 150 },
      { date: "Jul 18", last_year: 110, this_year: 140 },
      { date: "Jul 19", last_year: 100, this_year: 90 },
      { date: "Jul 20", last_year: 130, this_year: 160 },
      { date: "Jul 21", last_year: 140, this_year: 250 },
      { date: "Jul 22", last_year: 120, this_year: 180 },
      { date: "Jul 23", last_year: 220, this_year: 200 }
    ],
    common_rules: [
      "Diagnosis Pattern",
      "Diagnosis Mismatch", 
      "Invalid Diagnosis Code",
      "Duplicate claims within 30 days"
    ],
    claim_types_risk: [
      { type: "Drugs", risk: 78 },
      { type: "Laboratory", risk: 65 },
      { type: "Radiology", risk: 58 },
      { type: "Procedures", risk: 48 },
      { type: "Emergency", risk: 45 },
      { type: "Therapy", risk: 28 }
    ],
    recent_claims: [
      {
        id: "1",
        date: "09-07-2025",
        enrollee_name: "Yusuf Yusuf",
        enrollee_id: "CJH/CC/001",
        amount: 200000,
        status: "Approved"
      },
      {
        id: "2",
        date: "09-07-2025",
        enrollee_name: "Yusuf Yusuf",
        enrollee_id: "CJH/CC/001",
        amount: 200000,
        status: "Rejected"
      },
      {
        id: "3",
        date: "09-07-2025",
        enrollee_name: "Yusuf Yusuf",
        enrollee_id: "CJH/CC/001",
        amount: 200000,
        status: "Flagged"
      },
      {
        id: "4",
        date: "09-07-2025",
        enrollee_name: "Yusuf Yusuf",
        enrollee_id: "CJH/CC/001",
        amount: 200000,
        status: "Vetted"
      },
      {
        id: "5",
        date: "09-07-2025",
        enrollee_name: "Yusuf Yusuf",
        enrollee_id: "CJH/CC/001",
        amount: 200000,
        status: "Approved"
      },
      {
        id: "6",
        date: "09-07-2025",
        enrollee_name: "Yusuf Yusuf",
        enrollee_id: "CJH/CC/001",
        amount: 200000,
        status: "Rejected"
      },
      {
        id: "7",
        date: "09-07-2025",
        enrollee_name: "Yusuf Yusuf",
        enrollee_id: "CJH/CC/001",
        amount: 200000,
        status: "Flagged"
      },
      {
        id: "8",
        date: "09-07-2025",
        enrollee_name: "Yusuf Yusuf",
        enrollee_id: "CJH/CC/001",
        amount: 200000,
        status: "Vetted"
      }
    ]
  }

  const profile = profileData || mockProfile

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load provider risk profile</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'flagged':
        return 'bg-orange-100 text-orange-800'
      case 'vetted':
        return 'bg-blue-100 text-blue-800'
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'suspended':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get risk score color
  const getRiskScoreColor = (score: number) => {
    if (score >= 70) return 'bg-red-500'
    if (score >= 50) return 'bg-orange-500'
    return 'bg-green-500'
  }

  return (
    <PermissionGate module="claims" action="fraud_detection">
      <div className="space-y-6">
        {/* Header */}
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
            <h1 className="text-3xl font-bold text-gray-900">Provider Tariff Plan</h1>
            <p className="text-gray-600">Provider Tariff Plan &gt;&gt; {profile.name}</p>
          </div>
        </div>

        {/* Provider Details and Risk Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provider Details */}
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Building2 className="h-12 w-12 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Provider Name</label>
                    <p className="text-lg font-semibold">{profile.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Provider Location</label>
                    <p className="text-lg">{profile.location}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Flags</label>
                    <p className="text-lg">{profile.flags} flags</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <Badge className={getStatusBadgeColor(profile.status)}>
                      {profile.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Provider Risk Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Risk Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={profile.risk_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[50, 250]} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="last_year" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Last Year"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="this_year" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="This Year"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Most Common Triggered Rules and Claim Types Risk */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Common Triggered Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Most common triggered rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {profile.common_rules.map((rule, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-red-600 mt-1">•</span>
                    <span className="text-gray-700">{rule}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Claim Types with Highest Fraud Risk */}
          <Card>
            <CardHeader>
              <CardTitle>Claim Types with Highest Fraud Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profile.claim_types_risk} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="type" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="risk" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Previous Claims History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Previous Claims History</CardTitle>
                <CardDescription>Recent claims from this provider</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DATE</TableHead>
                  <TableHead>CLAIM ID</TableHead>
                  <TableHead>ENROLLEE ID</TableHead>
                  <TableHead>ENROLLEE NAME</TableHead>
                  <TableHead>AMOUNT</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.recent_claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>{claim.date}</TableCell>
                    <TableCell className="font-medium">CLM/LH/009</TableCell>
                    <TableCell>{claim.enrollee_id}</TableCell>
                    <TableCell>{claim.enrollee_name}</TableCell>
                    <TableCell>₦{claim.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(claim.status)}>
                        {claim.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-600">
                Showing 1 of 98 results
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  1
                </Button>
                <Button variant="outline" size="sm">
                  2
                </Button>
                <Button variant="outline" size="sm">
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
