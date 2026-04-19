"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReportType } from "@prisma/client"

interface PeriodSelectorProps {
  reportType: ReportType
  period: string
  periodEnd?: string
  onPeriodChange: (period: string) => void
  onPeriodEndChange?: (periodEnd: string) => void
}

export function PeriodSelector({
  reportType,
  period,
  periodEnd,
  onPeriodChange,
  onPeriodEndChange,
}: PeriodSelectorProps) {
  const getCurrentYear = () => new Date().getFullYear()
  const getCurrentMonth = () => new Date().getMonth() + 1
  const getCurrentQuarter = () => Math.floor((new Date().getMonth() + 3) / 3)
  const getCurrentHalfYear = () => (new Date().getMonth() < 6 ? 1 : 2)

  const getWeekEndDate = (startDate: string) => {
    if (!startDate) return ""
    const date = new Date(startDate)
    const endDate = new Date(date)
    endDate.setDate(date.getDate() + 6)
    return endDate.toISOString().split("T")[0]
  }

  const handlePeriodChange = (value: string) => {
    onPeriodChange(value)
    if (reportType === "WEEKLY" && onPeriodEndChange) {
      const endDate = getWeekEndDate(value)
      onPeriodEndChange(endDate)
    }
  }

  switch (reportType) {
    case "DAILY":
      return (
        <div className="space-y-2">
          <Label htmlFor="report_period">Report Date *</Label>
          <Input
            id="report_period"
            type="date"
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            required
          />
        </div>
      )

    case "WEEKLY":
      return (
        <div className="space-y-2">
          <Label htmlFor="report_period">Week Start Date *</Label>
          <Input
            id="report_period"
            type="date"
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            required
          />
          {period && (
            <div className="text-sm text-muted-foreground">
              Week End: {getWeekEndDate(period)}
            </div>
          )}
        </div>
      )

    case "MONTHLY":
      return (
        <div className="space-y-2">
          <Label htmlFor="report_period">Month *</Label>
          <Input
            id="report_period"
            type="month"
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            required
          />
        </div>
      )

    case "QUARTERLY":
      return (
        <div className="space-y-2">
          <Label>Quarter *</Label>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={period.split("-")[0] || String(getCurrentQuarter())}
              onValueChange={(quarter) => {
                const year = period.split("-")[1] || String(getCurrentYear())
                handlePeriodChange(`${quarter}-${year}`)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={period.split("-")[1] || String(getCurrentYear())}
              onValueChange={(year) => {
                const quarter = period.split("-")[0] || String(getCurrentQuarter())
                handlePeriodChange(`${quarter}-${year}`)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => getCurrentYear() - 2 + i).map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case "HALF_YEARLY":
      return (
        <div className="space-y-2">
          <Label>Half-Year *</Label>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={period.split("-")[0] || String(getCurrentHalfYear())}
              onValueChange={(half) => {
                const year = period.split("-")[1] || String(getCurrentYear())
                handlePeriodChange(`${half}-${year}`)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select half-year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">H1 (Jan-Jun)</SelectItem>
                <SelectItem value="2">H2 (Jul-Dec)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={period.split("-")[1] || String(getCurrentYear())}
              onValueChange={(year) => {
                const half = period.split("-")[0] || String(getCurrentHalfYear())
                handlePeriodChange(`${half}-${year}`)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => getCurrentYear() - 2 + i).map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case "YEARLY":
      return (
        <div className="space-y-2">
          <Label htmlFor="report_period">Year *</Label>
          <Select
            value={period || String(getCurrentYear())}
            onValueChange={handlePeriodChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => getCurrentYear() - 2 + i).map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )

    default:
      return null
  }
}

