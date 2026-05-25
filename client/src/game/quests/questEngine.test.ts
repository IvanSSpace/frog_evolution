// Phase 28 Plan 28-03: unit tests for pure questEngine.
//
// Tests mock '../config/quests' to provide a deterministic QUESTS fixture covering
// all 4 QuestType × 7 QuestTarget shapes — Plan 28-02 fills the production catalogue
// in parallel; the engine logic must be testable in isolation.
//
// vi.mock + vi.importActual pattern mirrors Phase 27 pendingEngine.test.ts:
// constants (ACTIVE_QUEST_CAP, generateActiveQuestId) and types pass through
// the real module; only QUESTS is overridden with the fixture record.
//
// Test cases (≥10):
//   1. activateQuestFromHook returns null + capReached:true at cap
//   2. activateQuestFromHook returns null + capReached:false on unknown questId
//   3. activateQuestFromHook returns valid ActiveQuest shape when slot free
//   4. checkActiveQuestsProgress: delivery serum_count increments on box-opened (match element)
//   5. checkActiveQuestsProgress: delivery serum_count does NOT increment on mismatch element
//   6. checkActiveQuestsProgress: exploration planets_visited increments on planet-select
//   7. checkActiveQuestsProgress: merge merge_count increments on merge:happened
//   8. checkActiveQuestsProgress: merge merge_to_level completes when level reached
//   9. checkActiveQuestsProgress: diplomacy raise_relationship completes when tier reached
//   10. checkActiveQuestsProgress: gold_amount progress reflects current goldAmount (polling)
//   11. applyQuestReward: essence / gold / relationship_and_bonus shapes
//   12. applyQuestReward: serum with element='random' picks deterministically via injected rng
//   13. isQuestComplete: progress >= target.value returns true; below returns false
//   14. checkActiveQuestsProgress: missions_complete increments on ship-arrived
//   15. checkActiveQuestsProgress: empty activeQuests → empty output

import { describe, it, expect, vi } from 'vitest'

vi.mock('../config/quests', async () => {
  const actual =
    await vi.importActual<typeof import('../config/quests')>('../config/quests')
  type QuestConfig = import('../config/quests').QuestConfig
  const FIXTURE_QUESTS: Record<string, QuestConfig> = {
    test_delivery: {
      id: 'test_delivery',
      raceId: 'crystalloids',
      type: 'delivery',
      target: { kind: 'serum_count', element: 'crystal', value: 5 },
      reward: { kind: 'essence', value: 1 },
      description_key: 'q.test_delivery.description',
      short_key: 'q.test_delivery.short',
      difficulty: 'easy',
    },
    test_gold: {
      id: 'test_gold',
      raceId: 'crystalloids',
      type: 'delivery',
      target: { kind: 'gold_amount', value: 1_000_000 },
      reward: { kind: 'essence', value: 3 },
      description_key: 'q.test_gold.description',
      short_key: 'q.test_gold.short',
      difficulty: 'medium',
    },
    test_exploration: {
      id: 'test_exploration',
      raceId: 'cometfolk',
      type: 'exploration',
      target: { kind: 'planets_visited', value: 3 },
      reward: { kind: 'gold', value: 10_000_000 },
      description_key: 'q.test_exploration.description',
      short_key: 'q.test_exploration.short',
      difficulty: 'easy',
    },
    test_missions: {
      id: 'test_missions',
      raceId: 'cometfolk',
      type: 'exploration',
      target: { kind: 'missions_complete', value: 2 },
      reward: { kind: 'serum', element: 'random', count: 1 },
      description_key: 'q.test_missions.description',
      short_key: 'q.test_missions.short',
      difficulty: 'easy',
    },
    test_merge_count: {
      id: 'test_merge_count',
      raceId: 'fireworms',
      type: 'merge',
      target: { kind: 'merge_count', value: 5 },
      reward: { kind: 'gold', value: 5_000_000 },
      description_key: 'q.test_merge_count.description',
      short_key: 'q.test_merge_count.short',
      difficulty: 'easy',
    },
    test_merge_level: {
      id: 'test_merge_level',
      raceId: 'fireworms',
      type: 'merge',
      target: { kind: 'merge_to_level', level: 8 },
      reward: { kind: 'gold', value: 100_000_000 },
      description_key: 'q.test_merge_level.description',
      short_key: 'q.test_merge_level.short',
      difficulty: 'hard',
    },
    test_diplomacy: {
      id: 'test_diplomacy',
      raceId: 'crystalloids',
      type: 'diplomacy',
      target: { kind: 'raise_relationship', raceId: 'crystalloids', tier: 6 },
      reward: {
        kind: 'relationship_and_bonus',
        raceId: 'crystalloids',
        bonus_id: 'bonus_crystal_friend',
      },
      description_key: 'q.test_diplomacy.description',
      short_key: 'q.test_diplomacy.short',
      difficulty: 'medium',
    },
  }
  return {
    ...actual,
    QUESTS: FIXTURE_QUESTS,
  }
})

// Imports MUST follow vi.mock so module resolution picks up the mock.
import {
  activateQuestFromHook,
  checkActiveQuestsProgress,
  applyQuestReward,
  isQuestComplete,
  generateActiveQuestUuid,
  type ProgressInput,
} from './questEngine'
import { ACTIVE_QUEST_CAP } from '../config/quests'
import type { ActiveQuest } from '../config/quests'
import type { RaceId } from '../config/races'
import type { Element } from '../../store/cosmic/types'
import { ELEMENTS } from '../../store/cosmic/types'

const ALL_RACE_IDS: RaceId[] = [
  'crystalloids',
  'mechanidons',
  'fireworms',
  'liquidoids',
  'tenebrians',
  'plasmaspirits',
  'forestcores',
  'timeweavers',
  'cometfolk',
]

function makeBaseProgressInput(
  overrides: Partial<ProgressInput> = {},
): ProgressInput {
  const serumCounts = {} as Record<Element, number>
  for (const el of ELEMENTS) serumCounts[el] = 0
  const raceRelationships = {} as Record<RaceId, number>
  for (const r of ALL_RACE_IDS) raceRelationships[r] = 2
  return {
    activeQuests: [],
    serumCounts,
    goldAmount: 0,
    discoveredLevels: [],
    raceRelationships,
    event: null,
    ...overrides,
  }
}

function makeActiveQuest(
  questId: string,
  type: ActiveQuest['type'],
  target: ActiveQuest['target'],
  raceId: RaceId,
  progress = 0,
): ActiveQuest {
  return {
    id: `aq-test-${questId}`,
    questId,
    raceId,
    type,
    target,
    progress,
    startedAt: 1_700_000_000_000,
  }
}

describe('activateQuestFromHook', () => {
  it('returns null + capReached:true when activeQuests.length >= ACTIVE_QUEST_CAP', () => {
    const five: ActiveQuest[] = Array.from(
      { length: ACTIVE_QUEST_CAP },
      (_, i) =>
        makeActiveQuest(
          'test_delivery',
          'delivery',
          { kind: 'serum_count', element: 'crystal', value: 5 },
          'crystalloids',
          i,
        ),
    )
    const out = activateQuestFromHook({
      questId: 'test_delivery',
      raceId: 'crystalloids',
      currentActiveQuests: five,
      now: 1_700_000_000_000,
    })
    expect(out.capReached).toBe(true)
    expect(out.newActiveQuest).toBeNull()
  })

  it('returns null + capReached:false when questId is unknown (engine logs DEV warn)', () => {
    const out = activateQuestFromHook({
      questId: 'nonexistent_quest_id',
      raceId: 'crystalloids',
      currentActiveQuests: [],
      now: 1_700_000_000_000,
    })
    expect(out.capReached).toBe(false)
    expect(out.newActiveQuest).toBeNull()
  })

  it('returns valid ActiveQuest with correct shape when slot available', () => {
    const now = 1_700_000_000_000
    const out = activateQuestFromHook({
      questId: 'test_delivery',
      raceId: 'crystalloids',
      currentActiveQuests: [],
      now,
    })
    expect(out.capReached).toBe(false)
    expect(out.newActiveQuest).not.toBeNull()
    const q = out.newActiveQuest!
    expect(q.questId).toBe('test_delivery')
    expect(q.raceId).toBe('crystalloids')
    expect(q.type).toBe('delivery')
    expect(q.target).toEqual({
      kind: 'serum_count',
      element: 'crystal',
      value: 5,
    })
    expect(q.progress).toBe(0)
    expect(q.startedAt).toBe(now)
    expect(typeof q.id).toBe('string')
    expect(q.id.length).toBeGreaterThan(0)
  })
})

describe('checkActiveQuestsProgress', () => {
  it('returns empty deltas + empty completedQuestIds for empty activeQuests', () => {
    const out = checkActiveQuestsProgress(makeBaseProgressInput())
    expect(out.progressDeltas).toEqual([])
    expect(out.completedQuestIds).toEqual([])
  })

  it('delivery serum_count increments on box-opened with matching element', () => {
    const q = makeActiveQuest(
      'test_delivery',
      'delivery',
      { kind: 'serum_count', element: 'crystal', value: 5 },
      'crystalloids',
      1,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        event: { kind: 'box-opened', element: 'crystal' },
      }),
    )
    expect(out.progressDeltas).toHaveLength(1)
    expect(out.progressDeltas[0]).toEqual({
      activeQuestId: q.id,
      newProgress: 2,
    })
    expect(out.completedQuestIds).toEqual([])
  })

  it('delivery serum_count does NOT increment on box-opened with WRONG element', () => {
    const q = makeActiveQuest(
      'test_delivery',
      'delivery',
      { kind: 'serum_count', element: 'crystal', value: 5 },
      'crystalloids',
      1,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        event: { kind: 'box-opened', element: 'fire' },
      }),
    )
    expect(out.progressDeltas).toEqual([])
    expect(out.completedQuestIds).toEqual([])
  })

  it('exploration planets_visited increments on planet-select', () => {
    const q = makeActiveQuest(
      'test_exploration',
      'exploration',
      { kind: 'planets_visited', value: 3 },
      'cometfolk',
      0,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        event: { kind: 'planet-select', planetId: 'planet-7' },
      }),
    )
    expect(out.progressDeltas).toHaveLength(1)
    expect(out.progressDeltas[0]).toEqual({
      activeQuestId: q.id,
      newProgress: 1,
    })
  })

  it('exploration missions_complete increments on ship-arrived', () => {
    const q = makeActiveQuest(
      'test_missions',
      'exploration',
      { kind: 'missions_complete', value: 2 },
      'cometfolk',
      0,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        event: { kind: 'ship-arrived', planetId: 'planet-3' },
      }),
    )
    expect(out.progressDeltas).toHaveLength(1)
    expect(out.progressDeltas[0]).toEqual({
      activeQuestId: q.id,
      newProgress: 1,
    })
  })

  it('merge merge_count increments on merge:happened', () => {
    const q = makeActiveQuest(
      'test_merge_count',
      'merge',
      { kind: 'merge_count', value: 5 },
      'fireworms',
      2,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        event: { kind: 'merge', level: 3 },
      }),
    )
    expect(out.progressDeltas).toHaveLength(1)
    expect(out.progressDeltas[0]).toEqual({
      activeQuestId: q.id,
      newProgress: 3,
    })
    expect(out.completedQuestIds).toEqual([])
  })

  it('merge merge_to_level completes when target level reached via event', () => {
    const q = makeActiveQuest(
      'test_merge_level',
      'merge',
      { kind: 'merge_to_level', level: 8 },
      'fireworms',
      0,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        event: { kind: 'merge', level: 8 },
      }),
    )
    expect(out.progressDeltas).toHaveLength(1)
    expect(out.progressDeltas[0].newProgress).toBe(8)
    expect(out.completedQuestIds).toContain(q.id)
  })

  it('merge merge_to_level completes via polled discoveredLevels.includes(target.level)', () => {
    const q = makeActiveQuest(
      'test_merge_level',
      'merge',
      { kind: 'merge_to_level', level: 8 },
      'fireworms',
      0,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        discoveredLevels: [1, 2, 3, 4, 5, 6, 7, 8],
        event: null,
      }),
    )
    expect(out.progressDeltas).toHaveLength(1)
    expect(out.progressDeltas[0].newProgress).toBe(8)
    expect(out.completedQuestIds).toContain(q.id)
  })

  it('diplomacy raise_relationship completes when newValue reaches tier', () => {
    const q = makeActiveQuest(
      'test_diplomacy',
      'diplomacy',
      { kind: 'raise_relationship', raceId: 'crystalloids', tier: 6 },
      'crystalloids',
      2,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        event: {
          kind: 'relationship-delta',
          raceId: 'crystalloids',
          newValue: 6,
        },
      }),
    )
    expect(out.progressDeltas).toHaveLength(1)
    expect(out.progressDeltas[0].newProgress).toBe(6)
    expect(out.completedQuestIds).toContain(q.id)
  })

  it('gold_amount progress reflects current goldAmount (polling, no event)', () => {
    const q = makeActiveQuest(
      'test_gold',
      'delivery',
      { kind: 'gold_amount', value: 1_000_000 },
      'crystalloids',
      0,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        goldAmount: 750_000,
        event: null,
      }),
    )
    expect(out.progressDeltas).toHaveLength(1)
    expect(out.progressDeltas[0].newProgress).toBe(750_000)
    expect(out.completedQuestIds).toEqual([])
  })

  it('gold_amount completes when goldAmount exceeds target.value', () => {
    const q = makeActiveQuest(
      'test_gold',
      'delivery',
      { kind: 'gold_amount', value: 1_000_000 },
      'crystalloids',
      0,
    )
    const out = checkActiveQuestsProgress(
      makeBaseProgressInput({
        activeQuests: [q],
        goldAmount: 1_500_000,
        event: null,
      }),
    )
    // newProgress is clamped to target.value (= 1_000_000) per spec.
    expect(out.progressDeltas[0].newProgress).toBe(1_000_000)
    expect(out.completedQuestIds).toContain(q.id)
  })
})

describe('applyQuestReward', () => {
  it('essence reward returns {essenceDelta: value}', () => {
    const d = applyQuestReward({ kind: 'essence', value: 3 })
    expect(d.essenceDelta).toBe(3)
    expect(d.goldDelta).toBeUndefined()
    expect(d.serumDelta).toBeUndefined()
    expect(d.relationshipDelta).toBeUndefined()
  })

  it('gold reward returns {goldDelta: value}', () => {
    const d = applyQuestReward({ kind: 'gold', value: 10_000_000 })
    expect(d.goldDelta).toBe(10_000_000)
    expect(d.essenceDelta).toBeUndefined()
  })

  it('relationship_and_bonus reward returns relationshipDelta +1 + bonusId', () => {
    const d = applyQuestReward({
      kind: 'relationship_and_bonus',
      raceId: 'crystalloids',
      bonus_id: 'bonus_crystal_friend',
    })
    expect(d.relationshipDelta).toEqual({ raceId: 'crystalloids', delta: 1 })
    expect(d.bonusId).toBe('bonus_crystal_friend')
  })

  it('serum reward with element="random" uses injected rng deterministically', () => {
    // rng=0 → index 0 → ELEMENTS[0] = 'fire'
    const d0 = applyQuestReward(
      { kind: 'serum', element: 'random', count: 2 },
      () => 0,
    )
    expect(d0.serumDelta).toBeDefined()
    expect(d0.serumDelta!.fire).toBe(2)
    // rng → near-1 → last element
    const dEnd = applyQuestReward(
      { kind: 'serum', element: 'random', count: 1 },
      () => 0.9999,
    )
    const lastEl = ELEMENTS[ELEMENTS.length - 1]
    expect(dEnd.serumDelta![lastEl]).toBe(1)
  })

  it('serum reward with explicit element returns serumDelta keyed on that element', () => {
    const d = applyQuestReward({ kind: 'serum', element: 'crystal', count: 3 })
    expect(d.serumDelta).toBeDefined()
    expect(d.serumDelta!.crystal).toBe(3)
  })
})

describe('isQuestComplete', () => {
  it('returns true when progress >= target.value', () => {
    const q = makeActiveQuest(
      'test_delivery',
      'delivery',
      { kind: 'serum_count', element: 'crystal', value: 5 },
      'crystalloids',
      5,
    )
    expect(isQuestComplete(q, makeBaseProgressInput())).toBe(true)
  })

  it('returns false when progress < target.value', () => {
    const q = makeActiveQuest(
      'test_delivery',
      'delivery',
      { kind: 'serum_count', element: 'crystal', value: 5 },
      'crystalloids',
      4,
    )
    expect(isQuestComplete(q, makeBaseProgressInput())).toBe(false)
  })

  it('returns true for merge_to_level when progress reaches target.level', () => {
    const q = makeActiveQuest(
      'test_merge_level',
      'merge',
      { kind: 'merge_to_level', level: 8 },
      'fireworms',
      8,
    )
    expect(isQuestComplete(q, makeBaseProgressInput())).toBe(true)
  })

  it('returns true for raise_relationship when progress reaches target.tier', () => {
    const q = makeActiveQuest(
      'test_diplomacy',
      'diplomacy',
      { kind: 'raise_relationship', raceId: 'crystalloids', tier: 6 },
      'crystalloids',
      6,
    )
    expect(isQuestComplete(q, makeBaseProgressInput())).toBe(true)
  })
})

describe('generateActiveQuestUuid', () => {
  it('produces a non-empty string id', () => {
    const id = generateActiveQuestUuid(1_700_000_000_000)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })
})
