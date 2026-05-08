---
phase: 13-element-awakened-tiers
plan: 01
subsystem: effects/elements
tags: [overlay, awakened, presets, types, burst]
requires:
  - phase-12 (FrogElementOverlay dormant + pool + manager)
  - phase-09 (anim primitives shared)
provides:
  - 5-tier ElementTier union
  - 64 awakened preset functions (4 tiers × 16 elements)
  - scheduleAwakenedIdle()
  - burstEffect() one-shot
key-files:
  created:
    - client/src/game/effects/elements/awakenedPresets.ts
    - client/src/game/effects/elements/burstEffect.ts
  modified:
    - client/src/game/effects/elements/types.ts
decisions:
  - Build presets through Element-key×Tier-rule helper to avoid 64-literal explosion (bundle budget)
  - Validate tier in scheduleAwakenedIdle — fallback to 'common' on tampered input (T-13-01)
  - Single buildFakeSys helper (T-13-budget mitigation)
metrics:
  duration_minutes: 6
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  completed_at: "2026-05-08"
---

# Phase 13 Plan 01: Awakened Tier Foundation Summary

5-tier ElementTier union + 64 awakened preset functions (rule-based to keep bundle compact) + one-shot burstEffect for ELEMENT-10.

## What was built

- **types.ts**: ElementTier expanded to `'dormant' | 'common' | 'rare' | 'epic' | 'legendary'`. Exported `ELEMENT_TIERS` and `AWAKENED_TIERS` arrays for downstream iteration (pool keys, validation).
- **awakenedPresets.ts**: 4 × 16 = 64 preset entries assembled via rule-based composition:
  - `ELEMENT_CORE` (core motif per element)
  - `ELEMENT_GLOW` (rare+ aura — usually compHaloFlash)
  - `ELEMENT_ACCENT` (rare+ secondary motif)
  - `ELEMENT_STORM` (legendary-only third layer)
  - `buildPresetForTier(element, tier)` assembles the per-tier list. War common is special-cased (2× compFlash without sys), legendary war/ring/arcane get extra primitives.
  - Tier params: common (size 8, b=0.55, 2500ms) → rare (10, 0.70, 2000ms) → epic (13, 0.85, 1500ms) → legendary (16, 1.0, 1000ms).
  - `scheduleAwakenedIdle(scene, container, element, tier, opts?)` returns OverlayLifecycle; protects with try/catch and tier validation.
  - Convenience records exported: COMMON_PRESETS, RARE_PRESETS, EPIC_PRESETS, LEGENDARY_PRESETS.
- **burstEffect.ts**: `burstEffect(scene, container, element)` — one-shot 200-400ms blast (compRing + compSparkle + compFlash, plus compStarBurst for arcane/war/void/plasma). Self-cleanup via primitive tween onComplete.

## Tasks

| Task | Status | Commit | Notes |
|------|--------|--------|-------|
| 1. Expand ElementTier to 5-tier union | ✓ | c4b1980 | + AWAKENED_TIERS / ELEMENT_TIERS |
| 2. awakenedPresets.ts (64 entries + scheduleAwakenedIdle) | ✓ | e94eb3d | Rule-based assembly to keep gzip small |
| 3. burstEffect.ts (ELEMENT-10 foundation) | ✓ | 6397de8 | Self-cleaning one-shot |

## Verification

- `npx tsc --noEmit` → 0 errors after each task
- 16 elements × 4 awakened tiers = 64 entries (verified at build time via `buildPresetForTier` switch)
- AWAKENED_TIERS readonly array exported

## Deviations from Plan

None — plan executed as written. The plan's rule-based mapping was followed; ground-offset variation was simplified per plan's "ground offset не нужен — просто sys.size scaling" guidance (primitives render relative to container.x/y).

## Threat mitigations

- **T-13-01**: tier validated against `VALID_AWAKENED_SET`; falls back to 'common' on bad input.
- **T-13-02 (DoS legendary 8+ primitives × 4 visible)**: hard cap from Phase 12 still applies; 32 primitive calls/tick × 1000ms interval = within ELEMENT-09 budget.
- **T-13-03**: burstEffect creates Phaser objects only — no state/network mutation.

## Self-Check: PASSED

- types.ts updated and includes 'dormant' | 'common' | 'rare' | 'epic' | 'legendary' — FOUND
- awakenedPresets.ts exists and exports COMMON_PRESETS/RARE_PRESETS/EPIC_PRESETS/LEGENDARY_PRESETS/scheduleAwakenedIdle — FOUND
- burstEffect.ts exists and exports burstEffect — FOUND
- All three commits exist: c4b1980, e94eb3d, 6397de8 — FOUND
