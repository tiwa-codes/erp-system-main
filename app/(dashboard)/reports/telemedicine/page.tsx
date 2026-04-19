"use client"

import { SimpleDomainReport } from "@/components/reports/simple-domain-report"

export default function TelemedicineReportPage() {
  return (
    <SimpleDomainReport
      title="Telemedicine Report"
      subtitle="Appointments and telemedicine order statistics"
      reportType="TELEMEDICINE"
      filters={["Appointments", "Lab Orders", "Radiology Orders", "Pharmacy Orders", "Clinical Encounters"]}
      columnsByFilter={{
        Appointments: [
          { key: "date", label: "Date" },
          { key: "enrollee_name", label: "Patient" },
          { key: "enrollee_id", label: "ID" },
          { key: "patient_type", label: "Type" },
          { key: "organization", label: "Organization" },
          { key: "appointment_type", label: "Appt Type" },
          { key: "specialization", label: "Specialization" },
          { key: "state", label: "State" },
          { key: "lga", label: "LGA" },
          { key: "status", label: "Status" },
          { key: "percentage", label: "% of Period" },
        ],
        "Lab Orders": [
          { key: "date", label: "Date" },
          { key: "enrollee_name", label: "Enrollee" },
          { key: "test_name", label: "Test Name" },
          { key: "facility_name", label: "Facility" },
          { key: "status", label: "Status" },
          { key: "amount", label: "Amount" },
        ],
        "Radiology Orders": [
          { key: "date", label: "Date" },
          { key: "enrollee_name", label: "Enrollee" },
          { key: "test_name", label: "Test Name" },
          { key: "facility_name", label: "Facility" },
          { key: "status", label: "Status" },
          { key: "amount", label: "Amount" },
        ],
        "Pharmacy Orders": [
          { key: "date", label: "Date" },
          { key: "enrollee_name", label: "Enrollee" },
          { key: "medication", label: "Medication" },
          { key: "facility_name", label: "Facility" },
          { key: "status", label: "Status" },
          { key: "amount", label: "Amount" },
        ],
        "Clinical Encounters": [
          { key: "date", label: "Date" },
          { key: "enrollee_name", label: "Enrollee" },
          { key: "diagnosis", label: "Diagnosis" },
          { key: "created_by", label: "Created By" },
          { key: "status", label: "Status" },
        ],
      }}
      additionalFilters={[
        { key: "organization", label: "Organization", placeholder: "Filter by organization..." },
        { key: "state", label: "State", placeholder: "Filter by state..." },
        { key: "diagnosis", label: "Diagnosis", placeholder: "Filter by diagnosis..." },
      ]}
    />
  )
}
