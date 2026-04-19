"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Printer, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface IDCardViewerProps {
  isOpen: boolean
  onClose: () => void
  enrolleeId: string
  enrolleeType: 'principal' | 'dependent'
}

export function IDCardViewer({ isOpen, onClose, enrolleeId, enrolleeType }: IDCardViewerProps) {
  const { toast } = useToast()
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  // Fetch enrollee data for ID card
  const { data: enrolleeData, isLoading } = useQuery({
    queryKey: ["enrollee-id-card", enrolleeId, enrolleeType],
    queryFn: async () => {
      const endpoint = enrolleeType === 'principal' 
        ? `/api/underwriting/principals/${enrolleeId}/id-card`
        : `/api/underwriting/dependents/${enrolleeId}/id-card`
      
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error("Failed to fetch enrollee data")
      return res.json()
    },
    enabled: isOpen && !!enrolleeId
  })

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>ID Card - ${enrolleeData?.name || 'Enrollee'}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .id-card { width: 85.6mm; height: 54mm; border: 1px solid #ccc; margin: 0 auto; }
              @media print {
                body { margin: 0; padding: 0; }
                .id-card { width: 85.6mm; height: 54mm; }
              }
            </style>
          </head>
          <body>
            ${generateIDCardHTML(enrolleeData)}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true)
    try {
      const response = await fetch('/api/id-card/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrolleeId,
          enrolleeType,
          data: enrolleeData
        })
      })

      if (!response.ok) throw new Error('Failed to generate PDF')

      const contentType = response.headers.get("Content-Type") || ""
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const extension = contentType.includes("text/html") ? "html" : "pdf"
      a.download = `ID-Card-${enrolleeData?.name?.replace(/\s+/g, '-') || 'enrollee'}.${extension}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Success",
        description: "ID card downloaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-blue-600">ID Card</span>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="text-lg">Loading ID card data...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-blue-600">ID Card - {enrolleeData?.name || 'Enrollee'}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* ID Card Preview */}
            <div className="flex justify-center">
              <div 
                className="id-card-container"
                dangerouslySetInnerHTML={{ __html: generateIDCardHTML(enrolleeData) }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              <Button onClick={handlePrint} className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Print ID Card
              </Button>
              <Button 
                onClick={handleDownloadPDF} 
                disabled={isGeneratingPDF}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isGeneratingPDF ? "Generating..." : "Download PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function generateIDCardHTML(data: any) {
  if (!data) return '<div>No data available</div>'

  return `
    <style>
      .id-card {
        width: 85.6mm; 
        height: 54mm; 
        background: white; 
        border: 2px solid #333; 
        position: relative;
        font-family: Arial, sans-serif;
        overflow: hidden;
        margin: 10px auto 20px auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border-radius: 8px;
        transform: scale(1.2);
      }
      .id-card-front {
        width: 100%; 
        height: 100%; 
        position: relative;
        background: white;
      }
      .red-banner-top {
        width: 100%; 
        height: 8mm; 
        background: #dc2626; 
        position: absolute; 
        top: 0; 
        left: 0;
        border-radius: 0 0 0 8px;
      }
      .logo-section {
        position: absolute;
        top: 10mm;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
      }
      .logo-crown {
        color: #dc2626; 
        font-size: 10px; 
        font-weight: bold;
      }
      .logo-hmo {
        color: #6b7280; 
        font-size: 14px; 
        font-weight: bold;
      }
      .logo-rc {
        color: #6b7280; 
        font-size: 8px;
      }
      .enrollee-info {
        position: absolute;
        top: 25mm;
        left: 3mm;
        font-size: 8px;
        line-height: 1.4;
        color: #333;
      }
      .photo-placeholder {
        position: absolute;
        top: 25mm;
        right: 3mm;
        width: 15mm;
        height: 18mm;
        border: 1px solid #dc2626;
        background: #f3f4f6;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .photo-icon {
        width: 8mm;
        height: 8mm;
        background: #9ca3af;
        border-radius: 50%;
      }
      .bottom-banner {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 6mm;
        background: #dc2626;
        color: white;
        display: flex;
        align-items: center;
        padding-left: 3mm;
        font-size: 7px;
        font-weight: bold;
      }
      .id-card-back {
        width: 100%;
        height: 100%;
        position: relative;
        background: white;
      }
      .insurance-statement {
        position: absolute;
        top: 5mm;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        font-size: 8px;
        color: #333;
        font-weight: bold;
      }
      .emergency-instructions {
        position: absolute;
        top: 25mm;
        left: 3mm;
        right: 3mm;
        text-align: center;
        font-size: 7px;
        line-height: 1.4;
      }
      .emergency-italic {
        font-style: italic;
        color: #333;
      }
      .emergency-contact {
        color: #333;
        margin-top: 2mm;
        font-weight: bold;
      }
      .transferability {
        position: absolute;
        top: 35mm;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        font-size: 7px;
        font-weight: bold;
        color: #333;
        text-transform: uppercase;
      }
      .authorized-signature {
        position: absolute;
        top: 40mm;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        font-size: 6px;
        color: #333;
        text-transform: uppercase;
        font-weight: bold;
      }
      .qr-code {
        position: absolute;
        bottom: 2mm;
        left: 50%;
        transform: translateX(-50%);
        width: 12mm;
        height: 12mm;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #333;
        border-radius: 2px;
        background: white;
      }
      .qr-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 1px;
      }
    </style>
    
    <!-- Front of ID Card -->
    <div class="id-card">
      <div class="id-card-front">
        <div class="red-banner-top"></div>
        
        <div class="logo-section">
          <div class="logo-crown">Crown Jewel</div>
          <div class="logo-hmo">HMO</div>
          <div class="logo-rc">RC: 2015498</div>
        </div>
        
        <div class="enrollee-info">
          <div><strong>Policy No:</strong> ${data.policy_number || 'CJH/T4/2091'}</div>
          <div><strong>Health Plan:</strong> ${data.plan_name || 'SILVER FAMILY PLAN'}</div>
          <div><strong>Name:</strong> ${data.name || 'N/A'}</div>
          <div><strong>Expiry Date:</strong> Valid within Service</div>
        </div>
        
        <div class="photo-placeholder">
          ${data.profile_picture ? 
            `<img src="${data.profile_picture}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 2px;" />` : 
            '<div class="photo-icon"></div>'
          }
        </div>
        
        <div class="bottom-banner">
          Organization: ${data.organization_name || 'TEAM 4 RECRUITS'}
        </div>
      </div>
    </div>
    
    <!-- Back of ID Card -->
    <div class="id-card">
      <div class="id-card-back">
        <div class="insurance-statement">
          The bearer is medically insured by
        </div>
        
        <div class="logo-section">
          <div class="logo-crown">Crown Jewel</div>
          <div class="logo-hmo">HMO</div>
          <div class="logo-rc">RC: 2015498</div>
        </div>
        
        <div class="emergency-instructions">
          <div class="emergency-italic">
            In case of emergency, medical attention can be given at nearest health facility, 
            and Crown Jewel HMO should be notified within 24 hours on the following number:
          </div>
          <div class="emergency-contact">
            08142997842, 08140747348, info@crownjewelhmo.com
          </div>
        </div>
        
        <div class="transferability">
          THIS CARD IS NOT TRANSFERABLE
        </div>
        
        <div class="authorized-signature">
          AUTHORISED SIGNATURE
        </div>
        
        <div class="qr-code">
          <img 
            class="qr-image" 
            src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.name || 'Enrollee')}-${data.policy_number || 'CJH/T4/2091'}" 
            alt="QR Code"
            onerror="this.style.display='none'"
          />
        </div>
      </div>
    </div>
  `
}
