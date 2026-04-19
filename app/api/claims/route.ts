import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ClaimStatus, ClaimType, RateType } from "@prisma/client"
import { convertCurrencyAndLock } from "@/lib/currency"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const provider = searchParams.get('provider') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { claim_number: { contains: search, mode: 'insensitive' } },
        { enrollee_id: { contains: search, mode: 'insensitive' } },
        { principal: { 
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } }
          ]
        }},
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status) {
      where.status = status as ClaimStatus
    }

    if (provider) {
      where.provider_id = provider
    }

    if (startDate || endDate) {
      where.submitted_at = {}
      if (startDate) {
        where.submitted_at.gte = new Date(startDate)
      }
      if (endDate) {
        where.submitted_at.lte = new Date(endDate)
      }
    }

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        include: {
          principal: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              enrollee_id: true
            }
          },
          provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true
            }
          },
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: { submitted_at: 'desc' },
        skip,
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
    console.error('Error fetching claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAdd = await checkPermission(session.user.role as any, 'claims', 'add')
    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      enrollee_id,
      principal_id,
      provider_id,
      claim_type,
      amount,
      description,
      supporting_documents
    } = body

    if (!enrollee_id || !provider_id || !claim_type || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate unique claim number
    const claimNumber = `CLM/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Date.now()).slice(-6)}`

    const claimAmount = parseFloat(amount)
    let originalCurrency = "NGN"
    let originalAmountForeign: number | null = null
    let exchangeRateUsed: number | null = null
    let exchangeRateDate: Date | null = null
    let exchangeRateId: string | null = null
    let convertedAmount = claimAmount

    // Fetch enrollee and provider details for audit trail
    const [enrolleeData, providerData] = await Promise.all([
      prisma.enrollee.findUnique({
        where: { id: enrollee_id },
        select: { first_name: true, last_name: true }
      }),
      prisma.provider.findUnique({
        where: { id: provider_id },
        select: { facility_name: true, provider_id: true }
      })
    ])

    // Check if provider is foreign (SpecialProvider)
    if (provider_id && providerData) {
      // Check if there's a SpecialProvider with matching numeric provider_id
      const specialProvider = await prisma.specialProvider.findFirst({
        where: {
          provider_id: providerData.provider_id,
          status: "APPROVED",
        },
      })

      if (specialProvider && specialProvider.currency !== "NGN") {
        originalCurrency = specialProvider.currency
        originalAmountForeign = claimAmount

        // Get exchange rate
        const rateType = RateType.MID_MARKET // Default to mid-market, can be configured
        const conversion = await convertCurrencyAndLock(
          claimAmount,
          specialProvider.currency,
          "NGN",
          rateType
        )

        if (conversion) {
          convertedAmount = conversion.convertedAmount
          exchangeRateUsed = conversion.rate
          exchangeRateDate = new Date()
          exchangeRateId = conversion.rateId
        } else {
          // If conversion fails, log error but continue with original amount
          console.error(
            `Failed to convert currency for claim ${claimNumber}. Provider currency: ${specialProvider.currency}`
          )
        }
      }
    }

    const newClaim = await prisma.claim.create({
      data: {
        claim_number: claimNumber,
        enrollee_id,
        principal_id: principal_id || null,
        provider_id,
        claim_type: claim_type as ClaimType,
        amount: convertedAmount, // Use converted amount in NGN
        original_amount: originalAmountForeign || claimAmount, // Original amount (foreign or NGN)
        original_currency: originalCurrency,
        original_amount_foreign: originalAmountForeign,
        exchange_rate_used: exchangeRateUsed,
        exchange_rate_date: exchangeRateDate,
        exchange_rate_id: exchangeRateId,
        status: ClaimStatus.SUBMITTED,
        current_stage: 'vetter1', // Start at Vetter 1 stage
        created_by_id: session.user.id,
      },
    })

    // Create a synthetic ApprovalCode for audit trail purposes
    // This ensures the claim can be audited even if it wasn't created through the normal approval flow
    const enrolleeName = enrolleeData 
      ? `${enrolleeData.first_name} ${enrolleeData.last_name}`
      : 'Unknown'
    const providerName = providerData?.facility_name || 'Unknown Provider'
    
    const approvalCodeRecord = await prisma.approvalCode.create({
      data: {
        approval_code: `AUTO-${newClaim.claim_number}`,
        enrollee_id,
        enrollee_name: enrolleeName,
        hospital: providerName,
        services: description || 'Direct Claim Submission',
        amount: convertedAmount,
        status: 'APPROVED',
        claim_id: newClaim.id,
        is_manual: true,
        is_deleted: false,
        generated_by_id: session.user.id,
        provider_id: provider_id || null,
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_CREATE',
        resource: 'claim',
        resource_id: newClaim.id,
        new_values: newClaim,
      },
    })

    return NextResponse.json({ ...newClaim, approval_code_id: approvalCodeRecord.id }, { status: 201 })
  } catch (error) {
    console.error('Error creating claim:', error)
    return NextResponse.json(
      { error: 'Failed to create claim' },
      { status: 500 }
    )
  }
}
