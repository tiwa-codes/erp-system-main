import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ClientLogoutButton } from "@/components/client/client-logout-button"

export default async function ClientPortalLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/client/login")
  }

  if ((session.user.role || "").toUpperCase() !== "GUEST_OR_CLIENT") {
    redirect("/client/login")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-600">Benefit Package, Registration and Pending Requests</p>
          </div>
          <ClientLogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
