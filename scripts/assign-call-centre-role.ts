import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignCallCentreRole() {
  try {
    // First, get the CALL_CENTRE role ID
    const callCentreRole = await prisma.role.findUnique({
      where: { name: 'CALL_CENTRE' },
    })

    if (!callCentreRole) {
      console.error('❌ CALL_CENTRE role not found in database!')
      console.log('Please run: npx tsx scripts/seed-call-centre-permissions.ts')
      return
    }

    console.log(`✅ Found CALL_CENTRE role with ID: ${callCentreRole.id}`)

    // Get the current user (you can modify this query based on your email or username)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role_id: true,
        role: {
          select: {
            name: true,
          },
        },
      },
      take: 10,
    })

    console.log('\n📋 Available users:')
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.first_name} ${user.last_name}) - Current role: ${user.role?.name || 'No role'}`)
    })

    console.log('\n💡 To assign CALL_CENTRE role to a user, run:')
    console.log('npx tsx scripts/assign-call-centre-role.ts <user-email>')
    console.log('\nExample:')
    console.log('npx tsx scripts/assign-call-centre-role.ts admin@example.com')

    // If email is provided as argument
    const userEmail = process.argv[2]
    if (userEmail) {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: {
          role: true,
        },
      })

      if (!user) {
        console.error(`\n❌ User not found: ${userEmail}`)
        return
      }

      const updated = await prisma.user.update({
        where: { email: userEmail },
        data: { role_id: callCentreRole.id },
        include: {
          role: true,
        },
      })

      console.log(`\n✅ Successfully updated user role!`)
      console.log(`Email: ${updated.email}`)
      console.log(`Name: ${updated.first_name} ${updated.last_name}`)
      console.log(`Old role: ${user.role?.name || 'No role'}`)
      console.log(`New role: ${updated.role?.name}`)
      console.log(`\n⚠️ IMPORTANT: Please logout and login again to refresh your session.`)
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

assignCallCentreRole()
