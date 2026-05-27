// All localStorage load/save helpers for the game store.
//
// localStorage is now emergency fallback only — server is primary source of truth.
// Per-key validation replaces version-based wipe: corrupt keys fall back to defaults.

import { MAX_LEVEL } from '../game/config/frogs'
import { UPGRADE_CONFIG, type Upgrades } from '../game/config/upgrades'
import { LOCATIONS } from '../game/config/locations'
import { setGlobalFormat, type NumberFormat } from '../utils/formatting'
import { makeInitialCosmicSlice, type BoxData } from './cosmic/types'
// Phase 22 Plan 22-07: legacy state migration (idempotent).
import { migratePhase22 } from './migrations/phase22'
// Phase 23 Plan 23-01: onboarding flow per-device state.
import type { OnboardingState } from './onboarding/types'
// Phase 26 Plan 26-01: per-race first contact tracker (defensive load).
import type { RaceId } from '../game/config/races'
// Phase 27 Plan 27-01: pending engine types + relationship clamp bounds.
import type { PendingItem, ChainItem } from '../game/config/raceChains'
import { RELATIONSHIP_MIN, RELATIONSHIP_MAX } from '../game/config/raceChains'
// Phase 28 Plan 28-01: quest state types + cap + skeleton lookup для defensive load.
import type {
  ActiveQuest,
  CompletedQuest,
  QuestType,
} from '../game/config/quests'
import { QUESTS, COMPLETED_QUEST_HISTORY_CAP } from '../game/config/quests'

// ─── storage keys ────────────────────────────────────────────────────────────

const UPGRADES_KEY = 'frog_evolution_upgrades'
const PURCHASES_KEY = 'frog_evolution_frog_purchases'
const FROG_TIERS_KEY = 'frog_evolution_frog_tiers'
// 2026-05-23: cooldown timestamps per frog level (когда лочится снова можно эволвить).
// Хранится массив длиной 18, значение 0 = нет кулдауна, иначе Date.now()-таймстамп
// окончания cooldown'а. Тикает в real-time (offline тоже).
const FROG_TIER_COOLDOWNS_KEY = 'frog_evolution_frog_tier_cooldowns'
// 2026-05-23: временный 6h buff к доходу от L18+L18 merge'а.
// { until: ms timestamp, percent: 5/2.5/etc } | null
const TEMP_INCOME_BUFF_KEY = 'frog_evolution_temp_income_buff'
const DISCOVERED_KEY = 'frog_evolution_discovered'
const MAGNET_ENABLED_KEY = 'frog_evolution_magnet_enabled'
const FORMAT_KEY = 'frog_format'
const COSMIC_KEY = 'frog_evolution_cosmic'
const LOCATION_KEY = 'frog_evolution_current_location'
const LOCATION_FROGS_KEY = 'frog_evolution_location_frogs'
const BOX_OPEN_COUNT_KEY = 'frog_evolution_box_open_count'
// Phase 22 Plan 22-06: cosmos gate — persisted unlock flag, отдельно от cosmic slice
// (toplevel state.hasCosmosUnlocked). Включается при первом L18+L18 normal sentinel.
const COSMOS_UNLOCKED_KEY = 'frog_evolution_cosmos_unlocked'
// Phase 24 Plan 24-01: captain creation cinematic — per-user milestone flag,
// server-sync через cosmic JSON blob (не per-device как onboarding).
const CAPTAIN_BIRTH_SEEN_KEY = 'frog_evolution_captain_birth_seen'
// 2026-05-18: L18+L18 merge bonus counter — для tiered % multiplier.
const L18_MERGES_COUNT_KEY = 'frog_evolution_l18_merges_count'
// 2026-05-18: absolute gold/sec bonus от first L18+L18 merge (= 2× L18 income).
const L18_ABSOLUTE_BONUS_KEY = 'frog_evolution_l18_absolute_bonus'
// Phase 23 Plan 23-01: onboarding flow per-device state.
// Хранится отдельным ключом (не sync'ится с сервером) — это локальная UX-фича.
const ONBOARDING_KEY = 'frog_evolution_onboarding'

// ─── upgrades ────────────────────────────────────────────────────────────────

export function loadUpgrades(): Upgrades {
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
  try {
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
        magnet2: Math.min(parsed.magnet2 ?? 0, UPGRADE_CONFIG.magnet2.maxLevel),
        magnet3: Math.min(parsed.magnet3 ?? 0, UPGRADE_CONFIG.magnet3.maxLevel),
        crateQuality: Math.min(
          parsed.crateQuality ?? 0,
          UPGRADE_CONFIG.crateQuality.maxLevel,
        ),
        rareBoxSpeed: Math.min(
          parsed.rareBoxSpeed ?? 0,
          UPGRADE_CONFIG.rareBoxSpeed.maxLevel,
        ),
        ships: Math.min(parsed.ships ?? 0, UPGRADE_CONFIG.ships.maxLevel),
      }
    }
  } catch {
    /* ignore */
  }
  return defaults
}

export function saveUpgrades(u: Upgrades) {
  try {
    localStorage.setItem(UPGRADES_KEY, JSON.stringify(u))
  } catch {
    /* ignore */
  }
}

// ─── frog purchases ──────────────────────────────────────────────────────────

export function loadFrogPurchases(): number[] {
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

export function saveFrogPurchases(arr: number[]) {
  try {
    localStorage.setItem(PURCHASES_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

// ─── frog tiers (evolution) ──────────────────────────────────────────────────

export function loadFrogTiers(): number[] {
  try {
    const raw = localStorage.getItem(FROG_TIERS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as number[]
      if (Array.isArray(parsed)) {
        const arr = new Array(MAX_LEVEL).fill(0)
        for (let i = 0; i < Math.min(parsed.length, MAX_LEVEL); i++) {
          const v = Math.max(0, Math.min(2, Math.floor(parsed[i] ?? 0)))
          arr[i] = v
        }
        return arr
      }
    }
  } catch {
    /* ignore */
  }
  return new Array(MAX_LEVEL).fill(0)
}

export function saveFrogTiers(arr: number[]) {
  try {
    localStorage.setItem(FROG_TIERS_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

// ─── frog tier cooldowns (per-level evolution cooldowns) ─────────────────────

export function loadFrogTierCooldowns(): number[] {
  try {
    const raw = localStorage.getItem(FROG_TIER_COOLDOWNS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as number[]
      if (Array.isArray(parsed)) {
        const arr = new Array(MAX_LEVEL).fill(0)
        for (let i = 0; i < Math.min(parsed.length, MAX_LEVEL); i++) {
          const v = Number(parsed[i] ?? 0)
          arr[i] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
        }
        return arr
      }
    }
  } catch {
    /* ignore */
  }
  return new Array(MAX_LEVEL).fill(0)
}

export function saveFrogTierCooldowns(arr: number[]) {
  try {
    localStorage.setItem(FROG_TIER_COOLDOWNS_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

// ─── temporary income buff (6h after L18+L18 merge) ──────────────────────────

export function loadTemporaryIncomeBuff(): {
  until: number
  percent: number
} | null {
  try {
    const raw = localStorage.getItem(TEMP_INCOME_BUFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<{
      until: number
      percent: number
    }>
    if (
      typeof parsed.until === 'number' &&
      typeof parsed.percent === 'number' &&
      parsed.percent > 0 &&
      parsed.until > Date.now()
    ) {
      return { until: parsed.until, percent: parsed.percent }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function saveTemporaryIncomeBuff(
  buff: { until: number; percent: number } | null,
) {
  try {
    if (!buff) {
      localStorage.removeItem(TEMP_INCOME_BUFF_KEY)
    } else {
      localStorage.setItem(TEMP_INCOME_BUFF_KEY, JSON.stringify(buff))
    }
  } catch {
    /* ignore */
  }
}

// ─── discovered (test mode: always [1..5]) ───────────────────────────────────

export function loadDiscovered(): number[] {
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

export function saveDiscovered(arr: number[]) {
  try {
    localStorage.setItem(DISCOVERED_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

// ─── locations ───────────────────────────────────────────────────────────────

// Резиденты каждой локации — массив уровней лягушек на её поле.
// Дефолт: Лужа — 1 стартовая L1 лягушка, остальные локации пустые.
// Это стартовое состояние для всех новых пользователей (без сейва).
export function loadLocationFrogs(): number[][] {
  try {
    const raw = localStorage.getItem(LOCATION_FROGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Нормализуем длину под текущий LOCATIONS.length: старые сейвы (когда было
      // 3 локации) паддятся пустыми массивами для новых слотов, лишние — обрезаются.
      if (Array.isArray(parsed)) {
        return LOCATIONS.map((_, i) => {
          const arr = parsed[i]
          return Array.isArray(arr)
            ? arr.filter((n) => Number.isFinite(n) && n > 0)
            : []
        })
      }
    }
  } catch {
    /* ignore */
  }
  const arr: number[][] = LOCATIONS.map(() => [])
  arr[0] = [1]
  return arr
}

export function saveLocationFrogsArr(arr: number[][]) {
  try {
    localStorage.setItem(LOCATION_FROGS_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

export function loadCurrentLocation(): number {
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    const n = parseInt(raw ?? '1', 10)
    if (Number.isFinite(n) && LOCATIONS.some((l) => l.id === n)) return n
  } catch {
    /* ignore */
  }
  return 1
}

export function saveCurrentLocation(id: number) {
  try {
    localStorage.setItem(LOCATION_KEY, String(id))
  } catch {
    /* ignore */
  }
}

// ─── magnet ──────────────────────────────────────────────────────────────────

export function loadMagnetEnabled(): boolean {
  try {
    const raw = localStorage.getItem(MAGNET_ENABLED_KEY)
    if (raw === 'false') return false
  } catch {
    /* ignore */
  }
  return true
}

export function saveMagnetEnabled(v: boolean) {
  try {
    localStorage.setItem(MAGNET_ENABLED_KEY, String(v))
  } catch {
    /* ignore */
  }
}

// ─── cosmic slice persistence ────────────────────────────────────────────────

export type CosmicPersist = ReturnType<typeof makeInitialCosmicSlice>

export function loadCosmicSlice(): CosmicPersist {
  const defaults = makeInitialCosmicSlice()
  try {
    const raw = localStorage.getItem(COSMIC_KEY)
    if (!raw) return defaults
    // Phase 22 Plan 22-07: legacy migration ДО типизированной валидации.
    // migratePhase22:
    //   - strip rarity/feedCount/stabilized/ceiling/rollHistory из carriers
    //   - flatten nested serums {fire: {common, rare,...}} → {fire: sum}
    //   - default Phase 22 fields (essence/ascendedCarriers/perma*/shopPurchaseCounts)
    //   - inferring hasCosmosUnlocked (handled отдельно в gameStore init)
    const parsed = migratePhase22(JSON.parse(raw))
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

    // 2026-05-23: filter legacy serums (shadow/arcane/mechanical/war/void удалены).
    // Сохраняем только valid Elements; неизвестные ключи silent drop.
    const cleanSerums = { ...defaults.serums }
    if (parsed.serums && typeof parsed.serums === 'object') {
      for (const key of Object.keys(cleanSerums)) {
        const v = (parsed.serums as Record<string, unknown>)[key]
        if (typeof v === 'number' && v >= 0) {
          cleanSerums[key as keyof typeof cleanSerums] = Math.floor(v)
        }
      }
    }

    // 2026-05-23: фильтр legacy элементов в carriers/ascendedCarriers.
    const validElements = new Set(Object.keys(defaults.serums))
    const carriersFiltered = (
      Array.isArray(parsed.carriers) ? parsed.carriers : []
    ).filter(
      (c: unknown): c is { frogId: string; element: string; level: number } =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as Record<string, unknown>).element === 'string' &&
        validElements.has((c as Record<string, unknown>).element as string),
    )

    return {
      serums: cleanSerums,
      boxes,
      ship,
      carriers: carriersFiltered as CosmicPersist['carriers'],
      // Phase 22 Plan 22-03: ascendedCarriers + essence persisted whitelist.
      // Shape: { id: string, element: Element, ascendedAt: number }.
      ascendedCarriers: Array.isArray(parsed.ascendedCarriers)
        ? ((parsed.ascendedCarriers as unknown[]).filter(
            (a): a is { id: string; element: string; ascendedAt: number } =>
              typeof a === 'object' &&
              a !== null &&
              typeof (a as Record<string, unknown>).id === 'string' &&
              typeof (a as Record<string, unknown>).element === 'string' &&
              validElements.has(
                (a as Record<string, unknown>).element as string,
              ) &&
              typeof (a as Record<string, unknown>).ascendedAt === 'number',
          ) as CosmicPersist['ascendedCarriers'])
        : defaults.ascendedCarriers,
      essence:
        typeof parsed.essence === 'number' && parsed.essence >= 0
          ? parsed.essence
          : defaults.essence,
      mutagen:
        typeof parsed.mutagen === 'number' && parsed.mutagen >= 0
          ? parsed.mutagen
          : defaults.mutagen,
      routes:
        parsed.routes && typeof parsed.routes === 'object'
          ? {
              common:
                Number((parsed.routes as Record<string, unknown>).common) || 0,
              rare:
                Number((parsed.routes as Record<string, unknown>).rare) || 0,
              epic:
                Number((parsed.routes as Record<string, unknown>).epic) || 0,
            }
          : defaults.routes,
      // Phase 22 Plan 22-05: shop perma upgrades + counters whitelist.
      permaSlotBonus:
        typeof parsed.permaSlotBonus === 'number' && parsed.permaSlotBonus >= 0
          ? parsed.permaSlotBonus
          : defaults.permaSlotBonus,
      permaShipSpeedBonus:
        typeof parsed.permaShipSpeedBonus === 'number' &&
        parsed.permaShipSpeedBonus >= 0
          ? parsed.permaShipSpeedBonus
          : defaults.permaShipSpeedBonus,
      permaSerumDropBonus:
        typeof parsed.permaSerumDropBonus === 'number' &&
        parsed.permaSerumDropBonus >= 0
          ? parsed.permaSerumDropBonus
          : defaults.permaSerumDropBonus,
      shopPurchaseCounts:
        parsed.shopPurchaseCounts &&
        typeof parsed.shopPurchaseCounts === 'object'
          ? (parsed.shopPurchaseCounts as Record<string, number>)
          : defaults.shopPurchaseCounts,
      // Phase 17: bitset extended 24 → 192 bytes (1536 bits). Pad-only migration.
      // Phase 20: shrink to 144 bytes (1152 bits) после 24→18 frog levels.
      //   NOTE: migration code below still pads/truncates to 192 — needs a separate
      //   Phase 20 migration step to truncate old saves to 144. See open issue.
      bestiaryBitset: (() => {
        if (!Array.isArray(parsed.bestiaryBitset))
          return defaults.bestiaryBitset
        const arr = parsed.bestiaryBitset.slice()
        while (arr.length < 192) arr.push(0)
        return arr.slice(0, 192)
      })(),
      pityCounters: parsed.pityCounters ?? defaults.pityCounters,
      // 2026-05-18 audit fix: whitelist was missing 'inventory' (Phase 26-04)
      // и 'contacts' (Phase 27-04) — каждый save→load цикл silently сбрасывал
      // tab на 'scouts'. Synced через gameSync.snapshotForSave, поэтому
      // некорректный whitelist здесь делал server-sync поля бесполезным:
      // server мог принести 'contacts', persistence на следующем boot его
      // дропал → user всегда возвращался на 'scouts' tab.
      lastActiveTab:
        parsed.lastActiveTab === 'scouts' ||
        parsed.lastActiveTab === 'boxes' ||
        parsed.lastActiveTab === 'bestiary' ||
        parsed.lastActiveTab === 'carriers' ||
        parsed.lastActiveTab === 'shop' ||
        parsed.lastActiveTab === 'inventory' ||
        parsed.lastActiveTab === 'contacts' ||
        // Phase 28 Plan 28-01: accept 'quests' as new 8-й tab literal.
        parsed.lastActiveTab === 'quests'
          ? parsed.lastActiveTab
          : 'scouts',
      crew: parsed.crew ?? defaults.crew,
      // transient UI state — всегда defaults на load.
      serumDragActive: false,
      selectedSerum: null,
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
      frogExclusiveUnlocked:
        typeof parsed.frogExclusiveUnlocked === 'boolean'
          ? parsed.frogExclusiveUnlocked
          : defaults.frogExclusiveUnlocked,
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
      // latestShipPos НЕ persisted — всегда null на load.
      latestShipPos: null,
      // Phase 26 Plan 26-01: defensive load firstContactsSeen.
      // T-26-01-01 / T-26-01-02 mitigation:
      //   - iterate over known raceIds (defaults.firstContactsSeen keys) — unknown
      //     server-side raceIds игнорируются (forward-compat: future Phase 27+ races
      //     не сломают current client).
      //   - accept ONLY v === true (any other shape/value → дефолт false).
      //   - Поломанный/missing parsed.firstContactsSeen → defaults all-false.
      firstContactsSeen: (() => {
        const fcs = { ...defaults.firstContactsSeen }
        const raw = parsed.firstContactsSeen
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const rawRec = raw as Record<string, unknown>
          for (const id of Object.keys(fcs) as RaceId[]) {
            if (rawRec[id] === true) fcs[id] = true
          }
        }
        return fcs
      })(),
      // Phase 27 Plan 27-01: defensive load raceRelationships.
      // T-27-01-01 / T-27-01-02 mitigation:
      //   - iterate over known raceIds (defaults.raceRelationships keys) — unknown
      //     server-side raceIds silently dropped (forward-compat).
      //   - accept ONLY finite number, clamp to [RELATIONSHIP_MIN, RELATIONSHIP_MAX]
      //     через Math.floor + min/max. Any other shape → default INITIAL_RELATIONSHIP.
      raceRelationships: (() => {
        const result = { ...defaults.raceRelationships }
        const raw = parsed.raceRelationships
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const rawRec = raw as Record<string, unknown>
          for (const id of Object.keys(result) as RaceId[]) {
            const v = rawRec[id]
            if (typeof v === 'number' && Number.isFinite(v)) {
              result[id] = Math.max(
                RELATIONSHIP_MIN,
                Math.min(RELATIONSHIP_MAX, Math.floor(v)),
              )
            }
          }
        }
        return result
      })(),
      // Phase 27 Plan 27-01: defensive load chainProgress.
      // Accept ONLY non-negative finite number; floor дробные; default 0.
      chainProgress: (() => {
        const result = { ...defaults.chainProgress }
        const raw = parsed.chainProgress
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const rawRec = raw as Record<string, unknown>
          for (const id of Object.keys(result) as RaceId[]) {
            const v = rawRec[id]
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
              result[id] = Math.floor(v)
            }
          }
        }
        return result
      })(),
      // Phase 27 Plan 27-01: defensive load pendingItems.
      // T-27-01-01 mitigation — strip entries with invalid shape:
      //   - missing id/raceId/chainStep
      //   - raceId not in known set
      //   - chainStep negative
      //   - item.type not in 4 known variants
      // createdAt missing/non-number → Date.now() fallback (acceptable; ordering used
      // только for UI sort, not gameplay).
      pendingItems: (() => {
        const raw = parsed.pendingItems
        if (!Array.isArray(raw)) return defaults.pendingItems
        const knownRaceIds = new Set(Object.keys(defaults.raceRelationships))
        const knownTypes = new Set(['msg', 'dialog', 'quest_hook', 'event'])
        const out: PendingItem[] = []
        for (const e of raw) {
          if (!e || typeof e !== 'object') continue
          const r = e as Record<string, unknown>
          if (typeof r.id !== 'string') continue
          if (typeof r.raceId !== 'string' || !knownRaceIds.has(r.raceId))
            continue
          if (typeof r.chainStep !== 'number' || r.chainStep < 0) continue
          if (!r.item || typeof r.item !== 'object') continue
          const item = r.item as Record<string, unknown>
          if (typeof item.type !== 'string' || !knownTypes.has(item.type))
            continue
          out.push({
            id: r.id,
            raceId: r.raceId as RaceId,
            chainStep: Math.floor(r.chainStep),
            item: r.item as ChainItem,
            createdAt:
              typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
          })
        }
        return out
      })(),
      // Phase 28 Plan 28-01: defensive load activeQuests.
      // Strip entries with invalid shape:
      //   - missing id/questId/raceId/type
      //   - questId not present в QUESTS lookup (forward-compat: drops removed/renamed quests)
      //   - raceId not in known set
      //   - type not in 4 known QuestType variants
      //   - progress not non-negative finite number → floored to integer
      //   - startedAt non-number → Date.now() fallback (display ordering only)
      //   - target field shape NOT validated here (trusted from QUESTS lookup) — engine в
      //     Plan 28-03 validates on activation путём шаблона из QUESTS[questId].target.
      // NOT enforce ACTIVE_QUEST_CAP=5 — forward-compat (mirror CHAIN_PENDING_CAP pattern).
      activeQuests: (() => {
        const raw = parsed.activeQuests
        if (!Array.isArray(raw)) return defaults.activeQuests
        const knownRaceIds = new Set(Object.keys(defaults.raceRelationships))
        const knownTypes = new Set<QuestType>([
          'delivery',
          'exploration',
          'merge',
          'diplomacy',
        ])
        const out: ActiveQuest[] = []
        for (const e of raw) {
          if (!e || typeof e !== 'object') continue
          const r = e as Record<string, unknown>
          if (typeof r.id !== 'string') continue
          if (typeof r.questId !== 'string') continue
          // Drop entries pointing at unknown questIds — QUESTS skeleton fills в Plan 28-02;
          // before then ALL persisted activeQuests get cleaned out here (acceptable: no
          // production data exists for Plan 28-01 wave).
          if (!(r.questId in QUESTS)) continue
          if (typeof r.raceId !== 'string' || !knownRaceIds.has(r.raceId))
            continue
          if (
            typeof r.type !== 'string' ||
            !knownTypes.has(r.type as QuestType)
          )
            continue
          if (!r.target || typeof r.target !== 'object') continue
          const progress =
            typeof r.progress === 'number' &&
            Number.isFinite(r.progress) &&
            r.progress >= 0
              ? Math.floor(r.progress)
              : 0
          const startedAt =
            typeof r.startedAt === 'number' ? r.startedAt : Date.now()
          out.push({
            id: r.id,
            questId: r.questId,
            raceId: r.raceId as RaceId,
            type: r.type as QuestType,
            target: r.target as ActiveQuest['target'],
            progress,
            startedAt,
          })
        }
        return out
      })(),
      // Phase 28 Plan 28-01: defensive load completedQuests.
      // Strip entries with invalid shape (same pattern as activeQuests). FIFO trim
      // at COMPLETED_QUEST_HISTORY_CAP=100 newest by completedAt desc.
      // rewardClaimed field shape NOT deep-validated — kept opaque (engine wrote it).
      completedQuests: (() => {
        const raw = parsed.completedQuests
        if (!Array.isArray(raw)) return defaults.completedQuests
        const knownRaceIds = new Set(Object.keys(defaults.raceRelationships))
        const out: CompletedQuest[] = []
        for (const e of raw) {
          if (!e || typeof e !== 'object') continue
          const r = e as Record<string, unknown>
          if (typeof r.id !== 'string') continue
          if (typeof r.questId !== 'string') continue
          if (typeof r.raceId !== 'string' || !knownRaceIds.has(r.raceId))
            continue
          if (typeof r.completedAt !== 'number') continue
          if (!r.rewardClaimed || typeof r.rewardClaimed !== 'object') continue
          out.push({
            id: r.id,
            questId: r.questId,
            raceId: r.raceId as RaceId,
            completedAt: r.completedAt,
            rewardClaimed: r.rewardClaimed as CompletedQuest['rewardClaimed'],
          })
        }
        // FIFO trim: sort desc by completedAt, keep newest CAP entries.
        out.sort((a, b) => b.completedAt - a.completedAt)
        return out.slice(0, COMPLETED_QUEST_HISTORY_CAP)
      })(),
    }
  } catch {
    return defaults
  }
}

export function saveCosmicSlice(state: CosmicPersist) {
  try {
    localStorage.setItem(COSMIC_KEY, JSON.stringify(state))
  } catch {
    // QuotaExceededError → silent ignore (T-11-03 mitigation)
  }
}

// ─── box open count (mega-box progress) ─────────────────────────────────────

export function loadBoxOpenCount(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = localStorage.getItem(BOX_OPEN_COUNT_KEY)
  if (!raw) return 0
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function saveBoxOpenCount(n: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(BOX_OPEN_COUNT_KEY, String(n))
}

// ─── field boxes (коробки на земле Болота) ──────────────────────────────────
// Раньше field-боксы не персистились: на перезаходе исчезали (offline-fill
// триггерился только при offline > 60с). Сохраняем позиции, восстанавливаем
// на возврате в Болото.

export interface FieldBoxSnap {
  x: number
  y: number
  r: boolean // isRare
}

const FIELD_BOXES_KEY = 'frog_evolution_field_boxes'

export function loadFieldBoxes(): FieldBoxSnap[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(FIELD_BOXES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (b) =>
          b &&
          typeof b.x === 'number' &&
          typeof b.y === 'number' &&
          Number.isFinite(b.x) &&
          Number.isFinite(b.y),
      )
      .map((b) => ({ x: b.x, y: b.y, r: !!b.r }))
  } catch {
    return []
  }
}

export function saveFieldBoxes(boxes: FieldBoxSnap[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FIELD_BOXES_KEY, JSON.stringify(boxes))
}

// ─── cosmos unlock flag (Phase 22 Plan 22-06) ───────────────────────────────
//
// Хранится отдельным ключом (не в COSMIC_KEY), чтобы выживать любые corrupt
// resets cosmic slice (T-11-01 mitigation pattern).
//
// Phase 22 Plan 22-07 (migration): на load — если legacy state имеет
// discovered[19]=true но cosmosUnlocked отсутствует, выставить true.
// Здесь только примитивный getter/setter; migration logic — phase22.ts.

export function loadCosmosUnlocked(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    const raw = localStorage.getItem(COSMOS_UNLOCKED_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false

    // Phase 22 Plan 22-07: legacy inference — если ключ отсутствует, попробуем
    // вывести из discovered[19] (cosmos sentinel из Phase 16).
    // Migration single-shot: если inferred true → сохраняем под новым ключом
    // чтобы следующие loads не пересчитывали.
    const discRaw = localStorage.getItem(DISCOVERED_KEY)
    if (discRaw) {
      try {
        const arr = JSON.parse(discRaw)
        if (Array.isArray(arr) && arr.includes(19)) {
          saveCosmosUnlocked(true)
          return true
        }
      } catch {
        /* ignore parse error */
      }
    }
    // Также проверяем cosmic slice — если migrated state указал
    // hasCosmosUnlocked=true (Plan 22-07 migration), берём оттуда.
    const cosmicRaw = localStorage.getItem(COSMIC_KEY)
    if (cosmicRaw) {
      try {
        const parsed = migratePhase22(JSON.parse(cosmicRaw)) as {
          hasCosmosUnlocked?: boolean
        }
        if (parsed?.hasCosmosUnlocked === true) {
          saveCosmosUnlocked(true)
          return true
        }
      } catch {
        /* ignore */
      }
    }

    return false
  } catch {
    return false
  }
}

export function saveCosmosUnlocked(v: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(COSMOS_UNLOCKED_KEY, v ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

// ─── captain birth seen flag (Phase 24 Plan 24-01) ──────────────────────────
//
// Toplevel per-user flag, аналогично COSMOS_UNLOCKED_KEY:
//   - false до первого L18+L18 normal merge → cinematic играется один раз
//   - true → cinematic skipped (idempotent)
//
// Server-sync через cosmic JSON blob (см. gameSync.ts) — флаг переезжает между
// устройствами игрока. localStorage здесь — only emergency fallback / offline boot.
//
// Legacy migration (single-shot): если игрок уже имел discoveredLevels[19] до
// cinematic'а (uplifted save) — mark seen чтобы НЕ играть cinematic для
// существующих cosmos-unlocked игроков. То же inference из cosmic blob если
// server-sync уже принёс флаг.

export function loadCaptainBirthSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    const raw = localStorage.getItem(CAPTAIN_BIRTH_SEEN_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false

    // Legacy inference: uplifted save с discovered[19] → mark seen.
    const discRaw = localStorage.getItem(DISCOVERED_KEY)
    if (discRaw) {
      try {
        const arr = JSON.parse(discRaw)
        if (Array.isArray(arr) && arr.includes(19)) {
          saveCaptainBirthSeen(true)
          return true
        }
      } catch {
        /* ignore parse error */
      }
    }
    // Также проверяем cosmic blob — если server-sync уже принёс captainBirthSeen
    // (gameSync.ts loadGameState пишет туда), читаем оттуда.
    const cosmicRaw = localStorage.getItem(COSMIC_KEY)
    if (cosmicRaw) {
      try {
        const parsed = JSON.parse(cosmicRaw) as { captainBirthSeen?: boolean }
        if (parsed?.captainBirthSeen === true) {
          saveCaptainBirthSeen(true)
          return true
        }
      } catch {
        /* ignore */
      }
    }
    return false
  } catch {
    return false
  }
}

export function saveCaptainBirthSeen(v: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CAPTAIN_BIRTH_SEEN_KEY, v ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

// ─── l18 merges count (gold bonus accumulator) ───────────────────────────────

export function loadL18MergesCount(): number {
  if (typeof localStorage === 'undefined') return 0
  try {
    const raw = localStorage.getItem(L18_MERGES_COUNT_KEY)
    if (!raw) return 0
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function saveL18MergesCount(n: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      L18_MERGES_COUNT_KEY,
      String(Math.max(0, Math.floor(n))),
    )
  } catch {
    /* ignore */
  }
}

export function loadL18AbsoluteBonusPerSec(): number {
  if (typeof localStorage === 'undefined') return 0
  try {
    const raw = localStorage.getItem(L18_ABSOLUTE_BONUS_KEY)
    if (!raw) return 0
    const n = parseFloat(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function saveL18AbsoluteBonusPerSec(n: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(L18_ABSOLUTE_BONUS_KEY, String(Math.max(0, n)))
  } catch {
    /* ignore */
  }
}

// ─── number format ───────────────────────────────────────────────────────────

export function loadNumberFormat(): NumberFormat {
  try {
    const raw = localStorage.getItem(FORMAT_KEY)
    if (raw === 'short') return 'short'
  } catch {
    /* ignore */
  }
  return 'full'
}

export function saveNumberFormat(f: NumberFormat) {
  try {
    localStorage.setItem(FORMAT_KEY, f)
  } catch {
    /* ignore */
  }
}

// ─── onboarding (Phase 23 Plan 23-01) ───────────────────────────────────────
//
// Per-device localStorage state for the soft 4-beat onboarding coordinator
// (Welcome → Tap-hint → Merge-demo → Location-celebration).
//
// Same defensive pattern as other loaders: corrupt JSON / missing key → defaults.
// Per-field type check guards against partial corruption (T-11-01 pattern).

export function loadOnboarding(): OnboardingState {
  const defaults: OnboardingState = {
    welcomeSeen: false,
    firstBoxTapSeen: false,
    firstMergeSeen: false,
    locationsCelebrated: {},
  }
  if (typeof localStorage === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      welcomeSeen:
        typeof parsed.welcomeSeen === 'boolean' ? parsed.welcomeSeen : false,
      firstBoxTapSeen:
        typeof parsed.firstBoxTapSeen === 'boolean'
          ? parsed.firstBoxTapSeen
          : false,
      firstMergeSeen:
        typeof parsed.firstMergeSeen === 'boolean'
          ? parsed.firstMergeSeen
          : false,
      locationsCelebrated:
        parsed.locationsCelebrated &&
        typeof parsed.locationsCelebrated === 'object' &&
        !Array.isArray(parsed.locationsCelebrated)
          ? Object.fromEntries(
              Object.entries(parsed.locationsCelebrated)
                .filter(([k, v]) => !isNaN(Number(k)) && typeof v === 'boolean')
                .map(([k, v]) => [Number(k), v as boolean]),
            )
          : {},
    }
  } catch {
    return defaults
  }
}

export function saveOnboarding(state: OnboardingState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state))
  } catch {
    /* ignore (QuotaExceededError fallback) */
  }
}

// ─── seen levels: для badge «новый контент» в FrogShop / Bestiary ────────────
// Хранятся per-device localStorage; не синкятся с сервером (badge — UX-локально).
// Default = пустой массив; компонент при mount'е делает seen := discoveredLevels,
// поэтому новый юзер не увидит false-positive badge.

const FROG_SHOP_SEEN_KEY = 'frog_evolution_frogshop_seen_v1'
const BESTIARY_SEEN_KEY = 'frog_evolution_bestiary_seen_v1'

export function loadFrogShopSeenLevels(): number[] {
  try {
    const raw = localStorage.getItem(FROG_SHOP_SEEN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((n): n is number => typeof n === 'number')
  } catch {
    return []
  }
}

export function saveFrogShopSeenLevels(arr: number[]): void {
  try {
    localStorage.setItem(FROG_SHOP_SEEN_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

export function loadBestiarySeenLevels(): number[] {
  try {
    const raw = localStorage.getItem(BESTIARY_SEEN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((n): n is number => typeof n === 'number')
  } catch {
    return []
  }
}

export function saveBestiarySeenLevels(arr: number[]): void {
  try {
    localStorage.setItem(BESTIARY_SEEN_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

// Side effect on import: apply persisted format globally so first render
// uses the user's preferred number format (1.5K vs 1,500).
const _initialFormat = loadNumberFormat()
setGlobalFormat(_initialFormat)
