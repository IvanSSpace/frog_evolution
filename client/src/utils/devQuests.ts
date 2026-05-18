// Phase 28 Plan 28-03 — DEV helpers for quest mechanic smoke testing.
//
// Installed from App.tsx DEV bootstrap useEffect (alongside installContactsDevHelpers).
// No-op in production (early-return on !import.meta.env.DEV — Vite tree-shake).
//
// Helpers exposed on window:
//   __activateQuest(questId)             — force activation of a quest by questId
//                                           (looks up QUESTS, calls
//                                           slice.activateQuestFromHook).
//   __progressQuest(activeQuestId, delta)— bump progress of a specific active quest
//                                           by `delta` (raw setter), then call
//                                           reconcileQuestProgress to trigger
//                                           completion check.
//   __completeQuest(activeQuestId)       — set progress to target value, then call
//                                           reconcileQuestProgress (engine
//                                           completes + applies reward).
//   __resetQuests()                       — clear activeQuests + completedQuests.
//   __dumpQuests()                        — console.table snapshot of state.
//
// Cleanup function symmetrically deletes window props (App.tsx return-branch).

import { useGameStore } from '../store/gameStore'
import { QUESTS } from '../game/config/quests'
import type { QuestId } from '../game/config/quests'

declare global {
  interface Window {
    __activateQuest?: (questId: string) => void
    __progressQuest?: (activeQuestId: string, delta: number) => void
    __completeQuest?: (activeQuestId: string) => void
    __resetQuests?: () => void
    __dumpQuests?: () => void
  }
}

export function installQuestDevHelpers(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (!import.meta.env.DEV) return () => {}

  window.__activateQuest = (questId: string) => {
    const cfg = QUESTS[questId as QuestId]
    if (!cfg) {
      console.warn('[devQuests] unknown questId:', questId)
      return
    }
    useGameStore
      .getState()
      .activateQuestFromHook(questId as QuestId, cfg.raceId)
    const after = useGameStore.getState()
    console.info(
      `[devQuests] activate "${questId}" → activeQuests=${after.activeQuests.length}/5`,
    )
  }

  window.__progressQuest = (activeQuestId: string, delta: number) => {
    const s = useGameStore.getState()
    const q = s.activeQuests.find((x) => x.id === activeQuestId)
    if (!q) {
      console.warn('[devQuests] unknown activeQuestId:', activeQuestId)
      return
    }
    const next = s.activeQuests.map((x) =>
      x.id === activeQuestId ? { ...x, progress: x.progress + delta } : x,
    )
    useGameStore.setState({ activeQuests: next })
    useGameStore.getState().reconcileQuestProgress()
    const after = useGameStore.getState()
    const updated = after.activeQuests.find((x) => x.id === activeQuestId)
    console.info(
      `[devQuests] progress "${activeQuestId}" +${delta} → ${
        updated ? updated.progress : 'completed (moved to history)'
      }`,
    )
  }

  window.__completeQuest = (activeQuestId: string) => {
    const s = useGameStore.getState()
    const q = s.activeQuests.find((x) => x.id === activeQuestId)
    if (!q) {
      console.warn('[devQuests] unknown activeQuestId:', activeQuestId)
      return
    }
    const targetVal =
      q.target.kind === 'merge_to_level'
        ? q.target.level
        : q.target.kind === 'raise_relationship'
          ? q.target.tier
          : q.target.value
    const next = s.activeQuests.map((x) =>
      x.id === activeQuestId ? { ...x, progress: targetVal } : x,
    )
    useGameStore.setState({ activeQuests: next })
    useGameStore.getState().reconcileQuestProgress()
    console.info(
      `[devQuests] completed "${activeQuestId}" (progress set to ${targetVal})`,
    )
  }

  window.__resetQuests = () => {
    useGameStore.setState({ activeQuests: [], completedQuests: [] })
    console.info('[devQuests] reset: activeQuests=[], completedQuests=[]')
  }

  window.__dumpQuests = () => {
    const s = useGameStore.getState()
    console.table(
      s.activeQuests.map((q) => ({
        id: q.id,
        questId: q.questId,
        type: q.type,
        raceId: q.raceId,
        progress: q.progress,
        targetKind: q.target.kind,
      })),
    )
    console.info(
      `[devQuests] active: ${s.activeQuests.length}/5, completed: ${s.completedQuests.length} entries`,
    )
  }

  console.log(
    '[devQuests] helpers installed: __activateQuest(id), __progressQuest(aid,delta), ' +
      '__completeQuest(aid), __resetQuests(), __dumpQuests()',
  )

  return () => {
    delete window.__activateQuest
    delete window.__progressQuest
    delete window.__completeQuest
    delete window.__resetQuests
    delete window.__dumpQuests
  }
}
