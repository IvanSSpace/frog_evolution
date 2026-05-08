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

import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { TUTORIAL_STEPS, type TutorialStep } from './tutorialSteps'
import type { TutorialStepId } from '../../store/cosmic/types'

export function TutorialOverlay() {
  const { t } = useTranslation()

  // Sentinel флаги
  const hasOpenedAnyBox = useGameStore((s) => s.hasOpenedAnyBox)
  const serumDragActive = useGameStore((s) => s.serumDragActive)
  const hasFirstFeed = useGameStore((s) => s.hasFirstFeed)
  const hasFirstStabilize = useGameStore((s) =>
    s.carriers.some((c) => c.stabilized),
  )

  // Seen flags
  const tutorialState = useGameStore((s) => s.tutorialState)

  const markSeen = useGameStore((s) => s.markTutorialSeen)

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

  return (
    <div
      className="ff-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        padding: 16,
      }}
      onClick={() => markSeen(activeStep.id)}
    >
      <div
        className="ff-card p-4 max-w-sm"
        style={{
          background: '#1f2937',
          border: '2px solid #7e22ce',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(126, 34, 206, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="tutorial-title"
          className="ff-display text-base font-bold mb-2"
          style={{ color: '#e9d5ff' }}
        >
          {t(titleKey)}
        </div>
        <div
          className="ff-body text-sm leading-snug mb-3"
          style={{ color: '#d1d5db' }}
        >
          {t(bodyKey)}
        </div>
        <button
          onClick={() => markSeen(activeStep.id)}
          className="ff-btn ff-btn-green text-sm w-full"
        >
          {t('tutorial.cta_understood')}
        </button>
      </div>
    </div>
  )
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
  // Priority order (TUTORIAL_STEPS уже sorted by priority).
  for (const step of TUTORIAL_STEPS) {
    if (conditions[step.id]) return step
  }
  return null
}
