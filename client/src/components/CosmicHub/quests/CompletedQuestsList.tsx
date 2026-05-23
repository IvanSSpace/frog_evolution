// Phase 28 Plan 28-04: collapsible completed quests history.
//
// Capped at 20 visible entries (MAX_VISIBLE) to avoid React reconciliation cost
// on long histories — defensive-load already trims activeQuests/completedQuests
// to COMPLETED_QUEST_HISTORY_CAP=100, but UI render budget on mobile is the
// tighter constraint.
//
// Reuses _styles.ts tokens. No Lottie (memory feedback_animations) — collapse
// state is binary (mount/unmount the list body via React conditional).
//
// formatGoldShort + rewardSummary inlined here (duplicated from QuestCard) —
// scope of duplication is 2 files; promoting to a shared util is deferred until
// the surface grows.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../../store/gameStore'
import {
  QUESTS,
  type CompletedQuest,
  type QuestReward,
} from '../../../game/config/quests'
import { RACES_BY_ID } from '../../../game/config/races'
import { SECTION_HEADER_STYLE, TEXT_DIM, TEXT_VERY_DIM, GOLD } from '../_styles'

const MAX_VISIBLE = 20

const REWARD_ICON: Record<QuestReward['kind'], string> = {
  essence: '💠',
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

export function CompletedQuestsList() {
  const { t } = useTranslation()
  const completedQuests = useGameStore((s) => s.completedQuests)
  const [expanded, setExpanded] = useState(false)

  // Newest first by completedAt. Slice cap MAX_VISIBLE to bound render cost.
  const sorted = [...completedQuests].sort(
    (a, b) => b.completedAt - a.completedAt,
  )
  const visible = sorted.slice(0, MAX_VISIBLE)
  const remaining = sorted.length - visible.length

  return (
    <section style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((v) => !v)
        }}
        style={{
          ...SECTION_HEADER_STYLE,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          padding: '8px 0',
          cursor: 'pointer',
          touchAction: 'manipulation',
          color: '#365314',
          textAlign: 'left',
        }}
      >
        <span>
          {expanded ? '▼' : '▶'} {t('cosmic_hub.quests.header_completed')} (
          {completedQuests.length})
        </span>
      </button>

      {expanded && completedQuests.length === 0 && (
        <div
          style={{
            fontSize: 12,
            color: TEXT_VERY_DIM,
            padding: '6px 4px',
          }}
        >
          {t('cosmic_hub.quests.empty_state')}
        </div>
      )}

      {expanded && completedQuests.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginTop: 6,
          }}
        >
          {visible.map((cq: CompletedQuest) => {
            const cfg = QUESTS[cq.questId]
            const race = RACES_BY_ID[cq.raceId]
            return (
              <div
                key={cq.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  fontSize: 11,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>
                  {race.emojiIcon}
                </span>
                <span style={{ flex: 1, color: TEXT_DIM }}>
                  {cfg ? t(cfg.short_key) : cq.questId}
                </span>
                <span style={{ color: GOLD, fontWeight: 700 }}>
                  {rewardSummary(cq.rewardClaimed, t)}
                </span>
              </div>
            )
          })}
          {remaining > 0 && (
            <div
              style={{
                fontSize: 10,
                color: TEXT_VERY_DIM,
                textAlign: 'center',
                padding: 4,
              }}
            >
              ... +{remaining}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
