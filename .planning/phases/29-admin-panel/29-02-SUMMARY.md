---
phase: 29-admin-panel
plan: 02
subsystem: database
tags: [prisma, bcryptjs, postgres, migration, config, fastify]

# Dependency graph
requires:
  - phase: prior server phases
    provides: Fastify server with @fastify/jwt, @fastify/cors already installed
provides:
  - User.banned Boolean field in Prisma schema + applied DB migration
  - bcryptjs (pure-JS) installed as server dependency
  - config.ts exports adminEmail, adminPasswordHash, adminOrigin
  - server/.env.example documents all admin env vars
affects: [29-03, 29-04, 29-05, 29-06]

# Tech tracking
tech-stack:
  added: [bcryptjs@^3.0.3, "@types/bcryptjs@^2.4.6"]
  patterns: [admin env vars loaded from process.env via config.ts object]

key-files:
  created:
    - server/prisma/migrations/20260518200609_add_user_banned/migration.sql
  modified:
    - server/prisma/schema.prisma
    - server/package.json
    - server/package-lock.json
    - server/src/config.ts
    - server/.env.example

key-decisions:
  - "bcryptjs chosen over bcrypt (pure-JS avoids native binding issues on Render/Docker)"
  - "JWT_SECRET reused for admin JWT — no separate admin secret needed in Phase 29"
  - "adminOrigin defaults to '*' for dev convenience, must be set in production"
  - "Ghost migration 20260506055318_init removed from DB _prisma_migrations table (was orphaned rolled-back row causing migrate dev to refuse)"

patterns-established:
  - "Admin env vars pattern: ADMIN_EMAIL / ADMIN_PASSWORD_HASH / ADMIN_ORIGIN in config.ts"
  - "bcryptjs import: require('bcryptjs') or import bcrypt from 'bcryptjs'"

requirements-completed: [PHASE29-PRISMA-BANNED-FIELD, PHASE29-BCRYPT-DEP, PHASE29-FASTIFY-JWT-PLUGIN, PHASE29-FASTIFY-CORS-PLUGIN, PHASE29-ENV-CONFIG]

# Metrics
duration: 15min
completed: 2026-05-19
---

# Phase 29 Plan 02: Backend Prep Summary

**Prisma User.banned migration applied to Neon DB, bcryptjs installed, admin env config added to config.ts and .env.example**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-19T20:00:00Z
- **Completed:** 2026-05-19T20:15:00Z
- **Tasks:** 2
- **Files modified:** 5 (+1 migration file created)

## Accomplishments
- Added `banned Boolean @default(false)` to Prisma User model and ran live migration against Neon.tech PostgreSQL
- Installed `bcryptjs@^3.0.3` (pure-JS, no native bindings) and `@types/bcryptjs` dev dependency
- Extended `server/src/config.ts` with `adminEmail`, `adminPasswordHash`, `adminOrigin` env var exports
- Extended `server/.env.example` with documented admin env var placeholders
- Confirmed `@fastify/jwt` and `@fastify/cors` already present (per package.json — no reinstall needed)
- TypeScript build passes cleanly after all changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add User.banned to Prisma schema + migration** - `82cfb49` (feat)
2. **Task 2: Install bcryptjs + extend config + env.example** - `7324e29` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified
- `server/prisma/schema.prisma` - Added `banned Boolean @default(false)` to User model
- `server/prisma/migrations/20260518200609_add_user_banned/migration.sql` - ALTER TABLE users ADD COLUMN banned BOOLEAN NOT NULL DEFAULT false
- `server/package.json` - Added bcryptjs dependency + @types/bcryptjs devDependency
- `server/package-lock.json` - Updated lockfile
- `server/src/config.ts` - Added adminEmail, adminPasswordHash, adminOrigin exports
- `server/.env.example` - Added ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_ORIGIN documentation

## Decisions Made
- bcryptjs chosen over native bcrypt for Render/Docker compatibility (pure-JS, no gyp build step)
- Admin routes reuse the existing `jwtSecret` — no separate admin JWT secret needed for Phase 29
- `adminOrigin` defaults to `'*'` when env var not set (dev-safe, but must be restricted in prod)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resolved orphaned ghost migration blocking prisma migrate dev**
- **Found during:** Task 1 (Add User.banned to Prisma schema and run migration)
- **Issue:** DB `_prisma_migrations` table had an orphaned rolled-back row `20260506055318_init` not present in local migrations directory. `prisma migrate dev` refused to proceed, asking to reset the database.
- **Fix:** Queried `_prisma_migrations` table via psql, confirmed the row had `rolled_back_at` set (correctly marked as rolled back) but Prisma still detected drift. Deleted the orphaned row directly from `_prisma_migrations` via `DELETE FROM _prisma_migrations WHERE migration_name = '20260506055318_init'`. Then `migrate dev` ran cleanly.
- **Files modified:** None (DB state only)
- **Verification:** `prisma migrate dev` exited 0 and created migration `20260518200609_add_user_banned`
- **Committed in:** n/a (DB-only fix, no file change)

---

**Total deviations:** 1 auto-fixed (Rule 1 - blocking bug in DB migration state)
**Impact on plan:** Ghost migration was a pre-existing orphaned DB record, not caused by this plan's changes. Fix was minimal (single DELETE) with no risk to live data. Migration then applied cleanly.

## Issues Encountered
- Orphaned `_prisma_migrations` row caused `prisma migrate dev` to refuse; resolved by cleaning the ghost row from the DB (documented above).

## User Setup Required
None - bcryptjs is a dev/runtime dependency that requires no external configuration. Admin env vars are documented in `.env.example`; the user will populate them when setting up the admin panel deployment.

## Threat Surface Scan
No new network endpoints, auth paths, or file access patterns introduced in this plan. Config additions are env-var-only (no new network surface). Migration is non-breaking (ADD COLUMN with safe default).

T-29-03 (ADMIN_PASSWORD_HASH in .env) is mitigated: `.env.example` uses empty placeholder, never a real hash. `.env` is already in `.gitignore`.

## Next Phase Readiness
- Wave 2 (backend admin routes) can now start: `User.banned` field exists, `bcryptjs` installed, `config.adminEmail/adminPasswordHash/adminOrigin` exports ready
- Next plan (29-03) can import `bcryptjs` and `config` without further setup

## Self-Check: PASSED
- `server/prisma/schema.prisma` contains `banned     Boolean  @default(false)` - CONFIRMED
- Migration `20260518200609_add_user_banned` exists - CONFIRMED
- `bcryptjs` in server/package.json dependencies - CONFIRMED
- `@types/bcryptjs` in server/package.json devDependencies - CONFIRMED
- `adminEmail` in server/src/config.ts - CONFIRMED
- `ADMIN_EMAIL` in server/.env.example - CONFIRMED
- `npm run build` exits 0 - CONFIRMED
- Commits 82cfb49 and 7324e29 exist - CONFIRMED

---
*Phase: 29-admin-panel*
*Completed: 2026-05-19*
