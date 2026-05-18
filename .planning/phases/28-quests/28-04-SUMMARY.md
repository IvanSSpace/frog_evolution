---
phase: 28-quests
plan: 04
subsystem: quests-tab-ui
tags: [quests, react, dom, cosmic-hub, i18n, cliclability, css-transition]

# Dependency graph
requires:
  - phase: 28-quests
    plan: 01
    provides: CosmicSlice.activeQuests/completedQuests fields + ACTIVE_QUEST_CAP=5 + ActiveQuest/CompletedQuest/QuestConfig/QuestTarget/QuestReward types + QUESTS lookup + 8th 'quests' CosmicTab literal + cosmic_hub.quests.* i18n umbrella (header_active, header_completed, empty_state, cap_reached, cancel_confirm, cancel_button, type.{4 quest types})
  - phase: 28-quests
    plan: 02
    provides: QUESTS catalogue filled with 40 entries (description_key/short_key i18n leaves under top-level "quests" namespace в 3 locales)
  - phase: 28-quests
    plan: 03
    provides: cancelQuest(activeQuestId) slice action (applies -1 relationship + emits 'quests:cancelled' + 'contacts:relationship-delta') + reconcileQuestProgress() slice action (polling reconcile)
  - phase: 27-contacts-messages-relationships
    plan: 04
    provides: ContactsTab pattern (granular Zustand selectors + mount effect triggerPendingPull + in-tab navigation) — mirrored для QuestsTab pattern
  - phase: 25-cosmic-hub-restyle
    provides: _styles.ts design tokens (DARK_CARD_STYLE, SECTION_HEADER_STYLE, EMPTY_STATE_TEXT_STYLE, GOLD, TEXT_DIM, TEXT_VERY_DIM) — Phase 25 design language
provides:
  - QuestsTab React component (8th-tab content) — reads activeQuests + ACTIVE_QUEST_CAP + reconcileQuestProgress; renders header + cap notification + empty state + QuestCard list + CompletedQuestsList
  - QuestCard React component — per-active-quest card with race emoji + name + type icon/label + short label + description + CSS-transition progress bar + reward preview + cancel button with inline confirm panel
  - CompletedQuestsList React component — collapsible history (default closed); MAX_VISIBLE=20 entries sorted desc by completedAt; «... +N» tail when sorted.length > 20
  - CosmicHubModal renderTab case 'quests' returns <QuestsTab /> (Plan 28-01 inline placeholder div removed)
  - Cancel flow UI: inline confirm panel (NOT separate modal) — keeps Cosmic Hub overlay stack simple
affects: [28-05-reward-popup, 28-06-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline confirm panel (showConfirm useState) inside QuestCard — alternative to standalone modal-stack confirm. Trade-off: simpler z-index hierarchy + no portal mount cost, at the price of confirm dialog being contextually anchored to the card (visually clearer in this use case)"
    - "MAX_VISIBLE cap on rendered history (20) — UI-layer bound, separate from defensive-load COMPLETED_QUEST_HISTORY_CAP=100. Pattern mirrors Phase 27 list-cap-then-tail-counter approach"
    - "formatGoldShort + rewardSummary inlined в both QuestCard + CompletedQuestsList — scope of duplication is 2 files. Promotion to shared util deferred (extract когда 3-rd consumer arrives — Plan 28-05 reward popup likely)"
    - "Reward preview as one-line string via rewardSummary(reward, t) — keeps QuestCard layout simple (single span); per-quest variation lives в i18n description text, не в card structure"
    - "Mount-effect reconcile pattern (Phase 27 ContactsTab triggerPendingPull) — QuestsTab calls reconcileQuestProgress() on mount; engine idempotent so re-entry safe (HMR + tab toggle)"

key-files:
  created:
    - client/src/components/CosmicHub/QuestsTab.tsx
    - client/src/components/CosmicHub/quests/QuestCard.tsx
    - client/src/components/CosmicHub/quests/CompletedQuestsList.tsx
  modified:
    - client/src/components/CosmicHub/CosmicHubModal.tsx

key-decisions:
  - "Cancel confirm as inline panel inside QuestCard (not standalone modal). Trade-off: simpler overlay stack (no z-index 200 layer needed) + no createPortal cost. Visual anchoring keeps the confirm contextually tied to the card. Phase 28-05 reward popup will be the only quest UI piece that justifies a separate modal layer."
  - "showConfirm useState is local to each QuestCard instance — no slice action needed для UI ephemeral state. Component unmounts когда quest leaves activeQuests (after store.cancelQuest), so no setShowConfirm(false) cleanup."
  - "Cancel «Да» button uses red #ef4444 (destructive), NOT PINK_CTA_STYLE pink gradient. Pink reserved для primary CTAs per Phase 25 design language. The dismiss button («×») uses transparent + border-only — clearly secondary."
  - "Progress bar uses linear-gradient pink (#f9a8d4 → #db2777) mirroring PINK_CTA_STYLE — visual consistency with primary CTA gradient. width transition: 400ms ease-out — same easing as RelationshipBar but slightly longer (RelationshipBar uses 300ms) to give progress a more deliberate feel."
  - "CompletedQuestsList default collapsed — assumes the player visits Quests tab primarily for ACTIVE work, not history browsing. Tap to expand. Lazy mount of body content (React conditional rendering NOT CSS hide) — avoids reconciling 20 entries when not visible."
  - "QuestCard handles orphan questId defensively (returns null если QUESTS[id] undefined) — symmetric with engine devWarn-and-skip pattern from Plan 28-03. UI silently elides the row keeping the list visually tidy."
  - "CompletedQuestsList shows raw questId as fallback label when QUESTS[id] undefined (vs QuestCard which returns null) — historical entry deserves SOMETHING visible since the reward has already been claimed; orphan active quest is mid-flight and showing nothing is cleaner."
  - "i18n key reuse: empty_state for both 'no active quests' (QuestsTab) and 'no completed quests' (CompletedQuestsList). The current ru.json copy ('Нет активных квестов. Откройте Контакты, чтобы принять.') reads correctly only in the active-empty case. The completed-empty path is a degenerate edge case (player сначала completes а quest TO have a history) — accepted as minor wording drift; future polish could add a dedicated key if needed."
  - "Mount effect reconcileQuestProgress() — calls engine на every QuestsTab mount. Engine is idempotent (Plan 28-03 fast-path no-op when activeQuests.length===0; per-quest polling is O(1) per polled-target kind). HMR + tab toggle safe."
  - "Tab strip fit check deferred to Plan 28-06 SMOKE scenario. Plan 28-04 ships 8 tabs in TABS array (unchanged from Plan 28-01); horizontal fit on 320px viewport requires visual measurement which is a smoke-test concern. Fallback options enumerated below."

patterns-established:
  - "Inline confirm panel via useState — alternative to portal-based confirm modal. Choice rule: inline when confirm is binary, contextually anchored, and action is non-blocking; modal when confirm needs to mask the page (e.g., destructive multi-step or financial confirm)."
  - "MAX_VISIBLE UI-layer cap separate from defensive-load cap — render budget vs persistence budget are decoupled. Pattern applicable wherever defensive-load cap > comfortable render budget."

requirements-completed:
  - PHASE28-QUESTS-TAB-UI
  - PHASE28-QUEST-CARD
  - PHASE28-MANUAL-CANCEL-PENALTY
  - PHASE28-CLICLABILITY

# Metrics
duration: ~8min
completed: 2026-05-19
---

# Phase 28 Plan 28-04: Quests Tab UI Summary

**8-я «Квесты» tab swap from Plan 28-01 placeholder div to real `<QuestsTab />` — header + cap notification + empty state + per-quest cards (race + type + description + CSS-transition progress bar + reward preview + cancel-with-inline-confirm) + collapsible completed history capped at 20 visible. 3 new files + 1 modified, all cliclability-compliant, no Lottie.**

## Performance

- **Duration:** ~8 min (commit `4e7ec5a` → commit `f894cdb`)
- **Started:** 2026-05-19T00:48:00Z (estimated)
- **Completed:** 2026-05-19T00:56:24Z
- **Tasks:** 3
- **Files created:** 3 (`QuestsTab.tsx`, `quests/QuestCard.tsx`, `quests/CompletedQuestsList.tsx`)
- **Files modified:** 1 (`CosmicHubModal.tsx`)
- **Lines added:** 502 LOC across 3 new files + ~10 LOC modified в CosmicHubModal (import + case)

## Accomplishments

- **8th «Квесты» tab now real** — `renderTab` case `'quests'` returns `<QuestsTab />` instead of the Plan 28-01 inline placeholder div. Players opening the Quests tab now see the live activeQuests list (or empty state with hint to Contacts tab).
- **QuestCard surface complete** — every active quest renders race emoji + race name + quest type icon (📦/🔍/⚡/🤝) + short label + full description + progress bar (filled portion based on `progress / targetValue`) + reward preview (✨/💉/🪙/🤝 + formatted value) + «Отказаться» button.
- **Cancel flow with inline confirm** — Tap «Отказаться» reveals confirm panel (race-name interpolated via i18n cancel_confirm string) with red destructive «Да» + transparent dismiss «×». Tap «Да» dispatches `store.cancelQuest(quest.id)` (engine applies -1 relationship + emits eventBus events from Plan 28-03).
- **CompletedQuestsList collapsible** — default closed (assumes ACTIVE work is primary). Tap header toggles expand; sorted desc by `completedAt`; rendered cap MAX_VISIBLE=20 with «... +N» tail when history exceeds.
- **Cliclability** — All interactive surfaces (4 buttons total: QuestCard open-confirm + accept-cancel + dismiss-confirm + CompletedQuestsList header toggle) carry `type="button"` + `touchAction:'manipulation'` + `stopPropagation` per memory feedback_clickability. QuestCard root also stops propagation.
- **No Lottie** — progress bar uses CSS `transition: width 400ms ease-out` per memory feedback_animations; CompletedQuestsList collapse is binary React conditional rendering.
- **Mount-effect reconcile** — QuestsTab calls `reconcileQuestProgress()` on mount mirroring Phase 27 ContactsTab `triggerPendingPull` pattern; engine idempotent so re-entry is safe.
- **tsc + eslint + vitest + check-translations all green** — 198 PASS / 1 skipped / 0 failed (same baseline as Plan 28-03), 633 i18n keys per locale, no missing.

## Task Commits

Each task was committed atomically:

1. **Task 1: QuestCard component + cancel confirm dialog** — `4e7ec5a` (feat)
2. **Task 2: CompletedQuestsList component (collapsible)** — `e26d5f3` (feat)
3. **Task 3: QuestsTab assembly + wire to CosmicHubModal (replace placeholder)** — `f894cdb` (feat)

## Files Created/Modified

### Created

- `client/src/components/CosmicHub/quests/QuestCard.tsx` — 270 LOC. Per-active-quest card. Imports `useGameStore` for `cancelQuest` action + `QUESTS`/`RACES_BY_ID` lookups. Inline helpers: `extractTargetValue`, `formatGoldShort`, `rewardSummary`. Constants: `QUEST_TYPE_ICON`, `REWARD_ICON`. JSX layout: top row (emoji + name + type) → short label → description → progress bar (track + gradient fill with CSS transition) → reward preview → cancel button OR inline confirm panel. 4 onClick handlers (root stop + open-confirm + accept-cancel + dismiss-confirm). Defensive: orphan quest returns null.
- `client/src/components/CosmicHub/quests/CompletedQuestsList.tsx` — 161 LOC. Collapsible history. Imports `useGameStore` for `completedQuests`. Inline `formatGoldShort` + `rewardSummary` (duplicated from QuestCard — promotion deferred). MAX_VISIBLE=20 cap on rendered slice. Section header button toggles `expanded` useState. Body rendered only when `expanded === true` (binary React mount/unmount). Per-entry row: race emoji + race name (short_key or raw questId fallback) + reward summary. Tail «... +N» when sorted.length > 20.
- `client/src/components/CosmicHub/QuestsTab.tsx` — 71 LOC. 8th-tab content assembly. Imports `ACTIVE_QUEST_CAP` + `QuestCard` + `CompletedQuestsList` + `_styles` tokens. Granular Zustand selectors (`activeQuests`, `reconcileQuestProgress`). Mount-effect calls `reconcileQuestProgress()` once. Layout: header (`header_active` i18n with current/cap interpolation) + cap_reached notification (when atCap) + empty state (when length===0) OR QuestCard list + CompletedQuestsList.

### Modified

- `client/src/components/CosmicHub/CosmicHubModal.tsx` — 2 edits:
  1. Added `import { QuestsTab } from './QuestsTab'` after ContactsTab import.
  2. `renderTab` case `'quests'`: removed inline placeholder div (`<div>{t('cosmic_hub.quests.placeholder')}</div>`), replaced with `return <QuestsTab />`. Plan 28-01 i18n key `cosmic_hub.quests.placeholder` remains in JSON для backward compat / future fallback — no longer rendered.

## Decisions Made

- **Inline confirm panel inside QuestCard, NOT standalone modal.** Pros: simpler overlay stack (no new z-index layer above Cosmic Hub modal 100); no `createPortal` cost; confirm is contextually anchored to the card the player tapped. Cons: vertical layout shift on confirm reveal (acceptable since card content above stays stable; only padding extends). Plan 28-05 reward popup will be the only quest UI piece that warrants a separate modal layer (z-index 150).
- **showConfirm useState local to each QuestCard.** No slice action for UI ephemeral state. Component unmounts when quest leaves activeQuests after `cancelQuest`, so the useState memory dies with the unmount — no explicit `setShowConfirm(false)` cleanup needed.
- **Destructive «Да» button uses red #ef4444, not PINK_CTA gradient.** Pink reserved для primary affirmative CTAs per Phase 25 design language. Red signals destructive action visually. Dismiss «×» button uses transparent + border-only — clearly secondary.
- **Progress bar gradient mirrors PINK_CTA gradient** (`#f9a8d4 → #db2777` linear-gradient 180deg). Visual consistency with primary CTA pink. `transition: width 400ms ease-out` — slightly longer than RelationshipBar's 300ms (gives progress a more deliberate feel; progress is the central visual on the card).
- **CompletedQuestsList default collapsed.** Assumes the player visits Quests tab primarily for active work, not history browsing. Lazy mount of body via React conditional (NOT CSS hide) — avoids reconciling 20 entries when collapsed.
- **QuestCard returns null on orphan questId.** Symmetric with engine devWarn-and-skip pattern from Plan 28-03. UI silently elides the row keeping the list tidy. (CompletedQuestsList renders raw questId as fallback — historical entry already has a claimed reward so it deserves a visible row; orphan active quest is mid-flight and showing nothing is cleaner.)
- **i18n key reuse: `empty_state` for both 'no active quests' (QuestsTab) and 'no completed quests' (CompletedQuestsList).** Documented limitation: ru.json copy «Нет активных квестов. Откройте Контакты, чтобы принять.» reads correctly only in the active-empty case. The completed-empty path is a degenerate edge case (player must complete a quest TO have a history) — accepted as minor wording drift. Future polish could add a dedicated `completed_empty_state` key (3-locale parity).
- **MAX_VISIBLE=20 separate from COMPLETED_QUEST_HISTORY_CAP=100.** Plan 28-01 caps the persisted history; Plan 28-04 UI further caps the rendered slice. Decoupled: render budget vs persistence budget. «... +N» tail signals to the player that more history exists беz forcing the UI to mount it.
- **Mount-effect `reconcileQuestProgress()`.** Idempotent engine call ensures polling-only progress (gold_amount / raise_relationship / merge_to_level via discoveredLevels) is fresh on every tab visit. Phase 27 ContactsTab `triggerPendingPull` pattern.
- **Tab strip fit-check deferred to Plan 28-06.** Plan 28-04 doesn't touch the tab strip (8 tabs already in TABS array from Plan 28-01). 320px viewport fitting is a visual measurement concern → Plan 28-06 SMOKE scenario. Fallback options enumerated in plan: reduce per-tab padding from `12px 4px` to `12px 2px`; drop label text on viewports < 480px via @media query (icon-only); switch tab strip to horizontal scroll with snap-points.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Style] Prettier formatting on CompletedQuestsList imports + JSX**

- **Found during:** Task 2 eslint gate
- **Issue:** Multi-line `import { SECTION_HEADER_STYLE, TEXT_DIM, TEXT_VERY_DIM, GOLD } from '../_styles'` reflowed to single line by prettier print-width rule. Span content `{expanded ? '▼' : '▶'}{' '}{t(...)}` reflowed to inline structure.
- **Fix:** `./node_modules/.bin/eslint --fix src/components/CosmicHub/quests/CompletedQuestsList.tsx` collapsed import + reformatted JSX whitespace. No semantic changes.
- **Files modified:** `client/src/components/CosmicHub/quests/CompletedQuestsList.tsx`
- **Commit:** included in Task 2 (`e26d5f3`)

**2. [Rule 1 — Strictness] CosmicHubModal placeholder string in comment**

- **Found during:** Task 3 acceptance grep self-check
- **Issue:** First-attempt comment in `renderTab case 'quests'` quoted the literal string `'cosmic_hub.quests.placeholder'` while explaining the swap. The acceptance criterion is strict: `grep -c "cosmic_hub.quests.placeholder" CosmicHubModal.tsx` must return 0.
- **Fix:** Rewrote comment to mention "Plan 28-01 inline stub" + "foundation i18n key" without quoting the literal path.
- **Files modified:** `client/src/components/CosmicHub/CosmicHubModal.tsx`
- **Commit:** Task 3 (`f894cdb`) — caught before commit.

No Rule 4 architectural decisions were needed. No auth gates. No skipped fixes.

## Authentication Gates

None — pure UI plan, no external service access.

## Issues Encountered

None blocking. Both deviations above were auto-fixable on first pass.

## Known Stubs

None introduced by Plan 28-04. The 3 new components are production-ready.

The Plan 28-01 i18n key `cosmic_hub.quests.placeholder` remains in `i18n/ru.json` / `en.json` / `es.json` (1 leaf × 3 locales) as a backward-compat fallback; no longer rendered after this plan, but kept in JSON to avoid a check-translations parity churn.

Pre-existing Phase 28 stubs from earlier plans remain — `bonus_id` placeholder tokens in 6 `relationship_and_bonus` rewards (resolved in Plan 28-05) — these do NOT block Plan 28-04's goal (Quests tab UI renders fine because `rewardSummary` для `relationship_and_bonus` shows race name only and ignores `bonus_id`).

## Validation Results

**Build chain (run after all 3 tasks landed):**

| Gate | Command | Result |
|------|---------|--------|
| tsc | `cd client && ./node_modules/.bin/tsc --noEmit` | PASS (0 errors) |
| eslint | `./node_modules/.bin/eslint <4 touched files>` | PASS (no output after Task 2 --fix) |
| check-translations | `node scripts/check-translations.cjs` | PASS — 633 keys per locale, 0 missing / 0 extra |
| vitest (full suite) | `./node_modules/.bin/vitest run` | PASS — 22 files, 198 tests, 1 skipped, 0 failed (baseline preserved from Plan 28-03) |
| Git tree | `git status --short` | clean (no untracked / no unexpected deletions) |

**Acceptance grep criteria (per-task):**

Task 1 — QuestCard (9 criteria): all ≥ expected.
- `export function QuestCard` = 1
- `type="button"` = 3 (== 3 buttons)
- `touchAction: 'manipulation'` = 3
- `stopPropagation` = 4 (≥ 3) [card root + 3 button handlers]
- `cancelQuest` = 2 occurrences (selector + invocation)
- `transition:` = 1 (progress bar)
- `QUEST_TYPE_ICON` = 2 (define + use)
- `REWARD_ICON` = 5 (define + 4 switch cases)
- tsc + eslint clean

Task 2 — CompletedQuestsList (8 criteria): all ≥ expected (after --fix).
- `export function CompletedQuestsList` = 1
- `completedQuests` = 6 (selector + 4 references in body + sort callback)
- `type="button"` = 1 (header toggle)
- `touchAction: 'manipulation'` = 1
- `stopPropagation` = 1
- `MAX_VISIBLE` = 4 (define + comment + 2 uses)
- tsc + eslint clean

Task 3 — QuestsTab + CosmicHubModal (13 criteria): all ≥ expected.
- `export function QuestsTab` = 1
- `reconcileQuestProgress` = 5 (comment + 2× selector decl + useEffect call + dep array)
- `ACTIVE_QUEST_CAP` = 5 (import + comparison + 2× interpolation + cap_reached arg)
- `QuestCard` = 5 (comment + import + JSX usage + key)
- `CompletedQuestsList` = 5 (comment + import + JSX usage)
- `header_active` / `empty_state` / `cap_reached` total = 5 (≥ 3, see header_active=2, empty_state=1, cap_reached=2)
- `<QuestsTab` in CosmicHubModal = 1
- `import { QuestsTab }` in CosmicHubModal = 1
- `cosmic_hub.quests.placeholder` in CosmicHubModal = 0 (removed)
- tsc + eslint + vitest + check-translations clean

## Self-Check

Verifying claimed outputs exist on disk:

- FOUND: `client/src/components/CosmicHub/QuestsTab.tsx`
- FOUND: `client/src/components/CosmicHub/quests/QuestCard.tsx`
- FOUND: `client/src/components/CosmicHub/quests/CompletedQuestsList.tsx`
- FOUND (modified): `client/src/components/CosmicHub/CosmicHubModal.tsx`
- FOUND in git log: commit `4e7ec5a` (Task 1)
- FOUND in git log: commit `e26d5f3` (Task 2)
- FOUND in git log: commit `f894cdb` (Task 3)

## Self-Check: PASSED

## Next Plan Readiness

**Plan 28-05 (reward popup) — ready.**
- `'quests:completed'` eventBus event from Plan 28-03 already carries the full `reward: QuestReward` payload — popup can mount on subscribe + read `reward.kind` for icon/value display without re-reading state.
- `CompletedQuest.rewardClaimed` stored on history can drive an alternate popup path if a subscribe-race occurs.
- `REWARD_ICON` constant duplicated в QuestCard + CompletedQuestsList — when Plan 28-05 introduces a 3rd consumer, extract to shared `client/src/components/CosmicHub/quests/_rewardIcons.ts` (or similar).
- `formatGoldShort` + `rewardSummary` helpers duplicated в two files — same promotion candidate.
- Bonus catalogue lookup (mapping `bonus_id` opaque token → in-game effect) still deferred to Plan 28-05 or a later balancing plan.

**Plan 28-06 (smoke test) — partially unblocked.**
- All UI surfaces now real (active list + completed history + cancel flow). DEV helpers from Plan 28-03 (`__activateQuest` / `__progressQuest` / `__completeQuest` / `__resetQuests` / `__dumpQuests`) can be combined with QuestsTab visibility to script full activation→progress→completion→cancel flows.
- **Tab strip fit check on 320px viewport** explicitly deferred — Plan 28-06 must measure rendered widths of 8 tabs × per-tab padding `12px 4px` and choose fallback option if overflow is observed (per Plan 28-04 enumerated options: reduce padding / icon-only labels via @media / horizontal scroll-strip).
- **Cancel flow smoke** — Plan 28-06 should verify: activate quest → tap «Отказаться» → confirm panel appears с race name interpolated → tap «Да» → relationship -1 в Contacts tab AND quest disappears AND `quests:cancelled` event fires (DEV bus tracer if available).
- **Reward popup integration** — Plan 28-06 awaits Plan 28-05 to land for end-to-end smoke (activate → progress to completion → popup appears → claim → completedQuests history shows entry).

**Tab strip fit-check fallback options (decision deferred to Plan 28-06):**
1. Reduce per-tab `padding: '12px 4px'` → `padding: '12px 2px'` (≈ 25% horizontal compression).
2. Drop label text on viewports < 480px via CSS @media query → icon-only mode (label aria-hidden).
3. Switch tab strip to horizontal scroll with snap-points (`overflow-x: auto; scroll-snap-type: x mandatory`).

No blockers identified. UI layer is consistent across tab strip + tab content + Phase 25 design language.

---
*Phase: 28-quests*
*Completed: 2026-05-19*
