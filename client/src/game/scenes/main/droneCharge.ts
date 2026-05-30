// Персист заряда дронов + офлайн-досчёт. localStorage (косметика, не идёт на
// сервер). Хранение раздельно по типу: collector ('c') / magnet ('m').
//
// При сохранении пишем массив зарядов всех дронов типа + timestamp. При загрузке
// досчитываем каждый дрон по «пиле»: разряд за BATTERY_FULL_MS → зарядка за
// RECHARGE_MS → разряд … за прошедшее офлайн-время. RTB-перелёт не моделируем.

const KEY_C = 'frog_drone_charge_c_v1'
const KEY_M = 'frog_drone_charge_m_v1'

// SYNC с DroneController/MagnetController.
const BATTERY_FULL_MS = 480000
const RECHARGE_MS = 60000

interface Saved {
  b: number[]
  ts: number
}

function keyFor(type: 'c' | 'm'): string {
  return type === 'c' ? KEY_C : KEY_M
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v))
}

// Прокручивает заряд на elapsedMs вперёд по пиле (старт в фазе разряда).
export function advanceBattery(start: number, elapsedMs: number): number {
  let b = clamp(start)
  let rem = Math.max(0, elapsedMs)
  let charging = false
  let guard = 0
  while (rem > 0 && guard++ < 10000) {
    if (!charging) {
      const tEmpty = (b / 100) * BATTERY_FULL_MS
      if (rem < tEmpty) {
        b -= (rem / BATTERY_FULL_MS) * 100
        rem = 0
      } else {
        rem -= tEmpty
        b = 0
        charging = true
      }
    } else {
      const tFull = ((100 - b) / 100) * RECHARGE_MS
      if (rem < tFull) {
        b += (rem / RECHARGE_MS) * 100
        rem = 0
      } else {
        rem -= tFull
        b = 100
        charging = false
      }
    }
  }
  return Math.round(clamp(b))
}

export function saveDroneBatteries(type: 'c' | 'm', batteries: number[]): void {
  try {
    const payload: Saved = { b: batteries.map((x) => Math.round(clamp(x))), ts: Date.now() }
    localStorage.setItem(keyFor(type), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

// Возвращает восстановленные (досчитанные) заряды по индексу дрона. Пустой массив
// если нет сохранения — caller использует случайный стартовый заряд.
export function loadDroneBatteries(type: 'c' | 'm'): number[] {
  try {
    const raw = localStorage.getItem(keyFor(type))
    if (!raw) return []
    const parsed = JSON.parse(raw) as Saved
    if (!Array.isArray(parsed.b) || typeof parsed.ts !== 'number') return []
    const elapsed = Date.now() - parsed.ts
    return parsed.b.map((x) => advanceBattery(x, elapsed))
  } catch {
    return []
  }
}
