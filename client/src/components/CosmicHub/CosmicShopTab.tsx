// 2026-05-23: переделано под единый стиль с UpgradeCard в ShopModal,
// но с фиолетовым акцентом — визуально отделяет cosmic-улучшения от
// базовых апгрейдов (drop speed / магнит / etc).
//
// 2026-05-22: серум больше не валюта. Все items платят essence.
// Element pickers + serum totals удалены. Слой рендерится в `ShopModal`
// после регулярных upgrades, gated by cosmosUnlocked.

import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import {
  SHOP_ITEMS,
  SHOP_ITEM_IDS,
  getNextCost,
  type ShopItemId,
} from '../../config/cosmicShop'

const PURPLE_ICON_BG = 'linear-gradient(180deg, #ede9fe 0%, #c4b5fd 100%)'
const PURPLE_BORDER = '#6d28d9'
const PURPLE_TITLE = '#581c87'
const PURPLE_TEXT = '#6b21a8'
const PURPLE_DIM = '#7c3aed'

const ITEM_ICON: Record<ShopItemId, string> = {
  cosmic_box: '📦',
  slot_plus_one: '➕',
  ship_speed: '🚀',
  serum_drop_chance: '💧',
  skip_ship_cooldown: '⏩',
  serum_trade_up: '🔁',
}

export function CosmicShopTab() {
  const { t } = useTranslation()
  const purchaseCounts = useGameStore((s) => s.shopPurchaseCounts)
  const ship = useGameStore((s) => s.ship)
  const purchase = useGameStore((s) => s.purchaseShopItem)
  const essence = useGameStore((s) => s.essence)

  const handlePurchase = (id: ShopItemId) => {
    purchase(id)
  }

  const canAfford = (id: ShopItemId): boolean => {
    const item = SHOP_ITEMS[id]
    const cost = getNextCost(item, purchaseCounts[id] ?? 0)
    if (essence < cost) return false
    if (id === 'skip_ship_cooldown') {
      return !!ship && ship.state === 'transit'
    }
    return true
  }

  return (
    <div className="flex flex-col gap-3 mt-2">
      <div
        className="ff-display text-xs text-center py-1"
        style={{
          color: PURPLE_TITLE,
          letterSpacing: 1,
          borderTop: `2px dashed ${PURPLE_BORDER}`,
          borderBottom: `2px dashed ${PURPLE_BORDER}`,
          background: 'rgba(196, 181, 253, 0.12)',
        }}
      >
        КОСМИЧЕСКИЕ УЛУЧШЕНИЯ
      </div>

      {SHOP_ITEM_IDS.map((id) => {
        const item = SHOP_ITEMS[id]
        const cost = getNextCost(item, purchaseCounts[id] ?? 0)
        const afford = canAfford(id)
        const purchasedTimes = purchaseCounts[id] ?? 0
        const title = t(`cosmic_shop.items.${id}.title`)
        const desc = t(`cosmic_shop.items.${id}.desc`)
        const showShipHint =
          id === 'skip_ship_cooldown' && (!ship || ship.state !== 'transit')

        return (
          <div key={id} className="ff-card p-3 flex items-center gap-3">
            <div
              className="flex-shrink-0 w-14 h-14 flex items-center justify-center text-3xl rounded-2xl"
              style={{
                background: PURPLE_ICON_BG,
                border: `2px solid ${PURPLE_BORDER}`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>
                {ITEM_ICON[id]}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="ff-display text-base leading-tight"
                style={{ color: PURPLE_TITLE }}
              >
                {title}
              </div>
              <div
                className="ff-body text-xs mt-0.5 font-bold leading-tight"
                style={{ color: PURPLE_TEXT }}
              >
                {desc}
              </div>
              {item.isPermanent && purchasedTimes > 0 && (
                <div
                  className="ff-body text-[10px] font-bold mt-0.5"
                  style={{ color: PURPLE_DIM }}
                >
                  {t('cosmic_shop.purchased_count', { count: purchasedTimes })}
                </div>
              )}
              {showShipHint && (
                <div
                  className="ff-body text-[10px] font-bold mt-0.5"
                  style={{ color: '#b45309' }}
                >
                  {t('cosmic_shop.skip_requires_transit')}
                </div>
              )}
            </div>

            <button
              onClick={() => handlePurchase(id)}
              disabled={!afford}
              className={`ff-btn text-sm ${
                afford ? 'ff-btn-purple' : 'ff-btn-grey'
              }`}
            >
              💠 {cost}
            </button>
          </div>
        )
      })}
    </div>
  )
}
