import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import * as XLSX from "xlsx"

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
        if (!hasPermission) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const providerId = formData.get('providerId') as string

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            )
        }

        if (!providerId) {
            return NextResponse.json(
                { error: "Provider ID is required" },
                { status: 400 }
            )
        }

        // Validate Excel file type
        const validMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ]

        if (!validMimeTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "Only Excel files (.xlsx, .xls) are allowed" },
                { status: 400 }
            )
        }

        // Create upload directory if it doesn't exist
        // Create upload directory in the persistent uploads/ folder
        const uploadDir = path.join(process.cwd(), 'uploads', 'tariff-files')
        await mkdir(uploadDir, { recursive: true })

        // Generate unique filename
        const timestamp = Date.now()
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = `${providerId}_${timestamp}_${sanitizedFileName}`
        const filePath = path.join(uploadDir, fileName)

        // Save file to disk
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        await writeFile(filePath, buffer)

        const parsed = parseTariffWorkbook(bytes)
        if (parsed.error) {
            return NextResponse.json(parsed.error, { status: 400 })
        }

        if (!parsed.services.length) {
            return NextResponse.json(
                { error: "No valid services found in the uploaded file" },
                { status: 400 }
            )
        }

        await replaceProviderTariffServices(providerId, parsed.services)
        const servicesCount = parsed.services.length


        // Save or update file record in database
        const tariffFile = await prisma.providerTariffFile.upsert({
            where: { provider_id: providerId },
            create: {
                provider_id: providerId,
                file_name: file.name,
                file_path: filePath,
                file_size: file.size,
                mime_type: file.type,
                uploaded_by: session.user.id
            },
            update: {
                file_name: file.name,
                file_path: filePath,
                file_size: file.size,
                mime_type: file.type,
                uploaded_at: new Date(),
                uploaded_by: session.user.id
            }
        })

        // Audit logging should not fail the primary upload flow.
        try {
            await prisma.auditLog.create({
                data: {
                    user_id: session.user.id,
                    action: "TARIFF_FILE_UPLOAD",
                    resource: "provider_tariff_files",
                    resource_id: tariffFile.id,
                    new_values: {
                        provider_id: providerId,
                        file_name: file.name,
                        file_size: file.size,
                        services_count: servicesCount
                    },
                },
            })
        } catch (auditError) {
            console.error("Tariff file uploaded but audit log failed:", auditError)
        }

        return NextResponse.json({
            success: true,
            message: "Tariff file uploaded successfully",
            servicesCount,
            file: {
                id: tariffFile.id,
                file_name: tariffFile.file_name,
                uploaded_at: tariffFile.uploaded_at
            }
        })

    } catch (error) {
        console.error("Error uploading tariff file:", error)
        return NextResponse.json(
            { error: "Failed to upload tariff file", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

type ParsedTariffService = {
    service_id: string
    service_name: string
    category_id: string
    category_name: string
    price: number
    service_type: number | null
    status: string
}

function parseTariffWorkbook(buffer: ArrayBuffer): { services: ParsedTariffService[]; error?: any } {
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (data.length < 2) {
        return {
            services: [],
            error: { error: "File must contain at least a header row and one data row" },
        }
    }

    const headers = data[0] as string[]
    const headerMap: Record<string, number> = {}
    headers.forEach((header, index) => {
        const normalizedHeader = String(header || "").trim().toLowerCase()
        headerMap[normalizedHeader] = index
    })

    const serviceNameIndex = headerMap["service name"] ?? headerMap["service_name"] ?? 0
    const servicePriceIndex = headerMap["service price"] ?? headerMap["service_price"] ?? headerMap["price"] ?? 1
    const categoryIdIndex = headerMap["category id"] ?? headerMap["category_id"] ?? 2
    const serviceTypeIndex = headerMap["service type"] ?? headerMap["service_type"] ?? 3

    const services: ParsedTariffService[] = []
    for (let i = 1; i < data.length; i++) {
        const row = data[i]
        if (!row || row.length === 0) continue

        const serviceName = String(row[serviceNameIndex] || "").trim()
        if (!serviceName) continue

        const categoryId = row[categoryIdIndex] ? String(row[categoryIdIndex]).trim() : ""
        const price = Number(row[servicePriceIndex]) || 0
        const serviceTypeValue = row[serviceTypeIndex] ? String(row[serviceTypeIndex]).trim() : ""
        const serviceType = serviceTypeValue === "1" ? 1 : null
        const serviceId = serviceName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")

        const validCategories = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "15", "17", "18", "19", "21", "22", "23", "24"]
        const finalCategoryId = categoryId && validCategories.includes(categoryId) ? categoryId : "10"

        services.push({
            service_id: serviceId,
            service_name: serviceName,
            category_id: finalCategoryId,
            category_name: getCategoryName(finalCategoryId),
            price,
            service_type: serviceType,
            status: "ACTIVE",
        })
    }

    return { services }
}

async function replaceProviderTariffServices(providerId: string, services: ParsedTariffService[]) {
    if (!services.length) {
        throw new Error("Cannot replace tariff services with an empty payload")
    }

    await prisma.$transaction(async (tx) => {
        const latestPlan = await tx.tariffPlan.findFirst({
            where: { provider_id: providerId },
            orderBy: { created_at: "desc" },
        })

        const editableStatuses = ["DRAFT", "REJECTED", "IN_PROGRESS"]
        const requiresNewVersion = !latestPlan || !editableStatuses.includes((latestPlan.status || "").toUpperCase())

        const tariffPlan = requiresNewVersion
            ? await tx.tariffPlan.create({
                data: {
                    provider_id: providerId,
                    status: "DRAFT",
                    version: latestPlan ? latestPlan.version + 1 : 1,
                },
            })
            : latestPlan

        await tx.tariffPlanService.deleteMany({ where: { provider_id: providerId } })
        await tx.tariffPlanService.createMany({
            data: services.map((service) => ({
                ...service,
                provider_id: providerId,
                tariff_plan_id: tariffPlan.id,
                is_draft: true,
            })),
            skipDuplicates: true,
        })
    })
}

function getCategoryName(categoryId: string): string {
    const categories: Record<string, string> = {
        "1": "Admission",
        "2": "Caesarian section / Normal Delivery",
        "3": "Fertility",
        "4": "Advanced Diagnostic Imaging",
        "5": "Physiotherapy",
        "6": "Surgery",
        "7": "Cancer Care",
        "8": "Dialysis",
        "9": "Specialist Consultation",
        "10": "Others",
        "11": "Optical Care",
        "12": "Dental Care",
        "15": "Advanced Lab",
        "17": "ICU",
        "18": "Neonate Care",
        "19": "Mental Care",
        "21": "MRI",
        "22": "CT-SCAN",
        "23": "Accommodation for In-Patient Care",
        "24": "Drugs",
    }
    return categories[categoryId] || "Others"
}
