// Phase 22 Plan 22-05: Cosmic Shop tab — 6 items, 2 currencies.
// Список карточек items, кнопка «Купить» (disabled если currency не хватает).
// serum_trade_up / skip_ship_cooldown имеют element-picker (select).
// Click handler атомарно вызывает purchaseShopItem из shopSlice.
//
// Demo-build: минималистичный UI на Tailwind, без анимаций (CSS-only по правилу).
// Confirm modal не нужен — purchase reversible через UI (балансировка) и одиночный tap
// не должен случайно потратить большой ресурс (essence cap = 3-16, манежно).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import {
  SHOP_ITEMS,
  SHOP_ITEM_IDS,
  getNextCost,
  type ShopItemId,
} from '../../config/cosmicShop'
import { ELEMENTS, type Element } from '../../store/cosmic/types'

const CURRENCY_ICON = {
  essence: '💠',
  serum: '🧪',
} as const

export function CosmicShopTab() {
  const { t } = useTranslation()
  const essence = useGameStore((s) => s.essence)
  const serums = useGameStore((s) => s.serums)
  const purchaseCounts = useGameStore((s) => s.shopPurchaseCounts)
  const ship = useGameStore((s) => s.ship)
  const purchase = useGameStore((s) => s.purchaseShopItem)

  // Element picker state для serum_trade_up / skip_ship_cooldown.
  // Дефолт — первый element с положительным balance, иначе 'fire'.
  const defaultElement: Element =
    (ELEMENTS.find((el) => (serums[el] ?? 0) > 0) as Element) ?? 'fire'
  const [tradeUpElement, setTradeUpElement] =
    useState<Element>(defaultElement)
  const [skipShipElement, setSkipShipElement] =
    useState<Element>(defaultElement)

  const serumTotal = ELEMENTS.reduce((sum, el) => sum + (serums[el] ?? 0), 0)

  const handlePurchase = (id: ShopItemId) => {
    if (id === 'serum_trade_up') {
      purchase(id, { sourceElement: tradeUpElement })
    } else if (id === 'skip_ship_cooldown') {
      purchase(id, { skipElement: skipShipElement })
    } else {
      purchase(id)
    }
  }

  const canAfford = (id: ShopItemId): boolean => {
    const item = SHOP_ITEMS[id]
    const cost = getNextCost(item, purchaseCounts[id] ?? 0)
    if (item.currency === 'essence') {
      return essence >= cost
    }
    if (id === 'serum_trade_up') {
      return (serums[tradeUpElement] ?? 0) >= cost
    }
    if (id === 'skip_ship_cooldown') {
      const enough = (serums[skipShipElement] ?? 0) >= cost
      const transit = !!ship && ship.state === 'transit'
      return enough && transit
    }
    return false
  }

  return (
    <div className="p-3 flex flex-col gap-3 text-white">
      {/* Currency header */}
      <div className="flex gap-4 items-center text-sm pb-2 border-b border-white/10">
        <span className="flex items-center gap-1">
          <span className="text-base">💠</span>
          <span className="font-mono">{essence}</span>
          <span className="text-white/50 text-xs">
            {t('cosmic_shop.essence')}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-base">🧪</span>
          <span className="font-mono">{serumTotal}</span>
          <span className="text-white/50 text-xs">
            {t('cosmic_shop.serum_total')}
          </span>
        </span>
      </div>

      {/* Item cards */}
      <div className="flex flex-col gap-2">
        {SHOP_ITEM_IDS.map((id) => {
          const item = SHOP_ITEMS[id]
          const cost = getNextCost(item, purchaseCounts[id] ?? 0)
          const afford = canAfford(id)
          const purchasedTimes = purchaseCounts[id] ?? 0

          return (
            <div
              key={id}
              className={[
                'p-3 rounded-lg border transition-colors',
                afford
                  ? 'border-emerald-500/40 bg-gray-900'
                  : 'border-white/10 bg-gray-950 opacity-60',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {t(`cosmic_shop.items.${id}.title`)}
                  </div>
                  <div className="text-xs text-white/60 mt-0.5">
                    {t(`cosmic_shop.items.${id}.desc`)}
                  </div>
                </div>
                <div
                  className={[
                    'text-xs font-mono px-2 py-1 rounded',
                    item.currency === 'essence'
                      ? 'bg-purple-900/40 text-purple-200'
                      : 'bg-amber-900/40 text-amber-200',
                  ].join(' ')}
                >
                  {CURRENCY_ICON[item.currency]} {cost}
                </div>
              </div>

              {/* Scaling info — показываем счётчик покупок если perma */}
              {item.isPermanent && purchasedTimes > 0 ? (
                <div className="text-[10px] text-white/40 mb-1">
                  {t('cosmic_shop.purchased_count', { count: purchasedTimes })}
                </div>
              ) : null}

              {/* Element picker — только для trade-up */}
              {id === 'serum_trade_up' ? (
                <div className="mb-2">
                  <label className="text-[10px] text-white/50 block mb-0.5">
                    {t('cosmic_shop.pick_source_element')}
                  </label>
                  <select
                    value={tradeUpElement}
                    onChange={(e) =>
                      setTradeUpElement(e.target.value as Element)
                    }
                    className="bg-gray-800 text-white text-xs rounded px-2 py-1 w-full border border-white/10"
                  >
                    {ELEMENTS.map((el) => (
                      <option key={el} value={el}>
                        {t(`cosmic_hub.elements.${el}`)} ({serums[el] ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Element picker — для skip_ship_cooldown */}
              {id === 'skip_ship_cooldown' ? (
                <div className="mb-2">
                  <label className="text-[10px] text-white/50 block mb-0.5">
                    {t('cosmic_shop.pick_skip_element')}
                  </label>
                  <select
                    value={skipShipElement}
                    onChange={(e) =>
                      setSkipShipElement(e.target.value as Element)
                    }
                    className="bg-gray-800 text-white text-xs rounded px-2 py-1 w-full border border-white/10"
                  >
                    {ELEMENTS.map((el) => (
                      <option key={el} value={el}>
                        {t(`cosmic_hub.elements.${el}`)} ({serums[el] ?? 0})
                      </option>
                    ))}
                  </select>
                  {ship && ship.state !== 'transit' ? (
                    <div className="text-[10px] text-amber-300/70 mt-0.5">
                      {t('cosmic_shop.skip_requires_transit')}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                disabled={!afford}
                onClick={() => handlePurchase(id)}
                className={[
                  'w-full mt-1 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                  afford
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-gray-700 text-white/40 cursor-not-allowed',
                ].join(' ')}
              >
                {afford ? t('cosmic_shop.buy') : t('cosmic_shop.insufficient')}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
