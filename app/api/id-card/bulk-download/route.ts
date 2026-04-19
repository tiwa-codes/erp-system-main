import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import JSZip from 'jszip'

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

    const { organizationId } = await request.json()

    if (!organizationId) {
      return NextResponse.json({ 
        error: 'Missing organization ID' 
      }, { status: 400 })
    }

    // Fetch organization
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { 
        id: true, 
        name: true, 
        code: true 
      }
    })

    if (!organization) {
      return NextResponse.json({ 
        error: 'Organization not found' 
      }, { status: 404 })
    }

    // Fetch all principals for this organization
    const principals = await prisma.principalAccount.findMany({
      where: { 
        organization_id: organizationId,
        status: 'ACTIVE'
      },
      include: {
        organization: true,
        plan: true
      },
      orderBy: { enrollee_id: 'asc' }
    })

    // Fetch all dependents for this organization
    const dependents = await prisma.dependent.findMany({
      where: {
        principal: {
          organization_id: organizationId
        },
        status: 'ACTIVE'
      },
      include: {
        principal: {
          include: {
            organization: true,
            plan: true
          }
        }
      },
      orderBy: { dependent_id: 'asc' }
    })

    if (principals.length === 0 && dependents.length === 0) {
      return NextResponse.json({ 
        error: 'No active enrollees found for this organization' 
      }, { status: 404 })
    }

    // Create a new ZIP file
    const zip = new JSZip()

    // Add principals' ID cards to ZIP
    for (const principal of principals) {
      const idCardData = {
        type: 'principal',
        name: `${principal.first_name} ${principal.last_name}`,
        enrolleeId: principal.enrollee_id,
        organization: principal.organization?.name || '',
        plan: principal.plan?.name || '',
        dateOfBirth: principal.date_of_birth ? new Date(principal.date_of_birth).toLocaleDateString() : '',
        gender: principal.gender || '',
        phoneNumber: principal.phone_number || '',
        email: principal.email || '',
        address: principal.residential_address || '',
        profilePicture: principal.profile_picture || '',
        startDate: principal.start_date ? new Date(principal.start_date).toLocaleDateString() : '',
        endDate: principal.end_date ? new Date(principal.end_date).toLocaleDateString() : '',
        primaryHospital: principal.primary_hospital || ''
      }

      const htmlContent = generateIDCardHTML(idCardData)
      const fileName = `${principal.enrollee_id.replace(/\//g, '-')}_${principal.first_name}_${principal.last_name}.html`
      zip.file(fileName, htmlContent)
    }

    // Add dependents' ID cards to ZIP
    for (const dependent of dependents) {
      const idCardData = {
        type: 'dependent',
        name: `${dependent.first_name} ${dependent.last_name}`,
        enrolleeId: dependent.dependent_id,
        organization: dependent.principal?.organization?.name || '',
        plan: dependent.principal?.plan?.name || '',
        dateOfBirth: dependent.date_of_birth ? new Date(dependent.date_of_birth).toLocaleDateString() : '',
        gender: dependent.gender || '',
        phoneNumber: dependent.phone_number || '',
        email: dependent.email || '',
        address: dependent.residential_address || '',
        profilePicture: dependent.profile_picture || '',
        relationship: dependent.relationship || '',
        principalName: `${dependent.principal?.first_name} ${dependent.principal?.last_name}`,
        principalId: dependent.principal?.enrollee_id || ''
      }

      const htmlContent = generateIDCardHTML(idCardData)
      const fileName = `${dependent.dependent_id.replace(/\//g, '-')}_${dependent.first_name}_${dependent.last_name}.html`
      zip.file(fileName, htmlContent)
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    })

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="ID_Cards_${organization.code || organization.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip"`
      }
    })

  } catch (error) {
    console.error('Error generating bulk ID cards:', error)
    return NextResponse.json(
      { error: 'Failed to generate bulk ID cards' },
      { status: 500 }
    )
  }
}

function generateIDCardHTML(data: any) {
  const isDependent = data.type === 'dependent'
  
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        .logo {
          font-size: 18px;
          font-weight: bold;
          color: white;
        }
        .enrollee-type {
          background: rgba(255, 255, 255, 0.2);
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }
        .profile-section {
          display: flex;
          gap: 15px;
          margin-bottom: 10px;
        }
        .profile-image {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          flex-shrink: 0;
        }
        .profile-info {
          flex: 1;
        }
        .enrollee-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 3px;
          text-transform: uppercase;
        }
        .enrollee-id {
          font-size: 13px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 3px;
          display: inline-block;
          margin-bottom: 5px;
        }
        .info-row {
          font-size: 9px;
          margin-bottom: 2px;
          display: flex;
          gap: 5px;
        }
        .info-label {
          font-weight: 600;
          opacity: 0.9;
        }
        .info-value {
          opacity: 0.95;
        }
        .card-footer {
          position: absolute;
          bottom: 10px;
          left: 15px;
          right: 15px;
          font-size: 8px;
          opacity: 0.8;
          border-top: 1px solid rgba(255, 255, 255, 0.3);
          padding-top: 5px;
        }
        @media print {
          body {
            background: white;
            padding: 0;
            margin: 0;
          }
          .id-card {
            margin: 0;
            box-shadow: none;
            page-break-after: always;
          }
        }
      </style>
    </head>
    <body>
      <div class="id-card">
        <div class="id-card-front">
          <div class="card-header">
            <div class="logo">Crown Jewel HMO</div>
            <div class="enrollee-type">${isDependent ? 'DEPENDENT' : 'PRINCIPAL'}</div>
          </div>
          
          <div class="profile-section">
            <div class="profile-image">
              ${data.profilePicture ? `<img src="${data.profilePicture}" alt="${data.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" />` : data.name.charAt(0)}
            </div>
            <div class="profile-info">
              <div class="enrollee-name">${data.name || 'N/A'}</div>
              <div class="enrollee-id">${data.enrolleeId || 'N/A'}</div>
              <div class="info-row">
                <span class="info-label">Organization:</span>
                <span class="info-value">${data.organization || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Plan:</span>
                <span class="info-value">${data.plan || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          <div style="font-size: 9px; margin-top: 8px;">
            <div class="info-row">
              <span class="info-label">DOB:</span>
              <span class="info-value">${data.dateOfBirth || 'N/A'}</span>
              <span class="info-label" style="margin-left: 10px;">Gender:</span>
              <span class="info-value">${data.gender || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span class="info-value">${data.phoneNumber || 'N/A'}</span>
            </div>
            ${isDependent ? `
            <div class="info-row">
              <span class="info-label">Relationship:</span>
              <span class="info-value">${data.relationship || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Principal:</span>
              <span class="info-value">${data.principalName || 'N/A'} (${data.principalId || 'N/A'})</span>
            </div>
            ` : `
            <div class="info-row">
              <span class="info-label">Hospital:</span>
              <span class="info-value">${data.primaryHospital || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Valid:</span>
              <span class="info-value">${data.startDate || 'N/A'} - ${data.endDate || 'N/A'}</span>
            </div>
            `}
          </div>
          
          <div class="card-footer">
            <div>Emergency: +234 123 456 7890 | support@crownjewelhmo.com</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}
