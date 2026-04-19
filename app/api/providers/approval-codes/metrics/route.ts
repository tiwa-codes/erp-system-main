import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canView = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's provider information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { 
        provider: true,
        role: true 
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build base where clause for approval codes
    const baseWhereClause: any = {
      approval_code: { startsWith: 'APR' }
    }

    // Filter by user's provider if they are a PROVIDER role (not ADMIN/SUPER_ADMIN)
    if (user.role?.name === 'PROVIDER' && user.provider_id && user.provider) {
      baseWhereClause.hospital = user.provider.facility_name
    }

    // Get approval code metrics
    const [
      totalCodes,
      pendingCodes,
      approvedCodes,
      rejectedCodes,
      partialCodes,
      totalAmount,
      averageAmount
    ] = await Promise.all([
      prisma.approvalCode.count({
        where: baseWhereClause
      }),
      prisma.approvalCode.count({ 
        where: { 
          ...baseWhereClause,
          status: 'PENDING' 
        } 
      }),
      prisma.approvalCode.count({ 
        where: { 
          ...baseWhereClause,
          status: 'APPROVED' 
        } 
      }),
      prisma.approvalCode.count({ 
        where: { 
          ...baseWhereClause,
          status: 'REJECTED' 
        } 
      }),
      prisma.approvalCode.count({ 
        where: { 
          ...baseWhereClause,
          status: 'PARTIAL' 
        } 
      }),
      prisma.approvalCode.aggregate({
        where: baseWhereClause,
        _sum: { amount: true }
      }),
      prisma.approvalCode.aggregate({
        where: baseWhereClause,
        _avg: { amount: true }
      })
    ])

    const metrics = {
      total_codes: totalCodes,
      pending_codes: pendingCodes,
      approved_codes: approvedCodes,
      rejected_codes: rejectedCodes,
      partial_codes: partialCodes,
      total_amount: totalAmount._sum.amount || 0,
      average_code_amount: averageAmount._avg.amount || 0
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error('Error fetching approval code metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
