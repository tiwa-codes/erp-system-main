import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface DashboardNotification {
  type: "success" | "warning" | "alert"
  title: string
  message: string
  time: string
  module: string
}

export async function GET(request: NextRequest) {
  try {
    void request

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const notifications: DashboardNotification[] = []
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: true,
        provider: {
          select: {
            id: true,
            facility_name: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.role?.name === 'PROVIDER') {
      const providerFacilityName = user.provider?.facility_name

      if (providerFacilityName) {
        const recentApprovalCodes = await prisma.approvalCode.findMany({
          where: {
            hospital: providerFacilityName,
            created_at: { gte: last24Hours },
            status: { in: ['APPROVED', 'PARTIAL', 'REJECTED'] }
          },
          orderBy: { created_at: 'desc' },
          take: 10
        })

        recentApprovalCodes.forEach(code => {
          const statusLabel = code.status === 'PARTIAL' ? 'partially approved' : code.status.toLowerCase()
          notifications.push({
            type: code.status === 'REJECTED' ? 'alert' : 'success',
            title: `Approval Code ${statusLabel}`,
            message: `${code.approval_code}`,
            time: getTimeAgo(code.created_at),
            module: 'Providers'
          })
        })

        const recentPaidClaims = await prisma.claim.findMany({
          where: {
            provider_id: user.provider?.id,
            status: 'PAID',
            updated_at: { gte: last24Hours }
          },
          include: {
            principal: { select: { first_name: true, last_name: true } }
          },
          orderBy: { updated_at: 'desc' },
          take: 10
        })

        recentPaidClaims.forEach(claim => {
          const patientName = claim.principal ? `${claim.principal.first_name} ${claim.principal.last_name}` : 'Unknown Patient'
          notifications.push({
            type: 'success',
            title: 'Claim Paid',
            message: `${claim.claim_number} - ${patientName}`,
            time: getTimeAgo(claim.updated_at),
            module: 'Claims'
          })
        })
      }

      notifications.sort((a, b) => {
        const getTimestamp = (timeStr: string) => {
          const now = new Date()
          if (timeStr.includes('second')) {
            const seconds = parseInt(timeStr.match(/\d+/)?.[0] || '0')
            return new Date(now.getTime() - seconds * 1000).getTime()
          } else if (timeStr.includes('minute')) {
            const minutes = parseInt(timeStr.match(/\d+/)?.[0] || '0')
            return new Date(now.getTime() - minutes * 60 * 1000).getTime()
          } else if (timeStr.includes('hour')) {
            const hours = parseInt(timeStr.match(/\d+/)?.[0] || '0')
            return new Date(now.getTime() - hours * 60 * 60 * 1000).getTime()
          } else if (timeStr.includes('day')) {
            const days = parseInt(timeStr.match(/\d+/)?.[0] || '0')
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).getTime()
          }
          return now.getTime()
        }

        return getTimestamp(b.time) - getTimestamp(a.time)
      })

      return NextResponse.json({
        success: true,
        notifications: notifications.slice(0, 15)
      })
    }

    // 1. CLAIMS MODULE - Recent claims activity
    const recentClaims = await prisma.claim.findMany({
      where: {
        created_at: { gte: last24Hours }
      },
      include: {
        provider: { select: { facility_name: true } },
        principal: { select: { first_name: true, last_name: true, enrollee_id: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 5
    })

    recentClaims.forEach(claim => {
      const statusText = claim.status.replace('_', ' ').toLowerCase()
      const providerName = claim.provider?.facility_name || 'Telemedicine'
      const patientName = claim.principal ? `${claim.principal.first_name} ${claim.principal.last_name}` : 'Unknown Patient'
      
      notifications.push({
        type: claim.status === 'APPROVED' ? 'success' : claim.status === 'REJECTED' ? 'alert' : 'warning',
        title: `Claim ${statusText}`,
        message: `${providerName} - ${patientName}`,
        time: getTimeAgo(claim.created_at),
        module: 'Claims'
      })
    })

    // 2. HR MODULE - Recent employee activity
    const recentEmployees = await prisma.employee.findMany({
      where: {
        created_at: { gte: last24Hours }
      },
      include: {
        department: { select: { name: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 3
    })

    recentEmployees.forEach(employee => {
      notifications.push({
        type: 'success',
        title: 'New Employee Added',
        message: `${employee.first_name} ${employee.last_name} - ${employee.department?.name || 'No Department'}`,
        time: getTimeAgo(employee.created_at),
        module: 'HR'
      })
    })

    // 3. UNDERWRITING MODULE - Recent enrollees
    const recentEnrollees = await prisma.principalAccount.findMany({
      where: {
        created_at: { gte: last24Hours }
      },
      include: {
        organization: { select: { name: true } },
        user: { select: { role: { select: { name: true } } } },
      },
      orderBy: { created_at: 'desc' },
      take: 10
    })

    recentEnrollees
      .filter((enrollee) => enrollee.user?.role?.name?.toUpperCase() !== "GUEST_OR_CLIENT")
      .slice(0, 3)
      .forEach(enrollee => {
      const organizationName = enrollee.organization?.name || 'No Organization'
      
      notifications.push({
        type: 'success',
        title: 'New Enrollee Registered',
        message: `${enrollee.first_name} ${enrollee.last_name} - ${organizationName}`,
        time: getTimeAgo(enrollee.created_at),
        module: 'Underwriting'
      })
      })

    const recentClientAccounts = await prisma.clientAccount.findMany({
      where: {
        created_at: { gte: last24Hours },
      },
      include: {
        user: { select: { first_name: true, last_name: true } },
        organization: { select: { name: true } },
      },
      orderBy: { created_at: "desc" },
      take: 3,
    })

    recentClientAccounts.forEach((clientAccount) => {
      const organizationName = clientAccount.organization?.name || "No Organization"
      notifications.push({
        type: "success",
        title: "New Client Account Registered",
        message: `${clientAccount.user.first_name} ${clientAccount.user.last_name} - ${organizationName}`,
        time: getTimeAgo(clientAccount.created_at),
        module: "Users",
      })
    })

    // 4. PROVIDER MODULE - Recent provider requests
    const recentProviderRequests = await prisma.providerRequest.findMany({
      where: {
        created_at: { gte: last24Hours }
      },
      include: {
        provider: { select: { facility_name: true } },
        enrollee: { select: { first_name: true, last_name: true, enrollee_id: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 3
    })

    recentProviderRequests.forEach(request => {
      const statusText = request.status.toLowerCase()
      const providerName = request.provider?.facility_name || 'Unknown Provider'
      const patientName = request.enrollee ? `${request.enrollee.first_name} ${request.enrollee.last_name}` : 'Unknown Patient'
      
      notifications.push({
        type: request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'alert' : 'warning',
        title: `Provider Request ${statusText}`,
        message: `${providerName} - ${patientName}`,
        time: getTimeAgo(request.created_at),
        module: 'Providers'
      })
    })

    // 5. FINANCE MODULE - Recent financial transactions
    const recentTransactions = await prisma.financialTransaction.findMany({
      where: {
        created_at: { gte: last24Hours }
      },
      orderBy: { created_at: 'desc' },
      take: 3
    })

    recentTransactions.forEach(transaction => {
      notifications.push({
        type: 'success',
        title: 'Financial Transaction',
        message: `${transaction.transaction_type} - ₦${transaction.amount.toLocaleString()}`,
        time: getTimeAgo(transaction.created_at),
        module: 'Finance'
      })
    })

    // 6. CALL CENTRE MODULE - Recent approval codes
    const recentApprovalCodes = await prisma.approvalCode.findMany({
      where: {
        created_at: { gte: last24Hours }
      },
      include: {
        enrollee: { select: { first_name: true, last_name: true, enrollee_id: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 3
    })

    recentApprovalCodes.forEach(code => {
      const patientName = code.enrollee ? `${code.enrollee.first_name} ${code.enrollee.last_name}` : 'Unknown Patient'
      const isEncounterCode = !(
        code.approval_code.startsWith('APR/') ||
        code.approval_code.startsWith('APR-') ||
        code.approval_code.startsWith('M-APR-')
      )
      
      notifications.push({
        type: 'success',
        title: isEncounterCode ? 'Encounter Code Generated' : 'Approval Code Generated',
        message: `${code.approval_code} - ${patientName}`,
        time: getTimeAgo(code.created_at),
        module: 'Call Centre'
      })
    })

    // 7. FRAUD DETECTION MODULE - Recent fraud alerts
    const recentFraudAlerts = await prisma.fraudAlert.findMany({
      where: {
        created_at: { gte: last24Hours }
      },
      include: {
        claim: { 
          include: { 
            provider: { select: { facility_name: true } },
            principal: { select: { first_name: true, last_name: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 3
    })

    recentFraudAlerts.forEach(alert => {
      const providerName = alert.claim.provider?.facility_name || 'Telemedicine'
      const patientName = alert.claim.principal ? `${alert.claim.principal.first_name} ${alert.claim.principal.last_name}` : 'Unknown Patient'
      
      notifications.push({
        type: 'alert',
        title: 'Fraud Alert',
        message: `${providerName} - ${patientName}`,
        time: getTimeAgo(alert.created_at),
        module: 'Fraud Detection'
      })
    })

    // Sort all notifications by creation time (most recent first)
    notifications.sort((a, b) => {
      // Extract timestamp from time string for sorting
      const getTimestamp = (timeStr: string) => {
        const now = new Date()
        if (timeStr.includes('second')) {
          const seconds = parseInt(timeStr.match(/\d+/)?.[0] || '0')
          return new Date(now.getTime() - seconds * 1000).getTime()
        } else if (timeStr.includes('minute')) {
          const minutes = parseInt(timeStr.match(/\d+/)?.[0] || '0')
          return new Date(now.getTime() - minutes * 60 * 1000).getTime()
        } else if (timeStr.includes('hour')) {
          const hours = parseInt(timeStr.match(/\d+/)?.[0] || '0')
          return new Date(now.getTime() - hours * 60 * 60 * 1000).getTime()
        } else if (timeStr.includes('day')) {
          const days = parseInt(timeStr.match(/\d+/)?.[0] || '0')
          return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).getTime()
        }
        return now.getTime()
      }
      
      return getTimestamp(b.time) - getTimestamp(a.time)
    })

    return NextResponse.json({
      success: true,
      notifications: notifications.slice(0, 15) // Return top 15 notifications
    })

  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    )
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}
