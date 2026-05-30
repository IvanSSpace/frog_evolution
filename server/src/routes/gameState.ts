import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'
import { MAX_INCOME_PER_SEC, getGooCollectorCapMs, DRONE_OFFLINE_BONUS_MS } from '../config/economy'

// Anti-cheat threshold для idle income.
// 100B gold/sec — заведомо больше любого realistic дохода.
// Ловит только грубые читы (gold = 1e20 через DevTools), не trip'ает на legit play.
const MAX_GOLD_PER_SEC = 100_000_000_000n // 1e11 как BigInt

export async function gameStateRoutes(app: FastifyInstance) {
  app.get(
    '/game/state',
    { preHandler: [app.authenticate] },
    async (request) => {
      let state = await prisma.gameState.findUnique({
        where: { userId: request.user.id },
      })
      if (!state) {
        state = await prisma.gameState.create({
          data: { userId: request.user.id },
        })
        return {
          ...state,
          gold: state.gold.toString(),
          offlineIncome: '0',
          offlineMs: 0,
          elapsedMs: 0,
        }
      }

      // Compute offline income — server time is authoritative.
      const upgrades = state.upgrades as Record<string, number>
      const gooCollectorLevel = upgrades.gooCollector ?? upgrades.tractor ?? 0
      const elapsedMs = Date.now() - state.lastSessionAt.getTime()
      // Дроны автосбора продлевают офлайн-работу: +6ч к капу если куплен autoCollect.
      const droneBonusMs = (upgrades.autoCollect ?? 0) > 0 ? DRONE_OFFLINE_BONUS_MS : 0
      const capMs = getGooCollectorCapMs(gooCollectorLevel) + droneBonusMs
      const earnedMs = Math.min(Math.max(0, elapsedMs), capMs)
      const earnedSec = Math.floor(earnedMs / 1000)
      const offlineIncome = BigInt(Math.floor(earnedSec * state.incomePerSec))

      if (offlineIncome > 0n) {
        state = await prisma.gameState.update({
          where: { userId: request.user.id },
          data: {
            gold: state.gold + offlineIncome,
            lastSessionAt: new Date(),
          },
        })
      }

      return {
        ...state,
        gold: state.gold.toString(),
        offlineIncome: offlineIncome.toString(),
        offlineMs: earnedMs, // capped по goo collector
        elapsedMs, // raw — для box drops calc на клиенте
      }
    },
  )

  app.put(
    '/game/state',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>

      // Optimistic concurrency: client must echo the version it last saw.
      const clientVersion = body.version
      if (
        typeof clientVersion !== 'number' ||
        !Number.isInteger(clientVersion) ||
        clientVersion < 0
      ) {
        return reply.code(400).send({ error: 'version required (non-negative integer)' })
      }

      // Always fetch current — needed both for version check and idle-income clamp.
      const current = await prisma.gameState.findUnique({
        where: { userId: request.user.id },
      })

      if (!current) {
        // No row yet — allow create-on-PUT only if client expected version 0.
        if (clientVersion !== 0) {
          return reply.code(409).send({ error: 'version mismatch' })
        }
      } else if (current.version !== clientVersion) {
        return reply.code(409).send({
          error: 'version mismatch',
          currentState: {
            ...current,
            gold: current.gold.toString(),
            version: current.version,
          },
        })
      }

      const allowed = [
        'gold',
        'upgrades',
        'frogPurchases',
        'discoveredLevels',
        'magnetEnabled',
        'currentLocation',
        'locationFrogs',
        'cosmic',
        'onboarding',
        'boxOpenCount',
      ]
      const data: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in body) {
          if (key === 'gold' && typeof body.gold === 'string') {
            data.gold = BigInt(body.gold)
          } else {
            data[key] = body[key]
          }
        }
      }

      // Clamp incomePerSec — client value accepted but bounded.
      if ('incomePerSec' in body && typeof body.incomePerSec === 'number') {
        data.incomePerSec = Math.min(Math.max(0, body.incomePerSec), MAX_INCOME_PER_SEC)
      }

      // lastSessionAt always server-time — client value ignored.
      data.lastSessionAt = new Date()

      // Idle income clamp: если новый gold превышает разумный максимум
      // (старый + max_rate * elapsed) — clamp'им к этому максимуму.
      // Reuse `current` fetched above for the version check.
      if ('gold' in data && typeof data.gold === 'bigint' && current) {
        const elapsedMs = Date.now() - current.lastSessionAt.getTime()
        const elapsedSec = BigInt(Math.max(0, Math.floor(elapsedMs / 1000)))
        const maxGain = MAX_GOLD_PER_SEC * elapsedSec
        const maxAllowed = current.gold + maxGain
        if (data.gold > maxAllowed) {
          app.log.warn({
            userId: request.user.id,
            oldGold: current.gold.toString(),
            attempted: data.gold.toString(),
            clamped: maxAllowed.toString(),
            elapsedSec: elapsedSec.toString(),
          }, 'gold clamp: idle income exceeded')
          data.gold = maxAllowed
        }
      }

      const state = await prisma.gameState.upsert({
        where: { userId: request.user.id },
        update: { ...data, version: { increment: 1 } },
        create: { userId: request.user.id, ...data },
      })

      return {
        ...state,
        gold: state.gold.toString(),
        version: state.version,
      }
    },
  )
}
