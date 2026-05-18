---
phase: 29-admin-panel
plan: 03
subsystem: server/admin-routes
tags: [fastify, jwt, bcrypt, prisma, admin-api, bigint]

# Dependency graph
requires:
  - phase: 29-02
    provides: User.banned field, bcryptjs, config.adminEmail/adminPasswordHash/adminOrigin
provides:
  - POST /admin/login — bcrypt validate + JWT 24h issue
  - requireAdmin middleware — JWT verification for protected routes
  - GET /admin/users — paginated list with search/sort/pagination
  - GET /admin/users/:id — full user detail with GameState + cosmic blob
  - POST /admin/users/:id/grant — gold/essence/serum mutation
  - POST /admin/users/:id/ban — User.banned flag
affects: [29-04, 29-05, 29-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requireAdmin via preHandler array on each protected route (not addHook — avoids login route)"
    - "BigInt gold serialized via .toString() in all admin API responses"
    - "cosmic blob mutation: fetch → spread → update (gold=BigInt increment, essence/serum=JSON merge)"
    - "jwt.sign with `as any` cast to bypass FastifyJWT augmentation (game user payload vs admin sub payload)"

key-files:
  created:
    - server/src/routes/admin.ts
  modified:
    - server/src/routes/index.ts

key-decisions:
  - "requireAdmin applied per-route via preHandler array (not addHook) to exclude /admin/login cleanly"
  - "app.jwt.sign used instead of reply.jwtSign — avoids reply type narrowing issue; synchronous call"
  - "Admin JWT payload cast as `any` to bypass FastifyJWT augmentation (game payload type) — no type file change"
  - "Prisma User sort limited to createdAt/updatedAt — GameState sort fields need subquery ordering (deferred)"
  - "pageSize clamped to max 100 (T-29-10 DoS mitigation)"

# Metrics
duration: ~8min
completed: 2026-05-19
---

# Phase 29 Plan 03: Backend Admin Routes Summary

**All 6 admin API endpoints implemented in server/src/routes/admin.ts — bcrypt login, JWT middleware, users list, user detail, grant, ban**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-19T20:10:25Z
- **Completed:** 2026-05-19T20:18:00Z
- **Tasks:** 2
- **Files created:** 1 (admin.ts)
- **Files modified:** 1 (routes/index.ts)

## Accomplishments

- Created `server/src/routes/admin.ts` (294 lines) with all 6 admin endpoints
- POST /admin/login: timing-safe bcrypt compare (dummy hash fallback when adminPasswordHash empty), issues JWT with `{ sub: 'super-admin' }` payload, 24h expiry
- `requireAdmin` middleware: calls `request.jwtVerify()` then checks `payload.sub === 'super-admin'`, returns 401/403 appropriately
- GET /admin/users: paginated (page/pageSize), search by telegramId/username (case-insensitive), sort on User columns, capped pageSize at 100
- GET /admin/users/:id: full detail including all GameState fields, cosmic blob sent as-is
- POST /admin/users/:id/grant: gold (BigInt atomic increment), essence (cosmic.essence JSON merge), serum (cosmic.serums[element] JSON merge)
- POST /admin/users/:id/ban: sets User.banned boolean
- BigInt gold field serialized as string in all responses
- Input validation on all protected routes (amount > 0, integer, kind whitelist, element required for serum)
- Registered adminRoutes in routes/index.ts
- TypeScript build passes cleanly (tsc --noEmit exit 0)

## Task Commits

1. **Task 1: Implement admin.ts** - `dcf1c73` (feat)
2. **Task 2: Register adminRoutes in routes/index.ts** - `d1bf133` (feat)

## Files Created/Modified

- `server/src/routes/admin.ts` — all admin route handlers (294 lines, new file)
- `server/src/routes/index.ts` — added import + registration of adminRoutes

## Decisions Made

- **requireAdmin per-route via preHandler array** (not `app.addHook`) so `/admin/login` is naturally excluded without an allowlist
- **app.jwt.sign over reply.jwtSign** — synchronous, avoids type narrowing issues with Fastify reply overloads
- **Admin JWT payload cast `as any`** — existing `FastifyJWT` augmentation locks payload to game user type `{ id, telegramId }`. Admin tokens carry `{ sub: 'super-admin' }`. Rather than breaking the existing union type (which would require narrowing in all game routes), the admin sign and verify use targeted casts. No fastify.d.ts changes needed.
- **Sort limited to User-level columns** — sorting by GameState fields (gold, maxLevel) requires subquery ordering which is deferred; only `createdAt`/`updatedAt` from User model are allowed in this plan
- **pageSize capped at 100** — DoS mitigation per T-29-10 threat model

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FastifyJWT augmentation type conflict prevented compiling admin JWT sign**
- **Found during:** Task 2 (TypeScript build verification)
- **Issue:** `FastifyJWT` interface declares payload as `{ id: number; telegramId: string }`. Passing `{ sub: 'super-admin' }` to `app.jwt.sign` or `reply.jwtSign` caused TS2769 overload error. The plan suggested adding a fastify.d.ts augmentation, but a union type broke all existing routes using `request.user.id`.
- **Fix:** Used targeted `as any` cast on the sign call and `as unknown as AdminJwtPayload` on verify, keeping `fastify.d.ts` unchanged. Zero impact on game routes.
- **Files modified:** `server/src/routes/admin.ts` only
- **Verification:** tsc --noEmit exit 0, no errors in existing routes

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-network-endpoints | server/src/routes/admin.ts | 6 new HTTP routes under /admin/* prefix — all protected by requireAdmin except /admin/login |

Threat model (T-29-06 through T-29-10) mitigations all applied:
- T-29-06: dummy hash fallback prevents bcrypt bypass; both email+password must match
- T-29-07: sub === 'super-admin' check in requireAdmin; any other sub → 403
- T-29-08: amount validation (>0, integer), kind whitelist, element required for serum
- T-29-09: requireAdmin gate before any Prisma query in detail route
- T-29-10: pageSize clamped to max 100

## Self-Check: PASSED

- `server/src/routes/admin.ts` exists — CONFIRMED
- `grep -c "POST.*admin/login\|'/admin/login'" admin.ts` → 2 — CONFIRMED
- `grep -c "requireAdmin" admin.ts` → 5 — CONFIRMED
- `grep -c "admin/users/:id/grant" admin.ts` → 2 — CONFIRMED
- `grep -c "adminRoutes" routes/index.ts` → 2 — CONFIRMED
- `tsc --noEmit` exits 0 — CONFIRMED
- Commits dcf1c73 and d1bf133 exist — CONFIRMED

---
*Phase: 29-admin-panel*
*Completed: 2026-05-19*
