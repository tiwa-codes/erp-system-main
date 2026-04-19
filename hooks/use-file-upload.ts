import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface UploadResult {
  public_id: string
  secure_url: string
  format: string
  width: number
  height: number
  bytes: number
}

export interface UseFileUploadOptions {
  folder?: string
  resourceType?: string
  onSuccess?: (results: UploadResult[]) => void
  onError?: (error: string) => void
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  const uploadFiles = async (files: File[]): Promise<UploadResult[]> => {
    if (!files || files.length === 0) {
      throw new Error('No files provided')
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      
      // Add files to form data
      files.forEach(file => {
        formData.append('files', file)
      })

      // Add options
      if (options.folder) {
        formData.append('folder', options.folder)
      }
      if (options.resourceType) {
        formData.append('resourceType', options.resourceType)
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      if (!data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      const results = data.data as UploadResult[]

      toast({
        title: 'Upload Successful',
        description: `${files.length} file(s) uploaded successfully`,
        variant: 'default',
      })

      options.onSuccess?.(results)
      return results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      })

      options.onError?.(errorMessage)
      throw error
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const uploadSingleFile = async (file: File): Promise<UploadResult> => {
    const results = await uploadFiles([file])
    return results[0]
  }

  return {
    uploadFiles,
    uploadSingleFile,
    isUploading,
    uploadProgress,
  }
}
