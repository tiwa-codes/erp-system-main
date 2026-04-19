/**
 * Database Cleanup Script
 * Deletes all principals and telemedicine history for "ceraeta" organization
 * 
 * Usage: npx ts-node erp-app/scripts/delete-ceraeta-principals.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteCeraetaPrincipals() {
  // Get organization code from command line args or use 'CERAETA' as default
  const orgCode = process.argv[2] || 'CERAETA'
  
  console.log(`🧹 Starting cleanup for organization: ${orgCode}...\n`)

  try {
    // Step 1: Find the organization
    const organization = await prisma.organization.findFirst({
      where: { 
        code: { contains: orgCode, mode: 'insensitive' }
      }
    })

    if (!organization) {
      console.log(`❌ Organization "${orgCode}" not found`)
      console.log('\nTo see all organizations, run: npx tsx scripts/list-organizations.ts')
      return
    }

    console.log(`✓ Found organization: ${organization.name} (ID: ${organization.id})`)

    // Step 2: Find all principals for this organization
    const principals = await prisma.principalAccount.findMany({
      where: { organization_id: organization.id },
      select: { 
        id: true, 
        enrollee_id: true, 
        first_name: true, 
        last_name: true 
      }
    })

    if (principals.length === 0) {
      console.log('✓ No principals found for this organization')
      return
    }

    console.log(`✓ Found ${principals.length} principal(s) to delete\n`)

    // Step 3: Get all appointment IDs for these principals
    const appointments = await prisma.telemedicineAppointment.findMany({
      where: {
        enrollee_id: { in: principals.map(p => p.id) }
      },
      select: { id: true }
    })

    console.log(`✓ Found ${appointments.length} telemedicine appointment(s)\n`)

    if (appointments.length > 0) {
      const appointmentIds = appointments.map(a => a.id)

      // Step 4: Delete Telemedicine Orders (child records of appointments)
      console.log('🗑️  Deleting telemedicine orders...')
      
      const labOrdersDeleted = await prisma.labOrder.deleteMany({
        where: { appointment_id: { in: appointmentIds } }
      })
      console.log(`   ✓ Deleted ${labOrdersDeleted.count} lab order(s)`)

      const radiologyOrdersDeleted = await prisma.radiologyOrder.deleteMany({
        where: { appointment_id: { in: appointmentIds } }
      })
      console.log(`   ✓ Deleted ${radiologyOrdersDeleted.count} radiology order(s)`)

      const pharmacyOrdersDeleted = await prisma.pharmacyOrder.deleteMany({
        where: { appointment_id: { in: appointmentIds } }
      })
      console.log(`   ✓ Deleted ${pharmacyOrdersDeleted.count} pharmacy order(s)`)

      const referralsDeleted = await prisma.referral.deleteMany({
        where: { appointment_id: { in: appointmentIds } }
      })
      console.log(`   ✓ Deleted ${referralsDeleted.count} referral(s)`)

      const encountersDeleted = await prisma.clinicalEncounter.deleteMany({
        where: { appointment_id: { in: appointmentIds } }
      })
      console.log(`   ✓ Deleted ${encountersDeleted.count} clinical encounter(s)\n`)
    }

    // Step 5: Delete Telemedicine Requests FIRST (before appointments)
    console.log('🗑️  Deleting telemedicine requests...')
    const telemedicineRequestsDeleted = await prisma.telemedicineRequest.deleteMany({
      where: { enrollee_id: { in: principals.map(p => p.id) } }
    })
    console.log(`   ✓ Deleted ${telemedicineRequestsDeleted.count} telemedicine request(s)`)

    // Also delete by appointment_id for any remaining
    if (appointments.length > 0) {
      const appointmentIds = appointments.map(a => a.id)
      const remainingRequestsDeleted = await prisma.telemedicineRequest.deleteMany({
        where: { appointment_id: { in: appointmentIds } }
      })
      if (remainingRequestsDeleted.count > 0) {
        console.log(`   ✓ Deleted ${remainingRequestsDeleted.count} additional telemedicine request(s) by appointment\n`)
      } else {
        console.log('')
      }
    } else {
      console.log('')
    }

    // Step 6: Delete Telemedicine Appointments
    console.log('🗑️  Deleting telemedicine appointments...')
    const appointmentsDeleted = await prisma.telemedicineAppointment.deleteMany({
      where: { enrollee_id: { in: principals.map(p => p.id) } }
    })
    console.log(`   ✓ Deleted ${appointmentsDeleted.count} appointment(s)\n`)

    // Step 7: Delete related data for each principal
    console.log('🗑️  Deleting principal-related records...')
    
    for (const principal of principals) {
      console.log(`   Processing principal: ${principal.first_name} ${principal.last_name} (${principal.enrollee_id})`)

      // Delete approval codes
      const approvalCodesDeleted = await prisma.approvalCode.deleteMany({
        where: { enrollee_id: principal.id }
      })
      console.log(`      ✓ Deleted ${approvalCodesDeleted.count} approval code(s)`)

      // Get claim IDs first
      const claims = await prisma.claim.findMany({
        where: { principal_id: principal.id },
        select: { id: true }
      })

      // Delete fraud alerts for these claims
      if (claims.length > 0) {
        const fraudAlertsDeleted = await prisma.fraudAlert.deleteMany({
          where: { claim_id: { in: claims.map(c => c.id) } }
        })
        console.log(`      ✓ Deleted ${fraudAlertsDeleted.count} fraud alert(s)`)
      }

      // Delete vetting records for these claims
      if (claims.length > 0) {
        const vettingRecordsDeleted = await prisma.vettingRecord.deleteMany({
          where: { claim_id: { in: claims.map(c => c.id) } }
        })
        console.log(`      ✓ Deleted ${vettingRecordsDeleted.count} vetting record(s)`)
      }

      // Delete audit records for these claims
      if (claims.length > 0) {
        const auditRecordsDeleted = await prisma.claimAudit.deleteMany({
          where: { claim_id: { in: claims.map(c => c.id) } }
        })
        console.log(`      ✓ Deleted ${auditRecordsDeleted.count} audit record(s)`)
      }

      // Delete payouts for these claims
      if (claims.length > 0) {
        const payoutsDeleted = await prisma.payout.deleteMany({
          where: { claim_id: { in: claims.map(c => c.id) } }
        })
        console.log(`      ✓ Deleted ${payoutsDeleted.count} payout(s)`)
      }

      // Now delete claims
      const claimsDeleted = await prisma.claim.deleteMany({
        where: { principal_id: principal.id }
      })
      console.log(`      ✓ Deleted ${claimsDeleted.count} claim(s)`)

      // Delete dependents
      const dependentsDeleted = await prisma.dependent.deleteMany({
        where: { principal_id: principal.id }
      })
      console.log(`      ✓ Deleted ${dependentsDeleted.count} dependent(s)`)

      // Delete provider requests
      const providerRequestsDeleted = await prisma.providerRequest.deleteMany({
        where: { enrollee_id: principal.id }
      })
      console.log(`      ✓ Deleted ${providerRequestsDeleted.count} provider request(s)`)

      // Delete medical history if exists
      const medicalHistoryDeleted = await prisma.medicalHistory.deleteMany({
        where: { principal_account_id: principal.id }
      })
      console.log(`      ✓ Deleted ${medicalHistoryDeleted.count} medical history record(s)`)
    }

    console.log('')

    // Step 8: Delete Principal Accounts
    console.log('🗑️  Deleting principal accounts...')
    const principalsDeleted = await prisma.principalAccount.deleteMany({
      where: { organization_id: organization.id }
    })
    console.log(`   ✓ Deleted ${principalsDeleted.count} principal account(s)\n`)

    console.log('✅ Cleanup completed successfully!')
    console.log(`\nSummary:`)
    console.log(`   • Organization: ${organization.name}`)
    console.log(`   • Principals deleted: ${principalsDeleted.count}`)
    console.log(`   • All related telemedicine data has been removed\n`)

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
deleteCeraetaPrincipals()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })

