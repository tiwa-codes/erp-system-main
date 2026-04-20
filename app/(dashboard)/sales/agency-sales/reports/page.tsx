import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default function AgencySalesReportsRedirect() {
  redirect("/sales/agency/reports")
}




