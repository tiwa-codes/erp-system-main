import { prisma } from "@/lib/prisma"

function buildTokenContainsClauses(field: string, search: string) {
  const terms = search
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const clauses: Array<Record<string, { contains: string; mode: "insensitive" }>> = [
    { [field]: { contains: search, mode: "insensitive" } },
  ]

  for (const term of terms) {
    if (term.toLowerCase() !== search.toLowerCase()) {
      clauses.push({ [field]: { contains: term, mode: "insensitive" } })
    }
  }

  return clauses
}

export async function buildClaimSearchOrClauses(search: string) {
  const trimmedSearch = search.trim()
  const searchVariants = [trimmedSearch]

  if (trimmedSearch.toLowerCase().endsWith("h") && trimmedSearch.length > 1) {
    searchVariants.push(trimmedSearch.slice(0, -1))
  }

  if (!trimmedSearch) {
    return []
  }

  const dependentMatches = await prisma.dependent.findMany({
    where: {
      OR: [
        ...buildTokenContainsClauses("dependent_id", trimmedSearch),
        ...buildTokenContainsClauses("first_name", trimmedSearch),
        ...buildTokenContainsClauses("last_name", trimmedSearch),
      ],
    },
    select: { dependent_id: true },
    take: 100,
  })

  const matchingDependentIds = dependentMatches.map((dep) => dep.dependent_id)

  const variantClauses = searchVariants.flatMap((variant) => [
    { claim_number: { contains: variant, mode: "insensitive" as const } },
    { enrollee_id: { contains: variant, mode: "insensitive" as const } },
    { id: { contains: variant, mode: "insensitive" as const } },
    { description: { contains: variant, mode: "insensitive" as const } },
    {
      principal: {
        OR: [
          ...buildTokenContainsClauses("first_name", variant),
          ...buildTokenContainsClauses("last_name", variant),
          ...buildTokenContainsClauses("enrollee_id", variant),
        ],
      },
    },
    {
      provider: {
        facility_name: { contains: variant, mode: "insensitive" as const },
      },
    },
  ])

  return [
    ...variantClauses,
    ...(matchingDependentIds.length > 0
      ? [
          {
            enrollee_id: {
              in: matchingDependentIds,
            },
          },
        ]
      : []),
  ]
}
