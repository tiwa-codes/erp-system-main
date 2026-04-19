import { PrismaClient, Prisma, QueryMode } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const orgCode = process.argv[2]

  const whereClause: Prisma.OrganizationWhereInput | undefined = orgCode
    ? { code: { equals: orgCode, mode: "insensitive" as QueryMode } }
    : undefined

  type OrganizationWithPlans = Prisma.OrganizationGetPayload<{
    include: {
      organization_plans: {
        include: {
          plan: {
            select: {
              id: true
              name: true
              plan_type: true
              status: true
            }
          }
        }
      }
    }
  }>

  const organizations = await prisma.organization.findMany<OrganizationWithPlans>({
    where: whereClause,
    include: {
      organization_plans: {
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              plan_type: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: 20,
  })

  if (!organizations.length) {
    console.log("No organizations found for the provided filter.")
    return
  }

  organizations.forEach((org) => {
    console.log("-------------------------------------------------")
    console.log(`Organization: ${org.name} (${org.code})`)
    console.log(`ID:           ${org.id}`)
    console.log(`Status:       ${org.status}`)
    console.log(
      `Plans linked: ${org.organization_plans.length} (default: ${
        org.organization_plans.find((op) => op.is_default)?.plan?.name || "N/A"
      })`
    )
    if (org.organization_plans.length === 0) {
      console.warn("  👉 No organization_plan entries. The principal form will show no plans.")
    } else {
      org.organization_plans.forEach((op) => {
        const plan = op.plan
        if (!plan) return
        console.log(
          `  • ${plan.name} (${plan.plan_type}) - status ${plan.status} ${
            op.is_default ? "[default]" : ""
          }`
        )
      })
    }
  })
}

main()
  .catch((error) => {
    console.error("Failed to inspect organization plan configuration:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

