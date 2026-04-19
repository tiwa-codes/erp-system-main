import { z } from "zod"

export const optionalInteger = () =>
  z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined
      const num = Number(value)
      if (Number.isNaN(num)) return undefined
      return Math.trunc(num)
    }, z.number().int().min(0))
    .optional()

export const coverageSchema = z.object({
  plan_id: z.string().optional(), // Removed - rules are based on AGE and MARITAL status only
  family_type: z.enum(["INDIVIDUAL", "FAMILY"]),
  principal_age_min: optionalInteger(),
  principal_age_max: optionalInteger(),
  spouse_age_min: optionalInteger(),
  spouse_age_max: optionalInteger(),
  spouse_count: optionalInteger(),
  children_age_max: optionalInteger(),
  children_count: optionalInteger(),
  parent_age_min: optionalInteger(),
  parent_age_max: optionalInteger(),
  parent_count: optionalInteger(),
  siblings_age_max: optionalInteger(),
  siblings_count: optionalInteger(),
})

