/**
 * Audit script to compare sidebar modules with permissions.ts and sync script
 * This identifies missing modules/submodules that need to be synced to database
 */

// Modules from sidebar navigation
const sidebarModules = [
  "dashboard",
  "hr",
  "department-oversight",
  "operation-desk",
  "special-risk",
  "legal",
  "sales",
  "executive-desk",
  "underwriting",
  "finance",
  "call-centre",
  "claims",
  "provider",
  "providers",
  "telemedicine",
  "fraud-detection",
  "users",
  "reports",
  "settings"
];

// Modules from permissions.ts SUPER_ADMIN (complete list)
const permissionsModules = [
  "dashboard",
  "hr",
  "claims",
  "finance",
  "provider",
  "providers",
  "underwriting",
  "underwriting_coverage",
  "underwriting_mobile",
  "underwriting_utilization",
  "call-centre",
  "reports",
  "settings",
  "fraud-detection",
  "users",
  "system",
  "department-oversight",
  "operation-desk",
  "executive-desk",
  "legal",
  "telemedicine",
  "special-risk",
  "sales"
];

// Modules from sync-all-permissions.ts ADMIN role
const syncScriptModules = [
  "dashboard",
  "hr",
  "claims",
  "finance",
  "provider",
  "providers",
  "underwriting",
  "call-centre",
  "reports",
  "settings",
  "fraud-detection",
  "users",
  "department-oversight",
  "operation-desk",
  "executive-desk",
  "special-risk",
  "legal",
  "telemedicine",
  "sales"
];

console.log("=".repeat(80));
console.log("MODULE AUDIT REPORT");
console.log("=".repeat(80));

// Find modules in sidebar but not in sync script
const missingFromSync = sidebarModules.filter(m => !syncScriptModules.includes(m));
console.log("\n📋 Modules in SIDEBAR but MISSING from SYNC SCRIPT:");
if (missingFromSync.length === 0) {
  console.log("  ✅ None - all sidebar modules are in sync script");
} else {
  missingFromSync.forEach(m => console.log(`  ❌ ${m}`));
}

// Find modules in permissions.ts but not in sync script
const missingPermissionsFromSync = permissionsModules.filter(m => !syncScriptModules.includes(m));
console.log("\n📋 Modules in PERMISSIONS.TS but MISSING from SYNC SCRIPT:");
if (missingPermissionsFromSync.length === 0) {
  console.log("  ✅ None - all permissions modules are in sync script");
} else {
  missingPermissionsFromSync.forEach(m => console.log(`  ❌ ${m}`));
}

// Find modules in sync script but not in sidebar (might be internal modules)
const extraInSync = syncScriptModules.filter(m => !sidebarModules.includes(m));
console.log("\n📋 Modules in SYNC SCRIPT but NOT in SIDEBAR (internal modules):");
if (extraInSync.length === 0) {
  console.log("  ℹ️  None");
} else {
  extraInSync.forEach(m => console.log(`  ℹ️  ${m}`));
}

// Special modules that need attention
const specialModules = [
  "underwriting_coverage",
  "underwriting_mobile",
  "underwriting_utilization",
  "system"
];

console.log("\n📋 SPECIAL/SUBMODULES in permissions.ts:");
specialModules.forEach(m => {
  const inSync = syncScriptModules.includes(m);
  console.log(`  ${inSync ? '✅' : '❌'} ${m} ${inSync ? '(in sync)' : '(MISSING from sync)'}`);
});

console.log("\n" + "=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log(`Total sidebar modules: ${sidebarModules.length}`);
console.log(`Total permissions modules: ${permissionsModules.length}`);
console.log(`Total sync script modules: ${syncScriptModules.length}`);
console.log(`Missing from sync: ${missingFromSync.length + missingPermissionsFromSync.length}`);

if (missingFromSync.length > 0 || missingPermissionsFromSync.length > 0) {
  console.log("\n⚠️  ACTION REQUIRED: Update sync-all-permissions.ts with missing modules");
} else {
  console.log("\n✅ All modules are properly synced!");
}

console.log("=".repeat(80));
