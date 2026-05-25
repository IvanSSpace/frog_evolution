// Phase 20-01: types extracted from StarMapScene.ts.
// Pure type definitions без зависимостей от runtime state класса.
// Используются как StarMapScene.ts, так и (в будущих волнах) extracted controllers.
// Phase 26 Plan 26-02: добавлен optional `inhabitant?: PlanetInhabitant` для 30 of 350
// habitable planets (1 home + 2 colonies × 10 races) — см. habitablePlanets.ts API.

import type { PlanetInhabitant } from '../../../store/cosmic/types'

// Shape of entries in planetMap.json — superset of Race/BgSystem fields.
export interface PlanetMapEntry {
  kind: string
  id: string
  name: string
  x: number
  y: number
  type: string
  color: number
  accent: number
  size: number
  // Phase 26 Plan 26-02: optional race ownership (30 of 350 entries set this).
  // Undefined for the remaining 320 uninhabited planets.
  inhabitant?: PlanetInhabitant
  [key: string]: unknown
}

export interface Race {
  id: string
  name: string
  x: number
  y: number
  type: string
  color: number
  accent: number
  size: number
  // Биом планеты (fire/ice/desert/toxic) — определяет raid-фон локаций.
  biome?: string
}

// Архетипы планет — визуальная типизация. Каждая фоновая получает один.
export type Archetype =
  | 'gas_giant' // газовый гигант (большой, полосы)
  | 'gas_ringed' // газовый с кольцом (редкий, очень большой)
  | 'ice' // ледяной (белый+голубой, блики)
  | 'ocean' // водный (голубой+белый облака)
  | 'desert' // пустынный (жёлто-оранжевый)
  | 'lava' // лавовый (красный+чёрный, трещины)
  | 'forest' // лесной/живой (зелёный)
  | 'mineral' // рудный (металлик)
  | 'dead' // мёртвый (серый, кратеры)
  | 'toxic' // токсичный (фиолетовый, ядовитый)
  | 'plasma' // плазменный (горячий, лучи)
  | 'binary' // двойной шар (два сросшихся)

export interface BgSystem {
  id: string
  name: string
  x: number
  y: number
  // Игровой тип — для логики экспедиций
  type: 'resource' | 'hostile' | 'empty'
  // Визуальный архетип — для рендера
  archetype: Archetype
  color: number
  accent: number
  size: number
  brightness: number
  hasMoon: boolean
  rngSeed: number
  // Обитаема ли (если да — над ней значок цивилизации, акцент ярче)
  isInhabited?: boolean
}
