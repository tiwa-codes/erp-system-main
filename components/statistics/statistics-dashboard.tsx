"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { PermissionGate } from "@/components/ui/permission-gate"
import type { StatisticsPeriod, StatisticsSnapshot } from "@/lib/statistics-data"
import styles from "./statistics-dashboard.module.css"

type TabKey =
  | "overview"
  | "erp"
  | "provider"
  | "enrollee"
  | "login"
  | "dropoff"
  | "daily"
  | "device"
  | "reports"

type StatisticsDashboardProps = {
  initialSubmodule?: string
}

type ChartType = "line" | "bar" | "pie"

type TablePayload = {
  headers: string[]
  rows: Array<Array<string | number>>
  fileName: string
}

const SUBMODULE_TO_TAB: Record<string, TabKey> = {
  overview: "overview",
  "erp-staff-usage": "erp",
  "provider-usage": "provider",
  "enrollee-app-usage": "enrollee",
  "login-analytics": "login",
  "drop-off-analytics": "dropoff",
  "daily-activities": "daily",
  "android-vs-ios": "device",
  "reports-export": "reports",
}

const PERIOD_OPTIONS: Array<{ value: StatisticsPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "90days", label: "Last 90 Days" },
]

const PIE_COLORS = ["#8b0000", "#1d4ed8", "#065f46", "#6d28d9", "#b45309", "#111827"]

const EMPTY_SNAPSHOT: StatisticsSnapshot & {
  device: StatisticsSnapshot["device"] & { versionLabels?: string[] }
} = {
  kpis: {
    erpUsers: 0,
    providerUsers: 0,
    enrolleeUsers: 0,
    totalLogins: 0,
    androidUsers: 0,
    iosUsers: 0,
    dropOff: 0,
    avgSession: "0m",
  },
  insights: [],
  activeUsersTrend: [],
  moduleUsage: [],
  hourlyUsage: [],
  erp: {
    totalUsers: 0,
    loggedInToday: 0,
    inactiveUsers: 0,
    mostUsedModule: "-",
    moduleChart: [],
    table: [],
  },
  provider: {
    registered: 0,
    loggedIn: 0,
    approvalCodes: 0,
    claims: 0,
    actionChart: [],
    table: [],
  },
  enrollee: {
    appUsers: 0,
    newSignups: 0,
    returning: 0,
    loggedIn: 0,
    featureChart: [],
    table: [],
  },
  login: {
    attempts: 0,
    success: 0,
    failed: 0,
    otp: 0,
    loginChart: [],
    sessionChart: [],
    table: [],
  },
  dropoff: {
    highest: "-",
    rate: 0,
    completion: 0,
    funnel: 0,
    enrolleeSteps: [],
    providerSteps: [],
    table: [],
  },
  daily: {
    dashboard: 0,
    providerSearch: 0,
    telemedicine: 0,
    chat: 0,
    trend: [],
    distribution: [],
    table: [],
  },
  device: {
    android: 0,
    ios: 0,
    androidErrors: 0,
    iosErrors: 0,
    platformChart: [],
    versionChart: [],
    versionLabels: [],
    table: [],
  },
  reports: {
    summary: [],
    regional: [],
  },
}

function resolveTabFromSubmodule(submodule?: string): TabKey {
  if (!submodule || submodule === "overview") return "overview"
  return SUBMODULE_TO_TAB[submodule] || "overview"
}

function formatValue(value: string | number): string {
  if (typeof value === "number") {
    return value.toLocaleString()
  }
  return value
}

function getBadgeClass(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized.includes("active") || normalized.includes("success")) {
    return `${styles.badge} ${styles.badgeSuccess}`
  }
  if (normalized.includes("inactive") || normalized.includes("warning")) {
    return `${styles.badge} ${styles.badgeWarning}`
  }
  if (normalized.includes("failed") || normalized.includes("error")) {
    return `${styles.badge} ${styles.badgeDanger}`
  }
  return `${styles.badge} ${styles.badgeInfo}`
}

function SimpleChart({
  type,
  labels,
  values,
}: {
  type: ChartType
  labels: string[]
  values: number[]
}) {
  const chartData = labels.map((label, index) => ({
    name: label,
    value: Number(values[index] ?? 0),
  }))

  if (type === "pie") {
    return (
      <div className={styles.chartBox}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} label>
              {chartData.map((entry, index) => (
                <Cell key={`pie-cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === "line") {
    return (
      <div className={styles.chartBox}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#eef2f7" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#8b0000" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className={styles.chartBox}>
      <ResponsiveContainer>
        <BarChart data={chartData}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#8b0000" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DataTable({
  headers,
  rows,
  badgeColumns = [],
}: {
  headers: string[]
  rows: Array<Array<string | number>>
  badgeColumns?: number[]
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => {
                if (badgeColumns.includes(cellIndex)) {
                  return (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>
                      <span className={getBadgeClass(String(cell))}>{String(cell)}</span>
                    </td>
                  )
                }
                return <td key={`cell-${rowIndex}-${cellIndex}`}>{String(cell)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InsightList({ items }: { items: string[] }) {
  return (
    <ul className={styles.insightList}>
      {items.map((item, index) => (
        <li key={`insight-${index}`} className={styles.insightItem} dangerouslySetInnerHTML={{ __html: item }} />
      ))}
    </ul>
  )
}

export function StatisticsDashboard({ initialSubmodule }: StatisticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(resolveTabFromSubmodule(initialSubmodule))
  const [periodFilter, setPeriodFilter] = useState<StatisticsPeriod>("7days")
  const [appliedPeriod, setAppliedPeriod] = useState<StatisticsPeriod>("7days")
  const [regionFilter, setRegionFilter] = useState("all")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [moduleFilter, setModuleFilter] = useState("all")
  const [appliedRegion, setAppliedRegion] = useState("all")
  const [appliedPlatform, setAppliedPlatform] = useState("all")
  const [appliedModule, setAppliedModule] = useState("all")
  const [liveData, setLiveData] = useState<StatisticsSnapshot | null>(null)
  const [isLoadingLiveData, setIsLoadingLiveData] = useState(false)
  const [liveDataError, setLiveDataError] = useState<string | null>(null)

  useEffect(() => {
    setActiveTab(resolveTabFromSubmodule(initialSubmodule))
  }, [initialSubmodule])

  useEffect(() => {
    let ignore = false

    const fetchLiveStatistics = async () => {
      setIsLoadingLiveData(true)
      setLiveDataError(null)
      try {
        const params = new URLSearchParams({
          period: appliedPeriod,
          region: appliedRegion,
          platform: appliedPlatform,
          module: appliedModule,
        })
        const response = await fetch(`/api/statistics?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error || "Failed to load live statistics")
        }
        const payload = await response.json()
        if (!ignore) {
          setLiveData(payload?.data || null)
        }
      } catch (error) {
        if (!ignore) {
          setLiveData(null)
          setLiveDataError(error instanceof Error ? error.message : "Failed to load live statistics")
        }
      } finally {
        if (!ignore) {
          setIsLoadingLiveData(false)
        }
      }
    }

    fetchLiveStatistics()

    return () => {
      ignore = true
    }
  }, [appliedPeriod, appliedRegion, appliedPlatform, appliedModule])

  const d = useMemo(() => liveData || EMPTY_SNAPSHOT, [liveData])
  const deviceVersionLabels = useMemo(() => {
    const labels = (d as any)?.device?.versionLabels as string[] | undefined
    if (labels && labels.length > 0) return labels
    const points = Array.isArray((d as any)?.device?.versionChart) ? (d as any).device.versionChart.length : 0
    if (points <= 0) return []
    return Array.from({ length: points }).map((_, index) => `Version ${index + 1}`)
  }, [liveData])

  const hasLiveData = useMemo(() => {
    if (!liveData) return false
    const hasKpi =
      Number(liveData.kpis.erpUsers) > 0 ||
      Number(liveData.kpis.providerUsers) > 0 ||
      Number(liveData.kpis.enrolleeUsers) > 0 ||
      Number(liveData.kpis.totalLogins) > 0
    const hasRows =
      liveData.erp.table.length > 0 ||
      liveData.provider.table.length > 0 ||
      liveData.enrollee.table.length > 0 ||
      liveData.login.table.length > 0 ||
      liveData.dropoff.table.length > 0 ||
      liveData.daily.table.length > 0 ||
      liveData.device.table.length > 0 ||
      liveData.reports.regional.length > 0
    return hasKpi || hasRows
  }, [d])

  const currentTable = useMemo<TablePayload | null>(() => {
    switch (activeTab) {
      case "erp":
        return {
          headers: [
            "User Name",
            "Role",
            "Department",
            "Last Login",
            "Logins",
            "Most Used Module",
            "Total Actions",
            "Status",
          ],
          rows: d.erp.table,
          fileName: "erp-staff-usage.csv",
        }
      case "provider":
        return {
          headers: [
            "Provider",
            "State",
            "Last Login",
            "Login Count",
            "Approval Codes",
            "Claims",
            "Tariff Actions",
            "Session Time",
          ],
          rows: d.provider.table,
          fileName: "provider-usage.csv",
        }
      case "enrollee":
        return {
          headers: [
            "Name",
            "Enrollee ID",
            "Platform",
            "Device",
            "Last Login",
            "Login Count",
            "Most Used Feature",
            "Session Time",
            "State",
          ],
          rows: d.enrollee.table,
          fileName: "enrollee-app-usage.csv",
        }
      case "login":
        return {
          headers: [
            "User Name",
            "User Type",
            "Platform",
            "Device",
            "Login Time",
            "Logout Time",
            "Session Duration",
            "Status",
            "Failure Reason",
          ],
          rows: d.login.table,
          fileName: "login-analytics.csv",
        }
      case "dropoff":
        return {
          headers: [
            "Process Name",
            "Users Started",
            "Users Completed",
            "Users Dropped",
            "Drop-off Rate",
            "Common Exit Screen",
          ],
          rows: d.dropoff.table,
          fileName: "drop-off-analytics.csv",
        }
      case "daily":
        return {
          headers: [
            "Date",
            "Total Active Users",
            "Total Sessions",
            "Most Used Feature",
            "Least Used Feature",
            "Avg Time Spent",
            "Completed Requests",
            "Failed Actions",
          ],
          rows: d.daily.table,
          fileName: "daily-activities.csv",
        }
      case "device":
        return {
          headers: [
            "Platform",
            "Device Model",
            "App Version",
            "OS Version",
            "Users Count",
            "Error Count",
            "Avg Session Time",
          ],
          rows: d.device.table,
          fileName: "android-vs-ios.csv",
        }
      case "reports":
        return {
          headers: [
            "Region",
            "ERP Users",
            "Provider Users",
            "App Users",
            "Total Logins",
            "Drop-off Rate",
            "Most Used Feature",
          ],
          rows: d.reports.regional,
          fileName: "regional-summary.csv",
        }
      default:
        return null
    }
  }, [activeTab, d])

  const applyFilters = () => {
    setAppliedPeriod(periodFilter)
    setAppliedRegion(regionFilter)
    setAppliedPlatform(platformFilter)
    setAppliedModule(moduleFilter)
  }

  const exportCurrentTableToCSV = () => {
    if (!currentTable) {
      window.alert("No table found in the current tab to export.")
      return
    }

    const rows = [currentTable.headers, ...currentTable.rows]
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", currentTable.fileName)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <PermissionGate module="statistics" action="view">
      <div className={styles.root}>
        <main className={styles.main}>
            <div className={styles.topbar}>
              <div>
                <h1 className={styles.pageTitle}>Statistics & Usage Analytics</h1>
                <p className={styles.pageSub}>
                  Monitor ERP usage, provider engagement, mobile app adoption, login behaviour and drop-off points.
                </p>
                <p className={styles.dataStatus}>
                  {isLoadingLiveData
                    ? "Refreshing live analytics data..."
                    : liveDataError
                      ? "Live analytics data is unavailable right now."
                      : hasLiveData
                        ? "Live analytics data loaded from app usage records."
                        : "No live analytics records found for selected filters."}
                </p>
              </div>

              <div className={styles.filters}>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Period</label>
                  <select
                    className={styles.filterInput}
                    value={periodFilter}
                    onChange={(event) => setPeriodFilter(event.target.value as StatisticsPeriod)}
                  >
                    {PERIOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Region</label>
                  <select className={styles.filterInput} value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
                    <option value="all">All Regions</option>
                    <option value="north">North</option>
                    <option value="southwest">South West</option>
                    <option value="southsouth">South South</option>
                    <option value="southeast">South East</option>
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Platform</label>
                  <select
                    className={styles.filterInput}
                    value={platformFilter}
                    onChange={(event) => setPlatformFilter(event.target.value)}
                  >
                    <option value="all">All Platforms</option>
                    <option value="android">Android</option>
                    <option value="ios">iOS</option>
                    <option value="web">Web ERP</option>
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Module</label>
                  <select className={styles.filterInput} value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
                    <option value="all">All Modules</option>
                    <option value="claims">Claims</option>
                    <option value="provider">Provider Management</option>
                    <option value="underwriting">Underwriting</option>
                    <option value="callcentre">Call Centre</option>
                    <option value="telemedicine">Telemedicine</option>
                    <option value="enrolleeapp">Enrollee App</option>
                  </select>
                </div>

                <div className={styles.filterActions}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={applyFilters} type="button">
                    Apply Filter
                  </button>
                  <button className={`${styles.btn} ${styles.btnLight}`} onClick={() => window.print()} type="button">
                    Print
                  </button>
                </div>
              </div>
            </div>

            {activeTab === "overview" && (
              <>
                <div className={styles.cardGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>ERP Users Today</div>
                    <div className={styles.statValue}>{formatValue(d.kpis.erpUsers)}</div>
                    <div className={styles.statSub}>Staff active on ERP within selected period</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Provider Portal Users</div>
                    <div className={styles.statValue}>{formatValue(d.kpis.providerUsers)}</div>
                    <div className={styles.statSub}>Providers who logged in and performed actions</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Enrollee App Users</div>
                    <div className={styles.statValue}>{formatValue(d.kpis.enrolleeUsers)}</div>
                    <div className={styles.statSub}>Android and iOS active enrollee users</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Total Logins</div>
                    <div className={styles.statValue}>{formatValue(d.kpis.totalLogins)}</div>
                    <div className={styles.statSub}>Combined web, provider and mobile logins</div>
                  </div>
                </div>

                <div className={styles.cardGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Android Active Users</div>
                    <div className={styles.statValue}>{formatValue(d.kpis.androidUsers)}</div>
                    <div className={styles.statSub}>Active Android app users</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>iOS Active Users</div>
                    <div className={styles.statValue}>{formatValue(d.kpis.iosUsers)}</div>
                    <div className={styles.statSub}>Active iOS app users</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Drop-off Rate</div>
                    <div className={styles.statValue}>{d.kpis.dropOff}%</div>
                    <div className={styles.statSub}>Percentage of users that did not complete process</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Avg Session Time</div>
                    <div className={styles.statValue}>{d.kpis.avgSession}</div>
                    <div className={styles.statSub}>Average time spent per active session</div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Daily Active Users Trend</div>
                        <div className={styles.panelSub}>Staff, providers and enrollees within selected period</div>
                      </div>
                    </div>
                    <SimpleChart
                      type="line"
                      labels={["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"]}
                      values={d.activeUsersTrend}
                    />
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Key Insights</div>
                        <div className={styles.panelSub}>Quick management insights</div>
                      </div>
                    </div>
                    <InsightList items={d.insights} />
                  </div>
                </div>

                <div className={styles.grid3}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Module Usage</div>
                        <div className={styles.panelSub}>Most used ERP/app modules</div>
                      </div>
                    </div>
                    <SimpleChart
                      type="bar"
                      labels={["Claims", "Provider Mgmt", "Underwriting", "Call Centre", "Telemedicine", "Finance"]}
                      values={d.moduleUsage}
                    />
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Android vs iOS</div>
                        <div className={styles.panelSub}>Mobile app usage split</div>
                      </div>
                    </div>
                    <SimpleChart type="pie" labels={["Android", "iOS"]} values={[d.kpis.androidUsers, d.kpis.iosUsers]} />
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Peak Usage Window</div>
                        <div className={styles.panelSub}>When traffic is highest</div>
                      </div>
                    </div>
                    <SimpleChart
                      type="bar"
                      labels={["6AM", "8AM", "10AM", "12PM", "2PM", "4PM", "6PM"]}
                      values={d.hourlyUsage}
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === "erp" && (
              <>
                <div className={styles.miniCards}>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Total ERP Staff</div>
                    <div className={styles.miniValue}>{formatValue(d.erp.totalUsers)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Logged In Today</div>
                    <div className={styles.miniValue}>{formatValue(d.erp.loggedInToday)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Inactive Users</div>
                    <div className={styles.miniValue}>{formatValue(d.erp.inactiveUsers)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Most Used Module</div>
                    <div className={styles.miniValue}>{d.erp.mostUsedModule}</div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>ERP Activity by Module</div>
                        <div className={styles.panelSub}>Usage across key ERP departments</div>
                      </div>
                    </div>
                    <SimpleChart
                      type="bar"
                      labels={["Claims", "Underwriting", "Finance", "Call Centre", "Telemedicine", "HR"]}
                      values={d.erp.moduleChart}
                    />
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>ERP Staff Usage Table</div>
                        <div className={styles.panelSub}>Last login and total activities</div>
                      </div>
                    </div>
                    <DataTable
                      headers={[
                        "User Name",
                        "Role",
                        "Department",
                        "Last Login",
                        "Logins",
                        "Most Used Module",
                        "Total Actions",
                        "Status",
                      ]}
                      rows={d.erp.table}
                      badgeColumns={[7]}
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === "provider" && (
              <>
                <div className={styles.miniCards}>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Providers Registered</div>
                    <div className={styles.miniValue}>{formatValue(d.provider.registered)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Providers Logged In</div>
                    <div className={styles.miniValue}>{formatValue(d.provider.loggedIn)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Approval Code Requests</div>
                    <div className={styles.miniValue}>{formatValue(d.provider.approvalCodes)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Claims Submitted</div>
                    <div className={styles.miniValue}>{formatValue(d.provider.claims)}</div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Provider Actions</div>
                        <div className={styles.panelSub}>Portal activity by action type</div>
                      </div>
                    </div>
                    <SimpleChart
                      type="bar"
                      labels={["Approval Codes", "Claims", "Tariff Actions", "Other Actions"]}
                      values={d.provider.actionChart}
                    />
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Top Active Providers</div>
                        <div className={styles.panelSub}>Most active provider facilities</div>
                      </div>
                    </div>
                    <DataTable
                      headers={[
                        "Provider",
                        "State",
                        "Last Login",
                        "Login Count",
                        "Approval Codes",
                        "Claims",
                        "Tariff Actions",
                        "Session Time",
                      ]}
                      rows={d.provider.table}
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === "enrollee" && (
              <>
                <div className={styles.miniCards}>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Total App Users</div>
                    <div className={styles.miniValue}>{formatValue(d.enrollee.appUsers)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>New Signups</div>
                    <div className={styles.miniValue}>{formatValue(d.enrollee.newSignups)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Returning Users</div>
                    <div className={styles.miniValue}>{formatValue(d.enrollee.returning)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Logged In Users</div>
                    <div className={styles.miniValue}>{formatValue(d.enrollee.loggedIn)}</div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Enrollee App Feature Usage</div>
                        <div className={styles.panelSub}>What users do most on the app</div>
                      </div>
                    </div>
                    <SimpleChart
                      type="bar"
                      labels={["Benefits", "Provider Search", "Telemedicine", "Chat", "Claims History", "Profile"]}
                      values={d.enrollee.featureChart}
                    />
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Enrollee Activity Table</div>
                        <div className={styles.panelSub}>App users and behaviour</div>
                      </div>
                    </div>
                    <DataTable
                      headers={[
                        "Name",
                        "Enrollee ID",
                        "Platform",
                        "Device",
                        "Last Login",
                        "Login Count",
                        "Most Used Feature",
                        "Session Time",
                        "State",
                      ]}
                      rows={d.enrollee.table}
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === "login" && (
              <>
                <div className={styles.miniCards}>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Login Attempts</div>
                    <div className={styles.miniValue}>{formatValue(d.login.attempts)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Successful Logins</div>
                    <div className={styles.miniValue}>{formatValue(d.login.success)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Failed Logins</div>
                    <div className={styles.miniValue}>{formatValue(d.login.failed)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>OTP Requested</div>
                    <div className={styles.miniValue}>{formatValue(d.login.otp)}</div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Login Success vs Failure</div>
                        <div className={styles.panelSub}>Authentication behaviour across all users</div>
                      </div>
                    </div>
                    <SimpleChart type="pie" labels={["Success", "Failed"]} values={d.login.loginChart} />
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Session Analytics</div>
                        <div className={styles.panelSub}>Average session behaviour</div>
                      </div>
                    </div>
                    <SimpleChart type="line" labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} values={d.login.sessionChart} />
                  </div>
                </div>

                <div className={`${styles.panel} ${styles.sectionSpace}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Login Log Table</div>
                      <div className={styles.panelSub}>User authentication activity</div>
                    </div>
                  </div>
                  <DataTable
                    headers={[
                      "User Name",
                      "User Type",
                      "Platform",
                      "Device",
                      "Login Time",
                      "Logout Time",
                      "Session Duration",
                      "Status",
                      "Failure Reason",
                    ]}
                    rows={d.login.table}
                    badgeColumns={[7]}
                  />
                </div>
              </>
            )}

            {activeTab === "dropoff" && (
              <>
                <div className={styles.miniCards}>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Highest Drop-off Screen</div>
                    <div className={styles.miniValue}>{d.dropoff.highest}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Drop-off Rate</div>
                    <div className={styles.miniValue}>{d.dropoff.rate}%</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Completion Rate</div>
                    <div className={styles.miniValue}>{d.dropoff.completion}%</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Funnel Success</div>
                    <div className={styles.miniValue}>{d.dropoff.funnel}%</div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Enrollee App Funnel</div>
                        <div className={styles.panelSub}>Journey from app open to action completion</div>
                      </div>
                    </div>
                    <div className={styles.funnel}>
                      {d.dropoff.enrolleeSteps.map((step: [string, number]) => (
                        <div key={`enrollee-${step[0]}`} className={styles.funnelStep}>
                          <div className={styles.funnelHead}>
                            <span>{step[0]}</span>
                            <span>{step[1]}%</span>
                          </div>
                          <div className={styles.barTrack}>
                            <div className={styles.barFill} style={{ width: `${step[1]}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Provider Portal Funnel</div>
                        <div className={styles.panelSub}>Journey from login to request submission</div>
                      </div>
                    </div>
                    <div className={styles.funnel}>
                      {d.dropoff.providerSteps.map((step: [string, number]) => (
                        <div key={`provider-${step[0]}`} className={styles.funnelStep}>
                          <div className={styles.funnelHead}>
                            <span>{step[0]}</span>
                            <span>{step[1]}%</span>
                          </div>
                          <div className={styles.barTrack}>
                            <div className={styles.barFill} style={{ width: `${step[1]}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`${styles.panel} ${styles.sectionSpace}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Drop-off Table</div>
                      <div className={styles.panelSub}>Where users stop without completion</div>
                    </div>
                  </div>
                  <DataTable
                    headers={[
                      "Process Name",
                      "Users Started",
                      "Users Completed",
                      "Users Dropped",
                      "Drop-off Rate",
                      "Common Exit Screen",
                    ]}
                    rows={d.dropoff.table}
                  />
                </div>
              </>
            )}

            {activeTab === "daily" && (
              <>
                <div className={styles.miniCards}>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Dashboard Visits</div>
                    <div className={styles.miniValue}>{formatValue(d.daily.dashboard)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Provider Search</div>
                    <div className={styles.miniValue}>{formatValue(d.daily.providerSearch)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Telemedicine Requests</div>
                    <div className={styles.miniValue}>{formatValue(d.daily.telemedicine)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Chat Support Starts</div>
                    <div className={styles.miniValue}>{formatValue(d.daily.chat)}</div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Daily Activity Trend</div>
                        <div className={styles.panelSub}>Feature usage trend</div>
                      </div>
                    </div>
                    <SimpleChart
                      type="line"
                      labels={["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"]}
                      values={d.daily.trend}
                    />
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Feature Distribution</div>
                        <div className={styles.panelSub}>Daily activities across top actions</div>
                      </div>
                    </div>
                    <SimpleChart
                      type="bar"
                      labels={["Provider Search", "Benefits", "Telemedicine", "Chat", "Claims", "Profile"]}
                      values={d.daily.distribution}
                    />
                  </div>
                </div>

                <div className={`${styles.panel} ${styles.sectionSpace}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Daily Activity Table</div>
                      <div className={styles.panelSub}>Activity summary per day</div>
                    </div>
                  </div>
                  <DataTable
                    headers={[
                      "Date",
                      "Total Active Users",
                      "Total Sessions",
                      "Most Used Feature",
                      "Least Used Feature",
                      "Avg Time Spent",
                      "Completed Requests",
                      "Failed Actions",
                    ]}
                    rows={d.daily.table}
                  />
                </div>
              </>
            )}

            {activeTab === "device" && (
              <>
                <div className={styles.miniCards}>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Android Users</div>
                    <div className={styles.miniValue}>{formatValue(d.device.android)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>iOS Users</div>
                    <div className={styles.miniValue}>{formatValue(d.device.ios)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>Android Errors</div>
                    <div className={styles.miniValue}>{formatValue(d.device.androidErrors)}</div>
                  </div>
                  <div className={styles.miniCard}>
                    <div className={styles.miniTitle}>iOS Errors</div>
                    <div className={styles.miniValue}>{formatValue(d.device.iosErrors)}</div>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Platform Distribution</div>
                        <div className={styles.panelSub}>Android and iOS usage comparison</div>
                      </div>
                    </div>
                    <SimpleChart type="pie" labels={["Android", "iOS"]} values={d.device.platformChart} />
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>App Version Adoption</div>
                        <div className={styles.panelSub}>How many users are on each app version</div>
                      </div>
                    </div>
                    <SimpleChart type="bar" labels={deviceVersionLabels} values={d.device.versionChart} />
                  </div>
                </div>

                <div className={`${styles.panel} ${styles.sectionSpace}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Device / Platform Table</div>
                      <div className={styles.panelSub}>Models, OS versions and crashes</div>
                    </div>
                  </div>
                  <DataTable
                    headers={[
                      "Platform",
                      "Device Model",
                      "App Version",
                      "OS Version",
                      "Users Count",
                      "Error Count",
                      "Avg Session Time",
                    ]}
                    rows={d.device.table}
                  />
                </div>
              </>
            )}

            {activeTab === "reports" && (
              <>
                <div className={styles.grid2}>
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Reports & Export</div>
                        <div className={styles.panelSub}>Generate and export analytics reports</div>
                      </div>
                    </div>

                    <div className={styles.reportActions}>
                      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={exportCurrentTableToCSV} type="button">
                        Export Current Table to CSV
                      </button>
                      <button className={`${styles.btn} ${styles.btnLight}`} onClick={() => window.print()} type="button">
                        Export to PDF / Print
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnLight}`}
                        onClick={() => window.alert("Scheduled report workflow can be connected to your backend mailer.")}
                        type="button"
                      >
                        Schedule Report
                      </button>
                    </div>

                    <div className={`${styles.sectionSpace} ${styles.emptyNote}`}>
                      Use the period, region, platform and module filters at the top to generate the exact report view you want before exporting.
                    </div>
                  </div>

                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <div>
                        <div className={styles.panelTitle}>Executive Summary</div>
                        <div className={styles.panelSub}>Snapshot for MD and management</div>
                      </div>
                    </div>
                    <InsightList items={d.reports.summary} />
                  </div>
                </div>

                <div className={`${styles.panel} ${styles.sectionSpace}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <div className={styles.panelTitle}>Regional Summary Table</div>
                      <div className={styles.panelSub}>Active users and actions by region</div>
                    </div>
                  </div>
                  <DataTable
                    headers={[
                      "Region",
                      "ERP Users",
                      "Provider Users",
                      "App Users",
                      "Total Logins",
                      "Drop-off Rate",
                      "Most Used Feature",
                    ]}
                    rows={d.reports.regional}
                  />
                </div>
              </>
            )}
        </main>
      </div>
    </PermissionGate>
  )
}
