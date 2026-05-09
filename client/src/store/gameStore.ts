import { create } from 'zustand'
import { eventBus } from './eventBus'
import { getFrogPrice, MAX_LEVEL, FROG_LEVELS } from '../game/config/frogs'
import {
  UPGRADE_CONFIG,
  ENTITY_CAP,
  getUpgradeCost,
  getDropIntervalMs,
  getTractorCapMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getMagnetRadius,
  getMagnetMergesPerCycle,
  getCrateLevel,
  getRareBoxThreshold,
  getTractorIncomePerSec,
  type Upgrades,
} from '../game/config/upgrades'
import {
  LOCATIONS,
  getLocationById,
  type LocationConfig,
} from '../game/config/locations'
import { setGlobalFormat, type NumberFormat } from '../utils/formatting'
import { makeInitialCosmicSlice, type BoxData } from './cosmic/types'
import { createCosmicSlice, type CosmicState } from './cosmic/slice'

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
  getMagnetRadius,
  getMagnetMergesPerCycle,
  getCrateLevel,
  getRareBoxThreshold,
  getTractorIncomePerSec,
  LOCATIONS,
  getLocationById,
}
export type { LocationConfig }

// ============== ПЕРСИСТЕНС ==============

const UPGRADES_KEY = 'frog_evolution_upgrades'
const PURCHASES_KEY = 'frog_evolution_frog_purchases'
const DISCOVERED_KEY = 'frog_evolution_discovered'
const MAGNET_ENABLED_KEY = 'frog_evolution_magnet_enabled'
const VERSION_KEY = 'frog_evolution_storage_version'
const SESSION_KEY = 'frog_evolution_last_session'
const FORMAT_KEY = 'frog_format'
const COSMIC_KEY = 'frog_evolution_cosmic'
// Бампается когда меняются конфиги — старые сейвы сбрасываются
// 16 (Phase 11): добавлен COSMIC_KEY для CosmicSlice (Cosmic Frogs System)
// 17 (Phase 16): ShipState discriminated union + sentinel flags + bonusRarity
// 18 (Phase 15): BoxData shape extended (planetId/planetName/archetype/createdAt);
//                bonusRarity changed number → 'rare'|'epic'|'legendary' enum.
// 19 (Phase 17): bestiaryBitset 24→192 bytes (lossless pad migration); CosmicTab
//                union extended с 'carriers'; CarrierData расширен
//                ceiling?/rollHistory? (optional → backward compat).
const STORAGE_VERSION = 19

function loadUpgrades(): Upgrades {
  const defaults: Upgrades = {
    dropSpeed: 0,
    tractor: 0,
    magnet: 0,
    crateQuality: 0,
    rareBoxSpeed: 0,
  }
  try {
    const ver = parseInt(localStorage.getItem(VERSION_KEY) ?? '0', 10)
    if (ver !== STORAGE_VERSION) {
      localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION))
      localStorage.removeItem(UPGRADES_KEY)
      localStorage.removeItem(PURCHASES_KEY)
      localStorage.removeItem(DISCOVERED_KEY)
      localStorage.removeItem(LOCATION_FROGS_KEY)
      localStorage.removeItem(LOCATION_KEY)
      localStorage.removeItem(COSMIC_KEY) // Phase 11: cosmic slice
      return defaults
    }
    const raw = localStorage.getItem(UPGRADES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Upgrades>
      return {
        dropSpeed: Math.min(
          parsed.dropSpeed ?? 0,
          UPGRADE_CONFIG.dropSpeed.maxLevel,
        ),
        tractor: Math.min(parsed.tractor ?? 0, UPGRADE_CONFIG.tractor.maxLevel),
        magnet: Math.min(parsed.magnet ?? 0, UPGRADE_CONFIG.magnet.maxLevel),
        crateQuality: Math.min(
          parsed.crateQuality ?? 0,
          UPGRADE_CONFIG.crateQuality.maxLevel,
        ),
        rareBoxSpeed: Math.min(
          parsed.rareBoxSpeed ?? 0,
          UPGRADE_CONFIG.rareBoxSpeed.maxLevel,
        ),
      }
    }
  } catch {
    /* ignore */
  }
  return defaults
}

function saveUpgrades(u: Upgrades) {
  try {
    localStorage.setItem(UPGRADES_KEY, JSON.stringify(u))
  } catch {
    /* ignore */
  }
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
  } catch {
    /* ignore */
  }
  return new Array(MAX_LEVEL).fill(0)
}

function saveFrogPurchases(arr: number[]) {
  try {
    localStorage.setItem(PURCHASES_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

function loadDiscovered(): number[] {
  // ТЕСТ-РЕЖИМ: при каждой загрузке возвращаем [1..5] игнорируя сохранения,
  // чтобы можно было повторно проверять модалки 6 и 7 на каждом рефреше.
  // Также чистим сохранение чтобы не накапливалось.
  try {
    localStorage.removeItem(DISCOVERED_KEY)
  } catch {
    /* ignore */
  }
  return [1, 2, 3, 4, 5]
}

function saveDiscovered(arr: number[]) {
  try {
    localStorage.setItem(DISCOVERED_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

const LOCATION_KEY = 'frog_evolution_current_location'
const LOCATION_FROGS_KEY = 'frog_evolution_location_frogs'

// Резиденты каждой локации — массив уровней лягушек, сейчас находящихся на её поле.
// Болото изначально содержит по одной L1..L6 (стартовый набор для теста).
function loadLocationFrogs(): number[][] {
  try {
    const raw = localStorage.getItem(LOCATION_FROGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === LOCATIONS.length) {
        return parsed.map((arr) =>
          Array.isArray(arr)
            ? arr.filter((n) => Number.isFinite(n) && n > 0)
            : [],
        )
      }
    }
  } catch {
    /* ignore */
  }
  // Дефолт: Болото — L1..L6 по одной, остальные пустые
  const arr: number[][] = LOCATIONS.map(() => [])
  arr[0] = [1, 2, 3, 4, 5, 6]
  return arr
}

function saveLocationFrogsArr(arr: number[][]) {
  try {
    localStorage.setItem(LOCATION_FROGS_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

function loadCurrentLocation(): number {
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    const n = parseInt(raw ?? '1', 10)
    if (Number.isFinite(n) && LOCATIONS.some((l) => l.id === n)) return n
  } catch {
    /* ignore */
  }
  return 1
}

function saveCurrentLocation(id: number) {
  try {
    localStorage.setItem(LOCATION_KEY, String(id))
  } catch {
    /* ignore */
  }
}

function loadMagnetEnabled(): boolean {
  try {
    const raw = localStorage.getItem(MAGNET_ENABLED_KEY)
    if (raw === 'false') return false
  } catch {
    /* ignore */
  }
  return true // по умолчанию включён
}

function saveMagnetEnabled(v: boolean) {
  try {
    localStorage.setItem(MAGNET_ENABLED_KEY, String(v))
  } catch {
    /* ignore */
  }
}

// ============== COSMIC SLICE PERSIST ==============

type CosmicPersist = ReturnType<typeof makeInitialCosmicSlice>

function loadCosmicSlice(): CosmicPersist {
  const defaults = makeInitialCosmicSlice()
  try {
    const raw = localStorage.getItem(COSMIC_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    // Graceful fallback: каждое поле проверяется отдельно — поломанные части
    // заменяются дефолтами (T-11-01 mitigation).

    // Phase 16: ShipState shape validation. Old shape (Phase 11) had optional
    // dockedAt/from/to. New discriminated union requires planetId или
    // fromPlanetId+toPlanetId+startedAt+arrivesAt. Any mismatch → null (re-init).
    let ship: CosmicPersist['ship'] = null
    if (parsed.ship && typeof parsed.ship === 'object' && parsed.ship.state) {
      if (
        parsed.ship.state === 'docked' &&
        typeof parsed.ship.planetId === 'string'
      ) {
        ship = { state: 'docked', planetId: parsed.ship.planetId }
      } else if (
        parsed.ship.state === 'transit' &&
        typeof parsed.ship.fromPlanetId === 'string' &&
        typeof parsed.ship.toPlanetId === 'string' &&
        typeof parsed.ship.startedAt === 'number' &&
        typeof parsed.ship.arrivesAt === 'number'
      ) {
        ship = {
          state: 'transit',
          fromPlanetId: parsed.ship.fromPlanetId,
          toPlanetId: parsed.ship.toPlanetId,
          startedAt: parsed.ship.startedAt,
          arrivesAt: parsed.ship.arrivesAt,
        }
      }
      // else: legacy Phase 11 shape (dockedAt/from/to) → ship = null (re-init)
    }

    // Phase 15 (T-15-01 mitigation): validate BoxData shape on load.
    // Drop entries with invalid id/element/opened. Older Phase 11/16 entries
    // missing planetId/planetName/archetype/createdAt: backfill defaults для
    // soft migration (хотя STORAGE_VERSION bump 17→18 already wipes COSMIC_KEY).
    const boxesRaw = Array.isArray(parsed.boxes) ? parsed.boxes : []
    const boxes = boxesRaw
      .filter(
        (b: unknown): b is Record<string, unknown> =>
          typeof b === 'object' &&
          b !== null &&
          typeof (b as Record<string, unknown>).id === 'string' &&
          typeof (b as Record<string, unknown>).element === 'string' &&
          typeof (b as Record<string, unknown>).opened === 'boolean',
      )
      .map((b: Record<string, unknown>) => ({
        id: b.id as string,
        planetId: typeof b.planetId === 'string' ? (b.planetId as string) : '',
        planetName:
          typeof b.planetName === 'string' ? (b.planetName as string) : '',
        archetype:
          typeof b.archetype === 'string'
            ? (b.archetype as string)
            : typeof b.sourceArchetype === 'string'
              ? (b.sourceArchetype as string)
              : '',
        // Trust persisted element string — Element type is a union of 16 lowercase keys.
        // Invalid values cleaned by STORAGE_VERSION wipe; runtime fallback в UI (ELEMENT_TINT default).
        element: b.element as BoxData['element'],
        opened: b.opened as boolean,
        createdAt:
          typeof b.createdAt === 'number'
            ? (b.createdAt as number)
            : Date.now(),
        bonusRarity:
          b.bonusRarity === 'rare' ||
          b.bonusRarity === 'epic' ||
          b.bonusRarity === 'legendary'
            ? (b.bonusRarity as 'rare' | 'epic' | 'legendary')
            : undefined,
      })) as CosmicPersist['boxes']

    return {
      serums: parsed.serums ?? defaults.serums,
      boxes,
      scouts: Array.isArray(parsed.scouts) ? parsed.scouts : [],
      ship,
      carriers: Array.isArray(parsed.carriers) ? parsed.carriers : [],
      // Phase 17: bitset extended 24 → 192 bytes (1536 bits). Pad-only migration.
      bestiaryBitset: (() => {
        if (!Array.isArray(parsed.bestiaryBitset))
          return defaults.bestiaryBitset
        const arr = parsed.bestiaryBitset.slice()
        while (arr.length < 192) arr.push(0)
        return arr.slice(0, 192)
      })(),
      pityCounters: parsed.pityCounters ?? defaults.pityCounters,
      lastActiveTab:
        parsed.lastActiveTab === 'scouts' ||
        parsed.lastActiveTab === 'boxes' ||
        parsed.lastActiveTab === 'bestiary' ||
        parsed.lastActiveTab === 'carriers'
          ? parsed.lastActiveTab
          : 'scouts',
      crew: parsed.crew ?? defaults.crew,
      // Phase 14: transient UI state — всегда defaults на load (НЕ из persisted state).
      serumDragActive: false,
      selectedSerum: null,
      // Phase 16: progressive disclosure flags (REQ UX-09)
      hasFirstFeed:
        typeof parsed.hasFirstFeed === 'boolean'
          ? parsed.hasFirstFeed
          : defaults.hasFirstFeed,
      hasFirstMission:
        typeof parsed.hasFirstMission === 'boolean'
          ? parsed.hasFirstMission
          : defaults.hasFirstMission,
      hasOpenedAnyBox:
        typeof parsed.hasOpenedAnyBox === 'boolean'
          ? parsed.hasOpenedAnyBox
          : defaults.hasOpenedAnyBox,
      // Phase 18 (REQ BESTIARY-07): 576-cells visual unlock placeholder.
      frogExclusiveUnlocked:
        typeof parsed.frogExclusiveUnlocked === 'boolean'
          ? parsed.frogExclusiveUnlocked
          : defaults.frogExclusiveUnlocked,
      // Phase 19-05 (UX-08): tutorial seen-flags. Each field optional → fallback на default false.
      tutorialState: {
        seenFirstBox:
          typeof parsed.tutorialState?.seenFirstBox === 'boolean'
            ? parsed.tutorialState.seenFirstBox
            : false,
        seenFirstSerum:
          typeof parsed.tutorialState?.seenFirstSerum === 'boolean'
            ? parsed.tutorialState.seenFirstSerum
            : false,
        seenFirstFeed:
          typeof parsed.tutorialState?.seenFirstFeed === 'boolean'
            ? parsed.tutorialState.seenFirstFeed
            : false,
        seenFirstStabilize:
          typeof parsed.tutorialState?.seenFirstStabilize === 'boolean'
            ? parsed.tutorialState.seenFirstStabilize
            : false,
      },
      // Phase 16: latestShipPos НЕ persisted — всегда null на load.
      latestShipPos: null,
    }
  } catch {
    return defaults
  }
}

function saveCosmicSlice(state: CosmicPersist) {
  try {
    // lastActiveTab — sessionStorage ответственность (UI), но всё же persist:
    // храним для устойчивости к закрытию браузера. UI читает sessionStorage первым.
    localStorage.setItem(COSMIC_KEY, JSON.stringify(state))
  } catch {
    // QuotaExceededError → silent ignore (T-11-03 mitigation)
  }
}

function loadNumberFormat(): NumberFormat {
  try {
    const raw = localStorage.getItem(FORMAT_KEY)
    if (raw === 'short') return 'short'
  } catch {
    /* ignore */
  }
  return 'full'
}

function saveNumberFormat(f: NumberFormat) {
  try {
    localStorage.setItem(FORMAT_KEY, f)
  } catch {
    /* ignore */
  }
}

const _initialFormat = loadNumberFormat()
setGlobalFormat(_initialFormat)

export function saveSessionTimestamp() {
  try {
    localStorage.setItem(SESSION_KEY, Date.now().toString())
  } catch {
    /* ignore */
  }
}

export function getOfflineElapsedMs(): number {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return 0
    const last = parseInt(raw, 10)
    if (!Number.isFinite(last)) return 0
    return Math.max(0, Date.now() - last)
  } catch {
    return 0
  }
}

// ============== STORE ==============

export type BuyFrogResult =
  | { ok: true }
  | { ok: false; reason: 'noGold' | 'capFull' | 'invalid' }

interface GameStateBase {
  gold: number
  addGold: (amount: number) => void
  spendGold: (amount: number) => boolean

  upgrades: Upgrades
  buyUpgrade: (key: keyof Upgrades) => boolean
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
  buyFrog: (level: number) => BuyFrogResult

  // Открытые уровни — для модалки "Открыта новая лягушка"
  discoveredLevels: number[]
  markDiscovered: (level: number) => boolean

  // Включён ли магнит (юзер может выключить кнопкой)
  magnetEnabled: boolean
  toggleMagnet: () => void

  // Текущая локация (1=Болото, 2=Лес, 3=Земля, 4=Космос)
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
  buyFrog: (level) => {
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

    const next = [...state.frogPurchases]
    next[level - 1] = purchases + 1
    saveFrogPurchases(next)
    set({ gold: state.gold - cost, frogPurchases: next })

    eventBus.emit('frog:purchased', { level })
    return { ok: true }
  },

  numberFormat: _initialFormat,
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
    state.scouts !== prev.scouts ||
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
      scouts: state.scouts,
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
