import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be smaller than 5 MB" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "erp-procurement",
            resource_type: "auto",
            public_id: `invoice_${Date.now()}_${file.name.replace(/\s+/g, "_")}`,
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        )
        .end(buffer)
    })

    return NextResponse.json({ url: result.secure_url, name: file.name, size: file.size })
  } catch (error) {
    console.error("[procurement-upload] POST error:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
