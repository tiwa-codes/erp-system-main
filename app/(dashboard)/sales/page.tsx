"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, TrendingUp, CheckCircle, Clock, Building2, Users, Shield, Briefcase } from "lucide-react"
import Link from "next/link"
import { SalesSubmodule, SalesReportStatus } from "@prisma/client"
import { PermissionGate } from "@/components/ui/permission-gate"

export const dynamic = 'force-dynamic'

export default function SalesModulePage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["sales-module-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/sales/reports?limit=1000`)
      if (!res.ok) throw new Error("Failed to fetch stats")
      return res.json()
    },
  })

  const reports = stats?.data?.reports || []
  const totalReports = reports.length
  const draftCount = reports.filter((r: any) => r.status === SalesReportStatus.DRAFT).length
  const submittedCount = reports.filter((r: any) => r.status === SalesReportStatus.SUBMITTED).length
  const approvedCount = reports.filter((r: any) => r.status === SalesReportStatus.APPROVED).length
  const finalCount = reports.filter((r: any) => r.status === SalesReportStatus.FINAL_COPY_UPLOADED).length

  const corporateCount = reports.filter((r: any) => r.submodule === SalesSubmodule.CORPORATE_SALES).length
  const agencyCount = reports.filter((r: any) => r.submodule === SalesSubmodule.AGENCY_SALES).length
  const specialRisksCount = reports.filter((r: any) => r.submodule === SalesSubmodule.SPECIAL_RISKS_SALES).length
  const operationsCount = reports.filter((r: any) => r.submodule === SalesSubmodule.SALES_OPERATIONS).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales Module</h1>
        <p className="text-muted-foreground">Manage all company sales activities and reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : totalReports}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : draftCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : submittedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : approvedCount + finalCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Sales Report
            </CardTitle>
            <CardDescription>{corporateCount} reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sales/report">
              <Button variant="outline" className="w-full">
                Open Sales Report
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Digital Sales
            </CardTitle>
            <CardDescription>{agencyCount} reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sales/digital">
              <Button variant="outline" className="w-full">
                Open Digital Sales
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Consolidated Sales
            </CardTitle>
            <CardDescription>{specialRisksCount} reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sales/consolidated">
              <Button variant="outline" className="w-full">
                Open Consolidated Sales
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Procurement
            </CardTitle>
            <CardDescription>{operationsCount} reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sales/operations">
              <Button variant="outline" className="w-full">
                View Procurement
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <PermissionGate permission="sales:view_all">
        <Card>
          <CardHeader>
            <CardTitle>Legacy Sales Reports</CardTitle>
            <CardDescription>Direct access to older channel report pages if needed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/sales/corporate">
              <Button variant="outline" className="w-full">
                Public Sector Channel
              </Button>
            </Link>
            <Link href="/sales/agency">
              <Button variant="outline" className="w-full">
                Institutional Business
              </Button>
            </Link>
            <Link href="/sales/special-risks">
              <Button variant="outline" className="w-full">
                Special Service Sale
              </Button>
            </Link>
          </CardContent>
        </Card>
      </PermissionGate>
    </div>
  )
}
