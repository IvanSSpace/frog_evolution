---
phase: 26-cosmos-races-foundation
plan: 04
subsystem: ui
tags: [cosmic-hub, inventory, i18n, zustand, phase26, react]

# Dependency graph
requires:
  - phase: 26
    provides: RaceId + RACES config + RACES_BY_ID lookup (Plan 26-01)
  - phase: 25
    provides: _styles.ts design tokens (DARK_CARD_STYLE/SECTION_HEADER_STYLE/MINI_BADGE_STYLE/GOLD/PINK/TEXT_DIM/TEXT_VERY_DIM/EMPTY_STATE_TEXT_STYLE)
  - phase: 22
    provides: cosmos gate (CosmicHubModal lock screen wraps tab strip), shop tab pattern
  - phase: 19
    provides: ELEMENT_TINTS colorblind-safe palette (serum cell border colors)
provides:
  - "InventoryTab component (read-only single-view all resources)"
  - "6th tab 🎒 в CosmicHubModal (always enabled after cosmos unlock)"
  - "CosmicTab union extended с 'inventory' literal"
  - "i18n cosmic_hub.inventory.* namespace (9 keys) + tab_inventory label × 3 locales"
  - "ELEMENT_EMOJI local placeholder mapping (16 element visuals)"
affects: [27-artifacts (will fill artifacts placeholder), 29-relationships (will fill race relationships placeholder)]

# Tech tracking
tech-stack:
  added: []  # No new libraries — pure UI consuming Plan 26-01 foundation
  patterns:
    - "Read-only single-view inventory: granular Zustand selectors (s => s.essence, s => s.gold, s => s.serums) avoid whole-store re-render storm"
    - "Placeholder sections для будущих phases (artifacts/relationships) — UI surface ready, data wiring deferred"
    - "Element grid 4×4 с element-tint border при count>0, opacity 0.5 при count===0 (visual cue без hiding)"
    - "Local ELEMENT_EMOJI const (16 entries) — placeholder visuals; не дублируется с ElementGrid (filter-based)"

key-files:
  created:
    - client/src/components/CosmicHub/InventoryTab.tsx
    - .planning/phases/26-cosmos-races-foundation/26-04-SUMMARY.md
  modified:
    - client/src/store/cosmic/types.ts
    - client/src/components/CosmicHub/CosmicHubModal.tsx
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json

key-decisions:
  - "Plan описывал `s.coins` для gold currency, но реальное поле в gameStore называется `s.gold` (Phase 1.0 nomenclature). Rule 3 name correction — без неё компонент не получал бы значение gold (TS error)."
  - "Grid 4×4 для 16 serums (compact, не horizontal-scroll). Каждая cell ~70px на narrow 320px viewport — достаточно для emoji + count."
  - "Element-tint border при count > 0 (visual cue); dim opacity 0.5 при count===0 (не hide — игрок видит full коллекцию)."
  - "Number formatting через toLocaleString('ru-RU') + Math.floor (защита от float gold через l18 multiplier). Project не имеет formatter helper — toLocaleString достаточно для Phase 26."
  - "Native title tooltip для race relationship rows (mobile-poor acceptable для read-only display; кастомный Popover deferred до UX feedback)."
  - "InventoryTab placement at END of TABS array (последний tab). Relationship-первый порядок не имеет смысла без actual data."
  - "ELEMENT_EMOJI — локальная константа (НЕ shared utility в game/effects/elements/). При expansion в Phase 27+ (artifacts) extract в общий module."
  - "НЕ создал interactive sorting/filters внутри tab — read-only по CONTEXT D-ReadOnly."

patterns-established:
  - "Inventory tab pattern: read-only display всех типов resources в одном scroll-view (currencies + items + future-section placeholders). Future phases (artifacts, race relationships) заполняют placeholder блоки without touching layout."
  - "CosmicHubModal tab registration: import → getInitialTab validation literal → TABS entry → renderTab switch case (4 edits per new tab — следующая прямолинейная)."
  - "i18n inventory sub-namespace: cosmic_hub.inventory.* (под cosmic_hub, не top-level) — keeps related copy together for translators."

requirements-completed:
  - PHASE26-INVENTORY-TAB
  - PHASE26-INVENTORY-CURRENCIES
  - PHASE26-INVENTORY-SERUMS
  - PHASE26-INVENTORY-PLACEHOLDERS
  - PHASE26-I18N-INVENTORY

# Metrics
duration: ~10min
completed: 2026-05-18
---

# Phase 26 Plan 26-04: Inventory tab в Cosmic Hub Summary

**Новый 6-й таб 🎒 «Инвентарь» в CosmicHubModal — read-only single-view всех player resources (essence + gold + 16 serums grid + artifacts placeholder + 10 race relationships placeholder), reuse Phase 25 design tokens, RU/EN/ES i18n parity.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-18T10:25:56Z
- **Completed:** 2026-05-18T10:36:00Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Centralized inventory view — до Phase 26 не было одной точки where игрок видит все ресурсы (SerumInventoryTab только серумы, header показывает balance ephemerally).
- Готова UI surface для Phase 27 (artifacts) и Phase 29 (race relationships) — обе секции — placeholders, данные подключатся без layout-changes.
- CosmicTab union расширен 6 значениями (foundation для future tabs).
- i18n parity preserved: 400/400 keys across RU/EN/ES (баланс +10 keys × 3 locales по сравнению с baseline 390/390 после Plan 26-01).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend CosmicTab union + i18n inventory namespace** — `dc6a09a` (feat)
2. **Task 2: InventoryTab.tsx (read-only display)** — `4ad01df` (feat)
3. **Task 3: Wire InventoryTab в CosmicHubModal** — `13e9c3b` (feat)

_Note: Final SUMMARY commit будет добавлен orchestrator'ом._

## Files Created/Modified

### Created

- `client/src/components/CosmicHub/InventoryTab.tsx` (210 lines) — read-only inventory display:
  - `InventoryTab` (main export) — 4 sections (currencies / serums / artifacts placeholder / race relationships placeholder).
  - `CurrencyRow` (local helper component) — icon + label + value pill (essence pink, gold yellow).
  - `ELEMENT_EMOJI` const — 16 placeholder emoji per element.
  - `hexToCss` helper — Phaser hex (0xRRGGBB) → CSS '#rrggbb' (для tint border).

### Modified

- `client/src/store/cosmic/types.ts` — `CosmicTab` union теперь `'scouts' | 'boxes' | 'bestiary' | 'carriers' | 'shop' | 'inventory'`.
- `client/src/components/CosmicHub/CosmicHubModal.tsx`:
  - Import `InventoryTab`.
  - `getInitialTab()` accepts 'inventory' sessionStorage literal.
  - 6-я entry в TABS array (🎒 + tab_inventory label, always enabled — modal-level cosmos lock gates entire tab strip).
  - `renderTab()` switch case 'inventory' → `<InventoryTab />`.
  - Prettier autofix normalized pre-existing indentation в обвёртке !cosmosUnlocked / cosmos-unlocked блока (cosmetic-only, no behavior change — required by lint hook).
- `client/src/i18n/ru.json` — `cosmic_hub.tab_inventory: "Инвентарь"` + `cosmic_hub.inventory.*` (9 keys: section_currencies/section_serums/section_artifacts/section_relationships/currency_essence/currency_gold/placeholder_artifacts/placeholder_relationship_value/tooltip_relationship_pending).
- `client/src/i18n/en.json` — те же ключи переведены на EN.
- `client/src/i18n/es.json` — те же ключи переведены на ES.

## Decisions Made

1. **Field name correction:** Plan описывал `s.coins` для gold currency. Реальное поле в gameStore — `s.gold` (Phase 1.0 nomenclature, добавлен `addGold` action). Если бы пришлось использовать `coins` — TS error на selector. Rule 3 (blocking) — корректное name использовано в финале.

2. **Grid 4×4 для serums:** компактный layout (без horizontal scroll), каждая cell ~70px на 320px narrow viewport — достаточно для emoji + count. Если будут UX issues с touch targets — Plan 26-04 polish добавит min-height.

3. **Visual cue для count>0 vs count===0:** border = element tint при count>0, opacity 0.5 при count===0. Альтернатива (hide zeros) отвергнута — игрок должен видеть полную коллекцию (16 элементов = goal).

4. **Number formatting:** `Math.floor(value).toLocaleString('ru-RU')` — `Math.floor` защита от float (l18 multiplier может вернуть non-integer gold), `'ru-RU'` для thousand separators. Project не имеет formatter helper. TODO в Polish: если другие компоненты используют другой locale — extract `formatGold` utility.

5. **Native title tooltip для race relationships:** mobile-poor acceptable для read-only display. Кастомный Popover deferred до UX feedback shows mobile users miss it.

6. **InventoryTab placement at END of TABS array:** последний tab. Relationships-first порядок не имеет смысла без actual relationship data (Phase 29).

7. **Local ELEMENT_EMOJI const:** не extract в shared utility сейчас. Future Phase 27+ (artifacts) может expand в общий `elementVisuals.ts` если понадобится.

8. **No interactive elements внутри tab:** read-only по CONTEXT D-ReadOnly. Sorting/filters/tap-to-equip deferred до Phase 27 (когда появятся real artifacts).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] gameStore field is `gold`, not `coins`**
- **Found during:** Task 2 (InventoryTab.tsx skeleton)
- **Issue:** Plan task 2 `<action>` блок и `<interfaces>` секция описывали store field как `coins: number` с комментарием `gold / slime`. Однако реальный store field в `client/src/store/gameStore.ts` называется `gold` (с `addGold`/`addGoldRaw` actions). Селектор `s => s.coins` вернул бы `undefined` → TS2339 ошибка.
- **Fix:** Использовал `useGameStore((s) => s.gold)` в InventoryTab. Добавил inline comment про несоответствие plan vs реальное поле.
- **Files modified:** `client/src/components/CosmicHub/InventoryTab.tsx`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `4ad01df` (Task 2 commit)

**2. [Rule 2 — Code style consistency] Prettier autofix CosmicHubModal.tsx**
- **Found during:** Task 3 lint step
- **Issue:** Pre-existing файл имел mixed indentation в обвёртке `!cosmosUnlocked ?` / `<>` / `</>` блока (6 spaces вместо 8). ESLint prettier plugin требует normalized indent — добавление новых строк (import, getInitialTab, TABS entry, switch case) triggered 112 errors. Сам diff моих edits корректен; issue в окружающих pre-existing строках.
- **Fix:** `npx eslint --fix` нормализовал indent в pre-existing блоке (cosmetic-only). Behavior не изменилось.
- **Files modified:** `client/src/components/CosmicHub/CosmicHubModal.tsx`
- **Verification:** ESLint clean, tsc clean, behavior unchanged (diff confirms — только whitespace в pre-existing блоке).
- **Committed in:** `13e9c3b` (Task 3 commit, как часть wiring task)

**3. [Rule 2 — Number safety] Math.floor для float gold protection**
- **Found during:** Task 2 (CurrencyRow implementation)
- **Issue:** `gold` может быть float (gameStore.addGold применяет `l18GoldMultiplier(s.l18MergesCount)` — gain × multiplier может дать non-integer для пограничных multiplier'ов). Plan указывал `value.toLocaleString('ru-RU')` без integer cast — на float result показал бы "1 234,567 89".
- **Fix:** `Math.floor(value).toLocaleString('ru-RU')` — int separators clean.
- **Files modified:** `client/src/components/CosmicHub/InventoryTab.tsx`
- **Verification:** Manual mental check (gold=1234.56 → "1 234").
- **Committed in:** `4ad01df` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking name correction, 1 code style, 1 number safety).
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep — visible behavior соответствует plan must_haves exactly.

## Issues Encountered

- **Worktree base behind main:** Worktree branch was forked from older commit `b67c31e` (sfx tweaks) and lacked all Phase 25/26 work. Resolved via `git merge --ff-only main` (HEAD was ancestor of main — safe fast-forward, no destructive ops). Now worktree HEAD aligns with main + 3 new task commits.
- **node_modules missing:** Worktree had no installed deps. `npm install` succeeded (517 packages, 8s). Required для tsc/eslint/test execution.

## Validation Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (entire client/) | PASS (clean, no errors) |
| ESLint на InventoryTab.tsx / CosmicHubModal.tsx / types.ts | PASS (0 errors, 0 warnings; prettier autofix applied to pre-existing blocks) |
| `node scripts/check-translations.cjs` | PASS (**400/400** keys × 3 locales — parity preserved; +10 keys vs Plan 26-01 baseline 390) |
| `npm test` (vitest) | 97 passed / 1 skipped — **3 pre-existing failures unchanged** (slice.openBox.test.ts, slice.test.ts, cosmicSettings.test.ts — documented in deferred-items.md, NOT caused by Plan 26-04) |
| InventoryTab.tsx renders 4 sections | Verified via TypeScript structure + component tree |
| 16 element cards в grid | ELEMENTS array iteration (4×4 = 16) |
| 10 race rows | RACES array iteration (10 entries from Plan 26-01) |
| sessionStorage 'inventory' literal accepted | getInitialTab() validation extended |
| Cliclability checklist | type="button" inherited from TABS.map render; touchAction: 'manipulation' inherited from baseStyle; z-index 50 unchanged |

## Polish TODO (deferred)

- **Tab strip squeeze на ультра-узких viewport (320px):** 6 tabs × `flex: 1` могут стать тесными для labels. Defer until first real-device feedback — minor UX issue.
- **Replace native title tooltip → custom Popover:** если UX feedback показывает mobile users miss native tooltip. Defer until Phase 26-06 (finalize) or Phase 29 (когда relationships станут interactive).
- **Number-format helper:** extract `formatGold` utility если другие места в проекте используют другой locale/formatter. Currently `toLocaleString('ru-RU')` достаточно.
- **Shared ELEMENT_EMOJI utility:** extract в `game/effects/elements/elementEmojis.ts` если Phase 27+ (artifacts) понадобится same mapping.

## Next Phase Readiness

- **Plan 26-05** (FirstContactController) — independent of Inventory tab (different surface). No blockers from 26-04.
- **Plan 26-06** (finalize / SMOKE / ROADMAP / STATE) — будет проверять manual smoke test (открыть Cosmic Hub → switch на 🎒 → видеть 4 секции с live values).
- **Future Phase 27** (artifacts) — заменит `placeholder_artifacts` empty state на actual artifact grid внутри `section_artifacts`. Layout остался открытым.
- **Future Phase 29** (relationships) — заменит '?' placeholder на real relationship values (0-100, color-coded) в 10 race rows. RACES iteration уже на месте.

## Self-Check: PASSED

- `client/src/components/CosmicHub/InventoryTab.tsx` — exists ✓
- Commit `dc6a09a` (Task 1: CosmicTab union + i18n) — found in git log ✓
- Commit `4ad01df` (Task 2: InventoryTab) — found in git log ✓
- Commit `13e9c3b` (Task 3: wire into CosmicHubModal) — found in git log ✓
- `npx tsc --noEmit` clean — verified ✓
- `node scripts/check-translations.cjs` 400/400 — verified ✓
- ESLint clean on touched files — verified ✓
- Test suite green (no new failures, 3 pre-existing unchanged) — verified ✓

---

*Phase: 26-cosmos-races-foundation*
*Plan: 04*
*Completed: 2026-05-18*
