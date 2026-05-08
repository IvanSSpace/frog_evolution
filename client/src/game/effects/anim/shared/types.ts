// Phase 9: shared types для anim primitives.
// Эти types подмножество того что StarMapScene использует, но без зависимости
// от приватного state класса. Phase 12-13 (FrogElementOverlay) будут собирать
// fake AnimSys (mock { color, accent, archetype, size }) чтобы переиспользовать
// одни и те же primitives.

import type Phaser from 'phaser'

// Минимальные структуры — копия StarMapScene.ts:34-43 + 100-117. НЕ импортируем
// из StarMapScene напрямую (там interfaces NOT exported); дублируем структурно.
// Если в Phase 12 потребуется adapter — он строит совместимый объект.

export interface SharedRace {
  id: string
  name: string
  x: number
  y: number
  type: string
  color: number
  accent: number
  size: number
}

export interface SharedBgSystem {
  id: string
  name: string
  x: number
  y: number
  type: 'resource' | 'hostile' | 'empty'
  archetype: string
  color: number
  accent: number
  size: number
  brightness: number
  hasMoon: boolean
  rngSeed: number
  isInhabited?: boolean
}

export type AnimSys = SharedRace | SharedBgSystem

export type PrimitiveFn = (
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
) => void

// compFlash — special case без sys параметра (сигнатура отличается).
export type FlashPrimitiveFn = (
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  rng: () => number,
) => void
