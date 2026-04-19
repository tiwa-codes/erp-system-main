import { prisma } from "./prisma"

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'HR_MANAGER' | 'HR_OFFICER' | 'CLAIMS_PROCESSOR' | 'CLAIMS_MANAGER' | 'FINANCE_OFFICER' | 'PROVIDER_MANAGER' | 'UNDERWRITER' | 'PROVIDER' | 'TELEMEDICINE' | 'SPECIAL_RISK' | 'SPECIAL_RISK_MANAGER' | 'SALES' | 'TECHNICAL_ASSISTANT_SALES' | 'HEAD_OF_AGENCY' | 'SALES_OPERATIONS_MANAGER' | 'CALL_CENTRE' | 'HEAD_OF_OPERATIONS' | 'CRM'

type PermKey = `${string}:${string}` | `${string}:${string}:${string}`

interface PermissionRow {
  module: string
  submodule?: string | null
  action: string
}

const roleCache = new Map<Role, Set<PermKey>>()
const lastLoadedAt = new Map<Role, number>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache

function normalizeRoleName(role: string) {
  return role.replace(/ /g, '_').toUpperCase()
}

function getRoleNameVariants(role: string): string[] {
  const base = (role || "").toString().trim()
  const normalized = normalizeRoleName(base)
  const spaced = normalized.replace(/_/g, " ")
  const dashed = normalized.replace(/_/g, "-")
  const originalSpaced = base.replace(/_/g, " ")
  return Array.from(new Set([base, normalized, spaced, dashed, originalSpaced].filter(Boolean)))
}

function isSpecialRiskRole(role: string) {
  const normalizedRole = normalizeRoleName(role)
  return normalizedRole === "SPECIAL_RISK" || normalizedRole === "SPECIAL_RISK_MANAGER"
}

function shouldMergeDefaultPermissions(role: string) {
  const normalizedRole = normalizeRoleName(role)
  return [
    "CALL_CENTRE",
    "CLAIMS_PROCESSOR",
    "CRM",
    "HEAD_OF_OPERATIONS",
    "TELEMEDICINE",
    "UNDERWRITER",
    "PROVIDER_MANAGER",
    "SALES",
  ].includes(normalizedRole)
}

async function loadRolePermissions(role: Role): Promise<Set<PermKey>> {
  // Handle case where role might be passed as an object instead of a string
  const rawRoleName = typeof role === 'string' ? role : (role as any)?.name || role
  const roleName = normalizeRoleName(rawRoleName)
  const roleNameVariants = getRoleNameVariants(rawRoleName)

  const now = Date.now()
  const last = lastLoadedAt.get(roleName as Role) || 0
  const cached = roleCache.get(roleName as Role)
  if (cached && now - last < CACHE_TTL_MS) return cached

  let rows: PermissionRow[] = []
  try {
    // Try exact match first, then case-insensitive partial match for variations like "TELEMEDICINE FACILITIES"
    const roleRecord = await prisma.role.findFirst({
      where: {
        OR: [
          ...roleNameVariants.map((variant) => ({
            name: { equals: variant, mode: 'insensitive' as const }
          })),
          { name: { contains: roleName.replace(/_/g, ' '), mode: 'insensitive' } }
        ]
      }
    })

    if (!roleRecord) {
      // If no role found, fall back to defaults
      const defaults = getDefaultPermissionsForRole(roleName as Role)
      const set = new Set<PermKey>(defaults.map((d) => `${normalizeModuleId(d.module)}:${d.action}` as PermKey))
      roleCache.set(roleName as Role, set)
      lastLoadedAt.set(roleName as Role, now)
      return set
    }

    rows = await prisma.permission.findMany({
      where: {
        role_id: roleRecord.id,
        allowed: true
      },
      select: { module: true, submodule: true, action: true },
    })
  } catch (error) {
    console.error('Error loading permissions for role:', roleName, error)
    // Return cached permissions if available, otherwise return defaults
    if (cached) return cached
    const defaults = getDefaultPermissionsForRole(roleName as Role)
    const set = new Set<PermKey>(defaults.map((d) => `${normalizeModuleId(d.module)}:${d.action}` as PermKey))
    roleCache.set(roleName as Role, set)
    lastLoadedAt.set(roleName as Role, now)
    return set
  }

  // Fallback: if no permissions found for this role, seed sane defaults so UI isn't blank
  let effectiveRows: PermissionRow[] = rows
  const defaults = getDefaultPermissionsForRole(roleName as Role)
  if (roleName === "SUPER_ADMIN") {
    // SUPER_ADMIN should have full defaults regardless of current DB state
    const merged: Record<string, PermissionRow> = {}
    for (const r of rows) merged[`${normalizeModuleId(r.module)}:${r.action}`] = { module: r.module, submodule: r.submodule ?? null, action: r.action }
    for (const d of defaults) merged[`${normalizeModuleId(d.module)}:${d.action}`] = d
    effectiveRows = Object.values(merged)
    // Optionally persist any missing defaults
    try {
      // Get the role ID first
      const roleRecord = await prisma.role.findFirst({ where: { name: roleName } })
      if (roleRecord) {
        await prisma.permission.createMany({
          data: defaults.map((d) => ({ role_id: roleRecord.id, module: d.module, action: d.action, allowed: true })),
          skipDuplicates: true,
        })
      }
    } catch (error) {
    }
  } else if (rows.length === 0 && defaults.length > 0) {
    try {
      // Persist defaults for consistency across API checks
      // Get the role ID first
      const roleRecord = await prisma.role.findFirst({ where: { name: roleName } })
      if (roleRecord) {
        await prisma.permission.createMany({
          data: defaults.map((d) => ({ role_id: roleRecord.id, module: d.module, action: d.action, allowed: true })),
          skipDuplicates: true,
        })
      }
      effectiveRows = defaults
    } catch (e) {
      // If persistence fails, at least enable ephemeral defaults
      effectiveRows = defaults
    }
  } else if (rows.length > 0 && roleName === "PROVIDER") {
    // For PROVIDER role, ensure manage_tariff_plan permission exists even if other permissions are in DB
    const hasManageTariffPlan = rows.some((r: PermissionRow) =>
      normalizeModuleId(r.module) === normalizeModuleId("provider") && r.action === "manage_tariff_plan"
    )

    if (!hasManageTariffPlan) {
      // Add manage_tariff_plan to existing permissions
      const tariffPlanDefault = defaults.find((d) =>
        normalizeModuleId(d.module) === normalizeModuleId("provider") && d.action === "manage_tariff_plan"
      )

      if (tariffPlanDefault) {
        try {
          const roleRecord = await prisma.role.findFirst({ where: { name: roleName } })
          if (roleRecord) {
            await prisma.permission.create({
              data: {
                role_id: roleRecord.id,
                module: tariffPlanDefault.module,
                action: tariffPlanDefault.action,
                allowed: true
              }
            })
            // Add to effective rows
            effectiveRows = [...rows, tariffPlanDefault]
            // Invalidate cache so the new permission is used immediately
            invalidatePermissionCache(roleName as Role)
          }
        } catch (e) {
          // Still add to effective rows for this session
          effectiveRows = [...rows, tariffPlanDefault]
        }
      } else {
        effectiveRows = rows
      }
    } else {
      effectiveRows = rows
    }
  } else if (rows.length > 0 && roleName === "CALL_CENTRE") {
    // For CALL_CENTRE role, ensure provider:view and call-centre:approve permissions exist

    // 1. Check/Add provider:view
    const hasProviderView = rows.some((r: PermissionRow) =>
      normalizeModuleId(r.module) === normalizeModuleId("provider") && r.action === "view"
    )

    if (!hasProviderView) {
      const providerViewDefault = defaults.find((d) =>
        normalizeModuleId(d.module) === normalizeModuleId("provider") && d.action === "view"
      )
      if (providerViewDefault) {
        try {
          const roleRecord = await prisma.role.findFirst({ where: { name: roleName } })
          if (roleRecord) {
            try {
              await prisma.permission.create({
                data: {
                  role_id: roleRecord.id,
                  module: providerViewDefault.module,
                  action: providerViewDefault.action,
                  allowed: true
                }
              })
            } catch (e) { }
            effectiveRows = [...effectiveRows, providerViewDefault]
            invalidatePermissionCache(roleName as Role)
          }
        } catch (e) {
          effectiveRows = [...effectiveRows, providerViewDefault]
        }
      }
    }

    // 2. Check/Add call-centre:approve
    const hasCallCentreApprove = effectiveRows.some((r: PermissionRow) =>
      normalizeModuleId(r.module) === normalizeModuleId("call-centre") && r.action === "approve"
    )

    if (!hasCallCentreApprove) {
      const approveDefault = defaults.find((d) =>
        normalizeModuleId(d.module) === normalizeModuleId("call-centre") && d.action === "approve"
      )
      if (approveDefault) {
        try {
          const roleRecord = await prisma.role.findFirst({ where: { name: roleName } })
          if (roleRecord) {
            try {
              await prisma.permission.create({
                data: {
                  role_id: roleRecord.id,
                  module: approveDefault.module,
                  action: approveDefault.action,
                  allowed: true
                }
              })
            } catch (e) { }
            effectiveRows = [...effectiveRows, approveDefault]
            invalidatePermissionCache(roleName as Role)
          }
        } catch (e) {
          effectiveRows = [...effectiveRows, approveDefault]
        }
      }
    }
  } else if (rows.length > 0 && isSpecialRiskRole(roleName)) {
    const hasApprove = rows.some((r: PermissionRow) =>
      normalizeModuleId(r.module) === normalizeModuleId("special-risk") && r.action === "approve"
    )

    if (!hasApprove) {
      const approveDefault = defaults.find((d) =>
        normalizeModuleId(d.module) === normalizeModuleId("special-risk") && d.action === "approve"
      )

      if (approveDefault) {
        try {
          const roleRecord = await prisma.role.findFirst({
            where: {
              OR: [
                { name: roleName },
                { name: { contains: roleName, mode: 'insensitive' } }
              ]
            }
          })

          if (roleRecord) {
            try {
              await prisma.permission.create({
                data: {
                  role_id: roleRecord.id,
                  module: approveDefault.module,
                  action: approveDefault.action,
                  allowed: true
                }
              })
            } catch (e) { }
          }
        } catch (e) { }

        effectiveRows = [...rows, approveDefault]
        invalidatePermissionCache(roleName as Role)
      } else {
        effectiveRows = rows
      }
    } else {
      effectiveRows = rows
    }
  } else if (rows.length > 0) {
    // Check for roles that need manage_memos injected (Claims, HR, Finance, etc.)
    const rolesNeedingMemos = [
      "CLAIMS_MANAGER", "CLAIMS_PROCESSOR",
      "HR_MANAGER", "HR_OFFICER",
      "FINANCE_OFFICER",
      "PROVIDER_MANAGER",
      "UNDERWRITER",
      "SPECIAL_RISK",
      "SPECIAL_RISK_MANAGER",
      "LEGAL"
    ];

    if (rolesNeedingMemos.includes(normalizeRoleName(roleName))) {
      const hasManageMemos = rows.some((r: PermissionRow) => r.action === "manage_memos");

      if (!hasManageMemos) {
        // Find default permission with manage_memos action
        // We can just grab it from the role's defaults or construct it manually since action is unique enough
        const defaults = getDefaultPermissionsForRole(normalizeRoleName(roleName) as Role);
        const memosDefault = defaults.find(d => d.action === "manage_memos");

        if (memosDefault) {
          try {
            const roleRecord = await prisma.role.findFirst({ where: { name: roleName } });
            if (roleRecord) {
              try {
                await prisma.permission.create({
                  data: {
                    role_id: roleRecord.id,
                    module: memosDefault.module,
                    action: memosDefault.action,
                    allowed: true
                  }
                });
              } catch (e) { }
              effectiveRows = [...effectiveRows, memosDefault];
              invalidatePermissionCache(roleName as Role);
            }
          } catch (e) {
            effectiveRows = [...effectiveRows, memosDefault];
          }
        }
      } else {
        effectiveRows = rows;
      }
    } else {
      effectiveRows = rows;
    }
  } else {
    effectiveRows = rows;
  }

  // Keep selected live roles up-to-date with newly introduced default permissions
  // without removing or rewriting any existing DB permissions.
  if (rows.length > 0 && shouldMergeDefaultPermissions(roleName)) {
    const existingKeys = new Set(
      effectiveRows.map((r: PermissionRow) => `${normalizeModuleId(r.module)}:${r.action}`)
    )
    const missingDefaults = defaults.filter(
      (d) => !existingKeys.has(`${normalizeModuleId(d.module)}:${d.action}`)
    )

    if (missingDefaults.length > 0) {
      try {
        const roleRecord = await prisma.role.findFirst({ where: { name: roleName } })
        if (roleRecord) {
          await prisma.permission.createMany({
            data: missingDefaults.map((d) => ({
              role_id: roleRecord.id,
              module: d.module,
              action: d.action,
              allowed: true,
            })),
            skipDuplicates: true,
          })
        }
      } catch (e) {}

      effectiveRows = [...effectiveRows, ...missingDefaults]
    }
  }

  // Normalize module names to sidebar-friendly IDs
  const set = new Set<PermKey>(effectiveRows.map((r: PermissionRow) => `${normalizeModuleId(r.module)}:${r.action}` as PermKey))
  roleCache.set(roleName as Role, set)
  lastLoadedAt.set(roleName as Role, now)
  return set
}

export async function checkPermission(userRole: Role, module: string, action: string, submodule?: string | null): Promise<boolean> {
  // Handle case where role might be passed as an object instead of a string
  const rawRoleName = typeof userRole === 'string' ? userRole : (userRole as any)?.name || userRole
  const roleName = normalizeRoleName(rawRoleName)
  const roleNameVariants = getRoleNameVariants(rawRoleName)

  // SUPER_ADMIN always has all permissions
  if (roleName === 'SUPER_ADMIN') return true

  // Find the role in the database
  const roleRecord = await prisma.role.findFirst({
    where: {
      OR: [
        ...roleNameVariants.map((variant) => ({
          name: { equals: variant, mode: 'insensitive' as const }
        })),
        { name: { contains: roleName.replace(/_/g, ' '), mode: 'insensitive' } }
      ]
    }
  })

  if (!roleRecord) {
    // If no role found, fall back to defaults
    const defaults = getDefaultPermissionsForRole(roleName as Role)
    return defaults.some(d =>
      normalizeModuleId(d.module) === normalizeModuleId(module) && d.action === action
    )
  }

  // Check database permissions - compare normalized values so stored ids
  // like operation_desk still match app ids like operation-desk.
  const mod = normalizeModuleId(module)
  const submod = submodule ? normalizeModuleId(submodule) : null
  const matchingPermissions = await prisma.permission.findMany({
    where: {
      role_id: roleRecord.id,
      action: { equals: action.toLowerCase(), mode: 'insensitive' },
      allowed: true
    },
    select: {
      module: true,
      submodule: true
    }
  })

  const hasPermission = matchingPermissions.some((permission) => {
    const permissionModule = normalizeModuleId(permission.module)
    const permissionSubmodule = permission.submodule ? normalizeModuleId(permission.submodule) : null

    if (permissionModule !== mod) {
      return false
    }

    if (submod) {
      return permissionSubmodule === submod
    }

    // No submodule required in the check — any stored submodule (or null) is acceptable.
    // Permissions are always stored with a submodule by the permission matrix, so we must
    // NOT restrict to null here or all matrix-saved permissions would be silently denied.
    return true
  })

  if (hasPermission) {
    return true
  }

  // If no database permissions, fall back to role defaults
  const defaults = getDefaultPermissionsForRole(roleName as Role)
  return defaults.some(d =>
    normalizeModuleId(d.module) === normalizeModuleId(module) && d.action === action
  )
}

export async function getPermissionsForRole(userRole: Role | string): Promise<{ module: string; submodule?: string | null; action: string }[]> {
  // Load permissions from database with submodule information
  // Accept string to handle role names like "TELEMEDICINE FACILITIES" or "CALL CENTRE"

  // Normalize role name: convert spaces to underscores
  const rawRoleName = typeof userRole === 'string' ? userRole : (userRole as any)?.name || userRole
  let normalizedRoleName = normalizeRoleName(rawRoleName)
  const roleNameVariants = getRoleNameVariants(rawRoleName)

  // For TELEMEDICINE variations, prioritize exact match first
  // If userRole contains "TELEMEDICINE", try to find the best match
  let roleRecord

  if (typeof userRole === 'string' && userRole.toUpperCase().includes('TELEMEDICINE')) {
    // Try exact match first (important for "TELEMEDICINE" vs "TELEMEDICINE FACILITIES")
    roleRecord = await prisma.role.findFirst({
      where: { name: userRole }
    })

    // If no exact match, try case-insensitive exact match
    if (!roleRecord) {
      roleRecord = await prisma.role.findFirst({
        where: { name: { equals: userRole, mode: 'insensitive' } }
      })
    }

    // If still no match, try contains (but this might match wrong role)
    // IMPORTANT: Prefer "TELEMEDICINE" over "TELEMEDICINE FACILITIES" if both exist
    if (!roleRecord) {
      const allMatches = await prisma.role.findMany({
        where: { name: { contains: 'TELEMEDICINE', mode: 'insensitive' } }
      })

      // Prefer exact "TELEMEDICINE" over variations
      roleRecord = allMatches.find(r => r.name.toUpperCase() === 'TELEMEDICINE')
        || allMatches.find(r => r.name.toUpperCase() === userRole.toUpperCase())
        || allMatches[0]
    }
  } else {
    // For other roles, use standard matching
    roleRecord = await prisma.role.findFirst({
      where: {
        OR: [
          ...roleNameVariants.map((variant) => ({ name: { equals: variant, mode: 'insensitive' as const } })),
          { name: { contains: normalizedRoleName.replace(/_/g, ' '), mode: 'insensitive' } }
        ]
      }
    })
  }

  if (!roleRecord) {
    // If no role found in database, return defaults for the normalized role name
    const defaults = getDefaultPermissionsForRole(normalizedRoleName as Role)
    return defaults.map(d => ({
      module: normalizeModuleId(d.module),
      submodule: null,
      action: d.action
    }))
  }

  const permissions = await prisma.permission.findMany({
    where: {
      role_id: roleRecord.id,
      allowed: true
    },
    select: {
      module: true,
      submodule: true,
      action: true
    }
  })

  // If no database permissions exist, fall back to defaults
  if (permissions.length === 0) {
    const defaults = getDefaultPermissionsForRole(roleRecord.name as Role)
    return defaults.map(d => ({
      module: normalizeModuleId(d.module),
      submodule: null, // Defaults don't have submodules
      action: d.action
    }))
  }

  if (shouldMergeDefaultPermissions(roleRecord.name)) {
    const defaults = getDefaultPermissionsForRole(normalizeRoleName(roleRecord.name) as Role)
    const existingKeys = new Set(
      permissions.map((p) => `${normalizeModuleId(p.module)}:${p.action}`)
    )
    const missingDefaults = defaults.filter(
      (d) => !existingKeys.has(`${normalizeModuleId(d.module)}:${d.action}`)
    )

    if (missingDefaults.length > 0) {
      try {
        await prisma.permission.createMany({
          data: missingDefaults.map((d) => ({
            role_id: roleRecord.id,
            module: d.module,
            action: d.action,
            allowed: true,
          })),
          skipDuplicates: true,
        })
        invalidatePermissionCache(roleRecord.name)
      } catch (e) {}

      return [
        ...permissions.map((p) => ({
          module: normalizeModuleId(p.module),
          submodule: p.submodule ? normalizeModuleId(p.submodule) : null,
          action: p.action,
        })),
        ...missingDefaults.map((d) => ({
          module: normalizeModuleId(d.module),
          submodule: d.submodule ? normalizeModuleId(d.submodule) : null,
          action: d.action,
        })),
      ]
    }
  }

  // For CALL_CENTRE role, ensure approve permission exists
  const isCallCentre = roleRecord.name.replace(/ /g, '_').toUpperCase() === "CALL_CENTRE"
  if (isCallCentre) {
    const hasApprove = permissions.some(p =>
      normalizeModuleId(p.module) === normalizeModuleId("call-centre") && p.action === "approve"
    )

    if (!hasApprove) {
      const defaults = getDefaultPermissionsForRole("CALL_CENTRE")
      const approveDefault = defaults.find(d =>
        normalizeModuleId(d.module) === normalizeModuleId("call-centre") && d.action === "approve"
      )

      if (approveDefault) {
        try {
          await prisma.permission.create({
            data: {
              role_id: roleRecord.id,
              module: approveDefault.module,
              action: approveDefault.action,
              allowed: true
            }
          })
          invalidatePermissionCache("CALL_CENTRE")
        } catch (e) { }

        return [
          ...permissions.map(p => ({
            module: normalizeModuleId(p.module),
            submodule: p.submodule ? normalizeModuleId(p.submodule) : null,
            action: p.action
          })),
          {
            module: normalizeModuleId(approveDefault.module),
            submodule: null,
            action: approveDefault.action
          }
        ]
      }
    }
  }

  // Inject manage_memos for roles that need it
  const currentRoleName = normalizeRoleName(roleRecord.name);
  const rolesNeedingMemos = [
    "CLAIMS_MANAGER", "CLAIMS_PROCESSOR",
    "HR_MANAGER", "HR_OFFICER",
    "FINANCE_OFFICER",
    "PROVIDER_MANAGER",
    "UNDERWRITER",
    "SPECIAL_RISK",
    "SPECIAL_RISK_MANAGER",
    "LEGAL"
  ];

  if (rolesNeedingMemos.includes(currentRoleName)) {
    const hasManageMemos = permissions.some(p => p.action === "manage_memos");

    if (!hasManageMemos) {
      const defaults = getDefaultPermissionsForRole(currentRoleName as Role);
      const memosDefault = defaults.find(d => d.action === "manage_memos");

      if (memosDefault) {
        try {
          await prisma.permission.create({
            data: {
              role_id: roleRecord.id,
              module: memosDefault.module,
              action: memosDefault.action,
              allowed: true
            }
          });
          invalidatePermissionCache(currentRoleName as Role);

          return [
            ...permissions.map(p => ({
              module: normalizeModuleId(p.module),
              submodule: p.submodule ? normalizeModuleId(p.submodule) : null,
              action: p.action
            })),
            {
              module: normalizeModuleId(memosDefault.module),
              submodule: null,
              action: memosDefault.action
            }
          ];
        } catch (e) {
          // If persistence fails, still return it as part of the list
          return [
            ...permissions.map(p => ({
              module: normalizeModuleId(p.module),
              submodule: p.submodule ? normalizeModuleId(p.submodule) : null,
              action: p.action
            })),
            {
              module: normalizeModuleId(memosDefault.module),
              submodule: null,
              action: memosDefault.action
            }
          ];
        }
      }
    }
  }

  if (isSpecialRiskRole(currentRoleName)) {
    const hasApprove = permissions.some(p =>
      normalizeModuleId(p.module) === normalizeModuleId("special-risk") && p.action === "approve"
    )

    if (!hasApprove) {
      const defaults = getDefaultPermissionsForRole(currentRoleName as Role)
      const approveDefault = defaults.find(d =>
        normalizeModuleId(d.module) === normalizeModuleId("special-risk") && d.action === "approve"
      )

      if (approveDefault) {
        try {
          await prisma.permission.create({
            data: {
              role_id: roleRecord.id,
              module: approveDefault.module,
              action: approveDefault.action,
              allowed: true
            }
          })
          invalidatePermissionCache(currentRoleName as Role)
        } catch (e) { }

        return [
          ...permissions.map(p => ({
            module: normalizeModuleId(p.module),
            submodule: p.submodule ? normalizeModuleId(p.submodule) : null,
            action: p.action
          })),
          {
            module: normalizeModuleId(approveDefault.module),
            submodule: null,
            action: approveDefault.action
          }
        ]
      }
    }
  }

  // For PROVIDER role, ensure manage_tariff_plan permission exists
  if (roleRecord.name === "PROVIDER") {
    const hasManageTariffPlan = permissions.some(p =>
      normalizeModuleId(p.module) === normalizeModuleId("provider") && p.action === "manage_tariff_plan"
    )

    if (!hasManageTariffPlan) {
      // Add manage_tariff_plan to the returned permissions
      const defaults = getDefaultPermissionsForRole("PROVIDER")
      const tariffPlanDefault = defaults.find(d =>
        normalizeModuleId(d.module) === normalizeModuleId("provider") && d.action === "manage_tariff_plan"
      )

      if (tariffPlanDefault) {
        // Try to persist it to the database
        try {
          await prisma.permission.create({
            data: {
              role_id: roleRecord.id,
              module: tariffPlanDefault.module,
              action: tariffPlanDefault.action,
              allowed: true
            }
          })
          // Invalidate cache so the new permission is used immediately
          invalidatePermissionCache("PROVIDER")
        } catch (e) {
        }

        // Add to returned permissions
        return [
          ...permissions.map(p => ({
            module: normalizeModuleId(p.module),
            submodule: p.submodule ? normalizeModuleId(p.submodule) : null,
            action: p.action
          })),
          {
            module: normalizeModuleId(tariffPlanDefault.module),
            submodule: null,
            action: tariffPlanDefault.action
          }
        ]
      }
    }
  }

  return permissions.map(p => ({
    module: normalizeModuleId(p.module),
    submodule: p.submodule ? normalizeModuleId(p.submodule) : null,
    action: p.action
  }))
}

export function invalidatePermissionCache(role?: Role | string) {
  if (role) {
    const normalizedRole = role.toString().replace(/ /g, '_') as Role
    roleCache.delete(normalizedRole)
    lastLoadedAt.delete(normalizedRole)
  } else {
    roleCache.clear()
    lastLoadedAt.clear()
  }
}

export async function checkAnyPermission(userRole: Role, module: string, actions: string[]): Promise<boolean> {
  // Handle case where role might be passed as an object instead of a string
  let roleName = typeof userRole === 'string' ? userRole : (userRole as any)?.name || userRole

  // Normalize role names: convert spaces to underscores for consistency
  roleName = roleName.replace(/ /g, '_')

  // SUPER_ADMIN always has all permissions
  if (roleName === 'SUPER_ADMIN') return true

  // Load database permissions first to check if any exist
  const perms = await loadRolePermissions(roleName as Role)
  const mod = normalizeModuleId(module)

  // If database permissions exist, use ONLY database (Permission Matrix has full control)
  if (perms.size > 0) {
    return actions.some((a) => perms.has(`${mod}:${a}` as PermKey))
  }

  // If no database permissions, fall back to role defaults
  const defaults = getDefaultPermissionsForRole(roleName as Role)
  return actions.some(action =>
    defaults.some(d => normalizeModuleId(d.module) === mod && d.action === action)
  )
}

// --- Defaults ----
type ModuleAction = { module: string; action: string; submodule?: string | null }

function getDefaultPermissionsForRole(role: Role): ModuleAction[] {
  switch (role) {
    case "SUPER_ADMIN":
      return [
        ["dashboard", ["view", "view_all"]],
        ["hr", ["view", "add", "edit", "delete", "manage_employees", "manage_attendance", "manage_leave", "manage_memos", "manage_rules", "manage_payroll", "procurement"]],
        ["claims", ["view", "add", "edit", "delete", "vet", "audit", "approve", "fraud_detection", "procurement"]],
        ["finance", ["view", "add", "edit", "delete", "approve", "manage_accounts", "process_payouts", "procurement"]],
        ["provider", ["view", "add", "edit", "delete", "approve", "manage_risk", "manage_inpatients", "manage_tariff_plan", "approve_tariff_plan", "procurement"]],
        ["providers", ["view", "add", "edit", "delete", "approve"]],
        ["underwriting", ["view", "add", "edit", "delete", "manage_organizations", "manage_principals", "manage_dependents", "manage_plans", "procurement"]],
        ["underwriting_coverage", ["view", "add", "edit"]],
        ["underwriting_mobile", ["view"]],
        ["underwriting_utilization", ["view"]],
        ["call-centre", ["view", "add", "edit", "delete", "manage_requests", "verify_codes", "check_coverage", "procurement"]],
        ["reports", ["view", "generate_all", "view_all"]],
        ["statistics", ["view", "generate", "export"]],
        ["settings", ["view", "add", "edit", "delete"]],
        ["fraud-detection", ["view", "add", "edit", "delete", "investigate", "approve", "reject"]],
        ["users", ["view", "add", "edit", "delete", "manage_permissions"]],
        ["system", ["view_audit", "configure"]],
        ["department-oversight", ["view", "add", "edit", "delete"]],
        ["operation-desk", ["view", "add", "edit", "delete", "manage_memos"]],
        ["executive-desk", ["view", "add", "edit", "delete", "approve"]],
        ["legal", ["view", "manage_msa", "send_msa", "manage_memos"]],
        ["telemedicine", ["view", "add", "edit", "delete", "manage_facilities", "manage_appointments", "view_claims", "manage_memos"]], // Full telemedicine access
        ["special-risk", ["view", "add", "edit", "approve", "manage_providers", "manage_memos"]],
        ["sales", ["view", "view_all", "add", "edit", "delete", "submit", "vet", "approve", "upload", "manage_memos"]],
        ["underwriting", ["view", "add", "edit", "delete", "manage_organizations", "manage_principals", "manage_dependents", "manage_plans", "procurement", "manage_memos"]],
        ["call-centre", ["view", "add", "edit", "delete", "manage_requests", "verify_codes", "check_coverage", "procurement", "manage_memos"]],
        ["provider", ["view", "add", "edit", "delete", "approve", "manage_risk", "manage_inpatients", "manage_tariff_plan", "approve_tariff_plan", "procurement", "manage_memos"]],
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "ADMIN":
      return [
        ["dashboard", ["view"]],
        ["hr", ["view", "add", "edit", "manage_employees", "manage_attendance", "manage_leave"]],
        ["claims", ["view", "add", "edit", "vet", "audit"]],
        ["finance", ["view", "add", "edit", "approve", "process_payouts"]],
        ["provider", ["view", "add", "edit", "approve", "manage_risk", "manage_tariff_plan", "approve_tariff_plan"]],
        ["providers", ["view", "add", "edit", "approve"]],
        ["underwriting", ["view", "add", "edit", "manage_organizations", "manage_principals", "manage_dependents"]],
        ["underwriting_coverage", ["view", "add", "edit"]],
        ["underwriting_mobile", ["view"]],
        ["underwriting_utilization", ["view"]],
        ["call-centre", ["view", "add", "edit", "manage_requests", "verify_codes", "check_coverage"]],
        ["reports", ["view", "generate_all", "view_all"]],
        ["statistics", ["view", "generate", "export"]],
        ["settings", ["view", "add", "edit"]],
        ["fraud-detection", ["view", "add", "edit", "investigate", "approve", "reject"]],
        ["users", ["view", "add", "edit"]],
        ["department-oversight", ["view", "add", "edit", "delete"]],
        ["operation-desk", ["view", "add", "edit", "delete", "manage_memos"]],
        ["executive-desk", ["view", "add", "edit", "delete", "approve"]],
        ["special-risk", ["view", "add", "edit", "approve", "manage_providers", "manage_memos"]],
        ["legal", ["view", "manage_msa", "send_msa", "manage_memos"]],
        ["telemedicine", ["view", "add", "edit", "delete", "manage_facilities", "manage_appointments", "view_claims", "manage_memos"]], // Full telemedicine access
        ["sales", ["view", "view_all", "add", "edit", "delete", "submit", "vet", "approve", "upload", "manage_memos"]],
        ["underwriting", ["view", "add", "edit", "manage_organizations", "manage_principals", "manage_dependents", "manage_memos"]],
        ["call-centre", ["view", "add", "edit", "manage_requests", "verify_codes", "check_coverage", "manage_memos"]],
        ["provider", ["view", "add", "edit", "approve", "manage_risk", "manage_tariff_plan", "approve_tariff_plan", "manage_memos"]],
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "HR_MANAGER":
      return [
        ["dashboard", ["view"]],
        ["hr", ["view", "add", "edit", "delete", "manage_employees", "manage_attendance", "manage_leave", "manage_memos", "manage_rules", "manage_payroll", "procurement"]],
        ["reports", ["view", "generate_hr"]],
        ["settings", ["view"]],
        ["users", ["view"]],
        ["telemedicine", ["view", "add", "edit", "view_claims"]], // Basic telemedicine access
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "HR_OFFICER":
      return [
        ["dashboard", ["view"]],
        ["hr", ["view", "add", "edit", "manage_employees", "manage_attendance", "manage_leave", "manage_payroll", "manage_memos", "procurement"]],
        ["reports", ["view", "generate_hr"]],
        ["settings", ["view"]],
        ["telemedicine", ["view", "view_claims"]], // Basic telemedicine access
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "CLAIMS_MANAGER":
      return [
        ["dashboard", ["view"]],
        ["claims", ["view", "add", "edit", "delete", "vet", "audit", "approve", "fraud_detection", "procurement", "manage_memos"]],
        ["call-centre", ["view", "add", "edit", "manage_requests", "verify_codes", "check_coverage"]],
        ["fraud-detection", ["view", "add", "edit", "investigate", "approve", "reject"]],
        ["reports", ["view", "generate_claims"]],
        ["settings", ["view"]],
        ["users", ["view"]],
        ["telemedicine", ["view", "add", "edit", "view_claims"]], // Basic telemedicine access
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "CLAIMS_PROCESSOR":
      return [
        ["dashboard", ["view"]],
        ["claims", ["view", "add", "edit", "vet", "manage_memos", "procurement"]],
        ["call-centre", ["view", "add", "edit", "verify_codes", "check_coverage"]],
        ["fraud-detection", ["view", "investigate"]],
        ["reports", ["view", "generate_claims"]],
        ["settings", ["view"]],
        ["telemedicine", ["view", "add", "edit", "view_claims"]], // Basic telemedicine access
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "FINANCE_OFFICER":
      return [
        ["dashboard", ["view"]],
        ["finance", ["view", "add", "edit", "approve", "delete", "manage_accounts", "process_payouts", "manage_memos", "procurement"]],
        ["claims", ["view"]],
        ["fraud-detection", ["view"]],
        ["reports", ["view", "generate_finance"]],
        ["settings", ["view"]],
        ["telemedicine", ["view", "add", "edit", "view_claims"]], // Basic telemedicine access
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "PROVIDER_MANAGER":
      return [
        ["dashboard", ["view"]],
        ["users", ["view", "add", "edit"]],
        ["provider", ["view", "add", "edit", "delete", "approve", "manage_risk", "manage_inpatients", "manage_tariff_plan", "approve_tariff_plan", "procurement", "manage_memos"]],
        ["providers", ["view", "add", "edit", "delete", "approve"]],
        ["claims", ["view"]],
        ["fraud-detection", ["view", "investigate"]],
        ["reports", ["view", "generate_provider"]],
        ["settings", ["view"]],
        ["legal", ["view", "manage_msa", "send_msa"]],
        ["telemedicine", ["view", "add", "edit", "delete", "manage_facilities", "manage_appointments", "view_claims"]], // Full telemedicine access
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "UNDERWRITER":
      return [
        ["dashboard", ["view"]],
        ["underwriting", ["view", "add", "edit", "delete", "manage_organizations", "manage_principals", "manage_dependents", "manage_plans", "procurement", "manage_memos"]],
        ["special-risk", ["view", "add", "edit", "approve", "delete", "manage_providers", "manage_memos"]],
        ["fraud-detection", ["view"]],
        ["reports", ["view", "generate_underwriting"]],
        ["settings", ["view", "add", "edit"]],
        ["telemedicine", ["view", "view_claims"]], // Basic telemedicine access
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "SPECIAL_RISK":
    case "SPECIAL_RISK_MANAGER":
      return [
        ["dashboard", ["view"]],
        ["special-risk", ["view", "add", "edit", "approve", "delete", "manage_memos"]],
        ["reports", ["view", "generate_underwriting"]],
        ["settings", ["view"]],
        ["telemedicine", ["view", "view_claims"]], // Basic telemedicine access
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "PROVIDER":
      return [
        ["dashboard", ["view"]],
        ["providers", ["view", "add"]], // Can view and add provider requests (approval codes, claims, etc.)
        ["claims", ["view", "add"]], // Can view and add their own claims (filtered by provider_id in API)
        ["provider", ["view", "manage_tariff_plan", "manage_inpatients", "procurement", "manage_memos"]], // Can manage their own tariff plan, inpatients, procurement, and memos
        ["telemedicine", ["view"]], // Can view telemedicine
        ["reports", ["view", "generate_provider"]], // Can view and generate provider reports
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "TELEMEDICINE":
      return [
        ["dashboard", ["view"]],
        ["telemedicine", ["view", "add", "edit", "delete", "manage_facilities", "manage_appointments", "view_claims"]], // Full telemedicine access
        ["reports", ["view"]], // Allow telemedicine users to view reports (especially telemedicine reports)
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "SALES":
      return [
        ["dashboard", ["view"]],
        ["sales", ["view"]],
        ["legal", ["view"]], // Can only view approved documents
        ["reports", ["view"]], // Can view reports
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "TECHNICAL_ASSISTANT_SALES":
      return [
        ["dashboard", ["view"]],
        ["sales", ["view", "add", "edit", "submit"]], // Corporate Sales submodule
        ["reports", ["view"]], // Can view reports
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "HEAD_OF_AGENCY":
      return [
        ["dashboard", ["view"]],
        ["sales", ["view", "add", "edit", "submit", "vet", "approve"]], // Agency Sales submodule
        ["reports", ["view"]], // Can view reports
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "SALES_OPERATIONS_MANAGER":
      return [
        ["dashboard", ["view"]],
        ["sales", ["view", "add", "edit", "submit", "vet", "approve", "upload"]], // Sales Operations submodule
        ["reports", ["view"]], // Can view reports
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "CALL_CENTRE":
      return [
        ["dashboard", ["view"]],
        ["call-centre", ["view", "add", "edit", "delete", "approve", "manage_requests", "verify_codes", "check_coverage", "procurement"]],
        ["hr", ["view", "procurement"]], // Can view HR data and procurement
        ["underwriting", ["view", "manage_organizations", "manage_principals", "manage_dependents"]], // Can view and manage underwriting data
        ["underwriting_coverage", ["view"]],
        ["underwriting_mobile", ["view"]],
        ["claims", ["view"]], // Can view claims
        ["providers", ["view"]], // Can view providers
        ["provider", ["view"]], // Can view individual provider details (needed for /api/providers)
        ["reports", ["view"]], // Can view reports
        ["settings", ["view"]], // Can view settings
        ["telemedicine", ["view"]], // Can view telemedicine
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "CRM":
      return [
        ["dashboard", ["view"]],
        ["underwriting", ["view", "add", "edit", "manage_organizations", "manage_principals", "manage_dependents"]],
        ["underwriting_coverage", ["view"]],
        ["underwriting_mobile", ["view"]],
        ["claims", ["view"]],
        ["reports", ["view"]],
        ["settings", ["view"]],
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    case "HEAD_OF_OPERATIONS":
      return [
        ["dashboard", ["view"]],
        ["claims", ["view", "add", "edit", "vet", "audit", "procurement", "manage_memos"]],
        ["underwriting", ["view"]],
        ["operation-desk", ["view", "add", "edit", "delete", "manage_memos"]],
        ["reports", ["view", "generate_claims"]],
        ["providers", ["view"]],
        ["provider", ["view"]],
        ["settings", ["view"]],
      ].flatMap(([m, actions]) => (actions as string[]).map((a) => ({ module: m as string, action: a })))
    default:
      return []
  }
}

export function getDefaultPermissionsForRoleName(roleName: string): ModuleAction[] {
  const normalizedRole = roleName.replace(/ /g, '_').toUpperCase() as Role
  return getDefaultPermissionsForRole(normalizedRole)
}

// Convert any module name (DB or UI) to the internal sidebar id
function normalizeModuleId(name: string): string {
  const raw = (name || "").toString().trim().toLowerCase()
  // Replace ampersands with 'and' to stabilize
  let s = raw.replace(/&/g, "and")
  // Replace non-alphanumerics with underscores and collapse repeats
  s = s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  // Special-case mappings to align with nav ids
  if (s === "hr") return "hr"
  if (s === "claims") return "claims"
  if (s === "finance") return "finance"
  if (s === "provider") return "provider"
  if (s === "providers") return "providers"
  if (s === "underwriting") return "underwriting"
  if (s === "call_centre" || s === "call-centre") return "call-centre"
  if (s === "reports") return "reports"
  if (s === "statistics") return "statistics"
  if (s === "settings") return "settings"
  if (s === "fraud_detection" || s === "fraud-detection") return "fraud-detection"
  if (s === "users") return "users"
  if (s === "system") return "system"
  if (s === "department_oversight" || s === "department-oversight") return "department-oversight"
  if (s === "operation_desk" || s === "operation-desk") return "operation-desk"
  if (s === "executive_desk" || s === "executive-desk") return "executive-desk"
  if (s === "legal") return "legal"
  if (s === "special_risk" || s === "special-risk") return "special-risk"
  if (s === "sales") return "sales"
  return s.replace(/_/g, "-")
}
