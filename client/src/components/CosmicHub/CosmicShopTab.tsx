// Phase 25-02: visual restyle (dark cards + pink CTAs)
// Phase 22 Plan 22-05: Cosmic Shop tab — 6 items, 2 currencies.
// Список карточек items, кнопка «Купить» (disabled если currency не хватает).
// serum_trade_up / skip_ship_cooldown имеют element-picker (select).
// Click handler атомарно вызывает purchaseShopItem из shopSlice.

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
import {
  DARK_CARD_STYLE,
  PINK_CTA_STYLE,
  DISABLED_CTA_OVERRIDES,
  PINK,
  GOLD,
  TEXT_DIM,
  TEXT_VERY_DIM,
} from './_styles'

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

  const selectStyle = {
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 12,
    borderRadius: 8,
    padding: '4px 8px',
    width: '100%',
    border: '1px solid rgba(255,255,255,0.15)',
    outline: 'none',
  } as const

  return (
    <div className="p-3 flex flex-col gap-3" style={{ color: '#fff' }}>
      {/* Currency header */}
      <div
        className="flex gap-4 items-center pb-2"
        style={{
          fontSize: 14,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <span className="flex items-center gap-1">
          <span style={{ fontSize: 16 }}>💠</span>
          <span className="font-mono" style={{ color: GOLD, fontWeight: 700 }}>
            {essence}
          </span>
          <span style={{ color: TEXT_VERY_DIM, fontSize: 11 }}>
            {t('cosmic_shop.essence')}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <span style={{ fontSize: 16 }}>🧪</span>
          <span className="font-mono" style={{ color: PINK, fontWeight: 700 }}>
            {serumTotal}
          </span>
          <span style={{ color: TEXT_VERY_DIM, fontSize: 11 }}>
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
          const isEssence = item.currency === 'essence'

          return (
            <div
              key={id}
              style={{
                ...DARK_CARD_STYLE,
                opacity: afford ? 1 : 0.6,
                border: afford
                  ? '1px solid rgba(236,72,153,0.35)'
                  : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1">
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {t(`cosmic_shop.items.${id}.title`)}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: TEXT_DIM,
                      marginTop: 2,
                    }}
                  >
                    {t(`cosmic_shop.items.${id}.desc`)}
                  </div>
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.35)',
                    color: isEssence ? GOLD : PINK,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    border: `1px solid ${isEssence ? 'rgba(253,224,71,0.3)' : 'rgba(236,72,153,0.3)'}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {CURRENCY_ICON[item.currency]} {cost}
                </div>
              </div>

              {/* Scaling info — показываем счётчик покупок если perma */}
              {item.isPermanent && purchasedTimes > 0 ? (
                <div
                  style={{
                    fontSize: 10,
                    color: TEXT_VERY_DIM,
                    marginBottom: 4,
                  }}
                >
                  {t('cosmic_shop.purchased_count', { count: purchasedTimes })}
                </div>
              ) : null}

              {/* Element picker — только для trade-up */}
              {id === 'serum_trade_up' ? (
                <div className="mb-2">
                  <label
                    className="block"
                    style={{
                      fontSize: 10,
                      color: TEXT_VERY_DIM,
                      marginBottom: 2,
                    }}
                  >
                    {t('cosmic_shop.pick_source_element')}
                  </label>
                  <select
                    value={tradeUpElement}
                    onChange={(e) =>
                      setTradeUpElement(e.target.value as Element)
                    }
                    style={selectStyle}
                  >
                    {ELEMENTS.map((el) => (
                      <option
                        key={el}
                        value={el}
                        style={{ background: '#1a2e1a', color: '#fff' }}
                      >
                        {t(`cosmic_hub.elements.${el}`)} ({serums[el] ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Element picker — для skip_ship_cooldown */}
              {id === 'skip_ship_cooldown' ? (
                <div className="mb-2">
                  <label
                    className="block"
                    style={{
                      fontSize: 10,
                      color: TEXT_VERY_DIM,
                      marginBottom: 2,
                    }}
                  >
                    {t('cosmic_shop.pick_skip_element')}
                  </label>
                  <select
                    value={skipShipElement}
                    onChange={(e) =>
                      setSkipShipElement(e.target.value as Element)
                    }
                    style={selectStyle}
                  >
                    {ELEMENTS.map((el) => (
                      <option
                        key={el}
                        value={el}
                        style={{ background: '#1a2e1a', color: '#fff' }}
                      >
                        {t(`cosmic_hub.elements.${el}`)} ({serums[el] ?? 0})
                      </option>
                    ))}
                  </select>
                  {ship && ship.state !== 'transit' ? (
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(253,224,71,0.7)',
                        marginTop: 2,
                      }}
                    >
                      {t('cosmic_shop.skip_requires_transit')}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                disabled={!afford}
                onClick={() => handlePurchase(id)}
                className="w-full mt-1"
                style={
                  afford
                    ? {
                        ...PINK_CTA_STYLE,
                        padding: '8px 16px',
                        fontSize: 13,
                      }
                    : {
                        ...PINK_CTA_STYLE,
                        ...DISABLED_CTA_OVERRIDES,
                        padding: '8px 16px',
                        fontSize: 13,
                      }
                }
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
