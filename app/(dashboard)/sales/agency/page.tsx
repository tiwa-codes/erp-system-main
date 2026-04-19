"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, TrendingUp, CheckCircle, Clock } from "lucide-react"
import Link from "next/link"
import { SalesSubmodule, SalesReportStatus } from "@prisma/client"
import { useState } from "react"

type DigitalReportForm = {
  date: string
  platform: string
  start: string
  end: string
  reach: string
  impressions: string
  engagement: string
  clicks: string
  conversions: string
  revenue: string
}

type DigitalReportRow = {
  id: string
  date: string
  platform: string
  start: number
  end: number
  growth: number
  reach: number
  impressions: number
  engagement: number
  engagementRate: number
  clicks: number
  conversions: number
  revenue: number
}

const DIGITAL_INITIAL_FORM: DigitalReportForm = {
  date: "Week 1",
  platform: "Instagram",
  start: "",
  end: "",
  reach: "",
  impressions: "",
  engagement: "",
  clicks: "",
  conversions: "",
  revenue: "",
}

const WEEK_OPTIONS = Array.from({ length: 52 }, (_, index) => `Week ${index + 1}`)

export default function AgencySalesDashboard() {
  const [activeTab, setActiveTab] = useState<"institutional" | "digital">("institutional")
  const [digitalForm, setDigitalForm] = useState<DigitalReportForm>(DIGITAL_INITIAL_FORM)
  const [digitalReports, setDigitalReports] = useState<DigitalReportRow[]>([])

  const { data: stats, isLoading } = useQuery({
    queryKey: ["agency-sales-stats"],
    queryFn: async () => {
      const res = await fetch(
        `/api/sales/reports?submodule=${SalesSubmodule.AGENCY_SALES}&limit=1000`
      )
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

  const recentReports = reports.slice(0, 5)

  const setDigitalField = (field: keyof DigitalReportForm, value: string) => {
    setDigitalForm((prev) => ({ ...prev, [field]: value }))
  }

  const addDigitalReport = () => {
    const start = Number(digitalForm.start || 0)
    const end = Number(digitalForm.end || 0)
    const reach = Number(digitalForm.reach || 0)
    const impressions = Number(digitalForm.impressions || 0)
    const engagement = Number(digitalForm.engagement || 0)
    const clicks = Number(digitalForm.clicks || 0)
    const conversions = Number(digitalForm.conversions || 0)
    const revenue = Number(digitalForm.revenue || 0)

    const row: DigitalReportRow = {
      id: `${Date.now()}-${Math.random()}`,
      date: digitalForm.date,
      platform: digitalForm.platform,
      start,
      end,
      growth: end - start,
      reach,
      impressions,
      engagement,
      engagementRate: impressions > 0 ? (engagement / impressions) * 100 : 0,
      clicks,
      conversions,
      revenue,
    }

    setDigitalReports((prev) => [row, ...prev])
    setDigitalForm((prev) => ({
      ...DIGITAL_INITIAL_FORM,
      platform: prev.platform,
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Institutional Business & Digital Sales</h1>
        <p className="text-muted-foreground">Manage institutional business & digital sales reports and activities</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          className={activeTab === "institutional" ? "bg-red-600 hover:bg-red-700" : ""}
          variant={activeTab === "institutional" ? "default" : "outline"}
          onClick={() => setActiveTab("institutional")}
        >
          Institutional Business
        </Button>
        <Button
          type="button"
          className={activeTab === "digital" ? "bg-red-600 hover:bg-red-700" : ""}
          variant={activeTab === "digital" ? "default" : "outline"}
          onClick={() => setActiveTab("digital")}
        >
          Digital Sales
        </Button>
      </div>

      {activeTab === "institutional" ? (
        <>
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
                <Link href="/sales/agency/reports/add?type=DAILY">
                  <Button variant="outline" className="w-full justify-start">
                    Submit Daily Report
                  </Button>
                </Link>
                <Link href="/sales/agency/reports/add?type=WEEKLY">
                  <Button variant="outline" className="w-full justify-start">
                    Submit Weekly Report
                  </Button>
                </Link>
                <Link href="/sales/agency/reports/add?type=MONTHLY">
                  <Button variant="outline" className="w-full justify-start">
                    Submit Monthly Report
                  </Button>
                </Link>
                <Link href="/sales/agency/reports">
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
                        href={`/sales/agency/reports/${report.id}`}
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
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-red-700 px-6 py-5 text-white">
            <h2 className="text-2xl font-bold">Digital Sales Report Dashboard</h2>
            <p className="text-red-100">Track and manage social media performance</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Enter Report</CardTitle>
              <CardDescription>Add a platform report entry</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Week</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.date}
                    onChange={(e) => setDigitalField("date", e.target.value)}
                  >
                    {WEEK_OPTIONS.map((week) => (
                      <option key={week} value={week}>
                        {week}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Platform</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.platform}
                    onChange={(e) => setDigitalField("platform", e.target.value)}
                  >
                    <option>Instagram</option>
                    <option>Facebook</option>
                    <option>Twitter</option>
                    <option>TikTok</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Followers (Start)</label>
                  <input
                    type="number"
                    placeholder="Enter start followers"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.start}
                    onChange={(e) => setDigitalField("start", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Followers (End)</label>
                  <input
                    type="number"
                    placeholder="Enter end followers"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.end}
                    onChange={(e) => setDigitalField("end", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reach</label>
                  <input
                    type="number"
                    placeholder="Enter reach"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.reach}
                    onChange={(e) => setDigitalField("reach", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Impressions</label>
                  <input
                    type="number"
                    placeholder="Enter impressions"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.impressions}
                    onChange={(e) => setDigitalField("impressions", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Engagement (Likes + Comments)</label>
                  <input
                    type="number"
                    placeholder="Enter engagements"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.engagement}
                    onChange={(e) => setDigitalField("engagement", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Clicks</label>
                  <input
                    type="number"
                    placeholder="Enter clicks"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.clicks}
                    onChange={(e) => setDigitalField("clicks", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Conversions</label>
                  <input
                    type="number"
                    placeholder="Enter conversions"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.conversions}
                    onChange={(e) => setDigitalField("conversions", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Revenue (₦)</label>
                  <input
                    type="number"
                    placeholder="Enter revenue"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={digitalForm.revenue}
                    onChange={(e) => setDigitalField("revenue", e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button className="bg-red-600 hover:bg-red-700" onClick={addDigitalReport}>
                  Submit Report
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales Report Table</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-red-700 text-left text-white">
                    <th className="px-3 py-2 font-semibold">Week</th>
                    <th className="px-3 py-2 font-semibold">Platform</th>
                    <th className="px-3 py-2 font-semibold">Start</th>
                    <th className="px-3 py-2 font-semibold">End</th>
                    <th className="px-3 py-2 font-semibold">Growth</th>
                    <th className="px-3 py-2 font-semibold">Reach</th>
                    <th className="px-3 py-2 font-semibold">Impressions</th>
                    <th className="px-3 py-2 font-semibold">Engagement</th>
                    <th className="px-3 py-2 font-semibold">Engagement Rate (%)</th>
                    <th className="px-3 py-2 font-semibold">Clicks</th>
                    <th className="px-3 py-2 font-semibold">Conversions</th>
                    <th className="px-3 py-2 font-semibold">Revenue (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {digitalReports.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={12}>
                        No digital reports yet
                      </td>
                    </tr>
                  ) : (
                    digitalReports.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="px-3 py-2">{row.date || "-"}</td>
                        <td className="px-3 py-2">{row.platform}</td>
                        <td className="px-3 py-2">{row.start.toLocaleString()}</td>
                        <td className="px-3 py-2">{row.end.toLocaleString()}</td>
                        <td className="px-3 py-2">{row.growth.toLocaleString()}</td>
                        <td className="px-3 py-2">{row.reach.toLocaleString()}</td>
                        <td className="px-3 py-2">{row.impressions.toLocaleString()}</td>
                        <td className="px-3 py-2">{row.engagement.toLocaleString()}</td>
                        <td className="px-3 py-2">{row.engagementRate.toFixed(2)}%</td>
                        <td className="px-3 py-2">{row.clicks.toLocaleString()}</td>
                        <td className="px-3 py-2">{row.conversions.toLocaleString()}</td>
                        <td className="px-3 py-2">₦{row.revenue.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
