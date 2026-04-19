import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has telemedicine permissions
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { 
      results, 
      amount, 
      completed_by,
      notes 
    } = body

    if (!results) {
      return NextResponse.json({ 
        error: "Results are required" 
      }, { status: 400 })
    }

    // Find the lab order with appointment and enrollee details
    const labOrder = await prisma.labOrder.findUnique({
      where: { id },
      include: {
        appointment: {
          include: {
            enrollee: {
              select: {
                id: true,
                enrollee_id: true,
                first_name: true,
                last_name: true,
                plan: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        },
        facility: {
          select: {
            id: true,
            facility_name: true
          }
        }
      }
    })

    if (!labOrder) {
      return NextResponse.json({ 
        error: "Lab order not found" 
      }, { status: 404 })
    }

    if (labOrder.status === 'COMPLETED') {
      return NextResponse.json({ 
        error: "Lab order is already completed" 
      }, { status: 400 })
    }

    // Use amount from request body, or fallback to order amount, or 0
    const finalAmount = amount ? parseFloat(amount) : (labOrder.amount ? Number(labOrder.amount) : 0)
    
    if (finalAmount <= 0) {
      return NextResponse.json({ 
        error: "Amount is required and must be greater than 0. Please provide amount or ensure order has a valid amount." 
      }, { status: 400 })
    }

    // Update lab order status to completed
    const updatedLabOrder = await prisma.labOrder.update({
      where: { id },
      data: {
        status: 'APPROVED', // Use APPROVED instead of COMPLETED for ProviderRequestStatus
        results: results,
        amount: finalAmount,
        completed_by: completed_by || 'Facility',
        notes: notes || null,
        completed_at: new Date()
      }
    })

    // Update corresponding telemedicine request status
    await prisma.telemedicineRequest.updateMany({
      where: {
        appointment_id: labOrder.appointment_id,
        request_type: 'LAB',
        test_name: labOrder.test_name
      },
      data: {
        status: 'APPROVED', // Use APPROVED instead of COMPLETED for ProviderRequestStatus
        updated_at: new Date()
      }
    })

    // Generate unique claim number
    const claimNumber = `CLM-TEL-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

    // Create automatic claim for monthly processing
    const newClaim = await prisma.claim.create({
      data: {
        claim_number: claimNumber,
        enrollee_id: labOrder.appointment.enrollee.enrollee_id,
        principal_id: labOrder.appointment.enrollee.id,
        provider_id: labOrder.facility.id,
        claim_type: 'TELEMEDICINE_LAB',
        amount: finalAmount,
        original_amount: finalAmount, // Set original amount
        status: 'NEW', // Start as NEW for monthly processing
        current_stage: null, // NEW claims don't have a stage yet
        submitted_at: new Date(),
        created_by_id: session.user.id,
        description: `Telemedicine Lab Order: ${labOrder.test_name}`,
        // Link to the lab order
        lab_order_id: labOrder.id
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "LAB_ORDER_COMPLETED",
        resource: "lab_order",
        resource_id: labOrder.id,
        old_values: labOrder,
        new_values: updatedLabOrder
      }
    })

    // Create audit log for claim creation
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "CLAIM_CREATED_FROM_TELEMEDICINE",
        resource: "claim",
        resource_id: newClaim.id,
        new_values: newClaim
      }
    })

    return NextResponse.json({
      success: true,
      lab_order: updatedLabOrder,
      claim: {
        id: newClaim.id,
        claim_number: newClaim.claim_number,
        status: newClaim.status,
        amount: newClaim.amount
      },
      message: "Lab order completed successfully. EHR request updated and claim created for monthly processing."
    }, { status: 200 })

  } catch (error) {
    console.error("Error completing lab order:", error)
    return NextResponse.json(
      { error: "Failed to complete lab order" },
      { status: 500 }
    )
  }
}
