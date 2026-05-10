// Phase 20-XX: LODManager — извлечён из StarMapScene.ts.
// Изолирует state, отвечающий за управление видимостью объектов в зависимости
// от zoom камеры (Level Of Detail).
//
// Что хранит:
//   - cullableData: список объектов для manual frustum culling + LOD-cut
//     (Phaser не делает frustum culling для Container).
//   - cullTickCounter: счётчик тиков для throttle culling (раз в 6 кадров).
//   - bgArchetypeGfx: archetype-specific graphics BG-планет, скрываются при
//     zoom < BG_DETAIL_MIN_ZOOM (~80% меньше draw calls).
//   - bgBatchGfx: 1-draw-call звёздное небо для zoom < BG_PLANET_MIN_ZOOM
//     (заменяет 434 индивидуальных контейнера).
//   - bgInteractiveContainers + bgInteractiveEnabled: контейнеры для batch-toggle
//     input.enabled при zoom < BG_INTERACTIVE_MIN_ZOOM (нет hit-test overhead).
//   - moons: спутники планет с орбит-state (angle/radius/speed). Видны только
//     при zoom > MOON_FADE_START, плавный fade-in до MOON_FADE_END.
//   - zoomCompStars: звёзды-ромбы, scale которых компенсирует zoom (видны
//     при отдалении).
//
// Public API минимален: state хранится в публичных полях, потому что update-tick
// логика (CoordinatesHUDController в coordinatesHUD.ts) и регистрационные
// call-sites (starfield.ts, cosmicDust ambient, renderBgPoint/renderMainPlanet
// в сцене) читают/мутируют эти коллекции напрямую.
//
// Сцена выставляет эти поля наружу через getter/setter делегацию к instance.
//
// История:
// • До рефакторинга все 7 полей жили на StarMapScene как package-public.
// • update-tick логика (toggle bg-details, toggle interactive, fade moons,
//   manual culling) уже вынесена ранее в CoordinatesHUDController; константы
//   (MOON_FADE_*, BG_*_MIN_ZOOM) — в planetarium.ts.
// • LODManager — контейнер state, не контейнер логики. Логика остаётся в
//   coordinatesHUD.ts.

import type Phaser from 'phaser'

export interface LODConstants {
  MOON_FADE_START: number
  MOON_FADE_END: number
  BG_DETAIL_MIN_ZOOM: number
  BG_INTERACTIVE_MIN_ZOOM: number
  BG_PLANET_MIN_ZOOM: number
}

export interface CullableEntry {
  obj: Phaser.GameObjects.GameObject & {
    visible: boolean
    setVisible: (v: boolean) => unknown
  }
  x: number
  y: number
  r: number
  /** Если zoom < lodMinZoom → объект скрыт независимо от viewport (LOD). */
  lodMinZoom?: number
}

export interface MoonEntry {
  obj: Phaser.GameObjects.Arc
  angle: number
  radius: number
  speed: number
}

export interface ZoomCompStarEntry {
  obj: Phaser.GameObjects.Graphics
  baseScale: number
}

export class LODManager {
  // Список объектов для manual culling + LOD-cut.
  cullableData: CullableEntry[] = []
  // Счётчик тиков для throttle culling (раз в 6 кадров).
  cullTickCounter = 0
  // Детализация BG-планет (archetype-specific графика).
  bgArchetypeGfx: Phaser.GameObjects.Graphics[] = []
  // Batch-рендер всех BG как точек в одном Graphics — для экстремального zoom.
  bgBatchGfx: Phaser.GameObjects.Graphics | null = null
  // Контейнеры BG-планет для batch-toggle interactive по zoom.
  bgInteractiveContainers: Phaser.GameObjects.Container[] = []
  bgInteractiveEnabled = true
  // Спутники планет — рендерятся только при zoom >= MOON_FADE_START.
  moons: MoonEntry[] = []
  // Звёзды, scale которых компенсирует zoom (видны при отдалении).
  zoomCompStars: ZoomCompStarEntry[] = []

  // Константы LOD сохранены как публичные readonly — чтобы при необходимости
  // снаружи (тесты / диагностика) можно было прочитать пороги. CoordinatesHUD
  // получает их отдельным config object и не зависит от LODManager.
  readonly constants: LODConstants

  constructor(constants: LODConstants) {
    this.constants = constants
  }
}
