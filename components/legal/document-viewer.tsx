"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, Printer, ExternalLink } from "lucide-react"

interface DocumentViewerProps {
  fileUrl: string
  title?: string
  className?: string
}

export function DocumentViewer({ fileUrl, title, className }: DocumentViewerProps) {
  const isPDF = fileUrl.toLowerCase().endsWith(".pdf") || fileUrl.includes("pdf")
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl) || fileUrl.includes("image")

  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = fileUrl
    link.download = title || "document"
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    const printWindow = window.open(fileUrl, "_blank")
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {isPDF ? (
            <iframe
              src={fileUrl}
              className="w-full h-[600px] border rounded-lg"
              title={title || "Document Viewer"}
            />
          ) : isImage ? (
            <img
              src={fileUrl}
              alt={title || "Document"}
              className="w-full h-auto rounded-lg border"
            />
          ) : (
            <div className="flex items-center justify-center h-64 border rounded-lg bg-gray-50">
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-500">Preview not available</p>
                <Button variant="outline" size="sm" onClick={() => window.open(fileUrl, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {isPDF && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.open(fileUrl, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

