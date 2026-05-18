// Phase 28 Plan 28-04: QuestCard — per-active-quest card.
//
// DOM-only (no Phaser). Reuses Phase 25 _styles.ts design tokens.
// NO Lottie (memory feedback_animations) — progress bar uses CSS transition.
//
// Cliclability checklist (memory feedback_clickability):
//   - 3 buttons (open-confirm / accept-cancel / dismiss-confirm): type="button"
//     + touchAction:'manipulation' + stopPropagation on each onClick.
//   - Card root stops propagation так как Cosmic Hub modal listens on backdrop.
//   - z-index inherits parent CosmicHubModal (100) — no override.
//
// Cancel flow: local useState `showConfirm`. Tap «Отказаться» renders inline
// confirm panel (NOT separate modal — keeps in-card UX simple). Tap «Да»
// dispatches store.cancelQuest(quest.id); the component unmounts when the
// quest leaves activeQuests so no setShowConfirm(false) cleanup needed.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../../store/gameStore'
import {
  QUESTS,
  type ActiveQuest,
  type QuestTarget,
  type QuestReward,
  type QuestType,
} from '../../../game/config/quests'
import { RACES_BY_ID } from '../../../game/config/races'
import { DARK_CARD_STYLE, GOLD, TEXT_DIM, TEXT_VERY_DIM } from '../_styles'

const QUEST_TYPE_ICON: Record<QuestType, string> = {
  delivery: '📦',
  exploration: '🔍',
  merge: '⚡',
  diplomacy: '🤝',
}

const REWARD_ICON: Record<QuestReward['kind'], string> = {
  essence: '✨',
  serum: '💉',
  gold: '🪙',
  relationship_and_bonus: '🤝',
}

function extractTargetValue(target: QuestTarget): number {
  if (target.kind === 'merge_to_level') return target.level
  if (target.kind === 'raise_relationship') return target.tier
  return target.value
}

function formatGoldShort(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

function rewardSummary(reward: QuestReward, t: (k: string) => string): string {
  switch (reward.kind) {
    case 'essence':
      return `${REWARD_ICON.essence} ${reward.value}`
    case 'serum':
      return `${REWARD_ICON.serum} ${reward.count} ${reward.element === 'random' ? '?' : reward.element}`
    case 'gold':
      return `${REWARD_ICON.gold} ${formatGoldShort(reward.value)}`
    case 'relationship_and_bonus':
      return `${REWARD_ICON.relationship_and_bonus} +1 ${t(RACES_BY_ID[reward.raceId].nameKey)}`
  }
}

interface Props {
  quest: ActiveQuest
}

export function QuestCard({ quest }: Props) {
  const { t } = useTranslation()
  const cancelQuest = useGameStore((s) => s.cancelQuest)
  const [showConfirm, setShowConfirm] = useState(false)

  const cfg = QUESTS[quest.questId]
  if (!cfg) {
    // Defensive: orphan quest (config removed since activation). Engine logs
    // dev-warn; UI silently renders nothing to keep the list tidy.
    return null
  }

  const race = RACES_BY_ID[quest.raceId]
  const targetVal = extractTargetValue(quest.target)
  const pct =
    targetVal > 0
      ? Math.min(100, Math.max(0, (quest.progress / targetVal) * 100))
      : 0

  return (
    <div
      style={{ ...DARK_CARD_STYLE, padding: 12, marginBottom: 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top row: race emoji + name + type icon + type label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>{race.emojiIcon}</span>
        <span style={{ fontWeight: 700, flex: 1, fontSize: 13 }}>
          {t(race.nameKey)}
        </span>
        <span style={{ fontSize: 12, color: TEXT_DIM }}>
          {QUEST_TYPE_ICON[quest.type]}{' '}
          {t(`cosmic_hub.quests.type.${quest.type}`)}
        </span>
      </div>

      {/* Short label */}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {t(cfg.short_key)}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 12,
          color: TEXT_DIM,
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {t(cfg.description_key)}
      </div>

      {/* Progress bar track */}
      <div
        style={{
          position: 'relative',
          height: 12,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: 'linear-gradient(180deg, #f9a8d4 0%, #db2777 100%)',
            transition: 'width 400ms ease-out',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 10,
          color: TEXT_VERY_DIM,
          marginBottom: 10,
          textAlign: 'right',
        }}
      >
        {quest.progress} / {targetVal}
      </div>

      {/* Reward preview */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>
          {rewardSummary(cfg.reward, t)}
        </span>
      </div>

      {/* Cancel area */}
      {!showConfirm ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setShowConfirm(true)
          }}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            color: TEXT_DIM,
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            fontSize: 11,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          {t('cosmic_hub.quests.cancel_button')}
        </button>
      ) : (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: TEXT_DIM,
              marginBottom: 8,
              lineHeight: 1.4,
            }}
          >
            {t('cosmic_hub.quests.cancel_confirm', { race: t(race.nameKey) })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                cancelQuest(quest.id)
                // Component unmounts when quest leaves activeQuests —
                // setShowConfirm(false) not needed.
              }}
              style={{
                padding: '6px 12px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {t('cosmic_hub.quests.cancel_button')}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowConfirm(false)
              }}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: TEXT_DIM,
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                fontSize: 11,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
