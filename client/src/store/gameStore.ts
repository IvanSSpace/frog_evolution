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
  saveSessionState,
  getOfflineSession,
} from './persistence'

export { saveSessionState, getOfflineSession }

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

  // Текущая локация (1=Болото, 2=Лес, 3=Континент, 4=Планета)
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
}

// Полный GameState = базовые поля + Cosmic Frogs System (Phase 11+)
// CosmicState = CosmicSlice + CosmicSliceActions (см. cosmic/slice.ts)
type GameState = GameStateBase & CosmicState

export const useGameStore = create<GameState>((set, get) => ({
  gold: 0,

  addGold: (amount) => set((s) => ({ gold: s.gold + amount })),

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
      const nextFromServer = res.upgrades as Upgrades
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
  },

  boxProgress: 0,
  boxWaiting: false,
  setBoxProgress: (v) => set({ boxProgress: v }),
  setBoxWaiting: (v) => set({ boxWaiting: v }),
  rareBoxProgress: 0,
  setRareBoxProgress: (v) => set({ rareBoxProgress: v }),

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
    state.tutorialState !== prev.tutorialState
  ) {
    saveCosmicSlice({
      serums: state.serums,
      boxes: state.boxes,
      ship: state.ship,
      carriers: state.carriers,
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
    })
  }
})
