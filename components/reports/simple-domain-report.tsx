"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"

type Column = { key: string; label: string }

type AdditionalFilter = {
  key: string
  label: string
  placeholder?: string
}

type Props = {
  title: string
  subtitle: string
  reportType: "UNDERWRITING" | "PROVIDER_MANAGEMENT" | "TELEMEDICINE"
  filters: string[]
  columnsByFilter: Record<string, Column[]>
  additionalFilters?: AdditionalFilter[]
}

function csvEscape(value: unknown) {
  const str = String(value ?? "")
  return `"${str.replace(/"/g, '""')}"`
}

export function SimpleDomainReport({ title, subtitle, reportType, filters, columnsByFilter, additionalFilters }: Props) {
  const [selectedFilter, setSelectedFilter] = useState(filters[0])
  const [search, setSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)
  const [extraValues, setExtraValues] = useState<Record<string, string>>({})
  const limit = 100

  const { data, isLoading } = useQuery({
    queryKey: ["simple-domain-report", reportType, selectedFilter, search, fromDate, toDate, page, extraValues],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: reportType,
        filter: selectedFilter,
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(fromDate ? { from: new Date(`${fromDate}T00:00:00`).toISOString() } : {}),
        ...(toDate ? { to: new Date(`${toDate}T23:59:59.999`).toISOString() } : {}),
      })
      Object.entries(extraValues).forEach(([key, val]) => {
        if (val) params.set(key, val)
      })
      const res = await fetch(`/api/reports?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch report")
      return res.json()
    },
  })

  const columns = columnsByFilter[selectedFilter] || []
  const rows = useMemo(() => data?.data || [], [data])
  const total = Number(data?.total || 0)

  const exportCsv = () => {
    const lines = [
      columns.map((c) => csvEscape(c.label)).join(","),
      ...rows.map((row: Record<string, unknown>) => columns.map((c) => csvEscape(row[c.key])).join(",")),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportType.toLowerCase()}-${selectedFilter.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PermissionGate module="reports" action="view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-600">{subtitle}</p>
          </div>
          <Button onClick={exportCsv} variant="outline" disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select
              value={selectedFilter}
              onValueChange={(value) => {
                setSelectedFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select filter" />
              </SelectTrigger>
              <SelectContent>
                {filters.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1) }} />
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1) }} />
            <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            {additionalFilters?.map((af) => (
              <Input
                key={af.key}
                placeholder={af.placeholder ?? af.label}
                value={extraValues[af.key] ?? ""}
                onChange={(e) => {
                  setExtraValues((prev) => ({ ...prev, [af.key]: e.target.value }))
                  setPage(1)
                }}
              />
            ))}
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("")
                setFromDate("")
                setToDate("")
                setExtraValues({})
                setPage(1)
              }}
            >
              Reset
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedFilter} ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(columns.length, 1)}>Loading...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(columns.length, 1)}>No records found</TableCell>
                  </TableRow>
                ) : (
                  rows.map((row: Record<string, unknown>, index: number) => (
                    <TableRow key={index}>
                      {columns.map((col) => (
                        <TableCell key={col.key}>{String(row[col.key] ?? "N/A")}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}

