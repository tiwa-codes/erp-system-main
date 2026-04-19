import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { generateDailyApprovalCode } from "@/lib/approval-code"
import { enforcePlanUsage } from "@/lib/underwriting/enforcement"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { is_deleted: false }
    
    if (search) {
      where.OR = [
        { approval_code: { contains: search, mode: "insensitive" } },
        { enrollee_name: { contains: search, mode: "insensitive" } },
        { hospital: { contains: search, mode: "insensitive" } },
        { services: { contains: search, mode: "insensitive" } },
      ]
    }

    const [approvalCodes, total] = await Promise.all([
      prisma.approvalCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          enrollee: {
            select: {
              id: true,
              enrollee_id: true,
              first_name: true,
              last_name: true
            }
          },
          generated_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true
            }
          }
        }
      }),
      prisma.approvalCode.count({ where })
    ])

    // Format approval codes
    const formattedApprovalCodes = approvalCodes.map(code => ({
      id: code.id,
      approval_code: code.approval_code,
      generated_by: code.generated_by ? 
        `${code.generated_by.first_name} ${code.generated_by.last_name}` : 
        'System',
      hospital: code.hospital,
      services: code.services,
      amount: code.amount,
      status: code.status,
      date: code.created_at,
      enrollee_id: code.enrollee?.enrollee_id,
      enrollee_name: code.enrollee ? 
        `${code.enrollee.first_name} ${code.enrollee.last_name}` : 
        code.enrollee_name
    }))

    return NextResponse.json({
      success: true,
      approval_codes: formattedApprovalCodes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching approval codes:", error)
    return NextResponse.json(
      { error: "Failed to fetch approval codes" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      enrollee_id,
      enrollee_name,
      primary_provider,
      plan,
      services,
      amount,
      diagnosis,
      diagnosis_not_on_list
    } = body

    if (!enrollee_id || !services) {
      return NextResponse.json({ error: "Enrollee ID and services are required" }, { status: 400 })
    }

    // Find enrollee
    const enrollee = await prisma.principalAccount.findFirst({
      where: { enrollee_id },
      include: {
        organization: true,
        plan: true
      }
    })

    if (!enrollee) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    const requestedAmount = parseFloat(amount) || 0
    const enforcement = await enforcePlanUsage({
      principalId: enrollee.id,
      attemptedAmount: requestedAmount,
    })

    if ("error" in enforcement) {
      return NextResponse.json({ error: enforcement.error }, { status: enforcement.status })
    }

    if (enforcement.isBlocked) {
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "APPROVAL_CODE_CREATE_BLOCKED",
          resource: "approval_code",
          resource_id: enrollee.id,
          new_values: {
            reason: enforcement.warnings,
            attempted_amount: requestedAmount,
            annual_limit: enforcement.annualLimit,
            total_used: enforcement.totalUsed,
          },
        },
      })

      return NextResponse.json(
        {
          error: enforcement.warnings[0] || "Annual limit has been exhausted. Cannot approve this request.",
          details: {
            annual_limit: enforcement.annualLimit,
            total_used: enforcement.totalUsed,
            warnings: enforcement.warnings,
          },
        },
        { status: 400 }
      )
    }

    // Find provider
    const provider = await prisma.provider.findFirst({
      where: { facility_name: { contains: primary_provider, mode: "insensitive" } }
    })

    // Generate approval code in format APR/CJH/YYYYMMDDNN
    const approvalCode = await generateDailyApprovalCode(prisma)

    const approvalCodeRecord = await prisma.approvalCode.create({
      data: {
        approval_code: approvalCode,
        enrollee_id: enrollee.id,
        enrollee_name: enrollee_name || `${enrollee.first_name} ${enrollee.last_name}`,
        hospital: provider?.facility_name || primary_provider,
        services: services,
        amount: parseFloat(amount) || 0,
        diagnosis: diagnosis || diagnosis_not_on_list,
        status: 'PENDING',
        generated_by_id: session.user.id
      },
      include: {
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        generated_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "APPROVAL_CODE_CREATE",
        resource: "approval_code",
        resource_id: approvalCodeRecord.id,
        new_values: approvalCodeRecord
      }
    })

    // 🚀 AUTOMATIC CLAIM CREATION FOR PROVIDER-GENERATED APPROVAL CODES
    // When provider generates approval code (primary services), automatically create claim
    try {
      console.log('📝 Creating claim for provider-generated approval code...')
      
      // Generate unique claim number
      const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
      
      // Get user's provider_id
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { provider_id: true }
      })
      
      if (!user?.provider_id) {
        console.error('❌ User does not have provider_id assigned')
        throw new Error('User is not associated with a provider')
      }
      
      // 💰 CALCULATE TOTAL FROM SERVICE ITEMS - Fix for Issue #2
      // Get all service items linked to this approval code
      const serviceItems = await prisma.approvalCodeService.findMany({
        where: { approval_code_id: approvalCodeRecord.id }
      })
      
      // Calculate total: SUM(service_amount × quantity)
      const calculatedAmount = serviceItems.reduce((sum, service) => {
        return sum + (Number(service.service_amount) * Number(service.quantity || 1))
      }, 0)
      
      console.log('💰 Calculated claim amount from service items:', {
        approval_code: approvalCodeRecord.approval_code,
        service_count: serviceItems.length,
        calculated_amount: calculatedAmount,
        stored_amount: amount
      })
      
      // Create claim with NEW status using calculated amount
      const newClaim = await prisma.claim.create({
        data: {
          claim_number: claimNumber,
          enrollee_id: approvalCodeRecord.enrollee.enrollee_id,
          principal_id: approvalCodeRecord.enrollee_id,
          provider_id: user.provider_id,
          claim_type: 'MEDICAL',
          amount: calculatedAmount,
          original_amount: calculatedAmount,
          status: 'NEW', // Provider-generated claims start as NEW
          current_stage: null, // NEW claims don't have a stage yet
          submitted_at: new Date(),
          created_by_id: session.user.id,
        }
      })
      
      console.log('✅ Claim created for provider approval code:', newClaim.id, newClaim.claim_number)
      
      // Link the approval code to the claim
      await prisma.approvalCode.update({
        where: { id: approvalCodeRecord.id },
        data: {
          claim_id: newClaim.id
        }
      })
      
      console.log('✅ Approval code linked to claim')
    } catch (error) {
      console.error('❌ Failed to create claim for provider approval code:', error)
      console.error('Claim creation error details:', {
        error: error instanceof Error ? error.message : String(error),
        enrollee_id: approvalCodeRecord.enrollee.enrollee_id,
        amount: amount
      })
      // Don't fail the request if claim creation fails
      // The approval code was already created successfully
    }

    return NextResponse.json({
      success: true,
      approval_code: {
        id: approvalCodeRecord.id,
        approval_code: approvalCodeRecord.approval_code,
        generated_by: `${approvalCodeRecord.generated_by.first_name} ${approvalCodeRecord.generated_by.last_name}`,
        hospital: approvalCodeRecord.hospital,
        services: approvalCodeRecord.services,
        amount: approvalCodeRecord.amount,
        status: approvalCodeRecord.status,
        date: approvalCodeRecord.created_at,
        enrollee_id: approvalCodeRecord.enrollee.enrollee_id,
        enrollee_name: `${approvalCodeRecord.enrollee.first_name} ${approvalCodeRecord.enrollee.last_name}`
      }
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating approval code:", error)
    return NextResponse.json(
      { error: "Failed to create approval code" },
      { status: 500 }
    )
  }
}
