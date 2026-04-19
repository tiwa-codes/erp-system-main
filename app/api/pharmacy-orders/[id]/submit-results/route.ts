import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Decimal } from "@prisma/client/runtime/library"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // Handle both JSON and FormData requests
    const contentType = request.headers.get('content-type') || ''
    let notes = ''
    let files: File[] = []
    
    if (contentType.includes('application/json')) {
      // Handle JSON request
      const body = await request.json()
      notes = body.notes || ''
      files = body.files || []
    } else {
      // Handle FormData request
      const formData = await request.formData()
      notes = formData.get('notes') as string || ''
      files = formData.getAll('files') as File[]
    }

    // Check if pharmacy order exists
    const pharmacyOrder = await prisma.pharmacyOrder.findUnique({
      where: { id },
      include: {
        appointment: {
          include: {
            enrollee: {
              select: {
                id: true,
                enrollee_id: true,
                first_name: true,
                last_name: true
              }
            }
          }
        },
        facility: {
          select: {
            id: true
          }
        }
      }
    })

    if (!pharmacyOrder) {
      return NextResponse.json({ error: "Pharmacy order not found" }, { status: 404 })
    }

    if (pharmacyOrder.status === 'COMPLETED') {
      // Allow re-completion for testing purposes
    }

    // Process uploaded files
    let fileData = []
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          return NextResponse.json({ 
            error: `File ${file.name} is too large. Maximum size is 5MB.` 
          }, { status: 400 })
        }
        
        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        
        fileData.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64
        })
      }
    }

    // Find all pending orders from the same appointment and facility
    const pendingOrders = await prisma.pharmacyOrder.findMany({
      where: {
        appointment_id: pharmacyOrder.appointment_id,
        facility_id: pharmacyOrder.facility_id,
        status: 'PENDING'
      }
    })

    // Update ALL pending pharmacy orders from the same appointment and facility
    const updatedOrders = await prisma.pharmacyOrder.updateMany({
      where: {
        appointment_id: pharmacyOrder.appointment_id,
        facility_id: pharmacyOrder.facility_id,
        status: 'PENDING'
      },
      data: {
        status: 'COMPLETED',
        notes: notes || 'Medication dispensed successfully',
        completed_at: new Date(),
        // Store file information in notes or create a separate field
        results: JSON.stringify({
          notes: notes || 'Medication dispensed successfully',
          files: fileData,
          completed_at: new Date().toISOString()
        })
      }
    })

    // Fetch the updated order to return
    const updatedPharmacyOrder = await prisma.pharmacyOrder.findUnique({
      where: { id }
    })

    if (!updatedPharmacyOrder) {
      return NextResponse.json({ error: "Pharmacy order not found after update" }, { status: 404 })
    }

    // Use the pending orders list we fetched earlier (they're now completed)
    const allCompletedOrders = pendingOrders

    // Update corresponding TelemedicineRequest status for all completed orders
    try {
      for (const order of allCompletedOrders) {
        await prisma.telemedicineRequest.updateMany({
          where: {
            appointment_id: order.appointment_id,
            request_type: 'PHARMACY',
            test_name: order.medication
          },
          data: {
            status: 'APPROVED',
            updated_at: new Date()
          }
        })
      }
    } catch (telemedicineError) {
      // Continue execution as this is not critical
    }

    // Create claims for all completed orders that don't have claims yet
    const createdClaimIds = []
    if (!pharmacyOrder.appointment.enrollee) {
    } else {
      for (const order of allCompletedOrders) {
        // Check if claim already exists for this pharmacy order
        const existingClaim = await prisma.claim.findFirst({
          where: {
            pharmacy_order_id: order.id
          }
        })

        if (existingClaim) {
          createdClaimIds.push(existingClaim.id)
        } else {
          try {
            // Generate unique claim number
            const claimNumber = `CLM-TEL-PHARM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
            
            const claim = await prisma.claim.create({
              data: {
                claim_number: claimNumber,
                enrollee_id: pharmacyOrder.appointment.enrollee.enrollee_id,
                principal_id: pharmacyOrder.appointment.enrollee.id,
                provider_id: order.facility_id,
                claim_type: 'TELEMEDICINE_PHARMACY',
                amount: order.amount ? new Decimal(order.amount.toString()) : new Decimal(0),
                status: 'NEW',
                description: `Pharmacy order: ${order.medication} - ${order.dose || 'N/A'}${order.quantity ? ` (Qty: ${order.quantity})` : ''}`,
                pharmacy_order_id: order.id,
                created_at: new Date()
              }
            })
            
            createdClaimIds.push(claim.id)
          } catch (claimError) {
            // Don't fail the pharmacy order completion if claim creation fails
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: updatedOrders.count > 1 
        ? `${updatedOrders.count} pharmacy orders completed successfully`
        : "Pharmacy order completed successfully",
      pharmacyOrder: updatedPharmacyOrder,
      completedOrdersCount: updatedOrders.count,
      claimIds: createdClaimIds
    })

  } catch (error) {
    console.error("Error completing pharmacy order:", error)
    return NextResponse.json(
      { error: "Failed to complete pharmacy order" },
      { status: 500 }
    )
  }
}
