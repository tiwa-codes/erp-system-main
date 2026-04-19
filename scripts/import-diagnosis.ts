/**
 * Import ICD-10 diagnoses from an Excel file into the diagnosis table.
 *
 * Usage:
 *   npx ts-node scripts/import-diagnosis.ts --file diagnosis.xlsx
 *   npx ts-node scripts/import-diagnosis.ts --file diagnosis.xlsx --replace
 */

import fs from "fs"
import path from "path"
import * as XLSX from "xlsx"
import { PrismaClient } from "@prisma/client"

type DiagnosisRow = {
  code?: string
  description?: string
}

const prisma: any = new PrismaClient()

const chunk = <T>(items: T[], size: number) => {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  let file = "diagnosis.xlsx"
  let replaceAll = false

  for (const arg of args) {
    if (arg === "--replace" || arg === "--replace-all") {
      replaceAll = true
    } else if (arg.startsWith("--file=")) {
      file = arg.split("=").slice(1).join("=")
    } else if (!arg.startsWith("--")) {
      file = arg
    }
  }

  return { file, replaceAll }
}

const readWorkbook = (filePath: string) => {
  const buffer = fs.readFileSync(filePath)
  return XLSX.read(buffer, { type: "buffer" })
}

const normalizeRow = (row: DiagnosisRow, rowNum: number) => {
  const normalized: Record<string, unknown> = {}
  Object.entries(row).forEach(([key, value]) => {
    normalized[key.trim().toLowerCase()] = value
  })

  const codeValue = normalized.code ?? row.code
  const descriptionValue = normalized.description ?? row.description

  if (!codeValue || typeof codeValue !== "string") {
    throw new Error(`Row ${rowNum}: Missing or invalid 'code' column`)
  }

  if (!descriptionValue || typeof descriptionValue !== "string") {
    throw new Error(`Row ${rowNum}: Missing or invalid 'description' column`)
  }

  return {
    code: codeValue.trim().toUpperCase(),
    description: descriptionValue.trim()
  }
}

async function run() {
  const { file, replaceAll } = parseArgs()
  const filePath = path.resolve(process.cwd(), file)

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  console.log(`📄 Reading: ${filePath}`)
  const workbook = readWorkbook(filePath)
  const targetSheetKey = "toupload"
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "")
  const normalizedSheets = workbook.SheetNames.map((name) => ({
    name,
    normalized: normalize(name)
  }))
  const matchedSheet = normalizedSheets.find((sheet) => sheet.normalized === targetSheetKey)

  if (!matchedSheet) {
    throw new Error(`Sheet "${targetSheetKey}" not found. Available: ${workbook.SheetNames.join(", ")}`)
  }

  const worksheet = workbook.Sheets[matchedSheet.name]
  const jsonData = XLSX.utils.sheet_to_json(worksheet) as DiagnosisRow[]

  if (jsonData.length === 0) {
    throw new Error("The sheet is empty")
  }

  const diagnosesData = jsonData.map((row, index) => normalizeRow(row, index + 2))

  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const entry of diagnosesData) {
    if (seen.has(entry.code)) {
      duplicates.push(entry.code)
    }
    seen.add(entry.code)
  }

  if (duplicates.length > 0) {
    throw new Error(`Duplicate codes in file: ${duplicates.slice(0, 10).join(", ")}`)
  }

  console.log(`✅ Parsed ${diagnosesData.length} rows`)

  if (replaceAll) {
    console.log("⚠️  Replace-all mode: deleting existing diagnoses...")
    await prisma.$transaction([
      prisma.diagnosis.deleteMany(),
      prisma.diagnosis.createMany({ data: diagnosesData })
    ])
    console.log(`✅ Imported ${diagnosesData.length} diagnoses (replaced all)`)
    return
  }

  const codes = diagnosesData.map((d) => d.code)
  const existing = await prisma.diagnosis.findMany({
    where: { code: { in: codes } },
    select: { code: true }
  })
  const existingSet = new Set(existing.map((e: { code: string }) => e.code))

  const toCreate = diagnosesData.filter((d) => !existingSet.has(d.code))
  const toUpdate = diagnosesData.filter((d) => existingSet.has(d.code))

  let createdCount = 0
  let updatedCount = 0

  for (const batch of chunk(toCreate, 1000)) {
    if (batch.length === 0) continue
    await prisma.diagnosis.createMany({
      data: batch,
      skipDuplicates: true
    })
    createdCount += batch.length
  }

  for (const batch of chunk(toUpdate, 200)) {
    if (batch.length === 0) continue
    await prisma.$transaction(
      batch.map((entry) =>
        prisma.diagnosis.update({
          where: { code: entry.code },
          data: { description: entry.description }
        })
      )
    )
    updatedCount += batch.length
  }

  console.log(`✅ Imported ${createdCount + updatedCount} diagnoses`)
  console.log(`   - Inserted: ${createdCount}`)
  console.log(`   - Updated: ${updatedCount}`)
}

run()
  .catch((error) => {
    console.error("❌ Import failed:", error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
