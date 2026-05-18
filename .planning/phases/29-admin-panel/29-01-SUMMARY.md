---
phase: 29-admin-panel
plan: "01"
subsystem: admin
tags: [scaffold, vite, react, typescript, tailwind, shadcn-ui, new-app]
dependency_graph:
  requires: []
  provides:
    - admin/ standalone Vite+React+TS app scaffold
    - admin/src/lib/utils.ts cn() helper
    - admin/components.json shadcn/ui config
    - Tailwind v3 with dark mode class strategy
  affects: []
tech_stack:
  added:
    - Vite 5.x (admin build tool)
    - React 19 + react-dom 19
    - TypeScript 5.x (admin)
    - Tailwind CSS v3 (darkMode class)
    - shadcn/ui (components.json configured, no components installed yet)
    - TanStack Query v5
    - TanStack Table v8
    - React Router v6
    - React Hook Form + Zod
    - Axios
    - Recharts
    - clsx + tailwind-merge (cn() pattern)
    - lucide-react
    - class-variance-authority
  patterns:
    - Standalone sub-app in monorepo (admin/ isolated from client/)
    - Path alias @/ -> src/ (vite + tsconfig)
    - shadcn/ui CSS variable token system (--background, --foreground, etc.)
    - Dark-mode-first via .dark class on <html>
key_files:
  created:
    - admin/package.json
    - admin/vite.config.ts
    - admin/tsconfig.json
    - admin/tsconfig.node.json
    - admin/.env.example
    - admin/.gitignore
    - admin/tailwind.config.js
    - admin/postcss.config.js
    - admin/components.json
    - admin/src/lib/utils.ts
    - admin/src/index.css
    - admin/index.html
    - admin/src/main.tsx
    - admin/src/App.tsx
    - admin/package-lock.json
  modified: []
decisions:
  - "admin/ is a fully isolated sub-app — own package.json, node_modules, tsconfig; no shared deps with client/"
  - "Dev port 5174 (client uses 5173) to allow concurrent dev servers"
  - "Dark mode default via html class='dark'; Tailwind darkMode: ['class']"
  - "shadcn/ui manually configured (components.json) rather than running npx shadcn-ui init, which avoids interactive prompts"
  - "package-lock.json committed to pin dependency tree for reproducible installs"
metrics:
  duration: "2m 35s"
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 15
  files_modified: 0
---

# Phase 29 Plan 01: Admin App Scaffold Summary

**One-liner:** Standalone Vite 5 + React 19 + TypeScript + Tailwind v3 (dark mode class) + shadcn/ui scaffold in `admin/` with verified clean build producing `admin/dist/`.

## What Was Built

Created `admin/` as an entirely new standalone web application directory, isolated from the game client. The scaffold includes:

- Full Vite + React + TypeScript build pipeline (`npm run build` exits 0, 34 modules transformed)
- Tailwind CSS v3 with `darkMode: ['class']` strategy and complete shadcn/ui CSS variable token set (light + dark themes)
- `shadcn/ui` configured via `components.json` — Wave 2 plans can add components with `npx shadcn-ui add <component>`
- `cn()` utility at `admin/src/lib/utils.ts` (clsx + tailwind-merge)
- Minimal `App.tsx` placeholder using Tailwind classes — confirms Tailwind compilation works
- All Wave 2 dependencies pre-installed: TanStack Query/Table, React Router, React Hook Form, Zod, Axios, Recharts, Radix UI primitives

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create admin/ scaffold with package.json and configs | 46651af | admin/package.json, vite.config.ts, tsconfig.json, tsconfig.node.json, .env.example |
| 2 | Tailwind + shadcn/ui init + src bootstrap + build | 0368e96 | tailwind.config.js, postcss.config.js, components.json, src/lib/utils.ts, src/index.css, index.html, src/main.tsx, src/App.tsx, .gitignore, package-lock.json |

## Verification Results

All plan success criteria met:
- `admin/` exists as standalone npm project
- `npm install` completed with 0 errors (255 packages)
- `npm run build` exits 0 — produces `admin/dist/index.html` (578ms build)
- Tailwind dark mode class strategy configured (`darkMode: ['class']`)
- `shadcn/ui components.json` present with slate base color and CSS variables
- `cn()` helper exported from `admin/src/lib/utils.ts`
- `VITE_API_URL` documented in `admin/.env.example`

## Deviations from Plan

### Auto-added Issues

**1. [Rule 2 - Missing Critical] Added admin/.gitignore**
- **Found during:** Task 2 post-commit check
- **Issue:** `node_modules/` and `dist/` would be tracked by git without a .gitignore — generated/runtime output must not be committed
- **Fix:** Created `admin/.gitignore` excluding `node_modules/`, `dist/`, `.env`, `.env.local`, `.env.*.local`
- **Files modified:** admin/.gitignore (new)
- **Commit:** 0368e96 (included in Task 2 commit)

## Known Stubs

- `admin/src/App.tsx` — renders "Frog Evolution Admin — loading..." placeholder. Intentional; Wave 2 (plan 29-02) will replace with Router + screen components. Not a blocking stub — scaffold goal was build tooling, not UI.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model. `.env` files are correctly excluded from git by `admin/.gitignore` (mitigates T-29-01).

## Self-Check: PASSED

Files verified:
- admin/package.json: FOUND
- admin/vite.config.ts: FOUND
- admin/tsconfig.json: FOUND
- admin/components.json: FOUND
- admin/src/lib/utils.ts: FOUND
- admin/src/index.css: FOUND (contains @tailwind base)
- admin/dist/index.html: FOUND (build output)

Commits verified:
- 46651af: FOUND (chore(29-01): create admin/ directory scaffold)
- 0368e96: FOUND (feat(29-01): Tailwind + shadcn/ui init + src bootstrap)
