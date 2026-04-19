import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { JournalEntryType, JournalEntryStatus, PostingType } from "@prisma/client"
import { z } from "zod"
import { createGLEntry, validateJournalEntry } from "@/lib/finance/gl-utils"

const createJournalEntrySchema = z.object({
  entry_date: z.string().transform((str) => new Date(str)),
  description: z.string().min(1),
  supporting_document_url: z.string().optional(),
  lines: z
    .array(
      z.object({
        account_id: z.string(),
        posting_type: z.nativeEnum(PostingType),
        amount: z.number().positive(),
        description: z.string().optional(),
      })
    )
    .min(2, "At least 2 lines required (one debit, one credit)"),
})

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
    const entryType = searchParams.get("entry_type")
    const status = searchParams.get("status")
    const fromDate = searchParams.get("from_date")
    const toDate = searchParams.get("to_date")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    const skip = (page - 1) * limit

    const where: any = {}

    if (entryType) {
      where.entry_type = entryType as JournalEntryType
    }

    if (status) {
      where.status = status as JournalEntryStatus
    }

    if (fromDate || toDate) {
      where.entry_date = {}
      if (fromDate) {
        where.entry_date.gte = new Date(fromDate)
      }
      if (toDate) {
        where.entry_date.lte = new Date(toDate)
      }
    }

    if (search) {
      where.OR = [
        { entry_number: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          approved_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
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
        orderBy: [{ entry_date: "desc" }, { entry_number: "desc" }],
        skip,
        take: limit,
      }),
      prisma.journalEntry.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: {
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching journal entries:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch journal entries",
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
    const validatedData = createJournalEntrySchema.parse(body)

    // Validate journal entry - debits must equal credits
    const validation = validateJournalEntry(validatedData.lines)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      )
    }

    // Calculate totals
    const totalDebit = validatedData.lines
      .filter((line) => line.posting_type === PostingType.DEBIT)
      .reduce((sum, line) => sum + line.amount, 0)

    const totalCredit = validatedData.lines
      .filter((line) => line.posting_type === PostingType.CREDIT)
      .reduce((sum, line) => sum + line.amount, 0)

    // Generate journal entry number
    const year = validatedData.entry_date.getFullYear()
    const count = await prisma.journalEntry.count({
      where: {
        entry_date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    })
    const sequence = String(count + 1).padStart(5, "0")
    const entry_number = `JE-${year}-${sequence}`

    // Create and immediately post manual journal entries to GL
    const journalEntry = await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          entry_number,
          entry_date: validatedData.entry_date,
          entry_type: "MANUAL",
          status: "POSTED",
          description: validatedData.description,
          total_debit: totalDebit,
          total_credit: totalCredit,
          supporting_document_url: validatedData.supporting_document_url,
          approved_by_id: session.user.id,
          approved_at: new Date(),
          posted_at: new Date(),
          created_by_id: session.user.id,
        },
      })

      // Create journal entry lines
      await tx.journalEntryLine.createMany({
        data: validatedData.lines.map((line) => ({
          journal_entry_id: entry.id,
          account_id: line.account_id,
          posting_type: line.posting_type,
          amount: line.amount,
          description: line.description,
        })),
      })

      // Load lines to create corresponding GL entries
      const createdLines = await tx.journalEntryLine.findMany({
        where: { journal_entry_id: entry.id },
      })

      for (const line of createdLines) {
        await createGLEntry({
          account_id: line.account_id,
          posting_type: line.posting_type,
          amount: Number(line.amount),
          transaction_date: entry.entry_date,
          reference_number: entry.entry_number,
          reference_type: "JOURNAL_ENTRY",
          reference_id: entry.id,
          description: line.description || entry.description || undefined,
          journal_entry_id: entry.id,
          created_by_id: session.user.id,
        })
      }

      return entry
    })

    // Fetch complete entry with relations
    const completeEntry = await prisma.journalEntry.findUnique({
      where: { id: journalEntry.id },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
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
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "JOURNAL_ENTRY_CREATED_AND_POSTED",
        resource: "journal_entry",
        resource_id: journalEntry.id,
        new_values: completeEntry,
      },
    })

    return NextResponse.json({
      success: true,
      data: completeEntry,
    })
  } catch (error) {
    console.error("Error creating journal entry:", error)
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
        error: error instanceof Error ? error.message : "Failed to create journal entry",
      },
      { status: 500 }
    )
  }
}

