"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Clock, Eye, CheckCircle, XCircle } from "lucide-react"
import { format } from "date-fns"

export const dynamic = 'force-dynamic'

export default function PendingTariffPlansPage() {
  const router = useRouter()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pending-tariff-plans"],
    queryFn: async () => {
      const res = await fetch("/api/provider/tariff-plans/pending")
      if (!res.ok) throw new Error("Failed to fetch pending tariff plans")
      return res.json()
    },
  })

  const tariffPlans = data?.tariffPlans || []

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <PermissionGate module="provider" action="approve_tariff_plan">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pending Tariff Plans</h1>
            <p className="text-gray-600 mt-2">
              Review and approve tariff plan submissions from providers
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tariff Plans Awaiting Approval</CardTitle>
            <CardDescription>
              {tariffPlans.length} tariff plan{tariffPlans.length !== 1 ? "s" : ""} pending
              approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : tariffPlans.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pending tariff plans at this time.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Services Count</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tariffPlans.map((plan: any) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">
                        {plan.provider?.facility_name || "Unknown"}
                      </TableCell>
                      <TableCell>v{plan.version}</TableCell>
                      <TableCell>{plan._count?.tariff_plan_services || 0}</TableCell>
                      <TableCell>
                        {plan.submitted_at
                          ? format(new Date(plan.submitted_at), "MMM dd, yyyy HH:mm")
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(plan.status)}>
                          {plan.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/provider/tariff-plans/${plan.id}/approve`)
                          }
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}

