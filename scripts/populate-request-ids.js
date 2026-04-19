const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function populateRequestIds() {
  try {
    console.log('Starting to populate request_id for existing provider requests...')
    
    // Get all provider requests without request_id
    const requests = await prisma.providerRequest.findMany({
      where: {
        request_id: null
      }
    })
    
    console.log(`Found ${requests.length} requests without request_id`)
    
    // Update each request with a generated request_id
    for (const request of requests) {
      const requestId = `REQ-${request.id.slice(-8).toUpperCase()}`
      
      await prisma.providerRequest.update({
        where: { id: request.id },
        data: { request_id: requestId }
      })
      
      console.log(`Updated request ${request.id} with request_id: ${requestId}`)
    }
    
    console.log('Successfully populated all request_id fields!')
  } catch (error) {
    console.error('Error populating request_id:', error)
  } finally {
    await prisma.$disconnect()
  }
}

populateRequestIds()
