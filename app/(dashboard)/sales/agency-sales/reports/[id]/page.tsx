import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default function AgencySalesReportRedirect({
  params,
}: {
  params: { id: string }
}) {
  redirect(`/sales/agency/reports/${params.id}`)
}




