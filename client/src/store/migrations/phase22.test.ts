// Phase 22 Plan 22-07: migration legacy state → Phase 22 unit tests (vitest).
// Run: cd client && npx vitest run src/store/migrations/phase22.test.ts
//
// Coverage:
//   Test 1: strip rarity/feedCount/stabilized из carriers
//   Test 2: carrier без level → default 1
//   Test 3: flatten nested serums (sum по rarities)
//   Test 4: серум shape уже flat → leave as-is
//   Test 5: hasCosmosUnlocked inferred from discovered[19]
//   Test 6: initial fresh state (no legacy fields) — defaults применяются
//   Test 7: idempotency — migrate(migrate(x)) === migrate(x)
//   Test 8: stabilized carrier с element/level survives, лишние поля strip
//   Test 9: null / undefined / non-object → passthrough
//   Test 10: ascendedCarriers + essence preserved (no overwrite)

import { describe, it, expect } from 'vitest'
import { migratePhase22 } from './phase22'

describe('migratePhase22', () => {
  it('Test 1: strip rarity/feedCount/stabilized/ceiling/rollHistory из carriers', () => {
    const legacy = {
      carriers: [
        {
          frogId: 'f1',
          element: 'fire',
          rarity: 'epic',
          feedCount: 5,
          stabilized: true,
          ceiling: 100,
          rollHistory: [1, 2, 3],
          level: 7,
        },
      ],
    }
    const out = migratePhase22(legacy) as { carriers: unknown[] }
    expect(out.carriers).toEqual([{ frogId: 'f1', element: 'fire', level: 7 }])
  })

  it('Test 2: carrier без level → default 1', () => {
    const legacy = {
      carriers: [
        {
          frogId: 'f1',
          element: 'fire',
          rarity: 'common',
          feedCount: 0,
          stabilized: false,
        },
      ],
    }
    const out = migratePhase22(legacy) as { carriers: { level: number }[] }
    expect(out.carriers[0].level).toBe(1)
  })

  it('Test 3: flatten nested serums (sum по rarities)', () => {
    const legacy = {
      serums: {
        fire: { common: 5, rare: 2, epic: 1, legendary: 0 },
        water: { common: 0, rare: 0, epic: 0, legendary: 0 },
      },
    }
    const out = migratePhase22(legacy) as { serums: Record<string, number> }
    expect(out.serums.fire).toBe(8)
    expect(out.serums.water).toBe(0)
  })

  it('Test 4: серум shape уже flat → leave as-is', () => {
    const legacy = { serums: { fire: 5, water: 3 } }
    const out = migratePhase22(legacy) as { serums: Record<string, number> }
    expect(out.serums.fire).toBe(5)
    expect(out.serums.water).toBe(3)
  })

  it('Test 5: hasCosmosUnlocked inferred from legacy discovered[19]', () => {
    const legacy = {
      discovered: [1, 2, 3, 4, 5, 18, 19],
    }
    const out = migratePhase22(legacy) as { hasCosmosUnlocked: boolean }
    expect(out.hasCosmosUnlocked).toBe(true)

    // Также через discoveredLevels alias (top-level shape):
    const legacy2 = { discoveredLevels: [1, 5, 19] }
    const out2 = migratePhase22(legacy2) as { hasCosmosUnlocked: boolean }
    expect(out2.hasCosmosUnlocked).toBe(true)

    // Если 19 не открыт → false
    const legacy3 = { discovered: [1, 5, 18] }
    const out3 = migratePhase22(legacy3) as { hasCosmosUnlocked: boolean }
    expect(out3.hasCosmosUnlocked).toBe(false)
  })

  it('Test 6: initial fresh state (no legacy fields) — defaults применяются', () => {
    const fresh = { carriers: [], serums: { fire: 0, water: 0 } }
    const out = migratePhase22(fresh) as {
      essence: number
      ascendedCarriers: unknown[]
      permaSlotBonus: number
      permaShipSpeedBonus: number
      permaSerumDropBonus: number
      shopPurchaseCounts: Record<string, number>
      hasCosmosUnlocked: boolean
    }
    expect(out.essence).toBe(0)
    expect(out.ascendedCarriers).toEqual([])
    expect(out.permaSlotBonus).toBe(0)
    expect(out.permaShipSpeedBonus).toBe(0)
    expect(out.permaSerumDropBonus).toBe(0)
    expect(out.shopPurchaseCounts).toEqual({})
    expect(out.hasCosmosUnlocked).toBe(false)
  })

  it('Test 7: idempotency — migrate(migrate(x)) === migrate(x)', () => {
    const legacy = {
      carriers: [
        {
          frogId: 'f1',
          element: 'fire',
          rarity: 'rare',
          feedCount: 2,
          stabilized: false,
          level: 3,
        },
      ],
      serums: { fire: { common: 1, rare: 0, epic: 0, legendary: 0 }, water: 5 },
      discovered: [1, 19],
    }
    const once = migratePhase22(legacy)
    const twice = migratePhase22(once)
    expect(twice).toEqual(once)
  })

  it('Test 8: stabilized carrier — element + level выживают, лишние strip', () => {
    const legacy = {
      carriers: [
        {
          frogId: 'frog-x',
          element: 'water',
          rarity: 'legendary',
          stabilized: true,
          feedCount: 50,
          level: 12,
        },
      ],
    }
    const out = migratePhase22(legacy) as {
      carriers: Array<Record<string, unknown>>
    }
    expect(out.carriers[0]).toEqual({
      frogId: 'frog-x',
      element: 'water',
      level: 12,
    })
    expect(out.carriers[0].stabilized).toBeUndefined()
    expect(out.carriers[0].rarity).toBeUndefined()
    expect(out.carriers[0].feedCount).toBeUndefined()
  })

  it('Test 9: null / undefined / non-object → passthrough', () => {
    expect(migratePhase22(null)).toBeNull()
    expect(migratePhase22(undefined)).toBeUndefined()
    expect(migratePhase22(42 as unknown)).toBe(42)
    expect(migratePhase22('legacy-string' as unknown)).toBe('legacy-string')
  })

  it('Test 10: ascendedCarriers + essence preserved (no overwrite)', () => {
    const legacy = {
      ascendedCarriers: [{ id: 'asc-1', element: 'fire', ascendedAt: 100 }],
      essence: 7,
      permaSlotBonus: 2,
    }
    const out = migratePhase22(legacy) as {
      ascendedCarriers: unknown[]
      essence: number
      permaSlotBonus: number
    }
    expect(out.ascendedCarriers).toHaveLength(1)
    expect(out.essence).toBe(7)
    expect(out.permaSlotBonus).toBe(2)
  })
})
