"use client"

import { signOut } from "next-auth/react"

export function ClientLogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/client/login" })}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
    >
      Logout
    </button>
  )
}
