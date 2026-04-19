import type { PrismaClient } from "@prisma/client"

function formatDatePart(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

function getSuffix(code: string, prefix: string): number {
  if (!code.startsWith(prefix)) return 0
  const raw = code.slice(prefix.length).trim()
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : 0
}

export async function generateDailyApprovalCode(prisma: PrismaClient): Promise<string> {
  const datePart = formatDatePart(new Date())
  const prefix = `APR/CJH/${datePart}`

  const todayCodes = await prisma.approvalCode.findMany({
    where: {
      approval_code: { startsWith: prefix }
    },
    select: { approval_code: true }
  })

  const maxSequence = todayCodes.reduce((max, row) => {
    const next = getSuffix(row.approval_code, prefix)
    return next > max ? next : max
  }, 0)

  const sequence = String(maxSequence + 1).padStart(2, "0")
  return `${prefix}${sequence}`
}
