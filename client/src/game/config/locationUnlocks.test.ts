import { describe, it, expect } from 'vitest'
import {
  getUnlockedLocations,
  isLocationUnlocked,
  getLocationUnlockedByLevel,
  LOCATION_UNLOCK_THRESHOLD,
  LOCATION_BY_TRIGGER_LEVEL,
} from './locationUnlocks'

describe('LOCATION_UNLOCK_THRESHOLD', () => {
  it('defines threshold for all 4 locations + starmap sentinel', () => {
    expect(LOCATION_UNLOCK_THRESHOLD).toEqual({
      1: 0,
      2: 7,
      3: 13,
      4: 19,
      6: 19,
    })
  })
})

describe('LOCATION_BY_TRIGGER_LEVEL', () => {
  it('reverse maps trigger levels to location ids', () => {
    expect(LOCATION_BY_TRIGGER_LEVEL).toEqual({
      7: 2,
      13: 3,
      19: 6,
    })
  })
})

describe('getUnlockedLocations', () => {
  it('returns only Лужа on empty discovered', () => {
    expect(getUnlockedLocations([])).toEqual(new Set([1]))
  })

  it('Болото opens when L7 discovered', () => {
    expect(getUnlockedLocations([1, 7])).toEqual(new Set([1, 2]))
  })

  it('Лес opens when L13 discovered', () => {
    expect(getUnlockedLocations([1, 7, 13])).toEqual(new Set([1, 2, 3]))
  })

  it('Континент + Звёздная карта opens when L19 sentinel discovered', () => {
    expect(getUnlockedLocations([1, 7, 13, 19])).toEqual(
      new Set([1, 2, 3, 4, 6]),
    )
  })

  it('tolerates non-contiguous discovery (corrupted save)', () => {
    expect(getUnlockedLocations([1, 19])).toEqual(new Set([1, 4, 6]))
  })

  it('intermediate levels do not unlock locations', () => {
    expect(getUnlockedLocations([1, 2, 3, 4, 5, 6])).toEqual(new Set([1]))
  })
})

describe('isLocationUnlocked', () => {
  it('returns true for Лужа always', () => {
    expect(isLocationUnlocked(1, [])).toBe(true)
  })

  it('returns false for Болото when L7 not discovered', () => {
    expect(isLocationUnlocked(2, [1, 6])).toBe(false)
  })

  it('returns true for Болото when L7 discovered', () => {
    expect(isLocationUnlocked(2, [7])).toBe(true)
  })

  it('returns false for unknown location id', () => {
    expect(isLocationUnlocked(99, [1, 7, 13, 19])).toBe(false)
  })
})

describe('getLocationUnlockedByLevel', () => {
  it('returns location id for trigger levels', () => {
    expect(getLocationUnlockedByLevel(7)).toBe(2)
    expect(getLocationUnlockedByLevel(13)).toBe(3)
    expect(getLocationUnlockedByLevel(19)).toBe(6)
  })

  it('returns null for non-trigger levels', () => {
    expect(getLocationUnlockedByLevel(1)).toBe(null)
    expect(getLocationUnlockedByLevel(8)).toBe(null)
    expect(getLocationUnlockedByLevel(18)).toBe(null)
  })
})
