# SMOKE_TEST_28: Phase 28 Quests — Manual QA Checklist

**Phase:** 28-quests
**Scope:** Quest mechanic wiring; 8-я Cosmic Hub tab «Квесты»; reward popup; cancel flow
**Updated:** 2026-05-19
**Status:** Ready for manual QA post-shipping

Run on cosmos-unlocked save with at least one race contacted (firstContactsSeen=true для tested race). Use DEV helpers `__addPending` / `__advanceChain` / `__activateQuest` / `__progressQuest` / `__completeQuest` / `__resetQuests` где indicated.

---

## Scenario A — Tab visibility + cosmos gate

Prerequisites: cosmos-unlocked save (otherwise modal-level lock screen). Cosmic Hub открыт.

- [ ] Open Cosmic Hub → 8 tabs visible в strip (🚀 Корабль / 🏭 Боксы / 📖 Бестиарий / 🐸 Карьеры / 🛒 Магазин / 🎒 Инвентарь / 📡 Контакты / 📜 Квесты).
- [ ] Tap «Квесты» tab → tab content swaps. Active counter «Активные квесты: 0/5» visible.
- [ ] If activeQuests empty: empty state shows «Нет активных квестов. Откройте Контакты, чтобы принять.»
- [ ] Tab strip fits 320px viewport without truncation OR scrolls horizontally без breaking layout (NOTE: if visible overflow, document в DEFERRED — Phase 28 fallback options: reduce padding `12px 4px → 12px 2px` / icon-only labels via @media / scroll-strip).
- [ ] Tap any other tab и back to «Квесты» — state preserved (selectedTab persists).
- [ ] Reload page → return to «Квесты» tab (sessionStorage lastActiveTab='quests' accepted by persistence whitelist).

## Scenario B — Quest activation from Contacts «Поддержать»

Prerequisites: A race с chainProgress ≥ 5 (так quest_hook = next pending item) OR use DEV `__addPending('crystalloids')` repeatedly then `__advanceChain('crystalloids')` 5 раз чтобы reach a quest_hook.

- [ ] В Contacts tab navigate to a race with a quest_hook pending. Tap «Поддержать».
- [ ] Quest_hook resolution: relationship +1 (visible в RelationshipBar pulse).
- [ ] Switch to «Квесты» tab → 1 new active quest card visible. Race emoji + type icon + description + progress bar (0/N) + reward preview visible.
- [ ] Console: `__dumpQuests()` → 1 entry в activeQuests с correct questId + raceId + progress=0.
- [ ] Trigger DEV: `__activateQuest('crystalloids_silent_scout')` → cap не reached → quest added.

## Scenario C — Progress increment per quest type

Note: requires specific quest types active. Use `__activateQuest('id')` для fixtures.

- [ ] Activate a delivery serum quest (`__activateQuest('crystalloids_shard_delivery')`). Open a crystal box (or DEV-grant +1 crystal serum). Quest progress increments.
- [ ] Activate an exploration planets quest (`__activateQuest('crystalloids_silent_scout')`). Tap any 5 different planets в Star Map. Progress reaches 5.
- [ ] Activate a merge quest (`__activateQuest('forestcores_young_forest')` — merge_count target 10). Perform 10 merges anywhere. Progress reaches 10.
- [ ] Activate a diplomacy quest (`__activateQuest('crystalloids_lattice_survey_b')` — raise_relationship tier 6). Use `__addPending` + accept until relationship = 6. Progress reflects current relationship score.

## Scenario D — Auto-complete + reward popup

- [ ] Activate any easy quest. Use `__completeQuest('<activeQuestId>')` to force completion.
- [ ] Reward popup appears: dark card с race emoji + GOLD title «Квест выполнен!» + quest short label + reward summary + pink «Забрать» CTA. Slide-in animation visible (250ms).
- [ ] Backdrop tap dismisses. Escape key dismisses. Auto-dismiss after 5s.
- [ ] After dismiss: quest moves из activeQuests в completedQuests (visible в collapsible CompletedQuestsList). Reward applied: gold/essence/serum counter increments OR relationship +1 (для diplomacy reward).
- [ ] Trigger 2 completions back-to-back. Popups queue и show sequentially.

## Scenario E — Manual cancel + relationship penalty

- [ ] On a QuestCard, tap «Отказаться». Inline confirm panel appears с race-name interpolation в cancel_confirm text.
- [ ] Tap «×» — confirm panel closes, quest still active.
- [ ] Tap «Да» (the red destructive button в confirm panel) — quest disappears from list, relationship -1 to that race (visible в Contacts tab RelationshipBar). cancelQuest action emitted 'quests:cancelled' + 'contacts:relationship-delta' events.
- [ ] Active counter decrements.

## Scenario F — Persistence + cap enforcement

- [ ] Activate 5 quests (cap reached). Active counter reads «5/5».
- [ ] Cap notification visible: «Лимит активных квестов: 5. Завершите текущие.»
- [ ] Try to activate a 6th via Contacts quest_hook accept. Relationship still +1 BUT quest NOT added. Active counter stays at 5/5.
- [ ] Reload page. activeQuests survives reload (count, progress, ids intact). completedQuests survives reload.
- [ ] Sign out + sign in on a different device (server sync test). Quests state matches (subject to game/state PUT cycle completing).

---

## i18n PARITY (build chain measurement)

Run from `client/`:
```
node scripts/check-translations.cjs
```
Expected:
- RU leaves: **633** (Phase 27 baseline 522 + Phase 28 delta +111)
- EN leaves: **633** (matches RU)
- ES leaves: **633** (matches RU)
- Missing: 0 / Extra: 0

Phase 28 i18n delta breakdown:
- +14 cosmic_hub.quests.* + cosmic_hub.tab_quests (Plan 28-01 skeleton)
- +80 quests.<id>.{description,short} (Plan 28-02, 40 quests × 2 keys)
- +17 misc (cancel_button / placeholder + reward popup keys ranges из 28-01/28-04 wiring)
- Total per locale: **+111 leaves** (522 → 633)

## BUILD CHAIN

```
cd client && ./node_modules/.bin/tsc --noEmit                     # 0 errors
cd client && ./node_modules/.bin/eslint <Phase 28 touched files>   # No issues found
cd client && ./node_modules/.bin/vitest run                        # 198 PASS / 0 FAIL / 1 skip
cd client && ./node_modules/.bin/vitest run src/game/quests/       # 24 PASS (questEngine)
cd client && node scripts/check-translations.cjs                  # 0 missing / 0 extra (see PARITY)
cd client && ./node_modules/.bin/vite build                       # Success (chunk warning on phaser pre-existing)
```

Bundle delta:
- Phase 27 baseline main gzip: 220.94 KB
- Phase 28 actual main gzip: **242.67 KB**
- Delta: **+21.73 KB** (target ~+15 KB; actual exceeds target — Phase 28 ships substantive feature surface: 40 quest configs + engine + UI + reward popup + 111 i18n leaves per locale)
- CosmicHubModal chunk gzip: **16.84 KB** (Phase 27 baseline 15.61 KB → +1.23 KB)
- DEV helpers tree-shake: `grep -c "__activateQuest" dist/assets/index-*.js` → **0** ✓

## REGRESSION SANITY

Verify these Phase 18-27 surfaces still work (open каждый, perform basic action, confirm no console errors):

- [ ] Phase 18 Bestiary tab — toggle, see milestone counter
- [ ] Phase 22 Cosmic Shop tab — toggle, see essence/perma upgrades
- [ ] Phase 22-03 Carrier ascension — feed carrier to L18 → ascends → essence +1
- [ ] Phase 24 Captain birth cinematic — DEV `__triggerCaptainBirth()` runs cinematic + modal
- [ ] Phase 25 Welcome modal — DEV reset onboarding → modal mounts on next refresh
- [ ] Phase 26 First contact cinematic — DEV `__triggerFirstContact('crystalloids')` runs burst + DOM modal
- [ ] Phase 26-04 Inventory tab — toggle, see currencies/serums/placeholders
- [ ] Phase 27 Contacts tab — toggle, see 10 races, tap one, see RaceDetailView + RelationshipBar
- [ ] Phase 27 Event toast — DEV `__advanceChain('crystalloids')` past an event → toast appears

---

*Plan 28-06 / SMOKE_TEST_28 / Phase 28-quests*
*Updated: 2026-05-19*
