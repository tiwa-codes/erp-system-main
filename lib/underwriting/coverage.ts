import { prisma } from "@/lib/prisma"

type DependentInput = {
  relationship: string
  dateOfBirth: string | null
}

export type CoverageValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

const calculateAge = (value?: string | Date | null) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const monthDiff = today.getMonth() - date.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--
  }
  return age
}

const checkAgeRange = (
  age: number | null,
  min?: number | null,
  max?: number | null
) => {
  if (age === null) return null
  if (min !== undefined && min !== null && age < min) {
    return `Age ${age} is below the minimum allowed (${min})`
  }
  if (max !== undefined && max !== null && age > max) {
    return `Age ${age} exceeds the maximum allowed (${max})`
  }
  return null
}

export async function validateCoverageRule(options: {
  planId: string
  principalDateOfBirth?: string
  dependents?: DependentInput[]
  existingDependents?: DependentInput[]
}): Promise<CoverageValidationResult> {
  const { planId, principalDateOfBirth, dependents = [], existingDependents = [] } = options
  const rule = await prisma.coverageRule.findFirst({
    where: { plan_id: planId },
    orderBy: { created_at: "desc" },
  })

  if (!rule) {
    return { valid: true }
  }

  if (rule.family_type === "INDIVIDUAL" && dependents.length + existingDependents.length > 0) {
    return {
      valid: false,
      reason: "This plan does not allow dependents."
    }
  }

  const principalAge = calculateAge(principalDateOfBirth)
  if (principalAge !== null) {
    const principalAgeError = checkAgeRange(principalAge, rule.principal_age_min, rule.principal_age_max)
    if (principalAgeError) {
      return {
        valid: false,
        reason: `Principal age restriction: ${principalAgeError}`
      }
    }
  }

  const allDependents = [...existingDependents, ...dependents]
  const relationshipCounts: Record<string, number> = {
    SPOUSE: 0,
    SON: 0,
    DAUGHTER: 0,
    CHILD: 0, // Keep for backward compatibility
    PARENT: 0,
    SIBLING: 0,
  }

  for (const dependent of allDependents) {
    const relationship = dependent.relationship?.toUpperCase() || "OTHER"
    const age = calculateAge(dependent.dateOfBirth)

    // Count SON and DAUGHTER as CHILD for validation purposes
    if (relationship === "SON" || relationship === "DAUGHTER") {
      relationshipCounts.CHILD = (relationshipCounts.CHILD || 0) + 1
      if (relationshipCounts[relationship] !== undefined) {
        relationshipCounts[relationship] += 1
      }
    } else if (relationshipCounts[relationship] !== undefined) {
      relationshipCounts[relationship] += 1
    }

    // Spouse age range validation removed - no longer checking spouse age ranges

    // Check age for SON, DAUGHTER, or CHILD (for backward compatibility)
    if (relationship === "SON" || relationship === "DAUGHTER" || relationship === "CHILD") {
      if (rule.children_age_max && age !== null && age > rule.children_age_max) {
        return {
          valid: false,
          reason: `Child age must be ${rule.children_age_max} or younger`
        }
      }
    }

    // Parent age range validation removed - no longer checking parent age ranges

    if (relationship === "SIBLING") {
      if (rule.siblings_age_max && age !== null && age > rule.siblings_age_max) {
        return {
          valid: false,
          reason: `Sibling age must be ${rule.siblings_age_max} or younger`
        }
      }
    }
  }

  if (rule.spouse_count !== null && rule.spouse_count !== undefined) {
    if (relationshipCounts.SPOUSE > rule.spouse_count) {
      return {
        valid: false,
        reason: `Only ${rule.spouse_count} spouse(s) allowed`
      }
    }
  }

  if (rule.children_count !== null && rule.children_count !== undefined) {
    if (relationshipCounts.CHILD > rule.children_count) {
      return {
        valid: false,
        reason: `Only ${rule.children_count} children allowed`
      }
    }
  }

  if (rule.parent_count !== null && rule.parent_count !== undefined) {
    if (relationshipCounts.PARENT > rule.parent_count) {
      return {
        valid: false,
        reason: `Only ${rule.parent_count} parent(s) allowed`
      }
    }
  }

  if (rule.siblings_count !== null && rule.siblings_count !== undefined) {
    if (relationshipCounts.SIBLING > rule.siblings_count) {
      return {
        valid: false,
        reason: `Only ${rule.siblings_count} sibling(s) allowed`
      }
    }
  }

  return { valid: true }
}




