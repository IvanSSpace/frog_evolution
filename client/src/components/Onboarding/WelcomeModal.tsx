// Phase 23 Plan 23-02 — Beat 1: Welcome modal.
//
// REWRITE 2026-05-18: hard-capped dimensions, no flex stretch, no full-width CTA.
// User reported PINK на весь экран — CTA button с width:100% растягивался в
// каком-то edge case. Теперь width: auto + max-width + display: inline-block.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'
import { useModalLock } from '../../utils/modalLock'
import './welcomeModal.css'

const FADE_OUT_MS = 400

export function WelcomeModal() {
  useModalLock()
  const { t } = useTranslation()
  const markSeen = useOnboardingStore((s) => s.markWelcomeSeen)
  const [exiting, setExiting] = useState(false)

  const handleCta = () => {
    if (exiting) return
    setExiting(true)
    window.setTimeout(() => {
      markSeen()
    }, FADE_OUT_MS)
  }

  const node = (
    <div
      className={`onb-welcome-backdrop ff-backdrop${exiting ? ' is-exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onb-welcome-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        touchAction: 'manipulation',
        pointerEvents: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop relative"
        style={{
          width: '100%',
          maxWidth: 340,
          maxHeight: 'calc(100vh - 64px)',
          padding: '24px 20px 20px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <h1
          id="onb-welcome-title"
          className="ff-display ff-stroke-white text-3xl"
          style={{
            margin: 0,
            color: '#15803d',
            letterSpacing: 1.5,
            lineHeight: 1.15,
          }}
        >
          {t('onboarding.welcome.title')}
        </h1>

        <p
          className="ff-body font-bold"
          style={{
            marginTop: 12,
            marginBottom: 14,
            fontSize: 14,
            color: '#166534',
            lineHeight: 1.4,
          }}
        >
          {t('onboarding.welcome.subtitle')}
        </p>

        {/* Frog tile — cream ff-card pattern с bob-анимацией */}
        <div
          className="ff-card onb-welcome-frog"
          style={{
            margin: '6px auto 16px',
            width: 96,
            height: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 6,
          }}
        >
          <svg viewBox="0 0 100 100" width="76" height="76">
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

        {/* CTA — chunky 3D green button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className="ff-btn ff-btn-green ff-display"
            onClick={handleCta}
            style={{
              minWidth: 180,
              maxWidth: '100%',
              padding: '12px 32px',
              fontSize: 18,
              letterSpacing: 0.5,
              touchAction: 'manipulation',
            }}
          >
            {t('onboarding.welcome.cta')}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
