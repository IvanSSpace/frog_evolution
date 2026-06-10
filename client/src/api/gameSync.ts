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
import { loadActiveEvo, saveActiveEvo } from '../store/persistence'
import { ApiError } from './client'
import { devLog, devWarn } from '../utils/devLog'
import { eventBus } from '../store/eventBus'
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

// ─── cosmic sync contract ──────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH для полей, которые сериализуются в server `cosmic`-блоб.
//
// snapshotForSave() строит `cosmic` ИЗ ЭТОГО СПИСКА — забыть поле физически
// нельзя: новое поле добавляется в один массив и сразу попадает в save. Раньше
// snapshot был ручным object-literal'ом, и поля забывали → необратимая потеря
// сейва (2026-05-18 audit: ascendedCarriers/essence/perma* пропадали при
// cross-device login). Этот список делает save-сторону самодокументируемой.
//
// `satisfies (keyof StoreState)[]` даёт compile-time гарантию: опечатка или
// переименование/удаление поля в сторе → ошибка сборки, а не тихий потерянный
// сейв. preferences — единственное вложенное поле (отдельная обработка ниже).
//
// hydrate (loadGameState) по-прежнему валидирует те же ключи явно (read-сторона
// — следующий шаг рефакторинга к общему дескриптор-реестру + типизированные
// колонки вместо JSON-блоба, см. server/AUDIT.md §3A / §5).
type StoreState = ReturnType<typeof useGameStore.getState>
const COSMIC_SYNC_KEYS = [
  'serums',
  'boxes',
  'ship',
  'carriers',
  // Phase 22 Plan 22-03: ascension state (permanent pool + meta-currency).
  'ascendedCarriers',
  'essence',
  'mutagen1',
  'mutagen2',
  'mutagen3',
  // Phase 22 Plan 22-05: cosmic shop perma upgrades + cost-scaling counters.
  'permaSlotBonus',
  'permaShipSpeedBonus',
  'permaSerumDropBonus',
  'shopPurchaseCounts',
  'bestiaryBitset',
  'pityCounters',
  'lastActiveTab',
  'hasFirstFeed',
  'hasFirstMission',
  'hasOpenedAnyBox',
  'frogExclusiveUnlocked',
  'tutorialState',
  // Phase 24 Plan 24-01: captain birth milestone.
  'captainBirthSeen',
  // Toplevel-but-meta progress (cosmos gate + L18 merge bonuses).
  'hasCosmosUnlocked',
  'l18MergesCount',
  'l18AbsoluteBonusPerSec',
  // 2026-05-23: эволюция лягушек (per-level tier + cooldown timestamps) + temp buff.
  'frogTiers',
  'frogTierCooldowns',
  'temporaryIncomeBuff',
  // NB: essence/mutagen1-3 отправляются как top-level колонки (см. AUDIT §3A).
] as const satisfies readonly (keyof StoreState)[]

function snapshotForSave() {
  const s = useGameStore.getState()

  // Build cosmic-блоб из единого списка ключей (см. COSMIC_SYNC_KEYS).
  const cosmic: Record<string, unknown> = {}
  for (const k of COSMIC_SYNC_KEYS) cosmic[k] = s[k]
  // preferences — единственное вложенное/derived поле (язык и mute живут вне store).
  cosmic.preferences = {
    numberFormat: s.numberFormat,
    language: i18next.language || 'ru',
    sfxMuted: sfx.isMuted(),
  }

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
    // Валюты/прогресс — top-level колонки (см. AUDIT §3A).
    essence: Math.floor(Math.max(0, s.essence)),
    mutagen1: Math.floor(Math.max(0, s.mutagen1)),
    mutagen2: Math.floor(Math.max(0, s.mutagen2)),
    mutagen3: Math.floor(Math.max(0, s.mutagen3)),
    // Эволюция (Loc3) — bridge из localStorage контроллера в server-колонки
    // (cross-device). endsAt — клиентский 24ч таймер (см. AUDIT §4.2).
    ...((): {
      evoActive: boolean
      evoLevel: number | null
      evoEndsAt: string | null
    } => {
      const evo = loadActiveEvo()
      return {
        evoActive: !!evo,
        evoLevel: evo ? evo.level : null,
        evoEndsAt: evo ? new Date(evo.endsAt).toISOString() : null,
      }
    })(),
    cosmic,
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
        gooCollector: upg?.gooCollector ?? upg?.tractor ?? 0,
        magnet: upg?.magnet ?? 0,
        magnet2: upg?.magnet2 ?? 0,
        magnet3: upg?.magnet3 ?? 0,
        crateQuality: upg?.crateQuality ?? 0,
        rareBoxSpeed: upg?.rareBoxSpeed ?? 0,
        ships: upg?.ships ?? 0,
        autoCollect: upg?.autoCollect ?? 0,
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
      }
    }

    // ─── Валюты/прогресс — top-level колонки (см. AUDIT §3A) ───
    // Гидрируем essence/mutagen из top-level полей сервера (НЕ из cosmic-блоба).
    // Персистятся вместе с cosmic-slice — достаточно setState.
    {
      const update: Record<string, unknown> = {}
      const d = data as unknown as Record<string, unknown>
      for (const k of ['essence', 'mutagen1', 'mutagen2', 'mutagen3'] as const) {
        const v = d[k]
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          update[k] = Math.floor(v)
        }
      }
      if (Object.keys(update).length > 0) {
        useGameStore.setState(update as Partial<typeof store>)
      }
    }

    // Эволюция (Loc3) — server → localStorage контроллера (tryRestore читает на
    // boot). RESTORE-only: сервер может только восстановить активную эволюцию,
    // НЕ удалить локальную. Иначе первый GET после деплоя (server evoActive=false,
    // т.к. раньше не синкалось) стёр бы ещё-не-запушенную локальную эволюцию.
    // Локальную очистку по завершению таймера делает сам контроллер (complete()).
    {
      const d = data as unknown as Record<string, unknown>
      if (
        d.evoActive === true &&
        typeof d.evoLevel === 'number' &&
        (typeof d.evoEndsAt === 'string' || typeof d.evoEndsAt === 'number') &&
        !loadActiveEvo() // не перетираем локальную (она свежее/равна)
      ) {
        const endsAt = new Date(d.evoEndsAt as string).getTime()
        if (Number.isFinite(endsAt)) {
          saveActiveEvo({ level: d.evoLevel as number, endsAt })
        }
      }
    }

    // Server compute offline income (goo collector) — server-authoritative
    if (data.offlineIncome && typeof data.offlineMs === 'number') {
      const earned = Number(data.offlineIncome)
      if (earned > 0 && data.offlineMs > 0) {
        eventBus.emit('server:welcome-back', {
          earned,
          durationMs: data.offlineMs,
        })
      }
    }

    // Offline box fill: число боксов за AFK теперь считает СЕРВЕР (AUDIT §2) —
    // детерминированно, не манипулируемо клиентом. Клиент только выкладывает их
    // на поле (MainScene слушает 'boxes:offline-fill').
    {
      const count =
        typeof data.offlineBoxes === 'number' ? data.offlineBoxes : 0
      if (count > 0) eventBus.emit('boxes:offline-fill', { count })
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
  // Сериализуем PUT'ы: если сохранение уже в полёте — помечаем pending и выходим.
  // Иначе второй PUT уходит со старой version (первый ещё не вернул новую) →
  // сервер отвечает 409 → hard reload. Это и вызывало перезагрузку при частых
  // тапах по прокачке (каждый buy → set() → scheduleSave).
  if (inFlightSave) {
    pendingSave = true
    return false
  }
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
    // Если за время PUT накопились изменения — планируем следующий (throttled) save
    // с уже обновлённой lastKnownVersion.
    if (pendingSave && syncEnabled) scheduleSave()
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
