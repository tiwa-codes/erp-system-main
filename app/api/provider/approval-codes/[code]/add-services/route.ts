import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/provider/approval-codes/[code]/add-services
// Add services to an existing approved approval code
export async function POST(
    request: NextRequest,
    { params }: { params: { code: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { code } = params
        const body = await request.json()
        const { services } = body

        if (!services || !Array.isArray(services) || services.length === 0) {
            return NextResponse.json(
                { error: "Services array is required" },
                { status: 400 }
            )
        }

        // Find the approval code
        const approvalCode = await prisma.approvalCode.findUnique({
            where: { approval_code: code },
            include: {
                provider: true,
            },
        })

        if (!approvalCode) {
            return NextResponse.json(
                { error: "Approval code not found" },
                { status: 404 }
            )
        }

        // Verify the provider owns this approval code
        if (approvalCode.provider_id !== session.user.provider_id) {
            return NextResponse.json(
                { error: "You do not have permission to add services to this approval code" },
                { status: 403 }
            )
        }

        // Approval code must be approved to add services
        if (approvalCode.status !== "APPROVED") {
            return NextResponse.json(
                { error: "Can only add services to approved approval codes" },
                { status: 400 }
            )
        }

        // Calculate total amount for new services
        const totalAmount = services.reduce((sum: number, service: any) => {
            const amount = parseFloat(service.service_amount) || 0
            const quantity = parseInt(service.quantity) || 1
            return sum + (amount * quantity)
        }, 0)

        // Create a provider request for the added services
        const providerRequest = await prisma.providerRequest.create({
            data: {
                provider_id: approvalCode.provider_id,
                enrollee_id: approvalCode.enrollee_id,
                enrollee_name: approvalCode.enrollee_name,
                diagnosis: approvalCode.diagnosis || "",
                admission_required: approvalCode.admission_required || false,
                total_amount: totalAmount,
                status: "PENDING",
                approval_code: approvalCode.approval_code, // Link to existing approval code
                services: services.map((s: any) => s.service_name).join(", "),
                items: {
                    create: services.map((service: any) => ({
                        service_name: service.service_name,
                        service_amount: parseFloat(service.service_amount),
                        quantity: parseInt(service.quantity) || 1,
                        is_ad_hoc: service.is_ad_hoc || false,
                        is_added_after_approval: true, // Mark as added after approval
                        tariff_price: service.tariff_price ? parseFloat(service.tariff_price) : null,
                    })),
                },
            },
            include: {
                items: true,
            },
        })

        return NextResponse.json({
            success: true,
            message: "Services added successfully and sent for approval",
            request: providerRequest,
        })
    } catch (error) {
        console.error("Error adding services to approval code:", error)
        return NextResponse.json(
            { error: "Failed to add services" },
            { status: 500 }
        )
    }
}
