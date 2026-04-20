"use client"

export const dynamic = 'force-dynamic'

import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ReportForm } from "@/components/sales/report-form"
import { SalesSubmodule, ReportType } from "@prisma/client"



export default function EditSalesOperationsReportPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ["sales-operations-report", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/sales/reports/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch report")
      return res.json()
    },
  })

  const report = data?.data

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/sales/reports/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update report")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Report updated",
        description: "Sales report has been updated successfully.",
      })
      router.push(`/sales/operations/reports/${params.id}`)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!report) {
    return <div className="text-center py-8">Report not found</div>
  }

  const convertPeriodFromISO = (isoDate: string, reportType: ReportType): string => {
    if (!isoDate) return ""
    const date = new Date(isoDate)
    
    switch (reportType) {
      case "DAILY":
        return date.toISOString().split("T")[0]
      
      case "WEEKLY":
        return date.toISOString().split("T")[0]
      
      case "MONTHLY":
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, "0")
        return `${year}-${month}`
      
      case "QUARTERLY":
        const qYear = date.getFullYear()
        const qMonth = date.getMonth()
        const quarter = Math.floor(qMonth / 3) + 1
        return `${quarter}-${qYear}`
      
      case "HALF_YEARLY":
        const hYear = date.getFullYear()
        const hMonth = date.getMonth()
        const half = hMonth < 6 ? 1 : 2
        return `${half}-${hYear}`
      
      case "YEARLY":
        return String(date.getFullYear())
      
      default:
        return date.toISOString().split("T")[0]
    }
  }

  const handleSubmit = async (data: any) => {
    await updateMutation.mutateAsync(data)
  }

  const periodDisplay = convertPeriodFromISO(report.report_period, report.report_type)
  const periodEndDisplay = report.report_period_end
    ? convertPeriodFromISO(report.report_period_end, report.report_type)
    : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/sales/operations/reports/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Procurement Report</h1>
          <p className="text-muted-foreground">Update the report information below</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
          <CardDescription>Update the report information below</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportForm
            submodule={SalesSubmodule.SALES_OPERATIONS}
            initialData={{
              report_type: report.report_type,
              report_period: periodDisplay,
              report_period_end: periodEndDisplay,
              title: report.title,
              sales_amount: Number(report.sales_amount),
              target_amount: Number(report.target_amount),
              region_id: report.region_id || "",
              branch_id: report.branch_id || "",
              state: report.state || "",
              notes: report.notes || "",
            }}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}
