import { StatisticsDashboard } from "@/components/statistics/statistics-dashboard"

export const dynamic = 'force-dynamic'

export default function StatisticsModulePage() {
  return <StatisticsDashboard initialSubmodule="overview" />
}
