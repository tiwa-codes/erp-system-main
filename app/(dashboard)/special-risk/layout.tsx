import type { ReactNode } from "react"

export default function SpecialRiskLayout({ children }: { children: ReactNode }) {
  return <div className="red-accent-theme">{children}</div>
}

