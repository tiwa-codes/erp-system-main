import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view underwriting data
    const canView = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { enrolleeId, enrolleeType, data } = await request.json()

    if (!enrolleeId || !enrolleeType || !data) {
      return NextResponse.json({ 
        error: 'Missing required data' 
      }, { status: 400 })
    }

    // Generate HTML for PDF
    const htmlContent = generateIDCardHTML(data)

    // For now, return the HTML content
    // In production, you would use a library like puppeteer or jsPDF
    // to generate actual PDF content
    
    const response = new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="ID-Card-${data.name?.replace(/\s+/g, '-') || 'enrollee'}.html"`
      }
    })

    return response
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

function generateIDCardHTML(data: any) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>ID Card - ${data.name || 'Enrollee'}</title>
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: Arial, sans-serif;
          background: #f5f5f5;
        }
        .id-card {
          width: 85.6mm;
          height: 54mm;
          background: white;
          border: 1px solid #ddd;
          margin: 10px auto;
          position: relative;
          font-family: Arial, sans-serif;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
          font-size: 8px;
          font-weight: bold;
        }
        .logo-hmo {
          color: #6b7280;
          font-size: 12px;
          font-weight: bold;
        }
        .logo-rc {
          color: #6b7280;
          font-size: 6px;
        }
        .enrollee-info {
          position: absolute;
          top: 25mm;
          left: 3mm;
          font-size: 6px;
          line-height: 1.2;
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
          font-size: 5px;
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
          font-size: 6px;
          color: black;
        }
        .emergency-instructions {
          position: absolute;
          top: 25mm;
          left: 3mm;
          right: 3mm;
          text-align: center;
          font-size: 5px;
          line-height: 1.3;
        }
        .emergency-italic {
          font-style: italic;
          color: black;
        }
        .emergency-contact {
          color: black;
          margin-top: 2mm;
        }
        .transferability {
          position: absolute;
          top: 35mm;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          font-size: 5px;
          font-weight: bold;
          color: black;
          text-transform: uppercase;
        }
        .authorized-signature {
          position: absolute;
          top: 40mm;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          font-size: 4px;
          color: black;
          text-transform: uppercase;
        }
        .qr-code {
          position: absolute;
          bottom: 2mm;
          left: 50%;
          transform: translateX(-50%);
          width: 8mm;
          height: 8mm;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 3px;
        }
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .id-card { margin: 5px auto; box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <!-- Front of ID Card -->
      <div class="id-card">
        <div class="id-card-front">
          <div class="red-banner-top"></div>
          
          <div class="logo-section">
            <div class="logo-crown">Aspirage</div>
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
            <div class="photo-icon"></div>
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
            <div class="logo-crown">Aspirage</div>
            <div class="logo-hmo">HMO</div>
            <div class="logo-rc">RC: 2015498</div>
          </div>
          
          <div class="emergency-instructions">
            <div class="emergency-italic">
              In case of emergency, medical attention can be given at nearest health facility, 
              and Aspirage should be notified within 24 hours on the following number:
            </div>
            <div class="emergency-contact">
              08142997842, 08140747348, info@aspirage.com
            </div>
          </div>
          
          <div class="transferability">
            THIS CARD IS NOT TRANSFERABLE
          </div>
          
          <div class="authorized-signature">
            AUTHORISED SIGNATURE
          </div>
          
          <div class="qr-code">
            QR
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}
