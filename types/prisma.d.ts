import { Prisma } from "@prisma/client"

declare module "@prisma/client" {
  interface PrismaClient {
    providerUpdate: Prisma.ProviderUpdateDelegate<Prisma.$Extensions.DefaultArgs, Prisma.$Extensions.DefaultClientOptions>
  }
}

