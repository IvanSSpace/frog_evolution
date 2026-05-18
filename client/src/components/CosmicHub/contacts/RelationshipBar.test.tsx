// Tech-debt 2026-05-18: React Testing Library coverage for Phase 27 Plan 27-04
// RelationshipBar.
//
// Component contract (per RelationshipBar.tsx header):
//   - Tier label + color derived from getRelationshipTier(value) (1-10 input).
//   - Numeric value shown as "Math.round(value) / RELATIONSHIP_MAX" (i.e. "X / 10").
//   - Progress bar fill width = clamp(value / RELATIONSHIP_MAX, 0..1) * 100 %.
//   - On tier crossing (either via 'contacts:relationship-delta' eventBus
//     for own raceId OR prop value change) → triggers CSS pulse animation
//     for 800ms. Out of scope: not asserted here (timing-flaky w/o fake timers).
//
// What's tested (5 cases):
//   1. Numeric label renders "1 / 10" for value=1 (hostile boundary).
//   2. Tier label uses TIER_I18N_KEYS[tier] (passthrough mock makes key visible).
//   3. Fill bar width % matches (value / RELATIONSHIP_MAX) * 100, clamped 0..100.
//   4. Different score values → correct tier per spec (1→hostile, 5→neutral, 10→ally).
//   5. Out-of-range value clamps (12 → tier=ally, fill=100 %; 0 → tier=hostile, fill≈0).
//
// i18n is mocked with passthrough `t(key) => key` so we can match raw i18n keys.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RelationshipBar } from './RelationshipBar'
import { TIER_I18N_KEYS, RELATIONSHIP_MAX } from '../../../game/config/raceChains'

// Passthrough i18n mock — useTranslation().t returns its key argument verbatim,
// which lets us assert against TIER_I18N_KEYS[tier] strings directly.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru' },
  }),
}))

afterEach(() => {
  cleanup()
})

describe('RelationshipBar', () => {
  beforeEach(() => {
    // No store interactions — pure prop-driven render.
  })

  it('renders numeric value as "{value} / RELATIONSHIP_MAX"', () => {
    render(<RelationshipBar raceId="crystalloids" value={1} />)
    expect(screen.getByText(`1 / ${RELATIONSHIP_MAX}`)).toBeTruthy()
  })

  it('renders tier label for value=1 (hostile)', () => {
    render(<RelationshipBar raceId="crystalloids" value={1} />)
    // With passthrough t, tier label IS the i18n key.
    expect(screen.getByText(TIER_I18N_KEYS.hostile)).toBeTruthy()
  })

  it.each([
    [1, 'hostile'],
    [2, 'hostile'],
    [3, 'cool'],
    [4, 'cool'],
    [5, 'neutral'],
    [6, 'neutral'],
    [7, 'friendly'],
    [8, 'friendly'],
    [9, 'ally'],
    [10, 'ally'],
  ] as const)('value=%i → tier=%s', (value, expectedTier) => {
    render(<RelationshipBar raceId="crystalloids" value={value} />)
    expect(
      screen.getByText(TIER_I18N_KEYS[expectedTier]),
    ).toBeTruthy()
  })

  it('fill bar width matches (value / RELATIONSHIP_MAX) * 100 %', () => {
    const { container } = render(
      <RelationshipBar raceId="crystalloids" value={5} />,
    )
    // The fill div is the inner absolute-positioned element with width %.
    const fillDiv = container.querySelector(
      'div[style*="position: absolute"][style*="width"]',
    ) as HTMLDivElement | null
    expect(fillDiv).not.toBeNull()
    // 5 / 10 = 50 %.
    expect(fillDiv!.style.width).toBe('50%')
  })

  it('clamps fill % and tier for out-of-range values', () => {
    // value=12 — above MAX → clamps to 10 / ally / 100 % fill.
    const { container, unmount } = render(
      <RelationshipBar raceId="crystalloids" value={12} />,
    )
    expect(screen.getByText(TIER_I18N_KEYS.ally)).toBeTruthy()
    const fillHigh = container.querySelector(
      'div[style*="position: absolute"][style*="width"]',
    ) as HTMLDivElement | null
    expect(fillHigh).not.toBeNull()
    expect(fillHigh!.style.width).toBe('100%')
    unmount()

    // value=0 — below MIN → tier clamps to hostile, fill bar collapses to 0 %.
    const { container: c2 } = render(
      <RelationshipBar raceId="crystalloids" value={0} />,
    )
    expect(screen.getByText(TIER_I18N_KEYS.hostile)).toBeTruthy()
    const fillLow = c2.querySelector(
      'div[style*="position: absolute"][style*="width"]',
    ) as HTMLDivElement | null
    expect(fillLow).not.toBeNull()
    expect(fillLow!.style.width).toBe('0%')
  })
})
