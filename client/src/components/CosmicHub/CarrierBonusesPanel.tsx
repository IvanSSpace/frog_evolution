// Phase 22-04 / tech-debt 2026-05-19: бонусы переехали из top-HUD pill bar в
// Carriers tab как display-only panel (см. ActiveBonusesBar — удалён).
//
// Логика агрегации — без изменений: same aggregateFullBonuses + aggregateMiniBonuses,
// same `·mini` бэйдж когда вся сумма приходит от mini.
//
// Отличия от старого ActiveBonusesBar:
//   - Rendered инлайн в CarriersTab (никакого fixed positioning, никакого z-index).
//   - НЕ интерактивен — panel, не button. Tooltip удалён.
//   - Empty state «нет активных бонусов» (раньше bar просто скрывался).
//   - Стилизация — DARK_CARD_STYLE токены из _styles.ts.
//
// Cosmos gate (useCosmosUnlocked): panel сам себя гасит на pre-cosmos состоянии,
// но в Carriers tab юзер не попадёт до открытия Cosmic Hub'а, так что это
// defensive double-check.
//
// State paths: cosmic slice plain-spread'нут в useGameStore → `s.ascendedCarriers`,
// `s.carriers` (НЕ `s.cosmic.X`).
//
// memory feedback_animations: CSS keyframes / Phaser tweens only (no Lottie).
// Здесь анимаций нет вообще — static display.

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import {
  aggregateFullBonuses,
  aggregateMiniBonuses,
} from '../../utils/archetypeBonuses'
import { useCosmosUnlocked } from '../../utils/cosmosGate'
import {
  DARK_CARD_STYLE,
  SECTION_HEADER_STYLE,
  TEXT_DIM,
  TEXT_VERY_DIM,
  GOLD,
} from './_styles'

function fmtPct(v: number): string {
  // 0.055 → "5.5", 0.05 → "5", 0.001 → "0.1"
  const pct = v * 100
  return pct.toFixed(1).replace(/\.0$/, '')
}

export function CarrierBonusesPanel() {
  const { t } = useTranslation()
  const unlocked = useCosmosUnlocked()
  const ascended = useGameStore((s) => s.ascendedCarriers)
  const carriers = useGameStore((s) => s.carriers)

  const fullBonuses = useMemo(() => aggregateFullBonuses(ascended), [ascended])
  const miniBonuses = useMemo(() => aggregateMiniBonuses(carriers), [carriers])

  // Сумма full + mini per bonus key.
  const total = {
    boxDropSpeed: fullBonuses.boxDropSpeed + miniBonuses.boxDropSpeed,
    tractorGold: fullBonuses.tractorGold + miniBonuses.tractorGold,
    offlineCap: fullBonuses.offlineCap + miniBonuses.offlineCap,
    serumDrop: fullBonuses.serumDrop + miniBonuses.serumDrop,
    flatGold: fullBonuses.flatGold + miniBonuses.flatGold,
  }

  // mini == value ⇒ «весь бонус сейчас приходит из mini» ⇒ показать `·mini` badge.
  type Item = { label: string; value: number; mini: number }
  const items: Item[] = []
  if (total.flatGold > 0)
    items.push({
      label: t('hud.bonus.gold'),
      value: total.flatGold,
      mini: miniBonuses.flatGold,
    })
  if (total.tractorGold > 0)
    items.push({
      label: t('hud.bonus.tractorGold'),
      value: total.tractorGold,
      mini: miniBonuses.tractorGold,
    })
  if (total.boxDropSpeed > 0)
    items.push({
      label: t('hud.bonus.boxSpeed'),
      value: total.boxDropSpeed,
      mini: miniBonuses.boxDropSpeed,
    })
  if (total.offlineCap > 0)
    items.push({
      label: t('hud.bonus.offlineCap'),
      value: total.offlineCap,
      mini: miniBonuses.offlineCap,
    })
  if (total.serumDrop > 0)
    items.push({
      label: t('hud.bonus.serumDrop'),
      value: total.serumDrop,
      mini: miniBonuses.serumDrop,
    })

  if (!unlocked) return null

  return (
    <section
      style={{
        ...DARK_CARD_STYLE,
        marginBottom: 8,
      }}
      aria-label={t('hud.bonus.tooltip_title')}
    >
      <div style={SECTION_HEADER_STYLE}>{t('hud.bonus.tooltip_title')}</div>
      {items.length === 0 ? (
        <div
          style={{
            color: TEXT_VERY_DIM,
            fontSize: 12,
            fontStyle: 'italic',
          }}
        >
          {t('cosmic_hub.carrier.no_active_bonuses')}
        </div>
      ) : (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {items.map((it, i) => {
            const isMiniOnly =
              it.mini > 0 && Math.abs(it.value - it.mini) < 1e-9
            return (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: TEXT_DIM,
                }}
              >
                <span style={{ color: GOLD, fontWeight: 700 }}>
                  +{fmtPct(it.value)}%
                </span>
                <span>{it.label}</span>
                {isMiniOnly && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      padding: '1px 6px',
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'rgba(253, 224, 71, 0.7)',
                      border: '1px solid rgba(253, 224, 71, 0.35)',
                      borderRadius: 4,
                    }}
                    title={t('hud.bonus.mini_hint')}
                  >
                    ·mini
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
