export function formatAccountCode(accountCode: number | string): string {
  const digits = String(accountCode).trim()

  // Composite code stored as 9 digits, e.g. 120001001 -> 120001-001
  if (/^\d{9}$/.test(digits)) {
    return `${digits.slice(0, 6)}-${digits.slice(6)}`
  }

  return digits
}

export function getAccountCodeSortKey(accountCode: number | string): string {
  const digits = String(accountCode).replace(/\D/g, "")

  if (digits.length === 9) return digits
  if (digits.length === 6) return `${digits}000`

  // Fallback keeps sort deterministic even with unusual legacy codes
  return digits.padStart(9, "0")
}
