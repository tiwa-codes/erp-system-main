"use client"

import { Bell, Search, Settings, User, LogOut, Menu } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { formatDateTime, truncateText } from "@/lib/utils"
import { useNotificationSound } from "@/hooks/use-notification-sound"
import { NotificationSettings } from "@/components/ui/notification-settings"
import { useSidebar } from "@/components/layout/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { INTER_CLASSES } from "@/lib/font-utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export function Header() {
  const { data: session } = useSession()
  const { setIsMobileOpen } = useSidebar()

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile")
      if (!res.ok) throw new Error("Failed to fetch profile")
      return res.json()
    }
  })

  const { data: notificationsData } = useQuery<{ notifications: any[] }>({
    queryKey: ["dashboard", "notifications"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/notifications")
      if (!res.ok) throw new Error("Failed to load notifications")
      return res.json()
    },
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  })

  const notifications = notificationsData?.notifications || []
  const unreadCount = { count: notifications.length }

  // Enable notification sound for new alerts
  useNotificationSound({ 
    notifications, 
    enableSound: true 
  })

  return (
    <header className="h-14 bg-[#BE1522] lg:bg-white border-b border-[#BE1522] lg:border-gray-200 px-2 sm:px-3 lg:px-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-1 relative">
        {/* Hamburger Menu - Visible only on mobile */}
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0 text-white hover:bg-[#a0111b] hover:text-white" onClick={() => setIsMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile Title */}
        <div className="lg:hidden flex items-center w-full min-w-0 pr-4">
          <span className="text-white font-bold text-[17px] truncate">Aspirage</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-white lg:text-gray-700 hover:bg-[#a0111b] lg:hover:bg-gray-100 hover:text-white lg:hover:text-gray-900">
              <Bell className="h-5 w-5" />
              {unreadCount?.count ? (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs bg-red-500 lg:bg-[#BE1522] hover:bg-red-500 text-white border-white border">
                  {Math.min(unreadCount.count, 9)}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-w-[90vw]">
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">ERP Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount?.count > 0 && (
                    <div className="animate-pulse">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                  )}
                  <span className="text-xs text-gray-500">
                    🔔 Sound enabled
                  </span>
                </div>
              </div>
            </div>
            
            {/* Notification Settings */}
            <div className="p-3 border-b">
              <NotificationSettings />
            </div>
            
            <div className="p-3 text-sm text-gray-600 max-h-96 overflow-auto">
              {notifications && notifications.length > 0 ? (
                <div className="space-y-2">
                  {notifications.map((n, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded border flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" title={n.title}>{truncateText(n.title, 60)}</p>
                        <p className="text-xs text-gray-500">{n.time}{n.module ? ` • ${n.module}` : ""}</p>
                        <p className="text-xs text-gray-700 mt-1 line-clamp-2" title={n.message}>{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-gray-500">No new notifications</p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2 sm:px-3 text-white lg:text-gray-700 hover:bg-[#a0111b] lg:hover:bg-gray-100 hover:text-white lg:hover:text-gray-900">
              <Avatar className="h-8 w-8 border lg:border-0 border-white/20">
                <AvatarImage src={userProfile?.profile_picture || ""} />
                <AvatarFallback className="bg-white lg:bg-gray-100 text-[#BE1522] lg:text-gray-600 font-bold">
                  {session?.user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start text-xs">
                <span className={`${INTER_CLASSES.MEDIUM} text-white lg:text-gray-900`}>{session?.user?.name}</span>
                <span className={`${INTER_CLASSES.REGULAR} text-xs text-white/70 lg:text-gray-500`}>
                  {session?.user?.role === 'PROVIDER' ? userProfile?.provider_name || 'Provider' : session?.user?.role}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
