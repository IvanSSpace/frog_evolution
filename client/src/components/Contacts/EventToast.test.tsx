// Tech-debt 2026-05-18: React Testing Library coverage for Phase 27 Plan 27-05
// EventToast + EventToastController.
//
// Contracts:
//   - EventToast renders raceEmoji + composed i18n message + delta with sign;
//     calls onDismiss(id) after AUTO_DISMISS_MS (=3000) via setTimeout.
//   - EventToastController subscribes to eventBus 'contacts:event-applied',
//     pushes new toasts into queue, caps at MAX_VISIBLE=3 (older entries
//     dropped from the front).
//
// What's tested (5 cases):
//   1. EventToast renders race name (i18n passthrough), description (text_key),
//      and signed delta string (e.g. "+2", "-1").
//   2. Unknown raceId → renders fallback emoji ❓ and uses raceId string as name.
//   3. EventToast auto-dismisses after AUTO_DISMISS_MS (fake timers).
//   4. EventToastController appears on 'contacts:event-applied' event —
//      one matching toast rendered (test the message body presence).
//   5. EventToastController caps queue at 3 visible — emitting 5 events
//      leaves exactly 3 toasts on screen (oldest dropped).
//
// Fake timers used for the auto-dismiss test only. Other tests use real timers
// to avoid mocking eventBus dispatch order.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Template-aware passthrough — keeps original key visible AND embeds
    // interpolated vars so we can assert specific values from the toast.
    t: (key: string, vars?: Record<string, string | number>) => {
      if (vars && Object.keys(vars).length > 0) {
        const parts = Object.entries(vars)
          .map(([k, v]) => `${k}=${v}`)
          .join('|')
        return `${key}{${parts}}`
      }
      return key
    },
    i18n: { language: 'ru' },
  }),
}))

type EventToastModule = typeof import('./EventToast')
type ControllerModule = typeof import('./eventToastController')
type EventBusModule = typeof import('../../store/eventBus')
let EventToast: EventToastModule['EventToast']
let EventToastController: ControllerModule['EventToastController']
let eventBus: EventBusModule['eventBus']

beforeAll(async () => {
  const a = await import('./EventToast')
  EventToast = a.EventToast
  const b = await import('./eventToastController')
  EventToastController = b.EventToastController
  const c = await import('../../store/eventBus')
  eventBus = c.eventBus
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('EventToast', () => {
  it('renders race name, description, and signed delta', () => {
    const onDismiss = vi.fn()
    render(
      <EventToast
        id="t-1"
        raceId="crystalloids"
        delta={2}
        textKey="cosmos.event.ritual_disrupted"
        onDismiss={onDismiss}
      />,
    )
    // The composed message uses cosmos.event.notification with raceName / description / delta.
    // Passthrough mock embeds vars: 'cosmos.event.notification{raceName=...|description=...|delta=+2}'.
    const body = document.body.textContent ?? ''
    expect(body).toContain('cosmos.event.notification')
    expect(body).toContain('raceName=races.crystalloids.name')
    expect(body).toContain('description=cosmos.event.ritual_disrupted')
    expect(body).toContain('delta=+2')
    // Signed delta also shown as standalone numeric badge "+2".
    expect(screen.getByText('+2')).toBeTruthy()
  })

  it('unknown raceId falls back to ❓ emoji and raw id as name', () => {
    render(
      <EventToast
        id="t-unk"
        raceId="non-existent-race"
        delta={-1}
        textKey="cosmos.event.something"
        onDismiss={vi.fn()}
      />,
    )
    const body = document.body.textContent ?? ''
    expect(body).toContain('❓')
    // raceName var falls back to the literal raceId string.
    expect(body).toContain('raceName=non-existent-race')
    expect(screen.getByText('-1')).toBeTruthy()
  })

  it('auto-dismisses via setTimeout after AUTO_DISMISS_MS (3000ms)', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(
      <EventToast
        id="t-dismiss"
        raceId="crystalloids"
        delta={1}
        textKey="cosmos.event.x"
        onDismiss={onDismiss}
      />,
    )
    // Before the timer elapses → no dismiss.
    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    // After AUTO_DISMISS_MS (3000) → dismiss fired with id.
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith('t-dismiss')
  })
})

describe('EventToastController', () => {
  beforeEach(() => {
    // Ensure no listeners or queued toasts leak between tests.
    eventBus.all.clear()
  })

  it('renders a toast when contacts:event-applied is emitted', () => {
    render(<EventToastController />)
    act(() => {
      eventBus.emit('contacts:event-applied', {
        raceId: 'crystalloids',
        targetRaceId: 'crystalloids',
        delta: -1,
        textKey: 'cosmos.event.ritual_disrupted',
      })
    })
    const body = document.body.textContent ?? ''
    expect(body).toContain('cosmos.event.notification')
    expect(body).toContain('description=cosmos.event.ritual_disrupted')
  })

  it('caps queue at MAX_VISIBLE=3 (older toasts trimmed)', () => {
    render(<EventToastController />)
    act(() => {
      for (let i = 0; i < 5; i++) {
        eventBus.emit('contacts:event-applied', {
          raceId: 'crystalloids',
          targetRaceId: 'crystalloids',
          delta: 1,
          // Unique text_key per toast so we can count distinct rendered messages.
          textKey: `cosmos.event.fixture.${i}`,
        })
      }
    })
    // Each toast renders a description=cosmos.event.fixture.<n> substring.
    // Only the last 3 (indices 2,3,4) should be visible.
    const body = document.body.textContent ?? ''
    expect(body).toContain('cosmos.event.fixture.2')
    expect(body).toContain('cosmos.event.fixture.3')
    expect(body).toContain('cosmos.event.fixture.4')
    expect(body).not.toContain('cosmos.event.fixture.0')
    expect(body).not.toContain('cosmos.event.fixture.1')
  })
})
