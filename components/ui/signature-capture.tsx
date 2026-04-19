"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useFileUpload } from "@/hooks/use-file-upload"
import { X, Save } from "lucide-react"

interface SignatureCaptureProps {
  onSave: (signatureImageUrl: string, signatureData?: any) => void
  onCancel?: () => void
  disabled?: boolean
}

export function SignatureCapture({ onSave, onCancel, disabled = false }: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const { uploadSingleFile, isUploading: isFileUploading } = useFileUpload({
    folder: "legal-signatures",
    resourceType: "auto",
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = 600
    canvas.height = 200

    // Set drawing styles
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled || isUploading) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setIsDrawing(true)
    setHasSignature(true)

    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || isUploading) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    setIsUploading(true)

    try {
      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsUploading(false)
          return
        }

        try {
          // Convert blob to File
          const file = new File([blob], `signature-${Date.now()}.png`, { type: "image/png" })

          // Upload to Cloudinary
          const result = await uploadSingleFile(file)

          // Get signature data (optional, for storing drawing path)
          const signatureData = {
            width: canvas.width,
            height: canvas.height,
            timestamp: new Date().toISOString(),
          }

          onSave(result.secure_url, signatureData)
          setIsUploading(false)
        } catch (error) {
          console.error("Error uploading signature:", error)
          setIsUploading(false)
        }
      }, "image/png")
    } catch (error) {
      console.error("Error saving signature:", error)
      setIsUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Digital Signature</CardTitle>
        <CardDescription>Draw your signature in the box below</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full cursor-crosshair touch-none"
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={clearSignature}
            variant="outline"
            disabled={!hasSignature || disabled || isUploading}
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasSignature || disabled || isUploading || isFileUploading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isUploading || isFileUploading ? "Saving..." : "Save Signature"}
          </Button>
          {onCancel && (
            <Button onClick={onCancel} variant="outline" disabled={isUploading || isFileUploading}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

