// Phase 12: archetype/main-race → element маппинг.
// REQ ELEMENT-02 (BG archetypes → 12 elements) + ELEMENT-12 (main-race → 4 exclusives).
// Источник archetype keys: THEME_PALETTES в effects/anim/shared/sharedHelpers.ts.

import type { Element } from '../../../store/cosmic/types'

// 2026-05-23: серум типов 11 (1:1 с archetypes планет).
// dead → shadow убран (shadow удалён). Main-race exclusive elements удалены целиком.
export const ARCHETYPE_TO_ELEMENT: Record<string, Element> = {
  lava: 'fire',
  ice: 'ice',
  ocean: 'water',
  forest: 'forest',
  toxic: 'toxic',
  plasma: 'plasma',
  mineral: 'crystal',
  desert: 'desert',
  gas_giant: 'gas',
  gas_ringed: 'ring',
  binary: 'binary',
}

// Legacy: ранее main-race архетипы давали exclusive elements (arcane/mechanical/war/void).
// После сокращения серум-типов 1:1 с planet archetypes — main-race заходит через
// обычный archetype резолв; этот mapping больше не нужен.
export const MAIN_RACE_TO_ELEMENT: Record<string, Element> = {}

/**
 * Resolve element from planet metadata.
 * Priority: main race override (если планета — главная раса) → BG archetype.
 * @returns Element, или null если ни один маппинг не подошёл (не carrier-источник).
 */
export function elementFromPlanet(
  archetype: string | undefined,
  mainRaceType: string | undefined,
): Element | null {
  if (mainRaceType && MAIN_RACE_TO_ELEMENT[mainRaceType])
    return MAIN_RACE_TO_ELEMENT[mainRaceType]
  if (archetype && ARCHETYPE_TO_ELEMENT[archetype])
    return ARCHETYPE_TO_ELEMENT[archetype]
  return null
}

/**
 * Reverse lookup: element → archetype string (для сборки fake AnimSys в dormant presets).
 */
export function archetypeForElement(element: Element): string {
  switch (element) {
    case 'fire':
      return 'lava'
    case 'ice':
      return 'ice'
    case 'water':
      return 'ocean'
    case 'forest':
      return 'forest'
    case 'toxic':
      return 'toxic'
    case 'plasma':
      return 'plasma'
    case 'crystal':
      return 'mineral'
    case 'desert':
      return 'desert'
    case 'gas':
      return 'gas_giant'
    case 'ring':
      return 'gas_ringed'
    case 'binary':
      return 'binary'
  }
}
