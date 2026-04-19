/**
 * Seeds the ENROLLEE role with limited permissions.
 * Run with: npx ts-node prisma/seed-enrollee-role.ts
 *
 * This is safe to run multiple times (upserts).
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding ENROLLEE role...")

  // Create ENROLLEE role
  const enrolleeRole = await prisma.role.upsert({
    where: { name: "ENROLLEE" },
    update: {
      description: "Enrollee (principal account holder) — limited self-service access",
      is_system: true,
      is_active: true,
    },
    create: {
      name: "ENROLLEE",
      description: "Enrollee (principal account holder) — limited self-service access",
      is_system: true,
      is_active: true,
      permissions: [],
    },
  })

  console.log(`✅ ENROLLEE role: ${enrolleeRole.id}`)

  // Define enrollee permissions — only what they need
  const enrolleePermissions = [
    { module: "insurance", action: "view" },
    { module: "medical-history", action: "view" },
    { module: "medical-history", action: "edit" },
    { module: "telemedicine", action: "view" },
    { module: "telemedicine", action: "add" },
    { module: "encounter-code", action: "view" },
    { module: "encounter-code", action: "add" },
  ]

  for (const perm of enrolleePermissions) {
    await prisma.permission.upsert({
      where: {
        role_id_module_submodule_action: {
          role_id: enrolleeRole.id,
          module: perm.module,
          submodule: null as any,
          action: perm.action,
        },
      },
      update: { allowed: true },
      create: {
        role_id: enrolleeRole.id,
        module: perm.module,
        action: perm.action,
        allowed: true,
      },
    })
  }

  console.log(`✅ Seeded ${enrolleePermissions.length} permissions for ENROLLEE role`)
  console.log("✅ Done. Run 'npx prisma db push' to apply any pending schema changes first.")
}

main()
  .catch((e) => {
    console.error("❌ Error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
