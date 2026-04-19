#!/usr/bin/env node

/**
 * Creates prerender-manifest.json if it doesn't exist.
 * This prevents Next.js from crashing when prerendering fails.
 */

const fs = require("fs")
const path = require("path")

// Get the directory where this script is located
const scriptDir = __dirname
// Get the app root directory (parent of scripts/)
const appRoot = path.resolve(scriptDir, "..")
const manifestPath = path.join(appRoot, ".next", "prerender-manifest.json")

// Check if manifest exists
if (!fs.existsSync(manifestPath)) {
  console.log("⚠️  prerender-manifest.json not found, creating minimal version...")

  const manifestDir = path.dirname(manifestPath)

  // Ensure .next directory exists
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true })
    console.log("📁 Created .next directory")
  }

  // Create minimal manifest
  const manifest = {
    version: 4,
    routes: {},
    dynamicRoutes: {},
    notFoundRoutes: [],
    preview: {
      previewModeId: process.env.PREVIEW_MODE_ID || "production-id",
      previewModeSigningKey: process.env.PREVIEW_MODE_SIGNING_KEY || "production-key",
      previewModeEncryptionKey: process.env.PREVIEW_MODE_ENCRYPTION_KEY || "production-key",
    },
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log("✅ Created prerender-manifest.json at:", manifestPath)
} else {
  console.log("✅ prerender-manifest.json already exists")
}
