import { create } from 'zustand'
import { eventBus } from './eventBus'
import { getFrogPrice, MAX_LEVEL } from '../game/config/frogs'

// ============== АПГРЕЙДЫ ==============

interface Upgrades {
  dropSpeed: number
  tractor: number
  magnet: number
}

// Таблица: индекс = текущий уровень, intervalMs[i] / capHours[i] = эффект на уровне i,
// costs[i] = цена покупки следующего уровня (i → i+1)
export const UPGRADE_CONFIG = {
  dropSpeed: {
    maxLevel: 8,
    // Первый уровень даёт +43% (10с → 7с), затем плавнее
    intervalMs: [10000, 7000, 5500, 4500, 3500, 2800, 2200, 1800, 1500],
    costs: [200, 500, 1500, 4000, 10000, 30000, 75000, 200000],
  },
  tractor: {
    maxLevel: 8,
    capHours: [0, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    costs: [500, 1500, 4500, 13000, 40000, 120000, 350000, 1000000],
    // incomePerSec масштабируется с уровнем (×3 за уровень)
    incomePerSecByLevel: [0, 30, 100, 300, 1000, 3000, 10000, 30000, 100000],
  },
  magnet: {
    maxLevel: 6,
    spawnIntervalMs: [Infinity, 10000, 8000, 7000, 6000, 5000, 4000],
    durationMs:      [0,        5000,  5500,  6000,  6500,  7000,  8000],
    radiusPx:        [0,        120,   140,   160,   180,   200,   220],
    // Сколько пар магнит сольёт за одну активацию
    mergesPerCycle:  [0,        1,     1,     2,     2,     3,     3],
    costs: [2_000, 8_000, 30_000, 100_000, 350_000, 1_200_000],
  },
} as const

export const ENTITY_CAP = 16 // максимум лягушек+коробок на поле

export function getUpgradeCost(key: keyof Upgrades, level: number): number {
  const arr = UPGRADE_CONFIG[key].costs
  if (level >= arr.length) return Infinity
  return arr[level]
}

export function getDropIntervalMs(level: number): number {
  const arr = UPGRADE_CONFIG.dropSpeed.intervalMs
  return arr[Math.min(level, arr.length - 1)]
}

export function getTractorCapMs(level: number): number {
  const arr = UPGRADE_CONFIG.tractor.capHours
  const hours = arr[Math.min(level, arr.length - 1)]
  return hours * 3600 * 1000
}

export function getMagnetSpawnInterval(level: number): number {
  const arr = UPGRADE_CONFIG.magnet.spawnIntervalMs
  return arr[Math.min(level, arr.length - 1)]
}

export function getMagnetDuration(level: number): number {
  const arr = UPGRADE_CONFIG.magnet.durationMs
  return arr[Math.min(level, arr.length - 1)]
}

export function getMagnetRadius(level: number): number {
  const arr = UPGRADE_CONFIG.magnet.radiusPx
  return arr[Math.min(level, arr.length - 1)]
}

export function getMagnetMergesPerCycle(level: number): number {
  const arr = UPGRADE_CONFIG.magnet.mergesPerCycle
  return arr[Math.min(level, arr.length - 1)]
}

export function getTractorIncomePerSec(level: number): number {
  const arr = UPGRADE_CONFIG.tractor.incomePerSecByLevel
  return arr[Math.min(level, arr.length - 1)]
}

// ============== ПЕРСИСТЕНС ==============

const UPGRADES_KEY = 'frog_evolution_upgrades'
const PURCHASES_KEY = 'frog_evolution_frog_purchases'
const DISCOVERED_KEY = 'frog_evolution_discovered'
const MAGNET_ENABLED_KEY = 'frog_evolution_magnet_enabled'
const VERSION_KEY = 'frog_evolution_storage_version'
const SESSION_KEY = 'frog_evolution_last_session'
// Бампается когда меняются конфиги — старые сейвы сбрасываются
const STORAGE_VERSION = 6

function loadUpgrades(): Upgrades {
  const defaults: Upgrades = { dropSpeed: 0, tractor: 0, magnet: 0 }
  try {
    const ver = parseInt(localStorage.getItem(VERSION_KEY) ?? '0', 10)
    if (ver !== STORAGE_VERSION) {
      localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION))
      localStorage.removeItem(UPGRADES_KEY)
      localStorage.removeItem(PURCHASES_KEY)
      localStorage.removeItem(DISCOVERED_KEY)
      return defaults
    }
    const raw = localStorage.getItem(UPGRADES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Upgrades>
      return {
        dropSpeed: Math.min(parsed.dropSpeed ?? 0, UPGRADE_CONFIG.dropSpeed.maxLevel),
        tractor: Math.min(parsed.tractor ?? 0, UPGRADE_CONFIG.tractor.maxLevel),
        magnet: Math.min(parsed.magnet ?? 0, UPGRADE_CONFIG.magnet.maxLevel),
      }
    }
  } catch {/* ignore */}
  return defaults
}

function saveUpgrades(u: Upgrades) {
  try { localStorage.setItem(UPGRADES_KEY, JSON.stringify(u)) } catch {/* ignore */}
}

function loadFrogPurchases(): number[] {
  try {
    const raw = localStorage.getItem(PURCHASES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as number[]
      if (Array.isArray(parsed)) {
        const arr = new Array(MAX_LEVEL).fill(0)
        for (let i = 0; i < Math.min(parsed.length, MAX_LEVEL); i++) {
          arr[i] = Math.max(0, Math.floor(parsed[i] ?? 0))
        }
        return arr
      }
    }
  } catch {/* ignore */}
  return new Array(MAX_LEVEL).fill(0)
}

function saveFrogPurchases(arr: number[]) {
  try { localStorage.setItem(PURCHASES_KEY, JSON.stringify(arr)) } catch {/* ignore */}
}

function loadDiscovered(): number[] {
  // ТЕСТ-РЕЖИМ: при каждой загрузке возвращаем [1..5] игнорируя сохранения,
  // чтобы можно было повторно проверять модалки 6 и 7 на каждом рефреше.
  // Также чистим сохранение чтобы не накапливалось.
  try { localStorage.removeItem(DISCOVERED_KEY) } catch {/* ignore */}
  return [1, 2, 3, 4, 5]
}

function saveDiscovered(arr: number[]) {
  try { localStorage.setItem(DISCOVERED_KEY, JSON.stringify(arr)) } catch {/* ignore */}
}

function loadMagnetEnabled(): boolean {
  try {
    const raw = localStorage.getItem(MAGNET_ENABLED_KEY)
    if (raw === 'false') return false
  } catch {/* ignore */}
  return true // по умолчанию включён
}

function saveMagnetEnabled(v: boolean) {
  try { localStorage.setItem(MAGNET_ENABLED_KEY, String(v)) } catch {/* ignore */}
}

export function saveSessionTimestamp() {
  try { localStorage.setItem(SESSION_KEY, Date.now().toString()) } catch {/* ignore */}
}

export function getOfflineElapsedMs(): number {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return 0
    const last = parseInt(raw, 10)
    if (!Number.isFinite(last)) return 0
    return Math.max(0, Date.now() - last)
  } catch { return 0 }
}

// ============== STORE ==============

export type BuyFrogResult = { ok: true } | { ok: false; reason: 'noGold' | 'capFull' | 'invalid' }

interface GameState {
  gold: number
  addGold: (amount: number) => void
  spendGold: (amount: number) => boolean

  upgrades: Upgrades
  buyUpgrade: (key: keyof Upgrades) => boolean

  // Лягушки на поле + коробки (real-time, обновляется из MainScene)
  entityCount: number
  setEntityCount: (n: number) => void

  // Суммарный пассивный доход монет/сек (real-time, обновляется из MainScene)
  incomePerSec: number
  setIncomePerSec: (n: number) => void

  // Сколько раз каждый уровень был куплен (для расчёта цены)
  frogPurchases: number[]
  buyFrog: (level: number) => BuyFrogResult

  // Открытые уровни — для модалки "Открыта новая лягушка"
  discoveredLevels: number[]
  markDiscovered: (level: number) => boolean

  // Включён ли магнит (юзер может выключить кнопкой)
  magnetEnabled: boolean
  toggleMagnet: () => void

  boxProgress: number
  boxWaiting: boolean
  setBoxProgress: (v: number) => void
  setBoxWaiting: (v: boolean) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  gold: 300_000_000,

  addGold: (amount) => set((s) => ({ gold: s.gold + amount })),

  spendGold: (amount) => {
    if (get().gold < amount) return false
    set((s) => ({ gold: s.gold - amount }))
    return true
  },

  upgrades: loadUpgrades(),
  buyUpgrade: (key) => {
    const state = get()
    const level = state.upgrades[key]
    const cfg = UPGRADE_CONFIG[key]
    if (level >= cfg.maxLevel) return false
    const cost = getUpgradeCost(key, level)
    if (state.gold < cost) return false
    const next = { ...state.upgrades, [key]: state.upgrades[key] + 1 }
    saveUpgrades(next)
    set({ gold: state.gold - cost, upgrades: next })
    return true
  },

  entityCount: 0,
  setEntityCount: (n) => set({ entityCount: n }),

  incomePerSec: 0,
  setIncomePerSec: (n) => set({ incomePerSec: n }),

  discoveredLevels: loadDiscovered(),
  markDiscovered: (level) => {
    const state = get()
    if (state.discoveredLevels.includes(level)) return false
    const next = [...state.discoveredLevels, level].sort((a, b) => a - b)
    saveDiscovered(next)
    set({ discoveredLevels: next })
    return true
  },

  magnetEnabled: loadMagnetEnabled(),
  toggleMagnet: () => set((s) => {
    const next = !s.magnetEnabled
    saveMagnetEnabled(next)
    return { magnetEnabled: next }
  }),

  frogPurchases: loadFrogPurchases(),
  buyFrog: (level) => {
    const state = get()
    if (level < 1 || level > MAX_LEVEL) return { ok: false, reason: 'invalid' }
    if (state.entityCount >= ENTITY_CAP) return { ok: false, reason: 'capFull' }
    const purchases = state.frogPurchases[level - 1] ?? 0
    const cost = getFrogPrice(level, purchases)
    if (state.gold < cost) return { ok: false, reason: 'noGold' }

    const next = [...state.frogPurchases]
    next[level - 1] = purchases + 1
    saveFrogPurchases(next)
    set({ gold: state.gold - cost, frogPurchases: next })

    eventBus.emit('frog:purchased', { level })
    return { ok: true }
  },

  boxProgress: 0,
  boxWaiting: false,
  setBoxProgress: (v) => set({ boxProgress: v }),
  setBoxWaiting: (v) => set({ boxWaiting: v }),
}))
