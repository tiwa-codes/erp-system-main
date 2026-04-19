import { convertCurrency, lockExchangeRate, getExchangeRate } from "./exchange-rate"
import { RateType } from "@prisma/client"

/**
 * Convert currency amount and lock the rate
 */
export async function convertCurrencyAndLock(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rateType: RateType = RateType.MID_MARKET,
  date?: Date
): Promise<{ convertedAmount: number; rate: number; rateId: string } | null> {
  const result = await convertCurrency(amount, fromCurrency, toCurrency, rateType, date)

  if (!result || !result.rateId) {
    return null
  }

  // Lock the rate so it cannot be changed
  await lockExchangeRate(result.rateId)

  return {
    convertedAmount: result.convertedAmount,
    rate: result.rate,
    rateId: result.rateId,
  }
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currency: string = "NGN"): string {
  const symbols: Record<string, string> = {
    NGN: "₦",
    USD: "$",
    GBP: "£",
    EUR: "€",
  }

  const symbol = symbols[currency] || currency
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    NGN: "₦",
    USD: "$",
    GBP: "£",
    EUR: "€",
  }

  return symbols[currency] || currency
}

/**
 * Validate currency code
 */
export function isValidCurrency(currency: string): boolean {
  const validCurrencies = ["NGN", "USD", "GBP", "EUR", "CAD", "AUD", "JPY", "CHF", "CNY"]
  return validCurrencies.includes(currency.toUpperCase())
}








