// Завод на локации 2 (Лес): пассивно производит лягушек L7.
//
// САМОДОСТАТОЧНЫЙ модуль (не трогает loc2-рендер/здания — ими владеет другой
// чанк). Таймер раз в PRODUCE_INTERVAL_MS добавляет одну L7-лягушку на локацию 2
// через существующий store-экшен addFrogToLocation. Производит, только если:
//   - локация 2 уже открыта (игрок дорос до Леса, max level >= 7);
//   - на поле loc2 меньше FACTORY_CAP лягушек (не переполняем ENTITY_CAP=16).
//
// Когда loc2-овнер сделает визуальное здание-завод — привяжет start/stop сюда
// (например, запускать только когда здание построено/проапгрейжено).

import { useGameStore } from '../../store/gameStore'

const FACTORY_LOCATION = 2
const PRODUCE_FROG_LEVEL = 7
const PRODUCE_INTERVAL_MS = 45_000 // одна L7-лягушка раз в 45с
const FACTORY_CAP = 10 // перестаём производить при ≥10 лягушек на loc2 (запас до ENTITY_CAP)

let timer: ReturnType<typeof setInterval> | null = null

function loc2FrogCount(): number {
  const arr = useGameStore.getState().locationFrogs[FACTORY_LOCATION - 1]
  return arr ? arr.length : 0
}

function loc2Unlocked(): boolean {
  const d = useGameStore.getState().discoveredLevels
  return d.length > 0 && Math.max(...d) >= PRODUCE_FROG_LEVEL
}

function tick(): void {
  if (!loc2Unlocked()) return
  if (loc2FrogCount() >= FACTORY_CAP) return
  useGameStore
    .getState()
    .addFrogToLocation(FACTORY_LOCATION, PRODUCE_FROG_LEVEL)
}

/** Запустить завод (idempotent). Зовётся один раз при старте приложения. */
export function startLoc2FrogFactory(): void {
  if (timer) return
  timer = setInterval(tick, PRODUCE_INTERVAL_MS)
}

export function stopLoc2FrogFactory(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
