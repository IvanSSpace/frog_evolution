import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

// Graceful shutdown — закрываем пул соединений при остановке процесса (AUDIT §3F).
// Без этого Prisma держит коннекты к Postgres до принудительного kill.
let disconnecting = false
async function shutdown(signal: NodeJS.Signals) {
  if (disconnecting) return
  disconnecting = true
  try {
    await prisma.$disconnect()
  } finally {
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
