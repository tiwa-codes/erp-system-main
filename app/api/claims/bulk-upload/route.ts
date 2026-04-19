import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ClaimStatus, ClaimType } from "@prisma/client"

type BulkClaimInput = {
  claim_number?: string
  enrollee_id?: string
  provider_id?: string
  amount?: string | number
  claim_type?: ClaimType | string
  diagnosis?: string | null
  services?: string | null
  submitted_at?: string
}

type BulkClaimResult = { row: number; claim_number: string; amount: unknown }
type BulkClaimError = { row: number; error: string }
type BulkClaimDuplicate = { row: number; claim_number: string; message: string }

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
    const { claims } = body

    if (!claims || !Array.isArray(claims)) {
      return NextResponse.json({ error: 'Invalid claims data' }, { status: 400 })
    }

    const results: {
      success: BulkClaimResult[]
      errors: BulkClaimError[]
      duplicates: BulkClaimDuplicate[]
    } = {
      success: [],
      errors: [],
      duplicates: []
    }

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i] as BulkClaimInput
      const rowNumber = i + 1

      try {
        // Validate required fields
        if (!claim.claim_number || !claim.enrollee_id || !claim.provider_id || !claim.amount) {
          results.errors.push({
            row: rowNumber,
            error: 'Missing required fields: claim_number, enrollee_id, provider_id, amount'
          })
          continue
        }

        // Check if claim number already exists
        const existingClaim = await prisma.claim.findUnique({
          where: { claim_number: claim.claim_number }
        })

        if (existingClaim) {
          results.duplicates.push({
            row: rowNumber,
            claim_number: claim.claim_number,
            message: 'Claim already exists'
          })
          continue
        }

        // Verify enrollee exists
        const enrollee = await prisma.principalAccount.findUnique({
          where: { id: claim.enrollee_id }
        })

        if (!enrollee) {
          results.errors.push({
            row: rowNumber,
            error: 'Enrollee not found'
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

        // Create claim
        const newClaim = await prisma.claim.create({
          data: {
            claim_number: claim.claim_number,
            enrollee_id: claim.enrollee_id,
            provider_id: claim.provider_id,
            claim_type:
              typeof claim.claim_type === "string" &&
              claim.claim_type in ClaimType
                ? ClaimType[claim.claim_type as keyof typeof ClaimType]
                : ClaimType.MEDICAL,
            amount: Number(claim.amount),
            description: [claim.diagnosis, claim.services].filter(Boolean).join(" | ") || null,
            status: ClaimStatus.PENDING,
            submitted_at: claim.submitted_at ? new Date(claim.submitted_at) : new Date(),
            created_by_id: session.user.id
          }
        })

        // Create audit log
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: 'BULK_CREATE_CLAIM',
            resource: 'claim',
            resource_id: newClaim.id,
            new_values: {
              claim_number: newClaim.claim_number,
              enrollee_id: newClaim.enrollee_id,
              provider_id: newClaim.provider_id,
              amount: newClaim.amount
            }
          }
        })

        results.success.push({
          row: rowNumber,
          claim_number: newClaim.claim_number,
          amount: newClaim.amount
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
