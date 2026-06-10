// MergeController.unify.test.ts
//
// CUT30-UNIFY-MERGE — static-source regression coverage for Plan 30-07.
//
// WHY STATIC-SOURCE (not behavioral):
// MergeController.performMerge() is deeply coupled to a live Phaser.Scene:
//   - it calls scene.time.delayedCall() for the entire merge resolution block
//   - it calls this.spawner.spiralFrogTo(), this.spawnVortexParticles(),
//     this.flashAt() — all requiring Phaser GameObjects and Tweens
//   - the L6+L6 and L12+L12 resolution callbacks live INSIDE scene.time.delayedCall
//     and call this.spawner.removeFrog(a/b) before the store mutations
//
// Building a faithful mock-Phaser harness for this would require stubbing
// Phaser.Scene, Phaser.GameObjects, Phaser.Time, FrogSpawner, FrogData shapes
// and the animation pipeline — disproportionate effort for a deletion test.
//
// BEHAVIORAL PROOF deferred to: Plan 30-09 manual smoke steps.
//   - Smoke step S-07: L6+L6 merge on Loc1 → L7 appears, NO ectoplasm change
//   - Smoke step S-08: L12+L12 merge on Loc2 → L13 appears, NO currencyY change
//   - Smoke step S-09: Loc2 still unlocks on first L6+L6 (markDiscovered(7) path)
//   - Smoke step S-10: Loc3 still unlocks on first L12+L12 (markDiscovered(13) path)
//
// STATIC ASSERTIONS (this file): verify that the source code does NOT contain
// the removed symbols, and DOES still contain the location-unlock logic.

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const SRC_PATH = path.resolve(__dirname, 'MergeController.ts')
const src = fs.readFileSync(SRC_PATH, 'utf-8')

describe('MergeController.unify — CUT30-UNIFY-MERGE source assertions', () => {
  it('addEctoplasm is NOT referenced in MergeController', () => {
    expect(src).not.toContain('addEctoplasm(')
  })

  it('flashEctoplasm is NOT referenced in MergeController', () => {
    expect(src).not.toContain('flashEctoplasm(')
  })

  it('addCurrencyY is NOT referenced in MergeController', () => {
    expect(src).not.toContain('addCurrencyY')
  })

  it('ECTO_PER_L6MERGE constant does NOT exist', () => {
    expect(src).not.toContain('ECTO_PER_L6MERGE')
  })

  it('CURRENCY_Y_PER_L12MERGE constant does NOT exist', () => {
    expect(src).not.toContain('CURRENCY_Y_PER_L12MERGE')
  })

  it('markDiscovered appears >= 2 times (location unlock path preserved)', () => {
    const matches = (src.match(/markDiscovered\(/g) ?? []).length
    expect(matches).toBeGreaterThanOrEqual(2)
  })

  it('markDiscovered(7) call is present (Loc2 unlock)', () => {
    expect(src).toContain('markDiscovered(7)')
  })

  it('markDiscovered(13) call is present (Loc3 unlock)', () => {
    expect(src).toContain('markDiscovered(13)')
  })

  it('location:unlocked event emission is present', () => {
    expect(src).toContain("location:unlocked")
  })
})
