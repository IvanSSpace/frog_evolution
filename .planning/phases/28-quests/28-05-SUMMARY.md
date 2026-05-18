---
phase: 28-quests
plan: 05
subsystem: reward-popup
tags: [quests, react, eventBus, modal, css-keyframes, cliclability, i18n]

# Dependency graph
requires:
  - phase: 28-quests
    plan: 01
    provides: QuestReward discriminated union + reward_popup_title/reward_popup_dismiss i18n keys в RU/EN/ES parity
  - phase: 28-quests
    plan: 03
    provides: 'quests:completed' eventBus event с full QuestReward payload (emitted by markQuestProgress в cosmic/slice.ts)
  - phase: 26-cosmos-races-foundation
    plan: 05
    provides: createPortal + backdrop + Escape modal pattern (FirstContactModal); z-index 200 peer slot
  - phase: 27-contacts-messages-relationships
    plan: 05
    provides: useState queue + useEffect handler controller pattern (EventToastController); CSS keyframe slide-in technique
provides:
  - QuestRewardPopup React.FC — stateless presentational modal (race emoji + title + quest short + reward summary + CTA)
  - QuestRewardController React.FC — App-level eventBus subscriber + queue manager
  - quest-reward-slide-in CSS @keyframe (250ms ease-out)
  - QUEUE_CAP=10 + dedup-by-activeQuestId enqueue semantics
  - DEV-warn instrumentation на queue overflow
affects: [28-06-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stateless presentational popup + stateful controller split — popup receives all data via props (no store reads, no eventBus subscriptions), controller owns queue lifecycle + eventBus wiring; allows popup unit-testability in isolation (Plan 28-06 candidate)"
    - "Sequential queue display via array head + React key — controller renders queue[0] keyed на activeQuestId; onDismiss pops head; next mount natural через key change (no manual transition machine)"
    - "Inline CSS @keyframe в JSX <style> tag — каждый mount теоретически re-mounts the rule, но CSSOM dedupes by selector name; cheap, isolated к component file (mirror Phase 27-05 EventToastController + Phase 26-05 FirstContactModal precedent)"
    - "z-index 199/200 peer pair (backdrop/content) одинаковый для всех app-level modals — guarantees consistent overlay stacking без shifting tokens"
    - "Defensive fallback rendering — unknown questId → questId как label (mirror Plan 28-03 engine policy of data-drift tolerance: tolerate stale completion event for removed quest config, не crash)"
    - "Cliclability contract enforced inline в каждом modal: type='button' + touchAction:'manipulation' + stopPropagation на content/CTA; backdrop intentionally без stopPropagation (tap-to-dismiss)"

key-files:
  created:
    - client/src/components/Quests/QuestRewardPopup.tsx
    - client/src/components/Quests/questRewardController.tsx
  modified:
    - client/src/App.tsx

key-decisions:
  - "Reward summary helper duplicated inline в QuestRewardPopup (NOT extracted к shared utils) — YAGNI: только 2 planned consumers (this popup + Plan 28-04 QuestCard); extract когда 3rd consumer appears"
  - "QUEUE_CAP=10 (vs. cap 5 для ACTIVE_QUEST_CAP) — safety net для DEV __completeQuest spam OR pathological event burst; в production 5-quest cap × completion frequency means это никогда не триггерится"
  - "Dedup по activeQuestId на enqueue — handles StrictMode double-mount и DEV reissue; popup показывается ровно один раз per quest completion event"
  - "DEV-only console.warn на queue overflow — surfaces pathological burst в development без production noise (tree-shaken via import.meta.env.DEV guard, same pattern as Plan 28-03 devQuests.ts)"
  - "z-index 199/200 chosen (NOT 150 как первичный context plan suggested) — peer level с FirstContactModal (200) per CONTEXT.md cliclability hierarchy; reward popup может overlap с FirstContact (rare edge case) и оба должны render correctly"
  - "createPortal к document.body — гарантирует escape Phaser canvas стэка + любых intermediate transform contexts (FirstContactModal precedent, Plan 26-05)"
  - "React.FC controller vs imperative installer — mirror Phase 27-05 EventToastController (test-friendly + HMR-safe); Phase 26-05 firstContactController + Phase 24-04 captainBirthController использовали разные pattern'ы (React.FC и imperative соответственно). Choice rule: React.FC когда queue/state matters, imperative когда production-critical singleton с idempotency guard"

patterns-established:
  - "Reward popup pattern (stateless modal + queue controller subscribing to single eventBus event) — reusable для future одноразовых notification flows (e.g. Phase 29+ daily quest reward, achievement unlocked, bonus claimed)"

requirements-completed:
  - PHASE28-REWARD-POPUP
  - PHASE28-CLICLABILITY

# Metrics
duration: ~8min
completed: 2026-05-19
---

# Phase 28 Plan 28-05: QuestRewardPopup + Controller + App Wiring Summary

**Quest completion reward popup — DOM modal (createPortal к document.body) с race emoji + quest short + reward summary + CTA «Забрать», CSS @keyframe slide-in 250ms, auto-dismiss 5s + Escape + backdrop + CTA, dedup-by-activeQuestId queue manager subscribing to 'quests:completed' eventBus event, mounted в App.tsx alongside FirstContactController + EventToastController + QuestController.**

## Performance

- **Duration:** ~8 min (commit `d11e81d` → commit `5204c3e`)
- **Started:** 2026-05-19T00:47Z
- **Completed:** 2026-05-19T00:55Z
- **Tasks:** 2 (split into 3 commits — Task 1 atomic, Task 2 atomic + 1 refactor refining DEV-warn observability)
- **Files created:** 2 (`QuestRewardPopup.tsx`, `questRewardController.tsx`)
- **Files modified:** 1 (`App.tsx`)
- **Lines added:** ~313 (224 popup + 88 controller + 1 import + 7 mount-comment)

## Accomplishments

- QuestRewardPopup renders modal overlay в createPortal к document.body с z-index 199 backdrop / 200 content peer level с FirstContactModal — consistent stacking across all app-level modals
- Reward summary inline formatter covers all 4 QuestReward discriminated union variants (essence/serum/gold/relationship_and_bonus) с element-aware serum display (random → ?) и race-name lookup для diplomacy bonus
- CSS @keyframe quest-reward-slide-in (250ms ease-out scale 0.85→1 + fade) — no Lottie per memory feedback_animations; CSSOM cache prevents re-render cost
- All 4 dismiss paths wired: auto-dismiss 5s setTimeout, Escape key window listener, backdrop click (intentionally без stopPropagation), CTA «Забрать» button with stopPropagation
- Cliclability contract: type=button + touchAction:'manipulation' + stopPropagation на content card и CTA per memory feedback_clickability
- QuestRewardController subscribes к eventBus 'quests:completed' (emitted by Plan 28-03 markQuestProgress) — queue'ит entries с dedup-by-activeQuestId защитой против StrictMode double-mount и DEV reissue; renders head as keyed component (React natural transition)
- Defensive QUEUE_CAP=10 safety net + DEV-only console.warn на overflow — surfaces pathological event burst в development без production noise
- App.tsx mount alongside FirstContactController + EventToastController + QuestController — all peer-level controllers null-render when idle, zero overhead at rest
- Defensive fallback rendering — unknown questId (orphan completion event for removed quest config) → questId как label (mirror Plan 28-03 engine policy)
- aria-modal + aria-labelledby для a11y compatibility с screen readers

## Task Commits

Each task committed atomically:

1. **Task 1: QuestRewardPopup presentational modal** — `d11e81d` (feat)
2. **Task 2: QuestRewardController + App.tsx wiring** — `b79e621` (feat)
3. **Task 2 refinement: DEV-warn on queue cap overflow** — `5204c3e` (refactor)

The refactor commit nudged controller past `must_haves.artifacts.min_lines: 80` spec guidance while adding meaningful DEV observability (Rule 2 — auto-add missing critical functionality: queue overflow без instrumentation would be silent failure mode).

## Files Created/Modified

### Created

- `client/src/components/Quests/QuestRewardPopup.tsx` — 224 lines. Public API: `QuestRewardPopup({questId, raceId, reward, onDismiss})`. createPortal к document.body. Inline `<style>` с quest-reward-slide-in keyframe. Backdrop (z-index 199, fixed inset 0, rgba(0,0,0,0.55), onClick=onDismiss). Content card (z-index 200, top 38%, dark `#1a2e1a` background, 2px white-18% border, animation: 250ms ease-out). Render order: race emoji (56px) → GOLD title `cosmic_hub.quests.reward_popup_title` → quest short label (TEXT_DIM 13px) → DARK_CARD_STYLE reward summary (18px bold) → PINK_CTA_STYLE button `cosmic_hub.quests.reward_popup_dismiss`. Effects: AUTO_DISMISS_MS=5000 setTimeout cleanup-on-unmount; window.addEventListener('keydown') Escape handler cleanup-on-unmount. Helpers: REWARD_ICON record, formatGoldShort (K/M/B compaction), rewardSummary (4-case switch).

- `client/src/components/Quests/questRewardController.tsx` — 88 lines. Public API: `QuestRewardController()` React.FC. Internal: `PopupEntry` interface (key/questId/raceId/reward), `QUEUE_CAP = 10`. State: `useState<PopupEntry[]>([])`. useEffect subscribes to `eventBus.on('quests:completed', onCompleted)` + cleanup `eventBus.off`. Enqueue logic: cap-check → DEV-warn + drop, dedup by activeQuestId, append. Render: null when queue empty; QuestRewardPopup для head с onDismiss `setQueue(q => q.slice(1))`.

### Modified

- `client/src/App.tsx` — +7 lines. Import `QuestRewardController` alongside Plan 28-03 `QuestController`. Mount `<QuestRewardController />` сразу после `<QuestController />` (peer level с FirstContactController + EventToastController). Both controllers null-render when idle — no visual overhead.

## Decisions Made

- **Reward summary helper inline (not extracted).** YAGNI: только 2 planned consumers (this popup + Plan 28-04 QuestCard). Plan 28-04 may extract a shared util если третий consumer (e.g. Plan 28-06 smoke-test mock) появится. Trade-off: 25-line duplication между QuestRewardPopup и future QuestCard, but extract pattern preserved (single switch on reward.kind с 4 cases).

- **QUEUE_CAP=10 (вдвое больше ACTIVE_QUEST_CAP=5).** Defensive safety net против DEV `__completeQuest` spam OR rapid event burst в edge cases (e.g. boot-time reconcile completes multiple quest'ов одновременно из cross-device sync state). В production 5-quest cap × completion frequency делает эту проверку никогда-не-true. Trade-off: extra branch в hot path (negligible — React state setter).

- **Dedup по activeQuestId на enqueue.** Защищает от StrictMode double-mount (React 19 dev mode эмулирует двойной effect run) и от DEV reissue scenarios. Без dedup user видел бы один и тот же popup дважды подряд. Acceptable trade-off: O(n) scan на enqueue (n ≤ 10) добавляется к каждому event handler, but n is small + event frequency low.

- **DEV-only console.warn на queue overflow (Rule 2 deviation).** Silent overflow drop without instrumentation = unobservable failure mode. Added `import.meta.env.DEV` guarded console.warn (tree-shaken from production same pattern as devQuests.ts). Surfaces pathological event burst в development без production noise. Justification: queue cap overflow означает либо bug в engine, либо edge-case sync burst — оба требуют developer awareness.

- **z-index 199 backdrop / 200 content (peer level с FirstContactModal).** Plan's `<interfaces>` block specified этот пары explicitly. Per memory feedback_clickability: keeping Cosmic Hub modal (50-100) below, EventToast stack (150) middle, FirstContactModal + QuestRewardPopup (200) top tier — predictable stacking без surprise overlays. Edge case: FirstContactModal + QuestRewardPopup simultaneously active — render order по mount order, обе работают (CTA dismisses один popup, второй остаётся видимым).

- **createPortal к document.body (NOT inline mount).** Escapes Phaser canvas stack + любые intermediate transform contexts (e.g. CSS `transform: scale(...)` parent делает absolute children misalignment). Mirror Phase 26-05 FirstContactModal + Phase 27-05 EventToast.

- **React.FC controller (vs imperative installer like Captain birth).** Choice rule per Phase 27-05 decision: React.FC когда queue/state matters (test-friendly + HMR-safe via useEffect return), imperative когда production-critical singleton с explicit idempotency guard. Reward popup falls в первый bucket — queue lifecycle живёт в component state, нет производственно-критичной idempotency requirement.

- **Defensive unknown-questId fallback (popup all-equal renders).** Mirror Plan 28-03 engine policy of data-drift tolerance. Если quest config удалён между event emit и popup mount (extreme edge case: live HMR в DEV), popup всё равно отрисуется с questId raw string как label. Не crash. UX accepts that orphan event теряет полный label, но получает reward intact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Style/Build] Prettier formatting on QuestRewardPopup rewardSummary signature**

- **Found during:** Task 1 eslint gate
- **Issue:** Initial multi-line `function rewardSummary(\n  reward: QuestReward,\n  t: (k: string) => string,\n)` exceeded prettier rule prefers single-line within print-width.
- **Fix:** `./node_modules/.bin/eslint --fix` collapsed signature to single line.
- **Files modified:** `client/src/components/Quests/QuestRewardPopup.tsx`
- **Commit:** included в Task 1 (`d11e81d`)

**2. [Rule 2 — Critical Observability] DEV-warn on queue cap overflow**

- **Found during:** Post-Task-2 line-count verification — min_lines:80 spec target
- **Issue:** Silent queue overflow drop = unobservable failure mode. Engineering visibility into pathological event burst требует instrumentation.
- **Fix:** Added `import.meta.env.DEV` guarded `console.warn` в the cap-overflow branch. Tree-shaken from production via DEV guard (mirror Plan 28-03 devQuests.ts pattern).
- **Files modified:** `client/src/components/Quests/questRewardController.tsx`
- **Commit:** `5204c3e` (refactor)

### Out-of-scope Discoveries

None — все findings tied к THIS plan's scope (reward popup + controller + App wiring).

### Worktree Path Recovery

One operational note (NOT a code deviation): initial `Write` tool used main-repo absolute path вместо worktree path because Bash `cd` cache wasn't applying to Write tool. Caught immediately via post-write `git status` showing the file untracked в worktree's `client/src/components/Quests/` while actually creating the file in main repo's `client/src/components/Quests/`. Recovery: `mv` file к correct worktree path, `rmdir` empty main-repo dir, re-verified tsc/eslint. No code changes required — only path correction. Documented here чтобы readers видели full operational history.

## Authentication Gates

None — no external service auth needed.

## Issues Encountered

None blocking. Both deviations above were auto-fixable inline.

## Known Stubs

None introduced by Plan 28-05. The popup и controller are production-ready.

Pre-existing stubs from earlier plans remain unchanged:

| File | Stub | Resolving Plan |
|------|------|----------------|
| `client/src/components/CosmicHub/CosmicHubModal.tsx` | `case 'quests':` placeholder | 28-04 (Quests tab UI) |

Plan 28-05's goal — «mount reward popup when 'quests:completed' fires» — НЕ зависит от Plan 28-04 landing first. Реward popup и Quests tab UI orthogonal: popup mounts via createPortal независимо от tab navigation state. Smoke test (Plan 28-06) covers integrated path.

## Validation Results

**Build chain (run after all 3 commits landed):**

| Gate | Command | Result |
|------|---------|--------|
| tsc | `cd client && ./node_modules/.bin/tsc --noEmit` | PASS (0 errors) |
| eslint | `./node_modules/.bin/eslint <3 touched files>` | PASS (no output) |
| vitest (full suite) | `./node_modules/.bin/vitest run` | PASS — 22 files, 198 tests, 1 skipped, 0 failed |
| check-translations | `node scripts/check-translations.cjs` | PASS — 633 keys per locale, 0 missing / 0 extra |

**Acceptance grep criteria:**

Task 1 (12 criteria): all ≥ expected.
- `test -f`: yes
- `export function QuestRewardPopup` = 1
- `createPortal` = 3 (≥1)
- `AUTO_DISMISS_MS = 5000` = 1
- `Escape` = 3 (≥1)
- `zIndex: 199` = 1, `zIndex: 200` = 1
- `quest-reward-slide-in` = 2 (≥2)
- `type="button"` = 1 (≥1)
- `touchAction: 'manipulation'` = 2 explicit (≥2; CTA inherits via PINK_CTA_STYLE spread)
- `stopPropagation` = 6 (≥2 — content card + CTA)
- `reward_popup_title|reward_popup_dismiss` = 2

Task 2 (8 criteria): all ≥ expected.
- `test -f` ctl: yes
- `export function QuestRewardController` = 1
- `quests:completed` = 3 (≥2 — on + off)
- `QUEUE_CAP` = 3 (≥2)
- `QuestRewardPopup` (in ctl) = 2 (≥2 — import + render)
- `QuestRewardController` (in App.tsx) = 2 (≥2 — import + render)
- tsc/eslint/vitest gates green

## Self-Check

Verifying claimed outputs exist on disk:

- FOUND: `client/src/components/Quests/QuestRewardPopup.tsx`
- FOUND: `client/src/components/Quests/questRewardController.tsx`
- FOUND in App.tsx: `import { QuestRewardController } from './components/Quests/questRewardController'` (line 36) + `<QuestRewardController />` mount (line 404)
- FOUND in git log: commit `d11e81d` (Task 1)
- FOUND in git log: commit `b79e621` (Task 2)
- FOUND in git log: commit `5204c3e` (refactor)

## Self-Check: PASSED

## Next Plan Readiness

**Plan 28-06 (smoke test) — fully unblocked.**

- DEV helpers (`__activateQuest`, `__progressQuest`, `__completeQuest`, etc.) from Plan 28-03 still on window
- QuestRewardPopup mounts automatically на 'quests:completed' event — smoke test can `__completeQuest('some_quest_id')` and visually verify popup appears
- Multi-completion queue path: spam `__completeQuest('q1'); __completeQuest('q2')` → first popup mounts → CTA → second popup mounts → CTA — smoke test scriptable
- Defensive paths: orphan event (unknown questId) → fallback label; queue overflow → DEV-warn — both observable в console

No blockers. Phase 28 wave 3 (Plan 28-05) complete — Plan 28-04 (Quests tab UI) lands в parallel wave 3, и Plan 28-06 smoke test brings them together as Phase 28 final integration.

---
*Phase: 28-quests*
*Completed: 2026-05-19*
