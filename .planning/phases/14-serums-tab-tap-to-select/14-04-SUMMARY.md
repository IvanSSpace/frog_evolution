---
phase: 14-serums-tab-tap-to-select
plan: 04
subsystem: cosmic-frogs / polish
tags: [serums, toast, dnd, i18n, dev-helpers, verify]
requires:
  - applySerumToFrog с undo callback (Plan 14-03)
  - SerumSelectionLayer (Plan 14-03)
  - MainScene selection subscriber (Plan 14-03)
provides:
  - App.tsx toast subscriber honoring payload.duration + payload.action
  - CosmicToast UI рендерит payload.action кнопку с onClick
  - Desktop Pointer Events DnD (mousedown→ghost→drop→apply/cancel)
  - i18n RU/EN/ES parity (полный набор Phase 14 ключей)
  - Dev helpers __addSerum / __clearSerums / __listSerums (DEV-only)
  - Bundle delta verified ≤ +20 KB gzip
affects:
  - client/src/App.tsx
  - client/src/components/CosmicHub/SerumsTab.tsx (handlePointerDragStart)
  - client/src/components/CosmicHub/ElementGrid.tsx (onPointerDown)
  - client/src/game/scenes/MainScene.ts (onSerumPointerMove/Up + clientToWorld + findFrogAt)
  - client/src/utils/devSerums.ts
  - client/src/main.tsx (DEV import)
  - client/src/store/eventBus.ts (cosmic:serum-pointer-move/up types)
  - client/src/i18n/ru.json + en.json + es.json
key-files:
  created:
    - client/src/utils/devSerums.ts
  modified:
    - client/src/App.tsx
    - client/src/components/CosmicHub/SerumsTab.tsx
    - client/src/components/CosmicHub/ElementGrid.tsx
    - client/src/game/scenes/MainScene.ts
    - client/src/store/eventBus.ts
    - client/src/main.tsx
decisions:
  - Single-canvas DOM ghost (32px tinted circle) вместо react-dnd (кастомные Pointer Events ≤ +0 KB vs library)
  - onPointerDown skip if pointerType === 'touch' (mobile использует onClick path)
  - onUp drop в пустое место → setSerumDragActive(false) (cancel; серум НЕ списан)
  - duration: max() для grouped toast (длиннее побеждает — защита от мерцания undo toast)
  - lastHaptiHover флаг — single haptic на entry в snap radius, reset на exit
  - dev helpers gated import.meta.env.DEV (Vite tree-shakes в prod — verified)
metrics:
  tasks: 1 commit (3 tasks + final checkpoint)
  duration: ~40 min (ранее)
  completed: 2026-05-08
  bundle_delta_final_gzip: "+2.14 KB"
  bundle_main_gzip: "211.59 KB (vs Phase 13 baseline 209.45 KB)"
requirements: [SERUM-02, SERUM-05, SERUM-07, SERUM-10, SERUM-11, UX-07]
---

# Phase 14 Plan 04: Polish (toast wiring + DnD + i18n + dev + verify) Summary

**One-liner:** Завершён Phase 14: toast subscriber honors payload.duration + payload.action.onClick, desktop Pointer Events DnD secondary mode (mousedown→ghost→drop), полный i18n parity RU/EN/ES, dev helpers __addSerum/__clearSerums/__listSerums (DEV-only), bundle delta `+2.14 KB gzip` (cap +20 KB ✓).

## What Was Built

| Artifact | Provides |
|----------|----------|
| `App.tsx` toast | `payload.duration ?? DEFAULT_AUTO_HIDE_MS=4000`; grouped toast: `Math.max()` duration; `payload.action` рендерит кнопку с onClick + onClose() |
| `CosmicToast` UI | Зелёная (#34d399) action button + `×` close button; `payload.action!.onClick(); onClose()` сценарий |
| SerumsTab `handlePointerDragStart` | DOM ghost (32px tinted circle, z-index 99999) follows pointer; onMove emit `cosmic:serum-pointer-move`; onUp emit `cosmic:serum-pointer-up`; cleanup listeners + ghost.remove() |
| ElementGrid `onPointerDown` | Skip if `e.pointerType === 'touch'`; иначе e.preventDefault() + onPointerDragStart |
| MainScene `onSerumPointerMove` | clientToWorld + findFrogAt(snap=80*DPR) + isEligible → hapticImpact('medium') one-shot per entry |
| MainScene `onSerumPointerUp` | findFrogAt → eligible→applySerumToFrog; ineligible→flashRed+error toast; пустое→cancel |
| `devSerums.ts` | window.__addSerum/__clearSerums/__listSerums (DEV-only, Vite tree-shake verified — 0 hits в prod bundle) |
| i18n RU/EN/ES | `serums_empty`, `section_{rarity}`, `section_count`, `applied`, `undo_label`, `mis_tap_msg`, `location_{swamp/forest/continent/planet}` — JSON parity 3/3 |

## REQ Coverage

- **SERUM-02** ✓ — placeholder + section count display finalized
- **SERUM-05** ✓ — `hapticImpact('medium')` на eligible hover (DnD path)
- **SERUM-07** ✓ — i18n mis-tap toast с {{level}} + {{location}} interpolation
- **SERUM-10** ✓ — undo toast 4с window; `payload.action.onClick` → removeCarrier + addSerum обратно
- **SERUM-11** ✓ — desktop Pointer Events DnD secondary mode (mousedown→ghost→drop→apply/cancel)
- **UX-07** ✓ — все 4 haptic event'а wired (light на select, medium на hover-eligible-DnD, error на mis-tap, success на apply)

## Commits

- `6e310ac phase-14: toast duration override + dev helpers + bundle verify`

## Verification

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | EXIT=0 (clean) |
| `npm run build` | success, 1213 modules |
| `index.js` gzip | **211.59 KB** (Phase 13 baseline 209.45 KB → **delta +2.14 KB**, cap +20 KB ✓) |
| JSON parity | 3/3 локалей валидны |
| Dev tree-shake | `grep "__addSerum" dist/assets/*.js` → 0 hits ✓ |

### Final REQ Status (Phase 14 totals)

| ID | Status | Notes |
|----|--------|-------|
| SERUM-02 | ✓ | 4 секции UI |
| SERUM-03 | ✓ | tap-to-select primary apply |
| SERUM-04 | ✓ | snap radius 80*DPR (DnD path) |
| SERUM-05 | ✓ | green halo pulse + red flash + haptic medium hover |
| SERUM-06 | ✓ | magnet/merge pause через serumDragActive |
| SERUM-07 | ✓ | mis-tap toast i18n |
| SERUM-08 | ✓ | locked eligibility (1/7/13/19) |
| SERUM-09 | ✓ | 2-сек pulse + burst at midpoint |
| SERUM-10 | ✓ | undo toast 4с с removeCarrier + addSerum |
| SERUM-11 | ✓ | desktop DnD ghost + mouse drop |
| UX-07 | ✓ | haptic light/medium/error/success |

**11/11 REQ-IDs ✓**

## Open Items

- Carrier evolution (CARRIER-01..12) — Phase 17 (полная стабилизация + feed roll + ceiling)
- Реальные боксы как источник серумов — Phase 15 (сейчас только dev `__addSerum`)

## Self-Check: PASSED

- `client/src/utils/devSerums.ts` ✓
- `client/src/App.tsx` (Phase 14 toast wiring) ✓
- Commit `6e310ac` ✓
- Build artifact `dist/assets/index-CF1Eulze.js` 211.59 KB gzip ✓
