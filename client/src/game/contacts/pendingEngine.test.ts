// Phase 27 Plan 27-03: unit tests for pure pendingEngineTick.
//
// Tests mock '../config/raceChains' to provide a deterministic fixture chain — Plan
// 27-02 fills the production RACE_CHAINS arrays in parallel (wave 2), but the
// engine logic must be testable in isolation. The fixture chain layout:
//   index 0..5  : msg/dialog items (queue-pushable)
//   index 6     : event with target='self', delta=-1 (auto-applied)
//   index 7..9  : more msg items
// All 10 RaceId chains use the same fixture for predictable pull selection tests.
//
// Constants (RELATIONSHIP_MIN/MAX/CAP/INITIAL) are re-exported from the mock to keep
// production semantics; only RACE_CHAINS is overridden with the fixture.

import { describe, it, expect, vi } from 'vitest'
import type { RaceId } from '../config/races'

// Re-export production constants so engine + tests reference the same numeric
// values without diverging. ChainItem / PendingItem types remain identical.
vi.mock('../config/raceChains', async () => {
  const actual = await vi.importActual<typeof import('../config/raceChains')>(
    '../config/raceChains',
  )
  const allRaceIds: RaceId[] = [
    'crystalloids',
    'gasouls',
    'mechanidons',
    'fireworms',
    'liquidoids',
    'tenebrians',
    'plasmaspirits',
    'forestcores',
    'timeweavers',
    'cometfolk',
  ]
  type ChainItem = import('../config/raceChains').ChainItem
  const fixtureChain: readonly ChainItem[] = [
    { type: 'msg', text_key: 'fixture.msg.0' },
    { type: 'msg', text_key: 'fixture.msg.1' },
    {
      type: 'dialog',
      text_key: 'fixture.dlg.2',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'fixture.msg.3' },
    { type: 'msg', text_key: 'fixture.msg.4' },
    { type: 'msg', text_key: 'fixture.msg.5' },
    { type: 'event', target: 'self', delta: -1, text_key: 'fixture.evt.6' },
    { type: 'msg', text_key: 'fixture.msg.7' },
    { type: 'msg', text_key: 'fixture.msg.8' },
    { type: 'msg', text_key: 'fixture.msg.9' },
  ]
  const FIXTURE_RACE_CHAINS = {} as Record<RaceId, readonly ChainItem[]>
  for (const id of allRaceIds) {
    FIXTURE_RACE_CHAINS[id] = fixtureChain
  }
  return {
    ...actual,
    RACE_CHAINS: FIXTURE_RACE_CHAINS,
  }
})

// Imports MUST follow vi.mock so module resolution picks up the mock.
import {
  pendingEngineTick,
  applyDeltaClamp,
  type EngineInput,
} from './pendingEngine'
import { CHAIN_PENDING_CAP, INITIAL_RELATIONSHIP } from '../config/raceChains'

const ALL_RACE_IDS: RaceId[] = [
  'crystalloids',
  'gasouls',
  'mechanidons',
  'fireworms',
  'liquidoids',
  'tenebrians',
  'plasmaspirits',
  'forestcores',
  'timeweavers',
  'cometfolk',
]

function makeBaseInput(): EngineInput {
  const raceRelationships = {} as Record<RaceId, number>
  const chainProgress = {} as Record<RaceId, number>
  const firstContactsSeen = {} as Record<RaceId, boolean>
  for (const r of ALL_RACE_IDS) {
    raceRelationships[r] = INITIAL_RELATIONSHIP
    chainProgress[r] = 0
    firstContactsSeen[r] = false
  }
  return {
    raceRelationships,
    chainProgress,
    pendingItems: [],
    firstContactsSeen,
    cosmosUnlocked: true,
    now: 1700000000000,
  }
}

describe('applyDeltaClamp', () => {
  it('clamps to RELATIONSHIP_MIN=1', () => {
    expect(applyDeltaClamp(2, -5)).toBe(1)
    expect(applyDeltaClamp(1, -1)).toBe(1)
  })
  it('clamps to RELATIONSHIP_MAX=10', () => {
    expect(applyDeltaClamp(9, 5)).toBe(10)
    expect(applyDeltaClamp(10, 1)).toBe(10)
  })
  it('floors fractional results', () => {
    expect(applyDeltaClamp(2.7, 1.3)).toBe(4)
  })
})

describe('pendingEngineTick', () => {
  it('returns input unchanged when cosmosUnlocked=false', () => {
    const input = { ...makeBaseInput(), cosmosUnlocked: false }
    input.firstContactsSeen.crystalloids = true
    const out = pendingEngineTick(input)
    expect(out.nextPendingItems).toEqual([])
    expect(out.eventToasts).toEqual([])
  })

  it('returns empty when no race firstContactsSeen', () => {
    const out = pendingEngineTick(makeBaseInput())
    expect(out.nextPendingItems).toEqual([])
    expect(out.eventToasts).toEqual([])
  })

  it('pulls one item for the only first-contacted race', () => {
    const input = makeBaseInput()
    input.firstContactsSeen.crystalloids = true
    const out = pendingEngineTick(input)
    expect(out.nextPendingItems.length).toBeGreaterThanOrEqual(1)
    expect(out.nextPendingItems[0].raceId).toBe('crystalloids')
    expect(out.nextPendingItems[0].chainStep).toBe(0)
  })

  it('respects CHAIN_PENDING_CAP=3', () => {
    const input = makeBaseInput()
    for (const r of ALL_RACE_IDS) input.firstContactsSeen[r] = true
    const out = pendingEngineTick(input)
    expect(out.nextPendingItems.length).toBe(CHAIN_PENDING_CAP)
  })

  it('lowest-progress-first with alphabetical tiebreak', () => {
    const input = makeBaseInput()
    input.firstContactsSeen.crystalloids = true
    input.firstContactsSeen.fireworms = true
    const out = pendingEngineTick(input)
    // Both at progress 0 — alphabetical: crystalloids < fireworms.
    expect(out.nextPendingItems[0].raceId).toBe('crystalloids')
  })

  it('event item auto-applies + emits toast + NOT in pendingItems', () => {
    const input = makeBaseInput()
    input.firstContactsSeen.crystalloids = true
    input.chainProgress.crystalloids = 6 // points at event fixture
    const out = pendingEngineTick(input)
    expect(out.eventToasts.length).toBeGreaterThanOrEqual(1)
    expect(out.eventToasts[0].raceId).toBe('crystalloids')
    expect(out.eventToasts[0].delta).toBe(-1)
    expect(out.nextRelationships.crystalloids).toBe(INITIAL_RELATIONSHIP - 1)
    expect(out.nextChainProgress.crystalloids).toBeGreaterThanOrEqual(7)
    // Event must NOT land in pendingItems. There may be follow-up msg items pulled
    // after event auto-applies (chainStep advanced to 7), but none of them is the event.
    const eventInQueue = out.nextPendingItems.find(
      (p) => p.item.type === 'event',
    )
    expect(eventInQueue).toBeUndefined()
  })

  it('event delta clamps relationship to [1,10]', () => {
    const input = makeBaseInput()
    input.raceRelationships.crystalloids = 1
    input.firstContactsSeen.crystalloids = true
    input.chainProgress.crystalloids = 6
    const out = pendingEngineTick(input)
    expect(out.nextRelationships.crystalloids).toBe(1)
  })

  it('skips races already represented in pendingItems', () => {
    const input = makeBaseInput()
    input.firstContactsSeen.crystalloids = true
    input.firstContactsSeen.fireworms = true
    input.pendingItems = [
      {
        id: 'pre-existing',
        raceId: 'crystalloids',
        chainStep: 0,
        item: { type: 'msg', text_key: 'fixture.msg.0' },
        createdAt: input.now,
      },
    ]
    const out = pendingEngineTick(input)
    const newIds = out.nextPendingItems
      .filter((p) => p.id !== 'pre-existing')
      .map((p) => p.raceId)
    expect(newIds).toContain('fireworms')
    expect(newIds).not.toContain('crystalloids')
  })

  it('stops when chainProgress at end of chain', () => {
    const input = makeBaseInput()
    input.firstContactsSeen.crystalloids = true
    input.chainProgress.crystalloids = 10 // fixture has 10 items (indices 0..9)
    const out = pendingEngineTick(input)
    // Only crystalloids first-contacted, and its chain is exhausted → empty queue.
    expect(out.nextPendingItems.length).toBe(0)
  })

  it('terminates within maxIter even with all 10 races eligible', () => {
    const input = makeBaseInput()
    for (const r of ALL_RACE_IDS) input.firstContactsSeen[r] = true
    const out = pendingEngineTick(input)
    expect(out.nextPendingItems.length).toBeLessThanOrEqual(CHAIN_PENDING_CAP)
  })
})
