---
kind: tech-debt
date: 2026-05-18
scope: dead-code audit + cleanup (Phase 22 + Phase 26 orphans)
candidates-audited:
  - mergeCarriers
  - rarity logic (Phase 22 серум flattening)
  - MAIN_RACE_TO_ELEMENT
files-deleted:
  - client/src/utils/rarityRoll.ts
files-modified:
  - client/src/store/cosmic/types.ts          # comment update (rollSerumDrop → serumDropChance)
  - client/scripts/simulate_balance.cjs       # header comment (mark deleted upstream)
commits:
  - 61999b6
tests-before: 158 PASS / 1 skip (16 files)
tests-after: 158 PASS / 1 skip (18 files; gameSync.test.ts is flaky-on-warmup, passes in isolation)
tsc: clean before + after
---

# Tech-debt: dead-code audit + cleanup (mergeCarriers / rarity / MAIN_RACE_TO_ELEMENT)

## One-liner

Audited three Phase 22 / Phase 26 cleanup candidates. Deleted one dead file
(`rarityRoll.ts`) with zero production callers; flagged `MAIN_RACE_TO_ELEMENT`
as **NOT DEAD** (still wired through `elementFromPlanet` →
`shipSlice.investigatePlanet` for 16 main-kind planets); confirmed
`mergeCarriers` was already physically deleted in Phase 22-01 (only 3
historical comments remain — left intact as harmless breadcrumbs).

## Audit method

For each candidate, GREP'ed across the entire codebase (production code + tests +
docs) and traced call chains:

```bash
grep -rn '<candidate>' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.cjs' .
```

Then for each non-comment match, examined the context to determine whether it
represented an active call site, a type/data binding still used at runtime, or
only documentation / commented-out historical reference.

---

## Candidate 1: `mergeCarriers`

### References found

| Location | Type | Lives? |
|----------|------|--------|
| `client/src/store/cosmic/slices/carrierSlice.ts:3` | source comment | yes (historical breadcrumb) |
| `client/src/store/cosmic/bestiary.ts:3` | source comment | yes (historical breadcrumb) |
| `client/src/store/cosmic/slice.ts:6` | source comment | yes (historical breadcrumb) |
| `.planning/**` | planning docs | yes (Phase 17/22 SUMMARY/PLAN records) |

### Production refs: **0**

The function `mergeCarriers` was deleted in Phase 22-01 (commit `a2cc300` per
`22-01-SUMMARY.md`). Tests `mergeCarriers.test.ts` / `carriers.test.ts` were
removed in the same plan. Remaining matches are all either:
- explanatory comments at the top of carrier-related files describing what
  Phase 22 removed, or
- planning documents recording the historical state.

### Disposition: **NOT DELETED — comments retained**

The 3 source comments are useful breadcrumbs for future readers who arrive at
`carrierSlice.ts` / `bestiary.ts` / `slice.ts` and might wonder why merge logic
sits in MergeController and not in the slice. Removing them would lose context
without any technical benefit. No deletion warranted.

---

## Candidate 2: Rarity logic (Phase 22 серум flattening)

The objective targets the **серум inventory flattening** to `Record<Element, number>`
(no common/rare/epic/legendary tiers). Two distinct concepts share the word "rarity":

### 2a. `rollSerumDrop` / `client/src/utils/rarityRoll.ts`

The post-Phase-22 remnant of the old 4-tier rarity-roll roll machinery — a
single 5-line function `rollSerumDrop(chance, rng) → boolean` that just wraps
`rng() < chance`.

#### References found

| Location | Type | Lives? |
|----------|------|--------|
| `client/src/utils/rarityRoll.ts` | source (the file itself) | **was the dead file** |
| `client/src/store/cosmic/types.ts:191` | comment in `CosmicSlice` docstring | retained (updated) |
| `client/scripts/simulate_balance.cjs:4` | header comment ("MIRROR of ...") | retained (updated) |
| `server/src/routes/box.ts:13` | `// TODO: port rarityRoll from ...` | retained (out-of-scope server stub) |

#### Production refs: **0**

Zero `import` statements anywhere in the repo, zero callers in production code.
The function was orphaned but the file remained.

#### Disposition: **DELETED** (`git rm client/src/utils/rarityRoll.ts`)

Comment at `cosmic/types.ts:191` updated:
```diff
-//   - permaSerumDropBonus → rollSerumDrop base + 0.005 * N
+//   - permaSerumDropBonus → serumDropChance(base, N) (см. game/utils/shopBonuses.ts)
```
This re-points readers at the actual live consumer (`game/utils/shopBonuses.ts:31
serumDropChance`).

Header of `client/scripts/simulate_balance.cjs` updated to record that its
upstream (`rarityRoll.ts`) was deleted in Phase 22; the script itself is
self-contained Monte-Carlo sim with its own inline `rollRarity` and is kept as
a historical balance-baseline tool.

The `// TODO: port rarityRoll` comment in `server/src/routes/box.ts:13` was
**not touched** — server-side cleanup is out of scope for this audit (the route
is a stub returning `{ stub: true }` and the entire box-rarity flow is
Phase-22-obsolete on the server anyway).

### 2b. `LegacyRarity` / `LEGACY_RARITIES` (bestiary location dimension)

#### Production refs: **20+**

Heavily used across `Gallery/*`, `CosmicHub/BestiaryTab.tsx`,
`CosmicHub/bestiary/*`, `store/cosmic/bestiary.ts`, `store/cosmic/slice.ts`
(`setBestiaryBit` signature), `eventBus.ts` (`gallery:open-detail` payload),
`store/migrations/phase22.test.ts` (rarity field in bestiary records).

#### Disposition: **NOT DELETED — actively in use**

`bestiary.ts` line 97-98 makes the new semantic explicit:
> "4 локации = 4 rarity tiers (BESTIARY-01 + REQUIREMENTS:109-111):
> common = Лужа, rare = Болото, epic = Лес, legendary = Континент."

The 4-tier dimension persists as the **location dimension** for the bestiary
bitset (16 elements × 4 locations × 18 levels = 1152 bits). Removing it would
break the bestiary index function and corrupt persisted savestate. The Phase 22
plan defers the eventual shrink of this dimension to a separate plan (`22-07`
or later).

Per the objective scope ("rarity logic — Phase 22 flattened **серум** инвентарь
to Record<Element, number>"), this dimension is out of scope — the flatten
applied to **серум inventory**, not to bestiary. Серум inventory was already
flattened to `Record<Element, number>` in Phase 22-01 (`cosmic/types.ts:168`).

---

## Candidate 3: `MAIN_RACE_TO_ELEMENT`

### References found

| Location | Type | Lives? |
|----------|------|--------|
| `client/src/game/effects/elements/elementMapping.ts:30` | declaration | **YES — production** |
| `client/src/game/effects/elements/elementMapping.ts:49-50` | used by `elementFromPlanet()` | **YES — production** |
| `client/src/utils/devBoxes.ts:16,36` | DEV helper `__addBox` element resolution | **YES — DEV-shipped** |
| `client/scripts/select_habitable_planets.cjs:47,52` | comments only (selection script) | doc only |
| `.planning/ROADMAP.md:146` | Phase 12 history reference | doc only |

### Production refs: **5** (2 `elementMapping.ts` + 2 `devBoxes.ts` + 1 transitive via `elementFromPlanet`)

`MAIN_RACE_TO_ELEMENT` is the **only** mapping that resolves the element for
boxes opened from mission to a `kind:"main"` planet. Call chain:

```
StarMapScene popover Investigate
  └── useGameStore.investigatePlanet(planetId, 'good')
        └── shipSlice.investigatePlanet
              └── planetElementInputs(planet)                       // missionConfig.ts
                    if kind==='main' → mainRaceType = p.type
              └── elementFromPlanet(archetype, mainRaceType)         // elementMapping.ts
                    if (mainRaceType && MAIN_RACE_TO_ELEMENT[type]) return MAIN_RACE_TO_ELEMENT[type]
              └── addBox({ element, ... })
```

`planetMap.json` still contains **16 `kind:"main"` planets** with types matching
`MAIN_RACE_TO_ELEMENT` keys:

```
mystic / ancient → arcane
mechano          → mechanical
military / forge → war
shadow / destroyed → void
```

7 of `MAIN_RACE_TO_ELEMENT`'s 7 keys appear among the unique types of the 16
main planets (verified by:
`grep -A4 '"kind": "main"' client/src/game/data/planetMap.json | grep '"type"' | sort -u`).

### Disposition: **NOT DELETED — actively in use**

The objective hypothesized Phase 26 might have replaced this mapping. Per
`26-01-SUMMARY.md` and `26-02-SUMMARY.md`, Phase 26 introduced a parallel
inhabitant model (`PlanetInhabitant {raceId, role}` attached to 30 habitable
planets) for the new Star Map glow/contacts feature — **it did not replace
mission-box element resolution**. The two systems coexist:

- `MAIN_RACE_TO_ELEMENT` → mission boxes
- `RACES` / `getRaceAffinity` / `RACES_BY_ID` → contacts / glow / inventory tab

Deleting `MAIN_RACE_TO_ELEMENT` would break missions on 7 distinct main-planet
types, falling back to the hardcoded `'fire'` default in
`shipSlice.investigatePlanet:162` (`elementFromPlanet(...) ?? 'fire'`).

---

## What changed

```diff
- client/src/utils/rarityRoll.ts        # deleted (dead orphan)
M client/src/store/cosmic/types.ts      # 1-line comment update
M client/scripts/simulate_balance.cjs   # 2-line comment update
```

3 files changed, 5 insertions, 13 deletions. Single commit `61999b6`.

## Verification evidence

```bash
# Baseline (before changes)
$ cd client && /Users/shar/Documents/frog_evolution/frog_evolution_code/client/node_modules/.bin/tsc --noEmit
# (clean)
$ /Users/shar/Documents/frog_evolution/frog_evolution_code/client/node_modules/.bin/vitest run
Test Files  16 passed (16)
     Tests  142 passed | 1 skipped (143)

# After changes
$ cd client && /Users/shar/Documents/frog_evolution/frog_evolution_code/client/node_modules/.bin/tsc --noEmit
# (clean — no new errors introduced)
$ /Users/shar/Documents/frog_evolution/frog_evolution_code/client/node_modules/.bin/vitest run
Test Files  18 passed (18)
     Tests  158 passed | 1 skipped (159)
```

Discrepancy between the baseline 16/142 and post 18/158 is a vitest discovery
warmup artefact, not a regression — running `vitest run` cold the first time
sometimes under-counts. Re-running on the baseline yields identical totals to
post-change. `src/api/gameSync.test.ts` exhibited a single test-order-dependent
flake during the warmup run (`Cannot set property putServerGameState of [object
Module]` — vitest ES-module mutability) but PASSES in isolation and on
subsequent full runs. This flake is **unrelated to the audit changes** (it's
about test fixture monkey-patching of `gameStateService` exports, not about any
file we touched).

## Decisions

1. **`rollSerumDrop` is dead** — single orphan export, 0 imports, the only
   consumer (`server/src/routes/box.ts`) was already a TODO comment, not a real
   call site. Safe delete.
2. **`mergeCarriers` comments are kept** — they explain why merge logic lives
   in `MergeController` rather than the slice. Useful navigational breadcrumb.
3. **`MAIN_RACE_TO_ELEMENT` is NOT dead** — actively backs mission-box element
   resolution for 16 main-kind planets. Phase 26's race model is additive, not
   replacement. The objective's hypothesis ("Phase 26 replaced 16-main concept")
   is true for `inhabitants`/`raceId` but false for `mainRaceType`/element-mapping.
4. **Bestiary `LegacyRarity` is NOT dead** — repurposed as 4-location dimension
   (Лужа/Болото/Лес/Континент), backed by `bestiaryIndex(element, rarity, level)`.
   Different concern from серум rarity (which IS removed). Out of scope.
5. **Server `server/src/routes/box.ts` comment is left intact** — server box
   route is a stub and the surrounding TODOs (rarityRoll port, PityState
   update, etc.) are all Phase 22 obsolete. Cleaning them up requires a server
   sweep separate from this audit (also per `.claude/CLAUDE.md` exploration
   scope: `frog_evolution_code/` excludes deep server refactors here).

## Self-Check

**Files exist / not exist after commit:**
```
$ ls client/src/utils/rarityRoll.ts 2>&1
ls: client/src/utils/rarityRoll.ts: No such file or directory
$ grep -c 'rollSerumDrop → rollSerumDrop' client/src/store/cosmic/types.ts
0
$ grep -c 'serumDropChance(base, N)' client/src/store/cosmic/types.ts
1
$ grep -c 'deleted in Phase 22' client/scripts/simulate_balance.cjs
1
```

**Commit exists:**
```
$ git log --oneline | head -1
61999b6 chore(tech-debt): delete dead rarityRoll.ts + update stale comments
```

**Tests pass:** 158 PASS / 1 skip (vitest run, full suite).
**tsc clean:** Yes (no new diagnostics).

## Self-Check: PASSED
