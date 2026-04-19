import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Aspirage",
  description: "Comprehensive ERP system for healthcare management",
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,   // Prevents iOS auto-zoom on form input tap
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-inter`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
