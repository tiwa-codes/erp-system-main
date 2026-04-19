"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { PeriodSelector } from "./period-selector"
import { SalesSubmodule, ReportType } from "@prisma/client"
import { Save, Send } from "lucide-react"

interface ReportFormProps {
  submodule: SalesSubmodule
  initialData?: {
    report_type?: ReportType
    report_period?: string
    report_period_end?: string
    title?: string
    sales_amount?: number
    target_amount?: number
    region_id?: string
    branch_id?: string
    state?: string
    notes?: string
  }
  onSubmit: (data: any) => void
  onSaveDraft?: (data: any) => void
  isSubmitting?: boolean
  isSaving?: boolean
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

export function ReportForm({
  submodule,
  initialData,
  onSubmit,
  onSaveDraft,
  isSubmitting = false,
  isSaving = false,
}: ReportFormProps) {
  const [form, setForm] = useState({
    report_type: (initialData?.report_type || "") as ReportType | "",
    report_period: initialData?.report_period || "",
    report_period_end: initialData?.report_period_end || "",
    title: initialData?.title || "",
    sales_amount: initialData?.sales_amount?.toString() || "",
    target_amount: initialData?.target_amount?.toString() || "",
    region_id: initialData?.region_id || "",
    branch_id: initialData?.branch_id || "",
    state: initialData?.state || "",
    notes: initialData?.notes || "",
  })

  const [achievement, setAchievement] = useState<number | null>(null)

  useEffect(() => {
    if (form.sales_amount && form.target_amount) {
      const sales = parseFloat(form.sales_amount)
      const target = parseFloat(form.target_amount)
      if (target > 0) {
        setAchievement((sales / target) * 100)
      } else {
        setAchievement(null)
      }
    } else {
      setAchievement(null)
    }
  }, [form.sales_amount, form.target_amount])

  const { data: regionsData } = useQuery({
    queryKey: ["settings-sales-regions-with-branches"],
    queryFn: async () => {
      const res = await fetch("/api/settings/sales-regions?include_branches=true")
      if (!res.ok) throw new Error("Failed to load sales regions")
      return res.json()
    },
  })

  const regions = (regionsData?.data || []) as SalesRegion[]
  const selectedRegion = regions.find((region) => region.id === form.region_id) || null
  const availableBranches = selectedRegion?.branches || []
  const selectedBranch = availableBranches.find((branch) => branch.id === form.branch_id) || null

  const { data: branchTargetsData } = useQuery({
    queryKey: ["sales-branch-targets", form.region_id, form.branch_id],
    enabled: Boolean(form.region_id && form.branch_id),
    queryFn: async () => {
      const params = new URLSearchParams({
        region_id: form.region_id,
        branch_id: form.branch_id,
      })
      const res = await fetch(`/api/settings/sales-branch-targets?${params}`)
      if (!res.ok) throw new Error("Failed to load branch targets")
      return res.json()
    },
  })

  useEffect(() => {
    if (!form.region_id || !form.branch_id) return
    if (selectedBranch) return

    setForm((prev) => ({
      ...prev,
      branch_id: "",
      state: "",
    }))
  }, [form.region_id, form.branch_id, selectedBranch])

  useEffect(() => {
    if (!selectedBranch) return
    if (form.state === selectedBranch.state) return

    setForm((prev) => ({ ...prev, state: selectedBranch.state }))
  }, [selectedBranch, form.state])

  useEffect(() => {
    if (initialData?.target_amount !== undefined) return
    if (form.target_amount.trim() !== "") return
    const target = branchTargetsData?.data?.[submodule]
    if (target === undefined || target === null) return
    if (Number(target) <= 0) return
    setForm((prev) => ({ ...prev, target_amount: String(target) }))
  }, [branchTargetsData, submodule, initialData?.target_amount, form.target_amount])

  const convertPeriodToISO = (period: string, reportType: ReportType): string => {
    if (!period) return ""
    
    switch (reportType) {
      case "DAILY":
        // Already in YYYY-MM-DD format
        return new Date(period).toISOString()
      
      case "WEEKLY":
        // Already in YYYY-MM-DD format (start date)
        return new Date(period).toISOString()
      
      case "MONTHLY":
        // Already in YYYY-MM format, convert to first day of month
        const [year, month] = period.split("-")
        return new Date(parseInt(year), parseInt(month) - 1, 1).toISOString()
      
      case "QUARTERLY":
        // Format: "1-2024" -> Q1 2024 -> Jan 1, 2024
        const [quarter, qYear] = period.split("-")
        const quarterMonth = (parseInt(quarter) - 1) * 3
        return new Date(parseInt(qYear), quarterMonth, 1).toISOString()
      
      case "HALF_YEARLY":
        // Format: "1-2024" -> H1 2024 -> Jan 1, 2024, H2 -> Jul 1, 2024
        const [half, hYear] = period.split("-")
        const halfMonth = (parseInt(half) - 1) * 6
        return new Date(parseInt(hYear), halfMonth, 1).toISOString()
      
      case "YEARLY":
        // Format: "2024" -> Jan 1, 2024
        return new Date(parseInt(period), 0, 1).toISOString()
      
      default:
        return new Date(period).toISOString()
    }
  }

  const convertPeriodEndToISO = (period: string, reportType: ReportType): string | undefined => {
    if (!period) return undefined
    
    switch (reportType) {
      case "WEEKLY":
        // Calculate end date (start + 6 days)
        const startDate = new Date(period)
        const endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        return endDate.toISOString()
      
      case "QUARTERLY":
        // Format: "1-2024" -> Q1 2024 -> Mar 31, 2024
        const [quarter, qYear] = period.split("-")
        const quarterEndMonth = parseInt(quarter) * 3 - 1
        const lastDay = new Date(parseInt(qYear), quarterEndMonth + 1, 0).getDate()
        return new Date(parseInt(qYear), quarterEndMonth, lastDay).toISOString()
      
      case "HALF_YEARLY":
        // Format: "1-2024" -> H1 2024 -> Jun 30, 2024, H2 -> Dec 31, 2024
        const [half, hYear] = period.split("-")
        const halfEndMonth = parseInt(half) * 6 - 1
        const lastDayOfHalf = new Date(parseInt(hYear), halfEndMonth + 1, 0).getDate()
        return new Date(parseInt(hYear), halfEndMonth, lastDayOfHalf).toISOString()
      
      case "MONTHLY":
        // Last day of the month
        const [mYear, mMonth] = period.split("-")
        const lastDayOfMonth = new Date(parseInt(mYear), parseInt(mMonth), 0).getDate()
        return new Date(parseInt(mYear), parseInt(mMonth) - 1, lastDayOfMonth).toISOString()
      
      case "YEARLY":
        // Dec 31 of the year
        return new Date(parseInt(period), 11, 31).toISOString()
      
      default:
        return undefined
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const reportPeriodISO = convertPeriodToISO(form.report_period, form.report_type as ReportType)
    const reportPeriodEndISO = form.report_period_end 
      ? convertPeriodEndToISO(form.report_period_end, form.report_type as ReportType)
      : convertPeriodEndToISO(form.report_period, form.report_type as ReportType)

    const payload = {
      submodule,
      report_type: form.report_type,
      report_period: reportPeriodISO,
      report_period_end: reportPeriodEndISO,
      title: form.title,
      sales_amount: parseFloat(form.sales_amount),
      target_amount: parseFloat(form.target_amount),
      region_id: form.region_id,
      branch_id: form.branch_id,
      state: form.state,
      notes: form.notes || undefined,
    }

    onSubmit(payload)
  }

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault()

    if (onSaveDraft) {
      const reportPeriodISO = convertPeriodToISO(form.report_period, form.report_type as ReportType)
      const reportPeriodEndISO = form.report_period_end 
        ? convertPeriodEndToISO(form.report_period_end, form.report_type as ReportType)
        : convertPeriodEndToISO(form.report_period, form.report_type as ReportType)

      const payload = {
        submodule,
        report_type: form.report_type,
        report_period: reportPeriodISO,
        report_period_end: reportPeriodEndISO,
        title: form.title,
        sales_amount: parseFloat(form.sales_amount),
        target_amount: parseFloat(form.target_amount),
        region_id: form.region_id,
        branch_id: form.branch_id,
        state: form.state,
        notes: form.notes || undefined,
      }

      onSaveDraft(payload)
    }
  }

  const getAchievementColor = () => {
    if (!achievement) return "text-gray-600"
    if (achievement < 80) return "text-red-600"
    if (achievement <= 100) return "text-yellow-600"
    return "text-green-600"
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="report_type">Report Type *</Label>
        <Select
          value={form.report_type}
          onValueChange={(value) =>
            setForm((prev) => ({ ...prev, report_type: value as ReportType, report_period: "", report_period_end: "" }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select report type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DAILY">Daily</SelectItem>
            <SelectItem value="WEEKLY">Weekly</SelectItem>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
            <SelectItem value="HALF_YEARLY">Half-Yearly</SelectItem>
            <SelectItem value="YEARLY">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.report_type && (
        <PeriodSelector
          reportType={form.report_type}
          period={form.report_period}
          periodEnd={form.report_period_end}
          onPeriodChange={(value) => setForm((prev) => ({ ...prev, report_period: value }))}
          onPeriodEndChange={(value) => setForm((prev) => ({ ...prev, report_period_end: value }))}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Enter report title"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="region">Region *</Label>
          <Select
            value={form.region_id}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                region_id: value,
                branch_id: "",
                state: "",
                target_amount: initialData?.target_amount !== undefined ? prev.target_amount : "",
              }))
            }
          >
            <SelectTrigger id="region">
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

        <div className="space-y-2">
          <Label htmlFor="branch">Branch *</Label>
          <Select
            value={form.branch_id}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                branch_id: value,
                target_amount: initialData?.target_amount !== undefined ? prev.target_amount : "",
              }))
            }
            disabled={!form.region_id}
          >
            <SelectTrigger id="branch">
              <SelectValue placeholder={form.region_id ? "Select branch" : "Select region first"} />
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
          <Label htmlFor="state">State *</Label>
          <Input id="state" value={form.state} readOnly placeholder="Auto-filled from branch" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sales_amount">Sales Amount *</Label>
          <Input
            id="sales_amount"
            type="number"
            step="0.01"
            min="0"
            value={form.sales_amount}
            onChange={(e) => setForm((prev) => ({ ...prev, sales_amount: e.target.value }))}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="target_amount">Target Amount *</Label>
          <Input
            id="target_amount"
            type="number"
            step="0.01"
            min="0"
            value={form.target_amount}
            onChange={(e) => setForm((prev) => ({ ...prev, target_amount: e.target.value }))}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      {achievement !== null && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Achievement:</span>
            <span className={`text-lg font-bold ${getAchievementColor()}`}>
              {achievement.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Enter any additional notes or comments..."
          rows={4}
        />
      </div>

      <div className="flex gap-2">
        {onSaveDraft && (
          <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save as Draft"}
          </Button>
        )}
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            !form.report_type ||
            !form.report_period ||
            !form.region_id ||
            !form.branch_id ||
            !form.state
          }
        >
          <Send className="h-4 w-4 mr-1" />
          {isSubmitting ? "Submitting..." : "Submit Report"}
        </Button>
      </div>
    </form>
  )
}
