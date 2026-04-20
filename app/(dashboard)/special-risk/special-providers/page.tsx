"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Eye, Edit, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { PermissionGate } from "@/components/ui/permission-gate"
import {

export const dynamic = 'force-dynamic'
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function SpecialProvidersPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["special-providers", page, search, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(typeFilter !== "all" && { type: typeFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      })
      const res = await fetch(`/api/special-risk/providers?${params}`)
      if (!res.ok) throw new Error("Failed to fetch providers")
      return res.json()
    },
  })

  const providers = data?.data?.providers || []
  const pagination = data?.data?.pagination

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      FOREIGN_PROVIDER: "bg-red-100 text-red-800",
      AMBULANCE_COMPANY: "bg-green-100 text-green-800",
      LOGISTICS_COMPANY: "bg-purple-100 text-purple-800",
    }
    return colors[type] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">International Coverage</h1>
          <p className="text-muted-foreground">
            Manage foreign providers, ambulance companies, and logistics companies
          </p>
        </div>
        <PermissionGate permission="special-risk.add">
          <Link href="/special-risk/special-providers/add">
            <Button className="bg-[#BE1522] hover:bg-[#9B1219] text-white">
              <Plus className="h-4 w-4 mr-1" />
              Add Provider
            </Button>
          </Link>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>International Coverage</CardTitle>
              <CardDescription>All registered international coverage providers</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="FOREIGN_PROVIDER">Foreign Provider</SelectItem>
                  <SelectItem value="AMBULANCE_COMPANY">Ambulance Company</SelectItem>
                  <SelectItem value="LOGISTICS_COMPANY">Logistics Company</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search providers..."
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
          ) : providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No international coverage providers found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider ID</TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((provider: any) => (
                    <TableRow key={provider.id}>
                      <TableCell className="font-mono">{provider.provider_id}</TableCell>
                      <TableCell className="font-medium">{provider.company_name}</TableCell>
                      <TableCell>
                        <Badge className={getTypeBadge(provider.organization_type)}>
                          {provider.organization_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{provider.country}</TableCell>
                      <TableCell>{provider.currency}</TableCell>
                      <TableCell>
                        <StatusIndicator status={provider.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <PermissionGate permission="special-risk.view">
                              <DropdownMenuItem
                                onClick={() => router.push(`/special-risk/special-providers/${provider.id}`)}
                                className="w-full justify-start text-xs"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                            </PermissionGate>
                            {provider.status !== "APPROVED" && provider.status !== "REJECTED" && (
                              <PermissionGate permission="special-risk.edit">
                                <DropdownMenuItem
                                  onClick={() => router.push(`/special-risk/special-providers/${provider.id}/edit`)}
                                  className="w-full justify-start text-xs"
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              </PermissionGate>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
