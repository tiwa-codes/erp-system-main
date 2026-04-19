import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import * as XLSX from 'xlsx'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, 'telemedicine', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: facilityId } = params

    // Verify facility exists
    const facility = await prisma.telemedicineFacility.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        facility_name: true,
        facility_type: true
      }
    })

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Determine service category based on facility type
    let serviceCategory: string
    switch (facility.facility_type) {
      case 'LAB':
        serviceCategory = 'Laboratory Services'
        break
      case 'RADIOLOGY':
        serviceCategory = 'Radiology / Imaging'
        break
      case 'PHARMACY':
        serviceCategory = 'Drugs / Pharmaceuticals'
        break
      default:
        serviceCategory = 'General Services'
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Read the Excel file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (data.length < 2) {
      return NextResponse.json(
        { error: "File must contain at least a header row and one data row" },
        { status: 400 }
      )
    }

    // Get headers and normalize them
    const headers = (data[0] as string[]).map(h => String(h || '').trim().toLowerCase())
    
    // Find column indices - flexible matching
    const serviceNameIndex = headers.findIndex(h => 
      h.includes('service') && (h.includes('name') || h.includes('service'))
    )
    const priceIndex = headers.findIndex(h => 
      h.includes('price') || h.includes('amount') || h.includes('cost')
    )

    if (serviceNameIndex === -1 || priceIndex === -1) {
      return NextResponse.json(
        { 
          error: "Missing required columns. Expected: 'Service Name' (or 'Service') and 'Price' (or 'Amount')",
          found: data[0]
        },
        { status: 400 }
      )
    }

    // Process data rows
    const services = []
    const errors = []

    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      
      if (!row || row.length === 0) continue

      try {
        const serviceName = String(row[serviceNameIndex] || '').trim()
        const price = parseFloat(String(row[priceIndex] || '0').replace(/[^0-9.]/g, ''))

        // Validate required fields
        if (!serviceName || serviceName.length === 0) {
          errors.push(`Row ${i + 1}: Missing service name`)
          continue
        }

        if (isNaN(price) || price <= 0) {
          errors.push(`Row ${i + 1}: Invalid price (${row[priceIndex]})`)
          continue
        }

        services.push({
          service_name: serviceName,
          price: price
        })

      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    if (errors.length > 0 && services.length === 0) {
      return NextResponse.json(
        { 
          error: "Validation errors found",
          errors: errors.slice(0, 10), // Limit to first 10 errors
          totalErrors: errors.length
        },
        { status: 400 }
      )
    }

    if (services.length === 0) {
      return NextResponse.json(
        { error: "No valid services found in file" },
        { status: 400 }
      )
    }

    // Process each service: find or create ServiceType, then create/update FacilityTariff
    let successCount = 0
    let errorCount = 0
    const processedServices = []
    let serviceCounter = 0 // Counter to ensure unique IDs even in same millisecond

    for (const service of services) {
      try {
        // Small delay to ensure different timestamps (especially important for batch processing)
        if (serviceCounter > 0) {
          await new Promise(resolve => setTimeout(resolve, 1)) // 1ms delay between services
        }
        serviceCounter++

        // Find existing service by name (case-insensitive)
        let serviceType = await prisma.serviceType.findFirst({
          where: {
            service_name: { equals: service.service_name, mode: 'insensitive' },
            service_category: serviceCategory
          }
        })

        // If service doesn't exist, create it
        if (!serviceType) {
          // Generate a unique service_id using timestamp + counter + random to guarantee uniqueness
          // Counter ensures uniqueness even if timestamp is the same
          const generateUniqueServiceId = () => {
            const timestamp = Date.now()
            const counter = serviceCounter.toString().padStart(4, '0')
            const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
            // Add microsecond-like precision with random component
            const unique = `${timestamp}${counter}${random}`
            return unique
          }

          let serviceId = generateUniqueServiceId()
          let attempts = 0
          const maxAttempts = 5

          // Try to create with unique timestamp-based ID
          while (attempts < maxAttempts) {
            try {
              // Check if ID already exists
              const exists = await prisma.serviceType.findUnique({
                where: { service_id: serviceId }
              })
              
              if (!exists) {
                // Try to create the service
                serviceType = await prisma.serviceType.create({
                  data: {
                    service_id: serviceId,
                    service_name: service.service_name,
                    service_category: serviceCategory
                  }
                })
                break // Success, exit loop
              } else {
                // ID exists, generate new one with new timestamp/counter
                attempts++
                await new Promise(resolve => setTimeout(resolve, 1)) // Small delay
                serviceId = generateUniqueServiceId()
              }
            } catch (createError: any) {
              if (createError.code === 'P2002') {
                // Unique constraint violation - generate new ID and retry
                attempts++
                if (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 1)) // Small delay
                  serviceId = generateUniqueServiceId()
                  continue // Retry with new ID
                } else {
                  // After max attempts, check if service was created by another process
                  serviceType = await prisma.serviceType.findFirst({
                    where: {
                      service_name: { equals: service.service_name, mode: 'insensitive' },
                      service_category: serviceCategory
                    }
                  })
                  
                  if (!serviceType) {
                    // Last resort: use more random ID with current timestamp
                    await new Promise(resolve => setTimeout(resolve, 2))
                    serviceId = `${Date.now()}${serviceCounter}${Math.random().toString(36).substring(2, 11)}${Math.random().toString(36).substring(2, 8)}`
                    try {
                      serviceType = await prisma.serviceType.create({
                        data: {
                          service_id: serviceId,
                          service_name: service.service_name,
                          service_category: serviceCategory
                        }
                      })
                    } catch (finalError: any) {
                      // If still fails, throw error
                      throw new Error(`Failed to create service "${service.service_name}" after ${maxAttempts} attempts. Last error: ${finalError.message}`)
                    }
                  }
                  break
                }
              } else {
                throw createError
              }
            }
          }
        }

        // Create or update FacilityTariff
        await prisma.facilityTariff.upsert({
          where: {
            facility_id_service_id: {
              facility_id: facilityId,
              service_id: serviceType.id
            }
          },
          update: {
            price: service.price,
            updated_at: new Date()
          },
          create: {
            facility_id: facilityId,
            service_id: serviceType.id,
            price: service.price
          }
        })

        successCount++
        processedServices.push({
          service_name: service.service_name,
          price: service.price,
          service_id: serviceType.id
        })

      } catch (error) {
        console.error(`Error processing service "${service.service_name}":`, error)
        errorCount++
        errors.push(`"${service.service_name}": ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TELEMEDICINE_FACILITY_TARIFF_BULK_UPLOAD",
        resource: "facility_tariff",
        resource_id: facilityId,
        new_values: {
          facility_name: facility.facility_name,
          successCount,
          errorCount,
          totalServices: services.length,
          services: processedServices.slice(0, 10) // Log first 10 services
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${successCount} of ${services.length} services`,
      facility: {
        id: facility.id,
        facility_name: facility.facility_name
      },
      stats: {
        total: services.length,
        success: successCount,
        errors: errorCount
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      services: processedServices.slice(0, 10) // Return first 10 services as preview
    })

  } catch (error) {
    console.error("Error processing tariff plan bulk upload:", error)
    return NextResponse.json(
      { error: "Failed to process bulk upload", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

