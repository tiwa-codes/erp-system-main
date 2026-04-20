"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Building2, DollarSign } from "lucide-react"
import Link from "next/link"
import { PermissionGate } from "@/components/ui/permission-gate"

export const dynamic = 'force-dynamic'

export default function SpecialRiskPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["special-risk-stats"],
    queryFn: async () => {
      const [plansRes, providersRes] = await Promise.all([
        fetch("/api/special-risk/plans?status=PENDING_APPROVAL&limit=1"),
        fetch("/api/special-risk/providers?status=UNDER_REVIEW&limit=1"),
      ])

      const plansData = await plansRes.json()
      const providersData = await providersRes.json()

      return {
        pendingPlans: plansData.data?.pagination?.total || 0,
        pendingProviders: providersData.data?.pagination?.total || 0,
      }
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Special Services Module</h1>
        <p className="text-muted-foreground">
          Manage custom plans and special provider registrations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PermissionGate permission="special-risk.view">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Custom Plans
              </CardTitle>
              <CardDescription>
                Review and approve customized plans from Underwriting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? "..." : stats?.pendingPlans || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                </div>
                <Link href="/special-risk/custom-plans">
                  <Button>View Custom Plans</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </PermissionGate>

        <PermissionGate permission="special-risk.view">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                International Coverage
              </CardTitle>
              <CardDescription>
                Manage foreign providers, ambulance companies, and logistics companies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? "..." : stats?.pendingProviders || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Under Review</p>
                </div>
                <Link href="/special-risk/special-providers">
                  <Button>View International Coverage</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </PermissionGate>

        <PermissionGate permission="settings.view">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Exchange Rates
              </CardTitle>
              <CardDescription>
                Manage currency exchange rates for special providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure exchange rates for foreign currency transactions
                </p>
                <Link href="/settings/exchange-rates">
                  <Button variant="outline">Manage Exchange Rates</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </PermissionGate>
      </div>
    </div>
  )
}
