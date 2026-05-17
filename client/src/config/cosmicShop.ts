// Phase 22 Plan 22-05: Cosmic Shop config.
// 6 items, две валюты (essence + серум). Placeholder cost values — balance в отдельной фазе.
// Perma upgrades (slot/ship-speed/serum-drop) имеют scaling cost ×2 за каждую покупку.
// Consumable items (cosmic_box / serum_trade_up / skip_ship_cooldown) — flat cost.
//
// Wiring:
//   purchaseShopItem(itemId, opts?) — единственная точка входа (shopSlice.ts).
//   Apply effect выполняется внутри shopSlice через switch на itemId.
//   permaSlotBonus / permaShipSpeedBonus / permaSerumDropBonus — Plan 22-06+ читает из game systems.

export type ShopItemId =
  | 'cosmic_box'
  | 'slot_plus_one'
  | 'ship_speed'
  | 'serum_drop_chance'
  | 'skip_ship_cooldown'
  | 'serum_trade_up'

export const SHOP_ITEM_IDS: readonly ShopItemId[] = [
  'cosmic_box',
  'slot_plus_one',
  'ship_speed',
  'serum_drop_chance',
  'skip_ship_cooldown',
  'serum_trade_up',
]

export interface ShopItem {
  id: ShopItemId
  /** Какой валютой платим. */
  currency: 'essence' | 'serum'
  /** Базовая стоимость (для purchasedTimes=0). */
  baseCost: number
  /** Множитель цены за каждую следующую покупку. 1.0 = без scaling (consumable). */
  scalingFactor: number
  /** true → даёт permanent state-bonus, scaling растёт. false → consumable. */
  isPermanent: boolean
}

/** Demo-build placeholder values; balance — отдельный план. */
export const SHOP_ITEMS: Record<ShopItemId, ShopItem> = {
  cosmic_box: {
    id: 'cosmic_box',
    currency: 'essence',
    baseCost: 3,
    scalingFactor: 1.0,
    isPermanent: false,
  },
  slot_plus_one: {
    id: 'slot_plus_one',
    currency: 'essence',
    baseCost: 1,
    scalingFactor: 2.0,
    isPermanent: true,
  },
  ship_speed: {
    id: 'ship_speed',
    currency: 'essence',
    baseCost: 1,
    scalingFactor: 2.0,
    isPermanent: true,
  },
  serum_drop_chance: {
    id: 'serum_drop_chance',
    currency: 'essence',
    baseCost: 1,
    scalingFactor: 2.0,
    isPermanent: true,
  },
  skip_ship_cooldown: {
    id: 'skip_ship_cooldown',
    currency: 'serum',
    baseCost: 1,
    scalingFactor: 1.0,
    isPermanent: false,
  },
  serum_trade_up: {
    id: 'serum_trade_up',
    currency: 'serum',
    baseCost: 3,
    scalingFactor: 1.0,
    isPermanent: false,
  },
}

/**
 * Цена следующей покупки. Геометрическая прогрессия:
 *   cost(n) = baseCost * scalingFactor^n
 * scalingFactor=1 → flat (всегда baseCost), scalingFactor=2 → ×2 каждый раз.
 *
 * Round к целому числу (cost — целые единицы валюты).
 */
export function getNextCost(item: ShopItem, purchasedTimes: number): number {
  if (item.scalingFactor === 1) return item.baseCost
  if (purchasedTimes <= 0) return item.baseCost
  return Math.round(item.baseCost * Math.pow(item.scalingFactor, purchasedTimes))
}
