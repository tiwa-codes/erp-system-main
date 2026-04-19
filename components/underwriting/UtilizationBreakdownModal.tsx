"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, Loader2 } from "lucide-react"

interface EnrolleeUtilizationBreakdownModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  organizationName: string
  apiBasePath?: string
}

interface Enrollee {
  id: string
  name: string
  enrollee_id: string
  account_type: string
  utilized: number
  balance: number
  limit: number
}

const formatCurrency = (value: number) => `₦${value.toLocaleString()}`

export function UtilizationBreakdownModal({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  apiBasePath = "/api/underwriting/utilization",
}: EnrolleeUtilizationBreakdownModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["enrollee-utilization", apiBasePath, organizationId],
    queryFn: async () => {
      const res = await fetch(`${apiBasePath}/${organizationId}/enrollees`)
      if (!res.ok) {
        throw new Error(res.status === 404 ? "Organization not found" : "Failed to fetch utilization data")
      }
      return res.json()
    },
    enabled: open,
  })

  const enrollees: Enrollee[] = data?.enrollees || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Utilization Breakdown: {organizationName}</DialogTitle>
          <DialogDescription>
            Detailed utilization summary for each enrollee in this organization
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <span className="text-sm text-red-700">{error.message}</span>
          </div>
        )}

        {enrollees.length === 0 && !isLoading && !error && (
          <div className="text-center py-8 text-gray-500">
            <p>No enrollees found for this organization.</p>
          </div>
        )}

        {enrollees.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enrollee Name</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Account Type</TableHead>
                  <TableHead className="text-right">Utilized</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Limit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollees.map((enrollee) => (
                  <TableRow key={enrollee.id}>
                    <TableCell className="font-medium">{enrollee.name}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {enrollee.enrollee_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {enrollee.account_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(enrollee.utilized)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          enrollee.balance < 0
                            ? "font-semibold text-red-600"
                            : "text-gray-700"
                        }
                      >
                        {formatCurrency(enrollee.balance)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(enrollee.limit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
