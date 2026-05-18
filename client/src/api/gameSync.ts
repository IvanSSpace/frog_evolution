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
import { getServerGameState, putServerGameState } from './gameState'
import { devLog, devWarn } from '../utils/devLog'
import { eventBus } from '../store/eventBus'
import { getDropIntervalMs } from '../game/config/upgrades'
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

const SAVE_THROTTLE_MS = 5000 // максимум один PUT раз в 5 секунд при идле
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave = false
let syncEnabled = false
let unsubscribeStore: (() => void) | null = null

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
  }
}

export async function loadGameState(): Promise<boolean> {
  try {
    const data = await getServerGameState()
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
        crateQuality: upg?.crateQuality ?? 0,
        rareBoxSpeed: upg?.rareBoxSpeed ?? 0,
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
        Array.isArray(data.locationFrogs) && data.locationFrogs.length === 4
          ? data.locationFrogs
          : store.locationFrogs,
      boxOpenCount:
        typeof data.boxOpenCount === 'number'
          ? data.boxOpenCount
          : store.boxOpenCount,
    })
    // Hydrate cosmic state if server returned it
    if (data.cosmic && typeof data.cosmic === 'object') {
      const c = data.cosmic as Record<string, unknown>
      const cosmicUpdate: Record<string, unknown> = {}
      if ('serums' in c) cosmicUpdate.serums = c.serums
      if ('boxes' in c) cosmicUpdate.boxes = c.boxes
      if ('ship' in c) cosmicUpdate.ship = c.ship
      if ('carriers' in c) cosmicUpdate.carriers = c.carriers
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
      // Phase 24 Plan 24-01: hydrate captain-birth flag from server.
      if ('captainBirthSeen' in c) cosmicUpdate.captainBirthSeen = c.captainBirthSeen
      // Phase 26 Plan 26-01: hydrate per-race first contact tracker from server.
      // Same defensive pattern как в loadCosmicSlice — `firstContactsSeen` blob
      // прокладывается через `set` напрямую; defensive filtering сделан на load
      // (loadCosmicSlice валидирует known raceIds; server-side validation
      // не блокирует unknown extra raceIds — forward-compat).
      if ('firstContactsSeen' in c) cosmicUpdate.firstContactsSeen = c.firstContactsSeen
      if (Object.keys(cosmicUpdate).length > 0) {
        useGameStore.setState(cosmicUpdate as Partial<typeof store>)
      }

      // Phase 24 Plan 24-01: если server принёс captainBirthSeen=true,
      // синхронизируй localStorage чтобы next boot не показал cinematic до
      // server response. Dynamic import — gameSync уже async, persistence
      // подтянут через другие пути; dynamic безопасен и избегает потенциального
      // circular концерна.
      if (cosmicUpdate.captainBirthSeen === true) {
        const { saveCaptainBirthSeen } = await import('../store/persistence')
        saveCaptainBirthSeen(true)
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
    // Считаем сколько боксов «должно было» упасть, эмитим event для MainScene.
    if (typeof data.elapsedMs === 'number' && data.elapsedMs > 0) {
      const store = useGameStore.getState()
      const dropSpeedLvl = store.upgrades.dropSpeed ?? 0
      const dropIntervalMs = getDropIntervalMs(dropSpeedLvl)
      const droppedCount = Math.floor(data.elapsedMs / dropIntervalMs)
      if (droppedCount > 0) {
        eventBus.emit('box:offline-pending', { count: droppedCount })
      }
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
  try {
    const payload = snapshotForSave()
    await putServerGameState(payload)
    pendingSave = false
    return true
  } catch (err) {
    devWarn('[gameSync] failed to save state', err)
    return false
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

export function startSync() {
  if (syncEnabled) return
  syncEnabled = true

  // Подписываемся на стор — любое изменение → schedule save
  unsubscribeStore = useGameStore.subscribe(() => {
    if (syncEnabled) scheduleSave()
  })

  // Финальный сейв при уходе со страницы
  window.addEventListener('beforeunload', () => {
    if (pendingSave) void saveGameState(true)
  })

  // Сохранить при сворачивании таба
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && pendingSave) void saveGameState(true)
  })
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
}
