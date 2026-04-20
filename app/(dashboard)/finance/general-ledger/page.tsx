"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronRight, Search, Download } from "lucide-react"
import { cn } from "@/lib/utils"

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number) {
  return `₦${Math.abs(amount).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDisplayDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-")
  return `${day}/${month}/${year}`
}

export default function GeneralLedgerPage() {
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  )
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0])
  const [search, setSearch] = useState("")
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ["general-ledger-by-account", fromDate, toDate, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        view: "account",
        from_date: fromDate,
        to_date: toDate,
        ...(search && { search }),
      })
      const res = await fetch(`/api/finance/general-ledger?${params}`)
      if (!res.ok) throw new Error("Failed to fetch general ledger")
      return res.json()
    },
  })

  const accounts: any[] = data?.data?.accounts || []

  function toggleAccount(accountId: string) {
    setOpenAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }

  function expandAll() {
    setOpenAccounts(new Set(accounts.map((a) => a.account_id)))
  }

  function collapseAll() {
    setOpenAccounts(new Set())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">General Ledger</h1>
          <p className="text-gray-500 text-sm mt-1">
            Reporting from {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search entries..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">From</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">To</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
            </div>
            {accounts.length > 0 && (
              <div className="flex gap-2 ml-auto">
                <Button variant="ghost" size="sm" onClick={expandAll}>
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll}>
                  Collapse All
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ledger */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="py-16 text-center text-gray-400 italic">
            No ledger entries found for the selected period.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => {
            const isOpen = openAccounts.has(account.account_id)
            return (
              <div
                key={account.account_id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
              >
                {/* Account Header */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  onClick={() => toggleAccount(account.account_id)}
                >
                  <span className="flex items-center gap-3">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 text-gray-500 transition-transform duration-200",
                        isOpen && "rotate-90"
                      )}
                    />
                    <span className="font-semibold text-gray-800 text-sm">
                      {account.account_name}
                    </span>
                  </span>
                  <span className="text-sm text-gray-500 font-mono">
                    A/C Code: {account.account_code}
                  </span>
                </button>

                {/* Account Body */}
                {isOpen && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                            Trans. Date
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-gray-600">
                            Particular
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                            Trans. No.
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                            Schd./Cheque No.
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold text-gray-600 whitespace-nowrap">
                            Debit Amount
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold text-gray-600 whitespace-nowrap">
                            Credit Amount
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold text-gray-600">
                            Balance
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Opening Balance row */}
                        <TableRow className="bg-blue-50/40">
                          <TableCell className="text-xs text-gray-500">—</TableCell>
                          <TableCell className="text-xs font-medium text-gray-700">
                            OPENING BALANCE
                          </TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-right font-semibold text-sm text-gray-900 font-mono">
                            {formatCurrency(account.opening_balance)}
                          </TableCell>
                        </TableRow>

                        {/* Transaction rows */}
                        {account.entries.map((entry: any) => (
                          <TableRow key={entry.id} className="hover:bg-gray-50">
                            <TableCell className="text-xs text-gray-700 whitespace-nowrap">
                              {formatDate(entry.transaction_date)}
                            </TableCell>
                            <TableCell className="text-xs text-gray-700 max-w-[280px]">
                              <span className="line-clamp-2">{entry.description || "—"}</span>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-gray-700 whitespace-nowrap">
                              {entry.entry_number}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-gray-600 whitespace-nowrap">
                              {entry.reference_number || "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono whitespace-nowrap">
                              {entry.posting_type === "DEBIT" ? (
                                <span className="text-green-700 font-medium">
                                  {formatCurrency(Number(entry.amount))}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono whitespace-nowrap">
                              {entry.posting_type === "CREDIT" ? (
                                <span className="text-red-600 font-medium">
                                  {formatCurrency(Number(entry.amount))}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono font-semibold text-gray-900 whitespace-nowrap">
                              {formatCurrency(entry.running_balance)}
                            </TableCell>
                          </TableRow>
                        ))}

                        {/* Totals row */}
                        <TableRow className="bg-gray-50 border-t-2 border-gray-200">
                          <TableCell colSpan={4} />
                          <TableCell className="text-right text-xs font-bold text-green-700 font-mono whitespace-nowrap">
                            {formatCurrency(account.total_debit)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-red-600 font-mono whitespace-nowrap">
                            {formatCurrency(account.total_credit)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-gray-900 font-mono whitespace-nowrap">
                            {formatCurrency(account.closing_balance)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
