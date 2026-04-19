import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { uploadFile } from "@/lib/cloudinary"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id
    const formData = await request.formData()
    
    const results = formData.get('results') as string
    const notes = formData.get('notes') as string
    const files = formData.getAll('files') as File[]

    if (!results || !results.trim()) {
      return NextResponse.json({ error: "Results are required" }, { status: 400 })
    }

    // Verify lab order exists and is pending
    const labOrder = await prisma.labOrder.findUnique({
      where: { id: orderId },
      include: {
        appointment: {
          include: {
            enrollee: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                enrollee_id: true
              }
            }
          }
        },
        facility: true
      }
    })

    if (!labOrder) {
      return NextResponse.json({ error: "Lab order not found" }, { status: 404 })
    }

    if (labOrder.status === 'COMPLETED') {
      return NextResponse.json({ error: "Results already submitted" }, { status: 400 })
    }

    // Upload files if any
    let uploadedFiles: string[] = []
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          try {
            const uploadResult = await uploadFile(file, {
              folder: 'lab-results',
              resource_type: 'auto',
              max_bytes: 5 * 1024 * 1024 // 5MB
            })
            uploadedFiles.push(uploadResult.secure_url)
          } catch (error) {
            console.error('File upload error:', error)
            return NextResponse.json(
              { error: `Failed to upload file: ${file.name}` },
              { status: 400 }
            )
          }
        }
      }
    }

    // Prepare results data
    const resultsData: any = {
      status: 'COMPLETED',
      completed_at: new Date(),
      results: results,
      notes: notes || null
    }

    // Add file URLs to notes if files were uploaded
    if (uploadedFiles.length > 0) {
      const fileNote = `\n\nUploaded files:\n${uploadedFiles.map((url, index) => `${index + 1}. ${url}`).join('\n')}`
      resultsData.notes = (resultsData.notes || '') + fileNote
    }

    // Update lab order with results
    const updatedLabOrder = await prisma.labOrder.update({
      where: { id: orderId },
      data: resultsData
    })

    // Update corresponding telemedicine request status
    await prisma.telemedicineRequest.updateMany({
      where: {
        appointment_id: labOrder.appointment_id,
        request_type: 'LAB',
        test_name: labOrder.test_name
      },
      data: {
        status: 'APPROVED',
        updated_at: new Date()
      }
    })

    // Generate unique claim number
    const claimNumber = `CLM-LAB-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

    // Create a claim for the completed lab order
    await prisma.claim.create({
      data: {
        claim_number: claimNumber,
        enrollee_id: labOrder.appointment.enrollee.id,
        provider_id: null, // Telemedicine lab orders don't have traditional providers
        amount: labOrder.amount || 0,
        claim_type: 'TELEMEDICINE_LAB',
        status: 'NEW',
        description: `Lab test: ${labOrder.test_name}`,
        lab_order_id: labOrder.id,
        created_at: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: "Results submitted successfully. Claim created for processing.",
      labOrder: updatedLabOrder
    })
  } catch (error) {
    console.error("Error submitting lab results:", error)
    return NextResponse.json(
      { error: "Failed to submit results" },
      { status: 500 }
    )
  }
}
