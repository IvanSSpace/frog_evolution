import { prisma } from '../prisma'

/** 2 часа дохода трактора игрока, в slime (BigInt). */
export async function slimeRequestCap(userId: number): Promise<bigint> {
  const gs = await prisma.gameState.findUnique({
    where: { userId },
    select: { incomePerSec: true },
  })
  const rate = gs?.incomePerSec ?? 0
  const cap = Math.floor(rate * 7200)
  return BigInt(Math.max(0, cap))
}

/** Жёсткие лимиты по типам. */
export const ESSENCE_REQUEST_CAP = 1n
export const SERUM_REQUEST_CAP = 2n
