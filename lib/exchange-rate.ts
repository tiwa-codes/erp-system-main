import { prisma } from "@/lib/prisma"
import { ExchangeRateSource, RateType } from "@prisma/client"

interface ExchangeRateConfig {
  api_url?: string
  api_key?: string
  default_rate_type?: RateType
  update_frequency?: string
}

/**
 * Get exchange rate configuration from system config
 */
export async function getExchangeRateConfig(): Promise<ExchangeRateConfig> {
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          "exchange_rate_api_url",
          "exchange_rate_api_key",
          "default_rate_type",
          "exchange_rate_update_frequency",
        ],
      },
    },
  })

  const configMap = new Map(configs.map((c) => [c.key, c.value]))

  return {
    api_url: configMap.get("exchange_rate_api_url"),
    api_key: configMap.get("exchange_rate_api_key"),
    default_rate_type: (configMap.get("default_rate_type") as RateType) || RateType.MID_MARKET,
    update_frequency: configMap.get("exchange_rate_update_frequency"),
  }
}

/**
 * Fetch exchange rate from external API
 */
export async function fetchExchangeRateFromAPI(
  fromCurrency: string,
  toCurrency: string,
  rateType: RateType = RateType.MID_MARKET
): Promise<number | null> {
  try {
    const config = await getExchangeRateConfig()

    if (!config.api_url) {
      console.warn("Exchange rate API URL not configured")
      return null
    }

    // Build API request
    const url = new URL(config.api_url)
    url.searchParams.set("from", fromCurrency)
    url.searchParams.set("to", toCurrency)
    url.searchParams.set("type", rateType.toLowerCase())

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }

    if (config.api_key) {
      headers["Authorization"] = `Bearer ${config.api_key}`
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    })

    if (!response.ok) {
      console.error(`Exchange rate API error: ${response.statusText}`)
      return null
    }

    const data = await response.json()

    // Extract rate from response (adjust based on actual API response structure)
    // Common patterns: data.rate, data.result.rate, data.data.rate
    const rate =
      data.rate || data.result?.rate || data.data?.rate || data.conversion_rate

    if (!rate || typeof rate !== "number") {
      console.error("Invalid rate format from API")
      return null
    }

    return rate
  } catch (error) {
    console.error("Error fetching exchange rate from API:", error)
    return null
  }
}

/**
 * Get current or historical exchange rate
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  rateType: RateType = RateType.MID_MARKET,
  date?: Date
): Promise<number | null> {
  // If same currency, return 1
  if (fromCurrency === toCurrency) {
    return 1
  }

  // Try to get from database first
  const where: any = {
    from_currency: fromCurrency,
    to_currency: toCurrency,
    rate_type: rateType,
    is_locked: false, // Only get unlocked rates
  }

  if (date) {
    where.effective_date = {
      lte: date,
    }
  }

  const rate = await prisma.exchangeRate.findFirst({
    where,
    orderBy: {
      effective_date: "desc",
    },
  })

  if (rate) {
    return Number(rate.rate)
  }

  // If not found in DB and API is configured, try fetching from API
  const apiRate = await fetchExchangeRateFromAPI(fromCurrency, toCurrency, rateType)

  if (apiRate) {
    // Store the fetched rate in database
    await prisma.exchangeRate.create({
      data: {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate: apiRate,
        rate_type: rateType,
        source: ExchangeRateSource.AUTOMATIC_API,
        effective_date: date || new Date(),
      },
    })

    return apiRate
  }

  return null
}

/**
 * Convert currency amount using exchange rate
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rateType: RateType = RateType.MID_MARKET,
  date?: Date
): Promise<{ convertedAmount: number; rate: number; rateId: string | null } | null> {
  const rate = await getExchangeRate(fromCurrency, toCurrency, rateType, date)

  if (!rate) {
    return null
  }

  const convertedAmount = amount * rate

  // Get the rate ID for locking
  const rateRecord = await prisma.exchangeRate.findFirst({
    where: {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate_type: rateType,
      is_locked: false,
    },
    orderBy: {
      effective_date: "desc",
    },
  })

  return {
    convertedAmount,
    rate,
    rateId: rateRecord?.id || null,
  }
}

/**
 * Lock exchange rate (cannot be modified after)
 */
export async function lockExchangeRate(rateId: string): Promise<void> {
  await prisma.exchangeRate.update({
    where: { id: rateId },
    data: {
      is_locked: true,
      locked_at: new Date(),
    },
  })
}

/**
 * Create manual exchange rate
 */
export async function createManualExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  rateType: RateType,
  effectiveDate: Date,
  createdById?: string
): Promise<string> {
  const rateRecord = await prisma.exchangeRate.create({
    data: {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate,
      rate_type: rateType,
      source: ExchangeRateSource.MANUAL,
      effective_date: effectiveDate,
      created_by_id: createdById,
    },
  })

  return rateRecord.id
}








