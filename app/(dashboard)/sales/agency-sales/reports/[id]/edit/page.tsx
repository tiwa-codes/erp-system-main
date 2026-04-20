import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default function AgencySalesReportEditRedirect({
  params,
}: {
  params: { id: string }
}) {
  redirect(`/sales/agency/reports/${params.id}/edit`)
}




