---
phase: tech-debt
plan: affinity-mapping-fix
subsystem: cosmic-frogs
tags: [habitable-planets, affinity-matching, mapping-table, phase26, deferred-bug]
date: 2026-05-18

# Dependency graph
requires:
  - phase: 26-01
    provides: RaceId union + RACES with affinity field
  - phase: 26-02
    provides: select_habitable_planets.cjs (seed=19450718, Mulberry32 PRNG)
  - phase: 12
    provides: ARCHETYPE_TO_ELEMENT in elementMapping.ts (mirrored in this fix)
provides:
  - "PLANET_TYPE_TO_ELEMENT mapping table (15 of 18 type literals → Element union)"
  - "planetToElement(planet) helper (archetype-first, type-fallback)"
  - "Regenerated planetMap.json with 27/30 affinity-matched habitable planets (was 0)"
  - "10/10 race home planets now affinity-matched (was 0/10)"
affects:
  - "26-03 star map glow rendering — race home planets visually align с архетипом"
  - "26-05 first contact controller — affinity-correct race-planet pairings"
  - "Future phases с race-affinity gameplay logic — accurate baseline"

# Tech tracking
tech-stack:
  added: []  # Pure script + data change, no new libraries
  patterns:
    - "Archetype-first → type-fallback mapping для bridging type literal namespace и Element union"
    - "Idempotent regeneration через existing deterministic Mulberry32 seed"

key-files:
  modified:
    - client/scripts/select_habitable_planets.cjs
    - client/src/game/data/planetMap.json

# Phase 26 affinity-matching deferred bug fix Summary

## One-liner

Bridges `planetMap.type` literal namespace to 16-Element union via
archetype-first / type-fallback mapping table, restoring race-affinity
selection for 27 of 30 habitable planets (was 0).

## Problem

Phase 26-02 selection script compared `planet.type === race.affinity`
directly. But the two namespaces don't overlap:

- **planet.type literals (18 values):** aerial, ancient, aquatic, crystal,
  crystal_bio, destroyed, empty (38), energy, forge, hostile (147),
  mechano, military, mist, mystic, organic, resource (149), rocky, shadow.
- **race.affinity values (Element union, 16):** fire, ice, water, forest,
  toxic, plasma, shadow, crystal, desert, gas, ring, binary, arcane,
  mechanical, war, void.

Only `crystal` and `shadow` overlap by name. With only 1 planet per
literal-overlap key, no race ever hit the `matching.length >= 3` threshold
to skip the fallback branch. Result: **0/10 races affinity-matched;
all 10 went through PRNG fallback** (see deferred note in `.planning/STATE.md`).

## Fix

Added two mapping tables to `client/scripts/select_habitable_planets.cjs`
plus a `planetToElement(planet)` helper:

1. **`ARCHETYPE_TO_ELEMENT`** — mirror of Phase 12
   `elementMapping.ts` (12 keys: `lava→fire`, `dead→shadow`, `mineral→crystal`,
   `gas_giant→gas`, `binary→binary`, `forest→forest`, `ocean→water`, etc.).
   Used for BG planets (`bg_*`), which carry the `archetype` field.

2. **`PLANET_TYPE_TO_ELEMENT`** — 15 named-planet type literals → Element.
   Used as fallback when `archetype` is absent (named main-race planets).
   Two deliberate divergences from `elementMapping.ts`:
   - `ancient → void` (not `arcane`) — no race has `affinity=arcane`;
     timeweavers.affinity=void и `cairn` (only ancient-type) подходит.
   - `military → fire` (not `war`) — no race has `affinity=war`;
     fireworms.affinity=fire и military-планеты подчёркивают
     лор «огнечервы воинственные».

Then the matching pool filter became:
```js
planets.filter(p => planetToElement(p) === race.affinity && ...)
```

## Outcome

| Metric                             | Before fix | After fix |
|------------------------------------|-----------:|----------:|
| Races with affinity-matched pool   |       0/10 |      8/10 |
| Home planets affinity-matched      |       0/10 |     10/10 |
| Total habitable planets matched    |       0/30 |     27/30 |
| Races in PRNG fallback branch      |      10/10 |      2/10 |

The 2 fallback races (mechanidons / timeweavers) have pools of 2 planets
each (below the shuffle threshold of 3); their 3rd planet is PRNG-picked
from the unassigned non-'home' pool. Both nevertheless have their
**home planet** affinity-matched (`drave` for mechanidons via `rocky→mechanical`,
`cairn` for timeweavers via `ancient→void`) — это самые видимые планеты.

### Per-race home verification (after fix)

| Race          | Affinity   | Home planet | Source field          | Mapping                |
|---------------|------------|-------------|-----------------------|------------------------|
| crystalloids  | crystal    | bg_908      | archetype=mineral     | mineral → crystal      |
| gasouls       | gas        | bg_772      | archetype=gas_giant   | gas_giant → gas        |
| mechanidons   | mechanical | drave       | type=rocky            | rocky → mechanical     |
| fireworms     | fire       | bg_602      | archetype=lava        | lava → fire            |
| liquidoids    | water      | bg_444      | archetype=ocean       | ocean → water          |
| tenebrians    | shadow     | bg_753      | archetype=dead        | dead → shadow          |
| plasmaspirits | plasma     | bg_137      | archetype=plasma      | plasma → plasma        |
| forestcores   | forest     | bg_915      | archetype=forest      | forest → forest        |
| timeweavers   | void       | cairn       | type=ancient          | ancient → void         |
| cometfolk     | binary     | bg_488      | archetype=binary      | binary → binary        |

All 10 ✓.

## Verification

### Build chain (in agent worktree with symlinked node_modules)

- **vitest `src/game/data/habitablePlanets.test.ts`:** 7/7 PASS
  - 30 habitable planets total ✓
  - Every race: 1 home + 2 colonies ✓
  - Total 10 home + 20 colony ✓
  - id="home" never inhabitant ✓
  - getPlanetInhabitant returns undefined for unknown id ✓
  - HABITABLE_PLANET_IDS Set size 30, membership matches ✓
  - All 30 IDs unique ✓

- **TypeScript `tsc --noEmit`:** clean (no errors)

- **Full vitest suite:** 117 passed / 1 skipped / 3 file-level FAIL.
  The 3 file failures are pre-existing Phase 22 issues documented in
  `.planning/phases/26-cosmos-races-foundation/deferred-items.md`
  (cosmicSettings.test.ts suite import, slice.openBox.test.ts "fire serum",
  slice.test.ts "fire serum incremented"). Counts identical to baseline
  before this fix.

- **ESLint on touched script:** 2 errors at lines 79-80
  (`@typescript-eslint/no-var-requires` on the original
  `const fs = require('fs'); const path = require('path')`). These are
  pre-existing in the .cjs file since its initial Phase 26-02 commit;
  not caused by this fix. Out of scope per executor scope boundary.

### Determinism check

Re-ran the script (`node client/scripts/select_habitable_planets.cjs`)
multiple times; output identical each run (Mulberry32 seed=19450718 +
fixed RACE_ORDER → identical Fisher-Yates sequence).

### Idempotency

Script clears any pre-existing `inhabitant` fields before re-selecting
(line `if (p.inhabitant !== undefined) delete p.inhabitant`). Re-running
on already-populated planetMap.json yields the same final state.

## Project constraints satisfied

- [x] Selection остаётся deterministic (Mulberry32 seed 19450718).
- [x] Mapping table обоснован — comment block в script + this SUMMARY.
- [x] `habitablePlanets.test.ts`: 7/7 PASS (всех 7 инвариантов).
- [x] Build chain passes (tsc + lint*+ vitest). *Pre-existing lint errors
      on .cjs require statements documented as out-of-scope.
- [x] Atomic commits (1 mapping logic + 1 regen + 1 SUMMARY).
- [x] No frontend changes — pure data + script.
- [x] i18n parity preserved (no new keys).
- [x] No STATE.md / ROADMAP.md edits (per success criteria).

## Deviations from plan

None. The fix shape matched the planned mapping-table approach. Single
implementation choice worth noting: I made the mapping **archetype-first
with type-fallback** (rather than type-only as suggested in the brief),
because BG planets (335 of 350) carry an `archetype` field that already
has a canonical 1-to-1 Element mapping via Phase 12 `elementMapping.ts`.
Reusing that established mapping is more semantically faithful — BG
planets' `type` field is coarse (`hostile`/`resource`/`empty`) while
their `archetype` is the actual element source. The new
`PLANET_TYPE_TO_ELEMENT` only matters for the 14 named main-race
planets (no `archetype` field).

## Out-of-scope discoveries (not fixed)

1. **Worktree node_modules absent.** Agent worktrees don't carry a
   `client/node_modules/` tree; build/test commands fail with module
   resolution errors until one is provided. Resolved locally by
   symlinking the main worktree's `client/node_modules/` —
   non-destructive (symlink in agent worktree only, not committed,
   listed in `.gitignore`). Worth documenting in `.planning/SETUP.md`
   or worktree creation flow for future agents.

2. **Pre-existing lint errors in select_habitable_planets.cjs**
   (lines 79-80, `@typescript-eslint/no-var-requires`). The file is a
   Node CJS script (`.cjs` extension) so `require()` is canonical,
   but ESLint config doesn't exempt `.cjs` files. Out of scope; can be
   addressed by adding `*.cjs` to `eslint.config.js` override blocks.

## Self-Check: PASSED

Files exist:
- FOUND: /Users/shar/Documents/frog_evolution/frog_evolution_code/.claude/worktrees/agent-ae433036ab2a6b454/client/scripts/select_habitable_planets.cjs
- FOUND: /Users/shar/Documents/frog_evolution/frog_evolution_code/.claude/worktrees/agent-ae433036ab2a6b454/client/src/game/data/planetMap.json
- FOUND: /Users/shar/Documents/frog_evolution/frog_evolution_code/.claude/worktrees/agent-ae433036ab2a6b454/.planning/tech-debt/2026-05-18-affinity-mapping-fix-SUMMARY.md

Commits exist:
- FOUND: d7d70d7 fix(26-02): add planet→Element mapping to fix affinity matching
- FOUND: c61e5c5 chore(26-02): regenerate planetMap.json with affinity-matched habitable planets
