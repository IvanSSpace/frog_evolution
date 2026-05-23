// Серверный mirror cosmic-валидации. Должен оставаться синхронизированным с
// client/src/store/cosmic/types.ts.
// Phase 22: Rarity removed. Серум — плоский Record<Element, number>.
// Carrier — { frogId, element, level }.

// 2026-05-23: 16 → 11 (удалены shadow/arcane/mechanical/war/void — без planet archetype'ов).
// Должен оставаться синхронизированным с client/src/store/cosmic/types.ts.
export const ELEMENTS = [
  'fire',
  'ice',
  'water',
  'forest',
  'toxic',
  'plasma',
  'crystal',
  'desert',
  'gas',
  'ring',
  'binary',
] as const

export type Element = (typeof ELEMENTS)[number]

export interface CarrierData {
  frogId: string
  element: Element
  level: number
}

export type SerumsMap = {
  [E in Element]: number
}

/** Безопасный доступ к `cosmic.serums[element]` с fallback на 0. */
export function getSerumCount(serums: unknown, element: Element): number {
  if (!serums || typeof serums !== 'object') return 0
  const v = (serums as Record<string, unknown>)[element]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Возвращает обновлённый serums map с `serums[element] += delta`,
 *  не позволяя уйти ниже нуля. Не мутирует input. */
export function adjustSerum(
  serums: unknown,
  element: Element,
  delta: number,
): SerumsMap {
  const cur = getSerumCount(serums, element)
  const base = (serums && typeof serums === 'object'
    ? (serums as Record<string, number>)
    : {}) as Record<string, number>
  return { ...base, [element]: Math.max(0, cur + delta) } as SerumsMap
}

export function isValidElement(x: unknown): x is Element {
  return typeof x === 'string' && (ELEMENTS as readonly string[]).includes(x)
}
