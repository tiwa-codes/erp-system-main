import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { AccountCategory, AccountSubCategory, PostingType } from "@prisma/client"
import { z } from "zod"

const ACCOUNT_CODE_INPUT_REGEX = /^\d{6}(-\d{3})?$/

const createAccountSchema = z.object({
  account_code: z.union([
    z.number().int().min(100000).max(599999999),
    z.string().trim().regex(ACCOUNT_CODE_INPUT_REGEX),
  ]),
  account_name: z.string().min(1),
  account_category: z.nativeEnum(AccountCategory),
  sub_category: z.string().optional(), // Changed to string to allow any value
  parent_account_id: z.string().optional(),
  description: z.string().optional(),
  opening_balance: z.number().default(0),
  balance_type: z.nativeEnum(PostingType).optional(),
  is_active: z.boolean().default(true),
})

const updateAccountSchema = createAccountSchema.partial().omit({ account_code: true })

function normalizeAccountCode(accountCode: number | string): { storedCode: number; baseCode: number } {
  if (typeof accountCode === "number") {
    if (!Number.isInteger(accountCode)) {
      throw new Error("Account code must be an integer")
    }

    // Legacy six-digit parent codes
    if (accountCode >= 100000 && accountCode <= 599999) {
      return { storedCode: accountCode, baseCode: accountCode }
    }

    // Composite code stored as base(6) + suffix(3), e.g., 100100001 for 100100-001
    if (accountCode >= 100000000 && accountCode <= 599999999) {
      return {
        storedCode: accountCode,
        baseCode: Math.floor(accountCode / 1000),
      }
    }

    throw new Error("Invalid account code format")
  }

  const value = accountCode.trim()
  if (!ACCOUNT_CODE_INPUT_REGEX.test(value)) {
    throw new Error("Account code format must be 6 digits or 6 digits followed by - and 3 digits")
  }

  const [basePart, suffixPart] = value.split("-")
  const baseCode = Number(basePart)
  const storedCode = suffixPart ? Number(`${basePart}${suffixPart}`) : baseCode

  if (!Number.isInteger(baseCode) || !Number.isInteger(storedCode)) {
    throw new Error("Invalid account code")
  }

  return { storedCode, baseCode }
}

function validateAccountCodeRange(baseCode: number, category: AccountCategory): boolean {
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

function getDefaultBalanceType(category: AccountCategory): PostingType {
  return category === AccountCategory.ASSET || category === AccountCategory.EXPENSE
    ? PostingType.DEBIT
    : PostingType.CREDIT
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "finance", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const sub_category = searchParams.get("sub_category")
    const is_active = searchParams.get("is_active")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    const skip = (page - 1) * limit

    const where: any = {}

    if (category) {
      where.account_category = category
    }

    if (sub_category) {
      where.sub_category = sub_category
    }

    if (is_active !== null && is_active !== undefined) {
      where.is_active = is_active === "true"
    }

    if (search) {
      where.OR = [
        { account_name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    // First, get all accounts (not paginated) to build full hierarchy
    const allAccounts = await prisma.chartOfAccount.findMany({
      where: {
        // Apply filters but no pagination for hierarchy building
        ...(category && { account_category: category }),
        ...(is_active !== null && is_active !== undefined && { is_active: is_active === "true" }),
        ...(search && {
          OR: [
            { account_name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        parent_account: {
          select: {
            id: true,
            account_code: true,
            account_name: true,
          },
        },
        child_accounts: {
          include: {
            child_accounts: true,
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
      orderBy: [{ account_category: "asc" }, { account_code: "asc" }],
    })

    // Get paginated accounts for display
    const [accounts, total, summaryCounts] = await Promise.all([
      prisma.chartOfAccount.findMany({
        where,
        include: {
          parent_account: {
            select: {
              id: true,
              account_code: true,
              account_name: true,
            },
          },
          child_accounts: {
            include: {
              child_accounts: true,
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
        orderBy: [{ account_category: "asc" }, { account_code: "asc" }],
        skip,
        take: limit,
      }),
      prisma.chartOfAccount.count({ where }),
      Promise.all([
        prisma.chartOfAccount.count({ where: { is_active: true } }),
        prisma.chartOfAccount.count({ where: { account_category: AccountCategory.ASSET, is_active: true } }),
        prisma.chartOfAccount.count({ where: { account_category: AccountCategory.LIABILITY, is_active: true } }),
        prisma.chartOfAccount.count({ where: { account_category: AccountCategory.EXPENSE, is_active: true } }),
      ]),
    ])

    // Get all account IDs for batch balance calculation (from all accounts, not just paginated)
    const accountIds = allAccounts.map((acc) => acc.id)

    // Batch fetch all GL balances
    const [allDebits, allCredits] = await Promise.all([
      prisma.generalLedger.groupBy({
        by: ["account_id"],
        where: {
          account_id: { in: accountIds },
          posting_type: PostingType.DEBIT,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.generalLedger.groupBy({
        by: ["account_id"],
        where: {
          account_id: { in: accountIds },
          posting_type: PostingType.CREDIT,
        },
        _sum: {
          amount: true,
        },
      }),
    ])

    // Create balance maps
    const debitMap = new Map(allDebits.map((d) => [d.account_id, Number(d._sum.amount || 0)]))
    const creditMap = new Map(allCredits.map((c) => [c.account_id, Number(c._sum.amount || 0)]))

    // Calculate balances for all accounts
    const allAccountsWithBalances = allAccounts.map((account) => {
      const openingBalance = Number(account.opening_balance)
      const totalDebits = debitMap.get(account.id) || 0
      const totalCredits = creditMap.get(account.id) || 0

      // Calculate balance based on account category
      let balance: number
      if (
        account.account_category === AccountCategory.ASSET ||
        account.account_category === AccountCategory.EXPENSE
      ) {
        balance = openingBalance + totalDebits - totalCredits
      } else {
        balance = openingBalance - totalDebits + totalCredits
      }

      // Determine level
      let level = "Detail"
      if (!account.parent_account_id && account.child_accounts && account.child_accounts.length > 0) {
        level = "Parent"
      } else if (account.parent_account_id) {
        level = "Child"
      }

      // Determine balance type
      const normalizedBalanceType = account.balance_type || getDefaultBalanceType(account.account_category)
      const balanceType = normalizedBalanceType === PostingType.DEBIT ? "Debit" : "Credit"

      return {
        ...account,
        balance,
        opening_balance: openingBalance,
        level,
        balance_type: balanceType,
      }
    })

    const totalPages = Math.ceil(total / limit)

    // Create a map for quick lookup
    const accountMap = new Map(allAccountsWithBalances.map((acc) => [acc.id, acc]))

    // Build full hierarchy with balances
    const buildHierarchy = (account: any, depth: number = 0): any => {
      const accountWithBalance = accountMap.get(account.id) || account
      const result = {
        ...accountWithBalance,
        depth,
      }

      if (account.child_accounts && account.child_accounts.length > 0) {
        result.child_accounts = account.child_accounts
          .map((child: any) => buildHierarchy(child, depth + 1))
          .sort((a: any, b: any) => a.account_code - b.account_code)
      }

      return result
    }

    // Get parent accounts (no parent_account_id)
    const parentAccounts = allAccountsWithBalances
      .filter((acc) => !acc.parent_account_id)
      .map((acc) => {
        const originalAccount = allAccounts.find((a) => a.id === acc.id)
        return buildHierarchy(originalAccount || acc, 0)
      })
      .sort((a, b) => a.account_code - b.account_code)

    return NextResponse.json({
      success: true,
      data: {
        accounts: parentAccounts, // Return full hierarchy
        allAccounts: allAccountsWithBalances, // Also return flat list for reference
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        summary: {
          total_accounts: summaryCounts[0],
          asset_accounts: summaryCounts[1],
          liability_accounts: summaryCounts[2],
          expense_accounts: summaryCounts[3],
        },
      },
    })
  } catch (error) {
    console.error("Error fetching chart of accounts:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch chart of accounts",
      },
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

    const canAdd = await checkPermission(session.user.role as any, "finance", "add")
    if (!canAdd) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createAccountSchema.parse(body)
    const normalizedCode = normalizeAccountCode(validatedData.account_code)

    // Validate account code range
    if (!validateAccountCodeRange(normalizedCode.baseCode, validatedData.account_category)) {
      return NextResponse.json(
        {
          success: false,
          error: `Account code ${validatedData.account_code} is not valid for category ${validatedData.account_category}`,
        },
        { status: 400 }
      )
    }

    // Check if account code already exists
    const existingAccount = await prisma.chartOfAccount.findUnique({
      where: { account_code: normalizedCode.storedCode },
    })

    if (existingAccount) {
      return NextResponse.json(
        {
          success: false,
          error: `Account code ${validatedData.account_code} already exists`,
        },
        { status: 400 }
      )
    }

    // Validate parent account if provided
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

      if (parentAccount.account_category !== validatedData.account_category) {
        return NextResponse.json(
          {
            success: false,
            error: "Parent account must be in the same category",
          },
          { status: 400 }
        )
      }
    }

    const account = await prisma.chartOfAccount.create({
      data: {
        account_code: normalizedCode.storedCode,
        account_name: validatedData.account_name,
        account_category: validatedData.account_category,
        sub_category: validatedData.sub_category,
        parent_account_id: validatedData.parent_account_id,
        description: validatedData.description,
        opening_balance: validatedData.opening_balance,
        balance_type: validatedData.balance_type || getDefaultBalanceType(validatedData.account_category),
        is_active: validatedData.is_active,
        created_by_id: session.user.id,
      },
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
        action: "CHART_OF_ACCOUNT_CREATED",
        resource: "chart_of_account",
        resource_id: account.id,
        new_values: account,
      },
    })

    return NextResponse.json({
      success: true,
      data: account,
    })
  } catch (error) {
    console.error("Error creating chart of account:", error)
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
        error: error instanceof Error ? error.message : "Failed to create chart of account",
      },
      { status: 500 }
    )
  }
}

