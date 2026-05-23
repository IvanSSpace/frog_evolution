// Phase 19-05 (UX-08): progressive tutorial overlay.
// - Subscribes к cosmic sentinels + tutorialState
// - Показывает только ОДИН step (наименьший priority с trigger=true & seen=false)
// - Tap CTA или background → markTutorialSeen → overlay unmount
//
// Triggers:
//   first-box        → hasOpenedAnyBox && !seenFirstBox
//   first-serum      → serumDragActive && !seenFirstSerum
//   first-feed       → hasFirstFeed && !seenFirstFeed
//   first-stabilize  → carriers.some(c => c.stabilized) && !seenFirstStabilize

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { TUTORIAL_STEPS, type TutorialStep } from './tutorialSteps'
import type { TutorialStepId } from '../../store/cosmic/types'

export function TutorialOverlay() {
  const { t } = useTranslation()

  const [starMapOpen, setStarMapOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setStarMapOpen(true)
    const onClose = () => setStarMapOpen(false)
    eventBus.on('starmap:open', onOpen)
    eventBus.on('starmap:close', onClose)
    return () => {
      eventBus.off('starmap:open', onOpen)
      eventBus.off('starmap:close', onClose)
    }
  }, [])

  const hasOpenedAnyBox = useGameStore((s) => s.hasOpenedAnyBox)
  const serumDragActive = useGameStore((s) => s.serumDragActive)
  const hasFirstFeed = useGameStore((s) => s.hasFirstFeed)
  // Phase 22: stabilize removed — hasFirstStabilize always false
  const hasFirstStabilize = false
  const tutorialState = useGameStore((s) => s.tutorialState)
  const markSeen = useGameStore((s) => s.markTutorialSeen)

  if (starMapOpen) return null

  const activeStep = pickActiveStep({
    hasOpenedAnyBox,
    serumDragActive,
    hasFirstFeed,
    hasFirstStabilize,
    tutorialState,
  })

  if (!activeStep) return null

  const titleKey = `${activeStep.contentKey}.title`
  const bodyKey = `${activeStep.contentKey}.body`

  const close = () => markSeen(activeStep.id)

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      style={{
        position: 'fixed',
        top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad))',
        bottom: '13%',
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        padding: 16,
        touchAction: 'manipulation',
      }}
      onClick={close}
    >
      <div
        style={{
          background: '#1f2937',
          border: '2px solid #7e22ce',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(126, 34, 206, 0.4)',
          padding: 16,
          maxWidth: 360,
          width: '100%',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label={t('tutorial.cta_understood')}
          style={{
            position: 'absolute',
            top: 4,
            right: 6,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 24,
            lineHeight: 1,
            cursor: 'pointer',
            padding: 8,
            touchAction: 'manipulation',
          }}
        >
          ×
        </button>
        <div
          id="tutorial-title"
          style={{
            color: '#e9d5ff',
            fontWeight: 700,
            fontSize: 16,
            marginBottom: 8,
            paddingRight: 28,
          }}
        >
          {t(titleKey)}
        </div>
        <div
          style={{
            color: '#d1d5db',
            fontSize: 14,
            lineHeight: 1.4,
            marginBottom: 12,
          }}
        >
          {t(bodyKey)}
        </div>
        <button
          type="button"
          onClick={close}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(180deg, #4ade80 0%, #16a34a 100%)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          {t('tutorial.cta_understood')}
        </button>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

interface PickArgs {
  hasOpenedAnyBox: boolean
  serumDragActive: boolean
  hasFirstFeed: boolean
  hasFirstStabilize: boolean
  tutorialState: {
    seenFirstBox: boolean
    seenFirstSerum: boolean
    seenFirstFeed: boolean
    seenFirstStabilize: boolean
  }
}

function pickActiveStep(a: PickArgs): TutorialStep | null {
  const conditions: Record<TutorialStepId, boolean> = {
    'first-box': a.hasOpenedAnyBox && !a.tutorialState.seenFirstBox,
    'first-serum': a.serumDragActive && !a.tutorialState.seenFirstSerum,
    'first-feed': a.hasFirstFeed && !a.tutorialState.seenFirstFeed,
    'first-stabilize':
      a.hasFirstStabilize && !a.tutorialState.seenFirstStabilize,
  }
  for (const step of TUTORIAL_STEPS) {
    if (conditions[step.id]) return step
  }
  return null
}
