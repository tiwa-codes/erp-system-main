export const SALES_SUBMODULE_LABELS = {
  CORPORATE_SALES: "Institutional Business",
  AGENCY_SALES: "Retail Sales",
  SPECIAL_RISKS_SALES: "Special Risk",
  SALES_OPERATIONS: "Public Sector",
} as const

export type SalesSubmoduleKey = keyof typeof SALES_SUBMODULE_LABELS

export const DEFAULT_SALES_TARGETS: Record<SalesSubmoduleKey, number> = {
  CORPORATE_SALES: 0,
  AGENCY_SALES: 0,
  SPECIAL_RISKS_SALES: 0,
  SALES_OPERATIONS: 0,
}

export const SALES_CHANNEL_OPTIONS = [
  { id: "institutional-business", label: "Institutional Business", submodule: "CORPORATE_SALES" },
  { id: "retail-sales", label: "Retail Sales", submodule: "AGENCY_SALES" },
  { id: "special-risk", label: "Special Risk", submodule: "SPECIAL_RISKS_SALES" },
  { id: "public-sector", label: "Public Sector", submodule: "SALES_OPERATIONS" },
] as const

// Exactly 36 Nigerian states (excluding FCT).
export const NIGERIAN_STATES_36 = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const
