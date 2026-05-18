---
phase: 29-admin-panel
plan: "04"
subsystem: admin
tags: [axios, react-query, shadcn-ui, react-router, auth, login, app-shell, protected-route]
dependency_graph:
  requires:
    - 29-01 (admin/ scaffold with Vite+React+TS+Tailwind)
  provides:
    - admin/src/lib/api.ts (Axios instance with auth interceptors)
    - admin/src/lib/queryClient.ts (TanStack Query client)
    - admin/src/store/authStore.ts (sessionStorage JWT helpers)
    - admin/src/components/ui/* (Button, Input, Label, Card, Badge, Toast, Toaster)
    - admin/src/hooks/use-toast.ts (global toast state)
    - admin/src/components/ProtectedRoute.tsx (auth guard)
    - admin/src/components/AppShell.tsx (layout shell)
    - admin/src/pages/LoginPage.tsx (login form)
    - admin/src/App.tsx (Router + QueryClientProvider wiring)
  affects:
    - 29-05 (users list page — depends on api.ts, QueryClient, AppShell)
    - 29-06 (user detail page — depends on same)
tech_stack:
  added:
    - "@hookform/resolvers ^5.2.2 (Zod resolver for React Hook Form)"
    - "vite/client types added to tsconfig.json for import.meta.env"
  patterns:
    - "sessionStorage for JWT (not Zustand — no Zustand dep in admin)"
    - "Module-level singleton pattern for toast state (listeners array)"
    - "shadcn/ui components hand-written (no CLI, no Radix toast — custom minimal implementation)"
    - "Nested Routes pattern: /* route wraps ProtectedRoute > AppShell > inner Routes"
key_files:
  created:
    - admin/src/lib/api.ts
    - admin/src/lib/queryClient.ts
    - admin/src/store/authStore.ts
    - admin/src/components/ui/button.tsx
    - admin/src/components/ui/input.tsx
    - admin/src/components/ui/label.tsx
    - admin/src/components/ui/card.tsx
    - admin/src/components/ui/badge.tsx
    - admin/src/hooks/use-toast.ts
    - admin/src/components/ui/toast.tsx
    - admin/src/components/ui/toaster.tsx
    - admin/src/components/ProtectedRoute.tsx
    - admin/src/components/AppShell.tsx
    - admin/src/pages/LoginPage.tsx
  modified:
    - admin/src/App.tsx (replaced placeholder with full Router setup)
    - admin/package.json (added @hookform/resolvers)
    - admin/package-lock.json
    - admin/tsconfig.json (added vite/client types)
decisions:
  - "No Zustand — authStore uses plain sessionStorage helpers (getToken/setToken/clearToken/isAuthenticated); avoids extra dependency"
  - "Custom toast implementation instead of @radix-ui/react-toast — simpler, avoids portals complexity for MVP"
  - "vite/client types added to tsconfig.json to resolve import.meta.env TS2339 error"
  - "LoginPage catches ALL errors and shows generic 'Invalid email or password' (T-29-13 — no enumeration)"
  - "401 interceptor: sessionStorage.removeItem + window.location.href='/login' (hard redirect, clears React state)"
metrics:
  duration: "12m"
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 14
  files_modified: 4
---

# Phase 29 Plan 04: Frontend Shell Summary

**One-liner:** Axios + TanStack Query + sessionStorage auth + 7 shadcn/ui components + ProtectedRoute + AppShell layout + LoginPage (RHF+Zod) + React Router v6 wiring in App.tsx, verified clean build (225 modules, 403 kB bundle).

## What Was Built

Complete admin frontend foundation wired together:

**HTTP + Query layer:**
- `admin/src/lib/api.ts` — Axios instance with VITE_API_URL baseURL, Bearer token request interceptor, 401 response interceptor (logout + redirect)
- `admin/src/lib/queryClient.ts` — TanStack Query client with refetchOnWindowFocus=false, staleTime=30s, retry=1

**Auth state:**
- `admin/src/store/authStore.ts` — sessionStorage helpers: `getToken`, `setToken`, `clearToken`, `isAuthenticated`. No Zustand per planner decision.

**shadcn/ui components (hand-written, no CLI):**
- Button (6 variants, 4 sizes, Slot support via @radix-ui/react-slot)
- Input (full focus/disabled states)
- Label (@radix-ui/react-label based)
- Card + CardHeader + CardTitle + CardContent
- Badge (4 variants)
- Toast + Toaster (custom minimal implementation with module-level listeners)
- use-toast hook (global state with 4s auto-dismiss)

**Navigation + layout:**
- `ProtectedRoute.tsx` — checks isAuthenticated(), redirects to /login with replace=true
- `AppShell.tsx` — top nav bar (logo + Logout button), sidebar (Dashboard/Users nav links with active state), main content area

**Login page:**
- React Hook Form + zodResolver + Zod schema validation
- POST /admin/login via api.ts instance
- On success: setToken() + navigate('/')
- On 401/error: generic "Invalid email or password" toast (no enumeration — T-29-13)
- Redirect to / if already authenticated

**Router:**
- BrowserRouter + QueryClientProvider at App root
- /login → LoginPage (unprotected)
- /* → ProtectedRoute > AppShell > nested Routes (/, /users, /users/:id)
- Placeholder DashboardPage and UsersPage — Wave 3 will implement real content

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Axios instance, QueryClient, authStore, shadcn/ui base components | 3eb00d2 | api.ts, queryClient.ts, authStore.ts, button/input/label/card/badge/toast/toaster.tsx, use-toast.ts, package.json, tsconfig.json |
| 2 | ProtectedRoute + AppShell + LoginPage + App.tsx Router wiring | ac15c48 | ProtectedRoute.tsx, AppShell.tsx, LoginPage.tsx, App.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused React import in toast.tsx**
- **Found during:** Task 1 TypeScript check (TS6133)
- **Issue:** `import * as React from 'react'` declared but not used in toast.tsx (JSX transform handles it)
- **Fix:** Removed unused import
- **Files modified:** admin/src/components/ui/toast.tsx

**2. [Rule 1 - Bug] Added vite/client types to tsconfig.json**
- **Found during:** Task 1 TypeScript check (TS2339)
- **Issue:** `import.meta.env` not recognized — `ImportMeta` type missing `.env` property
- **Fix:** Added `"types": ["vite/client"]` to tsconfig.json compilerOptions
- **Files modified:** admin/tsconfig.json

**3. [Rule 3 - Blocking] Installed @hookform/resolvers in worktree**
- **Found during:** Task 1 execution (missing dep for LoginPage)
- **Issue:** `@hookform/resolvers` not in package.json; required for zodResolver in LoginPage
- **Fix:** `npm install @hookform/resolvers` — added ^5.2.2 to dependencies; also ran `npm install` in worktree admin/ (no node_modules there)
- **Files modified:** admin/package.json, admin/package-lock.json

**4. [Rule 3 - Blocking] Wrote Task 1 files to wrong filesystem path (worktree resolution)**
- **Found during:** Task 2 setup
- **Issue:** Task 1 files were written to `/frog_evolution_code/admin/src/` (main repo filesystem) instead of worktree path `.claude/worktrees/.../admin/src/`. Resolved by: git ff-merge worktree branch to include main commit 3eb00d2, then writing Task 2 files to the correct worktree path.
- **Files modified:** No files changed; git history reconciled via fast-forward merge

## Known Stubs

- `DashboardPage` in App.tsx — renders "Analytics coming soon." placeholder. Intentional; Wave 3 (plan 29-05) implements real users list; dashboard charts are deferred to Phase 30+.
- `UsersPage` in App.tsx — renders "Loading..." placeholder. Intentional; Wave 3 (plan 29-05) implements TanStack Table data grid.
- User Detail route in App.tsx — renders "User Detail — Wave 3" text. Intentional; Wave 3 (plan 29-06) implements.

These stubs do NOT block the plan's goal (auth loop + routing foundation). Wave 3 plans will replace them.

## Threat Flags

No new threat surface beyond the plan's documented threat model. All four threats from T-29-11 through T-29-14 are mitigated as designed:
- T-29-12: ProtectedRoute checks sessionStorage token; server enforces on every request
- T-29-13: Generic error message in LoginPage catch block (no email enumeration)
- T-29-14: 401 interceptor immediately clears sessionStorage + hard redirects

## Self-Check: PASSED

Files verified:
- admin/src/lib/api.ts: FOUND
- admin/src/lib/queryClient.ts: FOUND
- admin/src/store/authStore.ts: FOUND
- admin/src/components/ui/button.tsx: FOUND
- admin/src/components/ui/input.tsx: FOUND
- admin/src/components/ui/label.tsx: FOUND
- admin/src/components/ui/card.tsx: FOUND
- admin/src/components/ui/badge.tsx: FOUND
- admin/src/hooks/use-toast.ts: FOUND
- admin/src/components/ui/toast.tsx: FOUND
- admin/src/components/ui/toaster.tsx: FOUND
- admin/src/components/ProtectedRoute.tsx: FOUND
- admin/src/components/AppShell.tsx: FOUND
- admin/src/pages/LoginPage.tsx: FOUND
- admin/src/App.tsx: FOUND (updated)

Commits verified:
- 3eb00d2: FOUND (feat(29-04): Axios instance, QueryClient, authStore, shadcn/ui base components)
- ac15c48: FOUND (feat(29-04): ProtectedRoute + AppShell + LoginPage + App.tsx Router wiring)

Build verified: npm run build exits 0 — 225 modules transformed, dist/assets/index-BRdhpioL.js 403.03 kB
