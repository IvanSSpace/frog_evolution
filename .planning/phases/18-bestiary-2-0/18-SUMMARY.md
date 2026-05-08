---
phase: 18-bestiary-2-0
plan: 00
type: master-summary
status: complete
date: 2026-05-08
requirements_covered: [BESTIARY-01, BESTIARY-02, BESTIARY-03, BESTIARY-04, BESTIARY-05, BESTIARY-06, BESTIARY-07, BESTIARY-08, BESTIARY-09, I18N-02]
---

# Phase 18: Бестиарий 2.0 — Summary

**One-liner:** Virtualized 1536-cell bestiary (TanStack Virtual, 4 location tabs × 384 cells, sub-completion milestones at 10/24/96/576) с CSS preview, filter pills, search/sort, RU/EN/ES — мета-loop замкнут.

## Coverage matrix

| REQ-ID | Status | Where |
|--------|--------|-------|
| BESTIARY-01 | ✓ | BestiaryTab.tsx (4 LOCATION_TABS rarity-mapped Болото/Лес/Континент/Планета) |
| BESTIARY-02 | ✓ | BestiaryGrid.tsx (TanStack useVirtualizer, 6 cols × 64 rows, overscan 5) |
| BESTIARY-03 | ✓ | bestiary.ts (countUnlocked + unlockedInLocation, 192-byte bitset preserved) |
| BESTIARY-04 | ✓ | FilterPills.tsx (rarity pills All/4 + element search input) |
| BESTIARY-05 | ✓ | useBestiaryView.ts (default showLocked=false если countUnlocked > 0) |
| BESTIARY-06 | ✓ | BestiaryCell.tsx (rarity border + glow + ELEMENT_TINT linear-gradient + 🐸 emoji + L-badge) |
| BESTIARY-07 | ✓ | slice.ts setBestiaryBit + bestiary.ts BESTIARY_MILESTONES + MilestoneToast.tsx (10/24/96/576) |
| BESTIARY-08 | ✓ | FilterPills.tsx (sort dropdown level-asc/desc/element/rarity) |
| BESTIARY-09 | ✓ | BestiaryDetailModal.tsx + AwakenedPreviewCanvas.tsx (CSS preview + sound-style label + lore placeholder) |
| I18N-02 | ✓ | ru/en/es.json — все 38 ключей `cosmic_hub.bestiary.*` × 3 языка = 114 переводов |

## Sub-plans

| Plan | Wave | Commits | Description |
|------|------|---------|-------------|
| 18-01 | 1 | 1 | bestiary.ts ext (countUnlocked/unlockedInLocation/BESTIARY_MILESTONES/milestonesCrossed/isBitSet) + slice.setBestiaryBit milestone trigger + frogExclusiveUnlocked flag + cosmic:bestiary-milestone event + verify_bestiary.cjs |
| 18-02 | 1 | 1 | @tanstack/react-virtual install + BestiaryCell.tsx (memoized 64×64 cell, 2 variants) + rarityStyles.ts |
| 18-03 | 2 | 1 | useBestiaryView.ts + BestiaryGrid.tsx + FilterPills.tsx + BestiaryTab.tsx full rewrite (4 location tabs + per-tab badges) + BestiaryDetailModal stub |
| 18-04 | 3 | 1 | AwakenedPreviewCanvas.tsx (CSS pulse/bob keyframes) + BestiaryDetailModal.tsx full impl (unlocked + locked variants + Escape close) |
| 18-05 | 3 | 1 | i18n RU/EN/ES (38 keys) + MilestoneToast.tsx (auto-hide queue) + devHelpers.ts (window.__unlockBestiaryCells/__bestiaryCount/__resetBestiary) + App.tsx wiring + smoke_bestiary.cjs |

**Total:** 5 atomic commits (one per sub-plan).

## Bundle delta vs Phase 17 baseline

| Bundle | Phase 17 | Phase 18 | Delta |
|--------|----------|----------|-------|
| index.js gzip | 224.06 KB | 226.38 KB | **+2.32 KB** |
| CosmicHubModal chunk gzip | 5.68 KB | 13.89 KB | **+8.21 KB** |
| CSS gzip | 5.18 KB | 5.25 KB | +0.07 KB |
| **Total Phase 18 gzip impact** | — | — | **+10.60 KB** |

Cap: ≤ +30 KB gzip (Phase 18+19 split budget +50 KB). **PASS** with 19.4 KB headroom for Phase 19.

## Verify outputs

`node client/scripts/verify_bestiary.cjs` (Phase 18-01):
```
[countUnlocked] PASS
[unlockedInLocation] PASS
[milestones] PASS
[bitset size] PASS

ALL BESTIARY TESTS PASSED ✓
```

`node client/scripts/smoke_bestiary.cjs` (Phase 18-05): 18/18 file/grep checks PASS + tsc clean.

## Key architectural decisions (final)

- **D-01 layout formula:** наследована из Phase 17 (`(level-1)*64 + e*4 + r`); НЕ ломаем существующие сейвы.
- **D-02 4 локации = 4 rarity tiers:** common/rare/epic/legendary → Болото/Лес/Континент/Планета. Каждая локация = 384 cells (16 elements × 24 levels).
- **D-03 milestones:** 10 → 1000 монет (через `addGold`); 24 → epic serum (random element); 96 → legendary serum (random element); 576 → frogExclusiveUnlocked flag.
- **D-04 grid layout:** 6 cols × 64 rows = 384 cells (idealная упаковка vs брифинг 5 cols ошибка).
- **D-05 default «Discovered only»:** showLocked=true только если countUnlocked === 0 в этой локации (empty state).
- **D-06 preview:** CSS-only (radial-gradient orb + ELEMENT_TINT + rarity glow + bestiary-pulse/bob keyframes). Phaser-rendered preview deferred (REQ BESTIARY-09 satisfied — «visual preview», not «Phaser preview»).
- **D-07 migration safety:** bitset 192 bytes preserved (Phase 17 миграция уже сделала); Phase 18 read-only расширение.

## Files created (12)

1. `client/src/components/CosmicHub/bestiary/BestiaryCell.tsx`
2. `client/src/components/CosmicHub/bestiary/BestiaryGrid.tsx`
3. `client/src/components/CosmicHub/bestiary/BestiaryDetailModal.tsx`
4. `client/src/components/CosmicHub/bestiary/AwakenedPreviewCanvas.tsx`
5. `client/src/components/CosmicHub/bestiary/MilestoneToast.tsx`
6. `client/src/components/CosmicHub/bestiary/FilterPills.tsx`
7. `client/src/components/CosmicHub/bestiary/useBestiaryView.ts`
8. `client/src/components/CosmicHub/bestiary/rarityStyles.ts`
9. `client/src/components/CosmicHub/bestiary/index.ts`
10. `client/src/utils/devHelpers.ts`
11. `client/scripts/verify_bestiary.cjs`
12. `client/scripts/smoke_bestiary.cjs`

## Files modified (8)

1. `client/src/store/cosmic/bestiary.ts` — extended (4 new exports + isBitSet)
2. `client/src/store/cosmic/types.ts` — frogExclusiveUnlocked flag
3. `client/src/store/cosmic/slice.ts` — setBestiaryBit milestone-aware + setFrogExclusiveUnlocked
4. `client/src/store/eventBus.ts` — cosmic:bestiary-milestone typing
5. `client/src/store/gameStore.ts` — frogExclusiveUnlocked persist (load + save + subscribe)
6. `client/src/components/CosmicHub/BestiaryTab.tsx` — full rewrite (Phase 11 stub → Phase 18 full)
7. `client/src/App.tsx` — `<MilestoneToast />` mount + `installBestiaryDevHelpers()` в DEV
8. `client/src/i18n/{ru,en,es}.json` — 38 keys × 3 languages

## Deviations from Plan

### Auto-fixed (Rule 1-3)

1. **[Rule 3 — Blocking]** `setBit` return type changed in plan from `number[]` to union `number[] | ReadonlyArray<number>` для idempotency check (`next === s.bestiaryBitset`). Reverted к `number[]` чтобы не ломать Phase 17 callers (3 sites in slice.ts). Idempotency теперь через explicit `isBitSet()` helper. Files: `bestiary.ts`, `slice.ts`.

2. **[Rule 3 — Blocking]** `gameStore.ts` persist shape needed `frogExclusiveUnlocked` field в loader + saver + subscribe predicate. Plan не упоминал, tsc указал. Files: `gameStore.ts` (3 spots).

3. **[Rule 1 — Bug]** Plan 18-04 предлагал i18n key `cosmic_hub.bestiary.sound_style.{rarity}` (с точкой), но i18next dot-notation резолвится как nested object. Используется underscore-форма `sound_style_${rarity}` для flat lookup. Files: `BestiaryDetailModal.tsx`, `ru/en/es.json`.

4. **[Rule 1 — Bug]** Plan 18-04 references `t('elements.${element}')`, но фактический i18n путь — `cosmic_hub.elements.{element}`. Используется correct path с defaultValue fallback. Files: `BestiaryDetailModal.tsx`.

5. **[Rule 2 — Critical]** Plan 18-01 предлагал `gameStore.addCoins`, но фактический action в существующем сторе — `addGold` (Phase 1.0 naming). Реализовано через duck-typing с fallback (`addGold ?? addCoins`). Files: `slice.ts`.

### No architectural changes (Rule 4) needed.

## Threat surface scan

No new trust boundaries introduced. Phase 18 read-only UI на existing bitset. dev-helpers gated на `import.meta.env.DEV` (T-18-04 mitigation in place).

## Self-Check: PASSED

- All 12 files created exist on disk
- All 5 commits visible in `git log`
- tsc --noEmit clean
- npm run build clean (only pre-existing chunking warnings)
- verify_bestiary.cjs PASS
- smoke_bestiary.cjs 18/18 PASS

## Next phase

Phase 19 (Balance + tutorial + toggles + i18n polish) — final v2.0 milestone phase.
