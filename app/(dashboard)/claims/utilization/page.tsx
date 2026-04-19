import { ClientUtilizationModule } from "@/components/utilization/client-utilization-module"

export default function ClaimsUtilizationPage() {
  return (
    <ClientUtilizationModule
      permissionModule="claims"
      apiPath="/api/claims/utilization"
      title="Client Utilization Analysis"
    />
  )
}

