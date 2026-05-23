// Phase 22 Plan 22-05: Cosmic Shop sub-slice.
//
// Единственный action — purchaseShopItem(itemId, opts?). Atomic transaction:
//   1. Resolve item config + текущая cost через getNextCost(item, purchasedTimes).
//   2. Guard на currency:
//      - essence items: state.essence >= cost
//      - serum items: серум-источник указан через opts (sourceElement / skipElement)
//        и его count >= cost. skip_ship_cooldown дополнительно требует ship.state==='transit'.
//   3. Decrement currency + increment shopPurchaseCounts[itemId].
//   4. Apply effect:
//      - slot_plus_one / ship_speed / serum_drop_chance → ++ perma counter
//      - cosmic_box → emit 'cosmic:cosmic-box-purchased' (subscriber spawn'ит 3 L7 frogs)
//      - serum_trade_up → +1 random element (RNG обычный Math.random)
//      - skip_ship_cooldown → ship = {state:'docked', planetId: toPlanetId}
//   5. Return true on success, false on guard failure.
//
// Все мутации — внутри одного set() для атомарности.

import type { CosmicSliceActions, GetFn, SetFn } from '../slice'
import type { Element, ShipState } from '../types'
import { eventBus } from '../../eventBus'
import {
  SHOP_ITEMS,
  getNextCost,
  type ShopItemId,
} from '../../../config/cosmicShop'
import { ELEMENTS } from '../types'

export type ShopActions = Pick<CosmicSliceActions, 'purchaseShopItem'>

export interface PurchaseShopItemOpts {
  /** Для serum_trade_up: source element (откуда списываем 3 серум). */
  sourceElement?: Element
  /** Для skip_ship_cooldown: какой element серум потратить. */
  skipElement?: Element
}

export function createShopSlice(set: SetFn, get: GetFn): ShopActions {
  return {
    purchaseShopItem: (itemId, _opts) => {
      // Cast чтобы получить runtime safety для unknown id.
      const id = itemId as ShopItemId
      const item = SHOP_ITEMS[id]
      if (!item) return false

      const s = get()
      const cosmic = s // CosmicState includes CosmicSlice fields flat
      const purchasedTimes = cosmic.shopPurchaseCounts[id] ?? 0
      const cost = getNextCost(item, purchasedTimes)

      // === Currency guards ===
      // 2026-05-22: серум больше не валюта. Все items платят essence.
      if (cosmic.essence < cost) return false
      // skip_ship_cooldown сохраняет special guard на ship state.
      if (id === 'skip_ship_cooldown') {
        if (!cosmic.ship || cosmic.ship.state !== 'transit') return false
      }

      // === Compute new state (atomic) ===
      // Сначала вычислим декремент стоимости + counter, потом apply effect.
      const nextCounts: Partial<Record<ShopItemId, number>> = {
        ...cosmic.shopPurchaseCounts,
        [id]: purchasedTimes + 1,
      }

      // Effect-specific computations
      let nextEssence = cosmic.essence
      let nextSerums = cosmic.serums
      let nextSlotBonus = cosmic.permaSlotBonus
      let nextShipSpeedBonus = cosmic.permaShipSpeedBonus
      let nextSerumDropBonus = cosmic.permaSerumDropBonus
      let nextShip: ShipState | null = cosmic.ship

      // Cost deduction — все items платят essence (2026-05-22).
      nextEssence -= cost

      // Apply effect
      switch (id) {
        case 'slot_plus_one':
          nextSlotBonus += 1
          break
        case 'ship_speed':
          nextShipSpeedBonus += 1
          break
        case 'serum_drop_chance':
          nextSerumDropBonus += 1
          break
        case 'cosmic_box':
          // Side-effect: emit event для MainScene subscriber (spawn 3 frogs L7+).
          // Emit ПОСЛЕ set() — см. ниже.
          break
        case 'serum_trade_up': {
          // +1 random element серум. RNG = Math.random (spy'нем в test).
          const idx = Math.floor(Math.random() * ELEMENTS.length)
          const randElem = ELEMENTS[idx] as Element
          nextSerums = {
            ...nextSerums,
            [randElem]: nextSerums[randElem] + 1,
          }
          break
        }
        case 'skip_ship_cooldown': {
          // ship guaranteed transit (guard выше). Завершаем мгновенно.
          if (cosmic.ship && cosmic.ship.state === 'transit') {
            nextShip = {
              state: 'docked',
              planetId: cosmic.ship.toPlanetId,
            }
          }
          break
        }
      }

      set({
        essence: nextEssence,
        serums: nextSerums,
        permaSlotBonus: nextSlotBonus,
        permaShipSpeedBonus: nextShipSpeedBonus,
        permaSerumDropBonus: nextSerumDropBonus,
        ship: nextShip,
        shopPurchaseCounts: nextCounts,
      })

      // Post-mutation side-effects (subscribers видят свежее state).
      if (id === 'cosmic_box') {
        eventBus.emit('cosmic:cosmic-box-purchased', {})
      } else if (id === 'skip_ship_cooldown' && nextShip?.state === 'docked') {
        eventBus.emit('cosmic:ship-arrived', { planetId: nextShip.planetId })
      }

      return true
    },
  }
}
