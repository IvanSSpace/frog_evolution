---
phase: 30-deploy-cut
plan: 03
subsystem: App shell
tags: [cleanup, factory, drones, react-shell]
dependency_graph:
  requires: [30-01, 30-02]
  provides: [App.tsx with no factory/drone dead imports]
  affects: [client/src/App.tsx]
tech_stack:
  added: []
  patterns: [surgical-deletion]
key_files:
  created: []
  modified:
    - client/src/App.tsx
decisions:
  - Removed startLoc2FrogFactory/stopLoc2FrogFactory useEffect entirely (source file deleted in 30-01)
  - Removed ConveyorModal/DronerModal/EctoDronerModal imports and JSX (source files deleted in 30-02)
  - Kept ShopModal, BottomBar, EvolutionModal, FireLevelsModal, all expedition/discovery wiring untouched
  - Kept onBuildingOpen 'evolution' branch (Loc3 evo block — unrelated to factory/drone)
metrics:
  duration: 5m
  completed: "2026-06-11"
---

# Phase 30 Plan 03: Remove factory/drone wiring from App.tsx Summary

**One-liner:** Surgical removal of loc2FrogFactory, ConveyorModal, DronerModal, EctoDronerModal imports/state/useEffect/handlers/JSX from App.tsx — 25 lines deleted, ShopModal preserved.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove factory/drone wiring from App.tsx | 91eda10 | client/src/App.tsx |

## What Was Done

Removed all dead references from App.tsx after Wave 1 (plan 30-01) deleted factory files and Wave 2 (plan 30-02) deleted drone/modal files:

**A. Imports removed (7 lines):**
- `startLoc2FrogFactory`, `stopLoc2FrogFactory` from `./game/factory/loc2FrogFactory`
- `ConveyorModal` from `./ui/components/ConveyorModal`
- `DronerModal` from `./ui/components/DronerModal`
- `EctoDronerModal` from `./ui/components/EctoDronerModal`

**B. useState removed (3 lines):**
- `const [conveyorOpen, setConveyorOpen] = useState(false)`
- `const [dronerOpen, setDronerOpen] = useState(false)`
- `const [ectoDronerOpen, setEctoDronerOpen] = useState(false)`

**C. useEffect removed (4 lines):**
- Entire `useEffect(() => { startLoc2FrogFactory(); return () => stopLoc2FrogFactory() }, [])` block with comment

**D. onBuildingOpen handler branches removed (4 lines):**
- `else if (modal === 'droner') setDronerOpen(true)`
- `else if (modal === 'ectoDroner') setEctoDronerOpen(true)`
- `else if (modal === 'conveyor') setConveyorOpen(true)` (+ comment)

**E. JSX renders removed (5 lines):**
- `{dronerOpen && <DronerModal onClose={...} />}`
- `{ectoDronerOpen && <EctoDronerModal onClose={...} />}`
- `{conveyorOpen && <ConveyorModal onClose={...} />}`

**Preserved (per KEEP list):**
- `<ShopModal>` render + state — intact
- `onBuildingOpen` `'evolution'` branch — intact
- All cosmic/expedition/bestiary/contacts wiring — intact

## Verification Results

```
grep -c "ConveyorModal|DronerModal|EctoDronerModal|loc2FrogFactory|startLoc2FrogFactory|stopLoc2FrogFactory" client/src/App.tsx → 0 (OK)
grep -c "ShopModal" client/src/App.tsx → 4 (>= 1, OK)
grep -c "conveyorOpen|dronerOpen|ectoDronerOpen" client/src/App.tsx → 0 (OK)
npx tsc --noEmit 2>&1 | grep "App.tsx" → (no output, App.tsx is clean)
```

## Deviations from Plan

None — plan executed exactly as written. All 5 edit categories (imports, state, useEffect, handler branches, JSX) removed in a single task with zero unintended changes.

## Known Stubs

None in App.tsx scope.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- client/src/App.tsx: exists and modified (git diff confirms 25 deletions)
- Commit 91eda10: present in git log
- All verification grep checks: 0/0/0 (factory references, state vars removed), ShopModal count >= 1
