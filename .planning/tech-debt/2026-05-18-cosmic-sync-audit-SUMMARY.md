---
tech-debt: cosmic-sync-audit
date: 2026-05-18
subsystem: persistence + server-sync
tags: [save-loss, cross-device-sync, phase22, phase26, phase27, audit]

# Dependency graph
requires:
  - phase: 22
    provides: ascension pool / essence / shop perma upgrades / cosmos gate / L18 merge multiplier
  - phase: 26
    provides: 'inventory' CosmicTab variant
  - phase: 27
    provides: 'contacts' CosmicTab variant
provides:
  - gameSync sync coverage for all persisted cosmic state (no more silent save-loss gaps)
  - regression test enforcing parity between CosmicSlice + snapshotForSave
affects: [Phase 22 ascension, Phase 22 shop economy, Phase 22-06 cosmos gate, L18 merge bonus, lastActiveTab persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Toplevel state piggyback via cosmic blob (consistent with captainBirthSeen pattern)
    - Coverage regression test enumerating REQUIRED_COSMIC_SYNC_FIELDS + EPHEMERAL_COSMIC_FIELDS

key-files:
  created:
    - client/src/api/gameSync.test.ts
  modified:
    - client/src/api/gameSync.ts
    - client/src/store/persistence.ts

key-decisions:
  - Server schema NOT changed — cosmic blob is opaque JSON, all new fields piggyback there (zero migration risk on server side)
  - Top-level (non-cosmic) toplevel state synced via cosmic blob too — matches existing captainBirthSeen precedent
  - Post-hydrate writes to localStorage for hasCosmosUnlocked/l18MergesCount/l18AbsoluteBonusPerSec — offline boot consistency
  - Coverage test enumerates required + ephemeral cosmic keys — adding new field forces explicit categorisation

# Metrics
duration: ~40min
completed: 2026-05-18
---

# Cosmic Blob Sync Audit Summary

**Audit found 3 distinct save-loss categories shipping in production: 6 Phase 22 cosmic fields completely absent from server sync (ascension pool + shop perma upgrades), 3 toplevel cosmos/L18 fields absent from server sync, and a stale lastActiveTab whitelist that silently coerced 'inventory'/'contacts' to 'scouts' on every save→load cycle. All gaps closed with atomic commits + new coverage test prevents regression.**

## Canonical field list

Source: `client/src/store/cosmic/types.ts` `CosmicSlice` interface + `client/src/store/gameStore.ts` toplevel `GameStateBase`.

### Cosmic slice (persistable through cosmic blob)

| Field | In types | In persistence (loadCosmicSlice) | In gameSync snapshotForSave | In gameSync hydrate | Pre-audit status |
|---|---|---|---|---|---|
| serums | yes | yes | yes | yes | OK |
| boxes | yes | yes | yes | yes | OK |
| ship | yes | yes | yes | yes | OK |
| carriers | yes | yes | yes | yes | OK |
| **ascendedCarriers** (Phase 22-03) | yes | yes | **NO** | **NO** | **GAP — irreversible save loss of ascension pool** |
| **essence** (Phase 22-03) | yes | yes | **NO** | **NO** | **GAP — meta-currency lost on device switch** |
| **permaSlotBonus** (Phase 22-05) | yes | yes | **NO** | **NO** | **GAP — shop slot bonus lost** |
| **permaShipSpeedBonus** (Phase 22-05) | yes | yes | **NO** | **NO** | **GAP — ship speed bonus lost** |
| **permaSerumDropBonus** (Phase 22-05) | yes | yes | **NO** | **NO** | **GAP — serum drop chance lost** |
| **shopPurchaseCounts** (Phase 22-05) | yes | yes | **NO** | **NO** | **GAP — cost scaling reset → economy break** |
| bestiaryBitset | yes | yes | yes | yes | OK |
| pityCounters | yes | yes | yes | yes | OK |
| **lastActiveTab** | yes | yes (BROKEN whitelist) | yes | yes | **PARTIAL GAP** — Phase 26-04 'inventory' and Phase 27-04 'contacts' silently coerced to 'scouts' on save→load |
| crew | yes | yes | yes | yes | OK |
| serumDragActive | yes (transient) | NO (transient) | NO | NO | OK — ephemeral by design |
| selectedSerum | yes (transient) | NO (transient) | NO | NO | OK — ephemeral by design |
| hasFirstFeed | yes | yes | yes | yes | OK |
| hasFirstMission | yes | yes | yes | yes | OK |
| hasOpenedAnyBox | yes | yes | yes | yes | OK |
| frogExclusiveUnlocked | yes | yes | yes | yes | OK |
| tutorialState | yes | yes | yes | yes | OK |
| latestShipPos | yes (transient) | NO (transient) | NO | NO | OK — re-derived from planetCoords on boot |
| firstContactsSeen (Phase 26-01) | yes | yes | yes | yes | OK |
| raceRelationships (Phase 27-01) | yes | yes | yes | yes | OK |
| chainProgress (Phase 27-01) | yes | yes | yes | yes | OK |
| pendingItems (Phase 27-01) | yes | yes | yes | yes | OK |

### Toplevel state piggybacked via cosmic blob

| Field | In gameStore base | LocalStorage helper | In snapshotForSave | In hydrate | Pre-audit status |
|---|---|---|---|---|---|
| captainBirthSeen | yes (Phase 24-01) | saveCaptainBirthSeen | yes (cosmic blob) | yes | OK |
| **hasCosmosUnlocked** (Phase 22-06) | yes | saveCosmosUnlocked | **NO** | **NO** | **GAP — cosmos re-locks on new device until next save** |
| **l18MergesCount** | yes | saveL18MergesCount | **NO** | **NO** | **GAP — L18+L18 multiplier lost** |
| **l18AbsoluteBonusPerSec** | yes | saveL18AbsoluteBonusPerSec | **NO** | **NO** | **GAP — absolute permanent income bonus lost** |

### Ephemeral-only fields (no sync needed — documented why)

- **`serumDragActive`** — Phase 14 UI drag selection mode. Re-initialised at boot, never persists.
- **`selectedSerum`** — Phase 14 selected serum payload for drag flow. UI-only state.
- **`latestShipPos`** — Phase 16 cached ship world pixel position. Re-derived from `planetCoords` on boot (CosmicSlice comment). Persisting would risk stale pos mismatching Star Map render scale.

## Gaps identified and fixes applied

### Gap 1 — Phase 22 cosmic shop + ascension state missing from sync (6 fields)

**Severity:** Highest. Cross-device login wiped:
- All ascended carriers (Phase 22-03 permanent pool)
- All accumulated essence (meta-currency)
- All shop perma upgrades (slot bonus, ship speed bonus, serum drop chance bonus)
- All shop purchase counters (cost scaling — next purchase would re-price at base, infinite-cycle exploit)

**Fix:** Added all six fields to `snapshotForSave()` cosmic blob + `loadGameState()` hydrate path. Defensive validation already exists in `loadCosmicSlice` (which runs on next persistence read), so hydrate path trusts blob shape for immediate apply.

**Commit:** `b985e0c` fix(sync): include cosmic shop + ascension + toplevel L18 fields in server snapshot
**Files modified:** `client/src/api/gameSync.ts`

### Gap 2 — Toplevel state missing from sync (3 fields)

**Severity:** Highest. Cross-device login wiped:
- `hasCosmosUnlocked` (Phase 22-06) — cosmos gate re-locks → SerumBar / Cosmic Hub button / Star Map controls re-hidden until next L18+L18 merge sentinel (which may never come for late-game players)
- `l18MergesCount` — L18+L18 merge multiplier resets to 0 → 1.0× gold income (lost 5% to 25%+ multiplier accumulated permanently)
- `l18AbsoluteBonusPerSec` — absolute permanent income bonus (~+393K gold/sec from first L18+L18 merge) zeroes out

**Fix:** Three fields piggyback via cosmic blob (consistent with `captainBirthSeen` pattern). `snapshotForSave()` cosmic blob includes them; `loadGameState()` hydrate writes to top-level store keys + persists localStorage to ensure offline boot before next server response reads the correct values.

Defensive validation in hydrate path:
- `hasCosmosUnlocked === true` (strict equality)
- `l18MergesCount` — non-negative integer floor
- `l18AbsoluteBonusPerSec` — non-negative finite number (allows fractional bonus)

**Commit:** `b985e0c` (same commit as Gap 1 — both Phase 22 sync wiring, logically atomic)
**Files modified:** `client/src/api/gameSync.ts`

### Gap 3 — lastActiveTab whitelist stale (missing Phase 26-04 / Phase 27-04 variants)

**Severity:** Medium. Cosmetic — every save→load cycle silently coerced lastActiveTab back to 'scouts' for users sitting on Inventory or Contacts tab. Since lastActiveTab synced via gameSync, the server faithfully stored 'contacts' but the next boot dropped it.

**Fix:** Added `'inventory'` and `'contacts'` to the whitelist in `persistence.ts`.

**Commit:** `551b06e` fix(sync): include 'inventory' and 'contacts' in lastActiveTab whitelist
**Files modified:** `client/src/store/persistence.ts`

### Regression test

**File:** `client/src/api/gameSync.test.ts` (new, 193 lines)

Two assertions:
1. **Coverage gate:** Enumerate `Object.keys(makeInitialCosmicSlice())` and require every key be in either `REQUIRED_COSMIC_SYNC_FIELDS` (must sync) or `EPHEMERAL_COSMIC_FIELDS` (must NOT sync). Adding a new CosmicSlice field without explicit categorisation fails the test.
2. **Snapshot gate:** Mock `putServerGameState` via `vi.mock` to capture the saveGameState payload. Assert `cosmic` blob contains every `REQUIRED_COSMIC_SYNC_FIELDS` key plus every `REQUIRED_TOPLEVEL_SYNC_FIELDS` key.

**Commit:** `a8c0b63` test(sync): cosmic snapshot coverage regression test

## Validation results

| Gate | Result |
|---|---|
| `npx tsc --noEmit` (client/) | exit 0, no errors |
| `npx eslint` on changed files | "No issues found" |
| `npx vitest run` (full suite) | 144 passed / 1 skipped, 0 failures, 17 test files |
| `npx vitest run src/api/gameSync.test.ts` | 2 passed, 0 failures (new tests) |

## Commits (atomic, in order)

| # | Hash | Type | Description |
|---|---|---|---|
| 1 | `b985e0c` | fix | Phase 22 shop/ascension + toplevel L18/cosmos sync gap |
| 2 | `551b06e` | fix | lastActiveTab whitelist Phase 26-04/27-04 variants |
| 3 | `a8c0b63` | test | Cosmic snapshot coverage regression test |

## Server-side impact

**None.** Server schema (`server/src/routes/cosmic.ts` + game/state PUT endpoint) treats `cosmic` blob as opaque JSON. All new fields piggyback inside this opaque blob — no server migration, no DB column change, no schema bump needed. Forward-compat: older client versions reading the blob will simply ignore unknown keys (already the standard pattern for `firstContactsSeen` since Phase 26-01).

## Migration safety

All fixes are forward-compatible with existing saves:
- Missing fields in server blob → defaults from `makeInitialCosmicSlice` (already handled by defensive load in `loadCosmicSlice`)
- Missing fields on toplevel cosmic blob → hydrate path uses `'field' in c` guards; falls back to value from localStorage helper at boot time
- `lastActiveTab` whitelist expansion accepts strictly more values → existing saves with old (still-valid) values remain unaffected

No legacy save will be broken by these changes.

## Success criteria checklist

- [x] Canonical field list documented in SUMMARY (cosmic types → persistence → gameSync)
- [x] All gaps identified + documented (Gap 1: 6 Phase 22 fields, Gap 2: 3 toplevel fields, Gap 3: lastActiveTab whitelist)
- [x] Fixes applied for legitimate gaps (3 atomic commits, no Rule 4 architectural change required)
- [x] Ephemeral-only fields documented (`serumDragActive`, `selectedSerum`, `latestShipPos` — explanation per field above)
- [x] vitest passes (144 / 1 skipped / 0 failed, including 2 new coverage assertions)
- [x] tsc clean
- [x] SUMMARY committed at `.planning/tech-debt/2026-05-18-cosmic-sync-audit-SUMMARY.md`

## Self-Check

Files verified to exist in worktree:
- FOUND: `client/src/api/gameSync.ts` (modified — `git diff` shows ascendedCarriers / hasCosmosUnlocked / l18* additions)
- FOUND: `client/src/store/persistence.ts` (modified — `git diff` shows inventory/contacts whitelist additions)
- FOUND: `client/src/api/gameSync.test.ts` (new — `git log` shows commit a8c0b63)

Commits verified in `git log --oneline`:
- FOUND: `b985e0c` fix(sync): include cosmic shop + ascension + toplevel L18 fields in server snapshot
- FOUND: `551b06e` fix(sync): include 'inventory' and 'contacts' in lastActiveTab whitelist
- FOUND: `a8c0b63` test(sync): cosmic snapshot coverage regression test

## Self-Check: PASSED
