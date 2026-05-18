// Phase 26 Plan 26-05 — First contact DOM modal.
//
// Mount lifecycle: controller (Task 3) mount'ит модалку с raceId prop при
// получении 'cosmos:first-contact-effect-complete' event. После CTA / backdrop
// click → fade-out 300ms → markFirstContactSeen(raceId) → onClose → modal unmount.
//
// Reuse design: WelcomeModal centered card pattern + Phase 25 dark theme.
//   - createPortal к document.body (above Phaser canvas)
//   - backdrop rgba(0,0,0,0.6) + blur (CSS backdropFilter)
//   - dark card #1a2e1a + 2px white-15% border (Phase 23 design language)
//   - pink CTA (PINK #ec4899 token) + width:auto не stretch
//   - aria-modal, aria-labelledby для a11y
//   - exit fade-out 300ms перед unmount
//
// Cliclability checklist (memory feedback_clickability):
//   - z-index 200 (above HUD 50 / existing modals 100)
//   - backdrop click closes (D-Cliclability в CONTEXT: narrative, не critical
//     decision — закрытие clic'ом по backdrop intentional)
//   - inner card stopPropagation чтобы tap внутри card НЕ закрывал
//   - CTA button type=button + touchAction: manipulation
//
// memory feedback_frog_container_alpha — n/a здесь: modal в DOM portal,
// никак не trogает Phaser frog.container.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { RACES_BY_ID, type RaceId } from '../../game/config/races'
import { PINK, GOLD } from '../CosmicHub/_styles'

const FADE_OUT_MS = 300

export interface FirstContactModalProps {
  raceId: RaceId
  onClose: () => void
}

export function FirstContactModal({ raceId, onClose }: FirstContactModalProps) {
  const { t } = useTranslation()
  const markSeen = useGameStore((s) => s.markFirstContactSeen)
  const [exiting, setExiting] = useState(false)
  const race = RACES_BY_ID[raceId]

  // Defensive: invalid raceId (T-26-05-01 mitigation). useEffect ДО early-return,
  // чтобы соблюсти React rules-of-hooks. Auto-close без mark если race === undefined.
  useEffect(() => {
    if (!race) onClose()
  }, [race, onClose])

  if (!race) return null

  const handleClose = () => {
    if (exiting) return
    setExiting(true)
    window.setTimeout(() => {
      // markSeen ПОСЛЕ fade-out (не до) — гарантирует state mutation не
      // unmount'ит modal до завершения анимации (T-26-05-03 partial mitigation —
      // если user force-close до timer, mark не произойдёт; acceptable для
      // narrative event без gameplay impact).
      markSeen(raceId)
      onClose()
    }, FADE_OUT_MS)
  }

  const raceName = t(race.nameKey)
  const loreShort = t(race.loreShortKey)
  const personality = t(race.personalityKey)
  const homeColorHex = '#' + race.homeColor.toString(16).padStart(6, '0')

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-contact-title"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        touchAction: 'manipulation',
        opacity: exiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 340,
          maxHeight: 'calc(100vh - 64px)',
          padding: '24px 20px 22px',
          borderRadius: 16,
          background: '#1a2e1a',
          border: '2px solid rgba(255,255,255,0.15)',
          textAlign: 'center',
          boxSizing: 'border-box',
          overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Title */}
        <div
          id="first-contact-title"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: GOLD,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 12,
            textShadow: '0 1px 0 rgba(0,0,0,0.4)',
          }}
        >
          {t('cosmos.first_contact.title')}
        </div>

        {/* Race emoji big — drop-shadow от race.homeColor (visual race identity hook) */}
        <div
          style={{
            fontSize: 56,
            lineHeight: 1,
            marginBottom: 12,
            filter: `drop-shadow(0 0 16px ${homeColorHex})`,
          }}
        >
          {race.emojiIcon}
        </div>

        {/* Race name */}
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.2,
            marginBottom: 6,
          }}
        >
          {raceName}
        </h2>

        {/* Personality keywords — italic, distinguishes от lore body */}
        <div
          style={{
            fontSize: 12,
            fontStyle: 'italic',
            color: '#d4d4d8',
            marginBottom: 12,
          }}
        >
          {personality}
        </div>

        {/* Lore short — body text, left-aligned для readability */}
        <p
          style={{
            margin: 0,
            marginBottom: 18,
            fontSize: 14,
            fontWeight: 400,
            color: '#e4e4e7',
            lineHeight: 1.5,
            textAlign: 'left',
          }}
        >
          {loreShort}
        </p>

        {/* CTA */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              display: 'inline-block',
              width: 'auto',
              minWidth: 140,
              background: PINK,
              borderRadius: 12,
              padding: '10px 24px',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              border: 'none',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {t('cosmos.first_contact.cta')}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
