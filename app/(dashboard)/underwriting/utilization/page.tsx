import { ClientUtilizationModule } from "@/components/utilization/client-utilization-module"

export const dynamic = 'force-dynamic'

export default function UnderwritingUtilizationPage() {
  return (
    <ClientUtilizationModule
      permissionModule="underwriting"
      apiPath="/api/underwriting/utilization"
      title="Client Utilization Analysis"
    />
  )
}

