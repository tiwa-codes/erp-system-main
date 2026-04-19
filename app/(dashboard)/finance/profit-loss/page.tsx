"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

export default function ProfitLossPage() {
  const { toast } = useToast()
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  )
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0])

  const { data, isLoading } = useQuery({
    queryKey: ["profit-loss", fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate,
      })
      const res = await fetch(`/api/finance/profit-loss?${params}`)
      if (!res.ok) throw new Error("Failed to fetch profit & loss")
      return res.json()
    },
  })

  const pnl = data?.data
  const income = pnl?.income || { entries: [], total: 0 }
  const expenses = pnl?.expenses || { entries: [], total: 0 }
  const netProfit = pnl?.net_profit || 0

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
          <h1 className="text-3xl font-bold text-gray-900">Profit & Loss Statement</h1>
          <p className="text-gray-600">View income and expenses for a date range</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!pnl) return
              const allEntries = [
                ...income.entries.map((e: any) => ({ ...e, type: "Income" })),
                ...expenses.entries.map((e: any) => ({ ...e, type: "Expense" })),
              ]
              const reportData = {
                title: "Profit & Loss Statement",
                subtitle: `${new Date(fromDate).toLocaleDateString("en-NG")} to ${new Date(toDate).toLocaleDateString("en-NG")}`,
                data: allEntries.map((entry: any) => ({
                  type: entry.type,
                  account_code: entry.account_code,
                  account_name: entry.account_name,
                  amount: Number(entry.amount),
                })),
                columns: [
                  { key: "type", label: "Type", type: "string" },
                  { key: "account_code", label: "Account Code", type: "string" },
                  { key: "account_name", label: "Account Name", type: "string" },
                  { key: "amount", label: "Amount", type: "currency" },
                ],
                filters: {
                  "From Date": fromDate,
                  "To Date": toDate,
                  "Total Income": `₦${Number(income.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Total Expenses": `₦${Number(expenses.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Net Profit": `₦${Number(netProfit).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                },
              }
              const result = exportToExcel(reportData)
              if (result.success) {
                toast({ title: "Success", description: "P&L Statement exported to Excel" })
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
              if (!pnl) return
              const allEntries = [
                ...income.entries.map((e: any) => ({ ...e, type: "Income" })),
                ...expenses.entries.map((e: any) => ({ ...e, type: "Expense" })),
              ]
              const reportData = {
                title: "Profit & Loss Statement",
                subtitle: `${new Date(fromDate).toLocaleDateString("en-NG")} to ${new Date(toDate).toLocaleDateString("en-NG")}`,
                data: allEntries.map((entry: any) => ({
                  type: entry.type,
                  account_code: entry.account_code,
                  account_name: entry.account_name,
                  amount: Number(entry.amount),
                })),
                columns: [
                  { key: "type", label: "Type", type: "string" },
                  { key: "account_code", label: "Account Code", type: "string" },
                  { key: "account_name", label: "Account Name", type: "string" },
                  { key: "amount", label: "Amount", type: "currency" },
                ],
                filters: {
                  "From Date": fromDate,
                  "To Date": toDate,
                  "Total Income": `₦${Number(income.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Total Expenses": `₦${Number(expenses.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Net Profit": `₦${Number(netProfit).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                },
              }
              const result = await exportToPDF(reportData)
              if (result.success) {
                toast({ title: "Success", description: "P&L Statement exported to PDF" })
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Income</CardTitle>
            <CardDescription>Revenue and income accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-gray-600">ACCOUNT</TableHead>
                    <TableHead className="text-right text-xs font-medium text-gray-600">AMOUNT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {income.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-4 text-gray-500">
                        No income entries
                      </TableCell>
                    </TableRow>
                  ) : (
                    income.entries.map((entry: any) => (
                      <TableRow key={entry.account_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{entry.account_name}</div>
                            <div className="text-xs text-gray-500 font-mono">
                              {entry.account_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          ₦{Number(entry.amount).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">Total Income</span>
                <span className="text-lg font-bold text-green-600">
                  ₦{Number(income.total).toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>Cost and expense accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-gray-600">ACCOUNT</TableHead>
                    <TableHead className="text-right text-xs font-medium text-gray-600">AMOUNT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-4 text-gray-500">
                        No expense entries
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.entries.map((entry: any) => (
                      <TableRow key={entry.account_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{entry.account_name}</div>
                            <div className="text-xs text-gray-500 font-mono">
                              {entry.account_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          ₦{Number(entry.amount).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">Total Expenses</span>
                <span className="text-lg font-bold text-red-600">
                  ₦{Number(expenses.total).toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Net Profit / Loss</CardTitle>
          <CardDescription>
            {new Date(fromDate).toLocaleDateString("en-NG")} to{" "}
            {new Date(toDate).toLocaleDateString("en-NG")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center py-4">
            <span className="text-xl font-bold text-gray-900">Net {netProfit >= 0 ? "Profit" : "Loss"}</span>
            <span
              className={`text-3xl font-bold ${
                netProfit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              ₦{Math.abs(netProfit).toLocaleString("en-NG", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

