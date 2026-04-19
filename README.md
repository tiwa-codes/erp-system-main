# ERP System

A comprehensive ERP (Enterprise Resource Planning) system built with Next.js, Prisma, PostgreSQL, and Tailwind CSS. This system is based on the VaxTracker architecture and provides modules for HR, Claims, Finance, Provider Management, and Underwriting.

## Features

### 🏢 Core Modules

- **HR Module** - Employee management, attendance tracking, leave management, memos
- **Claims Module** - Claims processing, vetting, audit, approval, fraud detection
- **Finance Module** - Financial transactions, payouts, principal account management
- **Provider Module** - Provider registration, risk profiling, in-patient management
- **Underwriting Module** - Organization management, principals, dependents, plan creation
- **Reports** - Comprehensive analytics and reporting system
- **Dashboard** - Real-time overview of system metrics and key performance indicators

### 🔐 Authentication & Authorization

- Role-based access control (RBAC)
- Multiple user roles: Super Admin, Admin, HR Manager, Claims Manager, Finance Officer, etc.
- Secure authentication with NextAuth.js
- Permission matrix for granular access control
- Comprehensive audit trails

### 📊 Real-time Features

- Live dashboard with key metrics
- Real-time notifications and alerts
- Performance analytics
- Audit logging for all user actions

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js
- **UI Components**: Radix UI, Lucide Icons, shadcn/ui
- **Charts**: Recharts
- **Data Tables**: TanStack Table
- **State Management**: TanStack Query, React Hook Form

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd erp-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your database URL and other configuration:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/erp_system"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"
   ```

4. **Set up the database**
   ```bash
   # Push the schema to your database (no migrations in development)
   npx prisma db push
   
   # Generate Prisma client
   npx prisma generate
   
   # Seed the database with initial data (optional)
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Credentials

Use these credentials to test the application:

- **Email**: admin@erp.com
- **Password**: password123

## Database Development Workflow

This project uses `prisma db push` for development instead of migrations, with a **Safe Schema Sync** system to prevent data loss:

### 🛡️ Safe Schema Sync (Recommended)

```bash
# Complete safe workflow with backups and confirmation
npm run db:sync
```

This command provides:
- ✅ Automatic schema and data backups
- ✅ Schema validation
- ✅ Change preview
- ✅ Confirmation prompts
- ✅ Safe application of changes

### 📋 Available Commands

```bash
# Safe schema sync (recommended)
npm run db:sync

# Create backups only
npm run db:backup

# Validate schema
npm run db:validate

# Preview changes
npm run db:preview

# List all backups
npm run db:list-backups

# Traditional commands (use with caution)
npm run db:push      # Direct push (no safety checks)
npm run db:reset     # Reset database (DESTROYS ALL DATA)
```

### 📁 Backup System

- **Schema Backups**: `backups/schema/` - Complete Prisma schema files
- **Data Backups**: `backups/data/` - Critical data as JSON
- **Automatic**: Created before every schema change
- **Recovery**: Available for emergency rollback

### ⚠️ Important Notes

- **Development Only**: This workflow is for development environments
- **Data Loss Risk**: Schema changes can cause data loss
- **Always Backup**: Use safe sync to minimize risks
- **Production**: Use proper migrations for production deployments

For detailed information, see [SCHEMA_SYNC_GUIDE.md](./SCHEMA_SYNC_GUIDE.md)

## Project Structure

```
erp-app/
├── app/                    # Next.js app directory
│   ├── (dashboard)/       # Dashboard pages
│   │   ├── hr/           # HR module pages
│   │   ├── claims/       # Claims module pages
│   │   ├── finance/      # Finance module pages
│   │   ├── provider/     # Provider module pages
│   │   ├── underwriting/ # Underwriting module pages
│   │   ├── reports/      # Reports pages
│   │   └── layout.tsx    # Dashboard layout
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication
│   │   ├── hr/           # HR API endpoints
│   │   ├── claims/       # Claims API endpoints
│   │   ├── finance/      # Finance API endpoints
│   │   ├── provider/     # Provider API endpoints
│   │   ├── underwriting/ # Underwriting API endpoints
│   │   └── reports/      # Reports API endpoints
│   ├── auth/              # Authentication pages
│   └── globals.css        # Global styles
├── components/            # Reusable components
│   ├── layout/           # Layout components
│   ├── ui/               # UI components (shadcn/ui)
│   └── forms/            # Form components
├── lib/                  # Utility libraries
│   ├── auth.ts           # Authentication config
│   ├── permissions.ts    # Permission utilities
│   ├── prisma.ts         # Database client
│   ├── audit.ts          # Audit logging
│   └── utils.ts          # General utilities
├── prisma/               # Database schema
│   └── schema.prisma     # ERP database schema
└── types/                # TypeScript type definitions
```

## User Roles & Permissions

### Super Admin
- Full system access
- User management
- System configuration
- All reports and analytics

### Admin
- Administrative access
- User management (limited)
- System oversight
- All module access

### HR Manager
- HR module full access
- Employee management
- Attendance and leave management
- HR reports

### HR Officer
- HR module limited access
- Employee data entry
- Attendance tracking
- Basic HR operations

### Claims Manager
- Claims module full access
- Claims processing and approval
- Fraud detection
- Claims reports

### Claims Processor
- Claims processing
- Vetting operations
- Limited claims management

### Finance Officer
- Finance module access
- Financial transactions
- Payout processing
- Financial reports

### Provider Manager
- Provider module access
- Provider management
- Risk profiling
- Provider reports

### Underwriter
- Underwriting module access
- Organization management
- Plan creation
- Principal and dependent management

## API Endpoints

### Authentication
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout

### HR Module
- `GET /api/hr/employees` - Get employees
- `POST /api/hr/employees` - Create employee
- `GET /api/hr/attendance` - Get attendance records
- `POST /api/hr/attendance` - Create attendance record

### Claims Module
- `GET /api/claims` - Get claims
- `POST /api/claims` - Create claim
- `GET /api/claims/vetting` - Get vetting records
- `POST /api/claims/vetting` - Create vetting record

### Finance Module
- `GET /api/finance/transactions` - Get financial transactions
- `POST /api/finance/transactions` - Create transaction
- `GET /api/finance/accounts` - Get principal accounts

### Provider Module
- `GET /api/provider/providers` - Get providers
- `POST /api/provider/providers` - Create provider
- `GET /api/provider/risk-profiles` - Get risk profiles

### Underwriting Module
- `GET /api/underwriting/organizations` - Get organizations
- `POST /api/underwriting/organizations` - Create organization
- `GET /api/underwriting/plans` - Get plans

## Development

### Database Management

```bash
# View database in Prisma Studio
npx prisma studio

# Reset database
npx prisma db push --force-reset

# Generate Prisma client
npx prisma generate

# List available backups
npm run db:list-backups

# Restore schema from backup
node scripts/schema-sync.js restore schema-backup-YYYY-MM-DDTHH-MM-SS-sssZ.prisma

# Regenerate Prisma client
npx prisma generate
```

### Code Structure

- Follow the modular architecture strictly
- Maintain clear interfaces between modules
- Implement proper error handling and logging
- Use consistent naming conventions
- Document all APIs and interfaces

## Security & Compliance

- Role-based access control (RBAC)
- Data encryption for sensitive information
- Comprehensive audit trails
- Input validation and sanitization
- Rate limiting and security headers
- Compliance with data protection regulations

## Performance

- Server-side rendering (SSR) for better SEO
- Static generation where possible
- Database query optimization
- Caching strategies implemented
- Efficient algorithms and data structures

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Commit changes: `git commit -m 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Next.js and React
- UI components from Radix UI
- Icons from Lucide React
- Charts powered by Recharts
- Database management with Prisma
- Based on VaxTracker architecture patterns
