// Phase 31 Plan 31-06: backward-compat migration тест.
//
// Проверяет что старые сейвы (без l19Count / baseTier / universeRestartCount)
// корректно загружаются с дефолтами и не вызывают крашей.
//
// Сама логика hydration описывает паттерн из gameSync.ts loadGameState —
// здесь мы тестируем инвариант напрямую через pure функцию, не через gameSync.
//
// Run: cd client && npx vitest run src/store/migrations/phase31.test.ts

import { describe, it, expect } from 'vitest'

// Pure hydration helper — зеркало логики из gameSync.ts loadGameState
// (секция Phase 31 поля в cosmic blob). Тестируем defensive ?? 0 паттерн.
function hydrateCosmicPhase31(c: Record<string, unknown>): {
  l19Count: number
  baseTier: number
  universeRestartCount: number
} {
  // Defensive: все поля имеют ?? 0 fallback, капы применяются как в applyRestartState.
  const raw_l19Count = 'l19Count' in c && typeof c.l19Count === 'number' ? c.l19Count : 0
  const raw_baseTier = 'baseTier' in c && typeof c.baseTier === 'number' ? c.baseTier : 0
  const raw_restartCount =
    'universeRestartCount' in c && typeof c.universeRestartCount === 'number'
      ? c.universeRestartCount
      : 0

  return {
    l19Count: Math.max(0, Math.floor(raw_l19Count)),
    baseTier: Math.max(0, Math.min(2, Math.floor(raw_baseTier))),
    universeRestartCount: Math.max(0, Math.floor(raw_restartCount)),
  }
}

describe('Phase 31 — backward compat migration (old save → default 0)', () => {
  it('old save without any new fields → all default to 0, no crash', () => {
    const oldCosmic = { hasCosmosUnlocked: true, l18MergesCount: 3 }
    const result = hydrateCosmicPhase31(oldCosmic)
    expect(result.l19Count).toBe(0)
    expect(result.baseTier).toBe(0)
    expect(result.universeRestartCount).toBe(0)
  })

  it('empty cosmic blob → all default to 0, no throw', () => {
    expect(() => hydrateCosmicPhase31({})).not.toThrow()
    const result = hydrateCosmicPhase31({})
    expect(result.l19Count).toBe(0)
    expect(result.baseTier).toBe(0)
    expect(result.universeRestartCount).toBe(0)
  })

  it('save with l19Count=3 loads correctly', () => {
    const cosmic = { l19Count: 3 }
    const result = hydrateCosmicPhase31(cosmic)
    expect(result.l19Count).toBe(3)
  })

  it('caps baseTier at 2 from cosmic blob (server sends >2)', () => {
    const cosmic = { baseTier: 99 }
    const result = hydrateCosmicPhase31(cosmic)
    expect(result.baseTier).toBe(2)
  })

  it('clamps negative baseTier to 0', () => {
    const cosmic = { baseTier: -5 }
    const result = hydrateCosmicPhase31(cosmic)
    expect(result.baseTier).toBe(0)
  })

  it('baseTier=2 unchanged (boundary)', () => {
    const cosmic = { baseTier: 2 }
    const result = hydrateCosmicPhase31(cosmic)
    expect(result.baseTier).toBe(2)
  })

  it('string l19Count gracefully defaults to 0 (type mismatch from corrupt save)', () => {
    // typeof '3' !== 'number' → defensive check → default 0
    const cosmic: Record<string, unknown> = { l19Count: '3' }
    const result = hydrateCosmicPhase31(cosmic)
    expect(result.l19Count).toBe(0)
  })

  it('null l19Count gracefully defaults to 0', () => {
    const cosmic: Record<string, unknown> = { l19Count: null }
    const result = hydrateCosmicPhase31(cosmic)
    expect(result.l19Count).toBe(0)
  })

  it('universeRestartCount=5 loads correctly', () => {
    const cosmic = { universeRestartCount: 5 }
    const result = hydrateCosmicPhase31(cosmic)
    expect(result.universeRestartCount).toBe(5)
  })

  it('fractional l19Count is floor-clamped to integer', () => {
    const cosmic = { l19Count: 2.9 }
    const result = hydrateCosmicPhase31(cosmic)
    expect(result.l19Count).toBe(2)
  })
})
