// Phase 26 Plan 26-04: read-only inventory single-view.
// Sections: currencies, serums (16-element grid), artifacts placeholder,
//           race relationships placeholder (10 rows с '?' values).
// Reuse Phase 25 _styles.ts design tokens.
// Cliclability: tab активируется через CosmicHubModal tab strip; внутри
// нет интерактивных elements кроме scroll — read-only display.
//
// Race relationships placeholder заполнится в Phase 29 (см. CONTEXT D-Relationships).
// Artifacts placeholder заполнится в Phase 27+.

import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import { RACES } from '../../game/config/races'
import { ELEMENT_TINTS } from '../../game/effects/elements/elementTints'
import {
  DARK_CARD_STYLE,
  SECTION_HEADER_STYLE,
  MINI_BADGE_STYLE,
  GOLD,
  PINK,
  TEXT_DIM,
  TEXT_VERY_DIM,
  EMPTY_STATE_TEXT_STYLE,
} from './_styles'

// Element emoji mapping — placeholder visual для inventory grid.
// Локальная константа (НЕ дублируется с ElementGrid.ELEMENT_TINT который filter-based).
// Если в будущем понадобится shared elementEmoji utility — extract в game/effects/elements/.
const ELEMENT_EMOJI: Record<Element, string> = {
  fire: '🔥',
  ice: '❄️',
  water: '💧',
  forest: '🌲',
  toxic: '☠️',
  plasma: '⚡',
  shadow: '🌑',
  crystal: '💎',
  desert: '🏜️',
  gas: '☁️',
  ring: '💍',
  binary: '🪐',
  arcane: '🔮',
  mechanical: '⚙️',
  war: '⚔️',
  void: '🕳️',
}

// Convert Phaser hex (0xRRGGBB) → CSS '#rrggbb'.
function hexToCss(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0')
}

export function InventoryTab() {
  const { t } = useTranslation()

  // Granular Zustand selectors — fine-grain re-render (T-26-04-01 mitigation).
  // gold НЕ coins (store field name); Plan описывал `coins` но реальное поле `gold`
  // (Rule 3 — plan name correction).
  const essence = useGameStore((s) => s.essence)
  const gold = useGameStore((s) => s.gold)
  const serums = useGameStore((s) => s.serums)

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      {/* ─── ВАЛЮТЫ ─── */}
      <section style={{ marginBottom: 16 }}>
        <h3 style={SECTION_HEADER_STYLE}>
          {t('cosmic_hub.inventory.section_currencies')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CurrencyRow
            icon="💎"
            label={t('cosmic_hub.inventory.currency_essence')}
            value={essence}
            valueColor={PINK}
          />
          <CurrencyRow
            icon="💩"
            label={t('cosmic_hub.inventory.currency_gold')}
            value={gold}
            valueColor={GOLD}
          />
        </div>
      </section>

      {/* ─── СЫВОРОТКИ ─── */}
      <section style={{ marginBottom: 16 }}>
        <h3 style={SECTION_HEADER_STYLE}>
          {t('cosmic_hub.inventory.section_serums')}
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}
        >
          {ELEMENTS.map((el) => {
            // T-26-04-03 mitigation: defensive nullish coalesce per-cell.
            const count = serums[el] ?? 0
            const tintHex = hexToCss(ELEMENT_TINTS[el])
            return (
              <div
                key={el}
                style={{
                  ...DARK_CARD_STYLE,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: 8,
                  borderColor: count > 0 ? tintHex : 'rgba(255,255,255,0.1)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  opacity: count > 0 ? 1 : 0.5,
                }}
                title={t(`cosmic_hub.elements.${el}`)}
              >
                <span style={{ fontSize: 20 }}>{ELEMENT_EMOJI[el]}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: count > 0 ? '#fff' : TEXT_VERY_DIM,
                  }}
                >
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── АРТЕФАКТЫ (placeholder Phase 27+) ─── */}
      <section style={{ marginBottom: 16 }}>
        <h3 style={SECTION_HEADER_STYLE}>
          {t('cosmic_hub.inventory.section_artifacts')}
        </h3>
        <div style={{ ...DARK_CARD_STYLE, padding: 16 }}>
          <div style={EMPTY_STATE_TEXT_STYLE}>
            {t('cosmic_hub.inventory.placeholder_artifacts')}
          </div>
        </div>
      </section>

      {/* ─── ОТНОШЕНИЯ С РАСАМИ (placeholder Phase 29) ─── */}
      <section style={{ marginBottom: 16 }}>
        <h3 style={SECTION_HEADER_STYLE}>
          {t('cosmic_hub.inventory.section_relationships')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {RACES.map((race) => (
            <div
              key={race.id}
              style={{
                ...DARK_CARD_STYLE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
              }}
              title={t('cosmic_hub.inventory.tooltip_relationship_pending')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{race.emojiIcon}</span>
                <span style={{ fontSize: 13, color: TEXT_DIM }}>
                  {t(race.nameKey)}
                </span>
              </span>
              <span style={{ ...MINI_BADGE_STYLE, color: TEXT_VERY_DIM }}>
                {t('cosmic_hub.inventory.placeholder_relationship_value')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

interface CurrencyRowProps {
  icon: string
  label: string
  value: number
  valueColor: string
}

function CurrencyRow({ icon, label, value, valueColor }: CurrencyRowProps) {
  return (
    <div
      style={{
        ...DARK_CARD_STYLE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ fontSize: 14, color: TEXT_DIM }}>{label}</span>
      </span>
      <span style={{ fontSize: 16, fontWeight: 800, color: valueColor }}>
        {Math.floor(value).toLocaleString('ru-RU')}
      </span>
    </div>
  )
}
