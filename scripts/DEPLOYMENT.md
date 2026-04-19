# Production Deployment Guide

## Quick Deploy Script

Run the automated deployment script:

```bash
bash scripts/deploy-production.sh
```

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Stop Application
```bash
pm2 stop crownjewelhmo
```

### 2. Generate Prisma Client
```bash
npm run db:generate
```

### 3. Sync Database Schema
```bash
npm run db:push
```

### 4. Build Application
```bash
npm run build
```
This automatically creates `prerender-manifest.json` if it's missing.

### 5. Start Application
```bash
npm start
```
The `prestart` hook ensures `prerender-manifest.json` exists before starting.

### 6. Or use PM2
```bash
pm2 start crownjewelhmo
```

## What the Script Does

The `create-prerender-manifest.js` script:
- ✅ Checks if `.next/prerender-manifest.json` exists
- ✅ Creates it automatically if missing
- ✅ Prevents Next.js from crashing due to missing manifest
- ✅ Runs automatically after `npm run build`
- ✅ Runs automatically before `npm start` (via prestart hook)

## Troubleshooting

### If build fails with prerender errors:
- The build will still complete
- The manifest will be created automatically
- Pages will render on-demand instead of being prerendered
- The application will work normally

### If you see "prerender-manifest.json not found":
- Run: `node scripts/create-prerender-manifest.js`
- Or run: `npm start` (the prestart hook will create it)

## Notes

- The prerender manifest is created automatically, so you don't need to manage it manually
- If prerendering fails (e.g., due to Zod import issues), the app still works
- Pages will be rendered on-demand instead of statically generated

