// Синхронизация состояния игры с сервером — fetch-based (replaces utils/gameSync).
// Цикл:
// 1. На старте — после auth — `loadGameState` тянет состояние с сервера и
//    применяет его к Zustand-стору (мерж с локальными дефолтами).
// 2. Подписываемся на стор — любое изменение запускает throttled `saveGameState`.
//    Throttle нужен чтобы не дёргать /game/state каждый кадр (фоновый доход
//    обновляет gold постоянно).
// 3. На beforeunload и visibilitychange делаем финальный flush — без throttle.
//
// На время отсутствия токена (dev-режим в браузере без бэкенда) gameSync
// делает запросы к локальному dev-серверу, который автоматически использует
// dev-юзера. Если /game/state недоступен — синк просто молча выключается.

import { useGameStore } from '../store/gameStore'
import { useOnboardingStore } from '../store/onboarding/onboardingSlice'
import { getServerGameState, putServerGameState } from './gameState'
import { ApiError } from './client'
import { devLog, devWarn } from '../utils/devLog'
import { eventBus } from '../store/eventBus'
import {
  getInstantBoxes,
  setInstantBoxes,
  getCalmFarmMode,
  setCalmFarmMode,
  getReducedEffects,
  setReducedEffects,
} from '../utils/cosmicSettings'
import { sfx } from '../audio/sfx'
import i18next from 'i18next'
import { setLang, type Lang } from '../i18n/index'
import type { NumberFormat } from '../utils/formatting'

// On 409 (version mismatch — usually admin reset) we cannot trust local state
// or localStorage; persist may have stale values that pre-date the reset.
// Wipe known game-related keys (preserving JWT) and force a clean boot —
// server is authoritative.
const GAME_STATE_KEY_PREFIX = 'frog_evolution_'
const JWT_KEY = 'frog_evolution_jwt'

// UX-local keys которые НЕ wipe'аются при server-version mismatch / admin reset.
// Это per-device состояние UI (onboarding marks, badge seen-trackers) — не должно
// сбрасываться когда server state regresses. Иначе юзер видит онбординг повторно.
const PRESERVE_KEYS = new Set<string>([
  JWT_KEY,
  'frog_evolution_onboarding',
  'frog_evolution_frogshop_seen_v1',
  'frog_evolution_bestiary_seen_v1',
])

function hardResetClient(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(GAME_STATE_KEY_PREFIX) && !PRESERVE_KEYS.has(k)) {
        keys.push(k)
      }
    }
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    // localStorage may be unavailable — proceed to reload anyway
  }
}

const SAVE_THROTTLE_MS = 5000 // максимум один PUT раз в 5 секунд при идле
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave = false
let inFlightSave = false
let syncEnabled = false
let unsubscribeStore: (() => void) | null = null
let lastKnownVersion: number | null = null

export function getLastKnownVersion(): number | null {
  return lastKnownVersion
}

function snapshotForSave() {
  const s = useGameStore.getState()
  return {
    gold: Math.floor(s.gold).toString(),
    // Upgrades — struct тип, но при сериализации идентичен Record<string,number>,
    // которое ожидает ServerGameState. Cast безопасен — JSON shape совпадает.
    upgrades: s.upgrades as unknown as Record<string, number>,
    frogPurchases: s.frogPurchases,
    discoveredLevels: s.discoveredLevels,
    magnetEnabled: s.magnetEnabled,
    currentLocation: s.currentLocation,
    locationFrogs: s.locationFrogs,
    boxOpenCount: s.boxOpenCount,
    incomePerSec: s.incomePerSec,
    cosmic: {
      serums: s.serums,
      boxes: s.boxes,
      ship: s.ship,
      carriers: s.carriers,
      // Phase 22 Plan 22-03: ascension state — permanent pool + meta-currency.
      // 2026-05-18 audit fix: WAS missing from snapshotForSave → cross-device
      // login lost all ascended carriers + essence (irreversible save loss).
      ascendedCarriers: s.ascendedCarriers,
      essence: s.essence,
      // Phase 22 Plan 22-05: cosmic shop perma upgrades + per-item purchase
      // history (used for cost scaling).
      // 2026-05-18 audit fix: WAS missing from snapshotForSave → cross-device
      // login lost all shop progress (slot bonuses, ship speed, serum drop %)
      // AND reset cost-scaling counters to 0 (next purchase priced at base —
      // exploit + economy break).
      permaSlotBonus: s.permaSlotBonus,
      permaShipSpeedBonus: s.permaShipSpeedBonus,
      permaSerumDropBonus: s.permaSerumDropBonus,
      shopPurchaseCounts: s.shopPurchaseCounts,
      bestiaryBitset: s.bestiaryBitset,
      pityCounters: s.pityCounters,
      lastActiveTab: s.lastActiveTab,
      crew: s.crew,
      hasFirstFeed: s.hasFirstFeed,
      hasFirstMission: s.hasFirstMission,
      hasOpenedAnyBox: s.hasOpenedAnyBox,
      frogExclusiveUnlocked: s.frogExclusiveUnlocked,
      tutorialState: s.tutorialState,
      // Phase 24 Plan 24-01: cross-device sync captain birth milestone.
      captainBirthSeen: s.captainBirthSeen,
      // Phase 26 Plan 26-01: cross-device sync per-race first contact tracker.
      firstContactsSeen: s.firstContactsSeen,
      // Phase 27 Plan 27-01: cross-device sync relationship + chain + pending state.
      raceRelationships: s.raceRelationships,
      chainProgress: s.chainProgress,
      pendingItems: s.pendingItems,
      // Phase 28 Plan 28-01: cross-device sync quest state (active + completed history).
      activeQuests: s.activeQuests,
      completedQuests: s.completedQuests,
      // 2026-05-18 audit fix: toplevel-but-meta state served через cosmic blob
      // (consistent pattern с captainBirthSeen — server schema accepts opaque
      // cosmic JSON, no schema change). All three — per-user permanent progress:
      //   - hasCosmosUnlocked: gate flag (Phase 22 Plan 22-06).
      //   - l18MergesCount: L18+L18 merge bonus multiplier counter.
      //   - l18AbsoluteBonusPerSec: absolute permanent income bonus (2× L18 income).
      // Без sync — cross-device login обнуляет multiplier + absolute bonus и
      // ломает cosmos gate (повторный cinematic).
      hasCosmosUnlocked: s.hasCosmosUnlocked,
      l18MergesCount: s.l18MergesCount,
      l18AbsoluteBonusPerSec: s.l18AbsoluteBonusPerSec,
      // 2026-05-23: эволюция лягушек (per-level tier + cooldown timestamps).
      // Permanent progress — должен переноситься между девайсами.
      frogTiers: s.frogTiers,
      frogTierCooldowns: s.frogTierCooldowns,
      // 2026-05-23: временный 6h buff к доходу после L18+L18 merge.
      // Persist чтобы не сбрасывался при cross-device login.
      temporaryIncomeBuff: s.temporaryIncomeBuff,
      // Phase 22: user preferences (cross-device sync).
      preferences: {
        numberFormat: s.numberFormat,
        language: i18next.language || 'ru',
        sfxMuted: sfx.isMuted(),
        instantBoxes: getInstantBoxes(),
        calmFarmMode: getCalmFarmMode(),
        reducedEffects: getReducedEffects(),
      },
    },
    // Onboarding state — per-user, cross-device. Sync через server так чтобы
    // beats не повторялись при cache wipe в TG WebView.
    onboarding: useOnboardingStore.getState() as unknown as Record<
      string,
      unknown
    >,
    version: lastKnownVersion ?? 0,
  }
}

export async function loadGameState(): Promise<boolean> {
  try {
    const data = await getServerGameState()
    lastKnownVersion = typeof data.version === 'number' ? data.version : 0
    const store = useGameStore.getState()

    // Мержим — приоритет сервера, но с защитой от undefined.
    // gold приходит строкой (BigInt) → парсим как Number (fits до 2^53).
    const goldNum = Number(data.gold) || 0
    const upg = data.upgrades as Record<string, number>
    useGameStore.setState({
      gold: goldNum,
      upgrades: {
        dropSpeed: upg?.dropSpeed ?? 0,
        tractor: upg?.tractor ?? 0,
        magnet: upg?.magnet ?? 0,
        magnet2: upg?.magnet2 ?? 0,
        magnet3: upg?.magnet3 ?? 0,
        crateQuality: upg?.crateQuality ?? 0,
        rareBoxSpeed: upg?.rareBoxSpeed ?? 0,
        ships: upg?.ships ?? 0,
      },
      frogPurchases: Array.isArray(data.frogPurchases)
        ? data.frogPurchases
        : store.frogPurchases,
      discoveredLevels: Array.isArray(data.discoveredLevels)
        ? data.discoveredLevels
        : store.discoveredLevels,
      magnetEnabled: data.magnetEnabled ?? true,
      currentLocation: data.currentLocation ?? 1,
      locationFrogs:
        Array.isArray(data.locationFrogs) && data.locationFrogs.length === 3
          ? data.locationFrogs
          : store.locationFrogs,
      boxOpenCount:
        typeof data.boxOpenCount === 'number'
          ? data.boxOpenCount
          : store.boxOpenCount,
    })
    // Hydrate onboarding from server (merge — ANY true wins).
    const d = data as unknown as Record<string, unknown>
    if (d.onboarding && typeof d.onboarding === 'object') {
      ;(
        useOnboardingStore.getState() as unknown as {
          hydrateFromServer: (incoming: Record<string, unknown>) => void
        }
      ).hydrateFromServer(d.onboarding as Record<string, unknown>)
    }
    // Hydrate cosmic state if server returned it
    if (data.cosmic && typeof data.cosmic === 'object') {
      const c = data.cosmic as Record<string, unknown>
      const cosmicUpdate: Record<string, unknown> = {}
      if ('serums' in c) cosmicUpdate.serums = c.serums
      if ('boxes' in c) cosmicUpdate.boxes = c.boxes
      if ('ship' in c) cosmicUpdate.ship = c.ship
      if ('carriers' in c) cosmicUpdate.carriers = c.carriers
      // Phase 22 Plan 22-03: hydrate ascension state from server (defensive
      // validation runs в loadCosmicSlice на following persist cycle; здесь
      // trust blob shape для immediate hydrate).
      if ('ascendedCarriers' in c)
        cosmicUpdate.ascendedCarriers = c.ascendedCarriers
      if ('essence' in c) cosmicUpdate.essence = c.essence
      // Phase 22 Plan 22-05: hydrate shop perma upgrades + purchase counters.
      if ('permaSlotBonus' in c) cosmicUpdate.permaSlotBonus = c.permaSlotBonus
      if ('permaShipSpeedBonus' in c)
        cosmicUpdate.permaShipSpeedBonus = c.permaShipSpeedBonus
      if ('permaSerumDropBonus' in c)
        cosmicUpdate.permaSerumDropBonus = c.permaSerumDropBonus
      if ('shopPurchaseCounts' in c)
        cosmicUpdate.shopPurchaseCounts = c.shopPurchaseCounts
      if ('bestiaryBitset' in c) cosmicUpdate.bestiaryBitset = c.bestiaryBitset
      if ('pityCounters' in c) cosmicUpdate.pityCounters = c.pityCounters
      if ('lastActiveTab' in c) cosmicUpdate.lastActiveTab = c.lastActiveTab
      if ('crew' in c) cosmicUpdate.crew = c.crew
      if ('hasFirstFeed' in c) cosmicUpdate.hasFirstFeed = c.hasFirstFeed
      if ('hasFirstMission' in c)
        cosmicUpdate.hasFirstMission = c.hasFirstMission
      if ('hasOpenedAnyBox' in c)
        cosmicUpdate.hasOpenedAnyBox = c.hasOpenedAnyBox
      if ('frogExclusiveUnlocked' in c)
        cosmicUpdate.frogExclusiveUnlocked = c.frogExclusiveUnlocked
      if ('tutorialState' in c) cosmicUpdate.tutorialState = c.tutorialState
      // 2026-05-18 audit fix: toplevel-but-server-synced fields. Same hydrate
      // pattern as captainBirthSeen but applied to top-level state (вместо
      // cosmic slice). Server blob keeps them under cosmic.* для opaque schema.
      // Defensive — accept only correct primitive type.
      if ('hasCosmosUnlocked' in c && c.hasCosmosUnlocked === true)
        cosmicUpdate.hasCosmosUnlocked = true
      if ('l18MergesCount' in c && typeof c.l18MergesCount === 'number')
        cosmicUpdate.l18MergesCount = Math.max(
          0,
          Math.floor(c.l18MergesCount as number),
        )
      if (
        'l18AbsoluteBonusPerSec' in c &&
        typeof c.l18AbsoluteBonusPerSec === 'number' &&
        Number.isFinite(c.l18AbsoluteBonusPerSec as number)
      )
        cosmicUpdate.l18AbsoluteBonusPerSec = Math.max(
          0,
          c.l18AbsoluteBonusPerSec as number,
        )
      // Phase 24 Plan 24-01: hydrate captain-birth flag from server.
      if ('captainBirthSeen' in c)
        cosmicUpdate.captainBirthSeen = c.captainBirthSeen
      // Phase 26 Plan 26-01: hydrate per-race first contact tracker from server.
      // Same defensive pattern как в loadCosmicSlice — `firstContactsSeen` blob
      // прокладывается через `set` напрямую; defensive filtering сделан на load
      // (loadCosmicSlice валидирует known raceIds; server-side validation
      // не блокирует unknown extra raceIds — forward-compat).
      if ('firstContactsSeen' in c)
        cosmicUpdate.firstContactsSeen = c.firstContactsSeen
      // Phase 27 Plan 27-01: hydrate from server. Defensive filtering already runs
      // в loadCosmicSlice на следующем persistence read; server snapshot trusts
      // cosmic blob shape для immediate hydrate (unknown raceIds get cleaned out
      // на next save→load cycle через loadCosmicSlice clamp/strip logic).
      if ('raceRelationships' in c)
        cosmicUpdate.raceRelationships = c.raceRelationships
      if ('chainProgress' in c) cosmicUpdate.chainProgress = c.chainProgress
      if ('pendingItems' in c) cosmicUpdate.pendingItems = c.pendingItems
      // Phase 28 Plan 28-01: hydrate quest state from server. Defensive validation
      // runs в loadCosmicSlice на following persist cycle (clamp/strip/cap).
      if ('activeQuests' in c) cosmicUpdate.activeQuests = c.activeQuests
      if ('completedQuests' in c)
        cosmicUpdate.completedQuests = c.completedQuests
      // 2026-05-23: эволюция лягушек — tier (per-level 0/1/2) + cooldowns (timestamps).
      if ('frogTiers' in c && Array.isArray(c.frogTiers)) {
        cosmicUpdate.frogTiers = c.frogTiers
      }
      if ('frogTierCooldowns' in c && Array.isArray(c.frogTierCooldowns)) {
        cosmicUpdate.frogTierCooldowns = c.frogTierCooldowns
      }
      // 2026-05-23: hydrate temporaryIncomeBuff (shape: {until, percent} | null).
      if ('temporaryIncomeBuff' in c) {
        const tb = c.temporaryIncomeBuff as unknown
        if (tb && typeof tb === 'object') {
          const rec = tb as Record<string, unknown>
          const until = rec.until
          const percent = rec.percent
          if (
            typeof until === 'number' &&
            typeof percent === 'number' &&
            percent > 0 &&
            until > Date.now()
          ) {
            cosmicUpdate.temporaryIncomeBuff = { until, percent }
          } else {
            cosmicUpdate.temporaryIncomeBuff = null
          }
        } else {
          cosmicUpdate.temporaryIncomeBuff = null
        }
      }
      if (Object.keys(cosmicUpdate).length > 0) {
        useGameStore.setState(cosmicUpdate as Partial<typeof store>)
      }

      // Phase 24 Plan 24-01: если server принёс captainBirthSeen=true,
      // синхронизируй localStorage чтобы next boot не показал cinematic до
      // server response. Dynamic import — gameSync уже async, persistence
      // подтянут через другие пути; dynamic безопасен и избегает потенциального
      // circular концерна.
      // 2026-05-18 audit: extended same pattern для hasCosmosUnlocked +
      // l18MergesCount + l18AbsoluteBonusPerSec — каждый имеет свой localStorage
      // key (см. persistence.ts), который читается при offline boot ДО server
      // response. Без post-hydrate write — boot между sync'ами на новом
      // устройстве рисует cosmos-locked UI / нулевой multiplier пока не
      // приехал /game/state.
      const needsPersistenceWrite =
        cosmicUpdate.captainBirthSeen === true ||
        cosmicUpdate.hasCosmosUnlocked === true ||
        typeof cosmicUpdate.l18MergesCount === 'number' ||
        typeof cosmicUpdate.l18AbsoluteBonusPerSec === 'number' ||
        Array.isArray(cosmicUpdate.frogTiers) ||
        Array.isArray(cosmicUpdate.frogTierCooldowns) ||
        'temporaryIncomeBuff' in cosmicUpdate
      if (needsPersistenceWrite) {
        const persistence = await import('../store/persistence')
        if (cosmicUpdate.captainBirthSeen === true) {
          persistence.saveCaptainBirthSeen(true)
        }
        if (cosmicUpdate.hasCosmosUnlocked === true) {
          persistence.saveCosmosUnlocked(true)
        }
        if (typeof cosmicUpdate.l18MergesCount === 'number') {
          persistence.saveL18MergesCount(cosmicUpdate.l18MergesCount as number)
        }
        if (typeof cosmicUpdate.l18AbsoluteBonusPerSec === 'number') {
          persistence.saveL18AbsoluteBonusPerSec(
            cosmicUpdate.l18AbsoluteBonusPerSec as number,
          )
        }
        if (Array.isArray(cosmicUpdate.frogTiers)) {
          persistence.saveFrogTiers(cosmicUpdate.frogTiers as number[])
        }
        if (Array.isArray(cosmicUpdate.frogTierCooldowns)) {
          persistence.saveFrogTierCooldowns(
            cosmicUpdate.frogTierCooldowns as number[],
          )
        }
        if ('temporaryIncomeBuff' in cosmicUpdate) {
          persistence.saveTemporaryIncomeBuff(
            cosmicUpdate.temporaryIncomeBuff as {
              until: number
              percent: number
            } | null,
          )
        }
      }

      // Phase 22: восстанавливаем user preferences с сервера через те же setters
      // что и UI пользует — они обновят localStorage + триггернут события.
      if (
        'preferences' in c &&
        c.preferences &&
        typeof c.preferences === 'object'
      ) {
        const p = c.preferences as Record<string, unknown>
        if (typeof p.numberFormat === 'string') {
          useGameStore
            .getState()
            .setNumberFormat(p.numberFormat as NumberFormat)
        }
        if (typeof p.language === 'string' && p.language !== i18next.language) {
          setLang(p.language as Lang)
        }
        if (typeof p.sfxMuted === 'boolean' && p.sfxMuted !== sfx.isMuted()) {
          sfx.setMuted(p.sfxMuted)
        }
        if (
          typeof p.instantBoxes === 'boolean' &&
          p.instantBoxes !== getInstantBoxes()
        ) {
          setInstantBoxes(p.instantBoxes)
        }
        if (
          typeof p.calmFarmMode === 'boolean' &&
          p.calmFarmMode !== getCalmFarmMode()
        ) {
          setCalmFarmMode(p.calmFarmMode)
        }
        if (
          typeof p.reducedEffects === 'boolean' &&
          p.reducedEffects !== getReducedEffects()
        ) {
          setReducedEffects(p.reducedEffects)
        }
      }
    }

    // Server compute offline income (tractor) — server-authoritative
    if (data.offlineIncome && typeof data.offlineMs === 'number') {
      const earned = Number(data.offlineIncome)
      if (earned > 0 && data.offlineMs > 0) {
        eventBus.emit('server:welcome-back', {
          earned,
          durationMs: data.offlineMs,
        })
      }
    }

    // Offline box drops — server возвращает raw elapsedMs.
    // Эмитим event как сигнал «юзер вернулся, заполни поле боксами».
    // MainScene.drainOfflineBoxBuffer fillит поле до cap (effectiveSlotCap),
    // count теперь служит только маркером «buffer > 0», точное значение не важно.
    // Threshold 60s: quick reload / first login не триггерит fill (юзер пришёл
    // в чистое поле, а не в забитое боксами после реального offline period).
    const OFFLINE_FILL_THRESHOLD_MS = 60_000
    if (
      typeof data.elapsedMs === 'number' &&
      data.elapsedMs > OFFLINE_FILL_THRESHOLD_MS
    ) {
      eventBus.emit('box:offline-pending', { count: 1 })
    }

    devLog('[gameSync] loaded state from server')
    return true
  } catch (err) {
    devWarn('[gameSync] failed to load state — продолжаем с локальным', err)
    return false
  }
}

export async function saveGameState(force = false): Promise<boolean> {
  if (!syncEnabled && !force) return false
  inFlightSave = true
  try {
    const payload = snapshotForSave()
    const result = await putServerGameState(payload)
    // Server has incremented version — capture it for next save.
    if (typeof result.version === 'number') {
      lastKnownVersion = result.version
    }
    pendingSave = false
    return true
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      devWarn(
        '[gameSync] PUT rejected with 409 (version mismatch) — hard-reloading client',
      )
      // Stop all further saves before reload to avoid a last-gasp PUT racing the
      // unload.
      syncEnabled = false
      pendingSave = false
      hardResetClient()
      // Defer reload one tick so devWarn flushes and any in-flight async cleanup
      // resolves.
      setTimeout(() => {
        window.location.reload()
      }, 0)
      return false
    }
    devWarn('[gameSync] failed to save state', err)
    return false
  } finally {
    inFlightSave = false
  }
}

function scheduleSave() {
  pendingSave = true
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (pendingSave) void saveGameState()
  }, SAVE_THROTTLE_MS)
}

// Heartbeat — каждые 15s проверяет server version. Если server bumped (admin reset
// или другой device merge'нул) → hard reset + reload. Решает кейс admin Reset
// когда player сидит idle и не делает mutations → PUT не fires → 409 не triggered.
const HEARTBEAT_INTERVAL_MS = 15000
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

async function heartbeatCheck(): Promise<void> {
  if (!syncEnabled) return
  if (lastKnownVersion === null) return
  // Skip if local save activity could mutate lastKnownVersion at any moment:
  //   - inFlightSave: PUT in transit, response will update lastKnownVersion
  //   - pendingSave / saveTimer: throttle timer about to fire a PUT
  // Without this guard heartbeat races the PUT/response cycle and reloads
  // on a server-bumped version that our own client just produced.
  if (inFlightSave || pendingSave || saveTimer !== null) return
  try {
    const data = await getServerGameState()
    const serverVersion = typeof data.version === 'number' ? data.version : 0
    // ANY mismatch triggers reload — covers admin reset (version+1), multi-device
    // PUT (version+1), AND DELETE+recreate (version regress к 0).
    if (serverVersion !== lastKnownVersion) {
      devWarn(
        `[gameSync] heartbeat detected version mismatch (local=${lastKnownVersion}, server=${serverVersion}) — hard-reloading client`,
      )
      syncEnabled = false
      pendingSave = false
      hardResetClient()
      setTimeout(() => window.location.reload(), 0)
    }
  } catch {
    // network error — silent skip; next tick retries
  }
}

export function startSync() {
  if (syncEnabled) return
  syncEnabled = true

  // Подписываемся на стор — любое изменение → schedule save
  unsubscribeStore = useGameStore.subscribe(() => {
    if (syncEnabled) scheduleSave()
  })

  // Подписываемся на onboarding store — каждый markX trigger schedules save.
  // Отдельная подписка т.к. onboarding — изолированный store от gameStore.
  const unsubOnboarding = useOnboardingStore.subscribe(() => {
    if (syncEnabled) scheduleSave()
  })
  // Cleanup в stopSync — chain через выполнение обоих unsubscribers.
  const prevUnsub = unsubscribeStore
  unsubscribeStore = () => {
    prevUnsub?.()
    unsubOnboarding()
  }

  // Финальный сейв при уходе со страницы
  window.addEventListener('beforeunload', () => {
    if (pendingSave) void saveGameState(true)
  })

  // Сохранить при сворачивании таба
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && pendingSave) void saveGameState(true)
  })

  // Periodic heartbeat — detects server-side reset (admin) for idle clients.
  heartbeatTimer = setInterval(() => {
    void heartbeatCheck()
  }, HEARTBEAT_INTERVAL_MS)
}

export function stopSync() {
  syncEnabled = false
  if (unsubscribeStore) {
    unsubscribeStore()
    unsubscribeStore = null
  }
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  lastKnownVersion = null
}
