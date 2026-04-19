import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { enforcePlanUsage } from "@/lib/underwriting/enforcement"
import { z } from "zod"

const submitClaimSchema = z.object({
  principal_id: z.string().min(1, "Principal ID is required"),
  provider_id: z.string().min(1, "Provider ID is required"),
  claim_type: z.enum(["MEDICAL", "DENTAL", "VISION", "PHARMACY"]),
  amount: z.number().min(0, "Amount must be positive"),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to submit claims
    const canSubmitClaims = await checkPermission(session.user.role as any, 'claims', 'add')
    if (!canSubmitClaims) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate request body
    const validatedData = submitClaimSchema.parse(body)

    const enforcement = await enforcePlanUsage({
      principalId: validatedData.principal_id,
      attemptedAmount: validatedData.amount,
    })

    if ("error" in enforcement) {
      return NextResponse.json(
        { success: false, error: enforcement.error },
        { status: enforcement.status }
      )
    }

    if (enforcement.isBlocked) {
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "PLAN_USAGE_BLOCKED",
          resource: "TariffPlan",
          resource_id: enforcement.plan.id,
          new_values: {
            attempted_amount: validatedData.amount,
            total_used: enforcement.totalUsed,
            annual_limit: enforcement.annualLimit,
            warnings: enforcement.warnings,
          },
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: enforcement.warnings[0] || "Plan cannot be used for this claim",
          details: {
            plan_status: enforcement.plan.status,
            total_used: enforcement.totalUsed,
            annual_limit: enforcement.annualLimit,
            warnings: enforcement.warnings,
          },
        },
        { status: 400 }
      )
    }

    // Generate claim number
    const claimCount = await prisma.claim.count()
    const claimNumber = `CLM-${String(claimCount + 1).padStart(6, '0')}`

    // Create the claim
    const claim = await prisma.claim.create({
      data: {
        claim_number: claimNumber,
        enrollee_id: validatedData.principal_id, // Using principal_id as enrollee_id for now
        principal_id: validatedData.principal_id,
        provider_id: validatedData.provider_id,
        claim_type: validatedData.claim_type,
        amount: validatedData.amount,
        original_amount: validatedData.amount, // Set original amount
        status: "SUBMITTED",
        current_stage: 'vetter1', // Start at Vetter 1 stage
        created_by_id: session.user.id,
      },
      include: {
        principal: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            enrollee_id: true,
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true,
          }
        },
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          }
        }
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "CREATE",
        resource: "Claim",
        resource_id: claim.id,
        new_values: {
          message: `Claim ${claimNumber} submitted for ${claim.principal?.first_name || ''} ${claim.principal?.last_name || ''}`.trim(),
        },
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({
      success: true,
      message: "Claim submitted successfully",
      claim,
      planUsage: enforcement.usageSnapshot,
    })

  } catch (error) {
    console.error('Error submitting claim:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit claim' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewClaims = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canViewClaims) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const principalId = searchParams.get('principal_id')
    const providerId = searchParams.get('provider_id')

    // Build where clause
    const where: any = {}
    
    if (status) {
      where.status = status
    }
    
    if (principalId) {
      where.principal_id = principalId
    }
    
    if (providerId) {
      where.provider_id = providerId
    }

    // Fetch submitted claims
    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        include: {
          principal: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              enrollee_id: true,
            }
          },
          provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true,
            }
          },
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.claim.count({ where })
    ])

    return NextResponse.json({
      claims,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching submitted claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submitted claims' },
      { status: 500 }
    )
  }
}
