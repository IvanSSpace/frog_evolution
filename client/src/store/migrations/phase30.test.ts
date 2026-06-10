// Phase 30 Plan 30-08: migration strip dead factory/drone fields — unit tests (vitest).
// Run: cd client && npx vitest run src/store/migrations/phase30.test.ts
//
// Coverage:
//   Test 1: Strip ectoplasm from old save
//   Test 2: Strip loc2Upgrades from old save
//   Test 3: Strip currencyY from old save
//   Test 4: Strip droneSlots from upgrades (upgraded from upgrades, not top-level)
//   Test 5: Strip collectorDrones from upgrades
//   Test 6: Strip magnetDrones from upgrades
//   Test 7: Idempotent — migratePhase30(migratePhase30(data)) === migratePhase30(data)
//   Test 8: Preserves gold/coins field
//   Test 9: Preserves upgrades.magnet field (D-03: must NOT be stripped)
//   Test 10: No-op on clean save data (no dead fields)
//   Test 11: Handles null/undefined input safely (returns input as-is)
//   Test 12: Handles missing upgrades key (no crash if upgrades is absent)

import { describe, it, expect } from 'vitest'
import { migratePhase30 } from './phase30'

describe('migratePhase30', () => {
  it('Test 1: Strip ectoplasm from old save', () => {
    const old = {
      gold: 500,
      ectoplasm: 99,
    }
    const out = migratePhase30(old) as Record<string, unknown>
    expect(out.ectoplasm).toBeUndefined()
    expect(out.gold).toBe(500)
  })

  it('Test 2: Strip loc2Upgrades from old save', () => {
    const old = {
      gold: 100,
      loc2Upgrades: { conveyorSpeed: 3, capsuleSpeed: 2 },
    }
    const out = migratePhase30(old) as Record<string, unknown>
    expect(out.loc2Upgrades).toBeUndefined()
    expect(out.gold).toBe(100)
  })

  it('Test 3: Strip currencyY from old save', () => {
    const old = {
      gold: 200,
      currencyY: 42,
    }
    const out = migratePhase30(old) as Record<string, unknown>
    expect(out.currencyY).toBeUndefined()
    expect(out.gold).toBe(200)
  })

  it('Test 4: Preserve upgrades.droneSlots (purchasable upgrade, not drone-machinery)', () => {
    // droneSlots is a purchasable upgrade that survived the cut (Plan 30-05).
    // It MUST NOT be stripped — only collectorDrones/magnetDrones are drone-machinery.
    const old = {
      upgrades: {
        dropSpeed: 2,
        magnet: 3,
        droneSlots: 5,
        collectorDrones: 2,
        magnetDrones: 1,
      },
    }
    const out = migratePhase30(old) as { upgrades: Record<string, unknown> }
    expect(out.upgrades.droneSlots).toBe(5)
    expect(out.upgrades.collectorDrones).toBeUndefined()
    expect(out.upgrades.magnetDrones).toBeUndefined()
    expect(out.upgrades.dropSpeed).toBe(2)
    expect(out.upgrades.magnet).toBe(3)
  })

  it('Test 5: Strip upgrades.collectorDrones from old save', () => {
    const old = {
      upgrades: {
        magnet: 2,
        collectorDrones: 4,
        autoCollect: 1,
      },
    }
    const out = migratePhase30(old) as { upgrades: Record<string, unknown> }
    expect(out.upgrades.collectorDrones).toBeUndefined()
    // autoCollect is passive QoL — must be preserved (D-03)
    expect(out.upgrades.autoCollect).toBe(1)
    expect(out.upgrades.magnet).toBe(2)
  })

  it('Test 6: Strip upgrades.magnetDrones from old save', () => {
    const old = {
      upgrades: {
        magnet: 1,
        magnetDrones: 3,
      },
    }
    const out = migratePhase30(old) as { upgrades: Record<string, unknown> }
    expect(out.upgrades.magnetDrones).toBeUndefined()
    expect(out.upgrades.magnet).toBe(1)
  })

  it('Test 7: Idempotent — migrate(migrate(data)) deep-equals migrate(data)', () => {
    const old = {
      gold: 999,
      ectoplasm: 10,
      loc2Upgrades: { conveyorSpeed: 1 },
      currencyY: 5,
      upgrades: {
        dropSpeed: 1,
        magnet: 2,
        autoCollect: 3,
        droneSlots: 4,
        collectorDrones: 2,
        magnetDrones: 1,
      },
    }
    const once = migratePhase30(old)
    const twice = migratePhase30(once)
    expect(twice).toEqual(once)
  })

  it('Test 8: Preserves gold/coins field', () => {
    const old = {
      gold: 12345,
      coins: 678,
      ectoplasm: 1,
    }
    const out = migratePhase30(old) as Record<string, unknown>
    expect(out.gold).toBe(12345)
    expect(out.coins).toBe(678)
  })

  it('Test 9: Preserves upgrades.magnet and upgrades.autoCollect (D-03: passive QoL)', () => {
    const old = {
      upgrades: {
        magnet: 5,
        magnet2: 3,
        magnet3: 1,
        autoCollect: 4,
        collectorDrones: 2,
        magnetDrones: 2,
      },
    }
    const out = migratePhase30(old) as { upgrades: Record<string, unknown> }
    // These MUST be preserved — stripping them = user data loss (D-03)
    expect(out.upgrades.magnet).toBe(5)
    expect(out.upgrades.magnet2).toBe(3)
    expect(out.upgrades.magnet3).toBe(1)
    expect(out.upgrades.autoCollect).toBe(4)
    // Drone-machinery stripped
    expect(out.upgrades.collectorDrones).toBeUndefined()
    expect(out.upgrades.magnetDrones).toBeUndefined()
  })

  it('Test 10: No-op on clean save (no dead fields) — unchanged', () => {
    const clean = {
      gold: 100,
      upgrades: {
        dropSpeed: 2,
        magnet: 3,
        autoCollect: 1,
        droneSlots: 0,
      },
      cosmicSlice: { essence: 10 },
    }
    const out = migratePhase30(clean)
    expect(out).toEqual(clean)
  })

  it('Test 11: Handles null/undefined input safely (returns as-is)', () => {
    expect(migratePhase30(null)).toBeNull()
    expect(migratePhase30(undefined)).toBeUndefined()
    expect(migratePhase30(42 as unknown)).toBe(42)
    expect(migratePhase30('legacy' as unknown)).toBe('legacy')
  })

  it('Test 12: Handles missing upgrades key (no crash)', () => {
    const old = {
      gold: 50,
      ectoplasm: 9,
    }
    const out = migratePhase30(old) as Record<string, unknown>
    expect(out.ectoplasm).toBeUndefined()
    expect(out.gold).toBe(50)
    expect(out.upgrades).toBeUndefined()
  })
})
