"use client"

import { SimpleDomainReport } from "@/components/reports/simple-domain-report"

export default function UnderwritingReportPage() {
  return (
    <SimpleDomainReport
      title="Underwriting Report"
      subtitle="Organizations, principals, dependents, and enrollee trends"
      reportType="UNDERWRITING"
      filters={["Organizations", "Principals", "Dependents", "Enrollees"]}
      columnsByFilter={{
        Organizations: [
          { key: "date", label: "Date" },
          { key: "organizations_count", label: "Organizations" },
          { key: "principals_count", label: "Principals" },
          { key: "dependents_count", label: "Dependents" },
          { key: "total_enrollees", label: "Total Enrollees" },
        ],
        Principals: [
          { key: "date", label: "Date" },
          { key: "principals_count", label: "Principals" },
          { key: "males_count", label: "Males" },
          { key: "females_count", label: "Females" },
        ],
        Dependents: [
          { key: "date", label: "Date" },
          { key: "dependents_count", label: "Dependents" },
          { key: "males_count", label: "Males" },
          { key: "females_count", label: "Females" },
        ],
        Enrollees: [
          { key: "date", label: "Date" },
          { key: "enrollees_count", label: "Enrollees" },
          { key: "plan_type_breakdown", label: "Plan Type Breakdown" },
          { key: "status_breakdown", label: "Status Breakdown" },
        ],
      }}
    />
  )
}

