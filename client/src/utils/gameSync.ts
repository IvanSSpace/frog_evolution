// Синхронизация состояния игры с сервером.
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
import { api } from './api'

interface ServerGameState {
  gold: string // BigInt → string
  upgrades: {
    dropSpeed: number
    tractor: number
    magnet: number
    crateQuality: number
    rareBoxSpeed?: number
  }
  frogPurchases: number[]
  discoveredLevels: number[]
  magnetEnabled: boolean
  currentLocation: number
  locationFrogs: number[][]
  lastSessionAt: string // ISO date
}

const SAVE_THROTTLE_MS = 5000 // максимум один PUT раз в 5 секунд при идле
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave = false
let syncEnabled = false
let unsubscribeStore: (() => void) | null = null

function snapshotForSave() {
  const s = useGameStore.getState()
  return {
    gold: Math.floor(s.gold).toString(),
    upgrades: s.upgrades,
    frogPurchases: s.frogPurchases,
    discoveredLevels: s.discoveredLevels,
    magnetEnabled: s.magnetEnabled,
    currentLocation: s.currentLocation,
    locationFrogs: s.locationFrogs,
  }
}

export async function loadGameState(): Promise<boolean> {
  try {
    const { data } = await api.get<ServerGameState>('/game/state')
    const store = useGameStore.getState()

    // Мержим — приоритет сервера, но с защитой от undefined.
    // gold приходит строкой (BigInt) → парсим как Number (fits до 2^53).
    const goldNum = Number(data.gold) || 0
    useGameStore.setState({
      gold: goldNum,
      upgrades: {
        dropSpeed: data.upgrades?.dropSpeed ?? 0,
        tractor: data.upgrades?.tractor ?? 0,
        magnet: data.upgrades?.magnet ?? 0,
        crateQuality: data.upgrades?.crateQuality ?? 0,
        rareBoxSpeed: data.upgrades?.rareBoxSpeed ?? 0,
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
    })
    console.log('[gameSync] loaded state from server')
    return true
  } catch (err) {
    console.warn(
      '[gameSync] failed to load state — продолжаем с локальным',
      err,
    )
    return false
  }
}

export async function saveGameState(force = false): Promise<boolean> {
  if (!syncEnabled && !force) return false
  try {
    const payload = snapshotForSave()
    await api.put('/game/state', payload)
    pendingSave = false
    return true
  } catch (err) {
    console.warn('[gameSync] failed to save state', err)
    return false
  }
}

function scheduleSave() {
  pendingSave = true
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (pendingSave) saveGameState()
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
    if (pendingSave) saveGameState(true)
  })

  // Сохранить при сворачивании таба
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && pendingSave) saveGameState(true)
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
