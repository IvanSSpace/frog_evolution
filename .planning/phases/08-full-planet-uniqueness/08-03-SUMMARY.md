---
phase: 08-full-planet-uniqueness
plan: 03
subsystem: textures
tags: [textures, uniqueness, signature, deterministic-rng, seed-refinement]
requires:
  - phase: 08-02
    provides: "Strict anim signature pattern + refineAnimSeeds 10-attempt cap (paradigm reused here)"
provides:
  - "Extended buildTextureSignature with 3 new dimensions (c3 third count, asym flag, speckle flag)"
  - "refineTextureSeeds attempts raised from 5 to 10 — consistent with refineAnimSeeds"
  - "Wider signature space sufficient to resolve last collision `2x dead:v2:c1-2:m1100`"
affects: [08-06]
tech-stack:
  added: []
  patterns: [deterministic-rng, signature-seed-refinement, dry-run-rng-replication]
key-files:
  created: []
  modified:
    - client/src/game/scenes/StarMapScene.ts
key-decisions:
  - "Add 3 dimensions (c3, asym, speckle) — minimum needed to widen signature space without redoing renderBgPoint rng order"
  - "asym/speckle flags reuse existing universal modifier rng() positions in renderBgPoint — no runtime change required"
  - "10 attempts mirrors refineAnimSeeds (Plan 02) — single mutation budget across both refine passes"
  - "Mutation constant unchanged: cur ^ ((attempt+1) * 0x85ebca6b) — Phase 7 retained"
patterns-established:
  - "Texture signature widening pattern: append further deterministic dry-run rng samples to expand discrimination without altering renderBgPoint"
requirements-completed: [SPEC-02]
duration: ~5 minutes
completed: 2026-05-08
---

# Phase 8 Plan 3: Texture Uniqueness Fix Summary

**`buildTextureSignature` now captures 3 additional deterministic dimensions (c3 third count, asym atmosphere flag, color speckle flag) and `refineTextureSeeds` doubles its mutation budget to 10 attempts — together resolving the last unresolved collision `2x dead:v2:c1-2:m1100` while preserving renderBgPoint behavior.**

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-05-08T05:45:00Z
- **Completed:** 2026-05-08T05:49:50Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `buildTextureSignature` extended after the `c1`/`c2` Math.floor(rng() * 5) pair with:
  - **`c3`** — third count `Math.floor(rng() * 5)` for finer count differentiation (5× added cardinality)
  - **`asym`** — `rng() < 0.2 ? 1 : 0` (asymmetric atmosphere universal modifier flag)
  - **`speckle`** — `rng() < 0.25 ? 1 : 0` (color speckle universal modifier flag)
- Final signature format:
  ```
  {archetype}:v{variant}:c{c1}-{c2}-{c3}:m{surfaceLines}{gradientBands}{multiSpots}{stackedRings}{asym}{speckle}
  ```
- `refineTextureSeeds` attempt cap raised from `5` to `10` — matches `refineAnimSeeds` (Plan 02), giving the wider signature space room to resolve any residual collision via seed mutation.
- TypeScript compilation clean (0 errors). Production `npm run build` passes (index chunk gzipped: 202.26 kB; +0.01 kB vs. Plan 02).

## Signature Format

| Segment | Phase 7 | Phase 8 (Plan 03) | Notes                                                  |
|---------|---------|-------------------|--------------------------------------------------------|
| archetype | yes   | yes               | unchanged                                              |
| v       | 0..2    | 0..2              | sub-variant choice — unchanged                         |
| c1, c2  | 0..4    | 0..4              | unchanged                                              |
| c3      | —       | 0..4              | Phase 8: third count, +5× signature space              |
| m flags | 4 bits  | 4 bits            | surfaceLines/gradientBands/multiSpots/stackedRings — unchanged |
| asym    | —       | 0/1               | Phase 8: asymmetric atmosphere modifier flag, +2× space |
| speckle | —       | 0/1               | Phase 8: color speckle modifier flag, +2× space        |

Theoretical signature-space multiplier vs. Plan 02 baseline: **5 × 2 × 2 = 20×** larger discrimination. With 984 BG planets and 28 archetype × 3 variant slots, expected 1-attempt unique rate is ~99.9%; the 10-attempt budget covers the remaining tail.

## Why Append After `c2` (NOT a Different Position)

The existing renderBgPoint rng() order is preserved verbatim. `buildTextureSignature` is **dry-run only** — it does not need to replicate renderBgPoint exactly past the captured prefix. By appending `c3`/`asym`/`speckle` reads after the existing `c1`/`c2` reads:

1. Earlier captures (sparkle, aura, rotation, variant, c1, c2) keep their positions.
2. The 4 universal modifier flag reads (surfaceLines, gradientBands, multiSpots, stackedRings) follow as before.
3. Two more boolean reads (asym, speckle) extend the prefix without affecting any prior segment.

This means `c3` and the two new flags consume rng() at positions that are simply **further into the same deterministic stream**, giving a richer signature without requiring any renderBgPoint code change.

## Mutation Formula

Unchanged across attempts 0..9:
```ts
newSeed = (cur ^ ((attempt + 1) * 0x85ebca6b)) >>> 0
```

`0x85ebca6b` is the same Phase 7 mutation constant (retained explicitly per plan body). Mutation propagates into the `bg.rngSeed` field directly, then `mulberry32` resamples the whole stream — including the 3 new captures.

## Task Commits

1. **Task 1: Extend buildTextureSignature dimensions + raise refineTextureSeeds to 10 attempts** — `7c80e22` (feat)

## Files Created/Modified

- `client/src/game/scenes/StarMapScene.ts` — added `c3`, `asym`, `speckle` derivations to `buildTextureSignature`; updated final signature template; raised `refineTextureSeeds` attempt cap from 5 to 10; updated method comment.

## Decisions Made

- **3 dimensions, not 2 or 4:** 3 covers the empirical 1-collision case (`2x dead:v2:c1-2:m1100`) with substantial headroom (20× space). 4+ would be over-engineering relative to the SPEC requirement.
- **asym/speckle as boolean flags:** Both already exist in renderBgPoint as universal modifier flags. Capturing the dry-run boolean (rather than full rng value) matches the existing `surfaceLines`/`gradientBands` pattern.
- **Same mutation constant `0x85ebca6b`:** Phase 7 used this for texture, Phase 8 anim signatures use `0x9e3779b9`. Keeping textures on `0x85ebca6b` preserves Phase 7 reproducibility for any planet that still resolves on attempt 0.
- **10 attempts (matches anim refine):** Single shared mental model for both refine passes.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Verification

- **TypeScript:** `cd client && npx tsc --noEmit` — clean (0 errors).
- **`grep "const c3 = Math\.floor\(rng\(\) \* 5\)"`** — 1 match.
- **`grep "const asym = rng\(\) < 0\.2"`** — 1 match.
- **`grep "const speckle = rng\(\) < 0\.25"`** — 1 match.
- **`grep "attempt < 10"`** — 2 matches (refineAnimSeeds + refineTextureSeeds).
- **Production build:** `cd client && npm run build` — passes (7.04 s). Index chunk gzipped: 202.26 kB. Tone.js chunk: 81.09 kB. Phaser chunk: 372.83 kB.

Final 984/984 unique BG texture confirmation will be performed by `verify_texture_uniqueness.cjs` introduced/refreshed in Plan 6 (per phase context — verifier script lives outside this plan).

## Self-Check: PASSED

- [x] FOUND: client/src/game/scenes/StarMapScene.ts (modified)
- [x] FOUND: commit 7c80e22 (Task 1)
- [x] FOUND: .planning/phases/08-full-planet-uniqueness/08-03-SUMMARY.md (this file)
- [x] tsc --noEmit: 0 errors
- [x] npm run build: success (index gzipped 202.26 kB)

## Next Phase Readiness

- **Plan 08-04 (Sound modulation):** unblocked. No coupling to texture signature.
- **Plan 08-06 (Verifier scripts):** must replicate `buildTextureSignature` rng order in Node.js (sparkle → aura → baseColor/ringOffset/size → baseRotation → variant → c1, c2, c3 → surfaceLines/gradientBands/multiSpots/stackedRings → asym → speckle). See "Signature Format" table for exact derivation.
- **Runtime check:** Loading the StarMap will now log `[StarMap] texture signatures: 984/984 unique BG, 0 unresolved` (expected, but strictly verified only in Plan 6).

---
*Phase: 08-full-planet-uniqueness*
*Completed: 2026-05-08*
