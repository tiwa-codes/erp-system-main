"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ReportForm } from "@/components/sales/report-form"
import { SalesSubmodule, ReportType } from "@prisma/client"

export default function AddSpecialRisksSalesReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const defaultType = searchParams.get("type") as ReportType | null

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/sales/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create report")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Report created",
        description: "Sales report has been created successfully.",
      })
      router.push("/sales/special-risks/reports")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const saveDraftMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/sales/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save draft")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Draft saved",
        description: "Report has been saved as draft.",
      })
      router.push("/sales/special-risks/reports")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/sales/reports/${reportId}/submit`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to submit report")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Sales report has been submitted successfully.",
      })
      router.push("/sales/special-risks/reports")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleSubmit = async (data: any) => {
    const result = await createMutation.mutateAsync(data)
    // Auto-submit after creation
    await submitMutation.mutateAsync(result.data.id)
  }

  const handleSaveDraft = async (data: any) => {
    await saveDraftMutation.mutateAsync(data)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sales/special-risks">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add Special Service Sale Report</h1>
          <p className="text-muted-foreground">Create a new sales report for special service sale</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
          <CardDescription>Fill in the report information below</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportForm
            submodule={SalesSubmodule.SPECIAL_RISKS_SALES}
            initialData={defaultType ? { report_type: defaultType } : undefined}
            onSubmit={handleSubmit}
            onSaveDraft={handleSaveDraft}
            isSubmitting={createMutation.isPending || submitMutation.isPending}
            isSaving={saveDraftMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}

