"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, FileText } from "lucide-react"
import Link from "next/link"
import { PermissionGate } from "@/components/ui/permission-gate"

export default function EditCustomPlanPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch plan data
  const { data: planData, isLoading } = useQuery({
    queryKey: ["special-risk-plan", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/special-risk/plans/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch plan")
      return res.json()
    },
  })

  const plan = planData?.data

  const [form, setForm] = useState({
    name: "",
    description: "",
    premium_amount: "",
    annual_limit: "",
  })

  // Initialize form when plan data loads
  useEffect(() => {
    if (plan) {
      setForm({
        name: plan.name || "",
        description: plan.description || "",
        premium_amount: plan.premium_amount?.toString() || "",
        annual_limit: plan.annual_limit?.toString() || "",
      })
    }
  }, [plan])

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/special-risk/plans/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update plan")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-risk-plan", params.id] })
      queryClient.invalidateQueries({ queryKey: ["special-risk-plans"] })
      toast({
        title: "Success",
        description: "Plan updated successfully",
      })
      router.push(`/special-risk/custom-plans/${params.id}`)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      name: form.name,
      description: form.description || undefined,
      premium_amount: form.premium_amount ? parseFloat(form.premium_amount) : undefined,
      annual_limit: form.annual_limit ? parseFloat(form.annual_limit) : undefined,
    }

    updateMutation.mutate(payload)
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!plan) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Plan not found</p>
        <Link href="/special-risk/custom-plans">
          <Button variant="outline" className="mt-4">
            Back to Custom Plans
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/special-risk/custom-plans/${params.id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Custom Plan</h1>
            <p className="text-muted-foreground">Plan ID: {plan.plan_id}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Plan Information
            </CardTitle>
            <CardDescription>Update plan details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="plan_type">Plan Type</Label>
                <Input
                  id="plan_type"
                  value={plan.plan_type || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">Cannot be changed</p>
              </div>

              <div>
                <Label htmlFor="classification">Classification</Label>
                <Input
                  id="classification"
                  value={plan.classification || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">Cannot be changed</p>
              </div>

              <div>
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="premium_amount">Premium Amount *</Label>
                <Input
                  id="premium_amount"
                  type="number"
                  step="0.01"
                  value={form.premium_amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, premium_amount: e.target.value }))}
                  required
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="annual_limit">Annual Limit *</Label>
                <Input
                  id="annual_limit"
                  type="number"
                  step="0.01"
                  value={form.annual_limit}
                  onChange={(e) => setForm((prev) => ({ ...prev, annual_limit: e.target.value }))}
                  required
                  placeholder="0.00"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  placeholder="Enter plan description..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href={`/special-risk/custom-plans/${params.id}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <PermissionGate permission="special-risk.edit">
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Updating..." : "Update Plan"}
            </Button>
          </PermissionGate>
        </div>
      </form>
    </div>
  )
}

