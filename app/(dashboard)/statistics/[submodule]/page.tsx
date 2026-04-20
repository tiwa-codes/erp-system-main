export const dynamic = 'force-dynamic'

import { StatisticsDashboard } from "@/components/statistics/statistics-dashboard"



export default function StatisticsSubmodulePage({ params }: { params: { submodule: string } }) {
  return <StatisticsDashboard initialSubmodule={params.submodule} />
}
