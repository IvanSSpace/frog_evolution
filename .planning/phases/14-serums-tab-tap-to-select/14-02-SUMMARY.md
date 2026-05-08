---
phase: 14-serums-tab-tap-to-select
plan: 02
subsystem: cosmic-frogs / serums-ui
tags: [serums, ui, react, cosmic-hub]
requires:
  - SerumsTab stub (Phase 11)
  - cosmicSlice.serums (Phase 11)
  - setSerumDragActive (Plan 14-01)
provides:
  - SerumsTab — 4 секции с inventory
  - ElementGrid — переиспользуемый 4×4 grid
  - cosmic:select-serum eventBus type
affects:
  - client/src/components/CosmicHub/SerumsTab.tsx
  - client/src/components/CosmicHub/ElementGrid.tsx
  - client/src/components/CosmicHub/CosmicHubModal.tsx
  - client/src/store/eventBus.ts
key-files:
  created:
    - client/src/components/CosmicHub/ElementGrid.tsx
  modified:
    - client/src/components/CosmicHub/SerumsTab.tsx
    - client/src/components/CosmicHub/CosmicHubModal.tsx
    - client/src/store/eventBus.ts
    - client/src/i18n/ru.json (+ en.json + es.json)
decisions:
  - 4 секции в порядке legendary → epic → rare → common (best first UX)
  - Tint dot вместо emoji (font-portability)
  - count > 99 → "99+" UI clamp (T-14-02-02 mitigation)
  - Both `onClick` (mobile tap) и `onPointerDown` (desktop drag-init) — сосуществуют
  - i18n keys минимальный набор уже добавлен (полный i18n parity в 14-04)
metrics:
  tasks: 1 commit (3 task'а сжаты в один phase-14 коммит)
  duration: ~45 min (ранее)
  completed: 2026-05-07
requirements: [SERUM-02, SERUM-03, UX-07]
---

# Phase 14 Plan 02: SerumsTab UI Summary

**One-liner:** Полная переработка SerumsTab из stub в 4-секционный inventory с 16-cell ElementGrid; tap → setSerumDragActive + emit + onClose.

## What Was Built

| Artifact | Provides |
|----------|----------|
| `ElementGrid.tsx` | Переиспользуемый 4×4 grid с TINT TABLE + count badge + disabled state |
| `SerumsTab.tsx` | 4 секции (legendary/epic/rare/common) + empty placeholder + tap-to-select handler |
| `eventBus.ts` | `cosmic:select-serum` + `cosmic:cancel-serum` + (preview) `cosmic:serum-pointer-move/up` |
| i18n RU/EN/ES | `cosmic_hub.serums.section_*`, `serums_empty`, `applied`, `undo_label`, `mis_tap_msg`, `location_*` |

## REQ Coverage

- **SERUM-02** ✓ — UI 4 секции по rarity с inventory display
- **SERUM-03** ◑ — tap entry point готов (apply в 14-03)
- **UX-07** ◑ — `hapticImpact('light')` на select serum

## Commits

- `26d250b phase-14: SerumsTab UI + ElementGrid + i18n RU/EN/ES + cosmic events`

## Verification

- tsc clean, vite build clean
- Bundle delta cumulative от Phase 13 baseline 209.45 KB после Plan 14-02: ~+1 KB gzip
- JSON parity 3/3 локалей

## Self-Check: PASSED

- `client/src/components/CosmicHub/ElementGrid.tsx` ✓
- `client/src/components/CosmicHub/SerumsTab.tsx` ✓ (rewrite)
- Commit `26d250b` ✓
