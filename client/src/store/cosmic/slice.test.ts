// Phase 15 Plan 15-01 Task 2: unit tests for box actions in cosmicSlice.
// Phase 22: rewritten — rarity removed, flat serums model.
// Phase 22 Plan 22-06: commitOpenedBox is cosmos-gated. Tests below set
// hasCosmosUnlocked=true at the harness level so the serum increment path runs.
// See client/src/store/cosmic/slices/boxSlice.ts (cosmosUnlocked guard).
//
// Phase 28 tech-debt: migrated from top-level `node:assert/strict` ad-hoc runner
// to vitest describe/it (vitest 4 не подбирал старый формат — «No test suite found»).

import { describe, it, expect } from 'vitest'

// Polyfill crypto.randomUUID (vitest happy-dom уже даёт, но безопасно).
if (
  !(globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID
) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `${Date.now()}-${Math.random()}` },
  })
}

import { createCosmicSlice } from './slice'
import type { CosmicState } from './slice'

interface Harness {
  state: () => CosmicState
}

// Harness shape mirrors other cosmic tests. hasCosmosUnlocked lives on the
// root gameStore; we inject it через spread set() so boxSlice's narrow cast
// видит флаг (Phase 22 Plan 22-06 cosmos gate).
function makeHarness(): Harness {
  let state: CosmicState | undefined
  const set = (partial: Partial<CosmicState>): void => {
    state = { ...(state as CosmicState), ...partial }
  }
  const get = (): CosmicState => state as CosmicState
  state = createCosmicSlice(set, get)
  set({ hasCosmosUnlocked: true } as unknown as Partial<CosmicState>)
  return { state: () => state as CosmicState }
}

describe('cosmic slice — box actions (cosmos-unlocked)', () => {
  it('Test 1: addBox returns BoxData with auto-id, opened=false, createdAt > 0', () => {
    const h = makeHarness()
    const box = h.state().addBox({
      planetId: 'p1',
      planetName: 'Kepler',
      archetype: 'lava',
      element: 'fire',
    })
    expect(typeof box.id).toBe('string')
    expect(box.id.length).toBeGreaterThan(0)
    expect(box.opened).toBe(false)
    expect(box.createdAt).toBeGreaterThan(0)
    expect(box.element).toBe('fire')
    expect(h.state().boxes.length).toBe(1)
  })

  it('Test 2: addBox дважды → 2 boxes, ids различаются', () => {
    const h = makeHarness()
    const a = h.state().addBox({
      planetId: 'p',
      planetName: 'A',
      archetype: 'lava',
      element: 'fire',
    })
    const b = h.state().addBox({
      planetId: 'p',
      planetName: 'B',
      archetype: 'ice',
      element: 'ice',
    })
    expect(h.state().boxes.length).toBe(2)
    expect(a.id).not.toBe(b.id)
  })

  it('Test 3: rollBoxRarity unknown id → null', () => {
    const h = makeHarness()
    expect(h.state().rollBoxRarity('unknown')).toBeNull()
  })

  it('Test 4: rollBoxRarity для removed box → null', () => {
    const h = makeHarness()
    const box = h.state().addBox({
      planetId: 'p',
      planetName: 'A',
      archetype: 'lava',
      element: 'fire',
    })
    h.state().commitOpenedBox(box.id)
    expect(h.state().rollBoxRarity(box.id)).toBeNull()
  })

  it('Test 5: rollBoxRarity returns {element} без mutation', () => {
    const h = makeHarness()
    const box = h.state().addBox({
      planetId: 'p',
      planetName: 'A',
      archetype: 'lava',
      element: 'fire',
    })
    const before = JSON.stringify({
      serums: h.state().serums,
      boxesLen: h.state().boxes.length,
    })
    const result = h.state().rollBoxRarity(box.id)
    expect(result).not.toBeNull()
    expect(result!.element).toBe('fire')
    const after = JSON.stringify({
      serums: h.state().serums,
      boxesLen: h.state().boxes.length,
    })
    expect(after).toBe(before)
  })

  it('Test 6: commitOpenedBox → serum[element]++, box removed', () => {
    const h = makeHarness()
    const box = h.state().addBox({
      planetId: 'p',
      planetName: 'A',
      archetype: 'lava',
      element: 'fire',
    })
    const before = h.state().serums.fire ?? 0
    h.state().commitOpenedBox(box.id)
    expect(h.state().serums.fire).toBe(before + 1)
    expect(h.state().boxes.length).toBe(0)
  })

  it('Test 7: commitOpenedBox unknown id → no-op', () => {
    const h = makeHarness()
    const before = JSON.stringify({ serums: h.state().serums })
    h.state().commitOpenedBox('unknown')
    const after = JSON.stringify({ serums: h.state().serums })
    expect(after).toBe(before)
  })

  it('Test 8: commitOpenedBox arcane box → arcane serum +1', () => {
    const h = makeHarness()
    const box = h.state().addBox({
      planetId: 'p',
      planetName: 'A',
      archetype: 'mystic',
      element: 'arcane',
    })
    const before = h.state().serums.arcane ?? 0
    h.state().commitOpenedBox(box.id)
    expect(h.state().serums.arcane).toBe(before + 1)
  })

  it('Test 9: removeBox filters by id', () => {
    const h = makeHarness()
    const a = h.state().addBox({
      planetId: 'p',
      planetName: 'A',
      archetype: 'lava',
      element: 'fire',
    })
    const b = h.state().addBox({
      planetId: 'p',
      planetName: 'B',
      archetype: 'ice',
      element: 'ice',
    })
    h.state().removeBox(a.id)
    expect(h.state().boxes.length).toBe(1)
    expect(h.state().boxes[0].id).toBe(b.id)
  })

  it('Test 10: bonusRarity cosmetic flag preserved in addBox', () => {
    const h = makeHarness()
    const box = h.state().addBox({
      planetId: 'p',
      planetName: 'A',
      archetype: 'lava',
      element: 'fire',
      bonusRarity: 'epic',
    })
    expect(box.bonusRarity).toBe('epic')
    const r = h.state().rollBoxRarity(box.id)
    expect(r).not.toBeNull()
    expect(r!.element).toBe('fire')
  })

  it('Test 11: hasOpenedAnyBox toggled на commitOpenedBox', () => {
    const h = makeHarness()
    expect(h.state().hasOpenedAnyBox).toBe(false)
    const box = h.state().addBox({
      planetId: 'p',
      planetName: 'A',
      archetype: 'lava',
      element: 'fire',
    })
    h.state().commitOpenedBox(box.id)
    expect(h.state().hasOpenedAnyBox).toBe(true)
  })
})
