import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { AccountCategory, AccountSubCategory, PostingType } from "@prisma/client"
import { z } from "zod"

const updateAccountSchema = z.object({
  account_name: z.string().min(1).optional(),
  account_category: z.nativeEnum(AccountCategory).optional(),
  sub_category: z.nativeEnum(AccountSubCategory).optional(),
  parent_account_id: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  opening_balance: z.number().optional(),
  balance_type: z.nativeEnum(PostingType).optional(),
  is_active: z.boolean().optional(),
})

function validateAccountCodeRange(accountCode: number, category: AccountCategory): boolean {
  const baseCode = accountCode >= 100000000 ? Math.floor(accountCode / 1000) : accountCode

  switch (category) {
    case AccountCategory.ASSET:
      return baseCode >= 100000 && baseCode <= 199999
    case AccountCategory.LIABILITY:
      return baseCode >= 200000 && baseCode <= 299999
    case AccountCategory.EQUITY:
      return baseCode >= 300000 && baseCode <= 399999
    case AccountCategory.INCOME:
      return baseCode >= 400000 && baseCode <= 499999
    case AccountCategory.EXPENSE:
      return baseCode >= 500000 && baseCode <= 599999
    default:
      return false
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "finance", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const account = await prisma.chartOfAccount.findUnique({
      where: { id: params.id },
      include: {
        parent_account: {
          select: {
            id: true,
            account_code: true,
            account_name: true,
          },
        },
        child_accounts: {
          select: {
            id: true,
            account_code: true,
            account_name: true,
            is_active: true,
          },
        },
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: account,
    })
  } catch (error) {
    console.error("Error fetching chart of account:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch chart of account",
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "finance", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const account = await prisma.chartOfAccount.findUnique({
      where: { id: params.id },
    })

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    // Read request body once
    const body = await request.json()

    // Check if GL entries exist - if so, account_code cannot be changed
    const glEntriesCount = await prisma.generalLedger.count({
      where: { account_id: params.id },
    })

    if (glEntriesCount > 0) {
      // Account code cannot be changed if GL entries exist
      // Also, category cannot be changed if it would invalidate the account code range
      if (body.account_category && body.account_category !== account.account_category) {
        if (!validateAccountCodeRange(account.account_code, body.account_category)) {
          return NextResponse.json(
            {
              success: false,
              error: "Cannot change category because account code would be invalid for new category",
            },
            { status: 400 }
          )
        }
      }
    }

    const validatedData = updateAccountSchema.parse(body)

    // Validate parent account if provided
    if (validatedData.parent_account_id !== undefined) {
      if (validatedData.parent_account_id) {
        const parentAccount = await prisma.chartOfAccount.findUnique({
          where: { id: validatedData.parent_account_id },
        })

        if (!parentAccount) {
          return NextResponse.json(
            {
              success: false,
              error: "Parent account not found",
            },
            { status: 400 }
          )
        }

        const categoryToCheck = validatedData.account_category || account.account_category
        if (parentAccount.account_category !== categoryToCheck) {
          return NextResponse.json(
            {
              success: false,
              error: "Parent account must be in the same category",
            },
            { status: 400 }
          )
        }

        // Prevent circular reference
        if (validatedData.parent_account_id === params.id) {
          return NextResponse.json(
            {
              success: false,
              error: "Account cannot be its own parent",
            },
            { status: 400 }
          )
        }
      }
    }

    const oldValues = { ...account }

    const updatedAccount = await prisma.chartOfAccount.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        parent_account: {
          select: {
            id: true,
            account_code: true,
            account_name: true,
          },
        },
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "CHART_OF_ACCOUNT_UPDATED",
        resource: "chart_of_account",
        resource_id: updatedAccount.id,
        old_values: oldValues,
        new_values: updatedAccount,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedAccount,
    })
  } catch (error) {
    console.error("Error updating chart of account:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update chart of account",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "finance", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const account = await prisma.chartOfAccount.findUnique({
      where: { id: params.id },
    })

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    // Check if GL entries exist
    const glEntriesCount = await prisma.generalLedger.count({
      where: { account_id: params.id },
    })

    if (glEntriesCount > 0) {
      // Soft delete - set is_active to false
      const updatedAccount = await prisma.chartOfAccount.update({
        where: { id: params.id },
        data: { is_active: false },
      })

      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "CHART_OF_ACCOUNT_DEACTIVATED",
          resource: "chart_of_account",
          resource_id: updatedAccount.id,
          old_values: account,
          new_values: updatedAccount,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Account deactivated (has GL entries)",
        data: updatedAccount,
      })
    }

    // Hard delete if no GL entries
    await prisma.chartOfAccount.delete({
      where: { id: params.id },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "CHART_OF_ACCOUNT_DELETED",
        resource: "chart_of_account",
        resource_id: params.id,
        old_values: account,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting chart of account:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete chart of account",
      },
      { status: 500 }
    )
  }
}

