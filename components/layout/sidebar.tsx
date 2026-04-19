"use client"

import { useState, createContext, useContext, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  AlertTriangle,
  Settings,
  TrendingUp,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Shield,
  UserCheck,
  Building,
  Receipt,
  BarChart3,
  Globe,
  Pencil,
  Hash,
  MessageSquare,
  Headphones,
  ChevronDown,
  ChevronUp,
  Phone,
  Briefcase,
  Star,
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"

type SidebarNotificationsResponse = {
  success: boolean
  notifications?: {
    department_oversight?: {
      procurement?: number
      memos?: number
      total?: number
    }
    internal_control?: {
      procurement?: number
      audit?: number
      total?: number
    }
    executive_desk?: {
      procurement?: number
      claims_approval?: number
      custom_plans?: number
      memos?: number
      total?: number
    }
    underwriting?: {
      pending_updates?: number
      total?: number
    }
    finance?: {
      pending_transactions?: number
      pending_claims_settlement?: number
      total?: number
    }
    call_centre?: {
      pending_provider_requests?: number
      pending_encounter_codes?: number
      total?: number
    }
    claims?: {
      pending_auto_bills?: number
      pending_manual_bills?: number
      total?: number
    }
    provider_management?: {
      pending_submissions?: number
      total?: number
    }
    telemedicine?: {
      pending_requests?: number
      total?: number
    }
  }
}

const navigation = [
  {
    id: "dashboard",
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "hr",
    name: "Human Resources",
    href: "/hr",
    icon: Globe,
    children: [
      {
        id: "employees",
        name: "Employees",
        href: "/hr/employees",
      },
      {
        id: "departments",
        name: "Departments",
        href: "/hr/departments",
      },
      {
        id: "attendance",
        name: "Attendance",
        href: "/hr/attendance",
      },
      {
        id: "leave",
        name: "Leave Management",
        href: "/hr/leave",
      },
      {
        id: "payroll",
        name: "Payroll",
        href: "/hr/payroll",
      },
      {
        id: "hr-rules",
        name: "HR Rules",
        href: "/hr/rules",
      },
      {
        id: "procurement",
        name: "Procurement",
        href: "/hr/procurement",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/hr/memos",
      },
    ],
  },
  {
    id: "department-oversight",
    name: "Department Oversight",
    href: "#",
    icon: Building2,
    children: [
      {
        id: "procurement-bill",
        name: "Procurement Bill",
        href: "/department-oversight/procurement-bill",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/department-oversight/memos",
      }
    ],
  },
  {
    id: "operation-desk",
    name: "Internal Control",
    href: "/operation-desk",
    icon: Building,
    children: [
      {
        id: "procurement-bill",
        name: "Procurement Bill",
        href: "/operation-desk/procurement-bill",
      },
      {
        id: "audit",
        name: "Claims Audit",
        href: "/operation-desk/audit",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/operation-desk/memos",
      },
    ],
  },
  {
    id: "special-risk",
    name: "Special Services",
    href: "#",
    icon: AlertTriangle,
    children: [
      {
        id: "custom-plans",
        name: "Custom Plans",
        href: "/special-risk/custom-plans",
      },
      {
        id: "special-providers",
        name: "International Coverage",
        href: "/special-risk/special-providers",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/special-risk/memos",
      },
    ],
  },
  {
    id: "legal",
    name: "Legal Services",
    href: "#",
    icon: FileText,
    children: [
      {
        id: "documents",
        name: "Documents",
        href: "/legal/documents",
      },
      {
        id: "meeting-minutes",
        name: "Meeting Minutes",
        href: "/legal/meeting-minutes",
      },
      {
        id: "sales-documents",
        name: "Sales Documents",
        href: "/legal/sales-documents",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/legal/memos",
      },
      {
        id: "procurement",
        name: "Procurement",
        href: "/legal/procurement",
      },
    ],
  },
  {
    id: "sales",
    name: "Sales",
    href: "#",
    icon: TrendingUp,
    children: [
      {
        id: "corporate",
        name: "Sales Report",
        href: "/sales/report",
      },
      {
        id: "agency",
        name: "Digital Sales",
        href: "/sales/digital",
      },
      {
        id: "special-risks",
        name: "Consolidated Sales",
        href: "/sales/consolidated",
      },
      {
        id: "operations",
        name: "Procurement",
        href: "/sales/operations",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/sales/memos",
      },
    ],
  },
  {
    id: "client",
    name: "Client",
    href: "/client",
    icon: UserCheck,
    children: [
      {
        id: "benefit-package",
        name: "Benefit Package",
        href: "/client",
      },
      {
        id: "registration",
        name: "Registration",
        href: "/client?tab=registration",
      },
      {
        id: "pending-requests",
        name: "Pending Requests",
        href: "/client?tab=pending-requests",
      },
    ],
  },
  {
    id: "executive-desk",
    name: "Executive Desk",
    href: "/executive-desk",
    icon: Briefcase,
    children: [
      {
        id: "procurement-bill",
        name: "Procurement Bill",
        href: "/executive-desk/procurement-bill",
      },
      {
        id: "approval",
        name: "Claims Approval",
        href: "/executive-desk/approval",
      },
      {
        id: "msa-approval",
        name: "MSA Approval",
        href: "/executive-desk/msa-approval",
      },
      {
        id: "custom-plans",
        name: "Custom Plans",
        href: "/executive-desk/custom-plans",
      },
      {
        id: "consolidated-sales",
        name: "Consolidated Sales",
        href: "/executive-desk/consolidated-sales",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/executive-desk/memos",
      }
    ],
  },
  {
    id: "underwriting",
    name: "Underwriting",
    href: "#",
    icon: Pencil,
    children: [
      {
        id: "organizations",
        name: "Organizations",
        href: "/underwriting/organizations",
      },
      {
        id: "coverage",
        name: "Coverage Rules",
        href: "/underwriting/coverage",
      },
      {
        id: "principals",
        name: "Principals",
        href: "/underwriting/principals",
      },
      {
        id: "mobile",
        name: "Pending Updates",
        href: "/underwriting/mobile",
      },
      {
        id: "dependents",
        name: "Dependents",
        href: "/underwriting/dependents",
      },
      {
        id: "utilization",
        name: "Client Utilization",
        href: "/underwriting/utilization",
      },
      {
        id: "plans-management",
        name: "Plans Management",
        href: "/underwriting/plans",
      },
      {
        id: "custom-plans",
        name: "Custom Plans",
        href: "/underwriting/custom-plans",
      },
      {
        id: "band-labels",
        name: "Band Labels",
        href: "/underwriting/band-labels",
      },
      {
        id: "procurement",
        name: "Procurement",
        href: "/underwriting/procurement",
      },
      {
        id: "leave",
        name: "Leave Management",
        href: "/underwriting/leave",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/underwriting/memos",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    href: "/finance",
    icon: Hash,
    children: [
      {
        id: "chart-of-accounts",
        name: "Chart of Accounts",
        href: "/finance/chart-of-accounts",
      },
      {
        id: "general-ledger",
        name: "General Ledger",
        href: "/finance/general-ledger",
      },
      {
        id: "general-ledger-summary",
        name: "GL Summary",
        href: "/finance/general-ledger/summary",
      },
      {
        id: "journal-entries",
        name: "Journal Entries",
        href: "/finance/journal-entries",
      },
      {
        id: "trial-balance",
        name: "Trial Balance",
        href: "/finance/trial-balance",
      },
      {
        id: "profit-loss",
        name: "Profit & Loss",
        href: "/finance/profit-loss",
      },
      {
        id: "balance-sheet",
        name: "Balance Sheet",
        href: "/finance/balance-sheet",
      },
      {
        id: "financial-transactions",
        name: "Financial Transactions",
        href: "/finance/transactions",
      },
      {
        id: "claims-settlement",
        name: "Claims Settlement",
        href: "/finance/settlement",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/finance/memos",
      },
      {
        id: "procurement",
        name: "Procurement",
        href: "/finance/procurement",
      },
      {
        id: "leave",
        name: "Leave Management",
        href: "/finance/leave",
      },
    ],
  },
  {
    id: "call-centre",
    name: "Call Centre",
    href: "#",
    icon: Phone,
    children: [
      {
        id: "call-centre-dashboard",
        name: "Provider Request",
        href: "/call-centre",
      },
      {
        id: "requests-provider",
        name: "Service Authorization",
        href: "/call-centre/requests",
      },
      {
        id: "coverage-checker",
        name: "Coverage Checker",
        href: "/call-centre/coverage",
      },
      {
        id: "verify-approval",
        name: "Verify Approval Code",
        href: "/call-centre/verify",
      },
      {
        id: "generate-approval-code",
        name: "Generate Approval Code",
        href: "/call-centre/manual-code",
      },
      {
        id: "manage-encounter-codes",
        name: "Manage Encounter Codes",
        href: "/call-centre/manage-encounter-codes",
      },
      {
        id: "procurement",
        name: "Procurement",
        href: "/call-centre/procurement",
      },
      {
        id: "leave",
        name: "Leave Management",
        href: "/call-centre/leave",
      },
      {
        id: "rejected-services",
        name: "Rejected Services",
        href: "/call-centre/rejected-services",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/call-centre/memos",
      },
    ],
  },
  {
    id: "claims",
    name: "Claims",
    href: "/claims",
    icon: MessageSquare,
    children: [
      {
        id: "vetter1",
        name: "Vetter 1",
        href: "/claims/vetter1",
      },
      {
        id: "vetter2",
        name: "Vetter 2",
        href: "/claims/vetter2",
      },
      {
        id: "approved-codes",
        name: "Vetted Claims",
        href: "/claims/approved-codes",
      },
      {
        id: "claims-utilization",
        name: "Client Utilization",
        href: "/claims/utilization",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/claims/memos",
      },
      {
        id: "procurement",
        name: "Procurement",
        href: "/claims/procurement",
      },
      {
        id: "leave",
        name: "Leave Management",
        href: "/claims/leave",
      },
      {
        id: "audit-trail",
        name: "Audit Trail",
        href: "/claims/audit-trail",
      },
      {
        id: "payment-advice",
        name: "Payment Advice",
        href: "/claims/payment-advice",
      },
    ],
  },
  {
    id: "provider",
    name: "Provider Management",
    href: "/provider",
    icon: Building2,
    children: [
      {
        id: "provider-dashboard",
        name: "Provider",
        href: "/provider",
      },
      {
        id: "provider-approval",
        name: "Provider Approval",
        href: "/providers/approval",
      },
      {
        id: "provider-accounts-management",
        name: "Provider Accounts",
        href: "/users/providers",
      },
      {
        id: "tariff-negotiation",
        name: "Tariff Negotiation",
        href: "/provider/tariff-negotiation",
      },
      {
        id: "inpatient-management",
        name: "In-patient Management",
        href: "/provider/inpatient",
      },
      {
        id: "procurement",
        name: "Procurement",
        href: "/provider/procurement",
      },
      {
        id: "leave",
        name: "Leave Management",
        href: "/provider/leave",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/provider/memos",
      },
    ],
  },
  {
    id: "providers",
    name: "Provider",
    href: "#",
    icon: Building2,
    children: [
      {
        id: "approval-codes",
        name: "Approval Codes",
        href: "/providers/approval-codes",
      },
      {
        id: "claims-request-provider",
        name: "Claims Request",
        href: "/providers/requests",
      },
      {
        id: "tariff-agreement",
        name: "Tariff Agreement",
        href: "/providers/tariff-agreement",
      },
      // {
      //   id: "verify-encounter-code",
      //   name: "Verify Encounter Code",
      //   href: "/providers/verify-encounter",
      // },
    ],
  },
  {
    id: "telemedicine",
    name: "Telemedicine",
    href: "#",
    icon: Phone,
    children: [
      // {
      //   id: "scheduled-appointment",
      //   name: "Scheduled Appointment",
      //   href: "/telemedicine/scheduled-appointment",
      // },
      {
        id: "pending-bookings",
        name: "Pending Bookings",
        href: "/telemedicine/pending-bookings",
      },
      {
        id: "outpatient",
        name: "Outpatient",
        href: "/telemedicine/outpatient",
      },
      {
        id: "manage-facilities",
        name: "Manage Facilities",
        href: "/telemedicine/facilities",
      },
      {
        id: "claims-request",
        name: "Claims Request",
        href: "/telemedicine/claims-request",
      },
      {
        id: "memos",
        name: "Memos",
        href: "/telemedicine/memos",
      },
      {
        id: "procurement",
        name: "Procurement",
        href: "/telemedicine/procurement",
      },
      {
        id: "telemedicine-full-report",
        name: "Full Report",
        href: "/reports/telemedicine",
      },
    ],
  },
  {
    id: "fraud-detection",
    name: "Fraud Detection",
    href: "/fraud-detection",
    icon: Shield,
    children: [
      {
        id: "fraud-detection-dashboard",
        name: "Fraud Detection",
        href: "/fraud-detection",
      },
      {
        id: "provider-risk-profile",
        name: "Provider Tariff Plan",
        href: "/providers/risk-profile",
      },
      {
        id: "rules-management",
        name: "Rules Management",
        href: "/claims/rules",
      },
      {
        id: "flagged-claims",
        name: "Flagged Claims",
        href: "/fraud-detection/flagged-claims",
      },
      {
        id: "history",
        name: "History",
        href: "/fraud-detection/flagged-claims/history",
      },
      {
        id: "risk-management",
        name: "Risk Management",
        href: "/fraud-detection/risk-management",
      },
      // {
      //   id: "analytics",
      //   name: "Analytics",
      //   href: "/fraud-detection/analytics",
      // },
      // {
      //   id: "rules",
      //   name: "Detection Rules",
      //   href: "/fraud-detection/rules",
      // },
      // {
      //   id: "reports",
      //   name: "Reports",
      //   href: "/fraud-detection/reports",
      // },
    ],
  },
  {
    id: "users",
    name: "Users",
    href: "/users",
    icon: Users,
    children: [
      {
        id: "users-list",
        name: "User Management",
        href: "/users",
      },
      {
        id: "provider-accounts",
        name: "Provider Accounts",
        href: "/users/providers",
      },
      {
        id: "client-accounts",
        name: "Client Accounts",
        href: "/users/client-accounts",
      },
      {
        id: "permissions",
        name: "Permission Matrix",
        href: "/users/permissions",
      },
      {
        id: "roles",
        name: "Role Management",
        href: "/users/roles",
      },
    ],
  },
  {
    id: "reports",
    name: "Reports",
    href: "#",
    icon: BarChart3,
    children: [
      {
        id: "reports-dashboard",
        name: "Reports",
        href: "/reports",
      },
      {
        id: "reports-call-centre",
        name: "Call Centre Report",
        href: "/reports/call-centre",
      },
      {
        id: "reports-claims",
        name: "Claims Report",
        href: "/reports/claims",
      },
      {
        id: "reports-telemedicine",
        name: "Telemedicine Report",
        href: "/reports/telemedicine",
      },
      {
        id: "reports-underwriting",
        name: "Underwriting Report",
        href: "/reports/underwriting",
      },
      {
        id: "reports-provider-management",
        name: "Provider Management Report",
        href: "/reports/provider-management",
      },
      {
        id: "utilization",
        name: "Utilization",
        href: "/reports/utilization",
      },
    ],
  },
  {
    id: "statistics",
    name: "Statistics",
    href: "#",
    icon: BarChart3,
    children: [
      {
        id: "overview",
        name: "Overview",
        href: "/statistics",
      },
      {
        id: "erp-staff-usage",
        name: "ERP Staff Usage",
        href: "/statistics/erp-staff-usage",
      },
      {
        id: "provider-usage",
        name: "Provider Usage",
        href: "/statistics/provider-usage",
      },
      {
        id: "enrollee-app-usage",
        name: "Enrollee App Usage",
        href: "/statistics/enrollee-app-usage",
      },
      {
        id: "login-analytics",
        name: "Login Analytics",
        href: "/statistics/login-analytics",
      },
      {
        id: "drop-off-analytics",
        name: "Drop-off Analytics",
        href: "/statistics/drop-off-analytics",
      },
      {
        id: "daily-activities",
        name: "Daily Activities",
        href: "/statistics/daily-activities",
      },
      {
        id: "android-vs-ios",
        name: "Android vs iOS",
        href: "/statistics/android-vs-ios",
      },
      {
        id: "reports-export",
        name: "Reports & Export",
        href: "/statistics/reports-export",
      },
    ],
  },
  {
    id: "settings",
    name: "Masters",
    href: "/settings",
    icon: Star,
    children: [
      {
        id: "service-types",
        name: "NHIA Tariff",
        href: "/settings/service-types",
      },
      {
        id: "benefit-packages",
        name: "Benefit Packages",
        href: "/settings/benefit-packages",
      },
      {
        id: "clients-plans",
        name: "Clients Plans",
        href: "/settings/clients-plans",
      },
      {
        id: "backup-restore",
        name: "Backup and Restore",
        href: "/settings/backup-restore",
      },
      {
        id: "sales-targets",
        name: "Sales Targets",
        href: "/settings/sales-targets",
      },
    ],
  }
]

// Create context for sidebar state
    const SidebarContext = createContext<{
      isCollapsed: boolean
      setIsCollapsed: (collapsed: boolean) => void
      isMobileOpen: boolean
      setIsMobileOpen: (open: boolean) => void
    }>({
      isCollapsed: false,
      setIsCollapsed: () => { },
      isMobileOpen: false,
      setIsMobileOpen: () => { },
    })

    export const useSidebar = () => useContext(SidebarContext)

    export function SidebarProvider({ children }: { children: React.ReactNode }) {
      const [isCollapsed, setIsCollapsed] = useState(false)
      const [isMobileOpen, setIsMobileOpen] = useState(false)

      return (
        <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }}>
          {children}
        </SidebarContext.Provider>
      )
    }

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const normalizedRole = (session?.user?.role || "").toString().trim().replace(/\s+/g, "_").toUpperCase()
  const isSuperAdmin = normalizedRole === "SUPER_ADMIN"
  const isProviderRole = normalizedRole === "PROVIDER"
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const { isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar()

  const { data: sidebarNotifications } = useQuery<SidebarNotificationsResponse>({
    queryKey: ["sidebar-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/sidebar/notifications")
      if (!res.ok) throw new Error("Failed to fetch sidebar notifications")
      return res.json()
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  })
  const notifications = sidebarNotifications?.notifications

  const getModuleNotificationCount = (moduleId: string): number => {
    switch (moduleId) {
      case "department-oversight":
        return notifications?.department_oversight?.total || 0
      case "operation-desk":
        return notifications?.internal_control?.total || 0
      case "executive-desk":
        return notifications?.executive_desk?.total || 0
      case "underwriting":
        return notifications?.underwriting?.total || 0
      case "finance":
        return notifications?.finance?.total || 0
      case "call-centre":
        return notifications?.call_centre?.pending_provider_requests || 0
      case "claims":
        return notifications?.claims?.total || 0
      case "provider":
        return notifications?.provider_management?.total || 0
      case "telemedicine":
        return notifications?.telemedicine?.total || 0
      default:
        return 0
    }
  }

  const getChildNotificationCount = (moduleId: string, childId: string): number => {
    switch (moduleId) {
      case "department-oversight":
        if (childId === "procurement-bill") return notifications?.department_oversight?.procurement || 0
        if (childId === "memos") return notifications?.department_oversight?.memos || 0
        return 0
      case "operation-desk":
        if (childId === "procurement-bill") return notifications?.internal_control?.procurement || 0
        if (childId === "audit") return notifications?.internal_control?.audit || 0
        return 0
      case "executive-desk":
        if (childId === "procurement-bill") return notifications?.executive_desk?.procurement || 0
        if (childId === "approval") return notifications?.executive_desk?.claims_approval || 0
        if (childId === "custom-plans") return notifications?.executive_desk?.custom_plans || 0
        if (childId === "memos") return notifications?.executive_desk?.memos || 0
        return 0
      case "underwriting":
        if (childId === "mobile") return notifications?.underwriting?.pending_updates || 0
        return 0
      case "finance":
        if (childId === "financial-transactions") return notifications?.finance?.pending_transactions || 0
        if (childId === "claims-settlement") return notifications?.finance?.pending_claims_settlement || 0
        return 0
      case "call-centre":
        if (childId === "call-centre-dashboard") return notifications?.call_centre?.pending_provider_requests || 0
        return 0
      case "claims":
        if (childId === "vetter1") return notifications?.claims?.total || 0
        if (childId === "vetter2") return notifications?.claims?.total || 0
        return 0
      case "provider":
        if (childId === "provider-approval") return notifications?.provider_management?.pending_submissions || 0
        return 0
      case "telemedicine":
        if (childId === "pending-bookings") return notifications?.telemedicine?.pending_appointments || 0
        if (childId === "outpatient") return notifications?.telemedicine?.pending_requests || 0
        return 0
      default:
        return 0
    }
  }

  const { data: perms, isLoading: permsLoading } = useQuery<{ module: string; submodule?: string | null; action: string }[]>({
    queryKey: ["permissions", "me"],
    queryFn: async () => {
      const res = await fetch("/api/permissions/me")
      if (!res.ok) throw new Error("Failed to load permissions")
      return res.json()
    },
    enabled: !!session?.user && session.user.role !== "SUPER_ADMIN",
    // Refetch permissions every 30 seconds to catch permission matrix updates
    refetchInterval: 30000,
    // Also refetch when window regains focus
    refetchOnWindowFocus: true
  })

  const hasModuleAccess = (moduleId: string) => {
    if (isSuperAdmin) return true // Super admin always has access

    // Strict role boundary: PROVIDER users should only see the Provider module in sidebar.
    if (isProviderRole) return moduleId === 'providers'

    if (!perms) return false // Don't show modules during loading

    // Dashboard should always be visible to all authenticated users
    if (moduleId === 'dashboard') return true

    // Hide Client module for PROVIDER role users.
    if (moduleId === 'client' && session?.user?.role === 'PROVIDER') return false

    // Client entry should remain discoverable for non-provider roles
    // because onboarding starts from a separate public client URL.
    if (moduleId === 'client') return true

    // PROVIDER role should NOT see "Provider Management" module (id: "provider")
    // They should only see the "Provider" module (id: "providers") which contains their own features
    if (moduleId === 'provider' && session?.user?.role === 'PROVIDER') {
      return false // Hide Provider Management for PROVIDER role users
    }

    // PROVIDER role should NOT see "Claims" module (id: "claims")
    // They have their own "Claims Request" under Provider module
    if (moduleId === 'claims' && session?.user?.role === 'PROVIDER') {
      return false // Hide Claims module for PROVIDER role users
    }

    // For reports module, check for ANY reports permission (any submodule, any action)
    // This allows permission matrix to grant reports access to telemedicine users if needed
    if (moduleId === 'reports') {
      // Show reports if user has ANY reports permission (regardless of submodule or action)
      // Check both normalized and original module names in case of normalization issues
      const reportsPerms = perms.filter(p => {
        const normalized = p.module.toLowerCase().replace(/[^a-z0-9]/g, '')
        return p.module === 'reports' || normalized === 'reports' || p.module.toLowerCase() === 'reports'
      })
      const hasReportAccess = reportsPerms.length > 0

      return hasReportAccess
    }

    // Special case: providers module - check for both 'providers' and 'provider' module permissions
    if (moduleId === 'providers') {
      const hasAccess = perms.some(p => {
        const normalizedModule = p.module?.toLowerCase().trim() || ''
        return p.module === moduleId ||
          normalizedModule === 'provider' ||
          normalizedModule === 'providers' ||
          normalizedModule.includes('provider')
      })

      return hasAccess
    }

    // Check if user has ANY permission for this module (required for sidebar visibility)
    return perms.some(p => p.module === moduleId)
  }

  // Map sidebar child IDs to permission matrix submodule IDs
  const normalizePermissionId = (value?: string | null) =>
    (value || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const mapSidebarIdToSubmoduleId = (sidebarId: string): string => {
    const mapping: Record<string, string> = {
      // Users module mappings
      'users-list': 'users',
      'provider-accounts': 'provider-accounts',
      'client-accounts': 'client-accounts',
      'permissions': 'permissions',
      'roles': 'users', // Role management falls under users submodule

      // HR module mappings
      'employees': 'employees',
      'departments': 'departments',
      'attendance': 'attendance',
      'leave': 'leave',
      'payroll': 'payroll',
      'hr-rules': 'hr-rules',
      'procurement': 'procurement',

      // Claims module mappings
      'claims-dashboard': 'claims',
      'approved-codes': 'claims',
      'claims-utilization': 'claims',
      'vetter': 'vetter',
      'vetter1': 'vetter',
      'vetter2': 'vetter',
      'audit-trail': 'claims',

      // Finance module mappings
      'accounts': 'accounts',
      'transactions': 'transactions',

      // Provider module mappings
      'provider-dashboard': 'provider',
      'provider-accounts-management': 'provider-accounts',
      'provider-approval': 'provider-approval',
      'tariff-negotiation': 'provider',
      'inpatient-management': 'inpatient',
      'inpatient': 'inpatient',
      'tariff-plan': 'tariff-plan',

      // Providers module mappings
      'approval-code-request': 'approval-code-request',
      'claims-request': 'claims-request',
      'tariff-agreement': 'tariff-plan',
      'verify-encounter-code': 'verify-encounter-code',

      // Department oversight mappings
      'procurement-bill': 'procurement-bill',

      // Operation desk mappings (uses same procurement-bill id)
      'audit': 'audit',

      // Executive desk mappings
      'approval': 'approval',
      'msa-approval': 'approval',
      'custom-plans': 'custom-plans', // Shared by executive-desk, special-risk, and underwriting

      // Special Services module mappings
      'special-providers': 'special-providers',

      // Legal Services module mappings
      'documents': 'documents',
      'meeting-minutes': 'meeting-minutes',
      'sales-documents': 'sales-documents',

      // Sales module mappings
      'corporate': 'corporate',
      'agency': 'agency',
      'special-risks': 'special-risks',
      'operations': 'operations',
      'consolidated': 'consolidated',

      // Underwriting module mappings
      'organizations': 'organizations',
      'principals': 'principals',
      'dependents': 'dependents',
      'plans': 'plans-management',
      'plans-management': 'plans-management',
      'plans_management': 'plans-management',
      'custom_plans': 'custom-plans',

      // Fraud detection module mappings
      'fraud-detection-dashboard': 'fraud-detection',
      'provider-risk-profile': 'provider-risk-profile',
      'rules-management': 'rules-management',
      'flagged-claims': 'flagged-claims',
      'history': 'history',
      'risk-management': 'risk-management',

      // Call centre module mappings
      'call-centre-dashboard': 'call-centre',
      'requests-provider': 'requests',
      'requests': 'requests',
      'coverage-checker': 'coverage',
      'coverage': 'coverage',
      'generate-approval-code': 'generate-code',
      'verify-approval': 'verify-approval',
      'manage-encounter-codes': 'manage-encounter-codes',
      'rejected-services': 'rejected-services',

      // Reports module mappings
      'reports-dashboard': 'overview',
      'reports-call-centre': 'call-centre',
      'reports-claims': 'claims',
      'reports-telemedicine': 'telemedicine',
      'reports-underwriting': 'underwriting',
      'reports-provider-management': 'provider-management',
      'utilization': 'utilization',
      'filters': 'filters',

      // Statistics module mappings
      'overview': 'overview',
      'erp-staff-usage': 'erp-staff-usage',
      'provider-usage': 'provider-usage',
      'enrollee-app-usage': 'enrollee-app-usage',
      'login-analytics': 'login-analytics',
      'drop-off-analytics': 'drop-off-analytics',
      'daily-activities': 'daily-activities',
      'android-vs-ios': 'android-vs-ios',
      'reports-export': 'reports-export',

      // Settings module mappings
      'service-types': 'service-types',
      'plans-settings': 'plans',
      'covered-services': 'covered-services',
      'band-labels': 'band-labels',
      'provider-plans': 'provider-plans',
      'package-limits': 'package-limits',
      'sales-targets': 'sales-targets',

      // Telemedicine module mappings
      'scheduled-appointment': 'scheduled-appointment',
      'outpatient': 'outpatient',
      'manage-facilities': 'manage-facilities',
      'claims-request-tele': 'claims-request',

      // Memos mapping (shared across all modules)
      'memos': 'memos',
    }

    return mapping[sidebarId] || sidebarId
  }

  // New function to check if user has access to a specific submodule
  const hasSubmoduleAccess = (moduleId: string, submoduleId: string) => {
    if (isSuperAdmin) return true // Super admin always has access

    const normalizedModuleId = normalizePermissionId(moduleId)

    // Strict role boundary: PROVIDER users should only see submodules under Provider module.
    if (isProviderRole) return normalizedModuleId === 'providers'

    if (!perms) return false // Don't show submodules during loading

    // Map the sidebar ID to the permission matrix submodule ID
    const mappedSubmoduleId = normalizePermissionId(mapSidebarIdToSubmoduleId(submoduleId))

    // Hide Client submodules for PROVIDER role users.
    if (normalizedModuleId === 'client' && session?.user?.role === 'PROVIDER') return false

    // Client portal tabs should always be visible when module is visible for non-provider roles.
    if (normalizedModuleId === 'client') return true

    if (normalizedModuleId === 'users' && mappedSubmoduleId === 'provider-accounts') {
      const hasProviderAccounts = perms.some(p =>
        normalizePermissionId(p.module) === 'users' &&
        normalizePermissionId(p.submodule) === 'provider-accounts'
      )
      const hasUsersAccess = perms.some(p =>
        normalizePermissionId(p.module) === 'users' &&
        normalizePermissionId(p.submodule) === 'users'
      )
      if (hasProviderAccounts || hasUsersAccess) return true
    }

    if (normalizedModuleId === 'users' && mappedSubmoduleId === 'client-accounts') {
      const hasClientAccounts = perms.some(p =>
        normalizePermissionId(p.module) === 'users' &&
        normalizePermissionId(p.submodule) === 'client-accounts'
      )
      const hasUsersAccess = perms.some(p =>
        normalizePermissionId(p.module) === 'users' &&
        normalizePermissionId(p.submodule) === 'users'
      )
      if (hasClientAccounts || hasUsersAccess) return true
    }

    if (normalizedModuleId === 'provider' && submoduleId === 'provider-accounts-management') {
      return session?.user?.role === 'PROVIDER_MANAGER'
    }

    if (normalizedModuleId === 'provider' && submoduleId === 'tariff-negotiation') {
      const role = (session?.user?.role || '').toUpperCase()
      return ['PROVIDER_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role)
    }

    // Underwriter should always see Custom Plans under Underwriting.
    if (
      session?.user?.role === 'UNDERWRITER' &&
      normalizedModuleId === 'underwriting' &&
      mappedSubmoduleId === 'custom-plans'
    ) {
      return true
    }

    // Explicit report visibility for requested roles.
    if (normalizedModuleId === 'reports') {
      const normalizedRole = (session?.user?.role || '').toString().replace(/\s+/g, '_').toUpperCase()
      if (normalizedRole === 'CALL_CENTRE' && mappedSubmoduleId === 'call-centre') return true
      if (normalizedRole === 'TELEMEDICINE' && ['call-centre', 'telemedicine'].includes(mappedSubmoduleId)) return true
    }

    // Special case: tariff-plan for PROVIDER and PROVIDER_MANAGER roles - always show
    // This is a core permission for these roles
    if ((submoduleId === 'tariff-plan' || submoduleId === 'tariff-agreement') && normalizedModuleId === 'providers' &&
      (session?.user?.role === 'PROVIDER' || session?.user?.role === 'PROVIDER_MANAGER')) {
      // PROVIDER/PROVIDER_MANAGER roles should always have access to tariff plan
      // But still check if permission exists for logging purposes
      const hasPermission = perms.some(p => {
        const module = (p.module || '').toLowerCase().trim()
        const action = (p.action || '').toLowerCase().trim()
        return (module === 'provider' || module === 'providers') &&
          (action.includes('tariff') || action === 'manage_tariff_plan')
      })

      // Always return true for PROVIDER/PROVIDER_MANAGER roles - this is a default permission
      return true
    }

    // Special case: approval-codes and claims-request for PROVIDER and PROVIDER_MANAGER roles
    if ((submoduleId === 'approval-codes' || submoduleId === 'claims-request-provider') &&
      normalizedModuleId === 'providers' &&
      (session?.user?.role === 'PROVIDER' || session?.user?.role === 'PROVIDER_MANAGER')) {
      // PROVIDER/PROVIDER_MANAGER roles should always have access to approval codes and claims request
      return true
    }

    // Special case: tariff-plan is part of providers module, but permission is in provider module
    // Check for provider module with manage_tariff_plan action
    if ((submoduleId === 'tariff-plan' || submoduleId === 'tariff-agreement') && normalizedModuleId === 'providers') {
      // Direct check - look for provider module (singular or plural) with manage_tariff_plan action
      const hasAccess = perms.some(p => {
        if (!p.module || !p.action) return false

        const module = (p.module || '').toLowerCase().trim()
        const action = (p.action || '').toLowerCase().trim()

        // Check if module is provider (singular) or providers (plural)
        const isProviderModule = module === 'provider' || module === 'providers'

        // Check if action is manage_tariff_plan or contains tariff
        const isTariffAction = action === 'manage_tariff_plan' ||
          action === 'manage_tariff' ||
          action.includes('tariff')

        return isProviderModule && isTariffAction
      })

      return hasAccess
    }

    // Special case: For providers module, also check provider (singular) module permissions
    // This handles cases where permissions are stored as "provider" but sidebar uses "providers"
    if (normalizedModuleId === 'providers') {
      const hasAccess = perms.some(p => {
        const pModule = normalizePermissionId(p.module)
        const isProviderModule = pModule === 'provider' || pModule === 'providers'

        if (isProviderModule) {
          // Module-level permission (no submodule) does NOT grant access to submodules
          // User must explicitly grant submodule permissions in Permission Matrix
          if (!p.submodule) {
            return false
          }
          // Check if the mapped submodule matches
          return normalizePermissionId(p.submodule) === mappedSubmoduleId
        }
        return false
      })

      if (hasAccess) return true
    }

    // Check if user has ANY permission for this specific submodule
    return perms.some(p => {
      const normalizedPermissionModule = normalizePermissionId(p.module)
      const normalizedPermissionSubmodule = normalizePermissionId(p.submodule)

      // Match if:
      // 1. Module matches and submodule matches exactly
      // 2. Module-level permission (no submodule) does NOT grant access to submodules
      if (normalizedPermissionModule === normalizedModuleId) {
        // Module-level permission (no submodule) does NOT grant access to submodules
        // User must explicitly grant submodule permissions in Permission Matrix
        if (!p.submodule) {
          // Check for implicit access based on action name
          // This allows default permissions (which lack submodules) to grant access to corresponding sidebar items

          // Claims module mappings
          if (mappedSubmoduleId === 'vetter' && p.action === 'vet') return true
          if (mappedSubmoduleId === 'audit' && p.action === 'audit') return true
          if (mappedSubmoduleId === 'claims' && p.action === 'view') return true

          // Common mappings across modules
          if (mappedSubmoduleId === 'procurement' && (p.action === 'procurement' || p.action === 'view')) return true
          if (mappedSubmoduleId === 'leave' && p.action === 'manage_leave') return true
          if (mappedSubmoduleId === 'memos' && (p.action === 'manage_memos' || p.action === 'view')) return true
          if (mappedSubmoduleId === 'employees' && p.action === 'manage_employees') return true
          if (mappedSubmoduleId === 'attendance' && p.action === 'manage_attendance') return true
          if (mappedSubmoduleId === 'payroll' && p.action === 'manage_payroll') return true
          if (mappedSubmoduleId === 'plans-management' && p.action === 'manage_plans') return true
          if (mappedSubmoduleId === 'custom-plans' && p.action === 'manage_plans') return true

          // Sales module mappings
          if (normalizedModuleId === 'sales') {
            if (['corporate', 'agency', 'special-risks', 'operations', 'memos'].includes(mappedSubmoduleId) &&
              ['view', 'add', 'edit', 'submit', 'vet', 'approve', 'upload'].includes(p.action)) return true
            if (mappedSubmoduleId === 'consolidated' && ['view_all', 'approve'].includes(p.action)) return true
          }

          // Call centre module mappings
          if (normalizedModuleId === 'call-centre') {
            if (mappedSubmoduleId === 'requests' && p.action === 'manage_requests') return true
            if (mappedSubmoduleId === 'coverage' && p.action === 'check_coverage') return true
            if (mappedSubmoduleId === 'verify-approval' && p.action === 'verify_codes') return true
            if (mappedSubmoduleId === 'generate-code' && (p.action === 'add' || p.action === 'approve')) return true
            if (mappedSubmoduleId === 'manage-encounter-codes' && (p.action === 'view' || p.action === 'add' || p.action === 'edit')) return true
            if (mappedSubmoduleId === 'rejected-services' && p.action === 'view') return true
          }

          // Special Services module mappings
          if (normalizedModuleId === 'special-risk') {
            if (mappedSubmoduleId === 'custom-plans' && ['view', 'add', 'edit', 'approve', 'delete'].includes(p.action)) return true
            if (mappedSubmoduleId === 'special-providers' && ['view', 'add', 'edit', 'approve', 'delete', 'manage_providers'].includes(p.action)) return true
          }

          // Reports module mappings (permissions are action-based, without submodules)
          if (normalizedModuleId === 'reports') {
            if (mappedSubmoduleId === 'call-centre' && ['view', 'generate_all', 'view_all', 'generate_claims'].includes(p.action)) return true
            if (mappedSubmoduleId === 'claims' && ['view', 'generate_all', 'view_all', 'generate_claims'].includes(p.action)) return true
            if (mappedSubmoduleId === 'telemedicine' && ['view', 'generate_all', 'view_all'].includes(p.action)) return true
            if (mappedSubmoduleId === 'underwriting' && ['view', 'generate_all', 'view_all', 'generate_underwriting'].includes(p.action)) return true
            if (mappedSubmoduleId === 'provider-management' && ['view', 'generate_all', 'view_all', 'generate_provider'].includes(p.action)) return true
            if (['overview', 'utilization'].includes(mappedSubmoduleId) && ['view', 'generate_all', 'view_all'].includes(p.action)) return true
          }

          // Statistics module mappings
          if (normalizedModuleId === 'statistics') {
            const statisticsSubmodules = [
              'overview',
              'erp-staff-usage',
              'provider-usage',
              'enrollee-app-usage',
              'login-analytics',
              'drop-off-analytics',
              'daily-activities',
              'android-vs-ios',
              'reports-export',
            ]
            if (statisticsSubmodules.includes(mappedSubmoduleId) && ['view', 'view_all', 'generate', 'generate_all', 'export'].includes(p.action)) {
              return true
            }
          }

          return false
        }
        // Check if the mapped submodule matches
        const matches =
          normalizedPermissionSubmodule === mappedSubmoduleId ||
          (mappedSubmoduleId === 'plans-management' &&
            (normalizedPermissionSubmodule === 'plans' || normalizedPermissionSubmodule === 'plans-management')) ||
          (mappedSubmoduleId === 'custom-plans' &&
            (normalizedPermissionSubmodule === 'custom-plans' || normalizedPermissionSubmodule === 'custom_plans' || normalizedPermissionSubmodule === 'plans'))

        // Debug logging for provider module
        if (normalizedModuleId === 'provider' && (mappedSubmoduleId === 'memos' || mappedSubmoduleId === 'procurement')) {
          console.log(`Checking ${moduleId}:${submoduleId} (mapped: ${mappedSubmoduleId}), permission: ${p.module}:${p.submodule}, matches: ${matches}`)
        }

        return matches
      }
      return false
    })
  }

  // Show loading state until permissions are loaded to prevent flash
  if (permsLoading && session?.user?.role !== "SUPER_ADMIN") {
    return (
      <>
        {/* Desktop Sidebar */}
        <div className={cn(
          "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 lg:w-72 lg:bg-[#4A4A4A] lg:border-r lg:border-[#3A3A3A]",
          isCollapsed && "lg:w-16"
        )}>
          <div className="flex h-full flex-col bg-[#4A4A4A]">
            {/* Logo */}
            <div className="flex h-16 items-center justify-between px-4 bg-white border-b border-gray-200">
              {!isCollapsed && (
                <div className="flex items-center gap-2">
                  <img src="/logo.jpg" alt="CoverConnect Logo" width={50} height={50} />
                </div>
              )}
              {isCollapsed && (
                <div className="flex items-center justify-center w-full">
                  <div className="h-8 w-8 rounded-lg bg-[#BE1522] flex items-center justify-center">
                    <span className="text-white font-bold text-sm">ERP</span>
                  </div>
                </div>
              )}
            </div>

            {/* Loading Navigation */}
            <div className="flex-1 px-3 py-4">
              <nav className="space-y-2">
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-10 bg-[#5A5A5A] rounded animate-pulse"></div>
                  ))}
                </div>
              </nav>
            </div>

            {/* Logout Button */}
            <div className="hidden lg:block border-t border-[#3A3A3A] p-4">
              <Button
                variant="ghost"
                className={cn("w-full justify-start text-white hover:bg-[#3A3A3A] hover:text-white", isCollapsed && "justify-center px-2")}
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4" />
                {!isCollapsed && (
                  <span className="ml-2 text-sm">Logout</span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex h-full flex-col bg-[#4A4A4A]">
              {/* Logo */}
              <div className="flex h-16 items-center justify-between px-4 bg-white border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <img src="/logo.jpg" alt="CoverConnect Logo" width={50} height={50} />
                </div>
              </div>

              {/* Loading Navigation */}
              <div className="flex-1 px-3 py-4">
                <nav className="space-y-2">
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-10 bg-[#5A5A5A] rounded animate-pulse"></div>
                    ))}
                  </div>
                </nav>
              </div>

              {/* Logout Button */}
              <div className="hidden lg:block border-t border-[#3A3A3A] p-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-white hover:bg-[#3A3A3A] hover:text-white"
                  onClick={() => signOut()}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="ml-2 text-sm">Logout</span>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId)
      } else {
        // Auto-close other expanded items (observation 13)
        return [itemId]
      }
    })
  }

  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex h-full flex-col bg-[#4A4A4A]">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 bg-[#BE1522] lg:bg-white border-b border-[#a0111b] lg:border-gray-200">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="bg-white rounded-xl p-1 shadow-sm lg:p-0 lg:shadow-none lg:bg-transparent">
              <img src="/logo.jpg" alt="CoverConnect Logo" width={44} height={44} className="rounded-lg lg:rounded-none lg:w-[50px] lg:h-[50px]" />
            </div>
            <span className="lg:hidden text-white font-bold text-lg leading-tight ml-2">ERP Portal</span>
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center w-full">
            <div className="h-8 w-8 rounded-lg bg-[#BE1522] flex items-center justify-center">
              <span className="text-white font-bold text-sm">ERP</span>
            </div>
          </div>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            className="h-8 w-8 text-white lg:text-gray-900 hover:bg-[#a0111b] lg:hover:bg-gray-100 hover:text-white lg:hover:text-gray-900 hidden lg:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-2">
          {navigation
            .filter((item) => {
              // System settings only for super admin
              if (item.id === 'system') return session?.user?.role === 'SUPER_ADMIN'

              // Check if user has module access
              return hasModuleAccess(item.id)
            })
            .map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              const hasChildren = item.children && item.children.length > 0
              const isExpanded = expandedItems.includes(item.id)
              const moduleNotificationCount = getModuleNotificationCount(item.id)

              return (
                <div key={item.name}>
                  {/* Main navigation item */}
                  <div className="flex items-center">
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors flex-1",
                        isActive ? "bg-[#BE1522] text-white" : "text-white hover:bg-[#3A3A3A] hover:text-white",
                        collapsed && "justify-center"
                      )}
                      onClick={(e) => {
                        if (hasChildren) {
                          e.preventDefault()
                          toggleExpanded(item.id)
                        } else {
                          setIsMobileOpen(false)
                        }
                      }}
                      title={collapsed ? item.name : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && item.name}
                      {!collapsed && moduleNotificationCount > 0 && (
                        <span className="sidebar-notification-badge ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-[#BE1522] shadow-sm ring-1 ring-[#BE1522]/30 animate-pulse">
                          {moduleNotificationCount}
                        </span>
                      )}
                      {/* Expand/Collapse arrow inside the link */}
                      {hasChildren && !collapsed && (
                        <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", isExpanded && "rotate-180")} />
                      )}
                    </Link>
                  </div>

                  {/* Child items - filtered by submodule permissions */}
                  {hasChildren && isExpanded && !collapsed && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children
                        ?.filter((child: any) => hasSubmoduleAccess(item.id, child.id))
                        .map((child: any) => {
                          const [childPath, childQueryString] = child.href.split("?")
                          let isChildActive = pathname === childPath || pathname.startsWith(childPath + "/")

                          if (isChildActive && childQueryString) {
                            const expectedTab = new URLSearchParams(childQueryString).get("tab")
                            if (expectedTab) {
                              isChildActive = searchParams.get("tab") === expectedTab
                            }
                          }

                          const childNotificationCount = getChildNotificationCount(item.id, child.id)
                          return (
                            <Link
                              key={child.id}
                              href={child.href}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors",
                                isChildActive ? "bg-[#BE1522]/30 text-white" : "text-gray-200 hover:bg-[#3A3A3A] hover:text-white"
                              )}
                              onClick={() => setIsMobileOpen(false)}
                            >
                              <div className="w-2 h-2 rounded-full bg-gray-300" />
                              {child.name}
                              {childNotificationCount > 0 && (
                                <span className="sidebar-notification-badge ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-[#BE1522] shadow-sm ring-1 ring-[#BE1522]/30 animate-pulse">
                                  {childNotificationCount}
                                </span>
                              )}
                            </Link>
                          )
                        })}
                    </div>
                  )}
                </div>
              )
            })}
        </nav>
      </ScrollArea>

      {/* Logout Button */}
      <div className="hidden lg:block border-t border-[#3A3A3A] p-4">
        <Button
          variant="ghost"
          className={cn("w-full justify-start text-white hover:bg-[#3A3A3A] hover:text-white", collapsed && "justify-center px-2")}
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && (
            <span className="ml-2 text-sm">Logout</span>
          )}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 lg:w-72 lg:bg-[#4A4A4A] lg:border-r lg:border-[#3A3A3A]",
        isCollapsed && "lg:w-16"
      )}>
        <SidebarContent collapsed={isCollapsed} />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Collapse button for desktop */}
      {isCollapsed && (
        <div className="hidden lg:block lg:fixed lg:top-4 lg:left-4 lg:z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className="h-8 w-8 bg-white shadow-md"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  )
}
