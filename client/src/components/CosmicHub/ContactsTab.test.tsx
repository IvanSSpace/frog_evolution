// Tech-debt 2026-05-18: React Testing Library coverage for Phase 27 Plan 27-04
// ContactsTab.
//
// Component contract (per ContactsTab.tsx header):
//   - Renders all 10 races as buttons (RACES.length × 1 row).
//   - Pending count header text uses 'cosmic_hub.contacts.pending_count' key.
//   - Unread dot (<span aria-label="unread">) when a race has a pendingItem.
//   - Race row click → swaps view to RaceDetailView (in-tab navigation).
//   - useEffect on mount fires triggerPendingPull() once.
//
// What's tested (5 cases):
//   1. List renders exactly 10 race rows (one button per RACE).
//   2. Each row is a button[type="button"] (cliclability regression guard).
//   3. Unread dot appears ONLY on the race with a matching pendingItem.
//   4. Tapping a race row navigates to RaceDetailView (back button visible).
//   5. triggerPendingPull is called on mount (engine refill).
//
// Store seeding via useGameStore.setState — same pattern as cosmosGate.test.ts.

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

// Mount-side i18n passthrough mock — matches RelationshipBar.test.tsx pattern.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru' },
  }),
}))

// Polyfill localStorage BEFORE importing gameStore (mirrors cosmosGate.test.ts).
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

// Block server-sync HTTP calls — every persistence write would otherwise fire one.
vi.mock('../../api/gameSync', () => ({
  saveGameState: vi.fn(async () => true),
}))

// Dynamic imports — module init reads localStorage, so polyfill MUST run first.
// (Static imports get hoisted by Vite ABOVE the polyfill call → TypeError.)
type ContactsTabModule = typeof import('./ContactsTab')
type GameStoreModule = typeof import('../../store/gameStore')
type RacesModule = typeof import('../../game/config/races')
type ChainsModule = typeof import('../../game/config/raceChains')
let ContactsTab: ContactsTabModule['ContactsTab']
let useGameStore: GameStoreModule['useGameStore']
let RACES: RacesModule['RACES']
let INITIAL_RELATIONSHIP: ChainsModule['INITIAL_RELATIONSHIP']
type PendingItem = ChainsModule['PendingItem']

beforeAll(async () => {
  const ct = await import('./ContactsTab')
  ContactsTab = ct.ContactsTab
  const gs = await import('../../store/gameStore')
  useGameStore = gs.useGameStore
  const r = await import('../../game/config/races')
  RACES = r.RACES
  const c = await import('../../game/config/raceChains')
  INITIAL_RELATIONSHIP = c.INITIAL_RELATIONSHIP
})

afterEach(() => {
  cleanup()
})

function seedEmptyContactsState(triggerPullSpy: () => void = () => {}): void {
  const raceRelationships: Record<string, number> = {}
  const chainProgress: Record<string, number> = {}
  const firstContactsSeen: Record<string, boolean> = {}
  for (const r of RACES) {
    raceRelationships[r.id] = INITIAL_RELATIONSHIP
    chainProgress[r.id] = 0
    firstContactsSeen[r.id] = true // make tier label render path active
  }
  useGameStore.setState({
    raceRelationships,
    chainProgress,
    firstContactsSeen,
    pendingItems: [],
    triggerPendingPull: triggerPullSpy,
  } as unknown as Record<string, unknown>)
}

describe('ContactsTab', () => {
  beforeEach(() => {
    seedEmptyContactsState()
  })

  it('renders all 10 race rows as buttons', () => {
    render(<ContactsTab />)
    // Each row uses race.nameKey (e.g. 'races.crystalloids.name') as visible label
    // — with passthrough t, that key is the text. There are 10 such keys.
    for (const race of RACES) {
      expect(screen.getByText(race.nameKey)).toBeTruthy()
    }
    const rowButtons = screen.getAllByRole('button')
    // 10 race rows; no back button on list view.
    expect(rowButtons.length).toBe(RACES.length)
  })

  it('every race-row button has type="button" (cliclability guard)', () => {
    render(<ContactsTab />)
    const rowButtons = screen.getAllByRole('button')
    for (const btn of rowButtons) {
      expect((btn as HTMLButtonElement).type).toBe('button')
    }
  })

  it('renders unread dot only on the race with a pendingItem', () => {
    const pending: PendingItem = {
      id: 'p-1',
      raceId: 'crystalloids',
      chainStep: 0,
      item: { type: 'msg', text_key: 'races.crystalloids.chain.0.text' },
      createdAt: 1700000000000,
    }
    useGameStore.setState({ pendingItems: [pending] } as unknown as Record<
      string,
      unknown
    >)
    render(<ContactsTab />)
    const unreadDots = screen.getAllByLabelText('unread')
    expect(unreadDots.length).toBe(1)
  })

  it('tapping a race row navigates to RaceDetailView (back button visible)', () => {
    render(<ContactsTab />)
    const firstRaceRow = screen.getByText(RACES[0].nameKey).closest('button')
    expect(firstRaceRow).not.toBeNull()
    fireEvent.click(firstRaceRow!)
    // RaceDetailView renders an aria-label="Back" arrow button.
    expect(screen.getByLabelText('Back')).toBeTruthy()
  })

  it('calls triggerPendingPull on mount', () => {
    const spy = vi.fn()
    seedEmptyContactsState(spy)
    render(<ContactsTab />)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
