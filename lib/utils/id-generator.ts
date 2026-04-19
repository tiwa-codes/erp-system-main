
import { prisma } from "@/lib/prisma"

/**
 * Generates the next sequential Enrollee ID globally.
 * Format: CJH/{ORG_CODE}/{SERIAL}
 * Serial increments from a global DB sequence (concurrency-safe across requests).
 * If legacy/manual IDs are higher than the sequence, we auto-fast-forward the sequence.
 * 
 * @param orgCode - The organization code (e.g., "CC", "TB")
 * @returns Promise<string> - The full Enrollee ID
 */
export async function getNextGlobalEnrolleeId(orgCode: string): Promise<string> {
    const SERIAL_BASELINE = 4285
    const ADVISORY_LOCK_KEY = 42864286

    const nextSerial = await prisma.$transaction(async (tx) => {
        // Serialize sequence maintenance/allocation to avoid concurrent duplicate serials.
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`)

        // Create once, keep forever.
        await tx.$executeRawUnsafe(
            `CREATE SEQUENCE IF NOT EXISTS enrollee_serial_seq START WITH ${SERIAL_BASELINE + 1} INCREMENT BY 1`
        )

        // Highest serial currently in data (for legacy/manual inserts and backfills).
        const maxRows = await tx.$queryRawUnsafe<Array<{ max_serial: number | null }>>(`
            SELECT COALESCE(
              MAX(
                CASE
                  WHEN enrollee_id ~ '^CJH/[^/]+/[0-9]+$'
                  THEN split_part(enrollee_id, '/', 3)::INT
                  ELSE NULL
                END
              ),
              ${SERIAL_BASELINE}
            ) AS max_serial
            FROM principal_accounts
        `)
        const maxSerial = Number(maxRows?.[0]?.max_serial ?? SERIAL_BASELINE)

        // Allocate from sequence.
        const firstPick = await tx.$queryRawUnsafe<Array<{ next_serial: string | number }>>(
            `SELECT nextval('enrollee_serial_seq') AS next_serial`
        )
        let allocated = Number(firstPick?.[0]?.next_serial)

        // If sequence is behind existing data, fast-forward and re-allocate.
        if (allocated <= maxSerial) {
            await tx.$executeRawUnsafe(
                `SELECT setval('enrollee_serial_seq', ${maxSerial + 1}, false)`
            )
            const secondPick = await tx.$queryRawUnsafe<Array<{ next_serial: string | number }>>(
                `SELECT nextval('enrollee_serial_seq') AS next_serial`
            )
            allocated = Number(secondPick?.[0]?.next_serial)
        }

        return allocated
    })

    // Ensure organization code is uppercase
    const code = orgCode.toUpperCase()

    // Format to 4 digits (e.g. 3914)
    return `CJH/${code}/${nextSerial.toString().padStart(4, '0')}`
}
