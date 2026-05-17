// Phase 22 Plan 22-03: unit tests for archetype bonus aggregation.
// Run: cd client && npx vitest run src/utils/archetypeBonuses.test.ts
//
// Two-tier scheme:
//   - FULL bonus: granted per ascended carrier, stacks linearly.
//   - MINI bonus: granted while carrier is on field (L1..L17),
//     teaser ≈10% of full, NOT stacked within the same category
//     (multiple fire-category carriers give the mini fire bonus only once).
//
// Plan 22-04 will consume aggregateFullBonuses + aggregateMiniBonuses for HUD.

import { describe, it, expect } from 'vitest'
import { ELEMENTS, type Element } from '../store/cosmic/types'
import {
  ELEMENT_TO_CATEGORY,
  BONUS_PER_CATEGORY,
  MINI_BONUS_PER_CATEGORY,
  aggregateFullBonuses,
  aggregateMiniBonuses,
  type ArchetypeCategory,
} from './archetypeBonuses'

const VALID_CATEGORIES: ReadonlySet<ArchetypeCategory> = new Set([
  'fire',
  'water',
  'stone',
  'shadow',
  'other',
])

describe('archetypeBonuses — element → category mapping', () => {
  it('Test 1: all 16 elements have a defined category', () => {
    for (const el of ELEMENTS) {
      const cat = ELEMENT_TO_CATEGORY[el]
      expect(cat).toBeDefined()
      expect(VALID_CATEGORIES.has(cat)).toBe(true)
    }
  })

  it('Test 2: categories distributed per D-Archetype Bonuses (3+3+3+4+3 = 16)', () => {
    // Огонь: fire, plasma, war
    expect(ELEMENT_TO_CATEGORY.fire).toBe('fire')
    expect(ELEMENT_TO_CATEGORY.plasma).toBe('fire')
    expect(ELEMENT_TO_CATEGORY.war).toBe('fire')

    // Вода: water, forest, gas
    expect(ELEMENT_TO_CATEGORY.water).toBe('water')
    expect(ELEMENT_TO_CATEGORY.forest).toBe('water')
    expect(ELEMENT_TO_CATEGORY.gas).toBe('water')

    // Камень: crystal, mechanical, ring
    expect(ELEMENT_TO_CATEGORY.crystal).toBe('stone')
    expect(ELEMENT_TO_CATEGORY.mechanical).toBe('stone')
    expect(ELEMENT_TO_CATEGORY.ring).toBe('stone')

    // Тень: shadow, void, arcane, binary
    expect(ELEMENT_TO_CATEGORY.shadow).toBe('shadow')
    expect(ELEMENT_TO_CATEGORY.void).toBe('shadow')
    expect(ELEMENT_TO_CATEGORY.arcane).toBe('shadow')
    expect(ELEMENT_TO_CATEGORY.binary).toBe('shadow')

    // Прочее: ice, toxic, desert
    expect(ELEMENT_TO_CATEGORY.ice).toBe('other')
    expect(ELEMENT_TO_CATEGORY.toxic).toBe('other')
    expect(ELEMENT_TO_CATEGORY.desert).toBe('other')

    // Sanity: 16 unique elements
    const seen = new Set<Element>()
    for (const el of ELEMENTS) seen.add(el)
    expect(seen.size).toBe(16)
  })
})

describe('archetypeBonuses — BONUS_PER_CATEGORY (full)', () => {
  it('Test 3: full values per D', () => {
    expect(BONUS_PER_CATEGORY.fire).toEqual({
      key: 'boxDropSpeed',
      amount: 0.05,
    })
    expect(BONUS_PER_CATEGORY.water).toEqual({
      key: 'tractorGold',
      amount: 0.05,
    })
    expect(BONUS_PER_CATEGORY.stone).toEqual({
      key: 'offlineCap',
      amount: 0.1,
    })
    expect(BONUS_PER_CATEGORY.shadow).toEqual({
      key: 'serumDrop',
      amount: 0.01,
    })
    expect(BONUS_PER_CATEGORY.other).toEqual({
      key: 'flatGold',
      amount: 0.03,
    })
  })
})

describe('archetypeBonuses — MINI_BONUS_PER_CATEGORY (≈10% of full)', () => {
  it('Test 4: mini values per D', () => {
    expect(MINI_BONUS_PER_CATEGORY.fire).toEqual({
      key: 'boxDropSpeed',
      amount: 0.005,
    })
    expect(MINI_BONUS_PER_CATEGORY.water).toEqual({
      key: 'tractorGold',
      amount: 0.005,
    })
    expect(MINI_BONUS_PER_CATEGORY.stone).toEqual({
      key: 'offlineCap',
      amount: 0.01,
    })
    expect(MINI_BONUS_PER_CATEGORY.shadow).toEqual({
      key: 'serumDrop',
      amount: 0.001,
    })
    expect(MINI_BONUS_PER_CATEGORY.other).toEqual({
      key: 'flatGold',
      amount: 0.003,
    })
  })
})

describe('archetypeBonuses — aggregateFullBonuses (linear stack)', () => {
  it('Test 5: two fire-category + one water-category stacks linearly', () => {
    const result = aggregateFullBonuses([
      { element: 'fire' },
      { element: 'plasma' },
      { element: 'water' },
    ])
    expect(result.boxDropSpeed).toBeCloseTo(0.1, 10) // 0.05 * 2
    expect(result.tractorGold).toBeCloseTo(0.05, 10)
    expect(result.offlineCap).toBe(0)
    expect(result.serumDrop).toBe(0)
    expect(result.flatGold).toBe(0)
  })

  it('Test 6: empty input → all zeros', () => {
    const result = aggregateFullBonuses([])
    expect(result.boxDropSpeed).toBe(0)
    expect(result.tractorGold).toBe(0)
    expect(result.offlineCap).toBe(0)
    expect(result.serumDrop).toBe(0)
    expect(result.flatGold).toBe(0)
  })

  it('Test 7: one carrier per each of 16 elements → expected category sums', () => {
    const ascended = ELEMENTS.map((el) => ({ element: el }))
    const result = aggregateFullBonuses(ascended)
    // 3 fire-cat × 0.05 = 0.15
    expect(result.boxDropSpeed).toBeCloseTo(0.15, 10)
    // 3 water-cat × 0.05 = 0.15
    expect(result.tractorGold).toBeCloseTo(0.15, 10)
    // 3 stone-cat × 0.10 = 0.30
    expect(result.offlineCap).toBeCloseTo(0.3, 10)
    // 4 shadow-cat × 0.01 = 0.04
    expect(result.serumDrop).toBeCloseTo(0.04, 10)
    // 3 other-cat × 0.03 = 0.09
    expect(result.flatGold).toBeCloseTo(0.09, 10)
  })
})

describe('archetypeBonuses — aggregateMiniBonuses (max per category)', () => {
  it('Test 8: single fire carrier on field → mini fire bonus', () => {
    const result = aggregateMiniBonuses([{ element: 'fire' }])
    expect(result.boxDropSpeed).toBeCloseTo(0.005, 10)
    expect(result.tractorGold).toBe(0)
    expect(result.offlineCap).toBe(0)
    expect(result.serumDrop).toBe(0)
    expect(result.flatGold).toBe(0)
  })

  it('Test 9: multiple carriers in same fire-category → mini NOT stacked', () => {
    const result = aggregateMiniBonuses([
      { element: 'fire' },
      { element: 'plasma' },
      { element: 'war' },
    ])
    // All three are fire-category → mini bonus applies only once
    expect(result.boxDropSpeed).toBeCloseTo(0.005, 10)
    expect(result.tractorGold).toBe(0)
    expect(result.offlineCap).toBe(0)
    expect(result.serumDrop).toBe(0)
    expect(result.flatGold).toBe(0)
  })

  it('Test 10: different categories DO stack together', () => {
    const result = aggregateMiniBonuses([
      { element: 'fire' }, // fire-cat
      { element: 'water' }, // water-cat
      { element: 'crystal' }, // stone-cat
    ])
    expect(result.boxDropSpeed).toBeCloseTo(0.005, 10)
    expect(result.tractorGold).toBeCloseTo(0.005, 10)
    expect(result.offlineCap).toBeCloseTo(0.01, 10)
    expect(result.serumDrop).toBe(0)
    expect(result.flatGold).toBe(0)
  })

  it('Test 11: empty input → all zeros', () => {
    const result = aggregateMiniBonuses([])
    expect(result.boxDropSpeed).toBe(0)
    expect(result.tractorGold).toBe(0)
    expect(result.offlineCap).toBe(0)
    expect(result.serumDrop).toBe(0)
    expect(result.flatGold).toBe(0)
  })
})
