import { FastifyInstance } from 'fastify'
import type { GameState } from '@prisma/client'
import { prisma } from '../prisma'
import { MAX_INCOME_PER_SEC, getGooCollectorCapMs, DRONE_OFFLINE_BONUS_MS } from '../config/economy'

// Anti-cheat threshold для idle income.
// 100B gold/sec — заведомо больше любого realistic дохода.
// Ловит только грубые читы (gold = 1e20 через DevTools), не trip'ает на legit play.
const MAX_GOLD_PER_SEC = 100_000_000_000n // 1e11 как BigInt

// Серилизация GameState для JSON-ответа: BigInt-поля (gold, ectoplasm) → строки
// (Fastify не умеет сериализовать BigInt). Остальное as-is.
function serializeState(state: GameState) {
  return {
    ...state,
    gold: state.gold.toString(),
    ectoplasm: state.ectoplasm.toString(),
  }
}

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
          ...serializeState(state),
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
        ...serializeState(state),
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
            ...serializeState(current),
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

      // ─── Валюты/прогресс локаций (типизированные колонки, см. AUDIT §3A) ───
      // Клиент шлёт top-level; во время перехода допускаем те же значения внутри
      // cosmic-блоба (fallback) — но top-level имеет приоритет.
      const cosmicIn =
        body.cosmic && typeof body.cosmic === 'object'
          ? (body.cosmic as Record<string, unknown>)
          : undefined
      const pick = (k: string): unknown =>
        k in body ? body[k] : cosmicIn?.[k]

      // ectoplasm — BigInt-колонка, приходит строкой или числом.
      const ectoRaw = pick('ectoplasm')
      if (typeof ectoRaw === 'string' || typeof ectoRaw === 'number') {
        try {
          const v = BigInt(Math.floor(Number(ectoRaw)))
          if (v >= 0n) data.ectoplasm = v
        } catch {
          /* ignore malformed */
        }
      }
      // Целочисленные не-отрицательные счётчики.
      for (const k of ['currencyY', 'essence', 'mutagen1', 'mutagen2', 'mutagen3'] as const) {
        const raw = pick(k)
        if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
          data[k] = Math.floor(raw)
        }
      }
      // loc2Upgrades — JSON-объект (карта апгрейдов).
      const loc2 = pick('loc2Upgrades')
      if (loc2 && typeof loc2 === 'object' && !Array.isArray(loc2)) {
        data.loc2Upgrades = loc2
      }

      // Эволюция (Loc3): cross-device sync активного слота {evoActive, evoLevel,
      // evoEndsAt}. endsAt ставит клиент (24ч таймер) — server-wall-clock authority
      // оставлен на дальнейшее (см. AUDIT §4.2 / финальный отчёт).
      if (typeof body.evoActive === 'boolean') {
        data.evoActive = body.evoActive
        if (body.evoActive) {
          if (typeof body.evoLevel === 'number' && body.evoLevel >= 1) {
            data.evoLevel = Math.floor(body.evoLevel)
          }
          const endsRaw = body.evoEndsAt
          if (typeof endsRaw === 'string' || typeof endsRaw === 'number') {
            const t = new Date(endsRaw)
            if (!Number.isNaN(t.getTime())) data.evoEndsAt = t
          }
        } else {
          data.evoLevel = null
          data.evoEndsAt = null
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
        ...serializeState(state),
        version: state.version,
      }
    },
  )
}
