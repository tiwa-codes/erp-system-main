export const dynamic = 'force-dynamic'

import { redirect } from "next/navigation"



export default function AgencySalesReportRedirect({
  params,
}: {
  params: { id: string }
}) {
  redirect(`/sales/agency/reports/${params.id}`)
}




