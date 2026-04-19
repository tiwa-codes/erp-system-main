const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function hashPassword(password) {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

async function main() {
  console.log('🌱 Starting database seed...')
  
  // Clear existing data to prevent conflicts
  console.log('🧹 Clearing existing data...')
  await prisma.permission.deleteMany()
  await prisma.dependent.deleteMany()
  await prisma.principalAccount.deleteMany()
  await prisma.plan.deleteMany()
  await prisma.provider.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.user.deleteMany()
  await prisma.department.deleteMany()
  console.log('✅ Existing data cleared')

  // Create default department
  const hrDepartment = await prisma.department.upsert({
    where: { name: 'Human Resources' },
    update: {},
    create: {
      name: 'Human Resources',
      description: 'Human Resources Department',
    },
  })

  const itDepartment = await prisma.department.upsert({
    where: { name: 'Information Technology' },
    update: {},
    create: {
      name: 'Information Technology',
      description: 'IT Department',
    },
  })

  const financeDepartment = await prisma.department.upsert({
    where: { name: 'Finance' },
    update: {},
    create: {
      name: 'Finance',
      description: 'Finance Department',
    },
  })

  // Create default admin user
  const hashedPassword = await hashPassword('password123')
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@erp.com' },
    update: {},
    create: {
      email: 'admin@erp.com',
      password: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      title: 'System Administrator',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      department_id: itDepartment.id,
    },
  })

  // Create HR Manager
  const hrManager = await prisma.user.upsert({
    where: { email: 'hr@erp.com' },
    update: {},
    create: {
      email: 'hr@erp.com',
      password: hashedPassword,
      first_name: 'HR',
      last_name: 'Manager',
      title: 'HR Manager',
      role: 'HR_MANAGER',
      status: 'ACTIVE',
      department_id: hrDepartment.id,
    },
  })

  // Create Finance Officer
  const financeOfficer = await prisma.user.upsert({
    where: { email: 'finance@erp.com' },
    update: {},
    create: {
      email: 'finance@erp.com',
      password: hashedPassword,
      first_name: 'Finance',
      last_name: 'Officer',
      title: 'Finance Officer',
      role: 'FINANCE_OFFICER',
      status: 'ACTIVE',
      department_id: financeDepartment.id,
    },
  })

  // Create default permissions for all roles
  const roles = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR_OFFICER', 'CLAIMS_PROCESSOR', 'CLAIMS_MANAGER', 'FINANCE_OFFICER', 'PROVIDER_MANAGER', 'UNDERWRITER']
  
  const modules = [
    { 
      name: 'dashboard', 
      actions: ['view', 'view_all'],
      submodules: []
    },
    { 
      name: 'hr', 
      actions: ['view', 'add', 'edit', 'delete'],
      submodules: [
        { name: 'employees', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'attendance', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'leave', actions: ['view', 'add', 'edit', 'delete', 'approve'] },
        { name: 'memos', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'departments', actions: ['view', 'add', 'edit', 'delete'] }
      ]
    },
    { 
      name: 'claims', 
      actions: ['view', 'add', 'edit', 'delete'],
      submodules: [
        { name: 'vetter1', actions: ['view', 'vet', 'approve', 'reject'] },
        { name: 'vetter2', actions: ['view', 'vet', 'approve', 'reject'] },
        { name: 'audit', actions: ['view', 'audit', 'approve', 'reject'] },
        { name: 'approval', actions: ['view', 'approve', 'reject'] },
        { name: 'fraud', actions: ['view', 'investigate', 'resolve'] }
      ]
    },
    { 
      name: 'finance', 
      actions: ['view', 'add', 'edit', 'delete'],
      submodules: [
        { name: 'transactions', actions: ['view', 'add', 'edit', 'delete', 'process'] },
        { name: 'settlement', actions: ['view', 'add', 'edit', 'delete', 'process'] },
        { name: 'accounts', actions: ['view', 'add', 'edit', 'delete'] }
      ]
    },
    { 
      name: 'provider', 
      actions: ['view', 'add', 'edit', 'delete'],
      submodules: [
        { name: 'registration', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'risk-profile', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'in-patients', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'approval-codes', actions: ['view', 'generate', 'verify'] },
        { name: 'requests', actions: ['view', 'approve', 'reject'] }
      ]
    },
    { 
      name: 'underwriting', 
      actions: ['view', 'add', 'edit', 'delete'],
      submodules: [
        { name: 'organizations', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'principals', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'dependents', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'plans', actions: ['view', 'add', 'edit', 'delete'] }
      ]
    },
    { 
      name: 'call-centre', 
      actions: ['view', 'add', 'edit', 'delete'],
      submodules: [
        { name: 'generate-code', actions: ['view', 'generate'] },
        { name: 'provider-requests', actions: ['view', 'approve', 'reject'] },
        { name: 'encounter-codes', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'rejected-services', actions: ['view', 'resubmit'] }
      ]
    },
    { 
      name: 'reports', 
      actions: ['view', 'generate'],
      submodules: [
        { name: 'hr', actions: ['view', 'generate'] },
        { name: 'claims', actions: ['view', 'generate'] },
        { name: 'finance', actions: ['view', 'generate'] },
        { name: 'provider', actions: ['view', 'generate'] },
        { name: 'underwriting', actions: ['view', 'generate'] },
        { name: 'call-centre', actions: ['view', 'generate'] }
      ]
    },
    {
      name: 'statistics',
      actions: ['view', 'generate', 'export'],
      submodules: [
        { name: 'overview', actions: ['view'] },
        { name: 'erp-staff-usage', actions: ['view', 'generate', 'export'] },
        { name: 'provider-usage', actions: ['view', 'generate', 'export'] },
        { name: 'enrollee-app-usage', actions: ['view', 'generate', 'export'] },
        { name: 'login-analytics', actions: ['view', 'generate', 'export'] },
        { name: 'drop-off-analytics', actions: ['view', 'generate', 'export'] },
        { name: 'daily-activities', actions: ['view', 'generate', 'export'] },
        { name: 'android-vs-ios', actions: ['view', 'generate', 'export'] },
        { name: 'reports-export', actions: ['view', 'generate', 'export'] }
      ]
    },
    { 
      name: 'users', 
      actions: ['view', 'add', 'edit', 'delete'],
      submodules: [
        { name: 'roles', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'permissions', actions: ['view', 'add', 'edit', 'delete'] }
      ]
    },
    { 
      name: 'settings', 
      actions: ['view', 'add', 'edit', 'delete'],
      submodules: [
        { name: 'plans', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'provider-plans', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'package-limits', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'covered-services', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'service-types', actions: ['view', 'add', 'edit', 'delete'] },
        { name: 'band-labels', actions: ['view', 'add', 'edit', 'delete'] }
      ]
    },
    { 
      name: 'system', 
      actions: ['view', 'configure'],
      submodules: [
        { name: 'audit', actions: ['view'] },
        { name: 'config', actions: ['view', 'edit'] }
      ]
    },
  ]

  // Define role-specific permissions
  const rolePermissions = {
    SUPER_ADMIN: {
      dashboard: ['view', 'view_all'],
      hr: ['view', 'add', 'edit', 'delete', 'manage_employees', 'manage_attendance', 'manage_leave', 'manage_memos'],
      claims: ['view', 'add', 'edit', 'delete', 'vet', 'audit', 'approve', 'fraud_detection'],
      finance: ['view', 'add', 'edit', 'delete', 'manage_accounts', 'process_payouts'],
      provider: ['view', 'add', 'edit', 'delete', 'manage_risk', 'manage_inpatients'],
      underwriting: ['view', 'add', 'edit', 'delete', 'manage_organizations', 'manage_principals', 'manage_dependents', 'manage_plans'],
      reports: ['generate_all', 'view_all'],
      statistics: ['view', 'generate', 'export'],
      users: ['view', 'add', 'edit', 'delete', 'manage_permissions'],
      system: ['view_audit', 'configure'],
    },
    ADMIN: {
      dashboard: ['view'],
      hr: ['view', 'add', 'edit', 'manage_employees', 'manage_attendance', 'manage_leave'],
      claims: ['view', 'add', 'edit', 'vet', 'audit'],
      finance: ['view', 'add', 'edit', 'process_payouts'],
      provider: ['view', 'add', 'edit', 'manage_risk'],
      underwriting: ['view', 'add', 'edit', 'manage_organizations', 'manage_principals', 'manage_dependents'],
      reports: ['generate_all', 'view_all'],
      statistics: ['view', 'generate', 'export'],
      users: ['view', 'add', 'edit'],
    },
    HR_MANAGER: {
      dashboard: ['view'],
      hr: ['view', 'add', 'edit', 'delete', 'manage_employees', 'manage_attendance', 'manage_leave', 'manage_memos'],
      reports: ['generate_hr'],
      users: ['view'],
    },
    HR_OFFICER: {
      dashboard: ['view'],
      hr: ['view', 'add', 'edit', 'manage_employees', 'manage_attendance', 'manage_leave'],
      reports: ['generate_hr'],
    },
    CLAIMS_MANAGER: {
      dashboard: ['view'],
      claims: ['view', 'add', 'edit', 'delete', 'vet', 'audit', 'approve', 'fraud_detection'],
      reports: ['generate_claims'],
      users: ['view'],
    },
    CLAIMS_PROCESSOR: {
      dashboard: ['view'],
      claims: ['view', 'add', 'edit', 'vet'],
      reports: ['generate_claims'],
    },
    FINANCE_OFFICER: {
      dashboard: ['view'],
      finance: ['view', 'add', 'edit', 'manage_accounts', 'process_payouts'],
      claims: ['view'],
      reports: ['generate_finance'],
    },
    PROVIDER_MANAGER: {
      dashboard: ['view'],
      provider: ['view', 'add', 'edit', 'delete', 'manage_risk', 'manage_inpatients'],
      claims: ['view'],
      reports: ['generate_provider'],
    },
    UNDERWRITER: {
      dashboard: ['view'],
      underwriting: ['view', 'add', 'edit', 'delete', 'manage_organizations', 'manage_principals', 'manage_dependents', 'manage_plans'],
      reports: ['generate_underwriting'],
    },
  }

  // Create permissions for each role (batch processing to avoid connection pool issues)
  console.log('🔐 Creating permissions...')
  const permissionData = []
  
  for (const role of roles) {
    const permissions = rolePermissions[role] || {}
    
    for (const module of modules) {
      const modulePermissions = permissions[module.name] || []
      
      // Create permissions for main module actions
      for (const action of module.actions) {
        const allowed = modulePermissions.includes(action)
        permissionData.push({
          role: role,
          module: module.name,
          submodule: null,
          action: action,
          allowed: allowed,
        })
      }

      // Create permissions for submodule actions
      for (const submodule of module.submodules) {
        const submodulePermissions = permissions[module.name] || []
        
        for (const action of submodule.actions) {
          const allowed = submodulePermissions.includes(action)
          permissionData.push({
            role: role,
            module: module.name,
            submodule: submodule.name,
            action: action,
            allowed: allowed,
          })
        }
      }
    }
  }

  // Batch create permissions
  await prisma.permission.createMany({
    data: permissionData,
    skipDuplicates: true
  })
  console.log('✅ Permissions created successfully')

  // Create some sample organizations
  const sampleOrg = await prisma.organization.upsert({
    where: { organization_id: 'ORG001' },
    update: {},
    create: {
      organization_id: 'ORG001',
      name: 'Sample Corporation',
      code: 'SC001',
      type: 'CORPORATE',
      contact_info: {
        address: '123 Business St, City, State',
        phone: '+1-555-0123',
        email: 'contact@samplecorp.com',
      },
      status: 'ACTIVE',
    },
  })

  // Create some sample providers
  const sampleProvider1 = await prisma.provider.upsert({
    where: { provider_id: 'PROV001' },
    update: {},
    create: {
      provider_id: 'PROV001',
      // Section 1: Basic Information
      partnership_interest: 'YES',
      facility_name: 'City General Hospital',
      address: '456 Medical Ave, City, State',
      phone_whatsapp: '+1-555-0456',
      email: 'info@citygeneral.com',
      medical_director_name: 'Dr. John Smith',
      hmo_coordinator_name: 'Jane Doe',
      hmo_coordinator_phone: '+1-555-0457',
      hmo_coordinator_email: 'coordinator@citygeneral.com',
      year_of_incorporation: '2020',
      facility_reg_number: 'REG001',
      practice: 'General Medicine',
      proprietor_partners: 'Dr. John Smith, Dr. Mary Johnson',
      hcp_code: 'HCP001',
      
      // Section 2: Service Delivery
      hours_of_operation: '24/7',
      other_branches: 'Downtown Branch, Suburb Branch',
      emergency_care_services: ['TRAUMA_CARE', 'CARDIAC_EMERGENCY', 'GENERAL_EMERGENCY'],
      facility_type: ['HOSPITAL', 'SECONDARY_CARE'],
      personnel_licensed: 'YES',
      blood_bank_available: 'YES',
      blood_sourcing_method: '',
      radiology_lab_services: ['ULTRASOUND', 'ECG', 'CT_SCAN', 'BASIC_LAB'],
      other_services: ['VACCINES', 'PHYSIOTHERAPY', 'DENTAL_SERVICES'],
      
      // Section 3: Banking Information
      account_name: 'City General Hospital Account',
      account_number: '1234567890',
      designation: 'Medical Director',
      date: new Date('2024-01-01'),
      
      status: 'ACTIVE',
    },
  })

  const sampleProvider2 = await prisma.provider.upsert({
    where: { provider_id: 'PROV002' },
    update: {},
    create: {
      provider_id: 'PROV002',
      // Section 1: Basic Information
      partnership_interest: 'YES',
      facility_name: 'Metro Health Center',
      address: '789 Health Blvd, Metro City, State',
      phone_whatsapp: '+1-555-0789',
      email: 'info@metrohealth.com',
      medical_director_name: 'Dr. Sarah Wilson',
      hmo_coordinator_name: 'Mike Johnson',
      hmo_coordinator_phone: '+1-555-0790',
      hmo_coordinator_email: 'coordinator@metrohealth.com',
      year_of_incorporation: '2018',
      facility_reg_number: 'REG002',
      practice: 'Specialized Medicine',
      proprietor_partners: 'Dr. Sarah Wilson, Dr. David Brown',
      hcp_code: 'HCP002',
      
      // Section 2: Service Delivery
      hours_of_operation: '6AM-10PM',
      other_branches: 'North Branch, South Branch',
      emergency_care_services: ['CARDIAC_EMERGENCY', 'GENERAL_EMERGENCY'],
      facility_type: ['CLINIC', 'PRIMARY_CARE'],
      personnel_licensed: 'YES',
      blood_bank_available: 'NO',
      blood_sourcing_method: 'EXTERNAL_SUPPLIER',
      radiology_lab_services: ['ULTRASOUND', 'ECG', 'BASIC_LAB'],
      other_services: ['VACCINES', 'PHYSIOTHERAPY'],
      
      // Section 3: Banking Information
      account_name: 'Metro Health Center Account',
      account_number: '0987654321',
      designation: 'Medical Director',
      date: new Date('2024-01-01'),
      
      status: 'ACTIVE',
    },
  })

  // Create sample plans
  const samplePlan1 = await prisma.plan.upsert({
    where: { plan_id: 'PLAN001' },
    update: {},
    create: {
      plan_id: 'PLAN001',
      name: 'Premium Health Plan',
      description: 'Comprehensive health coverage for premium members',
      plan_type: 'INDIVIDUAL',
      premium_amount: 50000,
      annual_limit: 1000000,
      status: 'ACTIVE',
      created_by_id: adminUser.id,
    },
  })

  const samplePlan2 = await prisma.plan.upsert({
    where: { plan_id: 'PLAN002' },
    update: {},
    create: {
      plan_id: 'PLAN002',
      name: 'Basic Health Plan',
      description: 'Basic health coverage for standard members',
      plan_type: 'FAMILY',
      premium_amount: 25000,
      annual_limit: 500000,
      status: 'ACTIVE',
      created_by_id: adminUser.id,
    },
  })

  // Create sample principals
  const samplePrincipal1 = await prisma.principalAccount.upsert({
    where: { enrollee_id: 'CJH/SC001/000001' },
    update: {},
    create: {
      enrollee_id: 'CJH/SC001/000001',
      first_name: 'John',
      last_name: 'Doe',
      middle_name: 'Michael',
      date_of_birth: new Date('1985-06-15'),
      gender: 'MALE',
      phone_number: '+1-555-0101',
      email: 'john.doe@email.com',
      residential_address: '123 Main St, City, State',
      marital_status: 'MARRIED',
      account_type: 'PRINCIPAL',
      organization_id: sampleOrg.id,
      plan_id: samplePlan1.id,
      balance: 0,
      auto_renewal: false,
      created_by_id: adminUser.id,
    },
  })

  const samplePrincipal2 = await prisma.principalAccount.upsert({
    where: { enrollee_id: 'CJH/SC001/000002' },
    update: {},
    create: {
      enrollee_id: 'CJH/SC001/000002',
      first_name: 'Jane',
      last_name: 'Smith',
      middle_name: 'Elizabeth',
      date_of_birth: new Date('1990-03-22'),
      gender: 'FEMALE',
      phone_number: '+1-555-0102',
      email: 'jane.smith@email.com',
      residential_address: '456 Oak Ave, City, State',
      marital_status: 'SINGLE',
      account_type: 'PRINCIPAL',
      organization_id: sampleOrg.id,
      plan_id: samplePlan2.id,
      balance: 0,
      auto_renewal: false,
      created_by_id: adminUser.id,
    },
  })

  // Create sample dependents
  const sampleDependent1 = await prisma.dependent.upsert({
    where: { dependent_id: 'DEP001' },
    update: {},
    create: {
      dependent_id: 'DEP001',
      first_name: 'Sarah',
      last_name: 'Doe',
      middle_name: 'Marie',
      date_of_birth: new Date('2010-08-10'),
      gender: 'FEMALE',
      relationship: 'CHILD',
      phone_number: '+1-555-0103',
      email: 'sarah.doe@email.com',
      residential_address: '123 Main St, City, State',
      principal_id: samplePrincipal1.id,
      created_by_id: adminUser.id,
    },
  })

  const sampleDependent2 = await prisma.dependent.upsert({
    where: { dependent_id: 'DEP002' },
    update: {},
    create: {
      dependent_id: 'DEP002',
      first_name: 'Michael',
      last_name: 'Doe',
      middle_name: 'James',
      date_of_birth: new Date('2015-12-05'),
      gender: 'MALE',
      relationship: 'CHILD',
      phone_number: '+1-555-0104',
      email: 'michael.doe@email.com',
      residential_address: '123 Main St, City, State',
      principal_id: samplePrincipal1.id,
      created_by_id: adminUser.id,
    },
  })

  const sampleDependent3 = await prisma.dependent.upsert({
    where: { dependent_id: 'DEP003' },
    update: {},
    create: {
      dependent_id: 'DEP003',
      first_name: 'Robert',
      last_name: 'Smith',
      middle_name: 'David',
      date_of_birth: new Date('2012-04-18'),
      gender: 'MALE',
      relationship: 'CHILD',
      phone_number: '+1-555-0105',
      email: 'robert.smith@email.com',
      residential_address: '456 Oak Ave, City, State',
      principal_id: samplePrincipal2.id,
      created_by_id: adminUser.id,
    },
  })

  console.log('✅ Database seeded successfully!')
  console.log('👤 Admin user created: admin@erp.com / password123')
  console.log('👤 HR Manager created: hr@erp.com / password123')
  console.log('👤 Finance Officer created: finance@erp.com / password123')
  console.log('🏢 Sample organization created: Sample Corporation')
  console.log('🏥 Sample providers created: City General Hospital, Metro Health Center')
  console.log('📋 Sample plans created: Premium Health Plan, Basic Health Plan')
  console.log('👥 Sample principals created: John Doe, Jane Smith')
  console.log('👶 Sample dependents created: Sarah Doe, Michael Doe, Robert Smith')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
