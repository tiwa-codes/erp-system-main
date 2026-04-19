"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { PermissionGate } from "@/components/ui/permission-gate"
import { UtilizationBreakdownModal } from "@/components/underwriting/UtilizationBreakdownModal"

const PLAN_STATUSES = [
  "ALL",
  "DRAFT",
  "IN_PROGRESS",
  "PENDING_APPROVAL",
  "COMPLETE",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]

const formatCurrency = (value: number) => `₦${value.toLocaleString()}`
const getClaimPremiumBadge = (ratio: number) =>
  ratio > 100 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"

type ClientUtilizationModuleProps = {
  permissionModule: "underwriting" | "claims"
  apiPath: string
  title?: string
}

export function ClientUtilizationModule({
  permissionModule,
  apiPath,
  title = "Client Utilization Analysis",
}: ClientUtilizationModuleProps) {
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [limitBreachOnly, setLimitBreachOnly] = useState(false)
  const [organizationFilter, setOrganizationFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState<{
    id: string
    name: string
  } | null>(null)
  const limit = 20

  useEffect(() => {
    setPage(1)
  }, [statusFilter, limitBreachOnly, startDate, endDate, organizationFilter])

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: [
      "client-utilization",
      permissionModule,
      apiPath,
      statusFilter,
      limitBreachOnly,
      organizationFilter,
      startDate,
      endDate,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (statusFilter && statusFilter !== "ALL") {
        params.append("plan_status", statusFilter)
      }

      if (limitBreachOnly) {
        params.append("limit_breaches", "true")
      }

      if (organizationFilter) {
        params.append("organization_id", organizationFilter)
      }

      if (startDate) {
        params.append("start_date", startDate)
      }

      if (endDate) {
        params.append("end_date", endDate)
      }

      params.append("page", page.toString())
      params.append("limit", limit.toString())

      const res = await fetch(`${apiPath}?${params.toString()}`)
      if (!res.ok) {
        throw new Error("Failed to load utilization data")
      }

      return res.json()
    },
  })

  const organizations = data?.organizations || []
  const organizationOptions = useMemo(
    () =>
      (data?.organizationOptions || []).map((organization: { id: string; name: string; code: string | null }) => ({
        value: organization.id,
        label: organization.name,
        subtitle: organization.code || undefined,
      })),
    [data?.organizationOptions]
  )
  const pagination = data?.pagination || { page: 1, limit, total: 0 }
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit))

  return (
    <PermissionGate module={permissionModule} action="view">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div>
                <p className="text-xs text-gray-500">Plan Status</p>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-gray-500">Organization</p>
                <Combobox
                  options={organizationOptions}
                  value={organizationFilter}
                  onValueChange={setOrganizationFilter}
                  placeholder="All organizations"
                  searchPlaceholder="Search organization..."
                  emptyText="No organization found."
                  clearable
                />
              </div>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                placeholder="Start Date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                placeholder="End Date"
              />
              <label className="flex h-10 items-center gap-2 self-end rounded-md border border-input px-3">
                <input
                  type="checkbox"
                  checked={limitBreachOnly}
                  onChange={(event) => setLimitBreachOnly(event.target.checked)}
                />
                <span className="text-sm">Limit breach only</span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span>
                Showing {organizations.length} of {pagination.total} organizations
              </span>
              {isFetching && <span>Refreshing…</span>}
              {error && <span className="text-red-600">Failed to load data</span>}
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            {organizations.length === 0 ? (
              <p className="text-center text-sm text-gray-500">No utilization data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plans</TableHead>
                      <TableHead>Premium Paid</TableHead>
                      <TableHead>Utilized</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Liability</TableHead>
                      <TableHead>Claims/Premium</TableHead>
                      <TableHead>Limit Breaches</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((organization: any) => (
                      <TableRow key={organization.organizationId}>
                        <TableCell>
                          <p className="font-semibold">{organization.name}</p>
                          <p className="text-xs text-gray-500">{organization.code}</p>
                        </TableCell>
                        <TableCell>{organization.planCount}</TableCell>
                        <TableCell>{formatCurrency(organization.premiumPaid || 0)}</TableCell>
                        <TableCell>{formatCurrency(organization.totalUsed || 0)}</TableCell>
                        <TableCell>
                          <span className={organization.balance < 0 ? "text-red-600 font-semibold" : ""}>
                            {formatCurrency(organization.balance || 0)}
                          </span>
                        </TableCell>
                        <TableCell>{formatCurrency(organization.liability || 0)}</TableCell>
                        <TableCell>
                          <Badge className={getClaimPremiumBadge(organization.claimPremiumRatio || 0)}>
                            {(organization.claimPremiumRatio || 0).toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              organization.limitBreaches ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                            }
                          >
                            {organization.limitBreaches ? "Breach" : "OK"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedOrganization({
                                id: organization.organizationId,
                                name: organization.name,
                              })
                              setShowModal(true)
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {pagination.total > pagination.limit && (
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} organizations
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-2">
                    Page {pagination.page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={pagination.page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedOrganization && (
          <UtilizationBreakdownModal
            open={showModal}
            onOpenChange={setShowModal}
            organizationId={selectedOrganization.id}
            organizationName={selectedOrganization.name}
            apiBasePath={apiPath}
          />
        )}
      </div>
    </PermissionGate>
  )
}
