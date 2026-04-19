import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get chart data for the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Get date range for last 7 days
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    // Enrollee trends data by day (last 14 days to compare this week vs last week)
    const enrolleeTrendsData = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(created_at, 'Mon DD') as date,
        DATE(created_at) as full_date,
        COUNT(*) as count
      FROM "principal_accounts" 
      WHERE created_at >= ${fourteenDaysAgo}
      GROUP BY TO_CHAR(created_at, 'Mon DD'), DATE(created_at)
      ORDER BY DATE(created_at)
    `

    // Revenue data by day (last 7 days)
    const revenueData = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(created_at, 'Mon DD') as date,
        DATE(created_at) as full_date,
        SUM(amount) as revenue
      FROM claims 
      WHERE created_at >= ${sevenDaysAgo}
      GROUP BY TO_CHAR(created_at, 'Mon DD'), DATE(created_at)
      ORDER BY DATE(created_at)
    `

    // Format enrollee trends data with real this week vs last week comparison
    const enrolleeData = (enrolleeTrendsData as any[]) || []
    const formattedEnrolleeTrendsData = []
    
    // Generate last 7 days with real data
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      const fullDate = date.toISOString().split('T')[0]
      
      // Find this week's data
      const thisWeekData = enrolleeData.find(item => item.full_date === fullDate)
      const thisWeekCount = thisWeekData ? parseInt(thisWeekData.count) || 0 : 0
      
      // Find last week's data (same day, 7 days ago)
      const lastWeekDate = new Date(date)
      lastWeekDate.setDate(lastWeekDate.getDate() - 7)
      const lastWeekDateStr = lastWeekDate.toISOString().split('T')[0]
      const lastWeekData = enrolleeData.find(item => item.full_date === lastWeekDateStr)
      const lastWeekCount = lastWeekData ? parseInt(lastWeekData.count) || 0 : 0
      
      formattedEnrolleeTrendsData.push({
        date: dateStr,
        thisWeek: thisWeekCount,
        lastWeek: lastWeekCount
      })
    }

    // Format revenue data with real data only
    const formattedRevenueData = (revenueData as any[]).map(item => ({
      date: item.date,
      revenue: parseFloat(item.revenue) || 0
    }))

    return NextResponse.json({
      enrolleeTrendsData: formattedEnrolleeTrendsData,
      revenueData: formattedRevenueData
    })
  } catch (error) {
    console.error('Error fetching chart data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    )
  }
}
