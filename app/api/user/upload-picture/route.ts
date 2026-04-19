import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { v2 as cloudinary } from 'cloudinary'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('profilePicture') as File

    if (!file) {
      return NextResponse.json({ 
        error: 'No file provided' 
      }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ 
        error: 'File must be an image' 
      }, { status: 400 })
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size must be less than 5MB' 
      }, { status: 400 })
    }

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'erp-profiles',
          public_id: `profile-${session.user.id}-${Date.now()}`,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(buffer)
    })

    const profilePictureUrl = (uploadResult as any).secure_url
    // Update user profile picture using raw query to avoid TypeScript issues
    await prisma.$executeRaw`
      UPDATE "users" 
      SET profile_picture = ${profilePictureUrl}, updated_at = NOW() 
      WHERE id = ${session.user.id}
    `

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROFILE_PICTURE_UPDATE',
        resource: 'user',
        resource_id: session.user.id,
        old_values: { profile_picture_updated: true },
        new_values: { profile_picture: profilePictureUrl }
      }
    })

    return NextResponse.json({ 
      message: 'Profile picture updated successfully',
      profile_picture: profilePictureUrl
    })
  } catch (error) {
    console.error('Error uploading profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    )
  }
}
