import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

interface CreateAuditLogParams {
  userId: string
  action: string
  resource: string
  resourceId?: string
  oldValues?: any
  newValues?: any
  ipAddress?: string
  userAgent?: string
}

export async function createAuditLog({
  userId,
  action,
  resource,
  resourceId,
  oldValues,
  newValues,
  ipAddress,
  userAgent,
}: CreateAuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        resource,
        resource_id: resourceId,
        old_values: oldValues ? JSON.stringify(oldValues) : Prisma.JsonNull,
        new_values: newValues ? JSON.stringify(newValues) : Prisma.JsonNull,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw error to avoid breaking the main operation
  }
}

export async function getAuditLogs(
  userId?: string,
  resource?: string,
  action?: string,
  limit: number = 100,
  offset: number = 0
) {
  const where: any = {}
  
  if (userId) where.user_id = userId
  if (resource) where.resource = resource
  if (action) where.action = action

  return prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
    skip: offset,
  })
}

export async function getAuditLogsByResource(
  resource: string,
  resourceId: string,
  limit: number = 50
) {
  return prisma.auditLog.findMany({
    where: {
      resource,
      resource_id: resourceId,
    },
    include: {
      user: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
  })
}
