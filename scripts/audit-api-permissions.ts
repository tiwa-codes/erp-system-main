/**
 * Script to audit API routes for permission checks
 * This identifies routes that may be missing security checks
 */

import fs from 'fs'
import path from 'path'

const API_DIR = path.join(process.cwd(), 'app', 'api')

// Routes that should NOT have permission checks (public/auth routes)
const EXCLUDED_ROUTES = [
  '/api/auth',
  '/api/public',
  '/api/permissions/me', // User's own permissions
  '/api/user/profile', // User's own profile
  '/api/user/upload-picture',
  '/api/user/change-password',
  '/api/user/first-login-password',
  '/api/alerts', // User's own alerts
  '/api/system/cron', // System cron jobs
  '/api/system/auto-deactivate-accounts', // System task
]

interface RouteAudit {
  path: string
  hasSession: boolean
  hasPermissionCheck: boolean
  needsReview: boolean
  methods: string[]
}

function shouldExclude(filePath: string): boolean {
  return EXCLUDED_ROUTES.some(excluded => filePath.includes(excluded.replace('/api/', '')))
}

function analyzeRouteFile(filePath: string): RouteAudit | null {
  const content = fs.readFileSync(filePath, 'utf-8')
  const relativePath = filePath.replace(API_DIR, '/api').replace(/\\/g, '/').replace('/route.ts', '')
  
  if (shouldExclude(relativePath)) {
    return null
  }

  const hasSession = content.includes('getServerSession') || content.includes('session')
  const hasPermissionCheck = content.includes('checkPermission') || content.includes('checkAnyPermission')
  
  // Extract HTTP methods
  const methods: string[] = []
  if (content.includes('export async function GET')) methods.push('GET')
  if (content.includes('export async function POST')) methods.push('POST')
  if (content.includes('export async function PUT')) methods.push('PUT')
  if (content.includes('export async function PATCH')) methods.push('PATCH')
  if (content.includes('export async function DELETE')) methods.push('DELETE')

  const needsReview = hasSession && !hasPermissionCheck

  return {
    path: relativePath,
    hasSession,
    hasPermissionCheck,
    needsReview,
    methods
  }
}

function walkDirectory(dir: string): RouteAudit[] {
  const results: RouteAudit[] = []
  
  const files = fs.readdirSync(dir)
  
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory()) {
      results.push(...walkDirectory(filePath))
    } else if (file === 'route.ts') {
      const audit = analyzeRouteFile(filePath)
      if (audit) {
        results.push(audit)
      }
    }
  }
  
  return results
}


const audits = walkDirectory(API_DIR)

// Categorize routes
const secured = audits.filter(a => a.hasPermissionCheck)
const unsecured = audits.filter(a => a.needsReview)
const noSession = audits.filter(a => !a.hasSession)

if (unsecured.length > 0) {
  // Group by module
  const grouped = unsecured.reduce((acc, route) => {
    const module = route.path.split('/')[2] || 'root'
    if (!acc[module]) acc[module] = []
    acc[module].push(route)
    return acc
  }, {} as Record<string, RouteAudit[]>)
  
  for (const [module, routes] of Object.entries(grouped).sort()) {
    routes.forEach(route => {
      console.log(`  ${route.methods.join(',')} ${route.path}`)
    })
  }
}

