// Tech-debt 2026-05-18: React Testing Library coverage for Phase 27 Plan 27-04
// RaceDetailView.
//
// Component contract (per RaceDetailView.tsx header):
//   - Header: back arrow (aria-label="Back") + race emoji + race name.
//   - Lore card: home planet name + personality + lore_short.
//   - RelationshipBar rendered with current value.
//   - PendingInteraction OR EmptyPending based on pendingItem presence.
//   - Reply buttons (acknowledge for msg/event, refuse+support for
//     dialog/quest_hook) → call resolveAccept / resolveRefuse /
//     resolveAcknowledge with pending.id.
//   - All clickable elements are button[type="button"] (cliclability guard).
//
// What's tested (6 cases):
//   1. Back arrow click invokes onBack callback.
//   2. Lore card renders all three i18n keys (planet/personality/lore).
//   3. RelationshipBar mounted (tier label visible).
//   4. EmptyPending shown when no pending item; uses empty_state i18n key.
//   5. msg pending → Acknowledge button visible + click calls resolveAcknowledge(id).
//   6. dialog pending → Refuse + Support buttons visible + click invokes correct resolver
//      with pending.id.
//
// All buttons asserted to be type="button" in the cliclability test.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru' },
  }),
}))

function installLocalStoragePolyfill(): void {
  const store: Record<string, string> = {}
  const ls: Storage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: ls,
    writable: true,
    configurable: true,
  })
}
installLocalStoragePolyfill()

vi.mock('../../../api/gameSync', () => ({
  saveGameState: vi.fn(async () => true),
}))

type RaceDetailModule = typeof import('./RaceDetailView')
type GameStoreModule = typeof import('../../../store/gameStore')
type ChainsModule = typeof import('../../../game/config/raceChains')
type RacesModule = typeof import('../../../game/config/races')
let RaceDetailView: RaceDetailModule['RaceDetailView']
let useGameStore: GameStoreModule['useGameStore']
let INITIAL_RELATIONSHIP: ChainsModule['INITIAL_RELATIONSHIP']
let RACES: RacesModule['RACES']
type PendingItem = ChainsModule['PendingItem']

beforeAll(async () => {
  const rd = await import('./RaceDetailView')
  RaceDetailView = rd.RaceDetailView
  const gs = await import('../../../store/gameStore')
  useGameStore = gs.useGameStore
  const c = await import('../../../game/config/raceChains')
  INITIAL_RELATIONSHIP = c.INITIAL_RELATIONSHIP
  const r = await import('../../../game/config/races')
  RACES = r.RACES
})

interface SeedOpts {
  pendingItems?: PendingItem[]
  resolveAccept?: (id: string) => void
  resolveRefuse?: (id: string) => void
  resolveAcknowledge?: (id: string) => void
}

function seedState(opts: SeedOpts = {}): void {
  const raceRelationships: Record<string, number> = {}
  const chainProgress: Record<string, number> = {}
  const firstContactsSeen: Record<string, boolean> = {}
  for (const r of RACES) {
    raceRelationships[r.id] = INITIAL_RELATIONSHIP
    chainProgress[r.id] = 0
    firstContactsSeen[r.id] = true
  }
  useGameStore.setState({
    raceRelationships,
    chainProgress,
    firstContactsSeen,
    pendingItems: opts.pendingItems ?? [],
    resolveAccept: opts.resolveAccept ?? vi.fn(),
    resolveRefuse: opts.resolveRefuse ?? vi.fn(),
    resolveAcknowledge: opts.resolveAcknowledge ?? vi.fn(),
  } as unknown as Record<string, unknown>)
}

afterEach(() => {
  cleanup()
})

describe('RaceDetailView', () => {
  beforeEach(() => {
    seedState()
  })

  it('back button click invokes onBack callback', () => {
    const onBack = vi.fn()
    render(<RaceDetailView raceId="crystalloids" onBack={onBack} />)
    const back = screen.getByLabelText('Back')
    expect((back as HTMLButtonElement).type).toBe('button')
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('lore card renders home planet, personality, and lore i18n keys', () => {
    render(<RaceDetailView raceId="crystalloids" onBack={vi.fn()} />)
    // With passthrough t, these i18n keys are visible verbatim.
    expect(
      screen.getByText('races.crystalloids.home_planet_name'),
    ).toBeTruthy()
    expect(screen.getByText('races.crystalloids.personality')).toBeTruthy()
    expect(screen.getByText('races.crystalloids.lore_short')).toBeTruthy()
  })

  it('renders RelationshipBar (tier label visible from getRelationshipTier)', () => {
    render(<RaceDetailView raceId="crystalloids" onBack={vi.fn()} />)
    // INITIAL_RELATIONSHIP=2 → hostile tier → key cosmic_hub.contacts.tier.1.
    expect(screen.getByText('cosmic_hub.contacts.tier.1')).toBeTruthy()
  })

  it('shows EmptyPending when no pending item for raceId', () => {
    render(<RaceDetailView raceId="crystalloids" onBack={vi.fn()} />)
    expect(screen.getByText('cosmic_hub.contacts.empty_state')).toBeTruthy()
  })

  it('msg pending → Acknowledge button + resolveAcknowledge(id) on click', () => {
    const ack = vi.fn()
    const pending: PendingItem = {
      id: 'p-msg-1',
      raceId: 'crystalloids',
      chainStep: 0,
      item: { type: 'msg', text_key: 'races.crystalloids.chain.0.text' },
      createdAt: 1700000000000,
    }
    seedState({ pendingItems: [pending], resolveAcknowledge: ack })
    render(<RaceDetailView raceId="crystalloids" onBack={vi.fn()} />)
    const ackBtn = screen.getByText('cosmic_hub.contacts.acknowledge')
    expect((ackBtn as HTMLButtonElement).type).toBe('button')
    fireEvent.click(ackBtn)
    expect(ack).toHaveBeenCalledWith('p-msg-1')
  })

  it('dialog pending → Refuse + Support buttons, each calling correct resolver with id', () => {
    const accept = vi.fn()
    const refuse = vi.fn()
    const pending: PendingItem = {
      id: 'p-dlg-1',
      raceId: 'crystalloids',
      chainStep: 2,
      item: {
        type: 'dialog',
        text_key: 'races.crystalloids.chain.2.text',
        accept_delta: 1,
        refuse_delta: -1,
      },
      createdAt: 1700000000000,
    }
    seedState({
      pendingItems: [pending],
      resolveAccept: accept,
      resolveRefuse: refuse,
    })
    render(<RaceDetailView raceId="crystalloids" onBack={vi.fn()} />)

    // Button labels use i18n keys with embedded delta — find by partial textContent.
    // refuse label = "cosmic_hub.contacts.refuse (-1)"; support = "cosmic_hub.contacts.support (+1)".
    const allButtons = screen.getAllByRole('button')
    const supportBtn = allButtons.find((b) =>
      b.textContent?.includes('cosmic_hub.contacts.support'),
    )
    const refuseBtn = allButtons.find((b) =>
      b.textContent?.includes('cosmic_hub.contacts.refuse'),
    )
    expect(supportBtn).toBeTruthy()
    expect(refuseBtn).toBeTruthy()
    expect((supportBtn! as HTMLButtonElement).type).toBe('button')
    expect((refuseBtn! as HTMLButtonElement).type).toBe('button')

    fireEvent.click(supportBtn!)
    expect(accept).toHaveBeenCalledWith('p-dlg-1')
    expect(refuse).not.toHaveBeenCalled()

    fireEvent.click(refuseBtn!)
    expect(refuse).toHaveBeenCalledWith('p-dlg-1')
  })
})
