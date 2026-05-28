import { useGameStore } from '../store/gameStore'

export const ESSENCE_REQUEST_CAP = 1
export const SERUM_REQUEST_CAP = 2

/** 2 часа дохода трактора игрока, в slime (number). */
export function getSlimeCap(): number {
  const incomePerSec = useGameStore.getState().incomePerSec ?? 0
  const raw = incomePerSec * 7200
  if (raw > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER
  return Math.max(0, Math.floor(raw))
}

export const ELEMENT_LABELS: Record<string, string> = {
  fire: 'Огонь',
  ice: 'Лёд',
  water: 'Вода',
  forest: 'Лес',
  toxic: 'Токсин',
  plasma: 'Плазма',
  crystal: 'Кристалл',
  desert: 'Пустыня',
  gas: 'Газ',
  ring: 'Кольцо',
  binary: 'Бинарный',
}

export const ELEMENT_KEYS = Object.keys(ELEMENT_LABELS)
