// Phase 19-05 (UX-08): tutorial step configuration.
// Static config — triggers reference cosmic state, content via i18n keys.
// Single-active-step rule: priority order first-box > first-serum > first-feed > first-stabilize.

import type { TutorialStepId } from '../../store/cosmic/types'

export interface TutorialStep {
  id: TutorialStepId
  /** i18n key prefix; expands to {prefix}.title и {prefix}.body */
  contentKey: string
  /** Priority order (lower = shown first, при collision) */
  priority: number
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'first-box', contentKey: 'tutorial.first_box', priority: 1 },
  { id: 'first-serum', contentKey: 'tutorial.first_serum', priority: 2 },
  { id: 'first-feed', contentKey: 'tutorial.first_feed', priority: 3 },
  {
    id: 'first-stabilize',
    contentKey: 'tutorial.first_stabilize',
    priority: 4,
  },
]
