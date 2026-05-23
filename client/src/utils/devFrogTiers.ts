// DEV helper для сравнения размеров лягушек разных tier'ов.
// __spawnTierRow(level) — спавнит 3 лягушки одного level рядом, tier 0/1/2.
// __spawnAllTiers() — спавнит ряды для всех 18 уровней (медленно).

import type Phaser from 'phaser'
import { MAX_LEVEL } from '../game/config/frogs'
import { devLog } from './devLog'

// 2026-05-24: __mainScene уже declared в devCarriers.ts с типом DevMainScene.
// Дублирование с разным типом ломает module augmentation (TS2717).
declare global {
  interface Window {
    __spawnFrog?: (level: number, tier?: number) => void
    __spawnAllLevels?: () => void
    __spawnTierRow?: (level: number) => void
    __spawnAllTiers?: () => void
  }
}

function spawnOne(level: number, tier: number = 0): void {
  const ms = window.__mainScene
  if (!ms) {
    console.warn('[tier-dev] no __mainScene — open game first')
    return
  }
  if (level < 1 || level > MAX_LEVEL) {
    console.warn(`[tier-dev] level out of range: ${level}`)
    return
  }
  const cam = ms.cameras.main
  const x = cam.width / 2 + (Math.random() * 200 - 100)
  const y = cam.height / 2 + (Math.random() * 200 - 100)
  const spawner = (
    ms as unknown as {
      spawner: {
        spawnFrog: (
          x: number,
          y: number,
          level: number,
          tierOverride?: number,
        ) => { body: Phaser.GameObjects.Image }
      }
    }
  ).spawner
  if (!spawner) {
    console.warn('[tier-dev] no spawner — scene not ready')
    return
  }
  spawner.spawnFrog(x, y, level, tier)
  devLog(
    `[tier-dev] spawned L${level} t${tier} at (${Math.round(x)}, ${Math.round(y)})`,
  )
}

function spawnAllLevels(): void {
  const ms = window.__mainScene
  if (!ms) {
    console.warn('[tier-dev] no __mainScene')
    return
  }
  const cam = ms.cameras.main
  // 18 frogs в сетке 6×3 (cols × rows).
  const cols = 6
  const rows = 3
  const marginX = cam.width * 0.1
  const marginY = cam.height * 0.15
  const stepX = (cam.width - 2 * marginX) / (cols - 1)
  const stepY = (cam.height - 2 * marginY) / (rows - 1)
  const spawner = (
    ms as unknown as {
      spawner: {
        spawnFrog: (
          x: number,
          y: number,
          level: number,
        ) => { body: Phaser.GameObjects.Image }
      }
    }
  ).spawner
  if (!spawner) return
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const idx = level - 1
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const x = marginX + col * stepX
    const y = marginY + row * stepY
    spawner.spawnFrog(x, y, level)
  }
  devLog('[tier-dev] spawned all 18 levels in 6x3 grid')
}

function spawnTierRow(level: number): void {
  const ms = window.__mainScene
  if (!ms) {
    console.warn('[tier-dev] no __mainScene — open game first')
    return
  }
  if (level < 1 || level > MAX_LEVEL) {
    console.warn(`[tier-dev] level out of range: ${level}`)
    return
  }

  const cam = ms.cameras.main
  const cx = cam.width / 2
  const cy = cam.height / 2
  const gap = 140

  const spawner = (
    ms as unknown as {
      spawner: {
        spawnFrog: (
          x: number,
          y: number,
          level: number,
          tierOverride?: number,
        ) => { body: Phaser.GameObjects.Image }
      }
    }
  ).spawner
  if (!spawner) {
    console.warn('[tier-dev] no spawner — scene not ready')
    return
  }

  for (let tier = 0; tier <= 2; tier++) {
    const x = cx + (tier - 1) * gap
    spawner.spawnFrog(x, cy, level, tier)
  }

  devLog(`[tier-dev] spawned 3 frogs L${level} at (${cx}, ${cy}) — tiers 0/1/2`)
}

function spawnAllTiers(): void {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    spawnTierRow(level)
  }
}

export function installFrogTierDevHelpers(): void {
  if (typeof window === 'undefined') return
  window.__spawnFrog = spawnOne
  window.__spawnAllLevels = spawnAllLevels
  window.__spawnTierRow = spawnTierRow
  window.__spawnAllTiers = spawnAllTiers
  console.log(
    '[tier-dev] helpers installed:\n' +
      '  __spawnFrog(level, tier=0)  — спавн одной лягушки\n' +
      '  __spawnAllLevels()          — все L1-L18 в сетке 6×3\n' +
      '  __spawnTierRow(level)       — 3 лягушки L=level tier 0/1/2 рядом\n' +
      '  __spawnAllTiers()           — все 18 уровней × 3 тира',
  )
}
