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
    filter: 'saturate(0.55) brightness(0.7)',
    swatch: '#2f6b3a',
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

let current = 1 // дефолт — среднее
const listeners = new Set<() => void>()

export function getFireLevel(): number {
  return current
}

export function setFireLevel(id: number): void {
  current = Math.max(0, Math.min(FIRE_LEVELS.length - 1, id))
  listeners.forEach((f) => f())
}

/** React-хук: текущий уровень + ре-рендер при смене. */
export function useFireLevel(): number {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((x) => x + 1)
    listeners.add(f)
    return () => {
      listeners.delete(f)
    }
  }, [])
  return current
}

export function fireFilter(): string {
  return FIRE_LEVELS[current]?.filter ?? 'none'
}
