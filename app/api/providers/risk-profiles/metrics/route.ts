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

    const canViewProviders = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canViewProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Calculate risk profile metrics
    const [
      total_assessments,
      low_risk,
      medium_risk,
      high_risk,
      critical_risk
    ] = await Promise.all([
      prisma.providerRiskProfile.count(),
      prisma.providerRiskProfile.count({ where: { risk_level: 'LOW' } }),
      prisma.providerRiskProfile.count({ where: { risk_level: 'MEDIUM' } }),
      prisma.providerRiskProfile.count({ where: { risk_level: 'HIGH' } }),
      prisma.providerRiskProfile.count({ where: { risk_level: 'CRITICAL' } })
    ])

    // Calculate average risk score
    const riskScores = await prisma.providerRiskProfile.findMany({
      select: { risk_score: true }
    })
    
    const average_risk_score = riskScores.length > 0 
      ? Math.round(riskScores.reduce((sum, profile) => sum + Number(profile.risk_score), 0) / riskScores.length)
      : 0

    // Calculate risk trend data for the last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    const trendData = await prisma.providerRiskProfile.findMany({
      where: {
        assessment_date: {
          gte: sixMonthsAgo
        }
      },
      select: {
        assessment_date: true,
        risk_level: true
      }
    })

    // Group by month and risk level
    const monthlyTrends: { [key: string]: { [key: string]: number } } = {}
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    trendData.forEach(profile => {
      const date = new Date(profile.assessment_date)
      const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
      
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = { low: 0, medium: 0, high: 0, critical: 0 }
      }
      
      const level = profile.risk_level.toLowerCase()
      if (level in monthlyTrends[monthKey]) {
        monthlyTrends[monthKey][level]++
      }
    })

    // Convert to array format for charts
    const riskTrendData = Object.entries(monthlyTrends)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .slice(-6) // Last 6 months
      .map(([month, data]) => ({
        month: month.split(' ')[0], // Just the month name
        low: data.low,
        medium: data.medium,
        high: data.high,
        critical: data.critical
      }))

    return NextResponse.json({
      total_assessments,
      low_risk,
      medium_risk,
      high_risk,
      critical_risk,
      average_risk_score,
      risk_trend_data: riskTrendData
    })
  } catch (error) {
    console.error('Error fetching provider risk metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider risk metrics' },
      { status: 500 }
    )
  }
}
