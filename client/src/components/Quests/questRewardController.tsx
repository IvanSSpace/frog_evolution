// Phase 28 Plan 28-05: App-level controller for quest reward popup.
//
// Subscribes to eventBus 'quests:completed' (emitted by markQuestProgress in
// cosmic/slice.ts, Plan 28-03) и queue'ит popups для sequential display:
// если несколько quest'ов completed одновременно (e.g. через DEV
// __completeQuest spam или single tick c multiple progress hits) — popups
// показываются по одному, новый mount'ится после dismiss предыдущего.
//
// Mirror Phase 27-05 EventToastController pattern (queue в useState + handler
// в useEffect + cleanup return). Choice rationale: React.FC controller
// (vs. imperative installer) — automatic cleanup via useEffect return
// HMR-safe и не требует custom symmetric uninstall.
//
// Defensive: QUEUE_CAP=10 чтобы DEV helper spam не уронил memory; в production
// 5-quest cap × completion frequency делает это просто safety net.
//
// Idempotent enqueue: dedup по activeQuestId если event эмитится дважды
// (StrictMode double-mount, DEV reissue) — popup shows один раз per quest.

import { useEffect, useState } from 'react'
import { eventBus } from '../../store/eventBus'
import type { QuestReward } from '../../game/config/quests'
import { QuestRewardPopup } from './QuestRewardPopup'

interface PopupEntry {
  /** Unique = activeQuestId from event payload (dedup anchor). */
  key: string
  questId: string
  raceId: string
  reward: QuestReward
}

const QUEUE_CAP = 10

export function QuestRewardController() {
  const [queue, setQueue] = useState<PopupEntry[]>([])

  useEffect(() => {
    const onCompleted = (e: {
      raceId: string
      questId: string
      activeQuestId: string
      reward: QuestReward
    }) => {
      setQueue((q) => {
        // Defensive — drop overflow silently
        if (q.length >= QUEUE_CAP) return q
        // Dedup: same activeQuestId already queued → no-op (DEV reissue, StrictMode)
        if (q.some((entry) => entry.key === e.activeQuestId)) return q
        return [
          ...q,
          {
            key: e.activeQuestId,
            questId: e.questId,
            raceId: e.raceId,
            reward: e.reward,
          },
        ]
      })
    }
    eventBus.on('quests:completed', onCompleted)
    return () => {
      eventBus.off('quests:completed', onCompleted)
    }
  }, [])

  if (queue.length === 0) return null

  const head = queue[0]
  return (
    <QuestRewardPopup
      key={head.key}
      questId={head.questId}
      raceId={head.raceId}
      reward={head.reward}
      onDismiss={() => setQueue((q) => q.slice(1))}
    />
  )
}
