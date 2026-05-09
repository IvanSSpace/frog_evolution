// Phase 20-01: pure helpers extracted from StarMapScene.ts.
// Все функции без `this`, без побочных эффектов на класс.
// Sub-plan 20-01: foundation для последующих волн (controllers extract).

import type Phaser from 'phaser'
import type { Race, BgSystem } from './types'
import { DPR } from '../../effects/anim/shared/sharedHelpers'

// Mapping визуальный type → user-facing label на русском.
// Используется в popovers и BG name popups.
export const TYPE_LABELS: Record<string, string> = {
  home: 'Родина',
  crystal: 'Кристаллы',
  rocky: 'Камень',
  ancient: 'Древние',
  mystic: 'Провидцы',
  organic: 'Органики',
  forge: 'Кузнецы',
  military: 'Военные',
  destroyed: 'Уничтожено',
  crystal_bio: 'Кристалло-биоты',
  mechano: 'Механо',
  energy: 'Энергеты',
  mist: 'Туман',
  aquatic: 'Водные',
  shadow: 'Тени',
  aerial: 'Воздушные',
}

// Детерминированный PRNG. Один и тот же seed → одна и та же последовательность.
// Используется для стабильной генерации anim/sound параметров каждой планеты.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// hash id → seed. Используется для main races (без своего rngSeed).
// djb2-вариант: h = ((h*33) ^ ch).
export function hashId(id: string): number {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0
  return h
}

// Возвращает фактический seed используемый для anim/sound модуляций.
// Для BG: rngSeed после возможного refine. Для main: override из map или hashId.
// `seedOverrides` — Map id → seed (mainSeedOverride на StarMapScene).
export function effectiveSeed(
  sys: Race | BgSystem,
  seedOverrides: Map<string, number>,
): number {
  if ('rngSeed' in sys && typeof (sys as BgSystem).rngSeed === 'number') {
    return (sys as BgSystem).rngSeed
  }
  const override = seedOverrides.get(sys.id)
  if (override !== undefined) return override
  return hashId(sys.id)
}

// Создаёт детерминированный RNG для каждой планеты.
// BG: rngSeed. Main: hashId(id) или override из refineAnimSeeds.
export function animRng(
  sys: Race | BgSystem,
  seedOverrides: Map<string, number>,
): () => number {
  let seed: number
  if ('rngSeed' in sys && typeof (sys as BgSystem).rngSeed === 'number') {
    seed = (sys as BgSystem).rngSeed
  } else {
    const override = seedOverrides.get(sys.id)
    if (override !== undefined) {
      seed = override
    } else {
      let h = 5381
      for (let i = 0; i < sys.id.length; i++)
        h = ((h * 33) ^ sys.id.charCodeAt(i)) >>> 0
      seed = h
    }
  }
  return mulberry32(seed)
}

// Конвертация world coords → viewport DOM coords (для placement decision popovers).
// Принимает scene аргументом (раньше был `this` метод).
export function worldToDom(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  const cam = scene.cameras.main
  const physX = (worldX - cam.scrollX) * cam.zoom
  const physY = (worldY - cam.scrollY) * cam.zoom
  const cssX = physX / DPR
  const cssY = physY / DPR
  const canvas = scene.game.canvas
  const rect = canvas.getBoundingClientRect()
  return { x: rect.left + cssX, y: rect.top + cssY }
}
