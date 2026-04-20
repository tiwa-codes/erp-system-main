"use client"

import { ConsolidatedSalesDashboard } from "@/components/sales/consolidated-sales-dashboard"

export const dynamic = 'force-dynamic'

export default function ConsolidatedSalesPage() {
  return <ConsolidatedSalesDashboard showAnnualTargetButton />
}
