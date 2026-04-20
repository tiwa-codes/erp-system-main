"use client"

export const dynamic = 'force-dynamic'

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
import { FileSpreadsheet, FileText, AlertCircle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { exportToExcel, exportToPDF } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"



export default function BalanceSheetPage() {
  const { toast } = useToast()
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0])

  const { data, isLoading } = useQuery({
    queryKey: ["balance-sheet", asOfDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        as_of_date: asOfDate,
      })
      const res = await fetch(`/api/finance/balance-sheet?${params}`)
      if (!res.ok) throw new Error("Failed to fetch balance sheet")
      return res.json()
    },
  })

  const balanceSheet = data?.data
  const assets = balanceSheet?.assets || { entries: [], total: 0 }
  const liabilities = balanceSheet?.liabilities || { entries: [], total: 0 }
  const equity = balanceSheet?.equity || { entries: [], total: 0 }
  const isBalanced = balanceSheet?.is_balanced

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
          <h1 className="text-3xl font-bold text-gray-900">Balance Sheet</h1>
          <p className="text-gray-600">View balance sheet as of a specific date</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!balanceSheet) return
              const allEntries = [
                ...assets.entries.map((e: any) => ({ ...e, section: "Assets" })),
                ...liabilities.entries.map((e: any) => ({ ...e, section: "Liabilities" })),
                ...equity.entries.map((e: any) => ({ ...e, section: "Equity" })),
              ]
              const reportData = {
                title: "Balance Sheet",
                subtitle: `As of ${new Date(asOfDate).toLocaleDateString("en-NG")}`,
                data: allEntries.map((entry: any) => ({
                  section: entry.section,
                  account_code: entry.account_code,
                  account_name: entry.account_name,
                  balance: Number(entry.balance),
                })),
                columns: [
                  { key: "section", label: "Section", type: "string" },
                  { key: "account_code", label: "Account Code", type: "string" },
                  { key: "account_name", label: "Account Name", type: "string" },
                  { key: "balance", label: "Balance", type: "currency" },
                ],
                filters: {
                  "As of Date": asOfDate,
                  "Total Assets": `₦${Number(assets.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Total Liabilities": `₦${Number(liabilities.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Total Equity": `₦${Number(equity.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Liabilities + Equity": `₦${Number(liabilities.total + equity.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                },
              }
              const result = exportToExcel(reportData)
              if (result.success) {
                toast({ title: "Success", description: "Balance Sheet exported to Excel" })
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
              if (!balanceSheet) return
              const allEntries = [
                ...assets.entries.map((e: any) => ({ ...e, section: "Assets" })),
                ...liabilities.entries.map((e: any) => ({ ...e, section: "Liabilities" })),
                ...equity.entries.map((e: any) => ({ ...e, section: "Equity" })),
              ]
              const reportData = {
                title: "Balance Sheet",
                subtitle: `As of ${new Date(asOfDate).toLocaleDateString("en-NG")}`,
                data: allEntries.map((entry: any) => ({
                  section: entry.section,
                  account_code: entry.account_code,
                  account_name: entry.account_name,
                  balance: Number(entry.balance),
                })),
                columns: [
                  { key: "section", label: "Section", type: "string" },
                  { key: "account_code", label: "Account Code", type: "string" },
                  { key: "account_name", label: "Account Name", type: "string" },
                  { key: "balance", label: "Balance", type: "currency" },
                ],
                filters: {
                  "As of Date": asOfDate,
                  "Total Assets": `₦${Number(assets.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Total Liabilities": `₦${Number(liabilities.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Total Equity": `₦${Number(equity.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                  "Liabilities + Equity": `₦${Number(liabilities.total + equity.total).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
                },
              }
              const result = await exportToPDF(reportData)
              if (result.success) {
                toast({ title: "Success", description: "Balance Sheet exported to PDF" })
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
              <label className="text-sm font-medium text-gray-700">As of Date</label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-[200px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isBalanced === false && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Balance sheet is not balanced! Assets ({assets.total.toFixed(2)}) does not equal
            Liabilities + Equity ({(liabilities.total + equity.total).toFixed(2)})
          </AlertDescription>
        </Alert>
      )}

      {isBalanced === true && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Balance sheet is balanced: Assets = Liabilities + Equity
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Assets</CardTitle>
            <CardDescription>Company assets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-gray-600">ACCOUNT</TableHead>
                    <TableHead className="text-right text-xs font-medium text-gray-600">BALANCE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-4 text-gray-500">
                        No asset accounts
                      </TableCell>
                    </TableRow>
                  ) : (
                    assets.entries.map((entry: any) => (
                      <TableRow key={entry.account_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{entry.account_name}</div>
                            <div className="text-xs text-gray-500 font-mono">
                              {entry.account_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-900">
                          ₦{Number(entry.balance).toLocaleString("en-NG", {
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
                <span className="font-bold text-gray-900">Total Assets</span>
                <span className="text-lg font-bold text-gray-900">
                  ₦{Number(assets.total).toLocaleString("en-NG", {
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
            <CardTitle>Liabilities</CardTitle>
            <CardDescription>Company liabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-gray-600">ACCOUNT</TableHead>
                    <TableHead className="text-right text-xs font-medium text-gray-600">BALANCE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liabilities.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-4 text-gray-500">
                        No liability accounts
                      </TableCell>
                    </TableRow>
                  ) : (
                    liabilities.entries.map((entry: any) => (
                      <TableRow key={entry.account_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{entry.account_name}</div>
                            <div className="text-xs text-gray-500 font-mono">
                              {entry.account_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-900">
                          ₦{Number(entry.balance).toLocaleString("en-NG", {
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
                <span className="font-bold text-gray-900">Total Liabilities</span>
                <span className="text-lg font-bold text-gray-900">
                  ₦{Number(liabilities.total).toLocaleString("en-NG", {
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
            <CardTitle>Equity</CardTitle>
            <CardDescription>Company equity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-gray-600">ACCOUNT</TableHead>
                    <TableHead className="text-right text-xs font-medium text-gray-600">BALANCE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equity.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-4 text-gray-500">
                        No equity accounts
                      </TableCell>
                    </TableRow>
                  ) : (
                    equity.entries.map((entry: any) => (
                      <TableRow key={entry.account_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{entry.account_name}</div>
                            <div className="text-xs text-gray-500 font-mono">
                              {entry.account_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-900">
                          ₦{Number(entry.balance).toLocaleString("en-NG", {
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
                <span className="font-bold text-gray-900">Total Equity</span>
                <span className="text-lg font-bold text-gray-900">
                  ₦{Number(equity.total).toLocaleString("en-NG", {
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
          <CardTitle>Balance Sheet Summary</CardTitle>
          <CardDescription>As of {new Date(asOfDate).toLocaleDateString("en-NG")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-gray-900">Total Assets</span>
              <span className="text-xl font-bold text-gray-900">
                ₦{Number(assets.total).toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-gray-900">Total Liabilities</span>
              <span className="text-xl font-bold text-gray-900">
                ₦{Number(liabilities.total).toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-gray-900">Total Equity</span>
              <span className="text-xl font-bold text-gray-900">
                ₦{Number(equity.total).toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-900">Liabilities + Equity</span>
                <span className="text-2xl font-bold text-gray-900">
                  ₦{Number(liabilities.total + equity.total).toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

