// Phase 23 Plan 23-02 — Beat 1: Welcome modal.
//
// Single-action modal: появляется при первом запуске (welcomeSeen=false),
// закрывается ИСКЛЮЧИТЕЛЬНО через CTA «Начать». Backdrop click игнорируется
// (это первый и единственный blocking step в onboarding — у игрока должен быть
// один очевидный путь дальше).
//
// Visual language:
//   - Pastel gradient bg (lake-blue → swamp-green) — связь с миром локаций
//   - Inline L1 frog SVG (bobbing animation) — символ героя игры
//   - Pink CTA gradient (#f9a8d4 → #ec4899) — reuse от LocationStack
//
// Cliclability checklist (memory feedback_clickability):
//   - <button type="button"> ✓
//   - z-index 100 (выше Phaser canvas и LocationStack) ✓
//   - touchAction: 'manipulation' (no 300ms tap delay on mobile) ✓
//   - Backdrop intentionally без onClick (single-action) ✓
//   - Inner modal stopPropagation чтобы будущие изменения backdrop не ломали клик ✓
//
// Animation (memory feedback_animations):
//   - CSS keyframes, не Lottie
//   - Frog bob — DOM SVG, отдельная сущность от Phaser frog.container,
//     никакого риска mерцания (memory feedback_frog_container_alpha n/a)
//
// Render path: createPortal → document.body, чтобы overlay был вне React tree
// LocationStack/Phaser host и не наследовал их transform/z-index quirks.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'
import './welcomeModal.css'

// Delay чтобы fade-out animation успела отыграть до unmount.
// Совпадает с длительностью @keyframes onb-welcome-fade-out (400ms).
const FADE_OUT_MS = 400

export function WelcomeModal() {
  const { t } = useTranslation()
  const markSeen = useOnboardingStore((s) => s.markWelcomeSeen)
  const [exiting, setExiting] = useState(false)

  const handleCta = () => {
    if (exiting) return // двойной тап guard
    setExiting(true)
    // markSeen() триггерит re-render OnboardingController → unmount WelcomeModal.
    // Откладываем до конца fade-out, иначе пользователь увидит резкое исчезновение.
    window.setTimeout(() => {
      markSeen()
    }, FADE_OUT_MS)
  }

  // Backdrop intentionally без onClick — single-action UX.

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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 320,
          width: '100%',
          padding: '32px 24px 24px',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #bae6fd 0%, #bef264 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.45), 0 8px 20px rgba(0,0,0,0.35)',
          border: '2px solid rgba(255,255,255,0.6)',
          textAlign: 'center',
        }}
      >
        <h1
          id="onb-welcome-title"
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 900,
            color: '#0c4a6e',
            textShadow: '0 1px 0 rgba(255,255,255,0.6)',
            lineHeight: 1.1,
          }}
        >
          {t('onboarding.welcome.title')}
        </h1>

        <p
          style={{
            marginTop: 8,
            marginBottom: 16,
            fontSize: 14,
            fontWeight: 600,
            color: '#365314',
            lineHeight: 1.4,
          }}
        >
          {t('onboarding.welcome.subtitle')}
        </p>

        {/*
         * Inline SVG для нулевых external asset deps (быстрый mount, нет
         * flash-of-no-image). Plan 23-06 может заменить на existing frog
         * asset когда визуальный язык frog assets окончательно устаканится.
         */}
        <div
          className="onb-welcome-frog"
          style={{ margin: '8px auto 20px', width: 96, height: 96 }}
        >
          <svg viewBox="0 0 100 100" width="96" height="96">
            {/* Body */}
            <ellipse cx="50" cy="60" rx="34" ry="28" fill="#65a30d" />
            <ellipse cx="50" cy="58" rx="28" ry="20" fill="#a3e635" />
            {/* Eyes */}
            <circle cx="36" cy="36" r="12" fill="#65a30d" />
            <circle cx="64" cy="36" r="12" fill="#65a30d" />
            <circle cx="36" cy="36" r="9" fill="#fff" />
            <circle cx="64" cy="36" r="9" fill="#fff" />
            <circle cx="38" cy="38" r="5" fill="#000" />
            <circle cx="66" cy="38" r="5" fill="#000" />
            {/* Smile */}
            <path
              d="M 38 64 Q 50 74 62 64"
              stroke="#365314"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <button
          type="button"
          className="onb-welcome-cta"
          onClick={handleCta}
          style={{
            background: 'linear-gradient(180deg, #f9a8d4, #ec4899)',
            borderRadius: 999,
            padding: '14px 36px',
            color: '#fff',
            fontWeight: 900,
            fontSize: 18,
            textShadow: '0 1px 0 rgba(0,0,0,0.4)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 0 rgba(0,0,0,0.3)',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            touchAction: 'manipulation',
          }}
        >
          {t('onboarding.welcome.cta')}
        </button>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
