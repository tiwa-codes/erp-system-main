import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { PostingType } from "@prisma/client"

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
    const accountIds = searchParams.get("account_ids")?.split(",").filter(Boolean)
    const fromDate = searchParams.get("from_date")
    const toDate = searchParams.get("to_date")
    const postingType = searchParams.get("posting_type")
    const referenceType = searchParams.get("reference_type")
    const module = searchParams.get("module")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const exportFormat = searchParams.get("export") // "excel" or "pdf"
    const view = searchParams.get("view") // "account" for grouped-by-account view

    const skip = (page - 1) * limit

    // Build a reusable entry filter (without account_id so it can be used in relation includes)
    const entryWhere: any = {}

    if (fromDate || toDate) {
      entryWhere.transaction_date = {}
      if (fromDate) {
        entryWhere.transaction_date.gte = new Date(fromDate)
      }
      if (toDate) {
        const end = new Date(toDate)
        end.setHours(23, 59, 59, 999)
        entryWhere.transaction_date.lte = end
      }
    }

    if (postingType) {
      entryWhere.posting_type = postingType as PostingType
    }

    if (referenceType) {
      entryWhere.reference_type = referenceType
    }

    if (module) {
      entryWhere.module = module
    }

    if (search) {
      entryWhere.OR = [
        { reference_number: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { entry_number: { contains: search, mode: "insensitive" } },
      ]
    }

    // Grouped-by-account view: returns accounts as accordion rows with their entries
    if (view === "account") {
      const accountFilter = accountIds?.length ? { account_id: { in: accountIds } } : {}

      const distinctAccounts = await prisma.generalLedger.findMany({
        where: { ...entryWhere, ...accountFilter },
        select: { account_id: true },
        distinct: ["account_id"],
      })

      if (distinctAccounts.length === 0) {
        return NextResponse.json({ success: true, data: { accounts: [] } })
      }

      const accountIdList = distinctAccounts.map((a) => a.account_id)

      const accounts = await prisma.chartOfAccount.findMany({
        where: { id: { in: accountIdList } },
        include: {
          general_ledger_entries: {
            where: entryWhere,
            orderBy: [{ transaction_date: "asc" }, { created_at: "asc" }],
          },
        },
        orderBy: { account_code: "asc" },
      })

      const accountsWithBalance = accounts.map((account) => {
        const isDebitNormal = ["ASSET", "EXPENSE"].includes(account.account_category)
        let balance = Number(account.opening_balance)
        let totalDebit = 0
        let totalCredit = 0

        const entries = account.general_ledger_entries.map((entry) => {
          const amount = Number(entry.amount)
          if (entry.posting_type === PostingType.DEBIT) {
            totalDebit += amount
            balance = isDebitNormal ? balance + amount : balance - amount
          } else {
            totalCredit += amount
            balance = isDebitNormal ? balance - amount : balance + amount
          }
          return { ...entry, running_balance: balance }
        })

        return {
          account_id: account.id,
          account_code: account.account_code,
          account_name: account.account_name,
          account_category: account.account_category,
          opening_balance: Number(account.opening_balance),
          entries,
          total_debit: totalDebit,
          total_credit: totalCredit,
          closing_balance: balance,
        }
      })

      return NextResponse.json({ success: true, data: { accounts: accountsWithBalance } })
    }

    const where: any = { ...entryWhere }

    if (accountIds && accountIds.length > 0) {
      where.account_id = { in: accountIds }
    }

    const [entries, total] = await Promise.all([
      prisma.generalLedger.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              account_code: true,
              account_name: true,
              account_category: true,
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
          journal_entry: {
            select: {
              id: true,
              entry_number: true,
              description: true,
              entry_date: true,
              journal_entry_lines: {
                include: {
                  account: {
                    select: {
                      id: true,
                      account_code: true,
                      account_name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ transaction_date: "desc" }, { entry_number: "desc" }],
        skip,
        take: limit,
      }),
      prisma.generalLedger.count({ where }),
    ])

    // Group journal entry transactions together
    const groupedEntries: Map<string, any[]> = new Map()
    const standaloneEntries: any[] = []

    entries.forEach((entry) => {
      if (entry.journal_entry_id && entry.journal_entry) {
        const key = entry.journal_entry_id
        if (!groupedEntries.has(key)) {
          groupedEntries.set(key, [])
        }
        groupedEntries.get(key)!.push(entry)
      } else {
        standaloneEntries.push(entry)
      }
    })

    // Create grouped transaction entries
    const groupedTransactions: any[] = []
    groupedEntries.forEach((glEntries, journalEntryId) => {
      const firstEntry = glEntries[0]
      const journalEntry = firstEntry.journal_entry

      // Calculate total debit and credit
      let totalDebit = 0
      let totalCredit = 0
      glEntries.forEach((e) => {
        if (e.posting_type === PostingType.DEBIT) {
          totalDebit += Number(e.amount)
        } else {
          totalCredit += Number(e.amount)
        }
      })

      groupedTransactions.push({
        id: `journal-${journalEntryId}`,
        entry_number: journalEntry?.entry_number || firstEntry.entry_number,
        transaction_date: firstEntry.transaction_date,
        reference_number: firstEntry.reference_number,
        reference_type: firstEntry.reference_type,
        reference_id: firstEntry.reference_id,
        description: journalEntry?.description || firstEntry.description,
        journal_entry_id: journalEntryId,
        journal_entry: journalEntry,
        is_grouped: true,
        gl_entries: glEntries,
        total_debit: totalDebit,
        total_credit: totalCredit,
        account: null, // Grouped entries don't have a single account
        created_by: firstEntry.created_by,
      })
    })

    // Combine grouped and standalone entries, sort by date
    const allEntries = [...groupedTransactions, ...standaloneEntries].sort((a, b) => {
      const dateA = new Date(a.transaction_date).getTime()
      const dateB = new Date(b.transaction_date).getTime()
      return dateB - dateA
    })

    // Calculate running balance for each entry
    let runningBalance = 0
    const entriesWithBalance = allEntries.map((entry) => {
      if (entry.is_grouped) {
        // For grouped entries, calculate balance from individual GL entries
        entry.gl_entries.forEach((glEntry: any) => {
          const amount = Number(glEntry.amount)
          if (glEntry.posting_type === PostingType.DEBIT) {
            runningBalance += amount
          } else {
            runningBalance -= amount
          }
        })
      } else {
        const amount = Number(entry.amount)
        if (entry.posting_type === PostingType.DEBIT) {
          runningBalance += amount
        } else {
          runningBalance -= amount
        }
      }
      return {
        ...entry,
        running_balance: runningBalance,
      }
    })

    const totalPages = Math.ceil(total / limit)

    // Handle export
    if (exportFormat === "excel" || exportFormat === "pdf") {
      // For now, return JSON. Actual Excel/PDF generation can be added later
      return NextResponse.json({
        success: true,
        data: {
          entries: entriesWithBalance,
          total,
        },
        export_format: exportFormat,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        entries: entriesWithBalance,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching general ledger:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch general ledger",
      },
      { status: 500 }
    )
  }
}
