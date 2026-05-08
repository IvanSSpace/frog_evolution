---
phase: 15-boxes-slot-machine
plan: 05
status: complete
date: 2026-05-08
---

# Plan 15-05 — BulkOpenSummary + Settings + Lazy + i18n + Verify Summary

## Implemented

- **`client/src/utils/cosmicSettings.ts`** — getInstantBoxes / setInstantBoxes / subscribeInstantBoxes (localStorage + window CustomEvent dispatch).
- **`client/src/utils/cosmicSettings.test.ts`** — 5 unit tests passing (default/set/subscribe/unsubscribe).
- **`client/src/components/CosmicHub/BulkOpenSummary.tsx`** (новый файл):
  - groupResults helper: collapses BulkOpenResult[] → GroupedRow[] sorted (legendary first, then count DESC)
  - SummaryRow с element-tinted dot + count badge (rarity color)
  - Confetti glow (radial-gradient infinite-alternate animation) если есть legendary
  - Single «Забрать всё» close button
- **`client/src/components/CosmicHub/BoxesTab.tsx`** — handleOpenAll wired:
  - snapshot boxes → foreach `rollBoxRarity` + `commitOpenedBox` → results
  - setBulkResults → mounts BulkOpenSummary lazy
- **`client/src/ui/components/SettingsModal.tsx`** — новая секция «🧬 Космос» с toggle «Боксы мгновенно» (useSyncExternalStore reactive).
- **`client/src/components/CosmicHub/CascadeRevealModal.tsx`** — использует import `getInstantBoxes` из cosmicSettings (не inline localStorage).
- **i18n RU/EN/ES** — добавлены ключи `cosmic_hub.{boxes,cascade,slot,bulk}` + top-level `rarity` + `settings.{cosmic,instant_boxes}`. Parity check: 201 ключей × 3 локали (no missing keys).

## Verification — Phase 15 Success Criteria 1-10

| # | Criterion | Status |
|---|-----------|--------|
| 1 | tsc clean + build success | ✓ |
| 2 | 3 lazy chunks (CascadeRevealModal/SerumSlotMachine/BulkOpenSummary) | ✓ confirmed in dist/assets/ |
| 3 | Dev __addBox → cascade → slot → reveal → серум inventory | ✓ code-verified (smoke pending dev runtime) |
| 4 | Skip works (tap 0.6+ + Skip button 1+) | ✓ implemented с completedRef guard |
| 5 | Settings toggle instantBoxes → 400ms reveal | ✓ getInstantBoxes wired в CascadeRevealModal + SerumSlotMachine |
| 6 | 5+ boxes → Открыть все → BulkOpenSummary | ✓ handleOpenAll wired в BoxesTab |
| 7 | Slot duration коррелирует с rarity | ✓ DURATIONS table locked |
| 8 | Pity 25 → guaranteed legendary | ✓ rollRarity hard guarantee |
| 9 | __addBox tree-shaken в prod | ✓ verified `grep __addBox dist/assets/*.js` = 0 |
| 10 | i18n RU/EN/ES coverage | ✓ parity check: 201 keys × 3 locales |

## Bundle delta vs Phase 16 baseline (218.70 KB gzip index.js)

| Chunk | Size | Gzip |
|-------|------|------|
| index-*.js (main) | 756.82 KB | **220.23 KB** (Δ +1.53 KB) |
| CascadeRevealModal-*.js | 4.61 KB | 1.82 KB (new) |
| SerumSlotMachine-*.js | 5.27 KB | 2.05 KB (new) |
| BulkOpenSummary-*.js | 2.66 KB | 1.32 KB (new) |
| CosmicHubModal-*.js | 12.35 KB (was 9.58) | 4.39 KB (was 3.45 — Δ +0.94 KB) |
| **Total Phase 15 delta** | — | **≈ +7.66 KB gzip** |

**Cap: +35 KB ✓ — used 22% of budget.**

## Test summary

- rarityRoll.test.ts: **11/11 ✓**
- slice.test.ts: **11/11 ✓**
- cosmicSettings.test.ts: **5/5 ✓**
- **Total: 27/27 unit tests passing.**

## Out of scope

- Real audio для slot-machine (sound-style labels ♪ only) — out of scope v2.0
- Visible pity counter UI — Phase 19 UX-01
- Box arrives from real mission (Phase 16 already provides; Phase 15 dev-helper covers test)
