# Phase 26: Cosmos Races Foundation — Manual Smoke Test

**Phase:** 26-cosmos-races-foundation
**Date:** 2026-05-18+
**Tester:** _________

Run order: A → B → C → D → E → F → G. Каждое scenario независимо в смысле state setup (используйте dev helpers для reset между scenarios если нужно).

## Prerequisites

- [ ] `npm run dev` running
- [ ] DEV console available (window helpers exposed)
- [ ] Player state с cosmos unlocked (`useGameStore.getState().hasCosmosUnlocked === true`).
  - Если не unlocked: triggerа через `__triggerCaptainBirth()` + L18+L18 merge, или dev tool `useGameStore.setState({hasCosmosUnlocked: true})`.

## Scenario A: Race config + i18n integrity

**Goal:** Убедиться что Plan 26-01 race data доступна везде.

- [ ] Console: `__listRaces()` → 10-row table с id/affinity/emoji
- [ ] Console: `__firstContactsState()` → 10 entries все false
- [ ] Console: `useGameStore.getState().firstContactsSeen` → `{crystalloids: false, ..., cometfolk: false}`
- [ ] Locale switch (settings → RU/EN/ES) → no missing-key console warnings
- [ ] Console: i18next get keys `races.crystalloids.name` / `races.fireworms.lore_short` — всё translation present для текущего locale

## Scenario B: Habitable planets data

**Goal:** Убедиться что Plan 26-02 attached inhabitants корректно.

- [ ] Console: `import('./src/game/data/habitablePlanets').then(m => console.log(m.getHabitablePlanets().length))` → 30
- [ ] Каждая раса имеет 3 planets:
  ```
  __listRaces().forEach(r => {
    const ps = ... getPlanetsByRace(r.id)
    console.log(r.id, ps.length, ps.filter(p=>p.inhabitant.role==='home').length, 'home')
  })
  ```
  → 10 строк, каждая `<id> 3 1 home`
- [ ] Player home planet (id='home') НЕ inhabited

## Scenario C: Star Map visual indicators (post-cosmos)

**Goal:** Plan 26-03 race overlays.

- [ ] Open Star Map (post-cosmos)
- [ ] Visible: 10 home planets с gold pulsing halo + race emoji icon (18px bold)
- [ ] Visible: 20 colony planets с race-color glow + smaller emoji (14px)
- [ ] Visible: 320 uninhabited planets — без overlay (как до Phase 26)
- [ ] Tap на home planet → popover показывает race emoji + name + "⭐ Главный мир"
- [ ] Tap на colony planet → popover показывает race emoji + name + "· Колония"
- [ ] Tap на uninhabited planet → popover как раньше (no race info row)
- [ ] Close Star Map, reopen → overlays переаттач'ятся, no duplicate sprites

## Scenario D: Cosmos gate transparency (pre-cosmos)

**Goal:** До cosmos unlock — habitable planets выглядят uninhabited.

- [ ] Reset cosmos: `useGameStore.setState({hasCosmosUnlocked: false}); window.location.reload()`
- [ ] Open Star Map → НИ ОДНОЙ race overlay не visible
- [ ] Tap habitable planet → popover БЕЗ race info row
- [ ] Trigger cosmos unlock: `__triggerCaptainBirth()` (Phase 24 helper) → L18+L18 merge OR direct `useGameStore.getState().markCosmosUnlocked()`
- [ ] Без reload — Star Map overlays attach reactively (если scene still open)
- [ ] OR reload → overlays present at next mount

## Scenario E: Inventory tab

**Goal:** Plan 26-04 6-я кнопка в Cosmic Hub.

- [ ] Open Cosmic Hub → 6 tabs visible: 🚀 Корабль / 🏭 Боксы / 📖 Бестиарий / 🐸 Карьеры / 🛒 Магазин / 🎒 Инвентарь
- [ ] Tap 🎒 → InventoryTab renders 4 секции
- [ ] ВАЛЮТЫ row: 💎 Эссенция = `essence` value, 💩 Слизь = `gold` value (live update if changed)
- [ ] СЫВОРОТКИ: 4×4 grid 16 элементов. count=0 → dimmed; count>0 → element-color border + bright value
- [ ] АРТЕФАКТЫ: "Скоро…" placeholder в dark card
- [ ] ОТНОШЕНИЯ С РАСАМИ: 10 row, каждая с race emoji + name + "?" placeholder badge
- [ ] Switch на другой tab + назад → state preserved
- [ ] Close Hub → reopen → 🎒 tab restored через sessionStorage
- [ ] DEV: `useGameStore.getState().addSerum('fire')` → 🔥 cell обновляет count

## Scenario F: First contact flow

**Goal:** Plan 26-05 cinematic + modal.

- [ ] Reset: `__resetFirstContacts()`
- [ ] Open Star Map → tap home planet of crystalloids race → cinematic plays ~2s (particles + ring tinted crystal color)
- [ ] After cinematic → DOM modal: "Первый контакт" title + 💎 emoji + "Кристаллозиды" name + personality + lore_short + pink "Понятно" CTA
- [ ] Tap CTA → modal fades + closes
- [ ] Check: `__firstContactsState()` → crystalloids: true
- [ ] Tap другую colony crystalloids planet → НИКАКОГО cinematic (idempotent)
- [ ] Tap home planet fireworms race → cinematic plays (fire color!) → modal: 🔥 + "Огнечервы"
- [ ] Modal backdrop click (вне card) → modal closes как CTA
- [ ] DEV: `__triggerFirstContact('gasouls')` (без visit) → cinematic + modal без planet tap
- [ ] Confirm: `__resetFirstContacts()` → replay works

## Scenario G: DEV helpers + Cliclability

- [ ] `__listRaces()` — works в DEV
- [ ] `__listRaces()` — не работает в production build (`import.meta.env.DEV` gate)
- [ ] Mobile touch test: 🎒 Inventory tab button — single tap responds <100ms
- [ ] Mobile touch test: First contact modal CTA — single tap responds <100ms
- [ ] Mobile touch test: First contact backdrop — tap closes modal
- [ ] z-index check: First contact modal над HUD + Star Map + Cosmic Hub modal (200 > 100 > 50)

## i18n parity

- [ ] `npm run check-translations` → 402/402 keys × 3 locales, 0 missing, 0 extra
- [ ] Switch locale RU → all races + cosmos.first_contact + cosmic_hub.inventory keys render in Russian
- [ ] Switch locale EN → same in English (Crystalloids, Fireworms, ..., First Contact)
- [ ] Switch locale ES → same in Spanish

## Build chain

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` all green (104 passed; 3 pre-existing suite-import failures from Phase 22 documented в deferred-items.md — НЕ блокируют)
- [ ] `./node_modules/.bin/vite build` success, no errors
- [ ] Bundle delta gzip main: 209.17 KB (Phase 25 baseline 199.88 KB → **+9.29 KB**, cap +15 KB ✓)
- [ ] Bundle delta gzip CosmicHubModal chunk: 14.26 KB (Phase 25 baseline 13.83 KB → **+0.43 KB**)

## Regression sanity (no breakage of prior phases)

- [ ] Phase 24 Captain Birth flow: L18+L18 merge → cinematic + modal play (still works)
- [ ] Phase 23 Onboarding Beat 1 (welcome modal): triggerа через `__resetOnboarding()` → welcome plays
- [ ] Phase 22 Cosmic Shop tab: open Hub → 🛒 → items rendered с essence/serum balances
- [ ] Phase 18 Bestiary tab: open → 6 location grids visible, virtualized
- [ ] Phase 16 Ship tab: open → ship state rendered, can launch mission
- [ ] Phase 11+ HUD: SerumBar + ActiveBonusesBar render normally

---

**Tester signature / date:** _________
