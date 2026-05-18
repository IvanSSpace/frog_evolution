---
phase: 29
plan: 07
subsystem: admin-panel
tags: [admin, race-chains, tanstack-virtual, visualization]
dependency_graph:
  requires: [29-05, 27-02, 28-02]
  provides: [admin-chains-page]
  affects: [admin-panel]
tech_stack:
  added: ["@tanstack/react-virtual@3", "@radix-ui/react-select"]
  patterns: [TanStack-Virtual-list, shadcn-Select, static-server-data-mirror]
key_files:
  created:
    - server/src/data/chains.ts
    - admin/src/components/ui/select.tsx
    - admin/src/pages/RaceChainsPage.tsx
  modified:
    - server/src/routes/admin.ts
    - admin/src/App.tsx
    - admin/src/components/AppShell.tsx
    - admin/package.json
    - admin/package-lock.json
decisions:
  - Server cannot import client/ config files (rootDir boundary) — static copy in server/src/data/chains.ts
  - TanStack Virtual useVirtualizer (scroll-container strategy) with height=520px container
  - shadcn Select over native <select> for UI consistency
  - i18n RU texts resolved server-side in chains.ts — admin has no i18n
metrics:
  duration: "~45 min"
  completed: "2026-05-19"
  tasks_completed: 2
  files_created: 3
  files_modified: 4
---

# Phase 29 Plan 07: Race Chains Admin Page Summary

**One-liner:** Admin visualization page for all 200 race chain items (10 races × 20) with TanStack Virtual scroll, race dropdown selector, and quest reward lookup.

## What Was Built

### Backend: GET /admin/chains

New protected endpoint returning the full race chain configuration with i18n-resolved Russian texts:

```
GET /admin/chains → ChainsResponse {
  races: [ { id, name, emojiIcon, chain: ChainItemSerialized[] } × 10 ]
  quests: QuestConfigSerialized[] (40 entries)
}
```

**`server/src/data/chains.ts`** — Self-contained static data module:
- Embeds all 10 × 20 = 200 ChainItem entries (mirrored from `client/src/game/config/raceChains.ts`)
- Embeds all 40 QuestConfig entries (mirrored from `client/src/game/config/quests.ts`)
- Embedded RU i18n flat map resolves text/description fields server-side
- `CHAINS_RESPONSE` is pre-built once at module load (no per-request work)
- `serializeChain()` annotates each item with `step` index + resolved text

**`server/src/routes/admin.ts`** — Added `GET /admin/chains` route:
```typescript
app.get('/admin/chains', { preHandler: [requireAdmin] }, async (_request, reply) => {
  return reply.send(CHAINS_RESPONSE)
})
```

### Frontend: RaceChainsPage

**`admin/src/pages/RaceChainsPage.tsx`:**
- Race selector dropdown (shadcn Select) — 10 races with emoji icons
- TanStack Virtual `useVirtualizer` (scroll-container mode, 520px height, estimateSize=56px, overscan=5)
- Per ChainItem row: step# + type icon/label + delta annotation (±) + text + reward preview
- Quest reward lookup: for `quest_hook` items, shows target (e.g. "5x crystal serum"), reward ("+1 essence"), difficulty badge
- React Query `staleTime: 5 min` — chain config is static

**Type icons:**
- 📩 msg — read-only text
- 💬 dialog — 2-choice interaction
- 📋 quest_hook — quest activation + deltas
- ⚡ event — auto-applied relationship event (italic description)

**`admin/src/components/ui/select.tsx`** — Full shadcn Select component using `@radix-ui/react-select`.

**`admin/src/components/AppShell.tsx`** — Added `{ label: 'Race Chains', href: '/chains' }` to sidebar nav.

**`admin/src/App.tsx`** — Added `<Route path="chains" element={<RaceChainsPage />} />`.

## Deviations from Plan

### Auto-fixed: Worktree behind main

**Found during:** Initial setup
**Issue:** Worktree was created from commit `b67c31e` (pre-admin-panel); admin/ directory, raceChains.ts, quests.ts, races.ts all absent.
**Fix:** `git merge --ff-only main` to fast-forward to `fc9af1b`.
**Type:** [Rule 3 - Blocking] — prerequisite files didn't exist in worktree.

### Architecture choice: Server-side data copy

**Found during:** Task 1
**Issue:** Server tsconfig has `rootDir: "."` (server/ only) — cannot import `../../../client/src/game/config/raceChains.ts`. Attempting would break `tsc`.
**Fix:** Created `server/src/data/chains.ts` as authoritative static copy per plan fallback instruction.
**Note:** Manual sync required when raceChains.ts or quests.ts change.

## Known Stubs

None — all chain data is wired from server, quest rewards are fully populated.

## Self-Check

### Created files exist:
- `server/src/data/chains.ts` — FOUND
- `admin/src/components/ui/select.tsx` — FOUND
- `admin/src/pages/RaceChainsPage.tsx` — FOUND

### Commits exist:
- `9c7cc19` feat(29-07): add GET /admin/chains endpoint — FOUND
- `833d327` feat(29-07): add RaceChainsPage with TanStack Virtual — FOUND

### Verification:
- server `tsc --noEmit` (via main repo node_modules): EXIT 0 — PASSED
- admin `tsc --noEmit` (local node_modules): EXIT 0 — PASSED
- admin `vite build`: success (2.35s, 2651 modules) — PASSED

## Self-Check: PASSED
