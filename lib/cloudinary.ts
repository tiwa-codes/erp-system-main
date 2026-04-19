import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface UploadResult {
  public_id: string
  secure_url: string
  format: string
  width: number
  height: number
  bytes: number
}

export interface UploadOptions {
  folder?: string
  transformation?: any
  resource_type?: 'image' | 'video' | 'raw' | 'auto'
  allowed_formats?: string[]
  max_bytes?: number
}

/**
 * Upload a file to Cloudinary
 */
export async function uploadFile(
  file: File | Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const {
      folder = 'erp-uploads',
      transformation = {},
      resource_type = 'auto',
      // Remove allowed_formats restriction to accept all image types (HEIC, HEIF, etc.)
      // Cloudinary will handle format conversion automatically
      max_bytes = 10 * 1024 * 1024, // 10MB default
    } = options

    // Convert File to buffer if needed
    let buffer: Buffer
    let fileName = 'unknown'
    let fileType = 'unknown'

    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
      fileName = file.name
      fileType = file.type

      // No file extension validation - accept all image formats
      // Cloudinary will handle unsupported formats gracefully
    } else {
      buffer = file
    }

    // Validate file size
    if (buffer.length > max_bytes) {
      throw new Error(`File size exceeds maximum allowed size of ${Math.round(max_bytes / (1024 * 1024))}MB`)
    }

    // Validate buffer is not empty
    if (buffer.length === 0) {
      throw new Error('File is empty')
    }

    // Upload to Cloudinary
    const result = await new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type,
          // Don't restrict formats - let Cloudinary handle all image types
          transformation,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error)
            // Handle specific Cloudinary errors
            if (error.http_code === 400) {
              reject(new Error(`Invalid file format or corrupted file. Please try a different image.`))
            } else if (error.http_code === 413) {
              reject(new Error(`File too large. Maximum size is ${Math.round(max_bytes / (1024 * 1024))}MB`))
            } else {
              reject(new Error(`Upload failed: ${error.message || 'Unknown error'}`))
            }
          } else if (result) {
            resolve({
              public_id: result.public_id,
              secure_url: result.secure_url,
              format: result.format,
              width: result.width || 0,
              height: result.height || 0,
              bytes: result.bytes,
            })
          } else {
            reject(new Error('Upload failed: No result returned'))
          }
        }
      )

      // Handle stream errors
      uploadStream.on('error', (error) => {
        console.error('Upload stream error:', error)
        reject(new Error(`Upload stream failed: ${error.message}`))
      })

      uploadStream.end(buffer)
    })

    return result
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Upload multiple files to Cloudinary
 */
export async function uploadMultipleFiles(
  files: File[],
  options: UploadOptions = {}
): Promise<UploadResult[]> {
  try {
    const uploadPromises = files.map(file => uploadFile(file, options))
    const results = await Promise.all(uploadPromises)
    return results
  } catch (error) {
    console.error('Multiple file upload error:', error)
    throw new Error(`Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Delete a file from Cloudinary
 */
export async function deleteFile(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error('Cloudinary delete error:', error)
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Delete multiple files from Cloudinary
 */
export async function deleteMultipleFiles(publicIds: string[]): Promise<void> {
  try {
    await cloudinary.api.delete_resources(publicIds)
  } catch (error) {
    console.error('Multiple file delete error:', error)
    throw new Error(`Failed to delete files: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get file information from Cloudinary
 */
export async function getFileInfo(publicId: string): Promise<any> {
  try {
    const result = await cloudinary.api.resource(publicId)
    return result
  } catch (error) {
    console.error('Get file info error:', error)
    throw new Error(`Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate a signed upload URL for client-side uploads
 */
export function generateSignedUploadUrl(
  folder: string = 'erp-uploads',
  resourceType: string = 'auto'
): { uploadUrl: string; signature: string; timestamp: number } {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000)
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
        resource_type: resourceType,
      },
      process.env.CLOUDINARY_API_SECRET!
    )

    const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`

    return {
      uploadUrl,
      signature,
      timestamp,
    }
  } catch (error) {
    console.error('Generate signed URL error:', error)
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Transform an image URL
 */
export function transformImageUrl(
  publicId: string,
  transformations: any = {}
): string {
  try {
    return cloudinary.url(publicId, transformations)
  } catch (error) {
    console.error('Transform image URL error:', error)
    throw new Error(`Failed to transform image URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export default cloudinary
