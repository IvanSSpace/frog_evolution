// Phase 26 Plan 26-02: invariants tests для habitable planets API.
//
// Покрывает:
//   - 30 planets total (constraint от Plan 26-02).
//   - per-race distribution (3 planets = 1 home + 2 colonies × 10 races).
//   - totals (10 home + 20 colonies).
//   - id='home' (player base) — НИКОГДА не inhabitant.
//   - getPlanetInhabitant() undefined для non-existent IDs.
//   - HABITABLE_PLANET_IDS Set size + membership.
//   - uniqueness 30 IDs.

import { describe, it, expect } from 'vitest'
import { RACES } from '../config/races'
import {
  getHabitablePlanets,
  getPlanetInhabitant,
  getPlanetsByRace,
  HABITABLE_PLANET_IDS,
} from './habitablePlanets'

describe('habitablePlanets', () => {
  it('returns 30 habitable planets', () => {
    expect(getHabitablePlanets()).toHaveLength(30)
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

  it('total: 10 home + 20 colony', () => {
    const all = getHabitablePlanets()
    const homes = all.filter((p) => p.inhabitant.role === 'home')
    const colonies = all.filter((p) => p.inhabitant.role === 'colony')
    expect(homes).toHaveLength(10)
    expect(colonies).toHaveLength(20)
  })

  it('player home planet (id="home") is never inhabitant', () => {
    const homePlayer = getHabitablePlanets().find((p) => p.id === 'home')
    expect(homePlayer).toBeUndefined()
  })

  it('getPlanetInhabitant returns undefined for uninhabited', () => {
    const inh = getPlanetInhabitant('definitely-not-real-id-12345')
    expect(inh).toBeUndefined()
  })

  it('HABITABLE_PLANET_IDS set has 30 entries matching getHabitablePlanets', () => {
    expect(HABITABLE_PLANET_IDS.size).toBe(30)
    for (const p of getHabitablePlanets()) {
      expect(HABITABLE_PLANET_IDS.has(p.id)).toBe(true)
    }
  })

  it('all 30 planet IDs are unique', () => {
    const ids = getHabitablePlanets().map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
