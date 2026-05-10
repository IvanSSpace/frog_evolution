// All localStorage load/save helpers for the game store.
//
// Schema versioning: STORAGE_VERSION is bumped when persisted shape changes
// in a backward-incompatible way. On version mismatch, all keys are wiped
// (loadUpgrades does the wipe + sets new version).

import { MAX_LEVEL } from '../game/config/frogs'
import { UPGRADE_CONFIG, type Upgrades } from '../game/config/upgrades'
import { LOCATIONS } from '../game/config/locations'
import { setGlobalFormat, type NumberFormat } from '../utils/formatting'
import { makeInitialCosmicSlice, type BoxData } from './cosmic/types'

// ─── storage keys ────────────────────────────────────────────────────────────

const UPGRADES_KEY = 'frog_evolution_upgrades'
const PURCHASES_KEY = 'frog_evolution_frog_purchases'
const DISCOVERED_KEY = 'frog_evolution_discovered'
const MAGNET_ENABLED_KEY = 'frog_evolution_magnet_enabled'
const VERSION_KEY = 'frog_evolution_storage_version'
const SESSION_KEY = 'frog_evolution_last_session'
const FORMAT_KEY = 'frog_format'
const COSMIC_KEY = 'frog_evolution_cosmic'
const LOCATION_KEY = 'frog_evolution_current_location'
const LOCATION_FROGS_KEY = 'frog_evolution_location_frogs'

// Bumped when configs change → old saves wiped.
// 16 (Phase 11): добавлен COSMIC_KEY для CosmicSlice (Cosmic Frogs System)
// 17 (Phase 16): ShipState discriminated union + sentinel flags + bonusRarity
// 18 (Phase 15): BoxData shape extended (planetId/planetName/archetype/createdAt);
//                bonusRarity changed number → 'rare'|'epic'|'legendary' enum.
// 19 (Phase 17): bestiaryBitset 24→192 bytes (lossless pad migration); CosmicTab
//                union extended с 'carriers'; CarrierData расширен
//                ceiling?/rollHistory? (optional → backward compat).
const STORAGE_VERSION = 19

// ─── upgrades ────────────────────────────────────────────────────────────────

export function loadUpgrades(): Upgrades {
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
      localStorage.removeItem(COSMIC_KEY)
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
// Дефолт: Болото — L1..L6 по одной, остальные пустые.
export function loadLocationFrogs(): number[][] {
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
  const arr: number[][] = LOCATIONS.map(() => [])
  arr[0] = [1, 2, 3, 4, 5, 6]
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

    return {
      serums: parsed.serums ?? defaults.serums,
      boxes,
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

// Side effect on import: apply persisted format globally so first render
// uses the user's preferred number format (1.5K vs 1,500).
const _initialFormat = loadNumberFormat()
setGlobalFormat(_initialFormat)

// ─── session state (for offline tractor income) ─────────────────────────────
//
// SESSION_KEY now stores JSON { ts, incomePerSec } so the tractor offline
// payout uses the player's actual farm income/sec at the moment of leaving
// rather than a fixed table tied to upgrade level. The shape change is
// ephemeral (not migration-tracked) — a legacy plain-number string is read
// back as { ts: <number>, incomePerSec: 0 } so old sessions just get zero
// offline gold once and are then upgraded on the next save.

export function saveSessionState(incomePerSec: number) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ts: Date.now(), incomePerSec }),
    )
  } catch {
    /* ignore */
  }
}

export function getOfflineSession(): {
  elapsedMs: number
  incomePerSec: number
} | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    let ts: number
    let incomePerSec = 0
    try {
      const parsed = JSON.parse(raw)
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.ts === 'number'
      ) {
        ts = parsed.ts
        if (typeof parsed.incomePerSec === 'number') {
          incomePerSec = parsed.incomePerSec
        }
      } else if (typeof parsed === 'number' && Number.isFinite(parsed)) {
        // JSON.parse of a plain numeric string — legacy format.
        ts = parsed
      } else {
        return null
      }
    } catch {
      // Not JSON — try legacy plain-number string format.
      const legacy = parseInt(raw, 10)
      if (!Number.isFinite(legacy)) return null
      ts = legacy
    }
    if (!Number.isFinite(ts)) return null
    return { elapsedMs: Math.max(0, Date.now() - ts), incomePerSec }
  } catch {
    return null
  }
}
