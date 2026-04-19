/**
 * Script to clean up idle database connections
 * Run this if you're experiencing "too many connections" errors
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupIdleConnections() {
  try {
    console.log('🔍 Checking for idle connections...\n')
    
    // Get current connection stats
    const stats: any = await prisma.$queryRaw`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections
      FROM pg_stat_activity 
      WHERE datname = current_database();
    `
    
    console.log('📊 Connection Statistics:')
    console.log('========================')
    console.log(`Total connections: ${stats[0].total_connections}`)
    console.log(`Active connections: ${stats[0].active_connections}`)
    console.log(`Idle connections: ${stats[0].idle_connections}\n`)
    
    // Show idle connections older than 5 minutes
    const idleConnections: any = await prisma.$queryRaw`
      SELECT 
        pid,
        usename,
        application_name,
        state,
        query_start,
        state_change,
        NOW() - state_change as idle_duration
      FROM pg_stat_activity 
      WHERE datname = current_database()
      AND state = 'idle'
      AND state_change < NOW() - INTERVAL '5 minutes'
      ORDER BY state_change;
    `
    
    if (idleConnections.length === 0) {
      console.log('✅ No stale idle connections found.\n')
      await prisma.$disconnect()
      return
    }
    
    console.log(`⚠️  Found ${idleConnections.length} idle connections older than 5 minutes:\n`)
    idleConnections.forEach((conn: any, index: number) => {
      console.log(`${index + 1}. PID: ${conn.pid}`)
      console.log(`   User: ${conn.usename}`)
      console.log(`   App: ${conn.application_name || 'N/A'}`)
      console.log(`   Idle for: ${conn.idle_duration}`)
      console.log('')
    })
    
    // Ask for confirmation before killing
    console.log('💡 To kill these connections, uncomment the code below and run again.\n')
    console.log('⚠️  WARNING: Only do this if you\'re sure these connections are stuck!')
    
    // UNCOMMENT BELOW TO ACTUALLY KILL CONNECTIONS
    /*
    console.log('\n🔧 Terminating idle connections...')
    
    const result: any = await prisma.$queryRaw`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = current_database()
      AND state = 'idle'
      AND state_change < NOW() - INTERVAL '5 minutes';
    `
    
    console.log(`✅ Terminated ${result.length} idle connections.`)
    */
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
    console.log('\n✅ Disconnected from database.')
  }
}

cleanupIdleConnections()
