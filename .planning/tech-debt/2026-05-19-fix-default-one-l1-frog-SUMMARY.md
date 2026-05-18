---
type: tech-debt
subsystem: server/prisma
tags: [schema, migration, gamestate, onboarding]
key-files:
  modified:
    - server/prisma/schema.prisma
  created:
    - server/prisma/migrations/20260518214724_fix_default_one_l1_frog/migration.sql
decisions:
  - New players start with 1 L1 frog on Lusha (locationFrogs [[1],[],[]]) matching Phase 19+ onboarding design
metrics:
  duration: ~5 minutes
  completed: 2026-05-19
---

# Tech Debt Fix: locationFrogs Default — One L1 Frog

**One-liner:** Changed GameState.locationFrogs default from 6 frogs `[[1,2,3,4,5,6],[],[]]` to single L1 frog `[[1],[],[]]` for new players per Phase 19+ onboarding behavior.

## What Changed

`server/prisma/schema.prisma` line 39:

- **Before:** `@default("[[1,2,3,4,5,6],[],[]]")`
- **After:** `@default("[[1],[],[]]")`

Migration `20260518214724_fix_default_one_l1_frog` generated and applied to Neon.tech production database:

```sql
ALTER TABLE "game_states" ALTER COLUMN "location_frogs" SET DEFAULT '[[1],[],[]]';
```

## Impact

- Only affects NEW `GameState` rows (new players). Existing rows are untouched.
- `prisma generate` run to update client types.
- `tsc --noEmit` clean after change.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `8904725`: fix(schema): new players start with 1 L1 frog instead of 6

## Self-Check: PASSED

- [x] schema.prisma locationFrogs default = "[[1],[],[]]"
- [x] Migration 20260518214724_fix_default_one_l1_frog exists in server/prisma/migrations/
- [x] Migration applied (prisma migrate dev exited 0)
- [x] server tsc clean
- [x] Commit 8904725 exists
- [x] No STATE.md / ROADMAP.md edits
