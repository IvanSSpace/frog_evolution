import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'
import {
  getFrogPrice,
  getUpgradeCost,
  FROG_ECONOMY,
  MAX_LEVEL,
  ENTITY_CAP,
  UPGRADE_CONFIG,
  shipUnlocked,
  type UpgradeKey,
} from '../config/economy'

export async function shopRoutes(app: FastifyInstance) {
  // POST /game/shop/buy-frog { level }
  app.post(
    '/game/shop/buy-frog',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = request.body as { level?: number }
      const level = body.level
      if (typeof level !== 'number' || level < 1 || level > MAX_LEVEL) {
        return reply.code(400).send({ error: 'invalid level' })
      }

      const cfg = FROG_ECONOMY[level - 1]
      if (!cfg.availableInShop) {
        return reply.code(400).send({ error: 'frog not in shop' })
      }

      // Serializable tx: read gold/purchases и списание — атомарно. Без этого
      // два параллельных buy читали один gold → двойная трата (AUDIT §3C).
      const result = await prisma.$transaction(
        async (tx) => {
          const state = await tx.gameState.findUnique({
            where: { userId: request.user.id },
          })
          if (!state) return { error: 'no game state', code: 404 } as const

          const purchases = (state.frogPurchases as number[]) ?? []
          const purchasesCount = purchases[level - 1] ?? 0
          const price = getFrogPrice(level, purchasesCount)

          if (state.gold < BigInt(price)) {
            return { error: 'insufficient gold', need: price, code: 400 } as const
          }

          const locFrogs = (state.locationFrogs as number[][]) ?? []
          const totalFrogs = locFrogs.reduce(
            (sum, loc) => sum + (loc?.length ?? 0),
            0,
          )
          if (totalFrogs >= ENTITY_CAP) {
            return { error: 'cap full', code: 400 } as const
          }

          const nextPurchases = [...purchases]
          while (nextPurchases.length < MAX_LEVEL) nextPurchases.push(0)
          nextPurchases[level - 1] = purchasesCount + 1

          const updated = await tx.gameState.update({
            where: { userId: request.user.id },
            data: {
              gold: state.gold - BigInt(price),
              frogPurchases: nextPurchases,
            },
          })
          return {
            ok: true as const,
            gold: updated.gold.toString(),
            frogPurchases: updated.frogPurchases,
            spent: price,
            level,
          }
        },
        { isolationLevel: 'Serializable' },
      )

      if ('error' in result) {
        const r = result as { error: string; code: number; need?: number }
        return reply.code(r.code).send({ error: r.error, need: r.need })
      }
      return result
    },
  )

  // POST /game/shop/buy-upgrade { key }
  app.post(
    '/game/shop/buy-upgrade',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = request.body as { key?: string }
      const key = body.key as UpgradeKey | undefined
      if (!key || !(key in UPGRADE_CONFIG)) {
        return reply.code(400).send({ error: 'invalid upgrade key' })
      }

      // Serializable tx — атомарное списание (AUDIT §3C).
      const result = await prisma.$transaction(
        async (tx) => {
          const state = await tx.gameState.findUnique({
            where: { userId: request.user.id },
          })
          if (!state) return { error: 'no game state', code: 404 } as const

          const upgrades = (state.upgrades as Record<string, number>) ?? {}
          const currentLevel = upgrades[key] ?? 0
          const cfg = UPGRADE_CONFIG[key]
          if (currentLevel >= cfg.maxLevel) {
            return { error: 'max level reached', code: 400 } as const
          }

          // Ships gate: next ship unlocked by progression (Лес/Континент/L19).
          if (key === 'ships') {
            const discovered = (state.discoveredLevels as number[]) ?? []
            if (!shipUnlocked(currentLevel, discovered)) {
              return { error: 'ship locked', code: 400 } as const
            }
          }

          const cost = getUpgradeCost(key, currentLevel)
          if (state.gold < BigInt(cost)) {
            return { error: 'insufficient gold', need: cost, code: 400 } as const
          }

          const nextUpgrades = { ...upgrades, [key]: currentLevel + 1 }
          const updated = await tx.gameState.update({
            where: { userId: request.user.id },
            data: {
              gold: state.gold - BigInt(cost),
              upgrades: nextUpgrades,
            },
          })
          return {
            ok: true as const,
            gold: updated.gold.toString(),
            upgrades: updated.upgrades,
            spent: cost,
            key,
            newLevel: currentLevel + 1,
          }
        },
        { isolationLevel: 'Serializable' },
      )

      if ('error' in result) {
        const r = result as { error: string; code: number; need?: number }
        return reply.code(r.code).send({ error: r.error, need: r.need })
      }
      return result
    },
  )
}
