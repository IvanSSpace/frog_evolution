# Phase 27: Contacts + Messages + Relationships — Manual Smoke Test

**Phase:** 27-contacts-messages-relationships
**Date:** 2026-05-18+
**Tester:** _________

Run order: A → B → C → D → E → F. Каждое scenario независимо в смысле state setup (используйте dev helpers для reset между scenarios).

## Prerequisites

- [ ] `npm run dev` running, app loaded в browser
- [ ] DEV console available (`window.__listRaces`, `__addPending`, etc. present)
- [ ] Player state с cosmos unlocked (`useGameStore.getState().hasCosmosUnlocked === true`)
  - Если не unlocked: trigger через L18+L18 merge OR `useGameStore.setState({hasCosmosUnlocked: true})`
- [ ] Reset Phase 27 state: `__resetRelationships()` → relationships=2, chainProgress=0, pendingItems=[]

## Scenario A: Tab visibility + cosmos gate

**Goal:** «Контакты» 📡 tab appears after cosmos unlock; hidden before.

- [ ] Open Cosmic Hub (post-cosmos) → see 7 tabs: 🚀 / 🏭 / 📖 / 🐸 / 🛒 / 🎒 / 📡
- [ ] 7th tab label = «Контакты» (RU) / "Contacts" (EN) / "Contactos" (ES); switch locale via settings to verify
- [ ] Reset cosmos: `useGameStore.setState({hasCosmosUnlocked: false}); window.location.reload()`
- [ ] Open Cosmic Hub → see lock screen (Phase 22-06 pattern) — НЕТ tab strip visible
- [ ] Restore: `useGameStore.setState({hasCosmosUnlocked: true})`

## Scenario B: Contacts list view

**Goal:** List shows 10 races with relationship indicators.

- [ ] `__resetRelationships()` — start fresh
- [ ] Open Cosmic Hub → 📡 → see 10 race rows in canonical order (crystalloids first, cometfolk last)
- [ ] Each row shows: race emoji + name + tier label OR "—" + tier badge с value/10 OR "?"
- [ ] До first contact все races dimmed (opacity 0.6) + tier='—' + badge='?'
- [ ] Header: «Очередь: 0/3» (pending count)
- [ ] `__markFirstContact('crystalloids')` (Phase 26 helper) → reload OR `__resetRelationships()` again then `__addPending('crystalloids')` → crystalloids row gets pink unread dot + opacity 1 + tier badge color
- [ ] All other rows still dimmed

## Scenario C: Race detail navigation

**Goal:** Tap row → detail view; back arrow returns to list.

- [ ] Tap crystalloids row → tab content swaps to detail view (NOT modal)
- [ ] Detail view shows: ← back arrow + 💎 emoji + «Кристаллозиды» name in header
- [ ] Lore card visible: «Силикасос» home planet (gold), «Холодные, мудрые, медленные» personality (italic), lore_short paragraph
- [ ] RelationshipBar visible: tier badge «враждебный» (red — tier=hostile at value=2) + filled portion ~20% + numeric "2 / 10"
- [ ] Если pending exists: pending interaction card shown below bar
- [ ] Tap ← back arrow → returns to list view, scrolls/state preserved

## Scenario D: Reply UX (msg / dialog / quest_hook)

**Goal:** Each pending item type renders correct buttons + applies delta correctly.

**D1. msg (item.type === 'msg'):**
- [ ] `__resetRelationships()`; `__addPending('crystalloids')` — chain item 0 = msg
- [ ] Open contacts → crystalloids row has unread dot → tap → detail shows msg text
- [ ] Single «Понятно» button visible (pink CTA mini)
- [ ] Tap «Понятно» → item disappears, relationship unchanged (still 2), chainProgress crystalloids → 1
- [ ] Engine auto-pulls next item (chain item 1 also = msg) → another msg appears

**D2. dialog (item.type === 'dialog'):**
- [ ] `__resetRelationships()`; `__advanceChain('crystalloids')` 2 times; `__addPending('crystalloids')` — chain item 2 = dialog
- [ ] Detail shows dialog text + TWO buttons: «Отказать (-1)» (neutral grey) and «Поддержать (+1)» (pink CTA)
- [ ] Tap «Поддержать» → relationship +1 (2 → 3, tier transitions hostile → cool), bar fills more, tier badge updates AND pulses (CSS keyframe contacts-tier-pulse 800ms)
- [ ] Engine auto-pulls next item (chain item 3 = msg)

**D3. quest_hook (item.type === 'quest_hook'):**
- [ ] `__resetRelationships()`; `__advanceChain('crystalloids')` 5 times; `__addPending('crystalloids')` — chain item 5 = quest_hook
- [ ] Detail shows quest_hook text + «Поддержать (+1)» / «Отказать (-1)» buttons + GOLD italic «Запрос принят. Детали скоро прояснятся.» hint below text (cosmic_hub.contacts.quest_stub)
- [ ] Tap «Поддержать» → relationship +1, item resolves, next pull
- [ ] Verify quest_id reserved for Phase 28: `useGameStore.getState().pendingItems` — after resolve, this quest_hook item gone; nothing else affected

**D4. empty state:**
- [ ] `__advanceChain('crystalloids')` until chainProgress=10 (chain end)
- [ ] Open crystalloids detail → no pending interaction → «Все сообщения прочитаны» empty state shown

## Scenario E: Event toast (inline event auto-apply)

**Goal:** Step 6 of every chain is inline event — auto-applies delta + fires toast banner.

- [ ] `__resetRelationships()`; `__markFirstContact('crystalloids')` (Phase 26) OR `__addPending('crystalloids')`
- [ ] `__advanceChain('crystalloids')` 6 times (now at chain item 6 = event target=self delta=-1)
- [ ] `__addPending('crystalloids')` triggers pull → engine processes event automatically
- [ ] TOAST BANNER appears at top of screen: 💎 emoji + RU text «Кристаллозиды кристаллический резонанс затронул их сны: -1 к отношениям» + red -1 value
- [ ] After ~3 seconds toast fades out (CSS keyframe contacts-toast-fade) and disappears
- [ ] `useGameStore.getState().raceRelationships.crystalloids` decremented by 1 (clamped to RELATIONSHIP_MIN=1 if already at floor)
- [ ] chainProgress.crystalloids = 7 (advanced past event)
- [ ] Engine auto-pulled chain item 7 → pendingItems contains new msg/dialog item

**E2. Multiple events queue (max 3 visible):**
- [ ] Rapid: `__resetRelationships()`; for each of 5 races, run `__markFirstContact(...)` then `__advanceChain(raceId)` 6 times then `__addPending(raceId)`
- [ ] Up to 3 toasts stacked vertically at top-center
- [ ] 4th and 5th events: oldest fades, newer appears at bottom of stack (FIFO trim)
- [ ] Toast z-index 150 — appears ABOVE Cosmic Hub (100) and Star Map (50)

## Scenario F: Persistence + DEV helpers

**Goal:** State survives reload; DEV helpers work.

- [ ] `__addPending('crystalloids')` → check `useGameStore.getState().pendingItems.length === 1`
- [ ] `__advanceChain('fireworms')` 2 times → check chainProgress.fireworms === 2
- [ ] Reply to one pending: tap «Поддержать» on crystalloids dialog → relationship increments to 3
- [ ] **Reload browser** (full page refresh)
- [ ] After reload: `useGameStore.getState().raceRelationships.crystalloids === 3` (persisted via localStorage cosmic blob)
- [ ] `useGameStore.getState().chainProgress.fireworms === 2` (persisted)
- [ ] `useGameStore.getState().pendingItems.length` matches pre-reload (modulo new pulls triggered after reload)
- [ ] `__dumpContacts()` → console.table shows all 10 races with current state
- [ ] Server sync: open Network tab → next PUT /game/state includes cosmic.raceRelationships / chainProgress / pendingItems
- [ ] DEV helpers tree-shake check: `npx vite build` → grep -c "__addPending" dist/assets/index-*.js returns 0 (helpers excluded from production bundle)

## i18n parity

- [ ] `node scripts/check-translations.cjs` → 0 missing, 0 extra (parity preserved)
- [ ] Switch locale RU → all cosmic_hub.contacts.* + cosmos.event.* + races.<id>.chain.<N>.* render in Russian
- [ ] Switch locale EN → same in English ("Contacts", "Support", "Refuse", "OK", tier names hostile/cool/neutral/friendly/ally, race chain texts)
- [ ] Switch locale ES → same in Spanish ("Contactos", "Apoyar", "Rechazar", etc.)
- [ ] Key count per locale: 522 total per locale × 3 = 1566 entries (Phase 26 baseline 402 → Phase 27 +120 keys per locale: 15 cosmic_hub.contacts.* + 100 races.<id>.chain.<step>.* (10 races × 10 steps) + 5 cosmos.event.* + 1 notification template)

## Build chain

- [x] `cd client && npx tsc --noEmit` clean (0 errors)
- [x] `cd client && npx vitest run` — 117 PASS / 0 FAIL / 1 skip (3 pre-existing suite-import failures from Phase 22 documented в deferred-items.md; new pendingEngine.test.ts: **13 PASS**)
- [x] `cd client && node scripts/check-translations.cjs` — 522 keys × 3 locales, 0 missing, 0 extra
- [x] `cd client && npx vite build` — success (1 chunk-size warning preserved from Phase 26 baseline)
- [x] Bundle delta gzip main: **220.94 KB** recorded (baseline Phase 26: 209.17 KB → **+11.77 KB**; cap ~+15 KB ✓)
- [x] CosmicHubModal chunk gzip: **15.61 KB** (Phase 26 baseline 14.26 KB → **+1.35 KB**)
- [x] DEV helpers tree-shake verified: `grep -c "__addPending" dist/assets/index-*.js` → 0

## Regression sanity (no breakage of prior phases)

- [ ] Phase 26 First Contact flow: tap habitable planet → cinematic + modal play (still works after engine integration)
- [ ] Phase 26 Inventory tab: open Hub → 🎒 → 4 sections render unchanged (relationships placeholder still shows "?" — Phase 27 contacts is separate tab, doesn't replace inventory placeholder)
- [ ] Phase 25 CosmicHub restyle: pink underline + dark cosmic shell unchanged
- [ ] Phase 24 Captain Birth flow: L18+L18 merge → cinematic + modal still works
- [ ] Phase 22 Cosmic Shop tab: open Hub → 🛒 → items rendered с essence/serum balances
- [ ] Phase 18 Bestiary tab: open → 4 locations × virtualized grids visible

---

**Tester signature / date:** _________
