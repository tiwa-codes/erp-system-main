"use client"

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFileUpload } from '@/hooks/use-file-upload'
import { Upload, X, Image } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CompactFileUploadProps {
  onUpload: (files: File[]) => void
  onRemove?: (file: File) => void
  acceptedTypes?: string[]
  maxFiles?: number
  maxSize?: number // in bytes
  folder?: string
  resourceType?: string
  className?: string
  disabled?: boolean
  label?: string
}

export function CompactFileUpload({
  onUpload,
  onRemove,
  acceptedTypes = ['image/*'],
  maxFiles = 1,
  maxSize = 4 * 1024 * 1024, // 4MB
  folder = 'erp-uploads',
  resourceType = 'auto',
  className,
  disabled = false,
  label = "Profile Picture"
}: CompactFileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadFiles, isUploading } = useFileUpload({ folder, resourceType })

  const handleFiles = (files: FileList | File[]) => {
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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-xs font-medium">{label}</Label>

      {/* Compact Upload Area */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openFileDialog}
          disabled={disabled || isUploading}
          className="h-8 px-3 text-xs"
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload a picture
        </Button>

        {selectedFiles.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{selectedFiles[0].name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeFile(0)}
              disabled={disabled || isUploading}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {selectedFiles.length === 0 && (
          <span className="text-xs text-gray-500">No file selected</span>
        )}
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        multiple={maxFiles > 1}
        accept={acceptedTypes.join(',')}
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />
    </div>
  )
}
