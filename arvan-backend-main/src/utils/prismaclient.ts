import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Use DIRECT_URL in production to ensure reads from master database
const datasourceUrl = process.env.NODE_ENV === "production" ? process.env.DIRECT_URL : process.env.DATABASE_URL

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasourceUrl,
})

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
