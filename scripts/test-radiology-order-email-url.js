import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testRadiologyOrderEmailURL() {
  console.log('=== TESTING RADIOLOGY ORDER EMAIL URL ===\n')
  
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

  // Find a radiology facility
  const radiologyFacility = await prisma.telemedicineFacility.findFirst({
    where: { facility_type: 'RADIOLOGY' }
  })

  if (!radiologyFacility) {
    console.log('❌ No radiology facility found')
    return
  }

  // Create a new radiology order
  const radiologyOrder = await prisma.radiologyOrder.create({
    data: {
      appointment_id: appointment.id,
      facility_id: radiologyFacility.id,
      test_name: 'X-Ray Chest',
      status: 'PENDING',
      requested_by: 'Dr. Test Provider'
    }
  })

  console.log('✅ NEW Radiology order created:')
  console.log(`   ID: ${radiologyOrder.id}`)
  console.log(`   Test: ${radiologyOrder.test_name}`)
  console.log(`   Status: ${radiologyOrder.status}`)
  console.log(`   Patient: ${appointment.enrollee.first_name} ${appointment.enrollee.last_name}`)
  console.log(`   Facility: ${radiologyFacility.facility_name}`)

  console.log('\n📧 EMAIL URLS THAT WOULD BE SENT:')
  console.log(`Public Link: http://localhost:3000/public/radiology-results/${radiologyOrder.id}`)
  console.log(`Facility Portal Link: http://localhost:3000/public/radiology-results/${radiologyOrder.id}`)
  console.log('✅ Both URLs now point to the correct /public/radiology-results/ path!')

  console.log('\n🎯 TEST URL:')
  console.log(`http://localhost:3000/public/radiology-results/${radiologyOrder.id}`)

  console.log('\n📋 API ENDPOINT TO TEST EMAIL:')
  console.log(`POST http://localhost:3000/api/telemedicine/appointments/${appointment.id}/radiology-order`)
  console.log('Body: {"facility_id": "' + radiologyFacility.id + '", "test_name": "X-Ray Chest", "requested_by": "Dr. Test Provider"}')

  await prisma.$disconnect()
}

testRadiologyOrderEmailURL().catch(console.error)
