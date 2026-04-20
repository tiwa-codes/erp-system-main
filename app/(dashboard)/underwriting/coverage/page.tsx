"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Loader2, Trash2 } from "lucide-react"



const initialForm = {
  family_type: "FAMILY",
  principal_age_min: "",
  principal_age_max: "",
  spouse_age_min: "",
  spouse_age_max: "",
  spouse_count: "",
  children_age_max: "",
  children_count: "",
  parent_age_min: "",
  parent_age_max: "",
  parent_count: "",
  siblings_age_max: "",
  siblings_count: "",
}

export default function CoverageRulesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(initialForm)

  const coverageQuery = useQuery({
    queryKey: ["coverage-rules"],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/coverage`)
      if (!res.ok) throw new Error("Failed to fetch coverage rules")
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      // Convert empty strings to undefined for optional fields
      const payload = {
        family_type: form.family_type,
        principal_age_min: form.principal_age_min === "" ? undefined : Number(form.principal_age_min) || undefined,
        principal_age_max: form.principal_age_max === "" ? undefined : Number(form.principal_age_max) || undefined,
        spouse_age_min: form.spouse_age_min === "" ? undefined : Number(form.spouse_age_min) || undefined,
        spouse_age_max: form.spouse_age_max === "" ? undefined : Number(form.spouse_age_max) || undefined,
        spouse_count: form.spouse_count === "" ? undefined : Number(form.spouse_count) || undefined,
        children_age_max: form.children_age_max === "" ? undefined : Number(form.children_age_max) || undefined,
        children_count: form.children_count === "" ? undefined : Number(form.children_count) || undefined,
        parent_age_min: form.parent_age_min === "" ? undefined : Number(form.parent_age_min) || undefined,
        parent_age_max: form.parent_age_max === "" ? undefined : Number(form.parent_age_max) || undefined,
        parent_count: form.parent_count === "" ? undefined : Number(form.parent_count) || undefined,
        siblings_age_max: form.siblings_age_max === "" ? undefined : Number(form.siblings_age_max) || undefined,
        siblings_count: form.siblings_count === "" ? undefined : Number(form.siblings_count) || undefined,
      }
      const res = await fetch("/api/underwriting/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.message || "Failed to create rule")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Coverage rule saved" })
      setForm(initialForm)
      queryClient.invalidateQueries({ queryKey: ["coverage-rules"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/underwriting/coverage/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete rule")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Coverage rule removed" })
      queryClient.invalidateQueries({ queryKey: ["coverage-rules"] })
    },
  })

  const rules = coverageQuery.data?.rules || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate()
  }

  return (
    <PermissionGate module="underwriting" action="view">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Coverage Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="family_type">Family Type</Label>
                <Select
                  value={form.family_type}
                  onValueChange={(value) => setForm(prev => ({ ...prev, family_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="FAMILY">Family</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-end md:col-span-2">
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save Rule"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Principal Age Min</Label>
                <Input
                  type="number"
                  value={form.principal_age_min}
                  onChange={(e) => setForm(prev => ({ ...prev, principal_age_min: e.target.value }))}
                  placeholder="e.g., 18"
                />
              </div>
              <div>
                <Label>Principal Age Max</Label>
                <Input
                  type="number"
                  value={form.principal_age_max}
                  onChange={(e) => setForm(prev => ({ ...prev, principal_age_max: e.target.value }))}
                  placeholder="e.g., 65"
                />
              </div>
              <div>
                <Label>Spouse Count</Label>
                <Input
                  type="number"
                  value={form.spouse_count}
                  onChange={(e) => setForm(prev => ({ ...prev, spouse_count: e.target.value }))}
                  placeholder="Number of spouses"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Children Count</Label>
                <Input
                  type="number"
                  value={form.children_count}
                  onChange={(e) => setForm(prev => ({ ...prev, children_count: e.target.value }))}
                  placeholder="Number of children"
                />
              </div>
              <div>
                <Label>Parent Count</Label>
                <Input
                  type="number"
                  value={form.parent_count}
                  onChange={(e) => setForm(prev => ({ ...prev, parent_count: e.target.value }))}
                  placeholder="Number of parents"
                />
              </div>
              <div>
                <Label>Sibling Count</Label>
                <Input
                  type="number"
                  value={form.siblings_count}
                  onChange={(e) => setForm(prev => ({ ...prev, siblings_count: e.target.value }))}
                  placeholder="Number of siblings"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Children Age Max</Label>
                <Input
                  type="number"
                  value={form.children_age_max}
                  onChange={(e) => setForm(prev => ({ ...prev, children_age_max: e.target.value }))}
                  placeholder="e.g., 18"
                />
              </div>
              <div>
                <Label>Sibling Age Max</Label>
                <Input
                  type="number"
                  value={form.siblings_age_max}
                  onChange={(e) => setForm(prev => ({ ...prev, siblings_age_max: e.target.value }))}
                  placeholder="e.g., 40"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {coverageQuery.isFetching && !rules.length ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading rules...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Family Type</TableHead>
                      <TableHead>Counts</TableHead>
                      <TableHead>Ages</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                          No coverage rules configured.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rules.map((rule: any) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-800">{rule.family_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-gray-600 space-y-1">
                              {rule.spouse_count !== null && (
                                <p>Spouses: {rule.spouse_count}</p>
                              )}
                              {rule.children_count !== null && (
                                <p>Children: {rule.children_count}</p>
                              )}
                              {rule.parent_count !== null && (
                                <p>Parents: {rule.parent_count}</p>
                              )}
                              {rule.siblings_count !== null && (
                                <p>Siblings: {rule.siblings_count}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-gray-600 space-y-1">
                              {rule.principal_age_min !== null && (
                                <p>Principal Age Min: {rule.principal_age_min}</p>
                              )}
                              {rule.principal_age_max !== null && (
                                <p>Principal Age Max: {rule.principal_age_max}</p>
                              )}
                              {rule.children_age_max !== null && (
                                <p>Child Age Max: {rule.children_age_max}</p>
                              )}
                              {rule.siblings_age_max !== null && (
                                <p>Sibling Age Max: {rule.siblings_age_max}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className="bg-green-100 text-green-800"
                            >{`Created ${new Date(rule.created_at).toLocaleDateString()}`}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(rule.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}

