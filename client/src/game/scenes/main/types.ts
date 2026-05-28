// Phase 21: Shared types/constants for MainScene controllers.
//
// MainScene.ts ранее держал эти типы и константы как module-private. После
// разбиения на доменные controller'ы они нужны нескольким файлам — выносим
// в общий модуль, чтобы сцена и controller'ы импортировали из одной точки.
//
// Не добавлять сюда логику — только данные/типы.

import Phaser from 'phaser'

// Игра рендерится в физических пикселях (window * DPR), CSS-зум 1/DPR в game/index.ts.
// Все размеры/координаты ниже задаются в CSS-пикселях, умножение на DPR делается здесь.
export const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))

export const DASH_RADIUS = 70 * DPR
// 2026-05-28: 48 → 60 → 58 — поле слегка расширено обратно (на 2px с каждой
// стороны от 60), чтоб лягушкам не было совсем тесно.
export const FIELD_PAD_X = 58 * DPR
export const FIELD_PAD_Y = 60 * DPR // верхний отступ от верха канваса
export const FIELD_PAD_Y_BOTTOM = 90 * DPR // нижний отступ — крупнее, чтобы лягушки не уходили слишком вниз

// «Военный» вариант поля — расширенная зона. Не используется пока что —
// чтобы включить, замени FIELD_PAD_* references на FIELD_PAD_*_MILITARY.
export const FIELD_PAD_X_MILITARY = 24 * DPR
export const FIELD_PAD_Y_MILITARY = 40 * DPR
export const FIELD_PAD_Y_BOTTOM_MILITARY = 60 * DPR
export const MERGE_RADIUS = 50 * DPR

// Бокс-дропы
export const MAX_ENTITIES = 16 // суммарный лимит лягушки + коробки
export const MAX_PENDING_BOXES = 8 // cap «отложенных» коробок при отсутствии на болоте
export const BOX_FALL_DURATION = 380 // длительность падения (быстрее)
export const BOX_DISPLAY_SIZE = 120 * DPR // размер коробки на экране (увеличен)
export const BOX_IDLE_INTERVAL = 5500 // период подпрыгивания
export const BOX_OPEN_RADIUS = 80 * DPR // радиус разлёта тапа — открывает все коробки рядом
// Окно магнит-иммунитета (мс) для свежих из бокса лягушек. AoE-открытие
// спавнит несколько одноуровневых лягушек рядом — без защиты магнит ловит их
// в тот же тик и делает «случайный» merge прямо от клика. См. BoxController
// (ставит флаг) + MergeController.findClosestSameLevelPair (проверяет).
export const BOX_SPAWN_MERGE_PROTECT_MS = 1500

export const RARE_BOX_TINT = 0xffd700
export const RARE_BOX_SCALE_MULT = 1.25

// SVG грузится в физических пикселях (CSS * DPR), плюс +50% для запаса
export const TEXTURE_QUALITY = DPR * 1.5
export const BASE_SCALE = DPR / TEXTURE_QUALITY // = 1/1.5 ≈ 0.667

export const tintToHex = (cssHex: string): number =>
  parseInt(cssHex.replace('#', ''), 16)

export const mapKeyForLocation = (locId: number): string => {
  // 2026-05-28: TEST — toxic_mapN.webp для всех локаций. Откатить → вернуть
  // 'map'/'map2'/'map3'.
  if (locId === 1) return 'toxic_map'
  if (locId === 2) return 'toxic_map2'
  if (locId === 3) return 'toxic_map3'
  return 'toxic_map'
}

export interface BoxData {
  img: Phaser.GameObjects.Image
  isLanding: boolean
  baseScale: number
  baseY: number
  idleTween: Phaser.Tweens.TweenChain | null
  isRare?: boolean
  // Phase 23 Plan 23-03 — stable id для tutorial tap-hint event coupling
  // (tutorial:firstBoxSpawned/firstBoxTapped). Per-box unique, session-only.
  id?: string
}

export interface MagnetData {
  container: Phaser.GameObjects.Container
  emoji: Phaser.GameObjects.Text
  x: number
  y: number
  expiresAt: number
  pair: [FrogData, FrogData]
  mergesDone: number
  mergesTarget: number
}

export interface FrogData {
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Image
  facingRight: boolean
  isMoving: boolean
  isDragging: boolean
  isMerging: boolean
  isAttracted: boolean
  level: number
  poopTimer: Phaser.Time.TimerEvent | null
  // Отложенный прыжок (scheduleNextDash addEvent + пауза 350мс перед прыжком в
  // performDash). Храним, чтобы отменить при pickup — иначе прыжок к устаревшей
  // цели срабатывает после переноса и лягушка «упрыгивает далеко».
  dashTimer: Phaser.Time.TimerEvent | null
  // Phase 12: stable cross-session id для match с CarrierData.frogId.
  id: string
  // Магнит-иммунитет до этого момента (Date.now() ms). Ставится на лягушек,
  // заспавненных AoE-открытием бокса, чтобы клик по коробкам не делал
  // мгновенный авто-merge. undefined = защиты нет.
  mergeProtectedUntil?: number
}
