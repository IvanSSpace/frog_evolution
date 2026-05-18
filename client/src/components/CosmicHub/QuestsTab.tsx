// Phase 28 Plan 28-04: QuestsTab — 8th-tab content in Cosmic Hub.
//
// Renders:
//   - Header «Активные квесты: N/5» (i18n header_active с current/cap interpolation)
//   - cap_reached inline notification when activeQuests.length === ACTIVE_QUEST_CAP
//   - Empty state when activeQuests is empty (points player to Contacts tab)
//   - QuestCard list (one per ActiveQuest)
//   - CompletedQuestsList collapsible history (default closed)
//
// Mount effect: reconcileQuestProgress() — picks up polling-only progress
// (gold_amount / raise_relationship / merge_to_level via discoveredLevels) that
// event-driven targets miss while the tab is inactive. Mirrors Phase 27
// ContactsTab triggerPendingPull mount-effect pattern; engine is idempotent.
//
// No Lottie (memory feedback_animations) — child QuestCard handles its own
// CSS transitions, CompletedQuestsList uses React conditional rendering.

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { ACTIVE_QUEST_CAP } from '../../game/config/quests'
import { QuestCard } from './quests/QuestCard'
import { CompletedQuestsList } from './quests/CompletedQuestsList'
import { SECTION_HEADER_STYLE, EMPTY_STATE_TEXT_STYLE, GOLD } from './_styles'

export function QuestsTab() {
  const { t } = useTranslation()

  // Granular Zustand selectors — Phase 26-04 pattern, avoid whole-store re-render.
  const activeQuests = useGameStore((s) => s.activeQuests)
  const reconcileQuestProgress = useGameStore((s) => s.reconcileQuestProgress)

  // Mount-effect reconcile: engine is idempotent — safe to call on every mount.
  useEffect(() => {
    reconcileQuestProgress()
  }, [reconcileQuestProgress])

  const atCap = activeQuests.length >= ACTIVE_QUEST_CAP

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <section style={{ marginBottom: 12 }}>
        <h3 style={SECTION_HEADER_STYLE}>
          {t('cosmic_hub.quests.header_active', {
            current: activeQuests.length,
            cap: ACTIVE_QUEST_CAP,
          })}
        </h3>
        {atCap && (
          <div style={{ fontSize: 11, color: GOLD, marginBottom: 4 }}>
            {t('cosmic_hub.quests.cap_reached', { cap: ACTIVE_QUEST_CAP })}
          </div>
        )}
      </section>

      {activeQuests.length === 0 ? (
        <div style={{ ...EMPTY_STATE_TEXT_STYLE, padding: '24px 12px' }}>
          {t('cosmic_hub.quests.empty_state')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {activeQuests.map((q) => (
            <QuestCard key={q.id} quest={q} />
          ))}
        </div>
      )}

      <CompletedQuestsList />
    </div>
  )
}
