"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileSpreadsheet, FileText } from "lucide-react"
import { exportToExcel, exportToPDF } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"

export const dynamic = 'force-dynamic'

export default function GeneralLedgerSummaryPage() {
  const { toast } = useToast()
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  )
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0])

  const { data, isLoading } = useQuery({
    queryKey: ["gl-summary", fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate,
      })
      const res = await fetch(`/api/finance/general-ledger/summary?${params}`)
      if (!res.ok) throw new Error("Failed to fetch GL summary")
      return res.json()
    },
  })

  const summaries = data?.data?.summaries || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">General Ledger Summary</h1>
          <p className="text-gray-600">View account summaries for a date range</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const reportData = {
                title: "General Ledger Summary",
                subtitle: `${new Date(fromDate).toLocaleDateString("en-NG")} to ${new Date(toDate).toLocaleDateString("en-NG")}`,
                data: summaries.map((summary: any) => ({
                  account_code: summary.account_code,
                  account_name: summary.account_name,
                  account_category: summary.account_category,
                  opening_balance: Number(summary.opening_balance),
                  total_debits: Number(summary.total_debits),
                  total_credits: Number(summary.total_credits),
                  balance: Number(summary.balance),
                  entry_count: summary.entry_count,
                })),
                columns: [
                  { key: "account_code", label: "Account Code", type: "string" },
                  { key: "account_name", label: "Account Name", type: "string" },
                  { key: "account_category", label: "Category", type: "string" },
                  { key: "opening_balance", label: "Opening Balance", type: "currency" },
                  { key: "total_debits", label: "Total Debits", type: "currency" },
                  { key: "total_credits", label: "Total Credits", type: "currency" },
                  { key: "balance", label: "Balance", type: "currency" },
                  { key: "entry_count", label: "Entry Count", type: "number" },
                ],
                filters: {
                  "From Date": fromDate,
                  "To Date": toDate,
                },
              }
              const result = exportToExcel(reportData)
              if (result.success) {
                toast({ title: "Success", description: "GL Summary exported to Excel" })
              } else {
                toast({ title: "Error", description: result.error, variant: "destructive" })
              }
            }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const reportData = {
                title: "General Ledger Summary",
                subtitle: `${new Date(fromDate).toLocaleDateString("en-NG")} to ${new Date(toDate).toLocaleDateString("en-NG")}`,
                data: summaries.map((summary: any) => ({
                  account_code: summary.account_code,
                  account_name: summary.account_name,
                  account_category: summary.account_category,
                  opening_balance: Number(summary.opening_balance),
                  total_debits: Number(summary.total_debits),
                  total_credits: Number(summary.total_credits),
                  balance: Number(summary.balance),
                  entry_count: summary.entry_count,
                })),
                columns: [
                  { key: "account_code", label: "Account Code", type: "string" },
                  { key: "account_name", label: "Account Name", type: "string" },
                  { key: "account_category", label: "Category", type: "string" },
                  { key: "opening_balance", label: "Opening Balance", type: "currency" },
                  { key: "total_debits", label: "Total Debits", type: "currency" },
                  { key: "total_credits", label: "Total Credits", type: "currency" },
                  { key: "balance", label: "Balance", type: "currency" },
                  { key: "entry_count", label: "Entry Count", type: "number" },
                ],
                filters: {
                  "From Date": fromDate,
                  "To Date": toDate,
                },
              }
              const result = await exportToPDF(reportData)
              if (result.success) {
                toast({ title: "Success", description: "GL Summary exported to PDF" })
              } else {
                toast({ title: "Error", description: result.error, variant: "destructive" })
              }
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">From Date</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">To Date</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[200px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GL Summary Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Account Summaries</CardTitle>
          <CardDescription>
            {new Date(fromDate).toLocaleDateString("en-NG")} to{" "}
            {new Date(toDate).toLocaleDateString("en-NG")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">ACCOUNT CODE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ACCOUNT NAME</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">CATEGORY</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">OPENING BALANCE</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">TOTAL DEBITS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">TOTAL CREDITS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">BALANCE</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">ENTRIES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No summaries found
                    </TableCell>
                  </TableRow>
                ) : (
                  summaries.map((summary: any) => (
                    <TableRow key={summary.account_id}>
                      <TableCell className="font-mono text-gray-900">{summary.account_code}</TableCell>
                      <TableCell className="text-gray-900">{summary.account_name}</TableCell>
                      <TableCell className="text-gray-700">{summary.account_category.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right text-gray-700">
                        ₦{Number(summary.opening_balance).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        ₦{Number(summary.total_debits).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        ₦{Number(summary.total_credits).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-medium text-gray-900">
                        ₦{Number(summary.balance).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-gray-700">{summary.entry_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

