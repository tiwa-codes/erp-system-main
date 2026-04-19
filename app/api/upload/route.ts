import { NextRequest, NextResponse } from 'next/server'
import { uploadFile, uploadMultipleFiles } from '@/lib/cloudinary'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const folder = formData.get('folder') as string || 'erp-uploads'
    const resourceType = formData.get('resourceType') as string || 'auto'

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      )
    }

    // Validate file types and sizes
    // Accept all image types (image/*) to support HEIC, HEIF, and other device-specific formats
    const maxSize = 10 * 1024 * 1024 // 10MB

    for (const file of files) {
      // Check if it's an image or PDF
      const isImage = file.type.startsWith('image/')
      const isPDF = file.type === 'application/pdf'

      if (!isImage && !isPDF) {
        return NextResponse.json(
          { success: false, error: `File type ${file.type} not allowed. Only images and PDFs are accepted.` },
          { status: 400 }
        )
      }

      if (file.size > maxSize) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} exceeds maximum size of 10MB` },
          { status: 400 }
        )
      }
    }

    // Upload files
    const uploadOptions = {
      folder,
      resource_type: resourceType as 'image' | 'video' | 'raw' | 'auto',
    }

    let results
    if (files.length === 1) {
      const result = await uploadFile(files[0], uploadOptions)
      results = [result]
    } else {
      results = await uploadMultipleFiles(files, uploadOptions)
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `${files.length} file(s) uploaded successfully`,
    })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
