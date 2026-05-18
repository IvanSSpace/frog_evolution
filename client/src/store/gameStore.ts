import { create } from 'zustand'
import { eventBus } from './eventBus'
import { buyFrogApi, buyUpgradeApi } from '../api/shop'
import { getFrogPrice, MAX_LEVEL, FROG_LEVELS } from '../game/config/frogs'
import {
  UPGRADE_CONFIG,
  ENTITY_CAP,
  getUpgradeCost,
  getDropIntervalMs,
  getTractorCapMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getMagnetMergesPerCycle,
  getCrateLevel,
  getRareBoxThreshold,
  toUpgrades,
  type Upgrades,
} from '../game/config/upgrades'
import {
  LOCATIONS,
  getLocationById,
  type LocationConfig,
} from '../game/config/locations'
import { setGlobalFormat, type NumberFormat } from '../utils/formatting'
import { createCosmicSlice, type CosmicState } from './cosmic/slice'
import {
  loadUpgrades,
  saveUpgrades,
  loadFrogPurchases,
  saveFrogPurchases,
  loadDiscovered,
  saveDiscovered,
  loadLocationFrogs,
  saveLocationFrogsArr,
  loadCurrentLocation,
  saveCurrentLocation,
  loadMagnetEnabled,
  saveMagnetEnabled,
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
  getTractorCapMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getMagnetMergesPerCycle,
  getCrateLevel,
  getRareBoxThreshold,
  LOCATIONS,
  getLocationById,
}
export type { LocationConfig }

// ============== STORE ==============

export type BuyFrogResult =
  | { ok: true }
  | { ok: false; reason: 'noGold' | 'capFull' | 'invalid' }

// Phase 22: user preferences хранимые на сервере (cosmic.preferences).
// Каждое поле всё ещё имеет свой "primary" source (localStorage helpers /
// специализированные setters), но store держит snapshot для sync.
export interface Preferences {
  numberFormat: NumberFormat
  language: string // 'ru' | 'en' | 'es'
  sfxMuted: boolean
  instantBoxes: boolean
  calmFarmMode: boolean
  reducedEffects: boolean
}

interface GameStateBase {
  gold: number
  addGold: (amount: number) => void
  spendGold: (amount: number) => boolean

  upgrades: Upgrades
  buyUpgrade: (key: keyof Upgrades) => Promise<boolean>
  devResetUpgrades: () => void
  devClearAllFrogs: () => void

  // Лягушки на поле + коробки (real-time, обновляется из MainScene)
  entityCount: number
  setEntityCount: (n: number) => void

  // Суммарный пассивный доход монет/сек (real-time, обновляется из MainScene)
  incomePerSec: number
  setIncomePerSec: (n: number) => void

  // Сколько раз каждый уровень был куплен (для расчёта цены)
  frogPurchases: number[]
  buyFrog: (level: number) => Promise<BuyFrogResult>

  // Открытые уровни — для модалки "Открыта новая лягушка"
  discoveredLevels: number[]
  markDiscovered: (level: number) => boolean

  // Включён ли магнит (юзер может выключить кнопкой)
  magnetEnabled: boolean
  toggleMagnet: () => void

  // Текущая локация (1=Лужа, 2=Болото, 3=Лес, 4=Континент)
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
}

// Полный GameState = базовые поля + Cosmic Frogs System (Phase 11+)
// CosmicState = CosmicSlice + CosmicSliceActions (см. cosmic/slice.ts)
type GameState = GameStateBase & CosmicState

// L18+L18 merge bonus: hybrid schedule.
//   Merge 1: ABSOLUTE bonus = 2× L18 income/sec permanent (handled separately
//           через l18AbsoluteBonusPerSec). Multiplier = 1.0.
//   Merge 2-3: +5% multiplier each.
//   Merge 4..∞: +2.5% multiplier each.
//
// Cumulative multiplier (применяется к ВСЕМ gold-источникам через addGold,
// в т.ч. к absolute bonus tick'у — игрок видит как если бы 2 ghost-frogs всё
// ещё лагали income, и они тоже получают multiplier):
//   count=0 → 1.0
//   count=1 → 1.0   (только absolute bonus)
//   count=2 → 1.05
//   count=3 → 1.10
//   count=N (N≥3) → 1.10 + (N - 3) * 0.025
function l18GoldMultiplier(count: number): number {
  if (count <= 1) return 1
  if (count === 2) return 1.05
  if (count === 3) return 1.1
  return 1.1 + (count - 3) * 0.025
}

export const useGameStore = create<GameState>((set, get) => ({
  gold: 0,

  addGold: (amount) =>
    set((s) => ({
      gold: s.gold + amount * l18GoldMultiplier(s.l18MergesCount),
    })),

  spendGold: (amount) => {
    if (get().gold < amount) return false
    set((s) => ({ gold: s.gold - amount }))
    return true
  },

  upgrades: loadUpgrades(),
  devResetUpgrades: () => {
    const defaults: Upgrades = {
      dropSpeed: 0,
      tractor: 0,
      magnet: 0,
      crateQuality: 0,
      rareBoxSpeed: 0,
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
  toggleMagnet: () =>
    set((s) => {
      const next = !s.magnetEnabled
      saveMagnetEnabled(next)
      return { magnetEnabled: next }
    }),

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
    state.crew !== prev.crew ||
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
    state.shopPurchaseCounts !== prev.shopPurchaseCounts ||
    // Phase 26 Plan 26-01: per-race first contact tracker — persist on change.
    state.firstContactsSeen !== prev.firstContactsSeen
  ) {
    saveCosmicSlice({
      serums: state.serums,
      boxes: state.boxes,
      ship: state.ship,
      carriers: state.carriers,
      // Phase 22 Plan 22-03: persist ascension pool + essence.
      ascendedCarriers: state.ascendedCarriers,
      essence: state.essence,
      // Phase 22 Plan 22-05: persist shop perma upgrades + counters.
      permaSlotBonus: state.permaSlotBonus,
      permaShipSpeedBonus: state.permaShipSpeedBonus,
      permaSerumDropBonus: state.permaSerumDropBonus,
      shopPurchaseCounts: state.shopPurchaseCounts,
      bestiaryBitset: state.bestiaryBitset,
      pityCounters: state.pityCounters,
      lastActiveTab: state.lastActiveTab,
      crew: state.crew,
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
      // Phase 26 Plan 26-01: per-race first contact tracker persisted.
      firstContactsSeen: state.firstContactsSeen,
    })
  }
})
