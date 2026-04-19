import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    // Only allow super admins to view this information
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active database connections
    const connections: any = await prisma.$queryRaw`
      SELECT 
        count(*) as active_connections,
        count(*) FILTER (WHERE state = 'active') as active_queries,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database();
    `
    
    // Get max connections setting
    const maxConnections: any = await prisma.$queryRaw`
      SELECT setting::int as max_connections 
      FROM pg_settings 
      WHERE name = 'max_connections';
    `
    
    // Get detailed connection info
    const connectionDetails: any = await prisma.$queryRaw`
      SELECT 
        pid,
        usename as username,
        application_name,
        client_addr,
        state,
        query_start,
        state_change,
        EXTRACT(EPOCH FROM (NOW() - query_start))::int as query_duration_seconds
      FROM pg_stat_activity 
      WHERE datname = current_database()
      ORDER BY query_start DESC
      LIMIT 20;
    `
    
    const activeConn = Number(connections[0]?.active_connections || 0)
    const maxConn = Number(maxConnections[0]?.max_connections || 0)
    const utilizationPercent = maxConn > 0 ? ((activeConn / maxConn) * 100).toFixed(2) : 0

    return NextResponse.json({
      summary: {
        active_connections: activeConn,
        active_queries: Number(connections[0]?.active_queries || 0),
        idle_connections: Number(connections[0]?.idle_connections || 0),
        max_connections: maxConn,
        utilization_percent: utilizationPercent,
        status: activeConn > maxConn * 0.8 ? 'WARNING' : 'OK',
      },
      connection_details: connectionDetails,
      timestamp: new Date().toISOString(),
      prisma_config: {
        connection_limit: process.env.DATABASE_URL?.includes('connection_limit') 
          ? process.env.DATABASE_URL.match(/connection_limit=(\d+)/)?.[1] 
          : 'default (10)',
        pool_timeout: process.env.DATABASE_URL?.includes('pool_timeout')
          ? process.env.DATABASE_URL.match(/pool_timeout=(\d+)/)?.[1]
          : 'default (10)',
      }
    })
  } catch (error) {
    console.error('Error fetching DB connection info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch database connection information' },
      { status: 500 }
    )
  }
}
