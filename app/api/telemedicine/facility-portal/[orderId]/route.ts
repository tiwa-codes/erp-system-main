import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - Retrieve order details for facility portal
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params

    // Try to find the order in all three tables
    let order = await prisma.labOrder.findUnique({
      where: { id: orderId },
      include: {
        appointment: {
          include: {
            enrollee: {
              select: {
                id: true,
                enrollee_id: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                email: true,
                date_of_birth: true,
                gender: true,
                residential_address: true,
              }
            }
          }
        },
        facility: {
          select: {
            id: true,
            facility_name: true,
            email: true,
            phone_number: true,
          }
        }
      }
    })

    let orderType = 'LAB'

    if (!order) {
      order = await prisma.radiologyOrder.findUnique({
        where: { id: orderId },
        include: {
          appointment: {
            include: {
              enrollee: {
                select: {
                  id: true,
                  enrollee_id: true,
                  first_name: true,
                  last_name: true,
                  phone_number: true,
                  email: true,
                  date_of_birth: true,
                  gender: true,
                }
              }
            }
          },
          facility: {
            select: {
              id: true,
              facility_name: true,
              email: true,
              phone_number: true,
            }
          }
        }
      })
      orderType = 'RADIOLOGY'
    }

    if (!order) {
      order = await prisma.pharmacyOrder.findUnique({
        where: { id: orderId },
        include: {
          appointment: {
            include: {
              enrollee: {
                select: {
                  id: true,
                  enrollee_id: true,
                  first_name: true,
                  last_name: true,
                  phone_number: true,
                  email: true,
                  date_of_birth: true,
                  gender: true,
                  residential_address: true,
                }
              }
            }
          },
          facility: {
            select: {
              id: true,
              facility_name: true,
              email: true,
              phone_number: true,
            }
          }
        }
      })
      orderType = 'PHARMACY'
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        type: orderType,
        test_name: order.test_name || order.medication,
        amount: order.amount || 0,
        status: order.status,
        created_at: order.created_at,
        notes: order.notes || '',
        results: order.results || '',
        delivery_address: (order as any).delivery_address || null,
        enrollee: order.appointment?.enrollee,
        facility: order.facility,
        generated_by: {
          first_name: order.requested_by || 'Unknown',
          last_name: ''
        },
      }
    })

  } catch (error) {
    console.error("Error fetching order details:", error)
    return NextResponse.json(
      { error: "Failed to fetch order details" },
      { status: 500 }
    )
  }
}

// POST - Update order with results and mark as complete
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params
    const formData = await request.formData()
    const results = formData.get('results') as string
    const notes = formData.get('notes') as string
    const status = formData.get('status') as string || 'COMPLETED'
    const files = formData.getAll('files') as File[]

    if (!results && !notes) {
      return NextResponse.json({ 
        error: "Results or notes are required" 
      }, { status: 400 })
    }

    // Handle file uploads (for now, we'll store file info in notes)
    let fileInfo = ""
    if (files && files.length > 0) {
      fileInfo = `\n\nUploaded Files:\n`
      files.forEach((file, index) => {
        fileInfo += `${index + 1}. ${file.name} (${(file.size / 1024).toFixed(1)} KB)\n`
      })
    }

    const finalNotes = notes + fileInfo

    // Try to update the order in all three tables
    let updatedOrder = null

    // Try Lab Order first
    try {
      updatedOrder = await prisma.labOrder.update({
        where: { id: orderId },
        data: {
          results: results || '',
          notes: finalNotes || '',
          status: status as any,
          completed_at: status === 'COMPLETED' ? new Date() : null,
          updated_at: new Date()
        },
        include: {
          enrollee: {
            select: {
              id: true,
              enrollee_id: true,
              first_name: true,
              last_name: true,
            }
          },
          facility: {
            select: {
              id: true,
              facility_name: true,
            }
          }
        }
      })

      // Create claim for completed lab order
      if (status === 'COMPLETED' && updatedOrder) {
        await prisma.claim.create({
          data: {
            enrollee_id: updatedOrder.enrollee_id,
            provider_id: updatedOrder.facility_id,
            claim_type: 'TELEMEDICINE_LAB',
            amount: updatedOrder.amount || 0,
            description: `Lab test: ${updatedOrder.test_name}`,
            status: 'NEW',
            lab_order_id: updatedOrder.id,
            created_at: new Date(),
            updated_at: new Date()
          }
        })
      }

    } catch (error) {
      // Try Radiology Order
      try {
        updatedOrder = await prisma.radiologyOrder.update({
          where: { id: orderId },
          data: {
            results: results || '',
            notes: finalNotes || '',
            status: status as any,
            completed_at: status === 'COMPLETED' ? new Date() : null,
            updated_at: new Date()
          },
          include: {
            enrollee: {
              select: {
                id: true,
                enrollee_id: true,
                first_name: true,
                last_name: true,
              }
            },
            facility: {
              select: {
                id: true,
                facility_name: true,
              }
            }
          }
        })

        // Create claim for completed radiology order
        if (status === 'COMPLETED' && updatedOrder) {
          await prisma.claim.create({
            data: {
              enrollee_id: updatedOrder.enrollee_id,
              provider_id: updatedOrder.facility_id,
              claim_type: 'TELEMEDICINE_RADIOLOGY',
              amount: updatedOrder.amount || 0,
              description: `Radiology test: ${updatedOrder.test_name}`,
              status: 'NEW',
              radiology_order_id: updatedOrder.id,
              created_at: new Date(),
              updated_at: new Date()
            }
          })
        }

      } catch (error) {
        // Try Pharmacy Order
        try {
          updatedOrder = await prisma.pharmacyOrder.update({
            where: { id: orderId },
            data: {
              notes: finalNotes || '',
              status: status as any,
              completed_at: status === 'COMPLETED' ? new Date() : null,
              updated_at: new Date()
            },
            include: {
              enrollee: {
                select: {
                  id: true,
                  enrollee_id: true,
                  first_name: true,
                  last_name: true,
                }
              },
              facility: {
                select: {
                  id: true,
                  facility_name: true,
                }
              }
            }
          })

          // Create claim for completed pharmacy order
          if (status === 'COMPLETED' && updatedOrder) {
            await prisma.claim.create({
              data: {
                enrollee_id: updatedOrder.enrollee_id,
                provider_id: updatedOrder.facility_id,
                claim_type: 'TELEMEDICINE_PHARMACY',
                amount: updatedOrder.amount || 0,
                description: `Pharmacy order: ${updatedOrder.medication}`,
                status: 'NEW',
                pharmacy_order_id: updatedOrder.id,
                created_at: new Date(),
                updated_at: new Date()
              }
            })
          }

        } catch (error) {
          return NextResponse.json({ 
            error: "Order not found or could not be updated" 
          }, { status: 404 })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
      order: updatedOrder,
      claimCreated: status === 'COMPLETED'
    })

  } catch (error) {
    console.error("Error updating order:", error)
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    )
  }
}
