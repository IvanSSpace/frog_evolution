// Phase 20-XX (StarMapScene refactor, step 2): "Planetarium" layer extracted.
// Purely declarative pieces of the star map: world/zoom thresholds, archetype hue
// palette, MAIN_RACES catalog (sourced from planetMap.json), and pure helpers
// (hslToHex, generatePalette).
//
// Содержит только данные и pure-функции — никакого Phaser runtime state.
// StarMapScene/контроллеры/starfield импортируют отсюда константы и helpers.

import planetMap from '../../data/planetMap.json'
import type { Race, Archetype, PlanetMapEntry } from './types'

// Device pixel ratio — clamp [1..2]. Все DPR-зависимые координаты/размеры
// в planetMap.json хранятся в DPR=1 base, в runtime умножаются на real DPR.
// Cap=2 синхронизирован с game/index.ts — выше DPR mobile WebView не вытягивает.
export const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))

// Размер мира — 7000 от центра (полный 14000)
export const WORLD_SIZE = 7000 * DPR

// Глобальный seed для процедурной генерации (BG-планеты, starfield, кластеры).
export const SEED = 19450707

// Спутники появляются плавным fade-in между MOON_FADE_START и MOON_FADE_END.
// Ниже START — alpha 0, выше END — alpha 1, между — линейный переход.
// Цель: спутники видны только при близком zoom (>0.85), не грузят сцену при отдалении.
export const MOON_FADE_START = 0.7
export const MOON_FADE_END = 0.85

// Минимальный zoom, при котором BG-контейнеры (с детальным рендером + interactivity)
// показываются. Ниже — batch-точки (звёздное небо, 1 draw call). Не кликабельны.
// 0.35 (раньше 0.08) — на mobile zoom 0.18-0.40 viewport покрывает почти весь
// мир, viewport-culling не помогает, и 984 контейнеров одновременно убивали FPS.
// Теперь до zoom 0.35 показываем batch (1 draw call с цветными точками),
// детальный рендер планет включается только когда юзер реально приближается.
export const BG_PLANET_MIN_ZOOM = 0.35

// Минимальный zoom, при котором рисуется ДЕТАЛИЗАЦИЯ BG-планет
// (archetype-specific узоры + universal modifiers).
// 0.5 (раньше 0.10) — детали реально видны только при close-up, на mid-zoom они
// микроскопические но дорогие. Когда планета меньше 5px на экране — детали бесполезны.
export const BG_DETAIL_MIN_ZOOM = 0.5

// Минимальный zoom, при котором планеты (BG + main) кликабельны.
// Ниже — interactive отключён (планеты выглядят как точки, клики бессмысленны).
// Это снимает hit-test overhead с pointer events во время drag/pinch.
export const BG_INTERACTIVE_MIN_ZOOM = 0.41

// MAIN_RACES читаются из planetMap.json — источник истины для всех 16 главных рас.
// Координаты/размеры в JSON хранятся в DPR=1 base, в runtime умножаются на real DPR.
// Чтобы изменить позицию/цвет/размер главной расы — правь planetMap.json напрямую.
export const MAIN_RACES: Race[] = (planetMap.planets as PlanetMapEntry[])
  .filter((p) => p.kind === 'main')
  .map((p) => ({
    id: p.id,
    name: p.name,
    x: p.x * DPR,
    y: p.y * DPR,
    type: p.type,
    color: p.color,
    accent: p.accent,
    size: p.size * DPR,
  }))

// Базовые HSL hue по архетипам (диапазон). Цвет генерируется из этого
// + рандомное смещение, чтобы каждая планета имела УНИКАЛЬНЫЙ оттенок.
export const ARCHETYPE_HUES: Record<Archetype, [number, number]> = {
  gas_giant: [25, 55], // жёлто-оранжевый
  gas_ringed: [260, 295], // фиолетовый
  ice: [180, 220], // голубой
  ocean: [200, 230], // синий
  desert: [30, 50], // песочный
  lava: [0, 25], // красно-оранжевый
  forest: [90, 140], // зелёный
  mineral: [200, 280], // серо-синий-фиолет
  dead: [200, 240], // холодный серый
  toxic: [80, 130], // ядовито-зелёный
  plasma: [20, 50], // оранжево-жёлтый
  binary: [0, 360], // любой (две планеты разных цветов)
}

export function hslToHex(h: number, s: number, l: number): number {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  const r = Math.round(f(0) * 255)
  const g = Math.round(f(8) * 255)
  const b = Math.round(f(4) * 255)
  return (r << 16) | (g << 8) | b
}

export function generatePalette(
  archetype: Archetype,
  rng: () => number,
): { color: number; accent: number } {
  const [hMin, hMax] = ARCHETYPE_HUES[archetype]
  const h = hMin + rng() * (hMax - hMin)
  const s = 55 + rng() * 35
  const l = 55 + rng() * 20
  const color = hslToHex(h, s, l)
  // Accent — родственный hue со сдвигом + другая яркость
  const hAccent = (h + (rng() - 0.5) * 30 + 360) % 360
  const accent = hslToHex(hAccent, s + 5, Math.max(15, l - 25))
  return { color, accent }
}
