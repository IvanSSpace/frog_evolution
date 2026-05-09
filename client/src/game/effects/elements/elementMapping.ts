// Phase 12: archetype/main-race → element маппинг.
// REQ ELEMENT-02 (BG archetypes → 12 elements) + ELEMENT-12 (main-race → 4 exclusives).
// Источник archetype keys: THEME_PALETTES в effects/anim/shared/sharedHelpers.ts.

import type { Element } from '../../../store/cosmic/types'

// BG planet archetype → element. 12 entries.
// Mapping rationale: каждый BG archetype в THEME_PALETTES имеет one-to-one соответствие
// с одним из 12 базовых elements (остальные 4 — exclusive через main race миссии).
export const ARCHETYPE_TO_ELEMENT: Record<string, Element> = {
  lava: 'fire',
  ice: 'ice',
  ocean: 'water',
  forest: 'forest',
  toxic: 'toxic',
  plasma: 'plasma',
  dead: 'shadow',
  mineral: 'crystal',
  desert: 'desert',
  gas_giant: 'gas',
  gas_ringed: 'ring',
  binary: 'binary',
}

// Main race type → element. ELEMENT-12: 4 exclusive elements,
// доступны только через миссии с main-race планет (миссии — Phase 16,
// Phase 12 хранит только маппинг для будущего использования).
// 6 ключей → 4 уникальных elements (mystic+ancient → arcane; military+forge → war;
//                                     shadow+destroyed → void; mechano → mechanical).
export const MAIN_RACE_TO_ELEMENT: Record<string, Element> = {
  mystic: 'arcane',
  ancient: 'arcane',
  mechano: 'mechanical',
  military: 'war',
  forge: 'war',
  shadow: 'void',
  destroyed: 'void',
}

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
 * 4 exclusive elements (arcane/mechanical/war/void) маппятся на main-race themes
 * (mystic/mechano/military/shadow), которые тоже есть в THEME_PALETTES.
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
    case 'shadow':
      return 'dead'
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
    case 'arcane':
      return 'mystic'
    case 'mechanical':
      return 'mechano'
    case 'war':
      return 'military'
    case 'void':
      return 'shadow'
  }
}
