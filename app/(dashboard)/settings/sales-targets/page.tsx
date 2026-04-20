"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_SALES_TARGETS, SALES_SUBMODULE_LABELS, type SalesSubmoduleKey } from "@/lib/sales"
import { getStateNames } from "@/lib/states"



type SalesBranch = {
  id: string
  name: string
  state: string
  region_id: string
}

type SalesRegion = {
  id: string
  name: string
  branches?: SalesBranch[]
}

const STATE_OPTIONS = getStateNames().sort((a, b) => a.localeCompare(b))

export default function SalesTargetsSettingsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [regionName, setRegionName] = useState("")
  const [branchName, setBranchName] = useState("")
  const [branchRegionId, setBranchRegionId] = useState("")
  const [branchState, setBranchState] = useState("")

  const [targetRegionId, setTargetRegionId] = useState("")
  const [targetBranchId, setTargetBranchId] = useState("")
  const [targets, setTargets] = useState<Record<SalesSubmoduleKey, string>>({
    CORPORATE_SALES: String(DEFAULT_SALES_TARGETS.CORPORATE_SALES),
    AGENCY_SALES: String(DEFAULT_SALES_TARGETS.AGENCY_SALES),
    SPECIAL_RISKS_SALES: String(DEFAULT_SALES_TARGETS.SPECIAL_RISKS_SALES),
    SALES_OPERATIONS: String(DEFAULT_SALES_TARGETS.SALES_OPERATIONS),
  })

  const { data: regionsData, isLoading } = useQuery({
    queryKey: ["settings-sales-regions-with-branches"],
    queryFn: async () => {
      const res = await fetch("/api/settings/sales-regions?include_branches=true")
      if (!res.ok) throw new Error("Failed to fetch sales regions")
      return res.json()
    },
  })

  const regions = (regionsData?.data || []) as SalesRegion[]
  const selectedTargetRegion = regions.find((region) => region.id === targetRegionId) || null
  const targetBranches = selectedTargetRegion?.branches || []
  const flatBranches = useMemo(
    () =>
      regions.flatMap((region) =>
        (region.branches || []).map((branch) => ({
          ...branch,
          region_name: region.name,
        }))
      ),
    [regions]
  )

  const { data: branchTargetsData } = useQuery({
    queryKey: ["sales-branch-targets", targetRegionId, targetBranchId],
    enabled: Boolean(targetRegionId && targetBranchId),
    queryFn: async () => {
      const params = new URLSearchParams({
        region_id: targetRegionId,
        branch_id: targetBranchId,
      })
      const res = await fetch(`/api/settings/sales-branch-targets?${params}`)
      if (!res.ok) throw new Error("Failed to fetch branch targets")
      return res.json()
    },
  })

  useEffect(() => {
    if (!targetRegionId || !targetBranchId) {
      setTargets({
        CORPORATE_SALES: String(DEFAULT_SALES_TARGETS.CORPORATE_SALES),
        AGENCY_SALES: String(DEFAULT_SALES_TARGETS.AGENCY_SALES),
        SPECIAL_RISKS_SALES: String(DEFAULT_SALES_TARGETS.SPECIAL_RISKS_SALES),
        SALES_OPERATIONS: String(DEFAULT_SALES_TARGETS.SALES_OPERATIONS),
      })
      return
    }

    const data = branchTargetsData?.data
    if (!data) return

    setTargets({
      CORPORATE_SALES: String(data.CORPORATE_SALES ?? 0),
      AGENCY_SALES: String(data.AGENCY_SALES ?? 0),
      SPECIAL_RISKS_SALES: String(data.SPECIAL_RISKS_SALES ?? 0),
      SALES_OPERATIONS: String(data.SALES_OPERATIONS ?? 0),
    })
  }, [targetRegionId, targetBranchId, branchTargetsData])

  const createRegionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/sales-regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regionName }),
      })
      if (!res.ok) {
        const result = await res.json().catch(() => ({}))
        throw new Error(result?.error || "Failed to create region")
      }
      return res.json()
    },
    onSuccess: async () => {
      toast({ title: "Saved", description: "Region created successfully." })
      setRegionName("")
      await queryClient.invalidateQueries({ queryKey: ["settings-sales-regions-with-branches"] })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const createBranchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/sales-branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region_id: branchRegionId,
          name: branchName,
          state: branchState,
        }),
      })
      if (!res.ok) {
        const result = await res.json().catch(() => ({}))
        throw new Error(result?.error || "Failed to create branch")
      }
      return res.json()
    },
    onSuccess: async () => {
      toast({ title: "Saved", description: "Branch created successfully." })
      setBranchName("")
      setBranchState("")
      await queryClient.invalidateQueries({ queryKey: ["settings-sales-regions-with-branches"] })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const saveTargetsMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<SalesSubmoduleKey, number> = {
        CORPORATE_SALES: Number(targets.CORPORATE_SALES) || 0,
        AGENCY_SALES: Number(targets.AGENCY_SALES) || 0,
        SPECIAL_RISKS_SALES: Number(targets.SPECIAL_RISKS_SALES) || 0,
        SALES_OPERATIONS: Number(targets.SALES_OPERATIONS) || 0,
      }

      const res = await fetch("/api/settings/sales-branch-targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region_id: targetRegionId,
          branch_id: targetBranchId,
          targets: payload,
        }),
      })
      if (!res.ok) {
        const result = await res.json().catch(() => ({}))
        throw new Error(result?.error || "Failed to save branch targets")
      }
      return res.json()
    },
    onSuccess: async () => {
      toast({ title: "Saved", description: "Branch annual targets updated successfully." })
      await queryClient.invalidateQueries({ queryKey: ["sales-branch-targets", targetRegionId, targetBranchId] })
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const onTargetFieldChange = (key: SalesSubmoduleKey, value: string) => {
    if (value === "" || /^\d*(\.\d{0,2})?$/.test(value)) {
      setTargets((prev) => ({ ...prev, [key]: value }))
    }
  }

  const entries = Object.entries(SALES_SUBMODULE_LABELS) as [SalesSubmoduleKey, string][]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales Masters & Targets</h1>
        <p className="text-muted-foreground">
          Create regions and branches, then set annual target per branch and channel.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create Region</CardTitle>
            <CardDescription>Regions drive branch assignment and report grouping.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="region-name">Region Name</Label>
              <Input
                id="region-name"
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder="e.g. South West"
              />
            </div>
            <Button
              onClick={() => createRegionMutation.mutate()}
              disabled={!regionName.trim() || createRegionMutation.isPending}
            >
              {createRegionMutation.isPending ? "Creating..." : "Create Region"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Branch</CardTitle>
            <CardDescription>Create a branch under a region and assign a state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={branchRegionId} onValueChange={setBranchRegionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={branchState} onValueChange={setBranchState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {STATE_OPTIONS.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. Ikeja Branch"
              />
            </div>
            <Button
              onClick={() => createBranchMutation.mutate()}
              disabled={!branchRegionId || !branchState || !branchName.trim() || createBranchMutation.isPending}
            >
              {createBranchMutation.isPending ? "Creating..." : "Create Branch"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Set Annual Target by Region & Branch</CardTitle>
          <CardDescription>
            Select region and branch, then set channel targets individually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={targetRegionId}
                onValueChange={(value) => {
                  setTargetRegionId(value)
                  setTargetBranchId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={targetBranchId} onValueChange={setTargetBranchId} disabled={!targetRegionId}>
                <SelectTrigger>
                  <SelectValue placeholder={targetRegionId ? "Select branch" : "Select region first"} />
                </SelectTrigger>
                <SelectContent>
                  {targetBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({branch.state})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {entries.map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`target-${key}`}>{label}</Label>
              <Input
                id={`target-${key}`}
                type="number"
                min="0"
                step="0.01"
                value={targets[key]}
                onChange={(e) => onTargetFieldChange(key, e.target.value)}
                placeholder="0.00"
                disabled={!targetRegionId || !targetBranchId}
              />
            </div>
          ))}

          <Button
            onClick={() => saveTargetsMutation.mutate()}
            disabled={!targetRegionId || !targetBranchId || saveTargetsMutation.isPending}
          >
            {saveTargetsMutation.isPending ? "Saving..." : "Save Targets"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Branches</CardTitle>
          <CardDescription>Region, branch and state records available for sales reports.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-muted-foreground">Loading...</div>
          ) : flatBranches.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">No branches configured yet.</div>
          ) : (
            <div className="overflow-x-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flatBranches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell>{branch.region_name}</TableCell>
                      <TableCell>{branch.name}</TableCell>
                      <TableCell>{branch.state}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
