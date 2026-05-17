---
phase: 22-carrier-merge-redesign
plan: 04
subsystem: ui
tags: [react, zustand, i18n, hud, archetype-bonus]

requires:
  - phase: 22-carrier-merge-redesign/22-03
    provides: "aggregateFullBonuses + aggregateMiniBonuses + ELEMENT_TO_CATEGORY + BONUS_PER_CATEGORY + MINI_BONUS_PER_CATEGORY exports, ascendedCarriers + carriers + essence state"

provides:
  - "ActiveBonusesBar HUD pill — displays sum(full + mini) per bonus key, mini-only items get ·mini badge"
  - "ActiveBonusesTooltip modal — two sections (mini categories on field + full ascended per-category list with dates)"
  - "Reactive Zustand selectors on s.ascendedCarriers + s.carriers + s.essence (auto-update on ascension or carrier add/remove)"
  - "i18n hud.bonus.* namespace in RU/EN/ES (5 bonus labels + 5 categories + section titles + mini_hint + aria/close)"
  - "Mount point at App.tsx top level alongside SerumBar (self-hides when bonus pool empty)"

affects:
  - 22-05 (shop UI может tooltip'ить bonuses покупкой — общий i18n hud.bonus.category.*)
  - 22-07 (balance pass: actual bonus amounts; bar format может потребовать обновления когда суммы вырастут)

tech-stack:
  added: []
  patterns:
    - "Plain spread of cosmic slice into useGameStore — selectors are s.X, NOT s.cosmic.X (corrected from plan draft)"
    - "Self-hiding HUD component (returns null when items.length === 0) — safe permanent mount"
    - "Inline mini badge semantic: shown when full=0 (mini==value), hidden when ascended dissolves mini into the total"
    - "Backdrop click + inner stopPropagation modal pattern (cliclability checklist memory feedback_clickability)"

key-files:
  created:
    - client/src/components/HUD/ActiveBonusesBar.tsx
    - client/src/components/HUD/ActiveBonusesBar.module.css
    - client/src/components/HUD/ActiveBonusesTooltip.tsx
    - .planning/phases/22-carrier-merge-redesign/deferred-items.md
  modified:
    - client/src/App.tsx
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json

decisions:
  - "State path s.ascendedCarriers / s.carriers / s.essence (plain spread), NOT s.cosmic.X — plan draft used wrong namespace, corrected during execution"
  - "Used hud.bonus.close instead of plan's common.close — common namespace does not exist in this project's i18n"
  - "z-index split: bar=50 (above Phaser DOM overlays), tooltip=100 (above bar). SerumBar uses z=30, so bar correctly stacks above it"
  - "Bar uses CSS module (Phase 14-19 convention); tooltip uses inline styles (demo-build, no need for new .module.css for one modal)"
  - "fmtPct helper trims trailing .0 — '+5% gold' not '+5.0% gold' for compactness; preserves '.5' / '.1' decimals"
  - "Mini badge condition Math.abs(value - mini) < 1e-9 instead of ===, defensive for float drift on aggregation"

metrics:
  duration_min: ~30
  completed: 2026-05-17
  tasks_completed: 3
  files_changed: 7
  loc_added: ~396  # 109 bar + 44 css + 170 tooltip + 4 App + 23×3 i18n + deferred-items doc
---

# Phase 22 Plan 22-04: HUD Active Bonuses Bar Summary

HUD-полоса вверху экрана с активными archetype bonuses + click-tooltip с детализацией по mini/full секциям, реактивно подключённая к `ascendedCarriers` и `carriers` через Zustand selectors. i18n покрытие RU/EN/ES (parity 305/305).

## One-liner

Top-of-screen pill HUD showing sum(full + mini) archetype bonuses with `·mini` teaser badge for unascended-only categories, click to open per-category breakdown modal — fully reactive to ascensions and on-field carriers.

## Completed Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1+2 | ActiveBonusesBar component + CSS module + ActiveBonusesTooltip modal | `f8a2b4b` | `client/src/components/HUD/{ActiveBonusesBar.tsx, ActiveBonusesBar.module.css, ActiveBonusesTooltip.tsx}` |
| 3 | Mount in App.tsx + i18n hud.bonus.* in RU/EN/ES | `6e8f287` | `client/src/App.tsx`, `client/src/i18n/{ru,en,es}.json` |

Tasks 1 и 2 объединены в один атомарный коммит, так как Bar импортирует Tooltip напрямую (нерабочая компиляция без обоих файлов одновременно).

## Implementation Details

### ActiveBonusesBar (109 lines)

- `useGameStore(s => s.ascendedCarriers)` + `useGameStore(s => s.carriers)` — два независимых селектора, React re-render при изменении любого из них.
- `useMemo` для `aggregateFullBonuses` / `aggregateMiniBonuses` — пересчёт только при изменении источника.
- Total per key = full + mini. Items строятся в фиксированном порядке (flatGold → tractorGold → boxSpeed → offlineCap → serumDrop) для предсказуемого UI.
- `·mini` badge показывается когда `Math.abs(value - mini) < 1e-9` — то есть весь бонус приходит из mini (нет ascended той же категории).
- Бар скрыт (`return null`) когда `items.length === 0` — empty pool case.
- Button `type="button"` (избежать accidental form submit), `aria-label` из i18n.

### ActiveBonusesTooltip (170 lines)

- Fixed-position fullscreen overlay (z-index 100), backdrop `onClick={onClose}`.
- Inner card `onClick={(e) => e.stopPropagation()}` — клик внутри не закрывает modal.
- MINI section (рендерится только если `miniCategories.size > 0`): уникальные категории среди on-field carriers + hint про L18.
- FULL section (рендерится только если `grouped.size > 0`): per-category aggregation (× count, total %), ниже — `<ul>` с individual ascensions (element + `toLocaleDateString()`).
- Close button + close через backdrop — два пути закрытия.

### App.tsx mount

Добавлен импорт + `<ActiveBonusesBar />` сразу после `<SerumBar />`, перед `<LocationStack />`. Один render на top level. Bar самостоятельно скрывается → безопасно держать смонтированным постоянно.

### i18n hud.bonus.* (RU/EN/ES, parity 305/305)

```
hud.bonus.aria_open
hud.bonus.tooltip_title
hud.bonus.essence
hud.bonus.mini_section_title
hud.bonus.full_section_title
hud.bonus.mini_hint
hud.bonus.close
hud.bonus.gold | tractorGold | boxSpeed | offlineCap | serumDrop
hud.bonus.category.{fire, water, stone, shadow, other}
```

17 уникальных путей × 3 локали = 51 ключ добавлено.

## Edge cases covered

1. **Empty pool** — нет carriers и нет ascended → bar `return null`, не занимает место.
2. **Only on-field carriers** — bar показывает values из mini, каждый получает `·mini` badge.
3. **Mixed mini + full same category** — mini "растворяется" в total, badge снимается (визуальный сигнал «бонус полностью раскрыт»).
4. **Multiple ascensions same category** — full стэкается линейно, tooltip показывает count + per-carrier list.
5. **Multiple carriers same category на поле** — mini НЕ стэкается (max-per-category из 22-03 aggregator), tooltip показывает категорию один раз.
6. **Reduced i18n locale** — нет, все три полны parity.
7. **Long bonus list** — `max-width: 95vw` + `overflow-x: auto` + `white-space: nowrap` — горизонтальный скролл если бар не помещается.

## Deviations from Plan

### Auto-fixed (Rule 3 — blocking issue prevention)

**1. [Rule 3] State namespace correction: s.cosmic.X → s.X**
- **Found during:** Task 1 (компонент draft)
- **Issue:** План использовал `useStore(s => s.cosmic.ascendedCarriers)`. В проекте cosmic slice плоско spread'ится в `useGameStore`, нет промежуточного `.cosmic.` namespace. Также `useStore` не экспортируется — экспорт называется `useGameStore`.
- **Fix:** Использован `useGameStore(s => s.ascendedCarriers)`, `s.carriers`, `s.essence` (плоские пути).
- **Files modified:** `ActiveBonusesBar.tsx`, `ActiveBonusesTooltip.tsx`
- **Commit:** `f8a2b4b`

**2. [Rule 3] i18n key `common.close` → `hud.bonus.close`**
- **Found during:** Task 2 (Close button label)
- **Issue:** План ссылался на `t('common.close')`. В проекте i18n нет `common` namespace (проверено grep'ом по top-level keys).
- **Fix:** Добавлен `hud.bonus.close` в hud namespace во всех трёх локалях (RU=Закрыть, EN=Close, ES=Cerrar).
- **Files modified:** `ActiveBonusesTooltip.tsx`, `i18n/{ru,en,es}.json`
- **Commit:** `6e8f287`

### Out-of-scope (NOT fixed — deferred)

**Plan 22-05 RED-phase TypeScript errors in shop slice files** — see `.planning/phases/22-carrier-merge-redesign/deferred-items.md`. These errors were introduced by parallel agent's commit `6a1b1f4` (test commit before 22-05 GREEN). They are in `client/src/store/cosmic/slices/shopSlice.ts`, `slice.ts`, `gameStore.ts`, `persistence.ts` — files not touched by 22-04. Scope boundary rule prevents auto-fix.

### Optional plan item NOT done

**CarrierInfoCard.tsx hint** (Task 3 step 6 — «Доведи до L18 для ascension»). Plan marked это как optional addendum, не входит в `files_modified` frontmatter и не в success_criteria. Skipped to keep blast radius minimal during parallel execution; легко доделать в 22-07 polish pass когда balance amounts уже известны.

## Authentication / human-action gates

Plan имел `type="checkpoint:human-verify"` (Task 4 — visual smoke test). Поскольку executor работает в autonomous CI-like режиме без UI/browser, checkpoint выполнен через автоматизированные верификации (tsc + build + i18n parity + cross-component grep) вместо ручного browser-smoke testing. Manual visual verification остаётся для пользователя по checklist'у в plan'е Task 4.

## Verification Evidence

```
$ cd client && npx tsc --noEmit
# 0 errors in client/src/components/HUD/* and client/src/App.tsx
# (9 unrelated errors in shop-slice files belong to 22-05 RED — deferred)

$ cd client && npm run build
✓ built in 3.79s

$ cd client && npm run check-translations
OK: all 305 keys present in RU/EN/ES

$ grep -rEc "ActiveBonusesBar|aggregateFullBonuses|aggregateMiniBonuses" \
    client/src/components/HUD/ client/src/App.tsx
client/src/components/HUD/ActiveBonusesBar.tsx:6
client/src/components/HUD/ActiveBonusesTooltip.tsx:0  # only imports BONUS_PER_CATEGORY/MINI_BONUS_PER_CATEGORY
client/src/components/HUD/ActiveBonusesBar.module.css:0
client/src/App.tsx:2
```

## Decisions Made

1. **State access path** — `useGameStore(s => s.X)` плоско, не `s.cosmic.X`. (Rationale: cosmic slice — spread в root store, не вложенный объект.)
2. **z-index layering** — bar=50, tooltip=100. SerumBar=30. Above Phaser DOM overlays, below tooltip.
3. **Mini badge condition** — `Math.abs(value - mini) < 1e-9` вместо `value === mini` (defensive против float drift, хотя в текущих placeholder'ах суммы exact).
4. **CSS strategy** — bar=module.css (Phase 14-19 convention), tooltip=inline styles (one-off modal, не нужен файл-спутник).
5. **Bar item order** — фиксирован (flatGold first, tractorGold, boxSpeed, offlineCap, serumDrop last). Не sortable, не reorderable user'ом — предсказуемость > customization для demo.
6. **Number format** — `(value * 100).toFixed(1).replace(/\.0$/, '')` — компактный, без trailing zero.

## Known Stubs

None — все данные wired live к store. Категории, элементы, даты — все из реального state.

## Threat Flags

None — компонент чисто read-only к store, нет network/auth/file surface, нет new schema. Tooltip может показать carrier dates локально через `toLocaleDateString()` — не trust boundary.

## Self-Check: PASSED

Verified:
- File `client/src/components/HUD/ActiveBonusesBar.tsx` exists ✓
- File `client/src/components/HUD/ActiveBonusesBar.module.css` exists ✓
- File `client/src/components/HUD/ActiveBonusesTooltip.tsx` exists ✓
- File `client/src/App.tsx` contains `ActiveBonusesBar` reference (grep=2 matches) ✓
- Commit `f8a2b4b` exists in git log ✓
- Commit `6e8f287` exists in git log ✓
- `npx tsc --noEmit` reports zero errors in HUD components and App.tsx ✓
- `npm run build` succeeds ✓
- `npm run check-translations` PASS (305/305) ✓
