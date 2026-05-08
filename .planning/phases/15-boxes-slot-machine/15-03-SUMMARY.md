---
phase: 15-boxes-slot-machine
plan: 03
status: complete
date: 2026-05-08
---

# Plan 15-03 — CascadeRevealModal Summary

## Implemented

- **`client/src/components/CosmicHub/CascadeRevealModal.tsx`** (новый файл):
  - State machine: `opening-flash → coins-reveal → resources-reveal → pause → slot-spinning → slot-reveal → closing`
  - Cascade timeline: 200ms opening / 200ms coins / 200ms resources / 400ms pause → SerumSlotMachine takes over (REQ BOX-05)
  - Bonus drops показываются ДО slot-machine (Equal → Equal → BIG, REQ BOX-06)
  - Pre-roll rarity на mount через `rollBoxRarity(box.id)` (pure read; fairness)
  - `commitOpenedBox(box.id, rarity)` после slot's onComplete (atomic addSerum + remove + updatePity)
  - `instantMode` bypass: `getInstantBoxes()` → skip directly к 'slot-spinning' phase (UX-06)
  - `skipRequested` propagation от tap-anywhere в parent → `SerumSlotMachine` prop
  - tap-anywhere skip только в slot-spinning phase + 600ms anti-misclick
  - `handleClaim` — закрывает modal через onComplete (BoxesTab unmounts)
- Lazy import `SerumSlotMachine` через `React.lazy(() => import('./SerumSlotMachine'))` → отдельный chunk PERF-08.
- Inline `<style>` с keyframes `cascadeZoomIn` + `cascadeSlideUp` (one-time per mount).
- RevealResult sub-component с element-tinted reveal (boxShadow glow + 🧪 icon + serum text + claim button).

## Verification

- `npx tsc --noEmit` clean.
- `npm run build`: `dist/assets/CascadeRevealModal-*.js` = 4.61 KB (gzip 1.82 KB) — separate chunk confirmed.

## Pending

- Plan 15-04 — SerumSlotMachine реальная реализация (создана параллельно в этом же commit batch).
- Plan 15-05 — Settings toggle UI + tests + phase verify.
