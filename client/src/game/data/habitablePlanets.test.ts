// Phase 26 Plan 26-02: invariants tests для habitable planets API.
//
// Покрывает:
//   - 27 planets total (9 рас × 3; gasouls удалена 2026-05-24).
//   - per-race distribution (3 planets = 1 home + 2 colonies × 9 races).
//   - totals (9 home + 18 colonies).
//   - id='home' (player base) — НИКОГДА не inhabitant.
//   - getPlanetInhabitant() undefined для non-existent IDs.
//   - HABITABLE_PLANET_IDS Set size + membership.
//   - uniqueness IDs.

import { describe, it, expect } from 'vitest'
import { RACES } from '../config/races'
import {
  getHabitablePlanets,
  getPlanetInhabitant,
  getPlanetsByRace,
  HABITABLE_PLANET_IDS,
} from './habitablePlanets'

describe('habitablePlanets', () => {
  it('returns 27 habitable planets', () => {
    expect(getHabitablePlanets()).toHaveLength(27)
  })

  it('every race has exactly 1 home + 2 colonies', () => {
    for (const race of RACES) {
      const planets = getPlanetsByRace(race.id)
      expect(planets).toHaveLength(3)
      const homes = planets.filter((p) => p.inhabitant.role === 'home')
      const colonies = planets.filter((p) => p.inhabitant.role === 'colony')
      expect(homes).toHaveLength(1)
      expect(colonies).toHaveLength(2)
    }
  })

  it('total: 9 home + 18 colony', () => {
    const all = getHabitablePlanets()
    const homes = all.filter((p) => p.inhabitant.role === 'home')
    const colonies = all.filter((p) => p.inhabitant.role === 'colony')
    expect(homes).toHaveLength(9)
    expect(colonies).toHaveLength(18)
  })

  it('player home planet (id="home") is never inhabitant', () => {
    const homePlayer = getHabitablePlanets().find((p) => p.id === 'home')
    expect(homePlayer).toBeUndefined()
  })

  it('getPlanetInhabitant returns undefined for uninhabited', () => {
    const inh = getPlanetInhabitant('definitely-not-real-id-12345')
    expect(inh).toBeUndefined()
  })

  it('HABITABLE_PLANET_IDS set has 27 entries matching getHabitablePlanets', () => {
    expect(HABITABLE_PLANET_IDS.size).toBe(27)
    for (const p of getHabitablePlanets()) {
      expect(HABITABLE_PLANET_IDS.has(p.id)).toBe(true)
    }
  })

  it('all planet IDs are unique', () => {
    const ids = getHabitablePlanets().map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
