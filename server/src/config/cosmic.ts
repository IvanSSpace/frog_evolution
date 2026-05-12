// Серверный mirror cosmic-валидации. Должен оставаться синхронизированным с
// client/src/utils/serumEligibility.ts и client/src/store/cosmic/types.ts.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export const ELEMENTS = [
  'fire',
  'ice',
  'water',
  'forest',
  'toxic',
  'plasma',
  'shadow',
  'crystal',
  'desert',
  'gas',
  'ring',
  'binary',
  'arcane',
  'mechanical',
  'war',
  'void',
] as const

export type Element = (typeof ELEMENTS)[number]

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary']

/** Уровень frog'а на котором сыворотка соответствующей rarity применима.
 *  legendary = 999 (sentinel — нет лягушек этого уровня после shrink). */
export const RARITY_TO_STARTING_LEVEL: Record<Rarity, number> = {
  common: 1,
  rare: 7,
  epic: 13,
  legendary: 999,
}

export interface CarrierData {
  frogId: string
  element: Element
  rarity: Rarity
  feedCount: number
  stabilized: boolean
  level: number
  /** опциональные поля присутствуют в реальных carrier'ах,
   *  серверу пока не нужны, но мы их сохраняем как есть. */
  ceiling?: unknown
  rollHistory?: unknown
}

export type SerumsMap = {
  [E in Element]: { [R in Rarity]: number }
}

/** Безопасный доступ к `cosmic.serums[element][rarity]` с fallback на 0. */
export function getSerumCount(
  serums: unknown,
  element: Element,
  rarity: Rarity,
): number {
  if (!serums || typeof serums !== 'object') return 0
  const byEl = (serums as Record<string, unknown>)[element]
  if (!byEl || typeof byEl !== 'object') return 0
  const v = (byEl as Record<string, unknown>)[rarity]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Возвращает обновлённый serums map с `serums[element][rarity] += delta`,
 *  не позволяя уйти ниже нуля. Не мутирует input. */
export function adjustSerum(
  serums: unknown,
  element: Element,
  rarity: Rarity,
  delta: number,
): SerumsMap {
  const cur = getSerumCount(serums, element, rarity)
  const base = (serums && typeof serums === 'object'
    ? (serums as Record<string, Record<string, number>>)
    : {}) as Record<string, Record<string, number>>
  const byEl = { ...(base[element] ?? {}) }
  byEl[rarity] = Math.max(0, cur + delta)
  return { ...base, [element]: byEl } as SerumsMap
}

export function isValidElement(x: unknown): x is Element {
  return typeof x === 'string' && (ELEMENTS as readonly string[]).includes(x)
}

export function isValidRarity(x: unknown): x is Rarity {
  return typeof x === 'string' && RARITIES.includes(x as Rarity)
}
