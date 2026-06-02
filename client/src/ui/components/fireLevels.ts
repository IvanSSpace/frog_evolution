// fireLevels — уровни горения зелёного огня Loc3 (тест). Общий module-store между
// FireLevelsModal (задаёт) и Loc3LottieTest (применяет CSS-фильтр к dotlottie).
// База анимации уже зелёная (hue≈120). Уровни = CSS-фильтр: слабый тусклый →
// кислотный яркий лайм. Без персиста (сессионно).
import { useEffect, useState } from 'react'

export interface FireLevel {
  id: number
  name: string
  /** CSS filter поверх зелёной базы. */
  filter: string
  /** Цвет-свотч для кнопки в модалке. */
  swatch: string
}

export const FIRE_LEVELS: FireLevel[] = [
  {
    id: 0,
    name: 'Слабое',
    filter: 'saturate(0.85) brightness(0.92)',
    swatch: '#3c8f48',
  },
  {
    id: 1,
    name: 'Среднее',
    filter: 'saturate(1.1) brightness(1)',
    swatch: '#3fae44',
  },
  {
    id: 2,
    name: 'Кислотное',
    filter: 'saturate(1.9) brightness(1.35) hue-rotate(-35deg)',
    swatch: '#9bff2e',
  },
]

// Кол-во огней на Loc3 (= SPOTS в Loc3LottieTest). Каждый настраивается отдельно.
export const FIRE_COUNT = 2
export const FIRE_NAMES = ['Левый', 'Правый']

const levels: number[] = Array(FIRE_COUNT).fill(2) // дефолт — кислотное (сильнее)
const listeners = new Set<() => void>()

export function getFireLevel(fire: number): number {
  return levels[fire] ?? 1
}

export function setFireLevel(fire: number, id: number): void {
  if (fire < 0 || fire >= FIRE_COUNT) return
  levels[fire] = Math.max(0, Math.min(FIRE_LEVELS.length - 1, id))
  listeners.forEach((f) => f())
}

/** React-хук: подписка на смену любого уровня (значение читать get'ом). */
export function useFireLevel(): number {
  const [tick, force] = useState(0)
  useEffect(() => {
    const f = () => force((x) => x + 1)
    listeners.add(f)
    return () => {
      listeners.delete(f)
    }
  }, [])
  return tick
}

export function fireFilter(fire: number): string {
  return FIRE_LEVELS[getFireLevel(fire)]?.filter ?? 'none'
}
