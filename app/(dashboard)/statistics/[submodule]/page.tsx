import { StatisticsDashboard } from "@/components/statistics/statistics-dashboard"

export const dynamic = 'force-dynamic'

export default function StatisticsSubmodulePage({ params }: { params: { submodule: string } }) {
  return <StatisticsDashboard initialSubmodule={params.submodule} />
}
