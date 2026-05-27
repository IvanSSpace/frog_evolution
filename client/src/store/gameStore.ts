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
  EVOLUTION_COOLDOWN_MS,
  getEvolutionBonusFraction,
  getEvolutionCost,
  isEvolutionUnlockedForLocation,
  locationGroupForLevel,
} from '../game/config/evolution'
import {
  combatNodeCost,
  type CombatBranch,
  type CombatTreeLevels,
} from '../game/config/combatTree'
import {
  loadUpgrades,
  saveUpgrades,
  loadCombatTree,
  saveCombatTree,
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
  loadBarracksGrid,
  saveBarracksGrid,
  loadBarracksVats,
  saveBarracksVats,
  loadBarracksUnlocked,
  saveBarracksUnlocked,
  loadRaidCooldowns,
  saveRaidCooldowns,
} from './persistence'
import { getWarriorConvertCost } from '../game/config/warriors'
import {
  BARRACKS_GRID_SIZE,
  BATTLE_DECK_SIZE,
  MAX_DECK_SIZE,
  RESERVE_START_IDX,
  type BarracksCell,
  type Vat,
} from './barracks'

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

// Длительность raid-неуязвимости планеты после атаки (1.5ч real-time).
export const RAID_INVULN_MS = 90 * 60 * 1000

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

  // Current logged-in user info (set on boot after auth) — useful for debug/testing.
  username: string | null
  telegramId: string | null
  devFlags: string[]
  setCurrentUser: (info: {
    username: string | null
    telegramId: string | null
    devFlags?: string[]
  }) => void

  // Лягушки на поле + коробки (real-time, обновляется из MainScene)
  entityCount: number
  setEntityCount: (n: number) => void

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

  // Включён ли магнит (юзер может выключить кнопкой)
  magnetEnabled: boolean
  toggleMagnet: () => void

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

  // 2026-05-24: Barracks / PvP raid mode state (Этап 1 — config + state).
  // Unlocked после открытия Леса (L7 discovered). Сетка 5×4 = 20 клеток.
  // До 7 воинов идут в бой. Чанов 3 (по одному на фарм-локацию).
  barracksUnlocked: boolean
  unlockBarracks: () => void
  barracksGrid: (import('./barracks').BarracksCell | null)[]
  /** Положить воина в первую свободную клетку. Возвращает индекс или -1
   *  если все клетки заняты / недостаточно gold для конвертации.
   *  free=true — без списания gold (рекрут через ворота на поле). */
  addWarriorToBarracks: (
    level: number,
    tier?: 0 | 1 | 2,
    free?: boolean,
  ) => number
  /** Очистить клетку (вернуть воина в "удалить"). MVP: без рефанда. */
  removeWarriorFromBarracks: (slotIdx: number) => void
  /** Прямая запись (для drag-n-drop / dev). */
  setBarracksCell: (
    slotIdx: number,
    cell: import('./barracks').BarracksCell | null,
  ) => void
  barracksVats: import('./barracks').Vat[]
  /** Обновить чан (claim после raid / accrual tick). */
  setBarracksVat: (idx: number, vat: import('./barracks').Vat) => void
  /** True пока активна BattleScene (raid). HUD-элементы (magnet/location)
   *  скрываются на это время. */
  battleSceneActive: boolean
  setBattleSceneActive: (v: boolean) => void
  /** True пока игрок выбирает цель рейда через StarMap. PlanetSelectPanel
   *  показывает CTA "Напасть" вместо "Лететь" + UI индикатор. Transient. */
  raidMode: boolean
  setRaidMode: (v: boolean) => void
  /** Активный investigate target — planetId на орбите которой стоим. null = нет. */
  investigatePlanetId: string | null
  setInvestigatePlanetId: (id: string | null) => void
  /** Planet, осматриваемая в immersive RaidScoutScene. null = осмотр закрыт.
   *  Запоминается чтобы вернуться в InvestigateModal после «Назад». */
  scoutPlanetId: string | null
  setScoutPlanetId: (id: string | null) => void
  /** Per-planet raid invulnerability: planetId → expiresAt (Date.now ms).
   *  После атаки планета неуязвима RAID_INVULN_MS (real-time, переживает выход). */
  raidCooldowns: Record<string, number>
  setRaidCooldown: (planetId: string) => void
  /** Post-battle loot summary (slime, серумы по element'у планеты). */
  raidLoot: {
    slime: number
    element: import('./cosmic/types').Element | null
    serumCount: number
    deadCount: number
    victory: boolean
  } | null
  setRaidLoot: (
    loot: {
      slime: number
      element: import('./cosmic/types').Element | null
      serumCount: number
      deadCount: number
      victory: boolean
    } | null,
  ) => void

  // ─── Боевая прокачка (combat tree) ───
  /** Уровни узлов древа по веткам (damage/hp/armor). */
  combatTree: CombatTreeLevels
  /** Купить следующий узел ветки за gold (= слизь 💧). false если максимум/не хватает. */
  buyCombatNode: (branch: CombatBranch) => boolean
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

  upgrades: loadUpgrades(),
  devResetUpgrades: () => {
    const defaults: Upgrades = {
      dropSpeed: 0,
      tractor: 0,
      magnet: 0,
      magnet2: 0,
      magnet3: 0,
      crateQuality: 0,
      rareBoxSpeed: 0,
      ships: 0,
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

  // Current user info — populated после auth в App.tsx boot().
  username: null,
  telegramId: null,
  devFlags: [],
  setCurrentUser: (info) =>
    set({
      username: info.username,
      telegramId: info.telegramId,
      devFlags: info.devFlags ?? [],
    }),

  entityCount: 0,
  setEntityCount: (n) => set({ entityCount: n }),

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
    const { gold: goldCost, essence: essenceCost } = getEvolutionCost(
      level,
      current,
    )
    if (state.gold < goldCost) return { ok: false, reason: 'noGold' }
    if (state.essence < essenceCost) {
      return { ok: false, reason: 'noEssence' }
    }
    const nextTiers = [...state.frogTiers]
    nextTiers[level - 1] = current + 1
    const nextCooldowns = [...state.frogTierCooldowns]
    nextCooldowns[level - 1] = Date.now() + EVOLUTION_COOLDOWN_MS
    saveFrogTiers(nextTiers)
    saveFrogTierCooldowns(nextCooldowns)
    set({
      gold: state.gold - goldCost,
      essence: state.essence - essenceCost,
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

  // ============== BARRACKS / PvP (2026-05-24 Этап 1) ==============
  barracksUnlocked: loadBarracksUnlocked(),
  unlockBarracks: () => {
    const s = get()
    if (s.barracksUnlocked) return
    saveBarracksUnlocked(true)
    set({ barracksUnlocked: true })
  },
  barracksGrid: loadBarracksGrid(),
  addWarriorToBarracks: (level, tier = 0, free = false) => {
    const s = get()
    const cost = free ? 0 : getWarriorConvertCost(level)
    if (!free && s.gold < cost) return -1
    const grid = s.barracksGrid
    // Сначала ищем место в боевой зоне (idx 0-11), но не более MAX_DECK_SIZE
    // занятых клеток там. Если все 7 слотов deck'а заняты — кладём в резерв.
    let deckFilled = 0
    for (let i = 0; i < BATTLE_DECK_SIZE; i++) {
      if (grid[i] !== null) deckFilled++
    }
    let emptyIdx = -1
    if (deckFilled < MAX_DECK_SIZE) {
      // Свободное место в deck (верхние 3 ряда).
      for (let i = 0; i < BATTLE_DECK_SIZE; i++) {
        if (grid[i] === null) {
          emptyIdx = i
          break
        }
      }
    }
    if (emptyIdx === -1) {
      // Либо deck full (7/7) либо нет физически свободных клеток — кладём в reserve.
      for (let i = RESERVE_START_IDX; i < grid.length; i++) {
        if (grid[i] === null) {
          emptyIdx = i
          break
        }
      }
    }
    if (emptyIdx === -1) return -1
    const cell: BarracksCell = { level, tier, addedAtMs: Date.now() }
    const nextGrid = grid.slice()
    nextGrid[emptyIdx] = cell
    saveBarracksGrid(nextGrid)
    set({ gold: s.gold - cost, barracksGrid: nextGrid })
    return emptyIdx
  },
  removeWarriorFromBarracks: (slotIdx) => {
    const s = get()
    if (slotIdx < 0 || slotIdx >= BARRACKS_GRID_SIZE) return
    if (!s.barracksGrid[slotIdx]) return
    const nextGrid = s.barracksGrid.slice()
    nextGrid[slotIdx] = null
    saveBarracksGrid(nextGrid)
    set({ barracksGrid: nextGrid })
  },
  setBarracksCell: (slotIdx, cell) => {
    const s = get()
    if (slotIdx < 0 || slotIdx >= BARRACKS_GRID_SIZE) return
    const nextGrid = s.barracksGrid.slice()
    nextGrid[slotIdx] = cell
    saveBarracksGrid(nextGrid)
    set({ barracksGrid: nextGrid })
  },
  barracksVats: loadBarracksVats(),
  setBarracksVat: (idx, vat) => {
    const s = get()
    if (idx < 0 || idx >= s.barracksVats.length) return
    const next: Vat[] = s.barracksVats.slice()
    next[idx] = vat
    saveBarracksVats(next)
    set({ barracksVats: next })
  },
  battleSceneActive: false,
  setBattleSceneActive: (v) => set({ battleSceneActive: v }),

  raidMode: false,
  setRaidMode: (v) => set({ raidMode: v }),
  investigatePlanetId: null,
  setInvestigatePlanetId: (id) => set({ investigatePlanetId: id }),
  scoutPlanetId: null,
  setScoutPlanetId: (id) => set({ scoutPlanetId: id }),
  raidCooldowns: loadRaidCooldowns(),
  setRaidCooldown: (planetId) => {
    const next = {
      ...get().raidCooldowns,
      [planetId]: Date.now() + RAID_INVULN_MS,
    }
    set({ raidCooldowns: next })
    saveRaidCooldowns(next)
  },
  raidLoot: null,
  setRaidLoot: (loot) => set({ raidLoot: loot }),

  // ─── Боевая прокачка (combat tree) — платится gold (= слизь 💧) ───
  combatTree: loadCombatTree(),
  buyCombatNode: (branch) => {
    const state = get()
    const level = state.combatTree[branch]
    const cost = combatNodeCost(branch, level)
    if (cost === null) return false // ветка максимальна
    if (state.gold < cost) return false
    const nextTree = { ...state.combatTree, [branch]: level + 1 }
    saveCombatTree(nextTree)
    set({ combatTree: nextTree, gold: state.gold - cost })
    return true
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
    state.firstContactsSeen !== prev.firstContactsSeen ||
    // Phase 27 Plan 27-01: relationship/chain/pending state persisted.
    state.raceRelationships !== prev.raceRelationships ||
    state.chainProgress !== prev.chainProgress ||
    state.pendingItems !== prev.pendingItems ||
    // Phase 28 Plan 28-01: quest state — active + completed history.
    state.activeQuests !== prev.activeQuests ||
    state.completedQuests !== prev.completedQuests
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
      // Phase 27 Plan 27-01: relationship/chain/pending state persisted.
      raceRelationships: state.raceRelationships,
      chainProgress: state.chainProgress,
      pendingItems: state.pendingItems,
      // Phase 28 Plan 28-01: quest state persisted (defensive load в loadCosmicSlice).
      activeQuests: state.activeQuests,
      completedQuests: state.completedQuests,
    })
  }
})
