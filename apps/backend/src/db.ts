import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined
}

if (!global.__prisma__) {
  global.__prisma__ = new PrismaClient()
}

prisma = global.__prisma__

export default prisma
