"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AccountCategory, PostingType } from "@prisma/client"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"
import { formatAccountCode } from "@/lib/finance/account-code"

const ACCOUNT_CODE_RANGES: Record<AccountCategory, { min: number; max: number }> = {
  ASSET: { min: 100000, max: 199999 },
  LIABILITY: { min: 200000, max: 299999 },
  EQUITY: { min: 300000, max: 399999 },
  INCOME: { min: 400000, max: 499999 },
  EXPENSE: { min: 500000, max: 599999 },
}

const ACCOUNT_CODE_INPUT_REGEX = /^\d{6}(-\d{3})?$/

function parseAccountCodeInput(rawValue: string): { storedCode: number; baseCode: number } | null {
  const value = rawValue.trim()
  if (!ACCOUNT_CODE_INPUT_REGEX.test(value)) return null

  const [basePart, suffixPart] = value.split("-")
  const baseCode = Number(basePart)
  const storedCode = suffixPart ? Number(`${basePart}${suffixPart}`) : baseCode

  if (!Number.isInteger(baseCode) || !Number.isInteger(storedCode)) return null
  return { storedCode, baseCode }
}

function getDefaultBalanceType(category: AccountCategory): PostingType {
  return category === AccountCategory.ASSET || category === AccountCategory.EXPENSE
    ? PostingType.DEBIT
    : PostingType.CREDIT
}

export default function AddChartOfAccountPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [formData, setFormData] = useState<{
    account_code: string
    account_name: string
    account_category: AccountCategory | ""
    parent_account_id: string
    description: string
    opening_balance: string
    balance_type: PostingType
    is_active: boolean
  }>({
    account_code: "",
    account_name: "",
    account_category: "" as AccountCategory | "",
    parent_account_id: "",
    description: "",
    opening_balance: "0",
    balance_type: PostingType.DEBIT,
    is_active: true,
  })

  const [suggestedCode, setSuggestedCode] = useState<number | null>(null)

  // Fetch accounts for parent selection
  const { data: accountsData } = useQuery({
    queryKey: ["chart-of-accounts-for-parent", formData.account_category],
    queryFn: async () => {
      if (!formData.account_category) return { data: { accounts: [] } }
      const params = new URLSearchParams({
        category: formData.account_category,
        is_active: "true",
        limit: "1000",
      })
      const res = await fetch(`/api/finance/chart-of-accounts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch accounts")
      return res.json()
    },
    enabled: !!formData.account_category,
  })

  const availableParents = accountsData?.data?.allAccounts || []

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/finance/chart-of-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create account")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account created successfully",
      })
      router.push("/finance/chart-of-accounts")
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      })
    },
  })

  const handleCategoryChange = async (category: AccountCategory) => {
    setFormData({
      ...formData,
      account_category: category,
      account_code: "",
      parent_account_id: "", // Reset parent when category changes
      balance_type: getDefaultBalanceType(category),
    })

    // Suggest next available code in range
    const range = ACCOUNT_CODE_RANGES[category]
    const res = await fetch(
      `/api/finance/chart-of-accounts?category=${category}&limit=1000`
    )
    if (res.ok) {
      const data = await res.json()
      const existingCodes = data.data?.allAccounts?.map((a: any) => a.account_code) || []
      for (let code = range.min; code <= range.max; code++) {
        if (!existingCodes.includes(code)) {
          setSuggestedCode(code)
          break
        }
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.account_code || !formData.account_name || !formData.account_category) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    const parsedCode = parseAccountCodeInput(formData.account_code)
    if (!parsedCode) {
      toast({
        title: "Error",
        description: "Account code format must be 6 digits or 6 digits followed by - and 3 digits (e.g. 100100 or 100100-001)",
        variant: "destructive",
      })
      return
    }

    const range = ACCOUNT_CODE_RANGES[formData.account_category]

    if (parsedCode.baseCode < range.min || parsedCode.baseCode > range.max) {
      toast({
        title: "Error",
        description: `Account code prefix must be between ${range.min} and ${range.max} for ${formData.account_category} category`,
        variant: "destructive",
      })
      return
    }
    
    createMutation.mutate({
      account_code: parsedCode.storedCode,
      account_name: formData.account_name,
      account_category: formData.account_category,
      parent_account_id: formData.parent_account_id || undefined,
      description: formData.description || undefined,
      opening_balance: parseFloat(formData.opening_balance) || 0,
      balance_type: formData.balance_type,
      is_active: formData.is_active,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add Chart of Account</h1>
          <p className="text-gray-600">Create a new account in the chart of accounts</p>
        </div>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600">Account Information</CardTitle>
          <CardDescription>Fill in the details to create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="account_category" className="text-sm font-medium text-gray-700">
                  Account Category *
                </Label>
                <Select
                  value={formData.account_category}
                  onValueChange={(value) => handleCategoryChange(value as AccountCategory)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(AccountCategory).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_code" className="text-sm font-medium text-gray-700">
                  Account Code *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="account_code"
                    type="text"
                    value={formData.account_code}
                    onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                    placeholder={suggestedCode ? suggestedCode.toString() : "e.g. 100100-001"}
                    required
                  />
                  {suggestedCode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, account_code: suggestedCode.toString() })}
                    >
                      Use {suggestedCode}
                    </Button>
                  )}
                </div>
                {formData.account_category && (
                  <p className="text-xs text-gray-500">
                    Prefix range: {ACCOUNT_CODE_RANGES[formData.account_category].min} -{" "}
                    {ACCOUNT_CODE_RANGES[formData.account_category].max} (optional suffix: -001)
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_name" className="text-sm font-medium text-gray-700">
                Account Name *
              </Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                placeholder="e.g. Cash at Bank"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="parent_account" className="text-sm font-medium text-gray-700">
                  Parent Account
                </Label>
                <Select
                  value={formData.parent_account_id}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      parent_account_id: value === "none" ? "" : value,
                    })
                  }
                  disabled={!formData.account_category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent account (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None - Create as Parent Account</SelectItem>
                    {availableParents
                      .filter((acc: any) => !acc.parent_account_id) // Only show parent accounts
                      .map((account: any) => (
                        <SelectItem key={account.id} value={account.id}>
                          {formatAccountCode(account.account_code)} - {account.account_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Select a parent account to create a child account, or leave as "None" to create a parent account
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="opening_balance" className="text-sm font-medium text-gray-700">
                  Opening Balance
                </Label>
                <Input
                  id="opening_balance"
                  type="number"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="balance_type" className="text-sm font-medium text-gray-700">
                  Balance Type *
                </Label>
                <Select
                  value={formData.balance_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, balance_type: value as PostingType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PostingType.DEBIT}>Debit</SelectItem>
                    <SelectItem value={PostingType.CREDIT}>Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Status
                </Label>
                <Select
                  value={formData.is_active ? "true" : "false"}
                  onValueChange={(value) => setFormData({ ...formData, is_active: value === "true" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
              >
                {createMutation.isPending ? "Creating..." : "Create Account"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

