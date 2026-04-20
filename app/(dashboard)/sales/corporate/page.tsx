"use client"

export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, TrendingUp, CheckCircle, Clock } from "lucide-react"
import Link from "next/link"
import { SalesSubmodule, SalesReportStatus } from "@prisma/client"



export default function CorporateSalesDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["corporate-sales-stats"],
    queryFn: async () => {
      const res = await fetch(
        `/api/sales/reports?submodule=${SalesSubmodule.CORPORATE_SALES}&limit=1000`
      )
      if (!res.ok) throw new Error("Failed to fetch stats")
      return res.json()
    },
  })

  const reports = stats?.data?.reports || []
  const totalReports = reports.length
  const draftCount = reports.filter((r: any) => r.status === SalesReportStatus.DRAFT).length
  const submittedCount = reports.filter((r: any) => r.status === SalesReportStatus.SUBMITTED).length
  const vettedCount = reports.filter((r: any) => r.status === SalesReportStatus.VETTED).length
  const approvedCount = reports.filter((r: any) => r.status === SalesReportStatus.APPROVED).length
  const finalCount = reports.filter((r: any) => r.status === SalesReportStatus.FINAL_COPY_UPLOADED).length

  const recentReports = reports.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Public Sector Channel</h1>
        <p className="text-muted-foreground">Manage public sector channel reports and activities</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Create new reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/sales/corporate/reports/add?type=DAILY">
              <Button variant="outline" className="w-full justify-start">
                Submit Daily Report
              </Button>
            </Link>
            <Link href="/sales/corporate/reports/add?type=WEEKLY">
              <Button variant="outline" className="w-full justify-start">
                Submit Weekly Report
              </Button>
            </Link>
            <Link href="/sales/corporate/reports/add?type=MONTHLY">
              <Button variant="outline" className="w-full justify-start">
                Submit Monthly Report
              </Button>
            </Link>
            <Link href="/sales/corporate/reports">
              <Button variant="outline" className="w-full justify-start">
                View All Reports
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription>Latest sales reports</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : recentReports.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No reports yet</div>
            ) : (
              <div className="space-y-2">
                {recentReports.map((report: any) => (
                  <Link
                    key={report.id}
                    href={`/sales/corporate/reports/${report.id}`}
                    className="block p-2 rounded hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{report.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.report_period).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{report.report_type}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

