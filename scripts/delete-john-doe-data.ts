/**
 * Cleanup script: Delete all test data for John Doe, Baby John, Lady John
 *
 * Covers:
 *  - Claims (manual + auto bill)
 *  - Provider Requests (call centre)
 *  - Approval Codes / Encounter Codes (call centre)
 *
 * Run with:
 *   DRY_RUN=true  npx ts-node --skip-project scripts/delete-john-doe-data.ts
 *   npx ts-node --skip-project scripts/delete-john-doe-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN === 'true'

// Names to match (case-insensitive)
const TARGET_NAMES = ['john doe', 'baby john', 'lady john']

function matchesTarget(name: string | null | undefined): boolean {
  if (!name) return false
  const lower = name.toLowerCase()
  return TARGET_NAMES.some((t) => lower.includes(t))
}

async function main() {
  console.log(`\n====== DELETE JOHN DOE TEST DATA ======`)
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '🗑️  LIVE DELETE'}`)
  console.log(`=======================================\n`)

  // ─────────────────────────────────────────────
  // 1. Find matching PrincipalAccounts
  // ─────────────────────────────────────────────
  const principals = await prisma.principalAccount.findMany({
    where: {
      OR: [
        { AND: [{ first_name: { contains: 'john', mode: 'insensitive' } }, { last_name: { contains: 'doe', mode: 'insensitive' } }] },
        { AND: [{ first_name: { contains: 'baby', mode: 'insensitive' } }, { last_name: { contains: 'john', mode: 'insensitive' } }] },
        { AND: [{ first_name: { contains: 'lady', mode: 'insensitive' } }, { last_name: { contains: 'john', mode: 'insensitive' } }] },
      ],
    },
    select: { id: true, enrollee_id: true, first_name: true, last_name: true, account_type: true },
  })

  console.log(`Found ${principals.length} matching PrincipalAccount(s):`)
  for (const p of principals) {
    console.log(`  → ${p.enrollee_id}  ${p.first_name} ${p.last_name}  [${p.account_type}]  id=${p.id}`)
  }

  const principalIds = principals.map((p) => p.id)

  // Also find dependents of John Doe principals
  const johnDoePrincipals = principals.filter((p) =>
    p.first_name.toLowerCase().includes('john') && p.last_name.toLowerCase().includes('doe')
  )
  const johnDoePrincipalIds = johnDoePrincipals.map((p) => p.id)

  const dependents = johnDoePrincipalIds.length
    ? await prisma.dependent.findMany({
        where: { principal_id: { in: johnDoePrincipalIds } },
        select: { id: true, dependent_id: true, first_name: true, last_name: true },
      })
    : []

  if (dependents.length) {
    console.log(`\nFound ${dependents.length} dependent(s) of John Doe:`)
    for (const d of dependents) {
      console.log(`  → ${d.dependent_id}  ${d.first_name} ${d.last_name}  id=${d.id}`)
    }
  }

  const dependentIds = dependents.map((d) => d.dependent_id) // string IDs like CJH/001/D01

  // ─────────────────────────────────────────────
  // 2. CLAIMS
  // ─────────────────────────────────────────────
  console.log(`\n─── CLAIMS ───`)

  const claims = principalIds.length
    ? await prisma.claim.findMany({
        where: { enrollee_id: { in: principalIds } },
        select: { id: true, claim_number: true, claim_type: true, status: true },
      })
    : []

  console.log(`Found ${claims.length} claim(s) to delete`)
  for (const c of claims) {
    console.log(`  → ${c.claim_number}  [${c.claim_type}] [${c.status}]`)
  }

  if (!DRY_RUN && claims.length) {
    const claimIds = claims.map((c) => c.id)

    // Delete dependant records first (no cascade on Claim)
    await prisma.vettingDraft.deleteMany({ where: { claim_id: { in: claimIds } } })
    await prisma.vettingAction.deleteMany({ where: { claim_id: { in: claimIds } } })
    await prisma.vettingRecord.deleteMany({ where: { claim_id: { in: claimIds } } })
    await prisma.fraudAlert.deleteMany({ where: { claim_id: { in: claimIds } } })
    await prisma.claimAudit.deleteMany({ where: { claim_id: { in: claimIds } } })
    await prisma.priceEdit.deleteMany({ where: { claim_id: { in: claimIds } } })
    await prisma.payout.deleteMany({ where: { claim_id: { in: claimIds } } })
    // Detach approval codes from these claims (don't delete the approval codes here — handled below)
    await prisma.approvalCode.updateMany({ where: { claim_id: { in: claimIds } }, data: { claim_id: null } })

    await prisma.claim.deleteMany({ where: { id: { in: claimIds } } })
    console.log(`  ✅ Deleted ${claimIds.length} claim(s) and their related records`)
  }

  // ─────────────────────────────────────────────
  // 3. APPROVAL / ENCOUNTER CODES
  // ─────────────────────────────────────────────
  console.log(`\n─── APPROVAL / ENCOUNTER CODES ───`)

  // Match by enrollee_id (principal account ID) OR enrollee_name OR beneficiary_id (dependent)
  const approvalCodeWhere: any = { OR: [] as any[] }
  if (principalIds.length) {
    approvalCodeWhere.OR.push({ enrollee_id: { in: principalIds } })
  }
  if (dependentIds.length) {
    approvalCodeWhere.OR.push({ beneficiary_id: { in: dependentIds } })
  }
  // Also match by stored enrollee_name
  for (const t of TARGET_NAMES) {
    approvalCodeWhere.OR.push({ enrollee_name: { contains: t, mode: 'insensitive' } })
  }

  const approvalCodes =
    approvalCodeWhere.OR.length
      ? await prisma.approvalCode.findMany({
          where: approvalCodeWhere,
          select: { id: true, approval_code: true, enrollee_name: true, status: true, is_manual: true },
        })
      : []

  console.log(`Found ${approvalCodes.length} approval/encounter code(s) to delete`)
  for (const a of approvalCodes) {
    console.log(`  → ${a.approval_code}  ${a.enrollee_name}  [${a.status}]  manual=${a.is_manual}`)
  }

  if (!DRY_RUN && approvalCodes.length) {
    const acIds = approvalCodes.map((a) => a.id)
    // ApprovalCodeService and ApprovalCodeTimeline have onDelete: Cascade
    await prisma.approvalCode.deleteMany({ where: { id: { in: acIds } } })
    console.log(`  ✅ Deleted ${acIds.length} approval code(s) (services + timeline cascade deleted)`)
  }

  // ─────────────────────────────────────────────
  // 4. PROVIDER REQUESTS
  // ─────────────────────────────────────────────
  console.log(`\n─── PROVIDER REQUESTS ───`)

  const prWhere: any = { OR: [] as any[] }
  if (principalIds.length) {
    prWhere.OR.push({ enrollee_id: { in: principalIds } })
  }
  if (dependentIds.length) {
    prWhere.OR.push({ beneficiary_id: { in: dependentIds } })
  }
  for (const t of TARGET_NAMES) {
    prWhere.OR.push({ beneficiary_name: { contains: t, mode: 'insensitive' } })
  }

  const providerRequests =
    prWhere.OR.length
      ? await prisma.providerRequest.findMany({
          where: prWhere,
          select: { id: true, request_id: true, beneficiary_name: true, status: true, hospital: true },
        })
      : []

  console.log(`Found ${providerRequests.length} provider request(s) to delete`)
  for (const r of providerRequests) {
    console.log(`  → ${r.request_id || r.id}  ${r.beneficiary_name}  [${r.status}]  @ ${r.hospital}`)
  }

  if (!DRY_RUN && providerRequests.length) {
    const prIds = providerRequests.map((r) => r.id)
    // ProviderRequestItem has onDelete: Cascade
    await prisma.providerRequest.deleteMany({ where: { id: { in: prIds } } })
    console.log(`  ✅ Deleted ${prIds.length} provider request(s) (items cascade deleted)`)
  }

  // ─────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────
  console.log(`\n====== SUMMARY ======`)
  console.log(`PrincipalAccounts matched : ${principals.length}`)
  console.log(`Dependents found          : ${dependents.length}`)
  console.log(`Claims                    : ${claims.length}`)
  console.log(`Approval/Encounter Codes  : ${approvalCodes.length}`)
  console.log(`Provider Requests         : ${providerRequests.length}`)
  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — nothing was deleted. Remove DRY_RUN=true to execute.`)
  } else {
    console.log(`\n✅ All matching records deleted.`)
  }
  console.log(`=====================\n`)
}

main()
  .catch((e) => {
    console.error('Script error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
