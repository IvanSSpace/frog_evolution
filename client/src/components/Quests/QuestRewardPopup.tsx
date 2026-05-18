// Phase 28 Plan 28-05: QuestRewardPopup — modal overlay shown on quest completion.
//
// Presentational only — controller wires eventBus + queue + provides props.
// Patterns reused from Phase 26-05 FirstContactModal (createPortal + backdrop +
// Escape) и Phase 27-05 EventToast (CSS keyframes only, no Lottie per
// memory feedback_animations).
//
// Cliclability-compliant (memory feedback_clickability):
//   - All buttons type='button' + touchAction:'manipulation'
//   - Content card uses onClick=stopPropagation чтобы tap внутри card НЕ
//     закрывал модалку через backdrop
//   - Backdrop без stopPropagation — intentional: tap на backdrop ДОЛЖЕН
//     dismiss'ить popup (parity с FirstContactModal CTA/backdrop dismiss)
//   - z-index 199 backdrop / 200 content — peer level с FirstContactModal
//
// memory feedback_frog_container_alpha — n/a (DOM-only modal в portal).

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { QUESTS } from '../../game/config/quests'
import type { QuestReward } from '../../game/config/quests'
import { RACES_BY_ID } from '../../game/config/races'
import type { RaceId } from '../../game/config/races'
import {
  DARK_CARD_STYLE,
  PINK_CTA_STYLE,
  GOLD,
  TEXT_DIM,
} from '../CosmicHub/_styles'

const AUTO_DISMISS_MS = 5000

const REWARD_ICON: Record<QuestReward['kind'], string> = {
  essence: '✨',
  serum: '💉',
  gold: '🪙',
  relationship_and_bonus: '🤝',
}

function formatGoldShort(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

/**
 * Inline reward summary helper (NOT extracted to shared utils — YAGNI, only
 * 2 call-sites planned: this popup + Plan 28-04 QuestCard.tsx). Extract когда
 * 3rd consumer появится.
 */
function rewardSummary(reward: QuestReward, t: (k: string) => string): string {
  switch (reward.kind) {
    case 'essence':
      return `${REWARD_ICON.essence} ${reward.value}`
    case 'serum':
      return `${REWARD_ICON.serum} ${reward.count} ${
        reward.element === 'random' ? '?' : reward.element
      }`
    case 'gold':
      return `${REWARD_ICON.gold} ${formatGoldShort(reward.value)}`
    case 'relationship_and_bonus': {
      const race = RACES_BY_ID[reward.raceId]
      const raceName = race ? t(race.nameKey) : reward.raceId
      return `${REWARD_ICON.relationship_and_bonus} +1 ${raceName}`
    }
  }
}

interface QuestRewardPopupProps {
  questId: string
  raceId: string
  reward: QuestReward
  onDismiss: () => void
}

export function QuestRewardPopup({
  questId,
  raceId,
  reward,
  onDismiss,
}: QuestRewardPopupProps) {
  const { t } = useTranslation()

  // Auto-dismiss timer
  useEffect(() => {
    const tid = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(tid)
  }, [onDismiss])

  // Escape key dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const cfg = QUESTS[questId]
  const race = RACES_BY_ID[raceId as RaceId]
  // Defensive: orphan completion event (config removed) — show questId as fallback
  // label so popup всё равно успешно отрисуется (mirror Plan 28-03 engine policy
  // of treating unknown questId as data drift, not a crash).
  const shortLabel = cfg ? t(cfg.short_key) : questId

  return createPortal(
    <>
      {/* CSS keyframe — mounted inline; CSSOM caches after first render.
          NO Lottie (memory feedback_animations). */}
      <style>{`
        @keyframes quest-reward-slide-in {
          0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>

      {/* Backdrop — tap dismisses. NO stopPropagation: intentional. */}
      <div
        onClick={onDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 199,
          touchAction: 'manipulation',
        }}
      />

      {/* Content card — stopPropagation prevents backdrop dismiss on inner taps */}
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-reward-popup-title"
        style={{
          position: 'fixed',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 200,
          background: '#1a2e1a',
          border: '2px solid rgba(255,255,255,0.18)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 320,
          width: 'calc(100% - 32px)',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'quest-reward-slide-in 250ms ease-out',
          touchAction: 'manipulation',
        }}
      >
        {/* Race emoji + sparkle accent */}
        <div
          style={{
            fontSize: 56,
            marginBottom: 8,
            lineHeight: 1,
          }}
        >
          {race?.emojiIcon ?? '✨'}
        </div>

        {/* Title */}
        <div
          id="quest-reward-popup-title"
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: GOLD,
            marginBottom: 8,
            textShadow: '0 1px 0 rgba(0,0,0,0.4)',
          }}
        >
          {t('cosmic_hub.quests.reward_popup_title')}
        </div>

        {/* Quest short label */}
        <div
          style={{
            fontSize: 13,
            color: TEXT_DIM,
            marginBottom: 12,
            lineHeight: 1.4,
          }}
        >
          {shortLabel}
        </div>

        {/* Reward summary */}
        <div
          style={{
            ...DARK_CARD_STYLE,
            padding: 12,
            marginBottom: 16,
            fontSize: 18,
            fontWeight: 800,
            color: '#fff',
          }}
        >
          {rewardSummary(reward, t)}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          style={{
            ...PINK_CTA_STYLE,
            width: '100%',
          }}
        >
          {t('cosmic_hub.quests.reward_popup_dismiss')}
        </button>
      </div>
    </>,
    document.body,
  )
}
