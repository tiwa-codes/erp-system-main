"use client"

import { formatCurrency, getCurrencySymbol } from "@/lib/currency"

interface CurrencyDisplayProps {
  amount: number
  currency?: string
  originalAmount?: number
  originalCurrency?: string
  exchangeRate?: number
  showConversion?: boolean
  className?: string
}

export function CurrencyDisplay({
  amount,
  currency = "NGN",
  originalAmount,
  originalCurrency,
  exchangeRate,
  showConversion = false,
  className = "",
}: CurrencyDisplayProps) {
  if (showConversion && originalAmount && originalCurrency && originalCurrency !== currency) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="font-medium">{formatCurrency(amount, currency)}</div>
        <div className="text-sm text-muted-foreground">
          {formatCurrency(originalAmount, originalCurrency)}
          {exchangeRate && (
            <span className="ml-2">
              (Rate: {exchangeRate.toFixed(4)})
            </span>
          )}
        </div>
      </div>
    )
  }

  return <span className={className}>{formatCurrency(amount, currency)}</span>
}








