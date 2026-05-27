// Phase 16: ship navigation + crew + mission constants/utils.
// Изолированы от других модулей — pure helpers, нет cyclic imports.

import planetMapJson from './planetMap.json'

// === World geometry ===
// WORLD_SIZE согласован с client/src/game/scenes/StarMapScene.ts:38 (DPR=1).
// Travel формула использует diagonal of "extended" world (×2): worst-case полёт
// от ~south-west до ~north-east bound.
export const WORLD_SIZE = 7000 // в DPR-units (planetMap.json уже в DPR=1)
export const WORLD_DIAGONAL = Math.SQRT2 * WORLD_SIZE * 2 // ≈ 19_798

// === Travel time formula (REQ SHIP-03) ===
// 2026-05-26: откат ускорения ~×12 полётов по космосу — возврат к исходным
// (медленным) длительностям. Ранее (2026-05-25) было ускорено до 12_000/500.
export const TRAVEL_MS_FOR_DIAGONAL = 120_000 // 120с для самого далёкого
export const TRAVEL_MS_MIN = 1_500 // floor для близких полётов

/** Travel time в ms для заданной distance (DPR-units). Линейная интерполяция,
 * clamped в [TRAVEL_MS_MIN, TRAVEL_MS_FOR_DIAGONAL]. */
export function travelTimeMs(distance: number): number {
  const ratio = Math.min(Math.max(distance, 0) / WORLD_DIAGONAL, 1)
  return Math.max(TRAVEL_MS_MIN, ratio * TRAVEL_MS_FOR_DIAGONAL)
}

/** Euclidean distance между двумя точками в DPR-units. */
export function planetDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

// === Crew (REQ CREW-02) ===
export const DAILY_CAP = 4 // максимум миссий в день

// === Mission result type ===
export type MissionResult = 'perfect' | 'good' | 'fail'

/** Result → bonusRarity multiplier (additive к base rarity roll). */
export function bonusRarityForResult(result: MissionResult): number {
  switch (result) {
    case 'perfect':
      return 0.15
    case 'good':
      return 0.05
    case 'fail':
      return 0
  }
}

// === Local date helper (FIX CREW-03) ===
/** ЛОКАЛЬНАЯ дата YYYY-MM-DD (НЕ UTC). Phase 11 использовал toISOString().slice(0,10),
 * что нарушает CREW-03 (reset по 00:00 локального часового пояса). */
export function getLocalDateString(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Время до следующей локальной полночи (ms). Используется в crew tooltip
 * countdown. */
export function msUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  )
  return next.getTime() - now.getTime()
}

// === Planet lookup ===
export interface PlanetInfo {
  id: string
  name: string
  kind: 'main' | 'bg'
  x: number
  y: number
  type?: string
  archetype?: string
  size?: number
  distFromHome?: number
}

// Cast JSON to typed array; planetMap.json schema контролируется генератором.
const PLANETS = (planetMapJson as { planets: PlanetInfo[] }).planets

const PLANET_INDEX: Map<string, PlanetInfo> = new Map(
  PLANETS.map((p) => [p.id, p]),
)

/** Lookup planet by id; null если не найден (на случай stale storage). */
export function findPlanetById(id: string): PlanetInfo | null {
  return PLANET_INDEX.get(id) ?? null
}

/** Resolve archetype + mainRaceType для elementFromPlanet().
 * BG planets имеют `archetype`; main race имеют `kind === 'main'` и используют `type` как mainRaceType. */
export function planetElementInputs(p: PlanetInfo): {
  archetype: string | undefined
  mainRaceType: string | undefined
} {
  if (p.kind === 'main') {
    return { archetype: undefined, mainRaceType: p.type }
  }
  return { archetype: p.archetype ?? p.type, mainRaceType: undefined }
}
