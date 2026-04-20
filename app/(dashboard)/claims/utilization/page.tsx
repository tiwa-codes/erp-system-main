import { ClientUtilizationModule } from "@/components/utilization/client-utilization-module"

export const dynamic = 'force-dynamic'

export default function ClaimsUtilizationPage() {
  return (
    <ClientUtilizationModule
      permissionModule="claims"
      apiPath="/api/claims/utilization"
      title="Client Utilization Analysis"
    />
  )
}

