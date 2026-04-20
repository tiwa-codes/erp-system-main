"use client"

export const dynamic = 'force-dynamic'

import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
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
import { AccountCategory, AccountSubCategory, PostingType } from "@prisma/client"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"
import { formatAccountCode } from "@/lib/finance/account-code"



function getDefaultBalanceType(category: AccountCategory): PostingType {
  return category === AccountCategory.ASSET || category === AccountCategory.EXPENSE
    ? PostingType.DEBIT
    : PostingType.CREDIT
}

export default function EditChartOfAccountPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ["chart-of-account", id],
    queryFn: async () => {
      const res = await fetch(`/api/finance/chart-of-accounts/${id}`)
      if (!res.ok) throw new Error("Failed to fetch account")
      return res.json()
    },
  })

  const account = data?.data

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/finance/chart-of-accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update account")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account updated successfully",
      })
      router.push(`/finance/chart-of-accounts/${id}`)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account",
        variant: "destructive",
      })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Account not found</p>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)

    const subCategory = formData.get("sub_category") as string
    updateMutation.mutate({
      account_name: formData.get("account_name"),
      account_category: formData.get("account_category"),
      sub_category: subCategory && subCategory !== "none" ? subCategory : undefined,
      description: formData.get("description") || undefined,
      opening_balance: parseFloat(formData.get("opening_balance") as string) || 0,
      balance_type: formData.get("balance_type") || undefined,
      is_active: formData.get("is_active") === "true",
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
          <h1 className="text-3xl font-bold text-gray-900">Edit Chart of Account</h1>
          <p className="text-gray-600">Account Code: {formatAccountCode(account.account_code)}</p>
        </div>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-blue-600">Account Information</CardTitle>
          <CardDescription>Update the account details below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="account_code" className="text-sm font-medium text-gray-700">
                Account Code
              </Label>
              <Input
                id="account_code"
                value={formatAccountCode(account.account_code)}
                disabled
                className="bg-gray-100 text-gray-500"
              />
              <p className="text-xs text-gray-500">
                Account code cannot be changed if GL entries exist
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_name" className="text-sm font-medium text-gray-700">
                Account Name *
              </Label>
              <Input
                id="account_name"
                name="account_name"
                defaultValue={account.account_name}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="account_category" className="text-sm font-medium text-gray-700">
                  Account Category *
                </Label>
                <Select
                  name="account_category"
                  defaultValue={account.account_category}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label htmlFor="sub_category" className="text-sm font-medium text-gray-700">
                  Sub-Category
                </Label>
                <Select
                  name="sub_category"
                  defaultValue={account.sub_category || "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {Object.values(AccountSubCategory).map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="opening_balance" className="text-sm font-medium text-gray-700">
                  Opening Balance
                </Label>
                <Input
                  id="opening_balance"
                  name="opening_balance"
                  type="number"
                  step="0.01"
                  defaultValue={Number(account.opening_balance)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="balance_type" className="text-sm font-medium text-gray-700">
                  Balance Type
                </Label>
                <Select
                  name="balance_type"
                  defaultValue={account.balance_type || getDefaultBalanceType(account.account_category)}
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
                <Select name="is_active" defaultValue={account.is_active ? "true" : "false"}>
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
                name="description"
                defaultValue={account.description || ""}
                rows={3}
              />
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
              >
                {updateMutation.isPending ? "Updating..." : "Update Account"}
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

