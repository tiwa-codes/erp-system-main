"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface PriceSummaryProps {
  enrolleeId?: string
  claimId?: string
  // Direct props for when we already have the data
  originalAmount?: number
  approvedAmount?: number
  currentAmount?: number
}

export function PriceSummary({ 
  enrolleeId, 
  claimId,
  originalAmount,
  approvedAmount,
  currentAmount
}: PriceSummaryProps) {
  // If we have direct amounts, use them instead of fetching
  if (originalAmount !== undefined && currentAmount !== undefined) {
    const difference = currentAmount - originalAmount

    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Original Price</span>
            <span className="text-lg font-semibold text-gray-900">
              ₦{originalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Current Price</span>
            <span className="text-lg font-semibold text-green-600">
              ₦{currentAmount.toLocaleString()}
            </span>
          </div>
          {approvedAmount !== undefined && approvedAmount !== currentAmount && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Approved Price</span>
              <span className="text-lg font-semibold text-blue-600">
                ₦{approvedAmount.toLocaleString()}
              </span>
            </div>
          )}
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Difference</span>
              <span
                className={`text-lg font-semibold ${
                  difference >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {difference >= 0 ? "+" : ""}₦{Math.abs(difference).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Fallback to API fetch if no direct amounts provided
  const { data, isLoading, error } = useQuery({
    queryKey: ['enrollee-claims-summary', enrolleeId],
    queryFn: async () => {
      if (!enrolleeId) throw new Error('No enrollee ID provided')
      const res = await fetch(`/api/claims/enrollee/${enrolleeId}/summary`)
      if (!res.ok) throw new Error('Failed to fetch summary')
      return res.json()
    },
    enabled: !!enrolleeId
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">Unable to load price summary</div>
        </CardContent>
      </Card>
    )
  }

  const { originalPrice, approvedPrice } = data
  const difference = approvedPrice - originalPrice

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Original Price</span>
          <span className="text-lg font-semibold text-gray-900">
            ₦{originalPrice.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Approved Price</span>
          <span className="text-lg font-semibold text-green-600">
            ₦{approvedPrice.toLocaleString()}
          </span>
        </div>
        <div className="pt-2 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Difference</span>
            <span
              className={`text-lg font-semibold ${
                difference >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {difference >= 0 ? "+" : ""}₦{Math.abs(difference).toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}










