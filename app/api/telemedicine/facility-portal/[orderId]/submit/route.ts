import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const results = formData.get('results') as string
    const notes = formData.get('notes') as string
    const files = formData.getAll('files') as File[]

    if (!results || !results.trim()) {
      return NextResponse.json(
        { error: 'Results are required' },
        { status: 400 }
      )
    }

    // Handle file uploads if any
    const uploadedFilePaths: string[] = []
    
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          
          // Create unique filename
          const timestamp = Date.now()
          const fileName = `${timestamp}_${file.name}`
          const filePath = join(process.cwd(), 'public', 'uploads', 'facility-results', fileName)
          
          // Ensure directory exists (you might want to create it first)
          await writeFile(filePath, buffer)
          uploadedFilePaths.push(`/uploads/facility-results/${fileName}`)
        }
      }
    }

    // Try to find and update the order
    let updatedOrder = null

    // Try LAB order first
    const labOrder = await prisma.labOrder.findUnique({
      where: { id: orderId }
    })

    if (labOrder) {
      updatedOrder = await prisma.labOrder.update({
        where: { id: orderId },
        data: {
          results: results,
          notes: notes || labOrder.notes,
          status: 'COMPLETED',
          updated_at: new Date(),
        }
      })
    } else {
      // Try RADIOLOGY order
      const radiologyOrder = await prisma.radiologyOrder.findUnique({
        where: { id: orderId }
      })

      if (radiologyOrder) {
        updatedOrder = await prisma.radiologyOrder.update({
          where: { id: orderId },
          data: {
            results: results,
            notes: notes || radiologyOrder.notes,
            status: 'COMPLETED',
            updated_at: new Date(),
          }
        })
      } else {
        // Try PHARMACY order
        const pharmacyOrder = await prisma.pharmacyOrder.findUnique({
          where: { id: orderId }
        })

        if (pharmacyOrder) {
          updatedOrder = await prisma.pharmacyOrder.update({
            where: { id: orderId },
            data: {
              results: results,
              notes: notes || pharmacyOrder.notes,
              status: 'COMPLETED',
              updated_at: new Date(),
            }
          })
        }
      }
    }

    if (!updatedOrder) {
      console.log('❌ Order not found for update:', orderId)
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // TODO: Send notification to healthcare provider
    // You might want to implement email notification here

    console.log('✅ Results submitted successfully:', {
      orderId: orderId,
      resultsLength: results.length,
      filesUploaded: uploadedFilePaths.length
    })

    return NextResponse.json({
      success: true,
      message: 'Results submitted successfully',
      orderId: orderId,
      uploadedFiles: uploadedFilePaths
    })

  } catch (error) {
    console.error('❌ Error submitting results:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}