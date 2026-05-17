// Phase 22 Plan 22-04: tooltip с детализацией активных archetype bonuses.
//
// Две секции:
//   - MINI (carrier'ы на поле) — список уникальных категорий + соответствующий mini bonus.
//   - FULL (ascended) — per-category aggregation + per-carrier list (element + дата ascension).
//
// Cliclability (memory feedback_clickability):
//   - Backdrop onClick → close
//   - Inner card onClick → stopPropagation (клик внутри не закрывает)
//   - Close button type="button"
//   - z-index 100 — выше bar (50)
//
// Стили — inline (демо-build), CSS-only анимаций нет (memory feedback_animations).

import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import {
  ELEMENT_TO_CATEGORY,
  BONUS_PER_CATEGORY,
  MINI_BONUS_PER_CATEGORY,
  type ArchetypeCategory,
} from '../../utils/archetypeBonuses'
import type { AscendedCarrier } from '../../store/cosmic/types'

interface Props {
  onClose: () => void
}

function fmtPct(v: number): string {
  return (v * 100).toFixed(1).replace(/\.0$/, '')
}

export function ActiveBonusesTooltip({ onClose }: Props) {
  const { t } = useTranslation()
  const ascended = useGameStore((s) => s.ascendedCarriers)
  const carriers = useGameStore((s) => s.carriers)
  const essence = useGameStore((s) => s.essence)

  // FULL — group ascended by category
  const grouped = new Map<ArchetypeCategory, AscendedCarrier[]>()
  for (const a of ascended) {
    const cat = ELEMENT_TO_CATEGORY[a.element]
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(a)
  }

  // MINI — unique categories present on field
  const miniCategories = new Set<ArchetypeCategory>()
  for (const c of carriers) miniCategories.add(ELEMENT_TO_CATEGORY[c.element])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 48,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a2e',
          color: '#fff',
          padding: 16,
          borderRadius: 8,
          maxWidth: 360,
          width: '90vw',
          maxHeight: '70vh',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>
          {t('hud.bonus.tooltip_title')}
        </h3>
        <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 12px 0' }}>
          {t('hud.bonus.essence')}: {essence}
        </p>

        {/* MINI section — teaser bonus от carriers на поле */}
        {miniCategories.size > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: 8,
              background: 'rgba(251,191,36,0.08)',
              borderRadius: 4,
            }}
          >
            <strong style={{ fontSize: 11, color: '#fbbf24' }}>
              {t('hud.bonus.mini_section_title')}
            </strong>
            <p style={{ margin: '4px 0 6px 0', fontSize: 10, opacity: 0.7 }}>
              {t('hud.bonus.mini_hint')}
            </p>
            {Array.from(miniCategories).map((cat) => {
              const mini = MINI_BONUS_PER_CATEGORY[cat]
              return (
                <div key={cat} style={{ fontSize: 11, marginLeft: 8 }}>
                  · {t(`hud.bonus.category.${cat}`)} +{fmtPct(mini.amount)}%{' '}
                  {t(`hud.bonus.${mini.key}`)}
                </div>
              )
            })}
          </div>
        )}

        {/* FULL section header — показывается только если есть ascended */}
        {grouped.size > 0 && (
          <div style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 11 }}>
              {t('hud.bonus.full_section_title')}
            </strong>
          </div>
        )}
        {Array.from(grouped.entries()).map(([cat, items]) => {
          const bonus = BONUS_PER_CATEGORY[cat]
          const totalPct = items.length * bonus.amount * 100
          return (
            <div key={cat} style={{ marginBottom: 8 }}>
              <strong>{t(`hud.bonus.category.${cat}`)}</strong> × {items.length}{' '}
              (+{totalPct.toFixed(1).replace(/\.0$/, '')}%{' '}
              {t(`hud.bonus.${bonus.key}`)})
              <ul
                style={{
                  margin: '4px 0 0 16px',
                  padding: 0,
                  fontSize: 11,
                  listStyle: 'disc',
                }}
              >
                {items.map((a) => (
                  <li key={a.id}>
                    {a.element} —{' '}
                    {new Date(a.ascendedAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 12,
            padding: '6px 16px',
            cursor: 'pointer',
            background: '#374151',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          {t('hud.bonus.close')}
        </button>
      </div>
    </div>
  )
}
