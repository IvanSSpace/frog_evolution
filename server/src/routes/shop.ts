import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'
import {
  getFrogPrice,
  getUpgradeCost,
  FROG_ECONOMY,
  MAX_LEVEL,
  ENTITY_CAP,
  UPGRADE_CONFIG,
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

      const state = await prisma.gameState.findUnique({
        where: { userId: request.user.id },
      })
      if (!state) {
        return reply.code(404).send({ error: 'no game state' })
      }

      const purchases = (state.frogPurchases as number[]) ?? []
      const purchasesCount = purchases[level - 1] ?? 0
      const price = getFrogPrice(level, purchasesCount)

      const gold = state.gold
      if (gold < BigInt(price)) {
        return reply.code(400).send({ error: 'insufficient gold', need: price })
      }

      // Cap check: total frogs across all locations
      const locFrogs = (state.locationFrogs as number[][]) ?? []
      const totalFrogs = locFrogs.reduce((sum, loc) => sum + (loc?.length ?? 0), 0)
      if (totalFrogs >= ENTITY_CAP) {
        return reply.code(400).send({ error: 'cap full' })
      }

      // Apply frogPurchases increment (does not write locationFrogs — client handles frog placement)
      const nextPurchases = [...purchases]
      while (nextPurchases.length < MAX_LEVEL) nextPurchases.push(0)
      nextPurchases[level - 1] = purchasesCount + 1

      const updated = await prisma.gameState.update({
        where: { userId: request.user.id },
        data: {
          gold: gold - BigInt(price),
          frogPurchases: nextPurchases,
        },
      })

      return {
        ok: true,
        gold: updated.gold.toString(),
        frogPurchases: updated.frogPurchases,
        spent: price,
        level,
      }
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

      const state = await prisma.gameState.findUnique({
        where: { userId: request.user.id },
      })
      if (!state) {
        return reply.code(404).send({ error: 'no game state' })
      }

      const upgrades = (state.upgrades as Record<string, number>) ?? {}
      const currentLevel = upgrades[key] ?? 0
      const cfg = UPGRADE_CONFIG[key]
      if (currentLevel >= cfg.maxLevel) {
        return reply.code(400).send({ error: 'max level reached' })
      }

      const cost = getUpgradeCost(key, currentLevel)
      const gold = state.gold
      if (gold < BigInt(cost)) {
        return reply.code(400).send({ error: 'insufficient gold', need: cost })
      }

      const nextUpgrades = { ...upgrades, [key]: currentLevel + 1 }
      const updated = await prisma.gameState.update({
        where: { userId: request.user.id },
        data: {
          gold: gold - BigInt(cost),
          upgrades: nextUpgrades,
        },
      })

      return {
        ok: true,
        gold: updated.gold.toString(),
        upgrades: updated.upgrades,
        spent: cost,
        key,
        newLevel: currentLevel + 1,
      }
    },
  )
}
