import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Radiology order ID is required' },
        { status: 400 }
      )
    }

    console.log('📝 Submitting radiology results for order:', id)

    const formData = await request.formData()
    const results = formData.get('results') as string
    const notes = formData.get('notes') as string
    const files = formData.getAll('files') as File[]

    if (!results || !results.trim()) {
      return NextResponse.json(
        { error: 'Radiology results are required' },
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
          const fileName = `radiology_${timestamp}_${file.name}`
          const filePath = join(process.cwd(), 'public', 'uploads', 'facility-results', fileName)
          
          await writeFile(filePath, buffer)
          uploadedFilePaths.push(`/uploads/facility-results/${fileName}`)
        }
      }
    }

    // Update radiology order with results
    const updatedRadiologyOrder = await prisma.radiologyOrder.update({
      where: { id: id },
      data: {
        results: results,
        notes: notes,
        status: 'COMPLETED',
        updated_at: new Date(),
      }
    })

    if (!updatedRadiologyOrder) {
      console.log('❌ Radiology order not found for update:', id)
      return NextResponse.json(
        { error: 'Radiology order not found' },
        { status: 404 }
      )
    }

    console.log('✅ Radiology results submitted successfully:', {
      orderId: id,
      resultsLength: results.length,
      filesUploaded: uploadedFilePaths.length
    })

    return NextResponse.json({
      success: true,
      message: 'Radiology results submitted successfully',
      orderId: id,
      uploadedFiles: uploadedFilePaths
    })

  } catch (error) {
    console.error('❌ Error submitting radiology results:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}