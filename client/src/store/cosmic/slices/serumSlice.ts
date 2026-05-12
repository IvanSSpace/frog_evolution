// Cosmic Frogs — Serum sub-slice.
// Извлечено из cosmic/slice.ts при рефакторе разделения по доменам.
// Public API не меняется: composed обратно в createCosmicSlice через spread.

import type { CarrierData } from '../types'
import type { CosmicSliceActions, GetFn, SetFn } from '../slice'
import { applySerumApi } from '../../../api/cosmic'
import { eventBus } from '../../eventBus'
import { devWarn } from '../../../utils/devLog'

/** Маппинг server error code → русский текст для toast'а юзеру. */
const APPLY_SERUM_ERROR_MESSAGES: Record<string, string> = {
  'frogId required': 'Лягушка не выбрана',
  'invalid element': 'Неверный элемент сыворотки',
  'invalid rarity': 'Неверная редкость',
  'invalid level': 'Неверный уровень',
  'level mismatch': 'Уровень лягушки не подходит для этой сыворотки',
  'no game state': 'Состояние игры не загружено',
  'no serum': 'Сыворотка отсутствует в инвентаре',
  'already carrier': 'Лягушка уже под сывороткой',
}

function translateServerError(raw: string): string {
  // Server message может быть "error: foo" — пробуем match по подстроке.
  for (const [code, ru] of Object.entries(APPLY_SERUM_ERROR_MESSAGES)) {
    if (raw.includes(code)) return ru
  }
  return raw
}

export type SerumActions = Pick<
  CosmicSliceActions,
  'addSerum' | 'removeSerum' | 'setSerumDragActive' | 'applySerum'
>

export function createSerumSlice(set: SetFn, get: GetFn): SerumActions {
  return {
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

    // Phase 14 / Phase 22: server-validated apply с optimistic UI.
    //  1. Локальные guards (быстрый exit для очевидных no-op'ов)
    //  2. Optimistic local apply — UI мгновенно отзывается
    //  3. POST /game/cosmic/apply-serum — сервер валидирует и применяет
    //  4. Success → reconcile serums map с сервером
    //  5. Error → rollback (вернуть serum, убрать carrier), показать toast
    applySerum: async (frogId, element, rarity, level) => {
      const s = get()

      // Guard 1: serum доступен?
      const cur = s.serums[element][rarity]
      if (cur < 1) return

      // Guard 2: idempotency — frog уже carrier?
      if (s.carriers.some((c) => c.frogId === frogId)) return

      // Optimistic apply
      const prevSerums = s.serums
      const nextSerumsOpt = {
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
        serums: nextSerumsOpt,
        carriers: [...s.carriers, nextCarrier],
        serumDragActive: false,
        selectedSerum: null,
      })

      // Server validation
      try {
        const res = await applySerumApi(frogId, element, rarity, level)
        // Reconcile serums с сервером (server — единственный источник истины).
        set({ serums: res.serums })
      } catch (err) {
        // Rollback: вернуть serum + убрать carrier
        const cur2 = get()
        set({
          serums: prevSerums,
          carriers: cur2.carriers.filter((c) => c.frogId !== frogId),
        })
        const raw = err instanceof Error ? err.message : 'unknown error'
        const ruMsg = translateServerError(raw)
        devWarn('[applySerum] server rejected, rolled back:', raw)
        eventBus.emit('cosmic:toast', {
          type: 'generic',
          msg: ruMsg,
          duration: 2500,
        })
      }
    },
  }
}
