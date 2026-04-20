"use client"

export const dynamic = 'force-dynamic'

import { ConsolidatedSalesDashboard } from "@/components/sales/consolidated-sales-dashboard"



export default function ConsolidatedSalesPage() {
  return <ConsolidatedSalesDashboard showAnnualTargetButton />
}
