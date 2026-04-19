import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, 'finance', 'view')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get pending invoices count
    const pendingInvoices = await prisma.invoice.count({
      where: { status: 'PENDING' }
    })

    // Get pending payouts count (claims approved but not paid)
    const pendingPayouts = await prisma.claim.count({
      where: { 
        status: 'APPROVED',
        payouts: {
          none: {
            status: 'PROCESSED'
          }
        }
      }
    })

    // Get premium received count (paid invoices)
    const premiumReceived = await prisma.invoice.count({
      where: { status: 'PAID' }
    })

    // Get claims settlement count (processed payouts)
    const claimsSettlement = await prisma.payout.count({
      where: { status: 'PROCESSED' }
    })

    const metrics = {
      pending_invoices: pendingInvoices,
      pending_payout: pendingPayouts,
      premium_received: premiumReceived,
      claims_settlement: claimsSettlement
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Error fetching finance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch finance metrics' },
      { status: 500 }
    )
  }
}
