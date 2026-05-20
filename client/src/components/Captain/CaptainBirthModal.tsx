// Phase 24 Plan 24-03 — Captain Birth modal (Beat 3).
//
// Self-mounting modal. Subscribes к eventBus 'captain:birth-effect-complete'
// (emit'ит Plan 24-02 Phaser cinematic). Render:
//   - Centered card via flex
//   - Inline L1 frog SVG (120x120) с CSS pulse + gold drop-shadow
//   - Gold title + светло-серый subtitle + pink CTA
// Dismiss:
//   - CTA tap ИЛИ backdrop click → fade-out 400ms → emit 'captain:birth-cta' →
//     unmount. Plan 24-04 hook слушает 'captain:birth-cta' для Beat 4 (spawn L1)
//     + Beat 5 (starmap:open).
//
// Cliclability checklist (memory feedback_clickability):
//   - button type="button"
//   - z-index 200 (above HUD)
//   - backdrop click dismisses
//   - stopPropagation на inner card
//   - touchAction: manipulation
//
// IMPORTANT: НЕ Lottie (CSS keyframes only, memory feedback_animations).
// НЕ tween frog.container.alpha (memory feedback_frog_container_alpha — n/a здесь,
// это DOM SVG, отдельная сущность от Phaser).

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { eventBus } from '../../store/eventBus'
import { useModalLock } from '../../utils/modalLock'
import './captainBirthModal.css'

const FADE_OUT_MS = 400

export function CaptainBirthModal() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  useModalLock(visible)

  useEffect(() => {
    const onComplete = () => {
      setVisible(true)
      setExiting(false)
    }
    eventBus.on('captain:birth-effect-complete', onComplete)
    return () => {
      eventBus.off('captain:birth-effect-complete', onComplete)
    }
  }, [])

  if (!visible) return null

  const handleDismiss = () => {
    if (exiting) return
    setExiting(true)
    window.setTimeout(() => {
      setVisible(false)
      setExiting(false)
      eventBus.emit('captain:birth-cta')
    }, FADE_OUT_MS)
  }

  const node = (
    <div
      className={`captain-birth-backdrop${exiting ? ' is-exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="captain-birth-title"
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background:
          'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 70%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        touchAction: 'manipulation',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 320,
          maxHeight: 'calc(100vh - 64px)',
          padding: '28px 20px 22px',
          borderRadius: 16,
          background: '#1a2e1a',
          border: '2px solid rgba(255,255,255,0.15)',
          textAlign: 'center',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* L1 frog — inline SVG (как WelcomeModal). 120x120 с pulse + glow. */}
        <div
          className="captain-birth-frog"
          style={{
            margin: '4px auto 18px',
            width: 120,
            height: 120,
            display: 'block',
          }}
        >
          <svg viewBox="0 0 100 100" width="120" height="120">
            <ellipse cx="50" cy="60" rx="34" ry="28" fill="#65a30d" />
            <ellipse cx="50" cy="58" rx="28" ry="20" fill="#a3e635" />
            <circle cx="36" cy="36" r="12" fill="#65a30d" />
            <circle cx="64" cy="36" r="12" fill="#65a30d" />
            <circle cx="36" cy="36" r="9" fill="#fff" />
            <circle cx="64" cy="36" r="9" fill="#fff" />
            <circle cx="38" cy="38" r="5" fill="#000" />
            <circle cx="66" cy="38" r="5" fill="#000" />
            <path
              d="M 38 64 Q 50 74 62 64"
              stroke="#365314"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1
          id="captain-birth-title"
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 900,
            color: '#fde047',
            lineHeight: 1.15,
            textShadow: '0 2px 12px rgba(253, 224, 71, 0.4)',
          }}
        >
          {t('captain.birth.title')}
        </h1>

        <p
          style={{
            marginTop: 12,
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 500,
            color: '#d4d4d8',
            lineHeight: 1.4,
          }}
        >
          {t('captain.birth.subtitle')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              display: 'inline-block',
              width: 'auto',
              minWidth: 200,
              maxWidth: '100%',
              background: '#ec4899',
              borderRadius: 12,
              padding: '14px 32px',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              border: 'none',
              cursor: 'pointer',
              touchAction: 'manipulation',
              boxSizing: 'border-box',
            }}
          >
            {t('captain.birth.cta')}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
