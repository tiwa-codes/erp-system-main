export const dynamic = 'force-dynamic'

import { redirect } from "next/navigation"



export default function AgencySalesReportEditRedirect({
  params,
}: {
  params: { id: string }
}) {
  redirect(`/sales/agency/reports/${params.id}/edit`)
}




