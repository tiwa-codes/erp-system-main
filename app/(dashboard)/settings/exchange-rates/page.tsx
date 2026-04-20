"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Lock, RefreshCw } from "lucide-react"
import Link from "next/link"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export const dynamic = 'force-dynamic'

export default function ExchangeRatesPage() {
  const [search, setSearch] = useState("")
  const [fromCurrency, setFromCurrency] = useState("")
  const [toCurrency, setToCurrency] = useState("")
  const [rateType, setRateType] = useState("")
  const [page, setPage] = useState(1)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ["exchange-rates", page, search, fromCurrency, toCurrency, rateType],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(fromCurrency && { from_currency: fromCurrency }),
        ...(toCurrency && { to_currency: toCurrency }),
        ...(rateType && { rate_type: rateType }),
      })
      const res = await fetch(`/api/settings/exchange-rates?${params}`)
      if (!res.ok) throw new Error("Failed to fetch rates")
      return res.json()
    },
  })

  const addRateMutation = useMutation({
    mutationFn: async (rateData: any) => {
      const res = await fetch("/api/settings/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rateData),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create rate")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] })
      setIsAddDialogOpen(false)
      toast({
        title: "Success",
        description: "Exchange rate created successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const rates = data?.data?.rates || []
  const pagination = data?.data?.pagination

  const handleAddRate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const rateData = {
      from_currency: formData.get("from_currency"),
      to_currency: formData.get("to_currency"),
      rate: parseFloat(formData.get("rate") as string),
      rate_type: formData.get("rate_type"),
      source: formData.get("source"),
      effective_date: formData.get("effective_date") || new Date().toISOString(),
    }
    addRateMutation.mutate(rateData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Exchange Rates</h1>
          <p className="text-muted-foreground">
            Manage exchange rates for foreign currency conversion
          </p>
        </div>
        <PermissionGate permission="settings.add">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Add Rate
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Exchange Rate</DialogTitle>
                <DialogDescription>
                  Create a new manual exchange rate
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddRate} className="space-y-4">
                <div className="space-y-2">
                  <Label>From Currency</Label>
                  <Input
                    name="from_currency"
                    placeholder="USD"
                    maxLength={3}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Currency</Label>
                  <Input
                    name="to_currency"
                    placeholder="NGN"
                    maxLength={3}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate</Label>
                  <Input
                    name="rate"
                    type="number"
                    step="0.0001"
                    placeholder="1500.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate Type</Label>
                  <Select name="rate_type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUYING">Buying</SelectItem>
                      <SelectItem value="SELLING">Selling</SelectItem>
                      <SelectItem value="MID_MARKET">Mid Market</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select name="source" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUAL">Manual</SelectItem>
                      <SelectItem value="AUTOMATIC_API">Automatic API</SelectItem>
                      <SelectItem value="FIXED_CONTRACT">Fixed Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input
                    name="effective_date"
                    type="datetime-local"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addRateMutation.isPending}>
                    {addRateMutation.isPending ? "Creating..." : "Create Rate"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Exchange Rates</CardTitle>
              <CardDescription>All exchange rates in the system</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="From" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="NGN">NGN</SelectItem>
                </SelectContent>
              </Select>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="To" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="NGN">NGN</SelectItem>
                </SelectContent>
              </Select>
              <Select value={rateType} onValueChange={setRateType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Rate Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="BUYING">Buying</SelectItem>
                  <SelectItem value="SELLING">Selling</SelectItem>
                  <SelectItem value="MID_MARKET">Mid Market</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : rates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No exchange rates found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((rate: any) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-mono">{rate.from_currency}</TableCell>
                      <TableCell className="font-mono">{rate.to_currency}</TableCell>
                      <TableCell className="font-medium">
                        {Number(rate.rate).toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rate.rate_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rate.source}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(rate.effective_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {rate.is_locked ? (
                          <Badge className="bg-green-100 text-green-800">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {rate.created_by
                          ? `${rate.created_by.first_name} ${rate.created_by.last_name}`
                          : "System"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                      disabled={page === pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}








