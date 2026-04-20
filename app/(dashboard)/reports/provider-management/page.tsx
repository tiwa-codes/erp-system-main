"use client"

import { SimpleDomainReport } from "@/components/reports/simple-domain-report"

export const dynamic = 'force-dynamic'

export default function ProviderManagementReportPage() {
  return (
    <SimpleDomainReport
      title="Provider Management Report"
      subtitle="Providers and in-patient activity report"
      reportType="PROVIDER_MANAGEMENT"
      filters={["Providers", "In-patient"]}
      columnsByFilter={{
        Providers: [
          { key: "provider_name", label: "Provider Name" },
          { key: "approved_by", label: "Approved By" },
          { key: "approval_date", label: "Approval Date" },
          { key: "request_date", label: "Request Date" },
          { key: "status", label: "Status" },
        ],
        "In-patient": [
          { key: "date", label: "Date" },
          { key: "provider_name", label: "Provider Name" },
          { key: "enrollees_admitted", label: "Enrollees Admitted" },
          { key: "enrollees_discharged", label: "Enrollees Discharged" },
        ],
      }}
    />
  )
}

