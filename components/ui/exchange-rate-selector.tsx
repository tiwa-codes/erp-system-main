"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

interface ExchangeRateSelectorProps {
  fromCurrency: string
  toCurrency: string
  rateType?: string
  onRateChange?: (rate: number, rateId: string | null) => void
  value?: number
  disabled?: boolean
}

export function ExchangeRateSelector({
  fromCurrency,
  toCurrency,
  rateType = "MID_MARKET",
  onRateChange,
  value,
  disabled = false,
}: ExchangeRateSelectorProps) {
  const [manualRate, setManualRate] = useState<string>("")
  const [useManual, setUseManual] = useState(false)

  const { data: rateData, isLoading, refetch } = useQuery({
    queryKey: ["exchange-rate", fromCurrency, toCurrency, rateType],
    queryFn: async () => {
      if (fromCurrency === toCurrency) {
        return { rate: 1, id: null }
      }
      const params = new URLSearchParams({
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate_type: rateType,
        is_locked: "false",
      })
      const res = await fetch(`/api/settings/exchange-rates?${params}&limit=1`)
      if (!res.ok) throw new Error("Failed to fetch rate")
      const data = await res.json()
      const latestRate = data.data?.rates?.[0]
      return {
        rate: latestRate ? Number(latestRate.rate) : null,
        id: latestRate?.id || null,
      }
    },
    enabled: !useManual && fromCurrency !== toCurrency,
  })

  useEffect(() => {
    if (value !== undefined) {
      setManualRate(value.toString())
      setUseManual(true)
    }
  }, [value])

  useEffect(() => {
    if (rateData?.rate && !useManual && onRateChange) {
      onRateChange(rateData.rate, rateData.id)
    }
  }, [rateData, useManual, onRateChange])

  const handleManualRateChange = (newRate: string) => {
    setManualRate(newRate)
    const numRate = parseFloat(newRate)
    if (!isNaN(numRate) && onRateChange) {
      onRateChange(numRate, null)
    }
  }

  const handleFetchRate = async () => {
    try {
      const res = await fetch("/api/settings/exchange-rates/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_currency: fromCurrency,
          to_currency: toCurrency,
          rate_type: rateType,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.data?.rate) {
          setManualRate(data.data.rate.toString())
          setUseManual(true)
          if (onRateChange) {
            onRateChange(data.data.rate, data.data.id)
          }
        }
        refetch()
      }
    } catch (error) {
      console.error("Failed to fetch rate from API:", error)
    }
  }

  if (fromCurrency === toCurrency) {
    return (
      <div className="space-y-2">
        <Label>Exchange Rate</Label>
        <div className="text-sm text-muted-foreground">1.0000 (Same currency)</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Exchange Rate ({fromCurrency} → {toCurrency})</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFetchRate}
            disabled={disabled || isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Fetch from API
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Select
          value={useManual ? "manual" : "auto"}
          onValueChange={(val) => {
            setUseManual(val === "manual")
            if (val === "auto" && rateData?.rate && onRateChange) {
              onRateChange(rateData.rate, rateData.id)
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
        {useManual ? (
          <Input
            type="number"
            step="0.0001"
            placeholder="Enter rate"
            value={manualRate}
            onChange={(e) => handleManualRateChange(e.target.value)}
            disabled={disabled}
            className="flex-1"
          />
        ) : (
          <Input
            value={isLoading ? "Loading..." : rateData?.rate?.toFixed(4) || "N/A"}
            disabled
            className="flex-1"
          />
        )}
      </div>
      {rateData?.rate && !useManual && (
        <p className="text-xs text-muted-foreground">
          Latest rate from database
        </p>
      )}
    </div>
  )
}








