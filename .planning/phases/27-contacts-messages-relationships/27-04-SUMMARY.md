---
phase: 27-contacts-messages-relationships
plan: 04
subsystem: ui-contacts-tab
tags: [react, zustand, i18next, cosmic-hub, cliclability, css-keyframe, eventbus-subscriber, design-tokens]

# Dependency graph
requires:
  - phase: 27-01
    provides: |
      getRelationshipTier, TIER_COLORS, TIER_I18N_KEYS, RELATIONSHIP_MAX,
      ChainItem discriminated union, PendingItem interface, RACE_CHAINS skeleton.
  - phase: 27-02
    provides: |
      RACE_CHAINS data filled — 10 races × 10 ChainItem; all text_keys resolve
      in RU/EN/ES via i18next.
  - phase: 27-03
    provides: |
      Slice actions resolveAccept(id) / resolveRefuse(id) / resolveAcknowledge(id),
      triggerPendingPull(), eventBus 'contacts:relationship-delta'.
  - phase: 26
    provides: |
      RACES_BY_ID lookup, RaceConfig (emoji + nameKey + lore keys + personality),
      firstContactsSeen flag for dimming pre-contact rows.
provides:
  - "ContactsTab — 7th Cosmic Hub tab; toggles between list view (10 race rows) and RaceDetailView via local selectedRaceId state"
  - "RaceDetailView — in-tab navigation screen: back arrow + race header + lore card + RelationshipBar + PendingInteraction (msg/dialog/quest_hook renderer)"
  - "RelationshipBar — 1-10 horizontal bar with tier color + tier label badge + numeric value; subscribes to 'contacts:relationship-delta' for own raceId and pulses on tier change via CSS @keyframes"
  - "CosmicTab union extended with 'contacts' literal — sessionStorage 'cosmic_last_tab' now accepts 'contacts'"
  - "CosmicHubModal: 7th tab entry (id='contacts', icon='📡', label tab_contacts) + renderTab switch case + getInitialTab acceptance"
  - "Cliclability checklist compliance: all 6 user-facing interactive buttons (row tap × 1 + back × 1 + acknowledge × 1 + refuse × 1 + support × 1 + tab × inherited) have type='button' + touchAction:'manipulation' + stopPropagation"
affects:
  - "Plan 27-05 (toast: EventToast already designed in Plan 27-03 eventBus payload — RelationshipBar pulse will not double-fire because event-applied path doesn't touch tier-change handler)"
  - "Plan 27-06 (smoke + finalize: full DEV smoke via __addPending then tab nav works end-to-end)"
  - "Phase 28 quest activation: PendingInteraction quest_stub line already shows expectation text; Phase 28 will replace static stub with quest tracker mount on accept"

# Tech tracking
tech-stack:
  added: []  # no new deps; reuses zustand/i18next/react/mitt
  patterns:
    - "Plan 27-04: in-tab navigation via local useState (selectedRaceId: RaceId | null) — list view ↔ detail view in single component, NOT modal stack; mirrors CONTEXT D-Race-detail screen"
    - "Granular Zustand selectors per Phase 26-04 pattern — avoid whole-store re-render. Pattern: useGameStore((s) => s.raceRelationships[raceId] ?? 1) per consumer"
    - "RelationshipBar dual-tier-detection: subscribe to eventBus 'contacts:relationship-delta' AND prop-value useEffect — covers both fast in-game tier crosses (event path) and non-event re-renders (e.g. initial mount with already-changed value)"
    - "CSS @keyframes contacts-tier-pulse — mount via inline <style>{...}</style> per component (cheap, ~32 chars); animation triggered conditionally by pulseActive useState (NO Lottie per memory feedback_animations)"
    - "Pending interaction renderer is item.type-discriminated: 'msg' or 'event' → single Acknowledge; 'dialog' → Refuse + Support; 'quest_hook' → Refuse + Support + gold italic stub hint. 'event' should not appear in pendingItems (engine auto-applies) but defensive UI path acknowledges if it does"
    - "ContactsTab mount effect: triggerPendingPull() on tab open — engine idempotent, safe re-pull; covers case where firstContactsSeen changed while tab inactive"
    - "CosmicHubModal extension pattern (mirror Phase 26-04 inventory): single import + getInitialTab literal + TABS push entry + renderTab switch case — 4-touch surgical extension"

key-files:
  created:
    - "client/src/components/CosmicHub/contacts/RelationshipBar.tsx (NEW, 138 LOC) — 1-10 bar + tier badge + pulse on tier-change via eventBus subscription"
    - "client/src/components/CosmicHub/contacts/RaceDetailView.tsx (NEW, 258 LOC) — back arrow + lore card + RelationshipBar + PendingInteraction (msg/dialog/quest_hook) + EmptyPending (empty_state / all_read)"
    - "client/src/components/CosmicHub/ContactsTab.tsx (NEW, 144 LOC) — list view of 10 race rows + selectedRaceId state toggle to RaceDetailView; mount-time triggerPendingPull()"
  modified:
    - "client/src/store/cosmic/types.ts — CosmicTab union extended with 'contacts' literal (+ updated comment Phase 27 Plan 27-04)"
    - "client/src/components/CosmicHub/CosmicHubModal.tsx — import ContactsTab; getInitialTab accepts 'contacts'; TABS array 7th entry (icon 📡, label tab_contacts, enabled=true); renderTab switch case 'contacts' returns <ContactsTab />"

key-decisions:
  - "selectedRaceId local useState (NOT URL state, NOT modal stack) — Cosmic Hub modal is single-route, in-tab navigation is the canonical UX. Matches CONTEXT D-Race-detail screen 'in-tab swap, not modal'. Trade-off: tab change loses detail position; intentional because user expects 'fresh' state on tab re-entry."
  - "RelationshipBar dual-detection (eventBus subscribe + prop-value useEffect) — the eventBus path is the primary trigger (engine emits relationship-delta after every accept/refuse/event auto-apply). The prop-value useEffect is the safety net: it catches tier changes when the component mounts with already-changed value (e.g. user resolves, navigates back to list, navigates back to detail — eventBus already fired) or when an external mutation bypasses the eventBus path."
  - "CSS @keyframes inline mount via <style>{...}</style> — keyframe definition is global once it hits CSSOM, but the inline placement in component JSX is the simplest way to keep keyframe + animation reference colocated. Total cost: ~80 chars overhead per render (React caches the style node)."
  - "PendingInteraction 'event' defensive Acknowledge — engine auto-applies events (never pushes to pendingItems), but if defensive load or future migration leaves a stale event in pendingItems, render it as msg with Acknowledge button. Plan 27-03 engine + slice both consume events at pull time; this is belt + suspenders."
  - "Row tap stopPropagation — Cosmic Hub modal has no backdrop close handler (the modal is full-screen with explicit × button), so stopPropagation here is defensive against any future modal wrapper that adds backdrop dismiss. Cliclability checklist mandates stopPropagation on inner card taps regardless."
  - "Pre-first-contact race row dimming (opacity 0.6 + '?' badge + '—' tier label) — provides discoverability ('these races exist') without leaking pre-contact lore. Player still cannot tap a contacted race (button is enabled, just dim) — the RaceDetailView itself shows empty_state because chainProgress=0 and engine won't pull pre-contact. Tap-through is allowed because it's safe and reveals the lore card."
  - "Inline 'event' handling shares the Acknowledge button code path with 'msg' — DRY; UI doesn't need to distinguish since both result in chainProgress++ with no delta change (engine handles delta at pull, slice resolveAcknowledge applies 0)."

patterns-established:
  - "Pattern: Cosmic Hub tab content with in-tab navigation — single component with local useState routing flag, child detail component takes onBack callback. Avoids modal stacking and React Router for a single Cosmic Hub modal session."
  - "Pattern: tier-change pulse animation — eventBus subscription filtered by own raceId + getRelationshipTier(old) !== getRelationshipTier(new) check + setTimeout-based pulseActive flag cleanup. Replicable for future relationship-driven UI surfaces (e.g. Phase 29 faction effects bar)."
  - "Pattern: granular Zustand selectors per raceId field — useGameStore((s) => s.field[raceId] ?? defaultValue). Each useGameStore call subscribes to its own selector; React only re-renders when that specific slice changes."

requirements-completed:
  - PHASE27-CONTACTS-TAB
  - PHASE27-CONTACTS-LIST
  - PHASE27-RACE-DETAIL
  - PHASE27-REPLY-UX
  - PHASE27-QUEST-HOOK-STUB
  - PHASE27-CLICLABILITY
  - PHASE27-COSMOS-GATE

# Metrics
duration: ~12m
completed: 2026-05-18
---

# Phase 27 Plan 04: Contacts tab UI (ContactsTab + RaceDetailView + RelationshipBar + 7th tab wiring) Summary

**Three new React components (ContactsTab + RaceDetailView + RelationshipBar) wired as the 7th Cosmic Hub tab «Контакты» (📡); in-tab navigation between race list and per-race detail; pending interaction renderer dispatches on item.type (msg → Acknowledge / dialog → Accept+Refuse / quest_hook → +stub hint / event → defensive Acknowledge); RelationshipBar pulses via CSS @keyframes on tier change; cliclability checklist 100% (all 5 interactive buttons type=button + touchAction:manipulation + stopPropagation); tsc + eslint + i18n parity clean; 3 atomic commits.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-18T19:00Z (approx)
- **Completed:** 2026-05-18T19:12Z (approx)
- **Tasks:** 3 (each committed atomically)
- **Files created:** 3 (ContactsTab + RaceDetailView + RelationshipBar)
- **Files modified:** 2 (types.ts CosmicTab union; CosmicHubModal.tsx 4-touch extension)
- **LOC added:** ~542 insertions

## Accomplishments

- **3 new components**, all following Phase 25 design tokens (DARK_CARD_STYLE / PINK_CTA_MINI_STYLE / SECTION_HEADER_STYLE / MINI_BADGE_STYLE / GOLD / TEXT_DIM / EMPTY_STATE_TEXT_STYLE) — no ad-hoc colors or spacing
- **7th tab «Контакты» 📡** registered: appears after Inventory in tab strip, gated at modal level (cosmos lock screen wraps tab strip per Phase 22-06 + 26-04 pattern)
- **In-tab navigation** (list view ↔ detail view) via single component local useState — no modal stack, no React Router
- **Pending interaction renderer** dispatches on item.type for all 4 ChainItem variants (msg/dialog/quest_hook/event)
- **RelationshipBar pulse animation** — CSS @keyframes contacts-tier-pulse (no Lottie per memory feedback_animations); fires only on tier-boundary cross (hostile↔cool↔neutral↔friendly↔ally), not every delta
- **Pre-first-contact race rows dimmed** (opacity 0.6 + '?' badge + '—' tier label) — discoverable but no lore leak
- **Full build chain green**: tsc 0 errors, eslint clean, i18n parity 522/522/522 (RU/EN/ES; baseline preserved), vitest 117 PASS (3 pre-existing Phase 22 suite-import failures unchanged from 27-03 baseline)

## Task Commits

Each task committed atomically:

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | RelationshipBar + CosmicTab 'contacts' literal | `296d18c` (feat) | `client/src/components/CosmicHub/contacts/RelationshipBar.tsx` (NEW), `client/src/store/cosmic/types.ts` |
| 2 | RaceDetailView (header + lore + RelationshipBar + pending renderer) | `bcc1561` (feat) | `client/src/components/CosmicHub/contacts/RaceDetailView.tsx` (NEW) |
| 3 | ContactsTab list view + wire 7th tab in CosmicHubModal | `bc407dc` (feat) | `client/src/components/CosmicHub/ContactsTab.tsx` (NEW), `client/src/components/CosmicHub/CosmicHubModal.tsx` |

## Component Tree Diagram

```
CosmicHubModal (Phase 11 / restyled Phase 25)
└── TABS[6] (Корабль, Боксы, Бестиарий, Карьеры, Магазин, Инвентарь)
└── TABS[7] = «Контакты» 📡  (NEW, Phase 27 Plan 04)
    └── renderTab case 'contacts' → ContactsTab
                                    │
                                    │ if selectedRaceId === null:
                                    │   list view (10 race rows)
                                    │
                                    │ else:
                                    └── RaceDetailView (raceId, onBack)
                                          │
                                          ├── Header (← back + emoji + nameKey)
                                          │
                                          ├── Lore card (homePlanetName + personality + lore_short)
                                          │
                                          ├── RelationshipBar (raceId, value)
                                          │     └── eventBus 'contacts:relationship-delta'
                                          │           └── pulseActive setState → CSS @keyframes
                                          │
                                          └── PendingInteraction OR EmptyPending
                                                │
                                                ├── msg / event → «Понятно» → resolveAcknowledge(pending.id)
                                                ├── dialog → «Отказать (-1)» + «Поддержать (+1)»
                                                │              ↓                ↓
                                                │       resolveRefuse        resolveAccept
                                                └── quest_hook → same as dialog + gold italic quest_stub hint
```

## Pending Item Type → Button Rendering Matrix

| ChainItem.type | Body text key | Buttons rendered | Stub line | Action wired |
|----------------|---------------|------------------|-----------|--------------|
| `msg` | `t(item.text_key)` | «Понятно» (PINK_CTA_MINI_STYLE) | — | resolveAcknowledge(pending.id) |
| `dialog` | `t(item.text_key)` | «Отказать (refuse_delta)» (neutral) + «Поддержать (accept_delta)» (PINK_CTA_MINI_STYLE) | — | resolveRefuse(pending.id) / resolveAccept(pending.id) |
| `quest_hook` | `t(item.text_key)` | same as dialog | `t('cosmic_hub.contacts.quest_stub')` shown gold italic between body and buttons | resolveRefuse / resolveAccept |
| `event` (defensive) | `t(item.text_key)` | «Понятно» (PINK_CTA_MINI_STYLE) | — | resolveAcknowledge(pending.id) |

**Empty state** (no `pendingItem` for this race):

- if `chainProgress[raceId] >= RACE_CHAINS[raceId].length`: `t('cosmic_hub.contacts.all_read')` («Все сообщения прочитаны»)
- else: `t('cosmic_hub.contacts.empty_state')` («Ожидание сообщения»)

## Cliclability Audit Table

Per memory feedback_clickability — every interactive button verified:

| Component | Element | type | touchAction | stopPropagation | Why |
|-----------|---------|------|-------------|-----------------|-----|
| ContactsTab | Race row button | `"button"` | `'manipulation'` | yes | Tap → setSelectedRaceId; must not bubble to backdrop |
| RaceDetailView | Back arrow ← | `"button"` | `'manipulation'` | yes | Tap → onBack(); must not bubble |
| RaceDetailView/PendingInteraction | «Понятно» (msg/event) | `"button"` | `'manipulation'` | yes | Tap → resolveAcknowledge; must not bubble |
| RaceDetailView/PendingInteraction | «Отказать» (dialog/quest_hook) | `"button"` | `'manipulation'` | yes | Tap → resolveRefuse; must not bubble |
| RaceDetailView/PendingInteraction | «Поддержать» (dialog/quest_hook) | `"button"` | `'manipulation'` | yes | Tap → resolveAccept; must not bubble |
| CosmicHubModal | 7th tab «Контакты» | `"button"` (inherited from Phase 25) | `'manipulation'` (inherited) | n/a (tab strip is not stop-prop critical) | Existing Phase 25 tab pattern |

Total: **6 interactive surfaces**, all cliclability-compliant.

## Files Created/Modified

| File | Status | LOC | Purpose |
|------|--------|-----|---------|
| `client/src/components/CosmicHub/contacts/RelationshipBar.tsx` | NEW | 138 | 1-10 bar + tier badge + tier-change pulse via eventBus |
| `client/src/components/CosmicHub/contacts/RaceDetailView.tsx` | NEW | 258 | Detail screen: back + lore + RelationshipBar + PendingInteraction |
| `client/src/components/CosmicHub/ContactsTab.tsx` | NEW | 144 | List view of 10 races + selectedRaceId toggle to RaceDetailView |
| `client/src/store/cosmic/types.ts` | MOD | +2 | CosmicTab union + 'contacts' literal + comment |
| `client/src/components/CosmicHub/CosmicHubModal.tsx` | MOD | +13 | import ContactsTab; getInitialTab accepts 'contacts'; TABS 7th entry; renderTab case |

## Decisions Made

(See `key-decisions:` frontmatter for full rationale; highlights below.)

- **selectedRaceId local useState** — in-tab navigation per CONTEXT D-Race-detail; intentional fresh-state on tab re-entry
- **RelationshipBar dual-detection** (eventBus + prop-value useEffect) — primary path is eventBus, prop-value useEffect is safety net for component re-mount with already-changed value
- **CSS @keyframes inline mount** — colocated with component, browser caches CSSOM; no Lottie (memory feedback_animations)
- **PendingInteraction 'event' defensive Acknowledge** — engine never pushes events to pendingItems; defensive UI path handles stale loads
- **Row tap stopPropagation** — defensive against future modal backdrop dismiss; cliclability checklist mandate
- **Pre-first-contact row dim** (opacity 0.6 + '?' + '—') — discoverable, no lore leak; tap-through allowed (safe, shows lore)
- **'event' shares Acknowledge code path with 'msg'** — DRY; both result in chainProgress++ with no delta change

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier autofix on RaceDetailView delta formatting strings**
- **Found during:** Task 2 eslint pre-commit check
- **Issue:** Two `t('...refuse')` / `t('...support')` + ` (${formatDelta(...)})` template lines violated prettier rule (long lines broken into expression + delta call on separate lines)
- **Fix:** `./node_modules/.bin/eslint --fix` applied prettier rewrites. No semantic change.
- **Files modified:** `client/src/components/CosmicHub/contacts/RaceDetailView.tsx`
- **Commit:** bundled into Task 2 commit `bcc1561` (consistent with execute-plan protocol — autofix on a file in the SAME plan being edited in the SAME session)

**Total deviations:** 1 auto-fixed (prettier formatting only). No behavioral or semantic deviations from plan.

## Issues Encountered

- **Worktree node_modules missing:** Initial verification (`tsc`, `eslint`) failed because the worktree's `client/` directory had no `node_modules`. Resolved by symlinking `client/node_modules → ../../../client/node_modules` (main worktree's pnpm install). Same workflow-level concern as Plan 27-03. No code change required.

## User Setup Required

None — no external service configuration, no env vars, no manual UI verification required by Plan 27-04 (UI ships and is interactively testable via DEV `__addPending` helper from Plan 27-03).

## Validation Results

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `cd client && ./node_modules/.bin/tsc --noEmit` | exit 0, 0 errors |
| ESLint | `cd client && ./node_modules/.bin/eslint src/components/CosmicHub/contacts/ src/components/CosmicHub/ContactsTab.tsx src/components/CosmicHub/CosmicHubModal.tsx src/store/cosmic/types.ts` | "No issues found" (after Task 2 prettier autofix — see Deviations) |
| i18n parity | `node scripts/check-translations.cjs` | 522/522/522 RU/EN/ES (baseline unchanged) |
| Vitest (full) | `./node_modules/.bin/vitest run` | 117 PASS / 1 skipped / 3 pre-existing Phase 22 suite-import failures unchanged from 27-03 baseline |
| Acceptance grep — Task 1 | `'contacts'` in types.ts ×1, RelationshipBar export ×1, contacts-tier-pulse ×2, eventBus.on/off ×1 each | PASS |
| Acceptance grep — Task 2 | RaceDetailView export ×1, resolveAccept/Refuse/Acknowledge ×6, `type="button"` ×5, `touchAction: 'manipulation'` ×5, stopPropagation ×5, quest_stub ×1 | PASS (all ≥ required) |
| Acceptance grep — Task 3 | ContactsTab export ×1, selectedRaceId ×3, RaceDetailView ×3, type=button ×1, touchAction ×1, stopPropagation ×1 in ContactsTab; ContactsTab ×2, case 'contacts' ×1, saved === 'contacts' ×1, tab_contacts ×1 in CosmicHubModal | PASS |

## Self-Check: PASSED

Files verified to exist:
- FOUND: `client/src/components/CosmicHub/contacts/RelationshipBar.tsx` (NEW, 138 LOC)
- FOUND: `client/src/components/CosmicHub/contacts/RaceDetailView.tsx` (NEW, 258 LOC)
- FOUND: `client/src/components/CosmicHub/ContactsTab.tsx` (NEW, 144 LOC)
- FOUND: `client/src/store/cosmic/types.ts` (modified)
- FOUND: `client/src/components/CosmicHub/CosmicHubModal.tsx` (modified)

Commits verified in `git log --oneline`:
- FOUND: `296d18c` feat(27-04): RelationshipBar component + CosmicTab union 'contacts' literal
- FOUND: `bcc1561` feat(27-04): RaceDetailView component (header + lore + RelationshipBar + pending renderer)
- FOUND: `bc407dc` feat(27-04): ContactsTab list view + wire 7th tab in CosmicHubModal

## Next Plan Readiness

**Ready for Plan 27-05 (toast):**
- `contacts:event-applied` eventBus event already wired by Plan 27-03 — EventToast subscribes here to mount top-screen banner.
- Plan 27-04 UI does NOT subscribe to `contacts:event-applied` (event ChainItems auto-apply in engine, never reach pendingItems — toast is the only surface).
- No conflict between Plan 27-04 pulse animation and Plan 27-05 toast — separate eventBus channels.

**Ready for Plan 27-06 (smoke + finalize):**
- Full DEV smoke path now works end-to-end: `__addPending('crystalloids')` → open Cosmic Hub → see 📡 tab → tap → see crystalloids row with pink unread dot → tap row → see RaceDetailView with msg pending → tap «Понятно» → resolveAcknowledge fires → next pending pulls.
- Cosmos gate inherited (modal-level lock screen wraps tab strip).
- Cliclability fully audited — no surprises for smoke test.

**Ready for Phase 28 quest activation:**
- `cosmic_hub.contacts.quest_stub` hint text already shown for `quest_hook` items — Phase 28 will replace this static stub line with quest tracker mount on accept.
- `pending.item.quest_id` field already passed through to `resolveAccept`; Phase 28 will read it from the chainItem before resolveAccept fires.

**No blockers.** All 7 REQ-IDs (CONTACTS-TAB / CONTACTS-LIST / RACE-DETAIL / REPLY-UX / QUEST-HOOK-STUB / CLICLABILITY / COSMOS-GATE) ready for marking.

---
*Phase: 27-contacts-messages-relationships*
*Completed: 2026-05-18*
