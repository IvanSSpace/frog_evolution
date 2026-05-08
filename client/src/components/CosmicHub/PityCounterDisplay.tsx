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
    const dots = '●'.repeat(dotsFilled) + '○'.repeat(3 - dotsFilled)
    return (
      <div
        className="ff-body text-xs flex items-center gap-2 px-3 py-1"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          color: '#bef264',
          borderTop: '1px solid #4d7c0f',
          letterSpacing: 1,
        }}
        aria-label={t('cosmic_hub_pity.pity_growing')}
      >
        <span>{t('cosmic_hub_pity.pity_growing')}</span>
        <span style={{ letterSpacing: 3, fontSize: 14 }}>{dots}</span>
      </div>
    )
  }

  // openedCount >= 5: exact numbers
  const toRare = Math.max(0, PITY_RARE_THRESHOLD - pity.rare)
  const toEpic = Math.max(0, PITY_EPIC_THRESHOLD - pity.epic)
  const toLegendary = Math.max(0, PITY_LEGENDARY_HARD - pity.legendary)

  return (
    <div
      className="ff-body text-xs flex flex-wrap items-center gap-3 px-3 py-1"
      style={{
        background: 'rgba(0, 0, 0, 0.3)',
        color: '#bef264',
        borderTop: '1px solid #4d7c0f',
      }}
    >
      <span>{t('cosmic_hub_pity.pity_rare', { n: toRare })}</span>
      <span>{t('cosmic_hub_pity.pity_epic', { n: toEpic })}</span>
      <span style={{ color: '#fde047' }}>
        {t('cosmic_hub_pity.pity_legendary', { n: toLegendary })}
      </span>
    </div>
  )
}
