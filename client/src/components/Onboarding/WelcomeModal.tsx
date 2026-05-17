// Phase 23 Plan 23-02 — Beat 1: Welcome modal.
//
// REWRITE 2026-05-18: hard-capped dimensions, no flex stretch, no full-width CTA.
// User reported PINK на весь экран — CTA button с width:100% растягивался в
// каком-то edge case. Теперь width: auto + max-width + display: inline-block.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'
import './welcomeModal.css'

const FADE_OUT_MS = 400

export function WelcomeModal() {
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
      className={`onb-welcome-backdrop${exiting ? ' is-exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onb-welcome-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        touchAction: 'manipulation',
      }}
    >
      {/* Modal card — hard width/height caps + no flex stretch */}
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
        <h1
          id="onb-welcome-title"
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            color: '#fde68a',
            lineHeight: 1.15,
          }}
        >
          {t('onboarding.welcome.title')}
        </h1>

        <p
          style={{
            marginTop: 10,
            marginBottom: 16,
            fontSize: 14,
            fontWeight: 500,
            color: '#d4d4d8',
            lineHeight: 1.4,
          }}
        >
          {t('onboarding.welcome.subtitle')}
        </p>

        <div
          className="onb-welcome-frog"
          style={{
            margin: '4px auto 16px',
            width: 72,
            height: 72,
            display: 'block',
          }}
        >
          <svg viewBox="0 0 100 100" width="72" height="72">
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

        {/* CTA wrapper — flex centers button без stretching */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className="onb-welcome-cta"
            onClick={handleCta}
            style={{
              // ВАЖНО: width: auto + display: inline-block чтобы button НЕ
              // растягивался на 100% родителя. Раньше user видел pink fullscreen
              // когда CTA как-то стретчился — теперь width derived from content.
              display: 'inline-block',
              width: 'auto',
              minWidth: 160,
              maxWidth: '100%',
              background: '#ec4899',
              borderRadius: 12,
              padding: '12px 28px',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              border: 'none',
              cursor: 'pointer',
              touchAction: 'manipulation',
              boxSizing: 'border-box',
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
