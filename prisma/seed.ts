import { PrismaClient } from '@prisma/client'
import { hashPassword } from './lib/auth-utils'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

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
  const roles = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR_OFFICER', 'CLAIMS_PROCESSOR', 'CLAIMS_MANAGER', 'FINANCE_OFFICER', 'PROVIDER_MANAGER', 'UNDERWRITER', 'PROVIDER']
  
  const modules = [
    { name: 'dashboard', actions: ['view', 'view_all'] },
    { name: 'hr', actions: ['view', 'add', 'edit', 'delete', 'manage_employees', 'manage_attendance', 'manage_leave', 'manage_memos'] },
    { name: 'claims', actions: ['view', 'add', 'edit', 'delete', 'vet', 'audit', 'approve', 'fraud_detection'] },
    { name: 'finance', actions: ['view', 'add', 'edit', 'delete', 'manage_accounts', 'process_payouts'] },
    { name: 'provider', actions: ['view', 'add', 'edit', 'delete', 'manage_risk', 'manage_inpatients'] },
    { name: 'underwriting', actions: ['view', 'add', 'edit', 'delete', 'manage_organizations', 'manage_principals', 'manage_dependents', 'manage_plans'] },
    { name: 'telemedicine', actions: ['view', 'add', 'edit', 'delete', 'manage_facilities', 'manage_appointments', 'view_claims'] },
    { name: 'reports', actions: ['generate_all', 'view_all', 'generate_hr', 'generate_claims', 'generate_finance', 'generate_provider', 'generate_underwriting'] },
    { name: 'statistics', actions: ['view', 'generate', 'export'] },
    { name: 'users', actions: ['view', 'add', 'edit', 'delete', 'manage_permissions'] },
    { name: 'system', actions: ['view_audit', 'configure'] },
  ]

  // Define role-specific permissions
  const rolePermissions: { [key: string]: { [key: string]: string[] } } = {
    SUPER_ADMIN: {
      dashboard: ['view', 'view_all'],
      hr: ['view', 'add', 'edit', 'delete', 'manage_employees', 'manage_attendance', 'manage_leave', 'manage_memos'],
      claims: ['view', 'add', 'edit', 'delete', 'vet', 'audit', 'approve', 'fraud_detection'],
      finance: ['view', 'add', 'edit', 'delete', 'manage_accounts', 'process_payouts'],
      provider: ['view', 'add', 'edit', 'delete', 'manage_risk', 'manage_inpatients'],
      underwriting: ['view', 'add', 'edit', 'delete', 'manage_organizations', 'manage_principals', 'manage_dependents', 'manage_plans'],
      telemedicine: ['view', 'add', 'edit', 'delete', 'manage_facilities', 'manage_appointments', 'view_claims'],
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
      telemedicine: ['view', 'add', 'edit', 'manage_facilities', 'manage_appointments', 'view_claims'],
      reports: ['generate_all', 'view_all'],
      statistics: ['view', 'generate', 'export'],
      users: ['view', 'add', 'edit'],
    },
    HR_MANAGER: {
      dashboard: ['view'],
      hr: ['view', 'add', 'edit', 'delete', 'manage_employees', 'manage_attendance', 'manage_leave', 'manage_memos'],
      telemedicine: ['view', 'add', 'edit'],
      reports: ['generate_hr'],
      users: ['view'],
    },
    HR_OFFICER: {
      dashboard: ['view'],
      hr: ['view', 'add', 'edit', 'manage_employees', 'manage_attendance', 'manage_leave'],
      telemedicine: ['view'],
      reports: ['generate_hr'],
    },
    CLAIMS_MANAGER: {
      dashboard: ['view'],
      claims: ['view', 'add', 'edit', 'delete', 'vet', 'audit', 'approve', 'fraud_detection'],
      telemedicine: ['view', 'view_claims'],
      reports: ['generate_claims'],
      users: ['view'],
    },
    CLAIMS_PROCESSOR: {
      dashboard: ['view'],
      claims: ['view', 'add', 'edit', 'vet'],
      telemedicine: ['view', 'view_claims'],
      reports: ['generate_claims'],
    },
    FINANCE_OFFICER: {
      dashboard: ['view'],
      finance: ['view', 'add', 'edit', 'manage_accounts', 'process_payouts'],
      claims: ['view'],
      telemedicine: ['view', 'view_claims'],
      reports: ['generate_finance'],
    },
    PROVIDER_MANAGER: {
      dashboard: ['view'],
      provider: ['view', 'add', 'edit', 'delete', 'manage_risk', 'manage_inpatients'],
      claims: ['view'],
      telemedicine: ['view', 'add', 'edit', 'manage_facilities', 'manage_appointments', 'view_claims'],
      reports: ['generate_provider'],
    },
    UNDERWRITER: {
      dashboard: ['view'],
      underwriting: ['view', 'add', 'edit', 'delete', 'manage_organizations', 'manage_principals', 'manage_dependents', 'manage_plans'],
      telemedicine: ['view'],
      reports: ['generate_underwriting'],
    },
    PROVIDER: {
      dashboard: ['view'],
      provider: ['view'],
      claims: ['view', 'add'],
      telemedicine: ['view', 'view_claims'],
    },
  }

  // Create permissions for each role
  for (const role of roles) {
    const permissions = rolePermissions[role] || {}
    
    for (const module of modules) {
      const modulePermissions = permissions[module.name] || []
      
      for (const action of module.actions) {
        const allowed = modulePermissions.includes(action)
        
        await prisma.permission.upsert({
          where: {
            role_module_action: {
              role: role as any,
              module: module.name,
              action: action,
            },
          },
          update: { allowed },
          create: {
            role: role as any,
            module: module.name,
            action: action,
            allowed: allowed,
          },
        })
      }
    }
  }

  // Create some sample organizations
  const sampleOrg = await prisma.organization.upsert({
    where: { name: 'Sample Corporation' },
    update: {},
    create: {
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
  const sampleProvider = await prisma.provider.upsert({
    where: { facility_name: 'City General Hospital' },
    update: {},
    create: {
      facility_name: 'City General Hospital',
      address: '456 Medical Ave, City, State',
      phone_whatsapp: '+1-555-0456',
      email: 'info@citygeneral.com',
      medical_director_name: 'Dr. John Smith',
      hmo_coordinator_name: 'Jane Doe',
      hmo_coordinator_phone: '+1-555-0457',
      hmo_coordinator_email: 'coordinator@citygeneral.com',
      year_of_incorporation: '1995',
      facility_reg_number: 'REG001',
      practice: 'General Practice',
      proprietor_partners: 'Dr. John Smith, Dr. Jane Doe',
      hcp_code: 'HCP001',
      status: 'ACTIVE',
    },
  })

  console.log('✅ Database seeded successfully!')
  console.log('👤 Admin user created: admin@erp.com / password123')
  console.log('👤 HR Manager created: hr@erp.com / password123')
  console.log('👤 Finance Officer created: finance@erp.com / password123')
  console.log('🏢 Sample organization and provider created')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
