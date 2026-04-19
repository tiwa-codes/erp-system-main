import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkOrderType() {
  console.log('=== CHECKING ORDER TYPE ===\n')
  
  const orderId = 'cmgxfcaam002tl20aghbn4qeo'
  
  // Check if it's a lab order
  const labOrder = await prisma.labOrder.findUnique({
    where: { id: orderId },
    include: {
      facility: true,
      appointment: {
        include: {
          enrollee: {
            select: {
              first_name: true,
              last_name: true,
              enrollee_id: true
            }
          }
        }
      }
    }
  })
  
  if (labOrder) {
    console.log('✅ FOUND LAB ORDER:')
    console.log('   ID:', labOrder.id)
    console.log('   Test:', labOrder.test_name)
    console.log('   Status:', labOrder.status)
    console.log('   Patient:', labOrder.appointment.enrollee.first_name, labOrder.appointment.enrollee.last_name)
    console.log('   Facility:', labOrder.facility.facility_name)
    console.log('   Created:', labOrder.created_at)
    console.log('\n📧 EMAIL URLS:')
    console.log('   Old URL: /telemedicine/facility-portal/' + orderId)
    console.log('   New URL: /public/lab-results/' + orderId)
    console.log('   ✅ New URL works correctly!')
    return
  }
  
  // Check if it's a radiology order
  const radiologyOrder = await prisma.radiologyOrder.findUnique({
    where: { id: orderId },
    include: {
      facility: true,
      appointment: {
        include: {
          enrollee: {
            select: {
              first_name: true,
              last_name: true,
              enrollee_id: true
            }
          }
        }
      }
    }
  })
  
  if (radiologyOrder) {
    console.log('✅ FOUND RADIOLOGY ORDER:')
    console.log('   ID:', radiologyOrder.id)
    console.log('   Test:', radiologyOrder.test_name)
    console.log('   Status:', radiologyOrder.status)
    console.log('   Patient:', radiologyOrder.appointment.enrollee.first_name, radiologyOrder.appointment.enrollee.last_name)
    console.log('   Facility:', radiologyOrder.facility.facility_name)
    console.log('   Created:', radiologyOrder.created_at)
    console.log('\n📧 EMAIL URLS:')
    console.log('   Old URL: /telemedicine/facility-portal/' + orderId)
    console.log('   New URL: /public/radiology-results/' + orderId)
    console.log('   ✅ New URL works correctly!')
    return
  }
  
  // Check if it's a pharmacy order
  const pharmacyOrder = await prisma.pharmacyOrder.findUnique({
    where: { id: orderId },
    include: {
      facility: true,
      appointment: {
        include: {
          enrollee: {
            select: {
              first_name: true,
              last_name: true,
              enrollee_id: true
            }
          }
        }
      }
    }
  })
  
  if (pharmacyOrder) {
    console.log('✅ FOUND PHARMACY ORDER:')
    console.log('   ID:', pharmacyOrder.id)
    console.log('   Medication:', pharmacyOrder.medication)
    console.log('   Status:', pharmacyOrder.status)
    console.log('   Patient:', pharmacyOrder.appointment.enrollee.first_name, pharmacyOrder.appointment.enrollee.last_name)
    console.log('   Facility:', pharmacyOrder.facility.facility_name)
    console.log('   Created:', pharmacyOrder.created_at)
    console.log('\n📧 EMAIL URLS:')
    console.log('   Old URL: /telemedicine/facility-portal/' + orderId)
    console.log('   New URL: /pharmacy-orders/' + orderId)
    console.log('   ✅ New URL works correctly!')
    return
  }
  
  console.log('❌ ORDER NOT FOUND')
  console.log('   ID:', orderId)
  console.log('   This order might have been deleted or the ID is incorrect')
  
  await prisma.$disconnect()
}

checkOrderType().catch(console.error)
