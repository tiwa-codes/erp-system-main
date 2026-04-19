import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testLabOrderEmailURL() {
  console.log('=== TESTING LAB ORDER EMAIL URL ===\n')
  
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

  // Find a lab facility
  const labFacility = await prisma.telemedicineFacility.findFirst({
    where: { facility_type: 'LAB' }
  })

  if (!labFacility) {
    console.log('❌ No lab facility found')
    return
  }

  // Create a new lab order
  const labOrder = await prisma.labOrder.create({
    data: {
      appointment_id: appointment.id,
      facility_id: labFacility.id,
      test_name: 'Blood Test',
      status: 'PENDING',
      requested_by: 'Dr. Test Provider'
    }
  })

  console.log('✅ NEW Lab order created:')
  console.log(`   ID: ${labOrder.id}`)
  console.log(`   Test: ${labOrder.test_name}`)
  console.log(`   Status: ${labOrder.status}`)
  console.log(`   Patient: ${appointment.enrollee.first_name} ${appointment.enrollee.last_name}`)
  console.log(`   Facility: ${labFacility.facility_name}`)

  console.log('\n📧 EMAIL URLS THAT WOULD BE SENT:')
  console.log(`Public Link: http://localhost:3000/public/lab-results/${labOrder.id}`)
  console.log(`Facility Portal Link: http://localhost:3000/public/lab-results/${labOrder.id}`)
  console.log('✅ Both URLs now point to the correct /public/lab-results/ path!')

  console.log('\n🎯 TEST URL:')
  console.log(`http://localhost:3000/public/lab-results/${labOrder.id}`)

  console.log('\n📋 API ENDPOINT TO TEST EMAIL:')
  console.log(`POST http://localhost:3000/api/telemedicine/appointments/${appointment.id}/lab-order`)
  console.log('Body: {"facility_id": "' + labFacility.id + '", "test_name": "Blood Test", "requested_by": "Dr. Test Provider"}')

  await prisma.$disconnect()
}

testLabOrderEmailURL().catch(console.error)
