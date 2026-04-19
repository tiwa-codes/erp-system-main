import { prisma } from "@/lib/prisma"

type ClientOwnership = {
  clientAccount: Awaited<ReturnType<typeof prisma.clientAccount.findUnique>>
  principal: Awaited<ReturnType<typeof prisma.principalAccount.findUnique>>
  organizationId: string | null
  organizationName: string | null
  organizationCode: string | null
}

export async function getClientOwnership(userId: string): Promise<ClientOwnership> {
  const [clientAccount, principal] = await Promise.all([
    prisma.clientAccount.findUnique({
      where: { user_id: userId },
      include: {
        organization: true,
        user: true,
      },
    }),
    prisma.principalAccount.findUnique({
      where: { user_id: userId },
      include: {
        organization: true,
        user: true,
      },
    }),
  ])

  const organization = clientAccount?.organization || principal?.organization || null

  return {
    clientAccount,
    principal,
    organizationId: organization?.id || null,
    organizationName: organization?.name || null,
    organizationCode: organization?.code || null,
  }
}

export function buildClientPlanOwnerWhere(ownership: ClientOwnership) {
  const ownerFilters: Array<Record<string, string>> = []

  if (ownership.clientAccount?.id) {
    ownerFilters.push({ client_account_id: ownership.clientAccount.id })
  }

  if (ownership.principal?.id) {
    ownerFilters.push({ principal_account_id: ownership.principal.id })
  }

  if (ownerFilters.length === 1) {
    return ownerFilters[0]
  }

  if (ownerFilters.length > 1) {
    return { OR: ownerFilters }
  }

  return null
}

