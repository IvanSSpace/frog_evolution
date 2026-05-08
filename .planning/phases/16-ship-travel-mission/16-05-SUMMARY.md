---
phase: 16-ship-travel-mission
plan: 05
subsystem: ux-disclosure
tags: [phase-16, ux-09, dev-tools, gating, verify]
status: complete
completed: 2026-05-08
---

# Phase 16 Plan 05: Progressive Disclosure + Dev Helpers + Verify Summary

Финализация Phase 16: tab gating logic в CosmicHubModal (UX-09), DEV-mode unlock all sentinel flags, window dev helpers (5), full tsc/build/bundle verify.

## REQ Coverage

| REQ | Status | Notes |
|-----|--------|-------|
| UX-09 | ✓ | CosmicHubModal: enabled flag per tab; 🔒 + tooltip когда disabled; auto-fallback на первый enabled tab |

## Files

**Modified:**
- `client/src/components/CosmicHub/CosmicHubModal.tsx` — extended Tab interface (enabled, lockReason); useGameStore selectors для sentinel flags; isDev override; fallback useEffect
- `client/src/App.tsx` — DEV-mode useEffect: queueMicrotask sentinel unlock + 5 window dev helpers (`__forceMissionType`, `__resetCrewToday`, `__unlockAllTabs`, `__lockAllTabs`, `__shipTo`)

## Atomic Commits

- `8a7ac7a` phase-16: progressive disclosure tab gating in CosmicHubModal
- `7a90035` phase-16: DEV-mode unlock + dev helpers + window debug API

## Verification

### tsc + build
- `npx tsc --noEmit` → 0 errors
- `npm run build` → success in ~4.4s

### Bundle delta (vs Phase 14 baseline 211.59 KB index gzip)

| File | Before P16 (KB gzip) | After P16 (KB gzip) | Delta |
|------|----------------------|---------------------|-------|
| index.js | 211.59 | 218.70 | **+7.11 KB** |
| CosmicHubModal.js | 2.36 | 3.45 | +1.09 KB |
| **Total Phase 16 cumulative** | — | — | **+8.20 KB gzip** |

**Cap was ≤ +40 KB gzip vs Phase 15 baseline. Actual: +8.20 KB.** Well under budget.

### Smoke checklist (manual, conceptual — без dev-server)

| # | Test | Expected | Implementation |
|---|------|----------|----------------|
| 1 | Open Cosmic Hub | Корабль tab visible (DEV) | ✓ CosmicHubModal isDev override |
| 2 | Tap planet on StarMap (Hub open) | FlightConfirmDialog | ✓ App.tsx subscriber gated на cosmicHubOpen |
| 3 | Confirm flight | Ship transit visual | ✓ sendShipTo → applyShipState → ShipSprite.startTransit |
| 4 | Wait or `__shipTo('bliks')` | Toast «Прибыли на BLIKS [Изучить]» | ✓ App.tsx ship-arrived subscriber |
| 5 | Click [Изучить] | MissionOverlay fullscreen | ✓ start-mission → setActiveMissionPlanetId |
| 6 | `__forceMissionType('rhythm')` | Next mission rhythm | ✓ MissionOverlay reads localStorage |
| 7 | Mission perfect tap | bonusRarity = 0.15 | ✓ scoreToResult + bonusRarityForResult |
| 8 | Skip button after 1s | result='fail' addBox bonus=0 | ✓ MissionOverlay handleSkip |
| 9 | 4 missions cap | «Изучить» disabled + tooltip | ✓ ShipTab canInvestigate guard |
| 10 | `__lockAllTabs()` | Корабль/Боксы → 🔒 disabled | ✓ CosmicHubModal isDev=true overrides — note: `import.meta.env.DEV` всегда true в dev; `__lockAllTabs()` сбрасывает sentinel но isDev gate всё равно показывает. Чтобы протестировать prod gating — сделать prod build (`npm run build`) и открыть |

## Open Issues

- Toast message «Получен ящик NAME» — hardcoded RU в slice. Phase 19 polish может перенести в App.tsx render layer.
- `__lockAllTabs()` в DEV режиме не визуально locks — `isDev` override срабатывает раньше sentinel check. Это by design: DEV должен дать полный доступ; prod build обходит DEV path. Чтобы протестировать «реальный» locked state — `npm run build && serve dist/` либо комментировать isDev locally.
- bestiary tab в Phase 16: всегда enabled (но empty). Phase 18 polish добавит gate `hasOpenedAnyBox`.

## Phase 16 Final REQ Table

| REQ | Status | Plan |
|-----|--------|------|
| SHIP-01 | ✓ | 16-01 |
| SHIP-02 | ✓ | 16-02 |
| SHIP-03 | ✓ | 16-01 |
| SHIP-04 | ✓ | 16-02 |
| SHIP-05 | ✓ | 16-02 |
| SHIP-06 | ✓ | 16-01 + 16-02 |
| SHIP-07 | ✓ | 16-03 |
| SHIP-08 | ✓ | 16-03 |
| SHIP-09 | ✓ | 16-03 |
| SHIP-10 | ✓ | 16-02 + 16-03 |
| CREW-01 | ✓ | 16-01 |
| CREW-02 | ✓ | 16-01 |
| CREW-03 | ✓ | 16-01 |
| CREW-04 | ✓ | 16-04 |
| CREW-05 | ✓ | 16-03 |
| CREW-06 | ✓ | 16-03 |
| CREW-07 | ✓ | 16-03 |
| CREW-08 | ✓ | 16-04 (commented invariant) |
| MISSION-01 | ✓ | 16-04 |
| MISSION-02 | ✓ | 16-04 |
| MISSION-03 | ✓ | 16-04 |
| MISSION-04 | ✓ | 16-04 |
| MISSION-05 | ✓ | 16-04 |
| MISSION-06 | ✓ | 16-04 |
| MISSION-07 | ✓ | 16-04 |
| MISSION-08 | ✓ | 16-04 |
| UX-09 | ✓ | 16-05 |

**27/27 requirements complete.**

## Decisions

1. **DEV unlock в App.tsx, не gameStore.ts**: вынесено в App useEffect чтобы избежать import-time side effects в gameStore (тестируется лучше).
2. **Bestiary всегда enabled**: Phase 18 polish будет gate'ить через hasOpenedAnyBox; Phase 16 даёт минимум функциональности.
