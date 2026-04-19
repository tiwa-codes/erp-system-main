import type { CSSProperties, ReactNode } from "react"

export default function UnderwritingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="underwriting-theme"
      style={
        {
          "--primary": "353 80% 41%",
          "--primary-foreground": "0 0% 100%",
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
