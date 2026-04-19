import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

// Increase the body size limit for file uploads
export const maxDuration = 60 // 60 seconds timeout
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log("[Diagnosis Upload] Starting upload process...")
    
    // Check authentication
    const session = await getServerSession(authOptions)
    console.log("[Diagnosis Upload] Session check:", session ? "Authenticated" : "Not authenticated")
    console.log("[Diagnosis Upload] Session check:", session ? "Authenticated" : "Not authenticated")
    if (!session?.user) {
      console.log("[Diagnosis Upload] Unauthorized - no session")
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    console.log("[Diagnosis Upload] Getting form data...")
    // Get the uploaded file
    const formData = await request.formData()
    const file = formData.get("file") as File
    
    console.log("[Diagnosis Upload] File received:", file ? file.name : "No file")
    console.log("[Diagnosis Upload] File received:", file ? file.name : "No file")
    
    if (!file) {
      console.log("[Diagnosis Upload] Error: No file in form data")
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      )
    }

    console.log("[Diagnosis Upload] File details:", {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      console.log("[Diagnosis Upload] Error: Invalid file type:", file.name)
      return NextResponse.json(
        { success: false, error: "Please upload an Excel file (.xlsx or .xls)" },
        { status: 400 }
      )
    }

    console.log("[Diagnosis Upload] Reading file buffer...")
    // Read the file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log("[Diagnosis Upload] Parsing Excel file...")
    // Parse the Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    console.log("[Diagnosis Upload] Available sheets:", workbook.SheetNames.join(", "))
    
    // Get the "to-upload" sheet
    const sheetName = "to-upload"
    if (!workbook.SheetNames.includes(sheetName)) {
      console.log("[Diagnosis Upload] Error: Sheet not found. Available:", workbook.SheetNames.join(", "))
      return NextResponse.json(
        { 
          success: false, 
          error: `Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(", ")}` 
        },
        { status: 400 }
      )
    }

    console.log("[Diagnosis Upload] Converting sheet to JSON...")
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<{
      code?: string
      description?: string
    }>

    console.log("[Diagnosis Upload] Rows found:", jsonData.length)
    if (jsonData.length === 0) {
      return NextResponse.json(
        { success: false, error: "The sheet is empty" },
        { status: 400 }
      )
    }

    // Validate and prepare data
    const diagnosesData: Array<{ code: string; description: string }> = []
    const errors: string[] = []

    jsonData.forEach((row, index) => {
      const rowNum = index + 2 // Excel rows start at 1, plus 1 for header
      
      if (!row.code || typeof row.code !== 'string') {
        errors.push(`Row ${rowNum}: Missing or invalid 'code' column`)
        return
      }
      
      if (!row.description || typeof row.description !== 'string') {
        errors.push(`Row ${rowNum}: Missing or invalid 'description' column`)
        return
      }

      diagnosesData.push({
        code: row.code.trim().toUpperCase(),
        description: row.description.trim()
      })
    })

    if (errors.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Validation errors found",
          errors: errors.slice(0, 10), // Show first 10 errors
          totalErrors: errors.length
        },
        { status: 400 }
      )
    }

    if (diagnosesData.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid data found in the sheet" },
        { status: 400 }
      )
    }

    // Check for duplicates within the upload
    const codeSet = new Set<string>()
    const duplicatesInFile: string[] = []
    diagnosesData.forEach(d => {
      if (codeSet.has(d.code)) {
        duplicatesInFile.push(d.code)
      }
      codeSet.add(d.code)
    })

    if (duplicatesInFile.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Duplicate codes found in the file",
          duplicates: duplicatesInFile.slice(0, 10)
        },
        { status: 400 }
      )
    }

    // Check if we should replace all data or skip duplicates
    const replaceAll = formData.get("replaceAll") === "true"

    let inserted = 0
    let updated = 0
    let skipped = 0

    if (replaceAll) {
      // Delete all existing diagnoses and insert new ones
      await prisma.diagnosis.deleteMany()
      
      // Bulk insert
      await prisma.diagnosis.createMany({
        data: diagnosesData
      })
      
      inserted = diagnosesData.length
    } else {
      // Insert or update one by one (slower but handles duplicates)
      for (const diagnosis of diagnosesData) {
        const existing = await prisma.diagnosis.findUnique({
          where: { code: diagnosis.code }
        })

        if (existing) {
          // Update existing
          await prisma.diagnosis.update({
            where: { code: diagnosis.code },
            data: { description: diagnosis.description }
          })
          updated++
        } else {
          // Create new
          await prisma.diagnosis.create({
            data: diagnosis
          })
          inserted++
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: replaceAll 
        ? `Successfully uploaded ${inserted} diagnoses (replaced all existing data)`
        : `Successfully processed ${inserted + updated} diagnoses`,
      details: {
        inserted,
        updated,
        skipped,
        total: diagnosesData.length
      }
    })

  } catch (error) {
    console.error("[Diagnosis Upload] Error occurred:", error)
    console.error("[Diagnosis Upload] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to upload diagnoses",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
