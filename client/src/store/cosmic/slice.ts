// Cosmic Frogs System — Zustand slice factory.
// Phase 11: каркас + actions stubs. Реальная логика наполняется в Phase 14-19.

import {
  type CosmicSlice, type CosmicTab, type Element, type Rarity,
  type BoxData, type ScoutData, type CarrierData,
  makeInitialCosmicSlice,
} from './types'
import { eventBus } from '../eventBus'
import {
  travelTimeMs, planetDistance, findPlanetById, getLocalDateString,
  DAILY_CAP, bonusRarityForResult, planetElementInputs,
  type MissionResult,
} from '../../game/data/missionConfig'
import { elementFromPlanet } from '../../game/effects/elements/elementMapping'
import { rollRarity, updatePity, type PityState } from '../../utils/rarityRoll'

// Actions — то, что наполняется в Phase 14-19. Здесь — placeholder stubs.
export interface CosmicSliceActions {
  // Serum actions (Phase 14)
  addSerum: (element: Element, rarity: Rarity, count?: number) => void
  removeSerum: (element: Element, rarity: Rarity, count?: number) => void

  // Phase 14: tap-to-select / drag selection mode (transient UI state).
  setSerumDragActive: (
    active: boolean,
    payload?: { element: Element; rarity: Rarity } | null,
  ) => void

  // Phase 14: atomic apply (decrement serum + addCarrier + clear selection)
  applySerum: (frogId: string, element: Element, rarity: Rarity, level: number) => void

  // Box actions (Phase 15)
  addBox: (params: {
    planetId: string
    planetName: string
    archetype: string
    element: Element
    bonusRarity?: 'rare' | 'epic' | 'legendary'
  }) => BoxData
  rollBoxRarity: (id: string) => { rarity: Rarity; element: Element } | null
  commitOpenedBox: (id: string, rarity: Rarity) => void
  removeBox: (id: string) => void

  // Scout actions (Phase 16)
  addScout: (scout: ScoutData) => void
  removeScout: (id: string) => void

  // Carrier actions (Phase 17)
  addCarrier: (carrier: CarrierData) => void
  removeCarrier: (frogId: string) => void

  // Tab persistence (COSMIC-HUB-07) — UI хранит в sessionStorage; здесь mirror в store.
  setLastActiveTab: (tab: CosmicTab) => void

  // Crew (Phase 16)
  consumeMissionCredit: () => boolean  // false если cap достигнут
  resetCrewIfNewDay: () => void

  // Phase 16: Ship navigation (REQ SHIP-01..06)
  ensureShipExists: () => void
  sendShipTo: (toPlanetId: string) => void
  arriveShipAt: (planetId: string) => void
  setShipPosition: (x: number, y: number) => void

  // Phase 16: Sentinel flags toggles (REQ UX-09; used by Phase 17/19 + dev panel)
  setHasFirstFeed: (v: boolean) => void
  setHasFirstMission: (v: boolean) => void
  setHasOpenedAnyBox: (v: boolean) => void

  // Phase 16-04: atomic investigate transaction
  // returns true если успешно, false если guard не прошёл
  investigatePlanet: (planetId: string, result: MissionResult) => boolean
}

export type CosmicState = CosmicSlice & CosmicSliceActions

// Минимальный set/get типизированный против CosmicState.
// gameStore оборачивает createCosmicSlice; spread выдаёт партиал, совместимый с GameState.
type SetFn = (partial: Partial<CosmicState>) => void
type GetFn = () => CosmicState

export function createCosmicSlice(set: SetFn, get: GetFn): CosmicState {
  const initial = makeInitialCosmicSlice()

  return {
    ...initial,

    addSerum: (element, rarity, count = 1) => {
      const s = get()
      const cur = s.serums[element][rarity]
      const next = Math.max(0, cur + count)
      const serums = {
        ...s.serums,
        [element]: { ...s.serums[element], [rarity]: next },
      }
      set({ serums })
    },

    removeSerum: (element, rarity, count = 1) => {
      const s = get()
      const cur = s.serums[element][rarity]
      const next = Math.max(0, cur - count)
      const serums = {
        ...s.serums,
        [element]: { ...s.serums[element], [rarity]: next },
      }
      set({ serums })
    },

    // Phase 14: tap-to-select / drag mode flag.
    // active=true → переключает MainScene в selection mode (halos + auto-pause magnet/merge).
    // active=false → clears selectedSerum независимо от второго аргумента.
    setSerumDragActive: (active, payload) => {
      if (active) {
        set({ serumDragActive: true, selectedSerum: payload ?? null })
      } else {
        set({ serumDragActive: false, selectedSerum: null })
      }
    },

    // Phase 14: atomic apply transaction.
    //  - guard: serum availability (>= 1) и frog не должен уже быть carrier
    //  - single set() для минимизации subscribe-flapping в FrogOverlayManager
    applySerum: (frogId, element, rarity, level) => {
      const s = get()

      // Guard: serum доступен?
      const cur = s.serums[element][rarity]
      if (cur < 1) return

      // Guard: idempotency — frog уже carrier?
      if (s.carriers.some((c) => c.frogId === frogId)) return

      const nextSerums = {
        ...s.serums,
        [element]: { ...s.serums[element], [rarity]: cur - 1 },
      }
      const nextCarrier: CarrierData = {
        frogId,
        element,
        rarity,
        feedCount: 0,
        stabilized: false,
        level,
      }
      set({
        serums: nextSerums,
        carriers: [...s.carriers, nextCarrier],
        serumDragActive: false,
        selectedSerum: null,
      })
    },

    // Phase 15 (REQ BOX-01/02): create box с auto-generated id, push в inventory.
    addBox: (params) => {
      const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `box-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
      const box: BoxData = {
        id,
        planetId: params.planetId,
        planetName: params.planetName,
        archetype: params.archetype,
        element: params.element,
        opened: false,
        createdAt: Date.now(),
        bonusRarity: params.bonusRarity,
      }
      const s = get()
      set({ boxes: [...s.boxes, box] })
      return box
    },

    // Phase 15: pure read — RNG roll БЕЗ commit. CascadeRevealModal вызывает на mount,
    // SerumSlotMachine использует rolled rarity для duration. commitOpenedBox финализирует.
    rollBoxRarity: (id) => {
      const s = get()
      const box = s.boxes.find((b) => b.id === id)
      if (!box || box.opened) return null
      const pity: PityState = {
        rare: s.pityCounters.rare,
        epic: s.pityCounters.epic,
        legendary: s.pityCounters.legendary,
      }
      const rarity = rollRarity(pity, box.bonusRarity)
      return { rarity, element: box.element }
    },

    // Phase 15: atomic commit — addSerum + remove box + updatePity в одном set().
    commitOpenedBox: (id, rarity) => {
      const s = get()
      const box = s.boxes.find((b) => b.id === id)
      if (!box) return
      const cur = s.serums[box.element][rarity]
      const nextSerums = {
        ...s.serums,
        [box.element]: { ...s.serums[box.element], [rarity]: cur + 1 },
      }
      const nextBoxes = s.boxes.filter((b) => b.id !== id)
      const nextPity = updatePity(
        { rare: s.pityCounters.rare, epic: s.pityCounters.epic, legendary: s.pityCounters.legendary },
        rarity,
      )
      set({
        serums: nextSerums,
        boxes: nextBoxes,
        pityCounters: {
          common: s.pityCounters.common,  // unchanged placeholder
          rare: nextPity.rare,
          epic: nextPity.epic,
          legendary: nextPity.legendary,
        },
        // Phase 16 sentinel: первое opened box → unlock Bestiary visual elements (REQ UX-09).
        hasOpenedAnyBox: true,
      })
    },

    // Phase 15: removeBox для cleanup tests + bulk-open edge cases.
    removeBox: (id) => {
      const s = get()
      set({ boxes: s.boxes.filter((b) => b.id !== id) })
    },

    addScout: (scout) => {
      const s = get()
      set({ scouts: [...s.scouts, scout] })
    },

    removeScout: (id) => {
      const s = get()
      set({ scouts: s.scouts.filter((sc) => sc.id !== id) })
    },

    addCarrier: (carrier) => {
      const s = get()
      set({ carriers: [...s.carriers, carrier] })
    },

    removeCarrier: (frogId) => {
      const s = get()
      set({ carriers: s.carriers.filter((c) => c.frogId !== frogId) })
    },

    setLastActiveTab: (tab) => {
      set({ lastActiveTab: tab })
    },

    // Phase 16: использует DAILY_CAP константу из missionConfig.ts (было hardcoded 4).
    // Pity counter (CREW-08) растёт ТОЛЬКО при consume — не при flight.
    consumeMissionCredit: () => {
      const state = get()
      if (state.crew.missionsToday >= DAILY_CAP) return false
      set({ crew: { ...state.crew, missionsToday: state.crew.missionsToday + 1 } })
      return true
    },

    // Phase 16 fix CREW-03: ЛОКАЛЬНАЯ дата вместо UTC.
    resetCrewIfNewDay: () => {
      const today = getLocalDateString()
      const state = get()
      if (state.crew.lastResetDay !== today) {
        set({ crew: { missionsToday: 0, lastResetDay: today } })
      }
    },

    // Phase 16: Ship navigation actions
    ensureShipExists: () => {
      const s = get()
      if (s.ship !== null) return
      set({ ship: { state: 'docked', planetId: 'home' } })
    },

    sendShipTo: (toPlanetId) => {
      const s = get()
      const target = findPlanetById(toPlanetId)
      if (!target) {
        // unknown planet — ignore (corrupt state guard, T-16-02)
        return
      }
      // Если ship === null — pre-init
      if (s.ship === null) {
        set({ ship: { state: 'docked', planetId: 'home' } })
      }
      const ship = get().ship!  // non-null после ensure

      // No-op: уже docked у этой planet (UI должен предотвратить — но slice idempotent)
      if (ship.state === 'docked' && ship.planetId === toPlanetId) return

      let fromPos: { x: number; y: number }
      let fromPlanetIdForUi: string

      if (ship.state === 'docked') {
        const fromPlanet = findPlanetById(ship.planetId)
        if (!fromPlanet) return  // corrupt — bail
        fromPos = { x: fromPlanet.x, y: fromPlanet.y }
        fromPlanetIdForUi = ship.planetId
      } else {
        // REDIRECT: используем cached latestShipPos если есть, иначе fromPlanetId
        const latest = get().latestShipPos
        if (latest) {
          fromPos = latest
        } else {
          const fp = findPlanetById(ship.fromPlanetId)
          if (!fp) return
          fromPos = { x: fp.x, y: fp.y }
        }
        fromPlanetIdForUi = ship.fromPlanetId  // сохраняем UI «откуда летели изначально»
      }

      const dist = planetDistance(fromPos, { x: target.x, y: target.y })
      const dur = travelTimeMs(dist)
      const now = Date.now()
      set({
        ship: {
          state: 'transit',
          fromPlanetId: fromPlanetIdForUi,
          toPlanetId,
          startedAt: now,
          arrivesAt: now + dur,
        },
      })
    },

    arriveShipAt: (planetId) => {
      const target = findPlanetById(planetId)
      if (!target) return  // защита от mismatch
      set({ ship: { state: 'docked', planetId } })
      // Notify subscribers (ShipTab, MissionOverlay enabler).
      eventBus.emit('cosmic:ship-arrived', { planetId })
    },

    setShipPosition: (x, y) => {
      set({ latestShipPos: { x, y } })
    },

    setHasFirstFeed: (v) => set({ hasFirstFeed: v }),
    setHasFirstMission: (v) => set({ hasFirstMission: v }),
    setHasOpenedAnyBox: (v) => set({ hasOpenedAnyBox: v }),

    // Phase 16-04: atomic investigate transaction (REQ MISSION-05/06/07, CREW-04/08).
    // - guard: ship.state !== 'docked' OR ship.planetId !== planetId → no-op (false)
    // - guard: missionsToday >= DAILY_CAP → no-op (false)
    // - atomic: missionsToday++, addBox с element=elementFromPlanet, bonusRarity, hasFirstMission=true
    // - emit 'cosmic:toast' с открытием Боксы
    investigatePlanet: (planetId, result) => {
      const s = get()
      // Guard 1: ship docked at this planet?
      if (!s.ship || s.ship.state !== 'docked' || s.ship.planetId !== planetId) {
        return false
      }
      // Guard 2: cap reached? (CREW-04 — pity растёт ТОЛЬКО при consume)
      if (s.crew.missionsToday >= DAILY_CAP) {
        return false
      }
      const planet = findPlanetById(planetId)
      if (!planet) return false

      // Resolve element (MISSION-06)
      const { archetype, mainRaceType } = planetElementInputs(planet)
      const element = elementFromPlanet(archetype, mainRaceType) ?? 'fire'  // fallback

      // Phase 15 update: bonusRarity now enum 'rare'|'epic'|'legendary'|undefined
      // (was number 0..0.15). Map: perfect → 'epic', good → 'rare', fail → undefined.
      const bonusNum = bonusRarityForResult(result)
      let bonusRarityEnum: 'rare' | 'epic' | 'legendary' | undefined
      if (bonusNum >= 0.15) bonusRarityEnum = 'epic'
      else if (bonusNum >= 0.05) bonusRarityEnum = 'rare'
      else bonusRarityEnum = undefined

      // Atomic transaction: один set()
      const newBoxId = `box_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
      const archetypeKey = archetype ?? mainRaceType ?? ''
      set({
        crew: { ...s.crew, missionsToday: s.crew.missionsToday + 1 },
        boxes: [
          ...s.boxes,
          {
            id: newBoxId,
            planetId,
            planetName: planet.name,
            archetype: archetypeKey,
            element,
            opened: false,
            createdAt: Date.now(),
            bonusRarity: bonusRarityEnum,
          },
        ],
        hasFirstMission: true,  // unlock Боксы tab (REQ UX-09)
      })

      // Side-effect: toast (вне set, в том же tick).
      // hardcoded RU «Получен ящик» — Phase 19 polish может перенести в App-side i18n.
      eventBus.emit('cosmic:toast', {
        type: 'box-received',
        msg: `Получен ящик ${planet.name}`,
        action: {
          label: 'Открыть',
          onClick: () => {
            // Open Боксы tab (Phase 16-05 + Phase 15 wiring).
            get().setLastActiveTab('boxes')
          },
        },
      })

      return true
    },
  }
}
