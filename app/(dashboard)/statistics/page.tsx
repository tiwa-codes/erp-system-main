export const dynamic = 'force-dynamic'

import { StatisticsDashboard } from "@/components/statistics/statistics-dashboard"



export default function StatisticsModulePage() {
  return <StatisticsDashboard initialSubmodule="overview" />
}
