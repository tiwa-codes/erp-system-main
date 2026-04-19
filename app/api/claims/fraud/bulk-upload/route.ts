import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

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
    const { flaggedClaims } = body

    if (!flaggedClaims || !Array.isArray(flaggedClaims)) {
      return NextResponse.json({ error: 'Invalid flagged claims data' }, { status: 400 })
    }

    const results = {
      success: [],
      errors: [],
      duplicates: []
    }

    for (let i = 0; i < flaggedClaims.length; i++) {
      const claim = flaggedClaims[i]
      const rowNumber = i + 1

      try {
        // Validate required fields
        if (!claim.claim_number || !claim.provider_id || !claim.amount || !claim.risk_score) {
          results.errors.push({
            row: rowNumber,
            error: 'Missing required fields: claim_number, provider_id, amount, risk_score'
          })
          continue
        }

        // Check if flagged claim already exists
        const existingClaim = await prisma.claim.findUnique({
          where: { claim_number: claim.claim_number }
        })

        if (existingClaim) {
          results.duplicates.push({
            row: rowNumber,
            claim_number: claim.claim_number,
            message: 'Flagged claim already exists'
          })
          continue
        }

        // Verify provider exists
        const provider = await prisma.provider.findUnique({
          where: { id: claim.provider_id }
        })

        if (!provider) {
          results.errors.push({
            row: rowNumber,
            error: 'Provider not found'
          })
          continue
        }

        // Create flagged claim
        const newClaim = await prisma.claim.create({
          data: {
            claim_number: claim.claim_number,
            provider_id: claim.provider_id,
            amount: parseFloat(claim.amount),
            status: 'FLAGGED',
            risk_score: parseFloat(claim.risk_score),
            flags_count: claim.flags_count || 0,
            triggered_rules: claim.triggered_rules || [],
            risk_factors: claim.risk_factors || [],
            submitted_at: new Date(),
            created_by_id: session.user.id
          }
        })

        // Create audit log
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: 'BULK_CREATE_FLAGGED_CLAIM',
            resource: 'claim',
            resource_id: newClaim.id,
            new_values: {
              claim_number: newClaim.claim_number,
              provider_id: newClaim.provider_id,
              amount: newClaim.amount,
              risk_score: newClaim.risk_score
            }
          }
        })

        results.success.push({
          row: rowNumber,
          claim_number: newClaim.claim_number,
          risk_score: newClaim.risk_score
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
