---
phase: 29-admin-panel
plan: "05"
subsystem: admin
tags: [tanstack-table, tanstack-query, react-hook-form, zod, shadcn-ui, users-list, user-detail, grant, ban]

dependency_graph:
  requires:
    - 29-04 (api.ts, queryClient, authStore, AppShell, shadcn/ui base components)
    - 29-03 (GET /admin/users, GET /admin/users/:id, POST grant, POST ban routes)
  provides:
    - admin/src/components/ui/table.tsx (shadcn Table primitives)
    - admin/src/pages/UsersPage.tsx (TanStack Table + React Query + search/pagination)
    - admin/src/pages/UserDetailPage.tsx (game state view + grant forms + ban toggle)
  affects:
    - 29-06 (dashboard page — same App.tsx Router shell)

tech_stack:
  added: []
  patterns:
    - "TanStack Table v8 manualPagination=true with React Query server-side data"
    - "React Hook Form + zodResolver (z.coerce.number().int().positive()) for grant forms"
    - "useMutation with onSuccess invalidateQueries pattern for cache invalidation"
    - "select native element styled with Tailwind classes (no Radix Select dep added)"
    - "Collapsible pre JSON block via useState cosmicExpanded toggle"

key_files:
  created:
    - admin/src/components/ui/table.tsx
    - admin/src/pages/UsersPage.tsx
    - admin/src/pages/UserDetailPage.tsx
  modified:
    - admin/src/App.tsx (imported UsersPage + UserDetailPage, wired routes)

decisions:
  - "Native <select> element for serum element dropdown — no Radix Select dep needed for MVP, styled with Tailwind to match Input appearance"
  - "Three separate useForm instances (goldForm/essenceForm/serumForm) — each form has independent validation state and reset"
  - "grantMutation shared by all three grant forms — single mutation with kind discriminator matches server API shape"
  - "banMutation invalidates both ['user', id] and ['users'] query keys so UsersPage badge updates on navigation back"

metrics:
  duration: ~10min
  completed: 2026-05-19
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 29 Plan 05: Users List Table + User Detail View Summary

**One-liner:** TanStack Table v8 users list with search/pagination + 2-column user detail view with grant gold/essence/serum forms (RHF+Zod) and ban toggle, all wired via React Query mutations with toast notifications.

## What Was Built

**UsersPage (`/users`):**
- `admin/src/components/ui/table.tsx` — shadcn/ui Table primitives (Table, TableHeader, TableBody, TableRow, TableHead, TableCell)
- `admin/src/pages/UsersPage.tsx` — TanStack Table v8 with 9 columns (Telegram ID link, username, location, max level, gold, essence, last seen, status badge, view button)
- Server-side pagination via `manualPagination: true` — React Query key `['users', { page, search }]`
- Search form: submit-on-enter, clear button, resets to page 1 on new search
- Pagination controls: Previous / Next buttons with disabled state at boundaries, total count display

**UserDetailPage (`/users/:id`):**
- `admin/src/pages/UserDetailPage.tsx` — 2-column layout (responsive: lg:grid-cols-2)
- Left column: Game State card (telegramId, username, name, location, maxLevel, gold, essence, boxOpenCount, incomePerSec, magnet, lastSeen, createdAt) + Cosmic Blob collapsible card
- Right column: Grant Gold, Grant Essence, Grant Serum cards + Account Status (ban toggle)
- Three grant forms: each uses React Hook Form + Zod `coerce.number().int().positive()` validation
- Serum form: 16-element dropdown + amount input
- Ban toggle: reads current `user.banned`, calls `banMutation.mutate(!user.banned)`, label toggles "Ban" / "Unban"
- All mutations: toast on success and error, cache invalidation on success

**App.tsx routing:**
- Replaced `UsersPage` placeholder function with `import { UsersPage } from '@/pages/UsersPage'`
- Replaced inline "User Detail — Wave 3" div with `<UserDetailPage />`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Table component + UsersPage with TanStack Table + search + pagination | 25cc1e9 | table.tsx, UsersPage.tsx, App.tsx |
| 2 | UserDetailPage with grant forms + ban toggle | 6f7ed4c | UserDetailPage.tsx, App.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All features specified in the plan are fully implemented:
- UsersPage is wired to GET /admin/users with real data
- UserDetailPage is wired to GET /admin/users/:id + POST grant + POST ban
- No placeholder text or empty data sources

## Threat Flags

No new threat surface beyond plan's documented threat model.

Threat mitigations applied per plan:
- T-29-15: Zod `coerce.number().int().positive()` on all grant amount fields — client-side guard before mutation fires
- T-29-16: Cosmic blob display only reachable through ProtectedRoute (JWT gate); no credential exposure
- T-29-17: UsersPage pageSize hardcoded to 20 (PAGE_SIZE const); React Query staleTime=30s from queryClient defaults

## Self-Check: PASSED

Files verified:
- admin/src/components/ui/table.tsx: FOUND
- admin/src/pages/UsersPage.tsx: FOUND
- admin/src/pages/UserDetailPage.tsx: FOUND
- admin/src/App.tsx: FOUND (updated)

Commits verified:
- 25cc1e9: feat(29-05): add Table component + UsersPage with TanStack Table + search + pagination — FOUND
- 6f7ed4c: feat(29-05): add UserDetailPage with grant gold/essence/serum forms + ban toggle — FOUND

Build verified: npm run build exits 0 — 231 modules transformed, dist/assets/index-ChbNP334.js 478.33 kB

---
*Phase: 29-admin-panel*
*Completed: 2026-05-19*
