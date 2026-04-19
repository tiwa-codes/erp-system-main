"use client"

import type React from "react"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Sidebar, SidebarProvider, useSidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Toaster } from "@/components/ui/toaster"
import { FirstLoginModal } from "@/components/auth/first-login-modal"
import { cn } from "@/lib/utils"

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()
  const { data: session } = useSession()
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false)
  
  useEffect(() => {
    // Check if user is on first login
    if (session?.user && (session.user as any).first_login) {
      setShowFirstLoginModal(true)
    } else {
      setShowFirstLoginModal(false)
    }
  }, [session])

  // Debug: Log session data
  useEffect(() => {
    if (session?.user) {
    }
  }, [session])
  
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300",
        "lg:ml-72",
        isCollapsed && "lg:ml-16"
      )}>
        <Header />
        <main className="flex-1 overflow-auto p-2 sm:p-3 lg:p-4">{children}</main>
      </div>
      <Toaster />
      <FirstLoginModal 
        isOpen={showFirstLoginModal} 
        onClose={() => setShowFirstLoginModal(false)} 
      />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return // Still loading
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  )
}
