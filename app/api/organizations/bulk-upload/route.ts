import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAdd = await checkPermission(session.user.role as any, 'underwriting', 'add')
    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read Excel file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const organizations = XLSX.utils.sheet_to_json(worksheet)

    if (!organizations || !Array.isArray(organizations)) {
      return NextResponse.json({ error: 'Invalid organizations data' }, { status: 400 })
    }

    const results = {
      success: [],
      errors: [],
      duplicates: []
    }

    for (let i = 0; i < organizations.length; i++) {
      const organization = organizations[i]
      const rowNumber = i + 1

      try {
        // Validate required fields
        if (!organization.name || !organization.code || !organization.type) {
          results.errors.push({
            row: rowNumber,
            error: 'Missing required fields: name, code, type'
          })
          continue
        }

        // Validate organization code format (must be exactly 2 uppercase letters)
        if (!/^[A-Z]{2}$/.test(organization.code)) {
          results.errors.push({
            row: rowNumber,
            error: 'Organization code must be exactly 2 uppercase letters (e.g., TB, AB, CD)'
          })
          continue
        }

        // Check if organization code already exists
        const existingOrg = await prisma.organization.findFirst({
          where: { code: organization.code }
        })

        if (existingOrg) {
          results.duplicates.push({
            row: rowNumber,
            code: organization.code,
            message: 'Organization code already exists'
          })
          continue
        }

        // Check if organization name already exists
        const existingName = await prisma.organization.findFirst({
          where: { name: { equals: organization.name, mode: 'insensitive' } }
        })

        if (existingName) {
          results.duplicates.push({
            row: rowNumber,
            name: organization.name,
            message: 'Organization name already exists'
          })
          continue
        }

        // Prepare contact info
        const contactInfo = {
          contactPerson: organization.contact_person || null,
          contactNumber: organization.phone || null,
          email: organization.email || null,
          headOfficeAddress: organization.address || null,
          registrationNumber: organization.registration_number || null
        }

        // Generate unique organization_id
        const lastOrganization = await prisma.organization.findFirst({
          orderBy: { organization_id: 'desc' }
        })
        
        const nextOrganizationId = lastOrganization 
          ? (parseInt(lastOrganization.organization_id) + 1).toString()
          : '1'

        // Create organization
        const newOrganization = await prisma.organization.create({
          data: {
            organization_id: nextOrganizationId,
            name: organization.name,
            code: organization.code.toUpperCase(),
            type: organization.type,
            contact_info: contactInfo,
            status: 'ACTIVE'
          }
        })

        // Create audit log
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: 'BULK_CREATE_ORGANIZATION',
            resource: 'organization',
            resource_id: newOrganization.id,
            new_values: {
              name: newOrganization.name,
              code: newOrganization.code,
              type: newOrganization.type
            }
          }
        })

        results.success.push({
          row: rowNumber,
          name: newOrganization.name,
          code: newOrganization.code
        })

      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error)
        results.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk upload completed. ${results.success.length} successful, ${results.errors.length} errors, ${results.duplicates.length} duplicates`,
      processedCount: results.success.length,
      data: results.success,
      results
    })

  } catch (error) {
    console.error('Error in bulk upload:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk upload' },
      { status: 500 }
    )
  }
}
