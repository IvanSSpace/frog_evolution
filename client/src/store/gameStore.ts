import { create } from 'zustand'
import { eventBus } from './eventBus'
import { buyFrogApi, buyUpgradeApi } from '../api/shop'
import { getFrogPrice, MAX_LEVEL, FROG_LEVELS } from '../game/config/frogs'
import {
  UPGRADE_CONFIG,
  ENTITY_CAP,
  getUpgradeCost,
  getDropIntervalMs,
  getGooCollectorCapMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getMagnetMergesPerCycle,
  getCrateLevel,
  getRareBoxThreshold,
  getAutoCollectCooldownMs,
  droneCapacity,
  toUpgrades,
  type Upgrades,
  type PurchasableUpgrade,
} from '../game/config/upgrades'
import {
  LOCATIONS,
  getLocationById,
  type LocationConfig,
} from '../game/config/locations'
import { setGlobalFormat, type NumberFormat } from '../utils/formatting'
import { createCosmicSlice, type CosmicState } from './cosmic/slice'
import {
  EVOLUTION_COOLDOWN_MS,
  getEvolutionBonusFraction,
  getEvolutionCost,
  isEvolutionUnlockedForLocation,
  locationGroupForLevel,
} from '../game/config/evolution'
import {
  loadUpgrades,
  saveUpgrades,
  loadEctoplasm,
  saveEctoplasm,
  loadCurrencyY,
  saveCurrencyY,
  loadLoc2Upgrades,
  saveLoc2Upgrades,
  loadFrogPurchases,
  saveFrogPurchases,
  loadFrogTiers,
  saveFrogTiers,
  loadFrogTierCooldowns,
  saveFrogTierCooldowns,
  loadTemporaryIncomeBuff,
  saveTemporaryIncomeBuff,
  loadDiscovered,
  saveDiscovered,
  loadFrogShopSeenLevels,
  saveFrogShopSeenLevels,
  loadBestiarySeenLevels,
  saveBestiarySeenLevels,
  loadLocationFrogs,
  saveLocationFrogsArr,
  loadCurrentLocation,
  saveCurrentLocation,
  loadMagnetEnabled,
  loadCosmicSlice,
  saveCosmicSlice,
  loadNumberFormat,
  saveNumberFormat,
  loadBoxOpenCount,
  saveBoxOpenCount,
  loadCosmosUnlocked,
  saveCosmosUnlocked,
  loadCaptainBirthSeen,
  saveCaptainBirthSeen,
  loadL18MergesCount,
  saveL18MergesCount,
  loadL18AbsoluteBonusPerSec,
  saveL18AbsoluteBonusPerSec,
} from './persistence'

// Re-exports for backward compat — many consumers import these from gameStore.
// New code should import directly from game/config/upgrades or game/config/locations.
export {
  UPGRADE_CONFIG,
  ENTITY_CAP,
  getUpgradeCost,
  getDropIntervalMs,
  getGooCollectorCapMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getMagnetMergesPerCycle,
  getCrateLevel,
  getRareBoxThreshold,
  getAutoCollectCooldownMs,
  LOCATIONS,
  getLocationById,
}
export type { LocationConfig }

// ============== STORE ==============

export type BuyFrogResult =
  | { ok: true }
  | { ok: false; reason: 'noGold' | 'capFull' | 'invalid' }

// ─── Loc2/Loc3 экономика (Чанк 2) ────────────────────────────────────────────
// Апгрейды Loc2: conveyorSpeed за gold; ecto*/capsule* за эктоплазму. Эффекты
// (реальная скорость дрона/конвейера, число дронов, длительность капсул) читают
// consumers в scenes/main/* — см. геттеры loc2*Effect ниже.
// ⚠️ PLACEHOLDER balance: все costs/кривые эффектов временные, тюнинг в конце.

export type EctoUpgradeKey =
  | 'ectoDroneSpeed'
  | 'ectoDroneCount'
  | 'ectoDroneValue'
  | 'capsuleSpeed'
  | 'capsuleCooldown'

export type Loc2UpgradeKey = 'conveyorSpeed' | EctoUpgradeKey

export type Loc2Upgrades = Record<Loc2UpgradeKey, number>

export const LOC2_UPGRADES_DEFAULT: Loc2Upgrades = {
  conveyorSpeed: 0,
  ectoDroneSpeed: 0,
  ectoDroneCount: 0,
  ectoDroneValue: 0,
  capsuleSpeed: 0,
  capsuleCooldown: 0,
}

// Мета апгрейдов: валюта, maxLevel, цены за уровень (i → i+1). PLACEHOLDER.
export const LOC2_UPGRADE_META: Record<
  Loc2UpgradeKey,
  { currency: 'gold' | 'ecto'; maxLevel: number; costs: readonly number[] }
> = {
  conveyorSpeed: {
    currency: 'gold',
    maxLevel: 5,
    costs: [500, 2_000, 8_000, 30_000, 100_000],
  },
  ectoDroneSpeed: {
    currency: 'ecto',
    maxLevel: 5,
    costs: [10, 25, 50, 90, 150],
  },
  ectoDroneCount: { currency: 'ecto', maxLevel: 3, costs: [30, 80, 180] },
  ectoDroneValue: {
    currency: 'ecto',
    maxLevel: 5,
    costs: [15, 35, 70, 120, 200],
  },
  capsuleSpeed: {
    currency: 'ecto',
    maxLevel: 5,
    costs: [12, 30, 60, 100, 160],
  },
  capsuleCooldown: {
    currency: 'ecto',
    maxLevel: 5,
    costs: [12, 30, 60, 100, 160],
  },
}

/** Цена следующего уровня апгрейда Loc2 (Infinity если макс). */
export function loc2UpgradeCost(key: Loc2UpgradeKey, level: number): number {
  const arr = LOC2_UPGRADE_META[key].costs
  return level >= arr.length ? Infinity : arr[level]
}

/** Безопасная конверсия сырого Record в Loc2Upgrades (дефолт для отсутствующих). */
export function toLoc2Upgrades(
  raw: Record<string, number> | null | undefined,
): Loc2Upgrades {
  const r = raw ?? {}
  const out = { ...LOC2_UPGRADES_DEFAULT }
  for (const k of Object.keys(LOC2_UPGRADES_DEFAULT) as Loc2UpgradeKey[]) {
    const v = r[k]
    if (typeof v === 'number' && v >= 0) out[k] = Math.floor(v)
  }
  return out
}

// ─── Геттеры эффектов (PLACEHOLDER кривые) — читают consumers в scenes/main/* ──
const CONVEYOR_BASE_MS = 6000 // базовый интервал выпуска L7 (см. completion-plan)
/** Интервал конвейера (мс): база × 0.85^level. Меньше = быстрее. */
export function conveyorIntervalMs(level: number): number {
  return Math.round(CONVEYOR_BASE_MS * Math.pow(0.85, Math.max(0, level)))
}
/** Множитель скорости ecto-дрона: 1 + 0.15×level. */
export function ectoDroneSpeedMult(level: number): number {
  return 1 + 0.15 * Math.max(0, level)
}
/** Число ecto-дронов: 1 + level (ectoDroneCount). */
export function ectoDroneCountFor(level: number): number {
  return 1 + Math.max(0, level)
}
/** Множитель ценности сбора эктоплазмы: 1 + 0.25×level. */
export function ectoDroneValueMult(level: number): number {
  return 1 + 0.25 * Math.max(0, level)
}
/** Множитель скорости активной фазы капсул: 1 + 0.15×level (фазы короче). */
export function capsuleSpeedMult(level: number): number {
  return 1 + 0.15 * Math.max(0, level)
}
const CAPSULE_BASE_COOLDOWN_MS = 10000 // база green→cyan (см. completion-plan)
/** Кулдаун капсулы (мс): база × 0.88^level. Меньше = чаще. */
export function capsuleCooldownMs(level: number): number {
  return Math.round(
    CAPSULE_BASE_COOLDOWN_MS * Math.pow(0.88, Math.max(0, level)),
  )
}

// Phase 22: user preferences хранимые на сервере (cosmic.preferences).
// Каждое поле всё ещё имеет свой "primary" source (localStorage helpers /
// специализированные setters), но store держит snapshot для sync.
export interface Preferences {
  numberFormat: NumberFormat
  language: string // 'ru' | 'en' | 'es'
  sfxMuted: boolean
}

interface GameStateBase {
  gold: number
  addGold: (amount: number) => void
  spendGold: (amount: number) => boolean

  // Эктоплазма (loc2): фиолетовая слизь, собирается дронами loc2.
  ectoplasm: number
  addEctoplasm: (amount: number) => void
  // Списать эктоплазму (для покупок). false если недостаточно.
  spendEctoplasm: (amount: number) => boolean

  // Валюта Y (Loc3): выдаётся за L12+L12 merge. ⚠️ Grant вызывает MergeController
  // (Чанк 1) → addCurrencyY. Имя/иконка — PLACEHOLDER (не финал). Persist: cosmic blob.
  currencyY: number
  addCurrencyY: (amount: number) => void

  // Апгрейды Loc2 (conveyorSpeed=gold, ecto*/capsule*=эктоплазма). Эффекты читают
  // consumers в scenes/main/* через геттеры conveyorIntervalMs/ectoDrone* (Чанк 1).
  loc2Upgrades: Loc2Upgrades
  buyConveyorSpeed: () => boolean
  buyEctoUpgrade: (key: EctoUpgradeKey) => boolean

  upgrades: Upgrades
  buyUpgrade: (key: PurchasableUpgrade) => Promise<boolean>
  // Распределение слотов дронов по типам (бесплатно). Клампится ёмкостью
  // (2 + droneSlots) и >=0. Персист через подписку gameSync (throttled PUT).
  setDroneDistribution: (collectors: number, magnets: number) => void
  devResetUpgrades: () => void
  devClearAllFrogs: () => void

  // Current logged-in user info (set on boot after auth) — useful for debug/testing.
  username: string | null
  telegramId: string | null
  devFlags: string[]
  currentUserDbId: number | null
  setCurrentUser: (info: {
    username: string | null
    telegramId: string | null
    devFlags?: string[]
    id?: number
  }) => void

  // Лягушки на поле + коробки (real-time, обновляется из MainScene)
  entityCount: number
  setEntityCount: (n: number) => void

  // 2026-05-30: заряд дронов (0..100, real-time из DroneController/MagnetController,
  // throttled). Для модалки droner. Массив = заряд каждого активного дрона;
  // пустой массив = тип не активен/не куплен.
  droneBatteries: number[]
  magnetBatteries: number[]
  setDroneBatteries: (b: number[]) => void
  setMagnetBatteries: (b: number[]) => void

  // Суммарный пассивный доход монет/сек (real-time, обновляется из MainScene)
  incomePerSec: number
  setIncomePerSec: (n: number) => void

  // Сколько раз каждый уровень был куплен (для расчёта цены)
  frogPurchases: number[]
  buyFrog: (level: number) => Promise<BuyFrogResult>

  // Тиры эволюции на каждый уровень (0=base, 1, 2).
  frogTiers: number[]
  // Per-level cooldown timestamps (Date.now()-based, ms). 0 = нет cooldown'а.
  // Тикает в real-time (offline тоже).
  frogTierCooldowns: number[]
  upgradeFrogTier: (level: number) => {
    ok: boolean
    reason?:
      | 'maxTier'
      | 'noGold'
      | 'noEssence'
      | 'noMutagen'
      | 'cooldown'
      | 'locked'
      | 'invalid'
      | 'cosmosLocked'
  }

  // Открытые уровни — для модалки "Открыта новая лягушка"
  discoveredLevels: number[]
  frogShopSeenLevels: number[]
  bestiarySeenLevels: number[]
  markFrogShopSeen: () => void
  markBestiarySeen: () => void
  markDiscovered: (level: number) => boolean

  // Сохранённый флаг магнита (legacy). Тумблер убран 2026-05-31 — магнит
  // работает всегда когда куплен апгрейд (сбором заведуют дроны). Поле
  // оставлено для совместимости с server-sync/persistence.
  magnetEnabled: boolean

  // Текущая локация (1=Болото, 2=Лес, 3=Континент)
  currentLocation: number
  setCurrentLocation: (id: number) => void

  // Лягушки на каждой локации (массив уровней). Сцена синкает это при спавне/мердже.
  locationFrogs: number[][]
  addFrogToLocation: (locationId: number, level: number) => void
  removeFrogFromLocation: (locationId: number, level: number) => void

  numberFormat: NumberFormat
  setNumberFormat: (f: NumberFormat) => void

  boxProgress: number
  boxWaiting: boolean
  setBoxProgress: (v: number) => void
  setBoxWaiting: (v: boolean) => void
  rareBoxProgress: number
  setRareBoxProgress: (v: number) => void
  boxOpenCount: number
  setBoxOpenCount: (n: number) => void

  // Phase 22 Plan 22-06: cosmos gate.
  // false до первого L18+L18 normal merge sentinel. Триггерится в MergeController.
  // Pre-cosmos: SerumBar / Cosmic Hub button / Star Map controls скрыты; box-open и
  // mission rewards не дропают серум.
  // FIXME Plan 22-07: на load — если discovered[19] true но hasCosmosUnlocked
  // отсутствует, выставить true (legacy migration).
  hasCosmosUnlocked: boolean
  markCosmosUnlocked: () => void

  // Phase 24 Plan 24-01: captain creation cinematic gate.
  // false до первого L18+L18 normal merge. Set'ится в MergeController
  // (Plan 24-04) перед emit'ом 'captain:birth-start'. Idempotent.
  // Server-sync через cosmic JSON blob (см. gameSync.ts).
  captainBirthSeen: boolean
  markCaptainBirthSeen: () => void

  // 2026-05-18: L18+L18 normal merges count.
  // Каждый successful L18+L18 normal merge:
  //   - Merge 1 (первый): даёт +2× L18 income (≈+393K/s) ABSOLUTE permanent
  //     bonus (см. l18AbsoluteBonusPerSec). Multiplier = 1.0 (no % yet).
  //   - Merge 2-3: +5% multiplier each (cumulative).
  //   - Merge 4+: +2.5% multiplier each.
  l18MergesCount: number
  incrementL18Merges: () => void
  // 2026-05-18: absolute passive income bonus в gold/sec, накопленный из first
  // L18+L18 merge (= 2× target_income_per_sec(L18)).
  // Тикает в MainScene update loop как ghost-frog income.
  l18AbsoluteBonusPerSec: number
  addL18AbsoluteBonus: (amount: number) => void

  // 2026-05-23: временный % buff к доходу. Активируется L18+L18 merge'ем на 6h.
  // null = нет активного buff'а. Несколько мерджей подряд накапливают `percent`
  // и продлевают `until` (см. activateTemporaryIncomeBuff).
  temporaryIncomeBuff: { until: number; percent: number } | null
  activateTemporaryIncomeBuff: (percent: number, durationMs: number) => void

  /** True пока активна вспомогательная Phaser-сцена (ShipDeckScene).
   *  HUD-элементы (magnet/location) скрываются на это время. */
  battleSceneActive: boolean
  setBattleSceneActive: (v: boolean) => void
}

// Полный GameState = базовые поля + Cosmic Frogs System (Phase 11+)
// CosmicState = CosmicSlice + CosmicSliceActions (см. cosmic/slice.ts)
type GameState = GameStateBase & CosmicState

// 2026-05-23: permanent % bonus от L18+L18 merge удалён — теперь permanent %
// даёт только эволюция. Каждый L18+L18 merge даёт +1 essence + 6h temp buff
// (см. l18MergeIncrementFraction). 1-й merge также даёт permanent absolute
// bonus (+2× L18 income/sec).
//
// l18MergeIncrementFraction(count) — какой % buff активируется при следующем
// merge'е (count = текущее число merges'ей ДО этого). Использует ту же лестницу
// что раньше использовалась для permanent multiplier:
//   count=0 → +5% (первый merge тоже даёт +5% buff помимо absolute bonus)
//   count=1 → +5%, count=2 → +2.5%, count≥3 → +2.5%
export function l18MergeIncrementFraction(count: number): number {
  if (count <= 1) return 0.05
  return 0.025
}

// Активна ли временная прибавка к доходу. Возвращает fraction (0.05 = +5%),
// или 0 если buff не активен / истёк.
export function activeTemporaryBuffFraction(
  buff: { until: number; percent: number } | null,
  now: number = Date.now(),
): number {
  if (!buff) return 0
  if (buff.until <= now) return 0
  return buff.percent / 100
}

export const useGameStore = create<GameState>((set, get) => ({
  gold: 0,

  addGold: (amount) =>
    set((s) => ({
      gold:
        s.gold +
        amount *
          (1 +
            getEvolutionBonusFraction(s.frogTiers) +
            activeTemporaryBuffFraction(s.temporaryIncomeBuff)),
    })),

  spendGold: (amount) => {
    if (get().gold < amount) return false
    set((s) => ({ gold: s.gold - amount }))
    return true
  },

  ectoplasm: loadEctoplasm(),
  addEctoplasm: (amount) =>
    set((s) => {
      const next = Math.max(0, s.ectoplasm + amount)
      saveEctoplasm(next)
      return { ectoplasm: next }
    }),
  spendEctoplasm: (amount) => {
    if (get().ectoplasm < amount) return false
    set((s) => {
      const next = Math.max(0, s.ectoplasm - amount)
      saveEctoplasm(next)
      return { ectoplasm: next }
    })
    return true
  },

  currencyY: loadCurrencyY(),
  addCurrencyY: (amount) =>
    set((s) => {
      const next = Math.max(0, s.currencyY + amount)
      saveCurrencyY(next)
      return { currencyY: next }
    }),

  loc2Upgrades: toLoc2Upgrades(loadLoc2Upgrades()),
  buyConveyorSpeed: () => {
    const s = get()
    const level = s.loc2Upgrades.conveyorSpeed
    if (level >= LOC2_UPGRADE_META.conveyorSpeed.maxLevel) return false
    const cost = loc2UpgradeCost('conveyorSpeed', level)
    if (s.gold < cost) return false
    const next = { ...s.loc2Upgrades, conveyorSpeed: level + 1 }
    saveLoc2Upgrades(next)
    set({ gold: s.gold - cost, loc2Upgrades: next })
    return true
  },
  buyEctoUpgrade: (key) => {
    const s = get()
    const level = s.loc2Upgrades[key]
    if (level >= LOC2_UPGRADE_META[key].maxLevel) return false
    const cost = loc2UpgradeCost(key, level)
    if (s.ectoplasm < cost) return false
    const next = { ...s.loc2Upgrades, [key]: level + 1 }
    const ectoNext = Math.max(0, s.ectoplasm - cost)
    saveLoc2Upgrades(next)
    saveEctoplasm(ectoNext)
    set({ ectoplasm: ectoNext, loc2Upgrades: next })
    return true
  },

  upgrades: loadUpgrades(),
  devResetUpgrades: () => {
    const defaults: Upgrades = {
      dropSpeed: 0,
      gooCollector: 0,
      magnet: 0,
      magnet2: 0,
      magnet3: 0,
      crateQuality: 0,
      rareBoxSpeed: 0,
      ships: 0,
      autoCollect: 0,
      droneSlots: 0,
      collectorDrones: 1,
      magnetDrones: 1,
    }
    saveUpgrades(defaults)
    set({ upgrades: defaults })
  },
  devClearAllFrogs: () => {
    const empty: number[][] = LOCATIONS.map(() => [])
    saveLocationFrogsArr(empty)
    set({ locationFrogs: empty })
    eventBus.emit('dev:clearAllFrogs')
  },
  buyUpgrade: async (key) => {
    const state = get()
    const level = state.upgrades[key]
    const cfg = UPGRADE_CONFIG[key]
    if (level >= cfg.maxLevel) return false
    const cost = getUpgradeCost(key, level)
    if (state.gold < cost) return false

    // Snapshot для возможного rollback
    const prevGold = state.gold
    const prevUpgrades = state.upgrades

    // OPTIMISTIC: применяем локально сразу
    const next = { ...prevUpgrades, [key]: prevUpgrades[key] + 1 }
    saveUpgrades(next)
    set({ gold: prevGold - cost, upgrades: next })

    try {
      const res = await buyUpgradeApi(key)
      const nextFromServer = toUpgrades(res.upgrades)
      saveUpgrades(nextFromServer)
      set({ gold: Number(res.gold), upgrades: nextFromServer })
      return true
    } catch (e) {
      console.warn('[shop] buy-upgrade rejected, rolling back:', e)
      saveUpgrades(prevUpgrades)
      set({ gold: prevGold, upgrades: prevUpgrades })
      eventBus.emit('cosmic:toast', {
        type: 'generic',
        msg: 'Апгрейд отклонён сервером',
        duration: 2500,
      })
      return false
    }
  },

  setDroneDistribution: (collectors, magnets) => {
    const prev = get().upgrades
    const cap = droneCapacity(prev.droneSlots)
    let c = Math.max(0, Math.floor(collectors))
    let m = Math.max(0, Math.floor(magnets))
    // Если сумма превышает ёмкость — режем магниты, затем сборщиков.
    if (c + m > cap) {
      m = Math.min(m, cap - c)
      if (c + m > cap) c = cap - m
    }
    if (c === prev.collectorDrones && m === prev.magnetDrones) return
    const next = { ...prev, collectorDrones: c, magnetDrones: m }
    saveUpgrades(next)
    set({ upgrades: next }) // подписка gameSync → throttled PUT
  },

  // Current user info — populated после auth в App.tsx boot().
  username: null,
  telegramId: null,
  devFlags: [],
  currentUserDbId: null,
  setCurrentUser: (info) =>
    set({
      username: info.username,
      telegramId: info.telegramId,
      devFlags: info.devFlags ?? [],
      currentUserDbId: info.id ?? null,
    }),

  entityCount: 0,
  setEntityCount: (n) => set({ entityCount: n }),

  droneBatteries: [],
  magnetBatteries: [],
  setDroneBatteries: (b) => set({ droneBatteries: b }),
  setMagnetBatteries: (b) => set({ magnetBatteries: b }),

  incomePerSec: 0,
  setIncomePerSec: (n) => set({ incomePerSec: n }),

  discoveredLevels: loadDiscovered(),
  frogShopSeenLevels: loadFrogShopSeenLevels(),
  bestiarySeenLevels: loadBestiarySeenLevels(),
  markFrogShopSeen: () => {
    const state = get()
    const next = [...state.discoveredLevels].sort((a, b) => a - b)
    saveFrogShopSeenLevels(next)
    set({ frogShopSeenLevels: next })
  },
  markBestiarySeen: () => {
    const state = get()
    const next = [...state.discoveredLevels].sort((a, b) => a - b)
    saveBestiarySeenLevels(next)
    set({ bestiarySeenLevels: next })
  },
  markDiscovered: (level) => {
    const state = get()
    if (state.discoveredLevels.includes(level)) return false
    const next = [...state.discoveredLevels, level].sort((a, b) => a - b)
    saveDiscovered(next)
    set({ discoveredLevels: next })
    return true
  },

  magnetEnabled: loadMagnetEnabled(),

  currentLocation: loadCurrentLocation(),
  setCurrentLocation: (id) => {
    if (!LOCATIONS.some((l) => l.id === id)) return
    saveCurrentLocation(id)
    set({ currentLocation: id })
    eventBus.emit('location:changed', { id })
  },

  locationFrogs: loadLocationFrogs(),
  addFrogToLocation: (locationId, level) =>
    set((s) => {
      const idx = locationId - 1
      if (idx < 0 || idx >= s.locationFrogs.length) return {}
      const next = s.locationFrogs.map((arr, i) =>
        i === idx ? [...arr, level] : arr,
      )
      saveLocationFrogsArr(next)
      return { locationFrogs: next }
    }),
  removeFrogFromLocation: (locationId, level) =>
    set((s) => {
      const idx = locationId - 1
      if (idx < 0 || idx >= s.locationFrogs.length) return {}
      const i = s.locationFrogs[idx].indexOf(level)
      if (i < 0) return {}
      const next = s.locationFrogs.map((arr, j) => {
        if (j !== idx) return arr
        return [...arr.slice(0, i), ...arr.slice(i + 1)]
      })
      saveLocationFrogsArr(next)
      return { locationFrogs: next }
    }),

  frogPurchases: loadFrogPurchases(),
  buyFrog: async (level) => {
    const state = get()
    if (level < 1 || level > MAX_LEVEL) return { ok: false, reason: 'invalid' }
    const cfg = FROG_LEVELS[level - 1]
    if (!cfg.availableInShop) return { ok: false, reason: 'invalid' }
    // Cap проверяем на родной локации лягушки, а не на текущей сцене
    const targetLocFrogs = state.locationFrogs[cfg.location - 1] ?? []
    if (targetLocFrogs.length >= ENTITY_CAP)
      return { ok: false, reason: 'capFull' }
    const purchases = state.frogPurchases[level - 1] ?? 0
    const cost = getFrogPrice(level, purchases)
    if (state.gold < cost) return { ok: false, reason: 'noGold' }

    // Snapshot для возможного rollback
    const prevGold = state.gold
    const prevPurchases = state.frogPurchases

    // OPTIMISTIC: применяем локально сразу
    const nextPurchases = [...prevPurchases]
    nextPurchases[level - 1] = purchases + 1
    saveFrogPurchases(nextPurchases)
    set({ gold: prevGold - cost, frogPurchases: nextPurchases })
    eventBus.emit('frog:purchased', { level })

    try {
      const res = await buyFrogApi(level)
      // Reconcile: значения сервера авторитетны (gold может отличаться из-за idle income)
      saveFrogPurchases(res.frogPurchases)
      set({ gold: Number(res.gold), frogPurchases: res.frogPurchases })
      return { ok: true }
    } catch (e) {
      // Rollback
      console.warn('[shop] buy-frog rejected, rolling back:', e)
      saveFrogPurchases(prevPurchases)
      set({ gold: prevGold, frogPurchases: prevPurchases })
      eventBus.emit('cosmic:toast', {
        type: 'generic',
        msg: 'Покупка отклонена сервером',
        duration: 2500,
      })
      return { ok: false, reason: 'noGold' }
    }
  },

  frogTiers: loadFrogTiers(),
  frogTierCooldowns: loadFrogTierCooldowns(),
  upgradeFrogTier: (level) => {
    if (level < 1 || level > MAX_LEVEL) return { ok: false, reason: 'invalid' }
    const state = get()
    if (!state.hasCosmosUnlocked) {
      return { ok: false, reason: 'cosmosLocked' }
    }
    const groupIdx = locationGroupForLevel(level)
    if (!isEvolutionUnlockedForLocation(state.frogTiers, groupIdx)) {
      return { ok: false, reason: 'locked' }
    }
    const cdEnd = state.frogTierCooldowns[level - 1] ?? 0
    if (cdEnd > Date.now()) {
      return { ok: false, reason: 'cooldown' }
    }
    const current = state.frogTiers[level - 1] ?? 0
    if (current >= 2) return { ok: false, reason: 'maxTier' }
    const {
      gold: goldCost,
      essence: essenceCost,
      mutagen: mutagenCost,
      mutagenTier,
    } = getEvolutionCost(level, current)
    if (state.gold < goldCost) return { ok: false, reason: 'noGold' }
    if (state.essence < essenceCost) {
      return { ok: false, reason: 'noEssence' }
    }
    // Списываем мутаген конкретного tier'а (1=L1-6, 2=L7-12, 3=L13-18).
    const currentMutagen =
      mutagenTier === 1
        ? state.mutagen1
        : mutagenTier === 2
          ? state.mutagen2
          : state.mutagen3
    if (currentMutagen < mutagenCost) {
      return { ok: false, reason: 'noMutagen' }
    }
    const nextTiers = [...state.frogTiers]
    nextTiers[level - 1] = current + 1
    const nextCooldowns = [...state.frogTierCooldowns]
    nextCooldowns[level - 1] = Date.now() + EVOLUTION_COOLDOWN_MS
    saveFrogTiers(nextTiers)
    saveFrogTierCooldowns(nextCooldowns)
    const mutagenPatch: Partial<
      Pick<typeof state, 'mutagen1' | 'mutagen2' | 'mutagen3'>
    > = {}
    if (mutagenTier === 1) mutagenPatch.mutagen1 = state.mutagen1 - mutagenCost
    else if (mutagenTier === 2)
      mutagenPatch.mutagen2 = state.mutagen2 - mutagenCost
    else mutagenPatch.mutagen3 = state.mutagen3 - mutagenCost
    set({
      gold: state.gold - goldCost,
      essence: state.essence - essenceCost,
      ...mutagenPatch,
      frogTiers: nextTiers,
      frogTierCooldowns: nextCooldowns,
    })
    return { ok: true }
  },

  numberFormat: loadNumberFormat(),
  setNumberFormat: (f) => {
    saveNumberFormat(f)
    setGlobalFormat(f)
    set({ numberFormat: f })
    // Phase 22: sync preferences with server (dynamic import избегает circular).
    void import('../api/gameSync').then((m) => m.saveGameState(true))
  },

  boxProgress: 0,
  boxWaiting: false,
  setBoxProgress: (v) => set({ boxProgress: v }),
  setBoxWaiting: (v) => set({ boxWaiting: v }),
  rareBoxProgress: 0,
  setRareBoxProgress: (v) => set({ rareBoxProgress: v }),
  boxOpenCount: loadBoxOpenCount(),
  setBoxOpenCount: (n) => {
    saveBoxOpenCount(n)
    set({ boxOpenCount: n })
  },

  // Phase 22 Plan 22-06: cosmos gate state + idempotent unlock action.
  // Persisted под отдельным ключом (COSMOS_UNLOCKED_KEY) — выживает любые
  // corrupt resets cosmic slice.
  hasCosmosUnlocked: loadCosmosUnlocked(),
  markCosmosUnlocked: () => {
    const s = get()
    if (s.hasCosmosUnlocked) return // idempotent
    saveCosmosUnlocked(true)
    set({ hasCosmosUnlocked: true })
    eventBus.emit('cosmic:toast', {
      type: 'generic',
      msg: 'Космос открыт!',
      duration: 3000,
    })
  },

  // Phase 24 Plan 24-01: captain birth gate (cinematic single-play).
  // Persisted под отдельным ключом (CAPTAIN_BIRTH_SEEN_KEY), плюс server-sync
  // через cosmic.captainBirthSeen (см. gameSync.ts). Не эмитит cosmic:toast —
  // сам cinematic и есть «toast».
  captainBirthSeen: loadCaptainBirthSeen(),
  markCaptainBirthSeen: () => {
    const s = get()
    if (s.captainBirthSeen) return // idempotent
    saveCaptainBirthSeen(true)
    set({ captainBirthSeen: true })
  },

  // 2026-05-18: L18+L18 merge bonus counter (см. l18GoldMultiplier выше).
  l18MergesCount: loadL18MergesCount(),
  incrementL18Merges: () => {
    const s = get()
    const next = s.l18MergesCount + 1
    saveL18MergesCount(next)
    set({ l18MergesCount: next })
  },
  // 2026-05-18: absolute passive income bonus от first L18+L18 merge
  // (= 2× target_income_per_sec(L18) ≈ 393197/sec). Тикает в MainScene update
  // как ghost-L18-frogs income, проходит через addGold (получает multiplier).
  l18AbsoluteBonusPerSec: loadL18AbsoluteBonusPerSec(),
  addL18AbsoluteBonus: (amount: number) => {
    const s = get()
    const next = s.l18AbsoluteBonusPerSec + amount
    saveL18AbsoluteBonusPerSec(next)
    set({ l18AbsoluteBonusPerSec: next })
  },

  // 2026-05-23: 6h temp buff после L18+L18 merge. Stacking strategy:
  // - Если buff активен — накапливаем percent (+ суммируется) и продлеваем
  //   `until` на полные durationMs от текущего момента.
  // - Если истёк/null — новый buff.
  temporaryIncomeBuff: loadTemporaryIncomeBuff(),
  activateTemporaryIncomeBuff: (percent, durationMs) => {
    const now = Date.now()
    const s = get()
    const prev = s.temporaryIncomeBuff
    const stillActive = prev && prev.until > now
    const nextPercent = (stillActive ? prev.percent : 0) + percent
    const next = { until: now + durationMs, percent: nextPercent }
    saveTemporaryIncomeBuff(next)
    set({ temporaryIncomeBuff: next })
  },

  battleSceneActive: false,
  setBattleSceneActive: (v) => set({ battleSceneActive: v }),

  // ============== COSMIC FROGS SYSTEM (Phase 11+) ==============
  // createCosmicSlice сначала кладёт actions + дефолтные данные,
  // потом загруженные из localStorage значения переопределяют дефолты.
  ...createCosmicSlice(
    set as (partial: Partial<CosmicState>) => void,
    get as () => CosmicState,
  ),
  ...loadCosmicSlice(),
}))

// ============== COSMIC AUTO-PERSIST ==============
// Subscribe — автоматически сохраняет cosmic-данные при любых изменениях.
// lastActiveTab также persist (UI читает sessionStorage первым, потом store).
useGameStore.subscribe((state, prev) => {
  if (
    state.serums !== prev.serums ||
    state.boxes !== prev.boxes ||
    state.ship !== prev.ship ||
    state.carriers !== prev.carriers ||
    state.bestiaryBitset !== prev.bestiaryBitset ||
    state.pityCounters !== prev.pityCounters ||
    state.lastActiveTab !== prev.lastActiveTab ||
    state.hasFirstFeed !== prev.hasFirstFeed ||
    state.hasFirstMission !== prev.hasFirstMission ||
    state.hasOpenedAnyBox !== prev.hasOpenedAnyBox ||
    state.frogExclusiveUnlocked !== prev.frogExclusiveUnlocked ||
    state.tutorialState !== prev.tutorialState ||
    // Phase 22 Plan 22-03: ascension state must trigger persist.
    state.ascendedCarriers !== prev.ascendedCarriers ||
    state.essence !== prev.essence ||
    // Phase 22 Plan 22-05: shop perma upgrades + purchase counters.
    state.permaSlotBonus !== prev.permaSlotBonus ||
    state.permaShipSpeedBonus !== prev.permaShipSpeedBonus ||
    state.permaSerumDropBonus !== prev.permaSerumDropBonus ||
    state.shopPurchaseCounts !== prev.shopPurchaseCounts
  ) {
    saveCosmicSlice({
      serums: state.serums,
      boxes: state.boxes,
      ship: state.ship,
      carriers: state.carriers,
      // Phase 22 Plan 22-03: persist ascension pool + essence.
      ascendedCarriers: state.ascendedCarriers,
      essence: state.essence,
      mutagen1: state.mutagen1,
      mutagen2: state.mutagen2,
      mutagen3: state.mutagen3,
      routes: state.routes,
      // Phase 22 Plan 22-05: persist shop perma upgrades + counters.
      permaSlotBonus: state.permaSlotBonus,
      permaShipSpeedBonus: state.permaShipSpeedBonus,
      permaSerumDropBonus: state.permaSerumDropBonus,
      shopPurchaseCounts: state.shopPurchaseCounts,
      bestiaryBitset: state.bestiaryBitset,
      pityCounters: state.pityCounters,
      lastActiveTab: state.lastActiveTab,
      // Phase 14: transient UI state — saveCosmicSlice имеет CosmicPersist shape
      // для type compatibility; на load возвращаются defaults (false/null).
      serumDragActive: false,
      selectedSerum: null,
      // Phase 16: progressive disclosure (REQ UX-09)
      hasFirstFeed: state.hasFirstFeed,
      hasFirstMission: state.hasFirstMission,
      hasOpenedAnyBox: state.hasOpenedAnyBox,
      // Phase 18 (REQ BESTIARY-07): 576-cells unlock flag.
      frogExclusiveUnlocked: state.frogExclusiveUnlocked,
      // Phase 19-05 (UX-08): tutorial seen-flags persisted.
      tutorialState: state.tutorialState,
      // Phase 16: latestShipPos НЕ persisted (transient) — saved as null shape
      latestShipPos: null,
    })
  }
})
