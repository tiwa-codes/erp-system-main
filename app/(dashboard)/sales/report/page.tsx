"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { ReportType, SalesSubmodule } from "@prisma/client"
import { SALES_CHANNEL_OPTIONS } from "@/lib/sales"

export const dynamic = 'force-dynamic'

type ChannelOption = {
  id: string
  label: string
  submodule: SalesSubmodule
}

type SalesBranch = {
  id: string
  name: string
  state: string
  region_id: string
}

type SalesRegion = {
  id: string
  name: string
  branches?: SalesBranch[]
}

const CHANNEL_OPTIONS: ChannelOption[] = SALES_CHANNEL_OPTIONS.map((item) => ({
  id: item.id,
  label: item.label,
  submodule: item.submodule as SalesSubmodule,
}))

function weekStartDate(year: number, week: number) {
  const first = new Date(Date.UTC(year, 0, 1))
  const offset = (week - 1) * 7
  first.setUTCDate(first.getUTCDate() + offset)
  return first
}

export default function SalesReportPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const today = new Date()
  const [channelId, setChannelId] = useState<string>(CHANNEL_OPTIONS[0].id)
  const [regionId, setRegionId] = useState<string>("")
  const [branchId, setBranchId] = useState<string>("")
  const [week, setWeek] = useState<string>("")
  const [amountAchieved, setAmountAchieved] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

  const selectedChannel = useMemo(
    () => CHANNEL_OPTIONS.find((c) => c.id === channelId) ?? CHANNEL_OPTIONS[0],
    [channelId]
  )

  const { data: regionsData } = useQuery({
    queryKey: ["settings-sales-regions-with-branches"],
    queryFn: async () => {
      const res = await fetch("/api/settings/sales-regions?include_branches=true")
      if (!res.ok) throw new Error("Failed to load sales regions")
      return res.json()
    },
  })

  const regions = (regionsData?.data || []) as SalesRegion[]
  const selectedRegion = regions.find((region) => region.id === regionId) || null
  const availableBranches = selectedRegion?.branches || []
  const selectedBranch = availableBranches.find((branch) => branch.id === branchId) || null
  const selectedState = selectedBranch?.state || ""

  const { data: branchTargetsData } = useQuery({
    queryKey: ["sales-branch-targets", regionId, branchId],
    enabled: Boolean(regionId && branchId),
    queryFn: async () => {
      const params = new URLSearchParams({
        region_id: regionId,
        branch_id: branchId,
      })
      const res = await fetch(`/api/settings/sales-branch-targets?${params}`)
      if (!res.ok) throw new Error("Failed to load branch targets")
      return res.json()
    },
  })

  const { data: reportsData, refetch: refetchReports } = useQuery({
    queryKey: ["sales-report-ytd", selectedChannel.submodule, regionId, branchId],
    enabled: Boolean(regionId && branchId),
    queryFn: async () => {
      const params = new URLSearchParams({
        submodule: selectedChannel.submodule,
        region_id: regionId,
        branch_id: branchId,
        limit: "1000",
      })
      const res = await fetch(`/api/sales/reports?${params}`)
      if (!res.ok) throw new Error("Failed to load existing weekly reports")
      return res.json()
    },
  })

  const createAndSubmit = useMutation({
    mutationFn: async () => {
      const parsedAmount = Number(amountAchieved) || 0
      const annualTarget = Number(branchTargetsData?.data?.[selectedChannel.submodule] ?? 0)
      const selectedWeek = Number(week)
      const reportYear = today.getFullYear()

      if (!regionId) throw new Error("Select a region.")
      if (!branchId) throw new Error("Select a branch.")
      if (!selectedState) throw new Error("Selected branch has no state configured.")
      if (!selectedWeek || selectedWeek < 1 || selectedWeek > 52) {
        throw new Error("Select a valid week (1-52).")
      }
      if (parsedAmount <= 0) {
        throw new Error("Enter a valid achieved amount.")
      }
      if (annualTarget <= 0) {
        throw new Error("Annual target is not set for the selected region/branch/channel.")
      }

      const reportPeriod = weekStartDate(reportYear, selectedWeek).toISOString()
      const title = `${selectedChannel.label} Weekly Sales - Week ${selectedWeek}, ${reportYear}`
      const notePrefix = `Channel: ${selectedChannel.label}`
      const reportNotes = notes?.trim() ? `${notePrefix}\n${notes.trim()}` : notePrefix

      const createRes = await fetch("/api/sales/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submodule: selectedChannel.submodule,
          region_id: regionId,
          branch_id: branchId,
          report_type: ReportType.WEEKLY,
          report_period: reportPeriod,
          title,
          sales_amount: parsedAmount,
          target_amount: annualTarget,
          state: selectedState,
          notes: reportNotes,
        }),
      })

      if (!createRes.ok) {
        const createErr = await createRes.json().catch(() => ({}))
        throw new Error(createErr?.error || "Failed to create weekly sales report")
      }

      const created = await createRes.json()
      const reportId = created?.data?.id
      if (!reportId) throw new Error("Failed to get report ID after creation")

      const submitRes = await fetch(`/api/sales/reports/${reportId}/submit`, {
        method: "POST",
      })
      if (!submitRes.ok) {
        const submitErr = await submitRes.json().catch(() => ({}))
        throw new Error(submitErr?.error || "Report created but failed to submit")
      }

      return reportId
    },
    onSuccess: async () => {
      toast({ title: "Submitted", description: "Weekly sales report submitted successfully." })
      setWeek("")
      setAmountAchieved("")
      setNotes("")
      await refetchReports()
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const annualTarget = Number(branchTargetsData?.data?.[selectedChannel.submodule] ?? 0)
  const existingReports = (reportsData?.data?.reports || []) as any[]
  const currentYear = today.getFullYear()
  const currentMonthNumber = today.getMonth() + 1

  const ytdActual = existingReports
    .filter((r) => {
      const reportDate = new Date(r.report_period)
      if (Number.isNaN(reportDate.getTime())) return false
      if (reportDate.getFullYear() !== currentYear) return false
      return reportDate.getMonth() + 1 <= currentMonthNumber
    })
    .reduce((sum, r) => sum + Number(r.sales_amount || 0), 0)

  const projectedYtdActual = ytdActual + (Number(amountAchieved) || 0)
  const ytdTarget = (annualTarget / 12) * currentMonthNumber
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysLeftInMonth = Math.max(daysInMonth - today.getDate(), 0)
  const runRate = ytdTarget - projectedYtdActual

  const userName = session?.user?.name || session?.user?.email || "N/A"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales Report</h1>
        <p className="text-muted-foreground">Weekly sales entry grouped by region, branch, state and channel.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Sales Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={userName} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={regionId}
                onValueChange={(value) => {
                  setRegionId(value)
                  setBranchId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId} disabled={!regionId}>
                <SelectTrigger>
                  <SelectValue placeholder={regionId ? "Select branch" : "Select region first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={selectedState} placeholder="Auto-filled from branch" readOnly />
            </div>
            <div className="space-y-2">
              <Label>Annual Target</Label>
              <Input value={annualTarget ? annualTarget.toLocaleString() : ""} placeholder="Not set yet" readOnly />
            </div>
            <div className="space-y-2">
              <Label>Select Week</Label>
              <Select value={week} onValueChange={setWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Week 1 - Week 52" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 52 }).map((_, i) => {
                    const weekNumber = i + 1
                    return (
                      <SelectItem key={weekNumber} value={String(weekNumber)}>
                        Week {weekNumber}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount Achieved (₦)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountAchieved}
                onChange={(e) => setAmountAchieved(e.target.value)}
                placeholder="Enter amount made"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Enter notes..." />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">YTD Actual</p>
                <p className="text-xl font-bold">₦{projectedYtdActual.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">YTD Target</p>
                <p className="text-xl font-bold">₦{ytdTarget.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Days Left (Month)</p>
                <p className="text-xl font-bold">{daysLeftInMonth.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Run Rate</p>
                <p className="text-xl font-bold">₦{runRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => createAndSubmit.mutate()} disabled={createAndSubmit.isPending}>
              {createAndSubmit.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
