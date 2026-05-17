// Phase 22 Plan 22-03: Ascension sub-slice.
//
// Когда carrier достигает L18 (через стандартный merge), он instant ascends:
//   - Удаляется из state.carriers (слот на поле освобождается).
//   - В state.ascendedCarriers добавляется новый AscendedCarrier
//     (permanent, persisted в localStorage).
//   - state.essence += 1 (placeholder reward; balance — Plan 22-07).
//   - Эмитится eventBus 'cosmic:carrier-ascended' для:
//       * MainScene → playAscensionTween (scale+fade+aura pulse ~1.5s)
//       * FrogOverlayManager → releaseForFrog (cleanup overlay)
//
// Idempotent: повторный вызов с тем же frogId — no-op (carrier уже удалён).

import type { CosmicSliceActions, GetFn, SetFn } from '../slice'
import type { AscendedCarrier } from '../types'
import { eventBus } from '../../eventBus'

export type AscensionActions = Pick<CosmicSliceActions, 'ascendCarrier'>

function makeAscendedId(): string {
  // Compact unique id — collision-proof для smoke/dev, читабельно в logs.
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).slice(2, 8)
  return `asc-${ts}-${rnd}`
}

export function createAscensionSlice(
  set: SetFn,
  get: GetFn,
): AscensionActions {
  return {
    ascendCarrier: (frogId: string) => {
      const s = get()
      const carrier = s.carriers.find((c) => c.frogId === frogId)
      if (!carrier) return // unknown frogId / already ascended → no-op

      const ascended: AscendedCarrier = {
        id: makeAscendedId(),
        element: carrier.element,
        ascendedAt: Date.now(),
      }

      set({
        carriers: s.carriers.filter((c) => c.frogId !== frogId),
        ascendedCarriers: [...s.ascendedCarriers, ascended],
        essence: s.essence + 1,
      })

      // Emit AFTER mutation так чтобы subscribers видели свежее состояние store.
      eventBus.emit('cosmic:carrier-ascended', {
        frogId,
        element: carrier.element,
      })
    },
  }
}
