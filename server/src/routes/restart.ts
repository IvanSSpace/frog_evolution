import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'

/**
 * POST /game/restart — server-authoritative prestige restart.
 *
 * Anti-cheat: server reads l19_count from DB (never from request body).
 * Atomic transaction: wipe + baseTier increment + version bump — all or nothing.
 * Client CANNOT set baseTier via PUT /game/state.
 *
 * Phase 31 — Universe Restart (prestige)
 */
export async function restartRoutes(app: FastifyInstance) {
  app.post(
    '/game/restart',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user.id

      const current = await prisma.gameState.findUnique({ where: { userId } })
      if (!current) {
        return reply.code(404).send({ error: 'no state' })
      }

      // Anti-cheat: server reads l19_count from DB, never from client.
      // T-31-01: Tampering — client cannot pass a false l19Count.
      if (current.l19Count < 5) {
        return reply.code(400).send({
          error: 'insufficient l19 count',
          l19Count: current.l19Count,
          required: 5,
        })
      }

      // Cap baseTier at 2 (three tiers: 0, 1, 2 — no assets above tier 2 yet).
      // Phase 31 placeholder: extend cap when higher-tier assets are created.
      const newBaseTier = Math.min(2, current.baseTier + 1)

      // Wipe defaults — match schema.prisma @default values and persistence.ts loadUpgrades().
      const wipedUpgrades = {
        dropSpeed: 0,
        gooCollector: 0,
        magnet: 0,
        magnet2: 0,
        magnet3: 0,
        crateQuality: 0,
        rareBoxSpeed: 0,
        ships: 0,
        autoCollect: 0,
      }

      // FIX 3 (from 31-RESEARCH.md open question, resolved):
      // l18MergesCount and l18AbsoluteBonusPerSec are current-universe income bonuses.
      // They ARE server-synced via the cosmic JSON blob (confirmed: gameSync.ts L161-167).
      // On restart: zero them out in the cosmic blob, preserving all other cosmic data
      // (bestiary, serums, carriers, hasCosmosUnlocked, quests, contacts, relationships, etc.).
      const existingCosmic = (current.cosmic as Record<string, unknown>) ?? {}
      const updatedCosmic = {
        ...existingCosmic,
        // Reset current-universe income bonuses.
        l18MergesCount: 0,
        l18AbsoluteBonusPerSec: 0,
        // Sync prestige state into cosmic blob for client hydration (31-02).
        l19Count: 0,
        baseTier: newBaseTier,
        universeRestartCount: (current.universeRestartCount as number) + 1,
      }

      const updated = await prisma.gameState.update({
        where: { userId },
        data: {
          // WIPE — current-universe progress
          gold: 0n,
          upgrades: wipedUpgrades,
          frogPurchases: [],
          discoveredLevels: [1],
          locationFrogs: [[1], [], []],
          currentLocation: 1,
          // PRESTIGE — meta-progress columns
          baseTier: newBaseTier,
          universeRestartCount: { increment: 1 },
          l19Count: 0,
          // cosmic blob: preserve bestiary/serums/carriers/hasCosmosUnlocked/quests/contacts,
          // but zero out current-universe income bonuses (l18MergesCount, l18AbsoluteBonusPerSec)
          // and sync prestige fields for client hydration.
          cosmic: updatedCosmic,
          // Version bump — client MUST update lastKnownVersion from this response
          // before the next scheduled PUT to avoid 409 version mismatch (Pitfall 3).
          version: { increment: 1 },
          lastSessionAt: new Date(),
          // NOT wiped (meta-progress):
          // boxOpenCount — cumulative lifetime stat, preserved
          // onboarding — per-device, not touched by restart
        },
      })

      return {
        ...updated,
        gold: updated.gold.toString(),
        version: updated.version,
        baseTier: updated.baseTier,
        universeRestartCount: updated.universeRestartCount,
        l19Count: updated.l19Count,
      }
    },
  )
}
