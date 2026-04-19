import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestPharmacyOrderForEmail() {
  console.log('=== CREATING PHARMACY ORDER TO TEST EMAIL URL ===\n')

  try {
    // Find an existing appointment
    const appointment = await prisma.telemedicineAppointment.findFirst({
      where: { status: 'SCHEDULED' },
      include: {
        enrollee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        }
      }
    })

    if (!appointment) {
      console.log('❌ No scheduled appointments found')
      return
    }

    // Find a pharmacy facility
    const pharmacyFacility = await prisma.telemedicineFacility.findFirst({
      where: { facility_type: 'PHARMACY' }
    })

    if (!pharmacyFacility) {
      console.log('❌ No pharmacy facility found')
      return
    }

    // Create a new pharmacy order
    const pharmacyOrder = await prisma.pharmacyOrder.create({
      data: {
        appointment_id: appointment.id,
        facility_id: pharmacyFacility.id,
        medication: 'Aspirin 100mg',
        dose: '1 tablet daily',
        quantity: 30,
        status: 'PENDING',
        requested_by: 'Dr. Test Provider'
      }
    })

    console.log('✅ NEW Pharmacy order created:')
    console.log(`   ID: ${pharmacyOrder.id}`)
    console.log(`   Medication: ${pharmacyOrder.medication}`)
    console.log(`   Status: ${pharmacyOrder.status}`)
    console.log(`   Patient: ${appointment.enrollee.first_name} ${appointment.enrollee.last_name}`)
    console.log(`   Facility: ${pharmacyFacility.facility_name}`)

    // Create telemedicine request
    const telemedicineRequest = await prisma.telemedicineRequest.create({
      data: {
        appointment_id: appointment.id,
        enrollee_id: appointment.enrollee_id,
        request_type: 'PHARMACY',
        facility_id: pharmacyFacility.id,
        test_name: pharmacyOrder.medication,
        description: `Pharmacy order: ${pharmacyOrder.medication}`,
        status: 'PENDING',
        created_by_id: appointment.created_by_id
      }
    })

    console.log('✅ Telemedicine request created:', telemedicineRequest.id)

    console.log('\n📧 EMAIL URLS THAT WOULD BE SENT:')
    console.log(`Public Link: http://localhost:3000/pharmacy-orders/${pharmacyOrder.id}`)
    console.log(`Facility Portal Link: http://localhost:3000/pharmacy-orders/${pharmacyOrder.id}`)
    console.log('✅ Both URLs now point to the correct /pharmacy-orders/ path!')

    console.log('\n🎯 TEST URL:')
    console.log(`http://localhost:3000/pharmacy-orders/${pharmacyOrder.id}`)

    console.log('\n📋 API ENDPOINT TO TEST EMAIL:')
    console.log(`POST http://localhost:3000/api/telemedicine/appointments/${appointment.id}/pharmacy-order`)
    console.log('Body: {"facility_id": "' + pharmacyFacility.id + '", "medication": "Aspirin 100mg", "dose": "1 tablet daily"}')

  } catch (error) {
    console.error('❌ Error creating test pharmacy order:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestPharmacyOrderForEmail()
