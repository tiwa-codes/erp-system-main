"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { AccountCategory } from "@prisma/client"
import { Search } from "lucide-react"
import { formatAccountCode, getAccountCodeSortKey } from "@/lib/finance/account-code"

interface AccountSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  category?: AccountCategory
  placeholder?: string
  disabled?: boolean
}

export function AccountSelector({
  value,
  onValueChange,
  category,
  placeholder = "Select account",
  disabled = false,
}: AccountSelectorProps) {
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["chart-of-accounts", category],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "1000",
        is_active: "true",
        ...(category && { category }),
      })
      const res = await fetch(`/api/finance/chart-of-accounts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch accounts")
      return res.json()
    },
  })

  // Use allAccounts to get a flat list including parent and child accounts.
  // Fall back to flattening hierarchy when allAccounts is unavailable.
  const allAccounts = data?.data?.allAccounts || []
  
  // Flatten hierarchical accounts if allAccounts is not available
  const flattenAccounts = (accounts: any[]): any[] => {
    const result: any[] = []
    accounts.forEach((account) => {
      result.push(account)
      if (account.child_accounts && account.child_accounts.length > 0) {
        result.push(...flattenAccounts(account.child_accounts))
      }
    })
    return result
  }
  
  const accounts = allAccounts.length > 0
    ? allAccounts
    : flattenAccounts(data?.data?.accounts || [])

  // Group accounts by category and keep deterministic ordering.
  const groupedAccounts = accounts.reduce((acc: any, account: any) => {
    const cat = account.account_category
    if (!acc[cat]) {
      acc[cat] = []
    }
    acc[cat].push(account)
    return acc
  }, {})

  const getCategoryLabel = (cat: AccountCategory) => {
    return cat.replace(/_/g, " ")
  }

  const sortByCode = (items: any[]) =>
    [...items].sort((a, b) =>
      getAccountCodeSortKey(a.account_code).localeCompare(getAccountCodeSortKey(b.account_code))
    )

  const buildCategoryHierarchy = (categoryAccounts: any[]) => {
    const accountSet = new Set(categoryAccounts.map((account) => account.id))
    const childrenMap = new Map<string, any[]>()

    categoryAccounts.forEach((account) => {
      if (account.parent_account_id && accountSet.has(account.parent_account_id)) {
        const current = childrenMap.get(account.parent_account_id) || []
        current.push(account)
        childrenMap.set(account.parent_account_id, current)
      }
    })

    const roots = sortByCode(
      categoryAccounts.filter(
        (account) => !account.parent_account_id || !accountSet.has(account.parent_account_id)
      )
    )

    const flattened: Array<any> = []

    const visit = (account: any, depth: number) => {
      const children = sortByCode(childrenMap.get(account.id) || [])
      flattened.push({
        ...account,
        depth,
        hasChildren: children.length > 0,
      })
      children.forEach((child) => visit(child, depth + 1))
    }

    roots.forEach((root) => visit(root, 0))
    return flattened
  }

  const formatAccountOption = (account: any, depth: number, hasChildren: boolean) => {
    const prefix = depth === 0 ? "" : hasChildren ? "→ " : "• "
    return `${prefix}${formatAccountCode(account.account_code)} - ${account.account_name}`
  }

  const filteredAccounts = search
    ? accounts.filter(
        (account: any) =>
          account.account_name.toLowerCase().includes(search.toLowerCase()) ||
          account.account_code.toString().includes(search) ||
          formatAccountCode(account.account_code).includes(search)
      )
    : []

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        {isLoading ? (
          <div className="p-2 text-sm text-muted-foreground">Loading accounts...</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">No accounts found</div>
        ) : search ? (
          sortByCode(filteredAccounts).map((account: any) => {
            const hasParent = !!account.parent_account_id
            const hasChildren = (account.child_accounts && account.child_accounts.length > 0) || false
            const depth = hasParent ? 1 : 0

            return (
              <SelectItem key={account.id} value={account.id}>
                {formatAccountOption(account, depth, hasChildren)}
              </SelectItem>
            )
          })
        ) : (
          Object.entries(groupedAccounts).map(([category, accounts]: [string, any]) => (
            <div key={category}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {getCategoryLabel(category as AccountCategory)}
              </div>
              {buildCategoryHierarchy(accounts).map((account: any) => {
                return (
                  <SelectItem key={account.id} value={account.id}>
                    {formatAccountOption(account, account.depth || 0, account.hasChildren || false)}
                  </SelectItem>
                )
              })}
            </div>
          ))
        )}
      </SelectContent>
    </Select>
  )
}

