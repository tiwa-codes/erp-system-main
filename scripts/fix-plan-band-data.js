import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixPlanBandData() {
  console.log('=== FIXING PLAN BAND DATA ===\n')

  try {
    // 1. Get all plans with their assigned bands
    const plans = await prisma.plan.findMany({
      select: {
        id: true,
        name: true,
        assigned_bands: true,
        band_type: true
      }
    })

    // 2. Get all active providers
    const providers = await prisma.provider.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        facility_name: true
      }
    })

    console.log(`Found ${plans.length} plans and ${providers.length} providers`)

    // 3. Delete existing PlanBand records
    console.log('Deleting existing PlanBand records...')
    await prisma.planBand.deleteMany({})
    console.log('Existing PlanBand records deleted')

    // 4. Create new PlanBand records based on plan's assigned_bands
    let createdCount = 0
    
    for (const plan of plans) {
      console.log(`\nProcessing plan: ${plan.name}`)
      console.log(`Assigned bands: ${JSON.stringify(plan.assigned_bands)}`)
      
      if (plan.assigned_bands && plan.assigned_bands.length > 0) {
        for (const bandLetter of plan.assigned_bands) {
          // Convert band letter to full format
          const bandType = `Band ${bandLetter.toUpperCase()}`
          
          console.log(`  Creating PlanBand records for ${bandType}`)
          
          // Create PlanBand record for each provider
          for (const provider of providers) {
            await prisma.planBand.create({
              data: {
                plan_id: plan.id,
                provider_id: provider.id,
                band_type: bandType,
                status: 'ACTIVE'
              }
            })
            createdCount++
          }
        }
      } else {
        console.log(`  Plan has no assigned bands, skipping`)
      }
    }

    console.log(`\nCreated ${createdCount} PlanBand records`)

    // 5. Verify the fix
    console.log('\n=== VERIFICATION ===')
    const planBands = await prisma.planBand.findMany({
      include: {
        plan: {
          select: {
            name: true,
            assigned_bands: true
          }
        },
        provider: {
          select: {
            facility_name: true
          }
        }
      }
    })

    console.log(`Total PlanBand records: ${planBands.length}`)
    
    // Group by plan
    const planGroups = {}
    planBands.forEach(pb => {
      if (!planGroups[pb.plan.name]) {
        planGroups[pb.plan.name] = {
          assigned_bands: pb.plan.assigned_bands,
          providers: []
        }
      }
      planGroups[pb.plan.name].providers.push({
        provider: pb.provider.facility_name,
        band_type: pb.band_type
      })
    })

    Object.entries(planGroups).forEach(([planName, data]) => {
      console.log(`\nPlan: ${planName}`)
      console.log(`  Assigned Bands: ${JSON.stringify(data.assigned_bands)}`)
      console.log(`  Providers: ${data.providers.length}`)
      data.providers.forEach(p => {
        console.log(`    - ${p.provider}: ${p.band_type}`)
      })
    })

  } catch (error) {
    console.error('Error fixing PlanBand data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixPlanBandData()
