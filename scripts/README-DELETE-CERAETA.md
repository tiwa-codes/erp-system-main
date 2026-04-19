# Delete CERAETA Principals and Telemedicine History

This script deletes all principals and their telemedicine history for the "CERAETA" organization from the database.

## What Gets Deleted

The script will delete in the correct order to avoid foreign key constraint violations:

1. **Telemedicine Orders** (Lab, Radiology, Pharmacy, Referrals)
2. **Clinical Encounters**
3. **Telemedicine Appointments**
4. **Telemedicine Requests**
5. **Approval Codes**
6. **Claims**
7. **Dependents**
8. **Provider Requests**
9. **Medical History**
10. **Principal Accounts**

## How to Run

### Option 1: Using npx (Recommended)
```bash
cd erp-app
npx ts-node scripts/delete-ceraeta-principals.ts
```

### Option 2: Using npm script (if added to package.json)
```bash
cd erp-app
npm run delete-ceraeta
```

## Safety Features

- The script will only find organizations with "CERAETA" in the code (case-insensitive)
- It shows a detailed summary before deletion
- Each deletion step is logged with counts
- If no principals are found, the script exits gracefully

## Example Output

```
🧹 Starting cleanup for CERAETA organization...

✓ Found organization: Test Organization (ID: clxyz...)
✓ Found 5 principal(s) to delete

✓ Found 12 telemedicine appointment(s)

🗑️  Deleting telemedicine orders...
   ✓ Deleted 8 lab order(s)
   ✓ Deleted 3 radiology order(s)
   ✓ Deleted 5 pharmacy order(s)
   ✓ Deleted 2 referral(s)
   ✓ Deleted 10 clinical encounter(s)

🗑️  Deleting telemedicine appointments...
   ✓ Deleted 12 appointment(s)

🗑️  Deleting telemedicine requests...
   ✓ Deleted 5 telemedicine request(s)

🗑️  Deleting principal-related records...
   Processing principal: John Doe (TB001)
      ✓ Deleted 3 approval code(s)
      ✓ Deleted 1 claim(s)
      ✓ Deleted 0 dependent(s)
      ✓ Deleted 2 provider request(s)
      ✓ Deleted 1 medical history record(s)

🗑️  Deleting principal accounts...
   ✓ Deleted 5 principal account(s)

✅ Cleanup completed successfully!

Summary:
   • Organization: Test Organization
   • Principals deleted: 5
   • All related telemedicine data has been removed
```

## ⚠️ Warning

**This action cannot be undone!** Make sure to:
- Backup your database before running
- Verify you're running against the correct environment
- Double-check the organization code before running

## Backup Command

Before running the cleanup script, create a backup:

```bash
cd erp-app
npm run db:backup
```

## Database Connection

The script uses the `DATABASE_URL` from your `.env` file. Make sure it's pointing to the correct database!

