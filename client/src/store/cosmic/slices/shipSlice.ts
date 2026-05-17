// Cosmic Frogs — Ship & Mission sub-slice.
// Извлечено из cosmic/slice.ts при рефакторе разделения по доменам.
// Содержит: ship navigation + mission credit / reset + investigatePlanet (atomic mission tx).
// Public API не меняется: composed обратно в createCosmicSlice через spread.
// Phase 22: bonusRarity removed from box creation in investigatePlanet.

import type { CosmicSliceActions, GetFn, SetFn } from '../slice'
import { eventBus } from '../../eventBus'
import {
  travelTimeMs,
  planetDistance,
  findPlanetById,
  getLocalDateString,
  DAILY_CAP,
  planetElementInputs,
} from '../../../game/data/missionConfig'
import { elementFromPlanet } from '../../../game/effects/elements/elementMapping'
// Phase 22 Plan 22-05: ship speed perma upgrade from cosmic shop.
import { shipSpeedMultiplier } from '../../../game/utils/shopBonuses'

export type ShipActions = Pick<
  CosmicSliceActions,
  | 'ensureShipExists'
  | 'sendShipTo'
  | 'arriveShipAt'
  | 'setShipPosition'
  | 'investigatePlanet'
  | 'consumeMissionCredit'
  | 'resetCrewIfNewDay'
>

export function createShipSlice(set: SetFn, get: GetFn): ShipActions {
  return {
    // Phase 16: использует DAILY_CAP константу из missionConfig.ts (было hardcoded 4).
    // Pity counter (CREW-08) растёт ТОЛЬКО при consume — не при flight.
    consumeMissionCredit: () => {
      const state = get()
      if (state.crew.missionsToday >= DAILY_CAP) return false
      set({
        crew: { ...state.crew, missionsToday: state.crew.missionsToday + 1 },
      })
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
      const ship = get().ship! // non-null после ensure

      // No-op: уже docked у этой planet (UI должен предотвратить — но slice idempotent)
      if (ship.state === 'docked' && ship.planetId === toPlanetId) return

      let fromPos: { x: number; y: number }
      let fromPlanetIdForUi: string

      if (ship.state === 'docked') {
        const fromPlanet = findPlanetById(ship.planetId)
        if (!fromPlanet) return // corrupt — bail
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
        fromPlanetIdForUi = ship.fromPlanetId // сохраняем UI «откуда летели изначально»
      }

      const dist = planetDistance(fromPos, { x: target.x, y: target.y })
      // Phase 22 Plan 22-05: ship_speed shop perma upgrade → /multiplier.
      const baseDur = travelTimeMs(dist)
      const speedMult = shipSpeedMultiplier(get().permaShipSpeedBonus ?? 0)
      const dur = baseDur / speedMult
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
      if (!target) return // защита от mismatch
      set({ ship: { state: 'docked', planetId } })
      // Notify subscribers (ShipTab, MissionOverlay enabler).
      eventBus.emit('cosmic:ship-arrived', { planetId })
    },

    setShipPosition: (x, y) => {
      set({ latestShipPos: { x, y } })
    },

    // Phase 16-04: atomic investigate transaction (REQ MISSION-05/06/07, CREW-04/08).
    // Phase 22: bonusRarity removed — box created without rarity dimension.
    // Phase 22 Plan 22-06: cosmos gate — defensive guard. Star Map UI sкрыт до
    // unlock (LocationStack id=6 hide), но миссии — основной серум-источник,
    // дублируем guard здесь как безопасность.
    // - guard: ship.state !== 'docked' OR ship.planetId !== planetId → no-op (false)
    // - guard: missionsToday >= DAILY_CAP → no-op (false)
    // - guard: !hasCosmosUnlocked → no-op (false)
    // - atomic: missionsToday++, addBox с element=elementFromPlanet, hasFirstMission=true
    // - emit 'cosmic:toast' с открытием Боксы
    investigatePlanet: (planetId, _result) => {
      const s = get()
      // Phase 22 Plan 22-06 guard 0: cosmos gate
      const cosmosUnlocked = (s as unknown as { hasCosmosUnlocked?: boolean })
        .hasCosmosUnlocked === true
      if (!cosmosUnlocked) {
        return false
      }
      // Guard 1: ship docked at this planet?
      if (
        !s.ship ||
        s.ship.state !== 'docked' ||
        s.ship.planetId !== planetId
      ) {
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
      const element = elementFromPlanet(archetype, mainRaceType) ?? 'fire' // fallback

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
            // Phase 22: bonusRarity removed
          },
        ],
        hasFirstMission: true, // unlock Боксы tab (REQ UX-09)
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
