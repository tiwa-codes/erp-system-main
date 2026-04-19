"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PermissionGate } from "@/components/ui/permission-gate"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Download } from "lucide-react"

interface UpdateCollection<T> {
  items: T[]
  pagination?: {
    total?: number
  }
}

interface PrincipalUpdate {
  enrollee_id: string
  first_name: string
  last_name: string
  status?: string
  created_at: string
  organization?: {
    name?: string
    code?: string
  } | null
  plan?: {
    name?: string
  } | null
}

interface DependentUpdate {
  dependent_id: string
  first_name: string
  last_name: string
  relationship?: string
  status?: string
  created_at: string
  principal?: {
    enrollee_id?: string
    id?: string
  } | null
}

interface ProviderMobileUpdate {
  source?: string
  status: string
  created_at: string
  payload?: unknown
  provider?: {
    facility_name?: string
  } | null
}

interface MobileUpdatesResponse {
  principals?: UpdateCollection<PrincipalUpdate>
  dependents?: UpdateCollection<DependentUpdate>
  providerUpdates?: UpdateCollection<ProviderMobileUpdate>
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending (inactive/suspended)" },
  { value: "active", label: "Active" },
  { value: "all", label: "All statuses" },
]

const TABLE_LIMIT = 6

const formatCsvLine = (values: string[]) =>
  values
    .map((value) => `"${value.replace(/"/g, '""')}"`)
    .join(",")

const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
  if (typeof window === "undefined" || rows.length === 0) {
    return
  }

  const content = [headers, ...rows].map(formatCsvLine).join("\n")
  const blob = new Blob([content], { type: "text/csv" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export default function UnderwritingMobileUpdatesPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")

  const { data, isFetching, refetch } = useQuery<MobileUpdatesResponse>({
    queryKey: ["underwriting-mobile-updates", statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("status", statusFilter)
      if (searchTerm) {
        params.set("search", searchTerm)
      }
      params.set("limit", TABLE_LIMIT.toString())
      params.set("page", "1")

      const res = await fetch(`/api/underwriting/mobile/updates?${params.toString()}`)
      if (!res.ok) {
        throw new Error("Failed to load pending updates")
      }

      const json = await res.json()
      return json.data || {}
    },
  })

  const principals = data?.principals?.items ?? []
  const dependents = data?.dependents?.items ?? []
  const providerUpdates = data?.providerUpdates?.items ?? []

  const summary = {
    principals: data?.principals?.pagination?.total ?? 0,
    dependents: data?.dependents?.pagination?.total ?? 0,
    providerUpdates: data?.providerUpdates?.pagination?.total ?? 0,
  }

  const principalRows = principals.map((item: PrincipalUpdate) => [
    item.enrollee_id,
    `${item.first_name} ${item.last_name}`,
    item.organization?.name || item.organization?.code || "—",
    item.plan?.name || "—",
    item.status || "N/A",
    new Date(item.created_at).toLocaleDateString(),
  ])

  const dependentRows = dependents.map((item: DependentUpdate) => [
    item.dependent_id,
    `${item.first_name} ${item.last_name}`,
    item.principal?.enrollee_id || item.principal?.id || "—",
    item.relationship || "—",
    item.status || "N/A",
    new Date(item.created_at).toLocaleDateString(),
  ])

  const providerRows: string[][] = providerUpdates.map((item: ProviderMobileUpdate) => [
    item.provider?.facility_name ?? "Unknown",
    (item.source || "N/A").replace(/_/g, " "),
    item.status,
    new Date(item.created_at).toLocaleString(),
    typeof item.payload === "object" && item.payload !== null
      ? JSON.stringify(item.payload)
      : String(item.payload || "—"),
  ])

  const totalCount = summary.principals + summary.dependents + summary.providerUpdates

  return (
    <PermissionGate module="underwriting" action="view">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pending Updates</CardTitle>
              <CardDescription>
                All principals, dependents, and HCP changes that landed from mobile registration/updates
                and now await underwriting approval are listed here.
              </CardDescription>
            </div>
            <Badge className="text-xs uppercase border border-slate-200 bg-slate-50 text-slate-800">
              {totalCount} pending items
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Status</p>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Search principals, dependents, providers"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button onClick={() => refetch()} variant="outline">
                Refresh
              </Button>
              <span className="text-xs text-gray-500">{isFetching ? "Updating…" : "Showing latest data"}</span>
            </div>
            <div className="grid gap-2">
              <div className="text-xs text-gray-500">Counts</div>
              <div className="flex items-center gap-2 text-sm">
                <span>Principals: {summary.principals}</span>
                <span>Dependents: {summary.dependents}</span>
                <span>Mobile updates: {summary.providerUpdates}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Pending Principals</CardTitle>
                <CardDescription>Principals with inactive or suspended statuses requiring attention.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "pending-principals.csv",
                      ["Enrollee ID", "Name", "Organization", "Plan", "Status", "Created"],
                      principalRows
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push("/underwriting/pending-updates")}
                >
                  Pending Requests
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {principals.length === 0 ? (
                <p className="text-sm text-gray-500">No pending principals.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Enrollee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {principals.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.enrollee_id}</TableCell>
                        <TableCell>
                          {item.first_name} {item.last_name}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold">{item.organization?.name ?? "Unknown"}</div>
                          <p className="text-xs text-gray-500">{item.organization?.code}</p>
                        </TableCell>
                        <TableCell>{item.plan?.name ?? "—"}</TableCell>
                        <TableCell>
                          <StatusIndicator status={item.status || "pending"} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/underwriting/pending-updates/principals/${item.id}`)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Pending Dependents</CardTitle>
                <CardDescription>Dependents awaiting approval or requiring new documentation.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "pending-dependents.csv",
                      ["Dependent ID", "Name", "Principal", "Relationship", "Status", "Created"],
                      dependentRows
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push("/underwriting/pending-updates")}
                >
                  Pending Requests
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {dependents.length === 0 ? (
                <p className="text-sm text-gray-500">No pending dependents.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dependent ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dependents.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.dependent_id}</TableCell>
                        <TableCell>
                          {item.first_name} {item.last_name}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-semibold">{item.principal?.enrollee_id}</p>
                          <p className="text-xs text-gray-500">
                            {item.principal?.first_name} {item.principal?.last_name}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-slate-100 text-slate-800 text-xs uppercase">
                            {item.relationship?.replace("_", " ") ?? "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusIndicator status={item.status || "pending"} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/underwriting/pending-updates/dependents/${item.id}`)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Pending Mobile Updates</CardTitle>
                <CardDescription>All mobile-submitted updates waiting for underwriting approval.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "pending-hcp-updates.csv",
                      ["Provider", "Source", "Status", "Timestamp", "Payload"],
                      providerRows
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push("/provider")}
                >
                  Pending Requests
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {providerUpdates.length === 0 ? (
                <p className="text-sm text-gray-500">No pending provider updates.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Request Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerUpdates.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.target === "PRINCIPAL" ? (
                            <div>
                              <div className="font-semibold">{item.principal?.first_name} {item.principal?.last_name}</div>
                              <div className="text-xs text-gray-500">{item.principal?.enrollee_id}</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold">{item.provider?.facility_name ?? "Unknown"}</div>
                              <div className="text-xs text-secondary-500 font-bold uppercase text-[10px]">Provider</div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          {item.target === "PRINCIPAL" ? (
                             <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary-600 bg-primary-50">
                               {item.payload?.type?.replace("_", " ") || "Enrollee Update"}
                             </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-secondary-600 bg-secondary-50">
                               {(item.source || "N/A").replace(/_/g, " ")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusIndicator status={item.status || "pending"} />
                        </TableCell>
                        <TableCell className="text-xs">{new Date(item.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (item.target === "PRINCIPAL" && item.principal?.id) {
                                router.push(`/underwriting/principals/${item.principal.id}`)
                              } else if (item.provider?.id) {
                                router.push(`/provider/${item.provider.id}`)
                              }
                            }}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PermissionGate>
  )
}
