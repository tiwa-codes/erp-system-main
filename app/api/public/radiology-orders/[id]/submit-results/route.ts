import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id
    const formData = await request.formData()
    
    const submissionType = formData.get('submissionType') as string
    const results = formData.get('results') as string
    const findings = formData.get('findings') as string
    const recommendations = formData.get('recommendations') as string
    const notes = formData.get('notes') as string
    const pdfFile = formData.get('pdf') as File

    // Verify radiology order exists and is pending
    const radiologyOrder = await prisma.radiologyOrder.findUnique({
      where: { id: orderId },
      include: {
        appointment: {
          include: {
            enrollee: {
              select: {
                first_name: true,
                last_name: true,
                enrollee_id: true
              }
            }
          }
        }
      }
    })

    if (!radiologyOrder) {
      return NextResponse.json({ error: "Radiology order not found" }, { status: 404 })
    }

    if (radiologyOrder.status === 'COMPLETED') {
      return NextResponse.json({ error: "Results already submitted" }, { status: 400 })
    }

    // Prepare results data
    const resultsData: any = {
      status: 'COMPLETED',
      completed_at: new Date()
    }

    if (submissionType === 'form') {
      resultsData.results = results
      resultsData.findings = findings || null
      resultsData.recommendations = recommendations || null
      resultsData.notes = notes || null
    } else if (submissionType === 'pdf' && pdfFile) {
      // Handle PDF upload - you might want to upload to cloud storage
      // For now, we'll store the file name
      resultsData.pdf_report = pdfFile.name
      resultsData.results = `PDF Report: ${pdfFile.name}`
    }

    // Update radiology order with results
    const updatedRadiologyOrder = await prisma.radiologyOrder.update({
      where: { id: orderId },
      data: resultsData
    })

    // Create audit log
    await createAuditLog({
      userId: 'system', // Public submission
      action: "RADIOLOGY_RESULTS_SUBMIT",
      resource: "radiology_order",
      resourceId: orderId,
      newValues: {
        submissionType,
        results: submissionType === 'form' ? results : `PDF: ${pdfFile?.name}`,
        findings,
        recommendations,
        notes,
        patientId: radiologyOrder.appointment.enrollee.enrollee_id
      }
    })

    return NextResponse.json({
      success: true,
      message: "Results submitted successfully",
      radiologyOrder: updatedRadiologyOrder
    })
  } catch (error) {
    console.error("Error submitting radiology results:", error)
    return NextResponse.json(
      { error: "Failed to submit results" },
      { status: 500 }
    )
  }
}
