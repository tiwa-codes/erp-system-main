/**
 * Delete 6 Latest Telemedicine Appointments
 * Deletes the 6 most recent telemedicine appointments and all related records
 * 
 * Usage: npx tsx scripts/delete-latest-appointments.ts
 * Or: npm run delete:latest-appointments
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteLatestAppointments() {
  const count = 6
  console.log(`🗑️  Deleting ${count} latest telemedicine appointments...\n`)

  try {
    // Step 1: Find the 6 latest appointments
    const appointments = await prisma.telemedicineAppointment.findMany({
      take: count,
      orderBy: { created_at: 'desc' },
      include: {
        enrollee: {
          select: {
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        _count: {
          select: {
            clinical_encounters: true,
            lab_orders: true,
            radiology_orders: true,
            pharmacy_orders: true,
            referrals: true,
            telemedicine_requests: true
          }
        }
      }
    })

    if (appointments.length === 0) {
      console.log('✓ No appointments found to delete')
      return
    }

    console.log(`✓ Found ${appointments.length} appointment(s) to delete:\n`)
    appointments.forEach((apt, index) => {
      const enrolleeName = `${apt.enrollee.first_name} ${apt.enrollee.last_name}`
      const date = new Date(apt.scheduled_date).toLocaleDateString()
      const created = new Date(apt.created_at).toLocaleDateString()
      console.log(`  ${index + 1}. ID: ${apt.id}`)
      console.log(`     Enrollee: ${enrolleeName} (${apt.enrollee.enrollee_id})`)
      console.log(`     Scheduled: ${date} | Created: ${created}`)
      console.log(`     Status: ${apt.status}`)
      console.log(`     Related records: ${apt._count.clinical_encounters} encounters, ${apt._count.lab_orders} lab, ${apt._count.radiology_orders} radiology, ${apt._count.pharmacy_orders} pharmacy, ${apt._count.referrals} referrals, ${apt._count.telemedicine_requests} requests`)
      console.log('')
    })

    // Step 2: Delete related records for all appointments
    const appointmentIds = appointments.map(apt => apt.id)
    
    console.log('🧹 Deleting related records...\n')

    // Delete clinical encounters
    const deletedEncounters = await prisma.clinicalEncounter.deleteMany({
      where: { appointment_id: { in: appointmentIds } }
    })
    console.log(`  ✓ Deleted ${deletedEncounters.count} clinical encounter(s)`)

    // Delete lab orders
    const deletedLabOrders = await prisma.labOrder.deleteMany({
      where: { appointment_id: { in: appointmentIds } }
    })
    console.log(`  ✓ Deleted ${deletedLabOrders.count} lab order(s)`)

    // Delete radiology orders
    const deletedRadiologyOrders = await prisma.radiologyOrder.deleteMany({
      where: { appointment_id: { in: appointmentIds } }
    })
    console.log(`  ✓ Deleted ${deletedRadiologyOrders.count} radiology order(s)`)

    // Delete pharmacy orders
    const deletedPharmacyOrders = await prisma.pharmacyOrder.deleteMany({
      where: { appointment_id: { in: appointmentIds } }
    })
    console.log(`  ✓ Deleted ${deletedPharmacyOrders.count} pharmacy order(s)`)

    // Delete referrals
    const deletedReferrals = await prisma.referral.deleteMany({
      where: { appointment_id: { in: appointmentIds } }
    })
    console.log(`  ✓ Deleted ${deletedReferrals.count} referral(s)`)

    // Delete telemedicine requests
    const deletedRequests = await prisma.telemedicineRequest.deleteMany({
      where: { appointment_id: { in: appointmentIds } }
    })
    console.log(`  ✓ Deleted ${deletedRequests.count} telemedicine request(s)\n`)

    // Step 3: Delete audit logs related to these appointments
    const deletedAuditLogs = await prisma.auditLog.deleteMany({
      where: {
        resource: 'telemedicine_appointment',
        resource_id: { in: appointmentIds }
      }
    })
    console.log(`  ✓ Deleted ${deletedAuditLogs.count} audit log(s)\n`)

    // Step 4: Delete the appointments themselves
    console.log('🗑️  Deleting appointments...\n')
    const deletedAppointments = await prisma.telemedicineAppointment.deleteMany({
      where: { id: { in: appointmentIds } }
    })

    console.log(`✅ Successfully deleted ${deletedAppointments.count} appointment(s) and all related records`)
    console.log('\n📊 Summary:')
    console.log(`   - Appointments: ${deletedAppointments.count}`)
    console.log(`   - Clinical Encounters: ${deletedEncounters.count}`)
    console.log(`   - Lab Orders: ${deletedLabOrders.count}`)
    console.log(`   - Radiology Orders: ${deletedRadiologyOrders.count}`)
    console.log(`   - Pharmacy Orders: ${deletedPharmacyOrders.count}`)
    console.log(`   - Referrals: ${deletedReferrals.count}`)
    console.log(`   - Telemedicine Requests: ${deletedRequests.count}`)
    console.log(`   - Audit Logs: ${deletedAuditLogs.count}`)

  } catch (error) {
    console.error('❌ Error deleting appointments:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
deleteLatestAppointments()
  .then(() => {
    console.log('\n✓ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

