import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NIGERIAN_FIRST_NAMES = [
  'Adebayo', 'Chukwuemeka', 'Fatima', 'Oluwaseun', 'Aminu', 'Ngozi', 'Emeka', 'Aisha',
  'Taiwo', 'Kehinde', 'Blessing', 'Chisom', 'Abdullahi', 'Yetunde', 'Olumide', 'Zainab',
  'Ifeanyi', 'Chiamaka', 'Babatunde', 'Mariam', 'Olusegun', 'Nkechi', 'Ibrahim', 'Funmilayo',
  'Chidi', 'Adaeze', 'Musa', 'Tolulope', 'Femi', 'Chinwe', 'Usman', 'Omotayo', 'Ekene',
  'Oluwafemi', 'Halima', 'Chinedu', 'Yewande', 'Suleiman', 'Obiageli', 'Rotimi', 'Ifeoma',
  'Biodun', 'Chidinma', 'Yakubu', 'Oluwakemi', 'Chukwudi', 'Adunola', 'Garba', 'Omowunmi',
  'Seun', 'Adaora', 'Tunde', 'Nneka', 'Kunle', 'Amaka', 'Dauda', 'Olawale', 'Ezinne',
  'Hakeem', 'Ogechi', 'Lanre', 'Ugochi', 'Dele', 'Chibuike', 'Rasaq', 'Onome',
  'Niyi', 'Uchechi', 'Wale', 'Ebele', 'Kofi', 'Adaeze', 'Jide', 'Ihuoma',
  'Desmond', 'Oluchi', 'Bamidele', 'Nonso', 'Lekan', 'Ejiro', 'Gbenga', 'Oghenekaro',
]

const NIGERIAN_LAST_NAMES = [
  'Adeyemi', 'Okafor', 'Bello', 'Adesanya', 'Nwachukwu', 'Okonkwo', 'Salami', 'Eze',
  'Abubakar', 'Obi', 'Adeleke', 'Chukwu', 'Musa', 'Oyelaran', 'Nduka', 'Garba',
  'Ogbonna', 'Femi', 'Usman', 'Bankole', 'Nwosu', 'Lawal', 'Aneke', 'Sanni',
  'Onwudiwe', 'Ajibola', 'Obiora', 'Danladi', 'Oduya', 'Ihejirika', 'Adeola',
  'Nwofor', 'Sokoya', 'Chidi', 'Ayodele', 'Onyekachi', 'Aliyu', 'Afolabi',
  'Nwaneri', 'Akintola', 'Okoro', 'Fashola', 'Olawuyi', 'Ikenna', 'Adamu',
  'Ogunyemi', 'Okereke', 'Hassan', 'Akande', 'Nnaji', 'Yusuf', 'Adeniji',
  'Ezechukwu', 'Olawale', 'Amadi', 'Abdulkadir', 'Akinwale', 'Mbah', 'Idris',
  'Adedeji', 'Okeke', 'Muhammed', 'Agbaje', 'Onyeka', 'Abdullahi', 'Ajayi',
  'Nzekwu', 'Adegoke', 'Ikechukwu', 'Oladapo', 'Chukwuka', 'Balogun', 'Iheme',
  'Ibikunle', 'Oluwasegun', 'Dibia', 'Adekunle', 'Chima', 'Oseni', 'Karounwi',
  'Saheed', 'Agunbiade', 'Oluwaseun', 'Oladele', 'Nwofor', 'Adebisi', 'Oyewole',
]

const ORGANIZATIONS = [
  { name: 'Halogen Security', code: 'HLG', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Access Bank Plc', code: 'ACB', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'MTN Nigeria', code: 'MTN', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Dangote Industries', code: 'DNG', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Nigerian Breweries', code: 'NBS', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Zenith Bank', code: 'ZNB', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Guaranty Trust Bank', code: 'GTB', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'First Bank Nigeria', code: 'FBN', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Flour Mills Nigeria', code: 'FMN', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Nestle Nigeria', code: 'NST', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Total Nigeria', code: 'TNL', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'UAC of Nigeria', code: 'UAC', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Lafarge Africa', code: 'LAF', type: 'CORPORATE' as const, state: 'Abuja' },
  { name: 'Seplat Petroleum', code: 'SPT', type: 'CORPORATE' as const, state: 'Abuja' },
  { name: 'Julius Berger Nigeria', code: 'JBN', type: 'CORPORATE' as const, state: 'Abuja' },
  { name: 'Nigerian National Petroleum', code: 'NNP', type: 'GOVERNMENT' as const, state: 'Abuja' },
  { name: 'Federal Ministry of Health', code: 'FMH', type: 'GOVERNMENT' as const, state: 'Abuja' },
  { name: 'Lagos State Government', code: 'LSG', type: 'GOVERNMENT' as const, state: 'Lagos' },
  { name: 'Mercy Corps Nigeria', code: 'MCN', type: 'NGO' as const, state: 'Abuja' },
  { name: 'ActionAid Nigeria', code: 'AAN', type: 'NGO' as const, state: 'Abuja' },
  { name: 'Airtel Nigeria', code: 'ATL', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Sterling Bank', code: 'STB', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Fidelity Bank', code: 'FDB', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Union Bank', code: 'UNB', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Stanbic IBTC', code: 'SIB', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Cadbury Nigeria', code: 'CDN', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Unilever Nigeria', code: 'ULN', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'PZ Cussons Nigeria', code: 'PZC', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Corona School', code: 'CRS', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Eko Hospitals', code: 'EKH', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Bridge Bank Group', code: 'BBG', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Oando Plc', code: 'OAN', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Presco Plc', code: 'PRS', type: 'CORPORATE' as const, state: 'Edo' },
  { name: 'UACN Property', code: 'UPD', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Conoil Plc', code: 'CNL', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'BUA Cement', code: 'BUA', type: 'CORPORATE' as const, state: 'Abuja' },
  { name: 'Transcorp Hotels', code: 'TRC', type: 'CORPORATE' as const, state: 'Abuja' },
  { name: 'Courteville Business', code: 'CBT', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Coronation Merchant Bank', code: 'CMB', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Sovereign Trust Insurance', code: 'STI', type: 'CORPORATE' as const, state: 'Lagos' },
  { name: 'Aso Savings & Loans', code: 'ASO', type: 'CORPORATE' as const, state: 'Abuja' },
  { name: 'National Provident Fund', code: 'NPF', type: 'GOVERNMENT' as const, state: 'Abuja' },
  { name: 'Delta State Government', code: 'DSG', type: 'GOVERNMENT' as const, state: 'Delta' },
  { name: 'Rivers State Government', code: 'RSG', type: 'GOVERNMENT' as const, state: 'Rivers' },
  { name: 'Kano State Government', code: 'KSG', type: 'GOVERNMENT' as const, state: 'Kano' },
]

const PLAN_TEMPLATES = [
  { suffix: 'Silver Lite Individual', type: 'INDIVIDUAL' as const, premium: 45000, limit: 500000 },
  { suffix: 'Gold Individual', type: 'INDIVIDUAL' as const, premium: 85000, limit: 1000000 },
  { suffix: 'Platinum Individual', type: 'INDIVIDUAL' as const, premium: 150000, limit: 2000000 },
  { suffix: 'Silver Family', type: 'FAMILY' as const, premium: 120000, limit: 1500000 },
  { suffix: 'Gold Family', type: 'FAMILY' as const, premium: 220000, limit: 3000000 },
]

function rand(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateEnrolleeId(orgCode: string, index: number) {
  return `CJH/HS/${String(index).padStart(4, '0')}`
}

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function main() {
  console.log('🌱 Seeding demo data...')

  // Get admin user
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@aspirage.com' } })
  if (!adminUser) {
    console.error('❌ Admin user not found. Run seed-admin.ts first.')
    process.exit(1)
  }

  // --- Organizations ---
  console.log('Creating organizations...')
  const createdOrgs: { id: string; code: string; name: string }[] = []
  let orgIdCounter = 1000

  for (const org of ORGANIZATIONS) {
    const orgId = String(orgIdCounter++)
    const created = await prisma.organization.upsert({
      where: { code: org.code },
      update: {},
      create: {
        organization_id: orgId,
        name: org.name,
        code: org.code,
        type: org.type,
        status: 'ACTIVE',
        state: org.state,
        contact_info: {
          email: `info@${org.code.toLowerCase()}.com`,
          phone: `080${randInt(10000000, 99999999)}`,
        },
      },
    })
    createdOrgs.push({ id: created.id, code: org.code, name: org.name })
  }
  console.log(`✅ ${createdOrgs.length} organizations created`)

  // --- Plans ---
  console.log('Creating plans...')
  const createdPlans: { id: string; name: string; orgId: string }[] = []
  let planIdCounter = 2000

  for (const org of createdOrgs) {
    const templates = PLAN_TEMPLATES.slice(0, randInt(2, 4))
    for (const tmpl of templates) {
      const planName = `${org.name} ${tmpl.suffix}`
      const planId = String(planIdCounter++)
      const plan = await prisma.plan.upsert({
        where: { plan_id: planId },
        update: {},
        create: {
          plan_id: planId,
          name: planName,
          plan_type: tmpl.type,
          premium_amount: tmpl.premium,
          annual_limit: tmpl.limit,
          status: 'ACTIVE',
          classification: 'GENERAL',
          assigned_bands: [],
          organization_id: org.id,
          created_by_id: adminUser.id,
        },
      })
      createdPlans.push({ id: plan.id, name: plan.name, orgId: org.id })
    }
  }
  console.log(`✅ ${createdPlans.length} plans created`)

  // --- Link Plans to Organizations ---
  console.log('Linking plans to organizations...')
  for (const plan of createdPlans) {
    await prisma.organizationPlan.upsert({
      where: { organization_id_plan_id: { organization_id: plan.orgId, plan_id: plan.id } },
      update: {},
      create: {
        organization_id: plan.orgId,
        plan_id: plan.id,
        is_default: false,
      },
    })
  }

  // --- Principal Accounts (Enrollees) ---
  console.log('Creating enrollees (this may take a moment)...')
  const TARGET_ENROLLEES = 7632
  let enrolleeCounter = 4000
  let createdEnrollees = 0
  const batchSize = 100
  const enrolleeIds: string[] = []

  // Distribute enrollees across orgs
  const enrolleesPerOrg = Math.ceil(TARGET_ENROLLEES / createdOrgs.length)

  for (const org of createdOrgs) {
    const orgPlans = createdPlans.filter(p => p.orgId === org.id)
    if (orgPlans.length === 0) continue

    const count = Math.min(enrolleesPerOrg, TARGET_ENROLLEES - createdEnrollees)
    if (count <= 0) break

    const batch = []
    for (let i = 0; i < count; i++) {
      const firstName = rand(NIGERIAN_FIRST_NAMES)
      const lastName = rand(NIGERIAN_LAST_NAMES)
      const plan = rand(orgPlans)
      const enrolleeId = generateEnrolleeId(org.code, enrolleeCounter++)
      const dob = randomDate(new Date('1960-01-01'), new Date('2000-12-31'))
      const startDate = randomDate(new Date('2022-01-01'), new Date('2024-06-01'))
      const endDate = new Date(startDate)
      endDate.setFullYear(endDate.getFullYear() + 1)

      batch.push({
        enrollee_id: enrolleeId,
        first_name: firstName,
        last_name: lastName,
        gender: rand(['MALE', 'FEMALE']) as 'MALE' | 'FEMALE',
        date_of_birth: dob,
        organization_id: org.id,
        plan_id: plan.id,
        account_type: 'PRINCIPAL' as const,
        status: Math.random() > 0.05 ? ('ACTIVE' as const) : ('INACTIVE' as const),
        created_by_id: adminUser.id,
        start_date: startDate,
        end_date: endDate,
        phone_number: `080${randInt(10000000, 99999999)}`,
        balance: randInt(0, 500000),
      })
    }

    // Insert in batches
    for (let b = 0; b < batch.length; b += batchSize) {
      const chunk = batch.slice(b, b + batchSize)
      const inserted = await Promise.all(
        chunk.map(data =>
          prisma.principalAccount.upsert({
            where: { enrollee_id: data.enrollee_id },
            update: {},
            create: data,
          })
        )
      )
      enrolled: for (const e of inserted) enrolleeIds.push(e.id)
      createdEnrollees += chunk.length
    }

    if (createdEnrollees % 500 === 0 || createdEnrollees >= TARGET_ENROLLEES) {
      process.stdout.write(`\r  → ${createdEnrollees}/${TARGET_ENROLLEES} enrollees`)
    }
  }
  console.log(`\n✅ ${createdEnrollees} enrollees created`)

  // --- Claims ---
  console.log('Creating claims...')
  const claimTypes: Array<'MEDICAL' | 'DENTAL' | 'PHARMACY' | 'VISION'> = ['MEDICAL', 'MEDICAL', 'MEDICAL', 'DENTAL', 'PHARMACY', 'VISION']
  const pendingStatuses: Array<'SUBMITTED' | 'UNDER_REVIEW' | 'VETTING'> = ['SUBMITTED', 'UNDER_REVIEW', 'VETTING']
  let claimCounter = 1000
  let totalClaims = 0

  const sampleEnrolleeIds = enrolleeIds.slice(0, 2000)

  for (let i = 0; i < 368; i++) {
    const enrolleeId = rand(sampleEnrolleeIds)
    const principal = await prisma.principalAccount.findUnique({ where: { id: enrolleeId } })
    if (!principal) continue

    const claimNum = `CLM/${String(claimCounter++).padStart(6, '0')}`
    const amount = randInt(5000, 250000)
    const status = rand(pendingStatuses)
    const submittedAt = randomDate(new Date('2025-01-01'), new Date())

    await prisma.claim.upsert({
      where: { claim_number: claimNum },
      update: {},
      create: {
        claim_number: claimNum,
        enrollee_id: principal.enrollee_id,
        principal_id: principal.id,
        claim_type: rand(claimTypes),
        amount,
        original_amount: amount,
        status,
        submitted_at: submittedAt,
        created_by_id: adminUser.id,
      },
    })
    totalClaims++
  }

  // Add some approved/paid claims for revenue data
  for (let i = 0; i < 1200; i++) {
    const enrolleeId = rand(sampleEnrolleeIds)
    const principal = await prisma.principalAccount.findUnique({ where: { id: enrolleeId } })
    if (!principal) continue

    const claimNum = `CLM/${String(claimCounter++).padStart(6, '0')}`
    const amount = randInt(5000, 350000)
    const submittedAt = randomDate(new Date('2025-01-01'), new Date())
    const approvedAt = new Date(submittedAt.getTime() + randInt(1, 14) * 86400000)

    await prisma.claim.upsert({
      where: { claim_number: claimNum },
      update: {},
      create: {
        claim_number: claimNum,
        enrollee_id: principal.enrollee_id,
        principal_id: principal.id,
        claim_type: rand(claimTypes),
        amount,
        original_amount: amount,
        approved_amount: Math.floor(amount * 0.85),
        status: rand(['APPROVED', 'PAID']) as 'APPROVED' | 'PAID',
        submitted_at: submittedAt,
        approved_at: approvedAt,
        created_by_id: adminUser.id,
      },
    })
    totalClaims++
  }
  console.log(`✅ ${totalClaims} claims created (368 pending, ${totalClaims - 368} approved/paid)`)

  // --- Invoices (all paid, so pending = 0) ---
  console.log('Creating invoices...')
  let invoiceCounter = 5000
  for (let i = 0; i < 150; i++) {
    const org = rand(createdOrgs)
    const orgPlans = createdPlans.filter(p => p.orgId === org.id)
    if (!orgPlans.length) continue
    const plan = rand(orgPlans)
    const invoiceNum = `INV/${String(invoiceCounter++).padStart(6, '0')}`
    const amount = randInt(50000, 2000000)
    const createdAt = randomDate(new Date('2025-01-01'), new Date())
    const paidAt = new Date(createdAt.getTime() + randInt(1, 30) * 86400000)

    await prisma.invoice.upsert({
      where: { invoice_number: invoiceNum },
      update: {},
      create: {
        invoice_number: invoiceNum,
        plan_id: plan.id,
        plan_amount: amount,
        status: 'PAID',
        paid_at: paidAt,
      },
    })
  }
  console.log(`✅ Invoices created (all paid → pending = 0)`)

  // --- Financial Transactions (for revenue chart) ---
  console.log('Creating financial transactions...')
  let txCounter = 0
  for (let daysAgo = 8; daysAgo >= 0; daysAgo--) {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    const txCount = randInt(20, 60)

    for (let t = 0; t < txCount; t++) {
      const amount = randInt(50000, 500000)
      await prisma.financialTransaction.create({
        data: {
          transaction_type: 'CLAIM_PAYOUT',
          amount,
          status: 'PAID',
          created_at: date,
        },
      })
      txCounter++
    }
  }
  console.log(`✅ ${txCounter} financial transactions created`)

  console.log('\n🎉 Demo seed complete!')
  console.log(`   Organizations: ${createdOrgs.length}`)
  console.log(`   Plans:         ${createdPlans.length}`)
  console.log(`   Enrollees:     ${createdEnrollees}`)
  console.log(`   Claims:        ${totalClaims}`)
  console.log(`   Pending claims: 368`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
