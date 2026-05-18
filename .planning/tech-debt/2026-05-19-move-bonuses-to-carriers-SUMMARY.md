---
phase: tech-debt
plan: 2026-05-19-move-bonuses-to-carriers
subsystem: ui/cosmic-hub
tags: [refactor, ui, cosmic-hub, archetype-bonuses, hud-cleanup]
requires:
  - utils/archetypeBonuses (aggregateFullBonuses, aggregateMiniBonuses)
  - utils/cosmosGate (useCosmosUnlocked)
  - components/CosmicHub/_styles (DARK_CARD_STYLE, SECTION_HEADER_STYLE, GOLD, TEXT_DIM)
  - i18n hud.bonus.* (gold/tractorGold/boxSpeed/offlineCap/serumDrop labels)
provides:
  - components/CosmicHub/CarrierBonusesPanel (display-only section)
  - i18n key cosmic_hub.carrier.no_active_bonuses (ru/en/es)
affects:
  - App.tsx HUD layout (одним fixed-positioned элементом меньше)
  - CarriersTab visual structure (panel сверху перед carrier cards)
  - HUD directory (теперь пустая, удалена)
tech-stack:
  added: []
  patterns:
    - "i18n key reuse — hud.bonus.* переюзан из удалённого компонента"
    - "Display-only component (no state, no handlers, no animation)"
key-files:
  created:
    - client/src/components/CosmicHub/CarrierBonusesPanel.tsx
  modified:
    - client/src/App.tsx
    - client/src/components/CosmicHub/CarriersTab.tsx
    - client/src/utils/cosmosGate.ts (comment-only)
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json
  deleted:
    - client/src/components/HUD/ActiveBonusesBar.tsx
    - client/src/components/HUD/ActiveBonusesBar.module.css
    - client/src/components/HUD/ActiveBonusesTooltip.tsx
decisions:
  - "Panel mount'нут в обоих branches CarriersTab (empty + populated): ascended bonuses могут существовать без живых carrier'ов"
  - "Empty state добавлен (раньше bar просто скрывался); explicit «нет активных бонусов» — лучше discoverability"
  - "Tooltip не перенесён — panel display-only, детализация (per-carrier list + element + ascended date) не критична для текущего UX"
  - "i18n keys hud.bonus.* сохранены as-is — namespace оставлен чтобы не ломать future tooling/audit; новый ключ no_active_bonuses добавлен в cosmic_hub.carrier.* (соответствует семантике места)"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-19"
  tasks: 3
  files_changed: 9
  insertions: 182
  deletions: 350
---

# Tech-debt 2026-05-19: Move Bonuses to Carriers Tab Summary

Перенесли display активных archetype bonuses из top-HUD pill bar
(`ActiveBonusesBar`) в Cosmic Hub → Carriers tab как display-only
styled panel (`CarrierBonusesPanel`); удалили старый HUD bar +
tooltip + module.css; убрали один fixed-positioned/z-index элемент
из layout.

## Objective Recap

1. **DELETE** `ActiveBonusesBar` mount в App.tsx ✓
2. **CREATE** `client/src/components/CosmicHub/CarrierBonusesPanel.tsx` ✓
3. **MOUNT** `CarrierBonusesPanel` сверху в `CarriersTab.tsx` ✓
4. **DELETE** `ActiveBonusesBar.tsx`, `.module.css`, `ActiveBonusesTooltip.tsx` + import из App.tsx ✓

## What Changed

### New: `CarrierBonusesPanel.tsx`

Display-only React section, не button, не overlay:

- **Aggregation logic** — без изменений, `aggregateFullBonuses(ascended) + aggregateMiniBonuses(carriers)`, suma per bonus key.
- **5 bonus rows max** (flatGold / tractorGold / boxDropSpeed / offlineCap / serumDrop), каждая показывается только если `total > 0`.
- **`·mini` badge** сохранён: рендерится когда вся сумма приходит от mini (`mini > 0 && |value − mini| < 1e-9`). Visual cue «бонус ещё не раскрыт полностью».
- **Empty state** — explicit message `cosmic_hub.carrier.no_active_bonuses` если items.length === 0 (раньше bar просто скрывался).
- **Cosmos gate** — defensive `useCosmosUnlocked()` check (panel returns null pre-cosmos).
- **Styling** — `DARK_CARD_STYLE` + `SECTION_HEADER_STYLE` + `GOLD` accent для процентов + `TEXT_DIM`/`TEXT_VERY_DIM` для labels/empty. Все из `_styles.ts`.
- **No animations** (memory `feedback_animations`) — static display, никаких CSS keyframes / tweens.
- **No interactions** — нет click handler, нет tooltip, нет state. Pure props-less display.

### Mounting в `CarriersTab.tsx`

Panel рендерится **сверху** в обоих branches:

- **Empty state branch** (`carriers.length === 0`): обёрнут в `p-3` wrapper, panel идёт первым, эмодзи 🐸 + empty hint после — иначе panel бы пропал когда нет carrier'ов но есть ascended bonuses.
- **Populated branch**: panel идёт первым, дальше count badge + sorted CarrierInfoCard'ы.

Cosmos gate в panel + items.length === 0 → no_active_bonuses → panel сам hide-ится через empty-state subsection если нечего показывать (но всегда показывает header «Активные бонусы»).

### Deletions

- `client/src/components/HUD/ActiveBonusesBar.tsx` (115 lines)
- `client/src/components/HUD/ActiveBonusesBar.module.css` (45 lines)
- `client/src/components/HUD/ActiveBonusesTooltip.tsx` (171 lines)
- `HUD/` directory empty → удалена (git автоматически)

### App.tsx changes

- Remove `import { ActiveBonusesBar }` line
- Remove `<ActiveBonusesBar />` JSX + replace comment с note о новом месте
- Один fixed-positioned / z-index: 50 элемент меньше в layout (less HUD clutter)

### i18n

- Preserved hud.bonus.* keys (ru/en/es) — reused by CarrierBonusesPanel
- New key `cosmic_hub.carrier.no_active_bonuses` added в ru/en/es:
  - ru: «Нет активных бонусов»
  - en: «No active bonuses»
  - es: «Sin bonos activos»

### Comment-only changes

- `cosmosGate.ts` — updated example list of серум-gated компонентов
  (SerumBar/CarrierBonusesPanel вместо SerumBar/ActiveBonusesBar) +
  added note об удалении ActiveBonusesBar для future readers.

## Commits

| # | Hash    | Type     | Description                                        |
| - | ------- | -------- | -------------------------------------------------- |
| 1 | 254a08c | feat     | add CarrierBonusesPanel display-only component     |
| 2 | b43e612 | feat     | mount CarrierBonusesPanel в CarriersTab            |
| 3 | 3f645ad | refactor | remove ActiveBonusesBar from HUD                   |

## Deviations from Plan

**Rule 2 - Missing critical UX functionality (mini one):**

Plan asked to add empty state «нет активных бонусов» (which was new
behaviour, not present in old bar that just hid). Created new i18n
key `cosmic_hub.carrier.no_active_bonuses` (ru/en/es) — this is a
small but user-facing string, not just a refactor. Documented as
deliberate addition rather than direct port.

**Rule 3 - Auto-fix doc drift:**

`cosmosGate.ts` had a comment listing `ActiveBonusesBar` as one of
the cosmos-gated components. Updated to list `CarrierBonusesPanel`
instead + breadcrumb note about the rename, so future readers don't
chase a missing component.

Plan-wide otherwise: executed exactly as written. No architectural
changes, no Rule 4 escalations.

## Verification

- [x] `npx tsc --noEmit` — clean
- [x] `npm run test` (vitest run) — PASS (198) / FAIL (0)
- [x] `npm run build` (tsc + vite build) — `built in 4.21s`, output chunks reasonable
- [x] Repo-wide grep `ActiveBonusesBar|ActiveBonusesTooltip` — only doc-comment refs remain (CarrierBonusesPanel.tsx header + cosmosGate.ts breadcrumb + App.tsx removal comment). No live imports.
- [x] `git status` — clean tree after build
- [x] HUD directory removed (was empty after deletions)

## Acceptance Criteria

- [x] CarrierBonusesPanel.tsx created в CosmicHub/
- [x] Mounted сверху в CarriersTab.tsx (both empty + populated branches)
- [x] ActiveBonusesBar mount removed from App.tsx
- [x] ActiveBonusesBar.tsx + .module.css + Tooltip deleted (no other refs)
- [x] i18n keys hud.bonus.* preserved (used by new panel)
- [x] tsc clean (client)
- [x] vitest green (198/198)
- [x] vite build successful
- [x] SUMMARY at .planning/tech-debt/2026-05-19-move-bonuses-to-carriers-SUMMARY.md
- [x] Atomic commits (3 separate: create / mount / remove)
- [x] No STATE.md / ROADMAP.md edits

## Known Stubs

None. CarrierBonusesPanel is fully wired (reads live ascendedCarriers
+ carriers from Zustand, aggregates через existing utility, renders
real values). No placeholder text, no hardcoded mock data.

## Threat Flags

None. UI-only refactor of an existing component. No new network
endpoints, auth paths, file access, or schema changes. Trust
boundaries unchanged.

## Self-Check: PASSED

- CarrierBonusesPanel.tsx — FOUND
- ActiveBonusesBar.tsx — DELETED
- ActiveBonusesBar.module.css — DELETED
- ActiveBonusesTooltip.tsx — DELETED
- Commits 254a08c / b43e612 / 3f645ad — all present in git log
- SUMMARY.md — FOUND at expected path
