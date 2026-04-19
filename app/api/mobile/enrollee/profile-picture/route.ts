import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import { v2 as cloudinary } from 'cloudinary'

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const dependent_id = formData.get('dependent_id') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Identify user type (Principal or Dependent) and Target
    let targetType: 'PRINCIPAL' | 'DEPENDENT' = 'PRINCIPAL';
    let targetId: string = session.id;
    let targetRecord: { id: string, profile_picture: string | null } | null = null;
    
    // 1. Identify current logged-in user and their system user_id
    const loggedInPrincipal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { id: true, user_id: true }
    });

    let systemUserId: string | null = loggedInPrincipal?.user_id || null;

    if (dependent_id) {
      // Logic for principal uploading for their dependent
      if (!loggedInPrincipal) {
        return NextResponse.json({ error: "Only principals can upload photos for dependents" }, { status: 403 })
      }

      const dep = await prisma.dependent.findUnique({
        where: { id: dependent_id },
        select: { id: true, profile_picture: true, principal_id: true }
      });

      if (!dep) {
        return NextResponse.json({ error: "Dependent not found" }, { status: 404 })
      }

      if (dep.principal_id !== session.id) {
        return NextResponse.json({ error: "Access denied. You do not own this dependent." }, { status: 403 })
      }

      targetType = 'DEPENDENT';
      targetId = dependent_id;
      targetRecord = dep;
      // systemUserId remains the principal's user_id
    } else {
      // Logic for self-upload
      const principal = await prisma.principalAccount.findUnique({
        where: { id: session.id },
        select: { id: true, profile_picture: true, user_id: true }
      });

      if (principal) {
        targetType = 'PRINCIPAL';
        targetId = session.id;
        targetRecord = principal;
        systemUserId = principal.user_id;
      } else {
        const dependent = await prisma.dependent.findUnique({
          where: { id: session.id },
          select: { id: true, profile_picture: true, principal: { select: { user_id: true } } }
        });
        if (dependent) {
          targetType = 'DEPENDENT';
          targetId = session.id;
          targetRecord = dependent;
          systemUserId = dependent.principal?.user_id || null;
        }
      }
    }

    if (!targetRecord) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    // One-time constraint
    if (targetRecord.profile_picture) {
      return NextResponse.json({ error: "Profile picture already uploaded. Only one-time upload is allowed." }, { status: 400 })
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
          folder: 'enrollee-profiles',
          public_id: `enrollee-${targetId}`,
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(buffer)
    })

    const url = (uploadResult as any).secure_url

    // Update database
    if (targetType === 'PRINCIPAL') {
      await prisma.principalAccount.update({
        where: { id: targetId },
        data: { profile_picture: url }
      });
    } else {
      await prisma.dependent.update({
        where: { id: targetId },
        data: { profile_picture: url }
      });
    }

    // Create audit log only if we have a valid system user_id
    if (systemUserId) {
      await prisma.auditLog.create({
        data: {
          user_id: systemUserId,
          action: 'ENROLLEE_PROFILE_PICTURE_UPLOAD',
          resource: targetType,
          resource_id: targetId,
          new_values: { profile_picture: url }
        }
      });
    }

    return NextResponse.json({ 
      message: "Profile picture uploaded successfully",
      profile_picture: url
    })

  } catch (error) {
    console.error("[MOBILE_PROFILE_PICTURE_UPLOAD]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
