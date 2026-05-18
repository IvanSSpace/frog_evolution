// Phase 26 Plan 26-02: habitable planets API.
//
// 30 of 350 planets отмечены inhabitant'ами в planetMap.json (1 home + 2 colonies × 10 races).
// Selection — ОДНОРАЗОВО выполнено через `client/scripts/select_habitable_planets.cjs`
// с seed=19450718 (= planetMap.meta.seed (19450707) + 11 derivative); JSON committed.
// После того как JSON committed — это runtime read-only API.
//
// Downstream consumers:
//   - Plan 26-03 (Star Map): rendering glow/icon на planets in HABITABLE_PLANET_IDS.
//   - Plan 26-05 (First contact): getPlanetInhabitant(tappedId) → controller resolves race.
//
// Performance: getHabitablePlanets() memoize'ит результат в module scope.
// HABITABLE_PLANET_IDS Set даёт O(1) lookup для render-loop'ов.

import type { PlanetInhabitant } from '../../store/cosmic/types'
import type { RaceId } from '../config/races'
import planetMap from './planetMap.json'

/**
 * Shape of a habitable planet — subset of planetMap.json entry fields с required
 * (non-optional) `inhabitant`. Используется в downstream rendering / inhabitant
 * resolution коде.
 */
export interface PlanetWithInhabitant {
  id: string
  name: string
  type: string
  x: number
  y: number
  size: number
  color: number
  inhabitant: PlanetInhabitant
}

// Module-scope memoization. Lazy-init'ится при first call.
let cachedHabitable: PlanetWithInhabitant[] | null = null

/**
 * Возвращает все habitable planets (30). Read-only — результат cached в module scope
 * после first call.
 */
export function getHabitablePlanets(): PlanetWithInhabitant[] {
  if (cachedHabitable !== null) return cachedHabitable
  // planetMap.json structurally typed по design (нет full TS типа для всего record);
  // narrow здесь через single `as` cast — downstream получает typed shape.
  const all = (planetMap as { planets: Array<Record<string, unknown>> }).planets
  const filtered = all.filter(
    (p) => (p as { inhabitant?: unknown }).inhabitant !== undefined
  ) as unknown as PlanetWithInhabitant[]
  cachedHabitable = filtered
  return cachedHabitable
}

/**
 * Получить inhabitant для planet ID. Returns undefined если planet uninhabited
 * (или planet ID не существует в planetMap).
 */
export function getPlanetInhabitant(
  planetId: string
): PlanetInhabitant | undefined {
  const found = getHabitablePlanets().find((p) => p.id === planetId)
  return found?.inhabitant
}

/**
 * Получить все planet'ы конкретной расы. Length === 3 для всех 10 рас
 * (1 home + 2 colonies — invariant validated in habitablePlanets.test.ts).
 */
export function getPlanetsByRace(raceId: RaceId): PlanetWithInhabitant[] {
  return getHabitablePlanets().filter((p) => p.inhabitant.raceId === raceId)
}

/**
 * Set из 30 IDs habitable planets — O(1) lookup для render-loop'ов (Plan 26-03).
 * Eager-инициализирован (вызывает getHabitablePlanets() и кеширует).
 */
export const HABITABLE_PLANET_IDS: ReadonlySet<string> = new Set(
  getHabitablePlanets().map((p) => p.id)
)
