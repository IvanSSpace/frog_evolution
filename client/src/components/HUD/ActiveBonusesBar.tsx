// Phase 22 Plan 22-04: HUD строка активных archetype bonuses.
//
// Показывает СУММУ full (ascended) + mini (carriers на поле) per bonus key.
// - Mini-only бонусы (нет ascended той же категории) получают `·mini` бэйдж — teaser.
// - Когда появляется ascended той же категории — mini растворяется в общую сумму,
//   бэйдж снимается (визуальный сигнал «бонус полностью раскрыт»).
// - Реактивен к ascendedCarriers И carriers (Zustand selectors).
// - Bar скрыт когда нет активных бонусов (empty pool).
// - Click → tooltip с per-category breakdown (mini section + full section).
//
// State paths note: cosmic slice plain-spread в useGameStore — обращение `s.ascendedCarriers`,
// `s.carriers` (НЕ `s.cosmic.X` — таких ключей нет).

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import {
  aggregateFullBonuses,
  aggregateMiniBonuses,
} from '../../utils/archetypeBonuses'
import { ActiveBonusesTooltip } from './ActiveBonusesTooltip'
import styles from './ActiveBonusesBar.module.css'
// Phase 22 Plan 22-06: defensive cosmos gate (на pre-cosmos ascensions всё равно
// быть не может, но bar hide-ится явно).
import { useCosmosUnlocked } from '../../utils/cosmosGate'

function fmtPct(v: number): string {
  // 0.055 → "5.5", 0.05 → "5", 0.001 → "0.1"
  const pct = v * 100
  return pct.toFixed(1).replace(/\.0$/, '')
}

export function ActiveBonusesBar() {
  const { t } = useTranslation()
  const unlocked = useCosmosUnlocked()
  const ascended = useGameStore((s) => s.ascendedCarriers)
  const carriers = useGameStore((s) => s.carriers)
  const [open, setOpen] = useState(false)

  const fullBonuses = useMemo(() => aggregateFullBonuses(ascended), [ascended])
  const miniBonuses = useMemo(() => aggregateMiniBonuses(carriers), [carriers])

  // Сумма full + mini per bonus key
  const total = {
    boxDropSpeed: fullBonuses.boxDropSpeed + miniBonuses.boxDropSpeed,
    tractorGold: fullBonuses.tractorGold + miniBonuses.tractorGold,
    offlineCap: fullBonuses.offlineCap + miniBonuses.offlineCap,
    serumDrop: fullBonuses.serumDrop + miniBonuses.serumDrop,
    flatGold: fullBonuses.flatGold + miniBonuses.flatGold,
  }

  // mini=value означает «весь бонус сейчас приходит из mini» → показать ·mini badge
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

  if (!unlocked) return null // Phase 22 Plan 22-06: cosmos gate
  if (items.length === 0) return null // hide когда нет бонусов

  return (
    <>
      <button
        type="button"
        className={styles.bar}
        onClick={() => setOpen((o) => !o)}
        aria-label={t('hud.bonus.aria_open')}
      >
        {items.map((it, i) => (
          <span key={i} className={styles.item}>
            +{fmtPct(it.value)}% {it.label}
            {it.mini > 0 && Math.abs(it.value - it.mini) < 1e-9 && (
              <span
                className={styles.miniBadge}
                title={t('hud.bonus.mini_hint')}
              >
                ·mini
              </span>
            )}
          </span>
        ))}
      </button>
      {open && <ActiveBonusesTooltip onClose={() => setOpen(false)} />}
    </>
  )
}
