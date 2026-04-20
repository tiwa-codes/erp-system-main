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
import { Download, AlertCircle, CheckCircle, FileSpreadsheet, FileText } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { exportToExcel, exportToPDF } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"

export const dynamic = 'force-dynamic'

export default function TrialBalancePage() {
  const { toast } = useToast()
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  )
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0])

  const { data, isLoading } = useQuery({
    queryKey: ["trial-balance", fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate,
      })
      const res = await fetch(`/api/finance/trial-balance?${params}`)
      if (!res.ok) throw new Error("Failed to fetch trial balance")
      return res.json()
    },
  })

  const trialBalance = data?.data
  const entries = trialBalance?.entries || []
  const totals = trialBalance?.totals

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
          <h1 className="text-3xl font-bold text-gray-900">Trial Balance</h1>
          <p className="text-gray-600">View trial balance for a date range</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!trialBalance) return
              const reportData = {
                title: "Trial Balance Report",
                subtitle: `${new Date(fromDate).toLocaleDateString("en-NG")} to ${new Date(toDate).toLocaleDateString("en-NG")}`,
                data: entries.map((entry: any) => ({
                  account_code: entry.account_code,
                  account_name: entry.account_name,
                  total_debits: Number(entry.total_debits),
                  total_credits: Number(entry.total_credits),
                })),
                columns: [
                  { key: "account_code", label: "Account Code", type: "string" },
                  { key: "account_name", label: "Account Name", type: "string" },
                  { key: "total_debits", label: "Total Debits", type: "currency" },
                  { key: "total_credits", label: "Total Credits", type: "currency" },
                ],
                filters: {
                  "From Date": fromDate,
                  "To Date": toDate,
                },
              }
              const result = exportToExcel(reportData)
              if (result.success) {
                toast({ title: "Success", description: "Trial Balance exported to Excel" })
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
              if (!trialBalance) return
              const reportData = {
                title: "Trial Balance Report",
                subtitle: `${new Date(fromDate).toLocaleDateString("en-NG")} to ${new Date(toDate).toLocaleDateString("en-NG")}`,
                data: entries.map((entry: any) => ({
                  account_code: entry.account_code,
                  account_name: entry.account_name,
                  total_debits: Number(entry.total_debits),
                  total_credits: Number(entry.total_credits),
                })),
                columns: [
                  { key: "account_code", label: "Account Code", type: "string" },
                  { key: "account_name", label: "Account Name", type: "string" },
                  { key: "total_debits", label: "Total Debits", type: "currency" },
                  { key: "total_credits", label: "Total Credits", type: "currency" },
                ],
                filters: {
                  "From Date": fromDate,
                  "To Date": toDate,
                },
              }
              const result = await exportToPDF(reportData)
              if (result.success) {
                toast({ title: "Success", description: "Trial Balance exported to PDF" })
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

      {trialBalance?.is_balanced === false && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Trial balance is not balanced! Total debits ({totals?.total_debits.toFixed(2)}) does not
            equal total credits ({totals?.total_credits.toFixed(2)})
          </AlertDescription>
        </Alert>
      )}

      {trialBalance?.is_balanced === true && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Trial balance is balanced correctly</AlertDescription>
        </Alert>
      )}

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Trial Balance Report</CardTitle>
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
                  <TableHead className="text-right text-xs font-medium text-gray-600">DEBITS</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">CREDITS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {entries.map((entry: any) => (
                      <TableRow key={entry.account_id}>
                        <TableCell className="font-mono text-gray-900">{entry.account_code}</TableCell>
                        <TableCell className="text-gray-900">{entry.account_name}</TableCell>
                        <TableCell className="text-right text-gray-700">
                          ₦{Number(entry.total_debits).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right text-gray-700">
                          ₦{Number(entry.total_credits).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {totals && (
                      <TableRow className="font-bold bg-gray-50">
                        <TableCell colSpan={2} className="text-gray-900">TOTALS</TableCell>
                        <TableCell className="text-right text-gray-900">
                          ₦{Number(totals.total_debits).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right text-gray-900">
                          ₦{Number(totals.total_credits).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

