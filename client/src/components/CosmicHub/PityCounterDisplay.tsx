// Phase 25-03: PityCounterDisplay dark footer + pink progress gradient
// Phase 19-03 (UX-01): progressive pity counter footer.
// Mounted в CosmicHubModal footer (видно во всех табах).
// Reveal rules (UX research 5.1-5.2):
//   openedCount < 3 → HIDDEN
//   3 ≤ openedCount < 5 → DotIndicator (3 dots, partial fill)
//   openedCount ≥ 5 → exact numbers «До rare: N», «До epic: N», «До legendary: N»

import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'

const PITY_RARE_THRESHOLD = 3
const PITY_EPIC_THRESHOLD = 10
const PITY_LEGENDARY_HARD = 25

const FOOTER_CONTAINER_STYLE: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.4)',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  color: '#d4d4d8',
  padding: '8px 16px',
  letterSpacing: 0.5,
}

export function PityCounterDisplay() {
  const { t } = useTranslation()
  const pity = useGameStore((s) => s.pityCounters)
  const openedCount = useGameStore(
    (s) => s.boxes.filter((b) => b.opened).length,
  )

  if (openedCount < 3) return null

  if (openedCount < 5) {
    // Dot indicator (3 dots filled per progress to hard pity 25).
    // legendary 0-8 → 0 dots; 9-16 → 1; 17-24 → 2; 25 → 3.
    const dotsFilled = Math.min(3, Math.floor(pity.legendary / 9))
    return (
      <div
        className="ff-body text-xs flex items-center gap-2"
        style={FOOTER_CONTAINER_STYLE}
        aria-label={t('cosmic_hub_pity.pity_growing')}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#d4d4d8' }}>
          {t('cosmic_hub_pity.pity_growing')}
        </span>
        <div
          className="flex items-center"
          style={{ gap: 4 }}
          aria-hidden
        >
          {[0, 1, 2].map((i) => {
            const filled = i < dotsFilled
            return (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: filled
                    ? '#ec4899'
                    : 'rgba(255,255,255,0.15)',
                  boxShadow: filled
                    ? '0 0 6px rgba(236,72,153,0.6)'
                    : 'inset 0 1px 0 rgba(0,0,0,0.3)',
                  display: 'inline-block',
                }}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // openedCount >= 5: exact numbers + pink progress bar to legendary hard cap.
  const toRare = Math.max(0, PITY_RARE_THRESHOLD - pity.rare)
  const toEpic = Math.max(0, PITY_EPIC_THRESHOLD - pity.epic)
  const toLegendary = Math.max(0, PITY_LEGENDARY_HARD - pity.legendary)
  const legendaryPercent = Math.max(
    0,
    Math.min(100, (pity.legendary / PITY_LEGENDARY_HARD) * 100),
  )

  return (
    <div
      className="ff-body text-xs flex flex-col"
      style={{ ...FOOTER_CONTAINER_STYLE, gap: 4 }}
    >
      <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
        <span style={{ color: '#d4d4d8', fontWeight: 600 }}>
          {t('cosmic_hub_pity.pity_rare', { n: toRare })}
        </span>
        <span style={{ color: '#d4d4d8', fontWeight: 600 }}>
          {t('cosmic_hub_pity.pity_epic', { n: toEpic })}
        </span>
        <span
          style={{
            color: '#ec4899',
            fontWeight: 800,
            fontSize: 12,
            textShadow: '0 1px 0 rgba(0,0,0,0.4)',
          }}
        >
          {t('cosmic_hub_pity.pity_legendary', { n: toLegendary })}
        </span>
      </div>
      {/* Pink progress bar — legendary pity track */}
      <div
        aria-hidden
        style={{
          flex: 1,
          height: 4,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${legendaryPercent}%`,
            background:
              'linear-gradient(90deg, #f9a8d4 0%, #ec4899 100%)',
            borderRadius: 999,
            transition: 'width 300ms ease-out',
            boxShadow: '0 0 6px rgba(236,72,153,0.5)',
          }}
        />
      </div>
    </div>
  )
}
