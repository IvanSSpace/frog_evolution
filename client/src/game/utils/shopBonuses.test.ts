// Phase 22 Plan 22-05: tests for pure shopBonuses helpers.
// Run: npx vitest run src/game/utils/shopBonuses.test.ts

import { describe, it, expect } from 'vitest'
import {
  effectiveSlotCap,
  shipSpeedMultiplier,
  serumDropChance,
} from './shopBonuses'

describe('shopBonuses helpers', () => {
  it('effectiveSlotCap: base + bonus', () => {
    expect(effectiveSlotCap(16, 0)).toBe(16)
    expect(effectiveSlotCap(16, 3)).toBe(19)
    expect(effectiveSlotCap(8, 5)).toBe(13)
  })

  it('shipSpeedMultiplier: 1 + 0.05 * bonus', () => {
    expect(shipSpeedMultiplier(0)).toBeCloseTo(1.0)
    expect(shipSpeedMultiplier(1)).toBeCloseTo(1.05)
    expect(shipSpeedMultiplier(4)).toBeCloseTo(1.2)
    expect(shipSpeedMultiplier(10)).toBeCloseTo(1.5)
  })

  it('serumDropChance: base + 0.005 * bonus, clamped [0,1]', () => {
    expect(serumDropChance(0.1, 0)).toBeCloseTo(0.1)
    expect(serumDropChance(0.1, 4)).toBeCloseTo(0.12)
    expect(serumDropChance(0.5, 1000)).toBe(1)
    expect(serumDropChance(0, 0)).toBe(0)
  })

  it('negative/garbage bonuses → treated as 0', () => {
    expect(effectiveSlotCap(10, -5)).toBe(10)
    expect(shipSpeedMultiplier(-2)).toBeCloseTo(1.0)
    expect(serumDropChance(0.1, -3)).toBeCloseTo(0.1)
    expect(effectiveSlotCap(10, NaN)).toBe(10)
  })
})
