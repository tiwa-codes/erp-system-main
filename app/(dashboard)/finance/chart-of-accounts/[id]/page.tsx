"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { ArrowLeft, Edit, DollarSign } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { formatAccountCode } from "@/lib/finance/account-code"
import {

export const dynamic = 'force-dynamic'
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function ChartOfAccountDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ["chart-of-account", id],
    queryFn: async () => {
      const res = await fetch(`/api/finance/chart-of-accounts/${id}`)
      if (!res.ok) throw new Error("Failed to fetch account")
      return res.json()
    },
  })

  const { data: balanceData } = useQuery({
    queryKey: ["account-balance", id],
    queryFn: async () => {
      const res = await fetch(`/api/finance/chart-of-accounts/${id}/balance`)
      if (!res.ok) throw new Error("Failed to fetch balance")
      return res.json()
    },
    enabled: !!data?.data,
  })

  const { data: glEntriesData } = useQuery({
    queryKey: ["account-gl-entries", id],
    queryFn: async () => {
      const params = new URLSearchParams({
        account_ids: id,
        limit: "10",
        page: "1",
      })
      const res = await fetch(`/api/finance/general-ledger?${params}`)
      if (!res.ok) throw new Error("Failed to fetch GL entries")
      return res.json()
    },
    enabled: !!data?.data,
  })

  const account = data?.data
  const balance = balanceData?.data
  const glEntries = glEntriesData?.data?.entries || []

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!account) {
    return <div className="text-center py-8">Account not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{account.account_name}</h1>
          <p className="text-gray-600">Account Code: {formatAccountCode(account.account_code)}</p>
        </div>
        <PermissionGate permission="finance:edit">
          <Button onClick={() => router.push(`/finance/chart-of-accounts/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Basic account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Account Code</div>
              <div className="font-mono text-lg text-gray-900">{formatAccountCode(account.account_code)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Account Name</div>
              <div className="font-medium text-gray-900">{account.account_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Category</div>
              <div className="text-gray-900">{account.account_category.replace(/_/g, " ")}</div>
            </div>
            {account.sub_category && (
              <div>
                <div className="text-sm text-gray-500">Sub-Category</div>
                <div className="text-gray-900">{account.sub_category.replace(/_/g, " ")}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <StatusIndicator status={account.is_active ? "ACTIVE" : "INACTIVE"} />
            </div>
            {account.description && (
              <div>
                <div className="text-sm text-gray-500">Description</div>
                <div className="text-gray-900">{account.description}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Account Balance
            </CardTitle>
            <CardDescription>Current balance information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {balance ? (
              <>
                <div>
                  <div className="text-sm text-gray-500">Opening Balance</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₦{Number(balance.opening_balance).toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Debits</div>
                  <div className="text-lg font-medium text-gray-900">
                    ₦{Number(balance.total_debits).toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Credits</div>
                  <div className="text-lg font-medium text-gray-900">
                    ₦{Number(balance.total_credits).toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="text-sm text-gray-500">Current Balance</div>
                  <div className="text-3xl font-bold text-gray-900">
                    ₦{Number(balance.current_balance).toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-500">Loading balance...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {account.child_accounts && account.child_accounts.length > 0 && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Child Accounts</CardTitle>
            <CardDescription>Sub-accounts under this account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-gray-600">CODE</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">NAME</TableHead>
                    <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.child_accounts.map((child: any) => (
                    <TableRow key={child.id}>
                      <TableCell className="font-mono text-gray-900">{formatAccountCode(child.account_code)}</TableCell>
                      <TableCell className="text-gray-900">{child.account_name}</TableCell>
                      <TableCell>
                        <StatusIndicator status={child.is_active ? "ACTIVE" : "INACTIVE"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Recent General Ledger Entries</CardTitle>
          <CardDescription>Latest transactions for this account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ENTRY #</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">REFERENCE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">DESCRIPTION</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">DEBIT</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">CREDIT</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-600">BALANCE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {glEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No GL entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  glEntries.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-gray-700">
                        {new Date(entry.transaction_date).toLocaleDateString("en-NG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-700">{entry.entry_number}</TableCell>
                      <TableCell className="text-gray-700">
                        {entry.reference_number || "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-gray-700">{entry.description || "—"}</TableCell>
                      <TableCell className="text-right">
                        {entry.posting_type === "DEBIT" ? (
                          <span className="text-green-600 font-medium">
                            ₦{Number(entry.amount).toLocaleString("en-NG", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.posting_type === "CREDIT" ? (
                          <span className="text-red-600 font-medium">
                            ₦{Number(entry.amount).toLocaleString("en-NG", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-gray-900">
                        ₦{Number(entry.running_balance || 0).toLocaleString("en-NG", {
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
          {glEntries.length > 0 && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/finance/general-ledger?account_ids=${id}`)}
              >
                View All Entries
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

