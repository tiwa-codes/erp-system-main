export const dynamic = 'force-dynamic'

import { ClientUtilizationModule } from "@/components/utilization/client-utilization-module"



export default function UnderwritingUtilizationPage() {
  return (
    <ClientUtilizationModule
      permissionModule="underwriting"
      apiPath="/api/underwriting/utilization"
      title="Client Utilization Analysis"
    />
  )
}

