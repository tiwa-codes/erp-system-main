"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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

const INITIAL_FORM: DigitalReportForm = {
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

export default function DigitalSalesPage() {
  const [form, setForm] = useState<DigitalReportForm>(INITIAL_FORM)
  const [rows, setRows] = useState<DigitalReportRow[]>([])

  const setField = (field: keyof DigitalReportForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const addEntry = () => {
    const start = Number(form.start || 0)
    const end = Number(form.end || 0)
    const reach = Number(form.reach || 0)
    const impressions = Number(form.impressions || 0)
    const engagement = Number(form.engagement || 0)
    const clicks = Number(form.clicks || 0)
    const conversions = Number(form.conversions || 0)
    const revenue = Number(form.revenue || 0)

    const row: DigitalReportRow = {
      id: `${Date.now()}-${Math.random()}`,
      date: form.date,
      platform: form.platform,
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

    setRows((prev) => [row, ...prev])
    setForm((prev) => ({ ...INITIAL_FORM, platform: prev.platform }))
  }

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.reach += row.reach
          acc.impressions += row.impressions
          acc.engagement += row.engagement
          acc.clicks += row.clicks
          acc.conversions += row.conversions
          acc.revenue += row.revenue
          return acc
        },
        { reach: 0, impressions: 0, engagement: 0, clicks: 0, conversions: 0, revenue: 0 }
      ),
    [rows]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Digital Sales</h1>
        <p className="text-muted-foreground">Track and manage social media and digital campaign performance.</p>
      </div>

      <div className="rounded-xl bg-red-700 px-6 py-5 text-white">
        <h2 className="text-2xl font-bold">Digital Sales Report Dashboard</h2>
        <p className="text-red-100">Submit your Digital Report</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enter Report</CardTitle>
          <CardDescription>Add a platform report entry</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Week</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
              >
                {WEEK_OPTIONS.map((week) => (
                  <option key={week} value={week}>
                    {week}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.platform}
                onChange={(e) => setField("platform", e.target.value)}
              >
                <option>Instagram</option>
                <option>Facebook</option>
                <option>Twitter</option>
                <option>TikTok</option>
                <option>LinkedIn</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Followers (Start)</Label>
              <Input type="number" placeholder="Start followers" value={form.start} onChange={(e) => setField("start", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Followers (End)</Label>
              <Input type="number" placeholder="End followers" value={form.end} onChange={(e) => setField("end", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Reach</Label>
              <Input type="number" placeholder="Reach" value={form.reach} onChange={(e) => setField("reach", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Impressions</Label>
              <Input type="number" placeholder="Impressions" value={form.impressions} onChange={(e) => setField("impressions", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Engagement</Label>
              <Input type="number" placeholder="Engagement" value={form.engagement} onChange={(e) => setField("engagement", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Clicks</Label>
              <Input type="number" placeholder="Clicks" value={form.clicks} onChange={(e) => setField("clicks", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Conversions</Label>
              <Input type="number" placeholder="Conversions" value={form.conversions} onChange={(e) => setField("conversions", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Revenue (₦)</Label>
              <Input type="number" placeholder="Revenue" value={form.revenue} onChange={(e) => setField("revenue", e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button className="bg-red-700 hover:bg-red-800" onClick={addEntry}>
              Add Digital Entry
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Log</CardTitle>
          <CardDescription>Digital entries captured in this session</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No digital entries yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Growth</TableHead>
                  <TableHead>Reach</TableHead>
                  <TableHead>Impressions</TableHead>
                  <TableHead>Engagement Rate</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.date || "-"}</TableCell>
                    <TableCell>{row.platform}</TableCell>
                    <TableCell>{row.growth.toLocaleString()}</TableCell>
                    <TableCell>{row.reach.toLocaleString()}</TableCell>
                    <TableCell>{row.impressions.toLocaleString()}</TableCell>
                    <TableCell>{row.engagementRate.toFixed(2)}%</TableCell>
                    <TableCell>{row.clicks.toLocaleString()}</TableCell>
                    <TableCell>{row.conversions.toLocaleString()}</TableCell>
                    <TableCell>
                      {row.revenue.toLocaleString("en-NG", { style: "currency", currency: "NGN" })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={3}>Totals</TableCell>
                  <TableCell>{totals.reach.toLocaleString()}</TableCell>
                  <TableCell>{totals.impressions.toLocaleString()}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{totals.clicks.toLocaleString()}</TableCell>
                  <TableCell>{totals.conversions.toLocaleString()}</TableCell>
                  <TableCell>{totals.revenue.toLocaleString("en-NG", { style: "currency", currency: "NGN" })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
