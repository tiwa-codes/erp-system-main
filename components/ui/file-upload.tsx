"use client"

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UploadResult, useFileUpload } from '@/hooks/use-file-upload'
import { Upload, X, File, Image } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FileUploadProps {
  onUpload: (files: File[]) => void
  onRemove?: (file: File) => void
  onUploaded?: (results: UploadResult[], files: File[]) => void
  acceptedTypes?: string[]
  maxFiles?: number
  maxSize?: number // in bytes
  folder?: string
  resourceType?: string
  autoUpload?: boolean
  className?: string
  disabled?: boolean
}

export function FileUpload({
  onUpload,
  onRemove,
  onUploaded,
  acceptedTypes = ['image/*', 'application/pdf'],
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  folder = 'erp-uploads',
  resourceType = 'auto',
  autoUpload = false,
  className,
  disabled = false,
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastUploadFilesRef = useRef<File[]>([])
  const { uploadFiles, isUploading } = useFileUpload({ 
    folder, 
    resourceType,
    onSuccess: (results) => {
      onUploaded?.(results, lastUploadFilesRef.current)
    }
  })

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []

    for (const file of fileArray) {
      // Check file size
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`)
        continue
      }

      // Check file type
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1))
        }
        return file.type === type
      })

      if (!isValidType) {
        alert(`File ${file.name} has an invalid type. Accepted types: ${acceptedTypes.join(', ')}`)
        continue
      }

      validFiles.push(file)
    }

    const newFiles = [...selectedFiles, ...validFiles].slice(0, maxFiles)
    setSelectedFiles(newFiles)
    onUpload(newFiles)

    if (autoUpload && validFiles.length > 0) {
      try {
        lastUploadFilesRef.current = validFiles
        await uploadFiles(validFiles)
      } catch (error) {
        // uploadFiles handles toast/error state
      }
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await handleFiles(files)
    }
  }

  const removeFile = (index: number) => {
    const file = selectedFiles[index]
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
    onRemove?.(file)
  }

  const openFileDialog = () => {
    if (disabled) return
    fileInputRef.current?.click()
  }

  const handleManualUpload = async () => {
    if (selectedFiles.length === 0) return
    try {
      lastUploadFilesRef.current = selectedFiles
      await uploadFiles(selectedFiles)
    } catch (error) {
      // uploadFiles handles toast/error state
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />
    }
    return <File className="h-4 w-4" />
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "hover:border-primary hover:bg-primary/5 cursor-pointer"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium">Click to upload or drag and drop</p>
          <p className="text-xs mt-1">
            {acceptedTypes.join(', ')} (max {Math.round(maxSize / 1024 / 1024)}MB each)
          </p>
        </div>
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Selected Files ({selectedFiles.length}/{maxFiles})</Label>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(file)}
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={disabled || isUploading}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {selectedFiles.length > 0 && !autoUpload && (
        <Button
          onClick={handleManualUpload}
          disabled={disabled || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload {selectedFiles.length} file(s)
            </>
          )}
        </Button>
      )}
    </div>
  )
}
