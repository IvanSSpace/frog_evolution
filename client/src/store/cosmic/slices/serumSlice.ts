// Cosmic Frogs — Serum sub-slice.
// Phase 22: rarity убран. Серум — плоский Record<Element, number>.
// applySerum принимает любую обычную frog любого уровня → carrier того же уровня.

import type { CarrierData } from '../types'
import type { CosmicSliceActions, GetFn, SetFn } from '../slice'
import { applySerumApi } from '../../../api/cosmic'
import { eventBus } from '../../eventBus'
import { devWarn } from '../../../utils/devLog'

/** Маппинг server error code → русский текст для toast'а юзеру. */
const APPLY_SERUM_ERROR_MESSAGES: Record<string, string> = {
  'frogId required': 'Лягушка не выбрана',
  'invalid element': 'Неверный элемент сыворотки',
  'invalid level': 'Неверный уровень',
  'no game state': 'Состояние игры не загружено',
  'no serum': 'Сыворотка отсутствует в инвентаре',
  'already carrier': 'Лягушка уже под сывороткой',
}

function translateServerError(raw: string): string {
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
    addSerum: (element, count = 1) => {
      const s = get()
      const cur = s.serums[element]
      const next = Math.max(0, cur + count)
      set({ serums: { ...s.serums, [element]: next } })
    },

    removeSerum: (element, count = 1) => {
      const s = get()
      const cur = s.serums[element]
      const next = Math.max(0, cur - count)
      set({ serums: { ...s.serums, [element]: next } })
    },

    // Phase 14: tap-to-select / drag mode flag.
    setSerumDragActive: (active, payload) => {
      if (active) {
        set({ serumDragActive: true, selectedSerum: payload ?? null })
      } else {
        set({ serumDragActive: false, selectedSerum: null })
      }
    },

    // Phase 22: упрощённый applySerum (без rarity).
    //  1. Guard: serum в инвентаре?
    //  2. Guard: idempotency — frog уже carrier?
    //  3. Optimistic local: decrement serums[element], add carrier {frogId, element, level}
    //  4. POST /game/cosmic/apply-serum (server валидирует и применяет)
    //  5. Success → reconcile serums
    //  6. Error → rollback + toast
    applySerum: async (frogId, element, level) => {
      const s = get()

      const cur = s.serums[element]
      if (cur < 1) return

      if (s.carriers.some((c) => c.frogId === frogId)) return

      const prevSerums = s.serums
      const nextSerumsOpt = { ...s.serums, [element]: cur - 1 }
      const nextCarrier: CarrierData = { frogId, element, level }
      set({
        serums: nextSerumsOpt,
        carriers: [...s.carriers, nextCarrier],
        serumDragActive: false,
        selectedSerum: null,
      })

      try {
        const res = await applySerumApi(frogId, element, level)
        set({ serums: res.serums })
      } catch (err) {
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
