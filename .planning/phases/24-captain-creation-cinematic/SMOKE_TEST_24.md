# Phase 24 — Smoke Test (Captain creation cinematic)

Дата: 2026-05-18
Phase: 24-captain-creation-cinematic (5 plans complete)

**Scope:** 5-beat cinematic при первом L18+L18 normal merge
(flash → cosmic effect → modal → spawn L1 → Star Map).
**Manual QA scenarios:** A-F.
**Dev helpers (DEV builds only):**

- `__triggerCaptainBirth()` — force play cinematic (no state change, replay-safe)
- `__resetCaptainBirth()` — clear captainBirthSeen + reload
- `__captainBirthState()` — inspect snapshot (table + return)

Compatible adjacent helpers:

- `__onboardingState()` — Phase 23
- `__unlockAllLocations()` / `__giveFrog(level)` / `devCarriers.*` —
  существующие dev helpers для cheat'а L18 frogs.

---

## Preconditions

```bash
cd client && npm run dev
```

1. Открыть http://localhost:5173 (vite-assigned port).
2. DevTools → Console.
3. На fresh save: `localStorage.clear(); location.reload()` либо
   `__resetCaptainBirth()` после первого boot.

---

## Scenario A — Fresh save, first L18+L18

**Цель:** проверить полный 5-beat cinematic от начала до конца.

**Setup:**

```js
localStorage.clear()
location.reload()
```

Дождись loading screen → ready.

**Steps:**

1. Cheat ≥2 L18 frogs на текущей локации:
   - Через `__giveFrog(18)` (если есть) либо `window.__mainScene.spawnFrog(...)`.
   - Альтернатива: long-form play через дроп L1 → L18 (для full integration).
2. Drag одну L18 на другую → merge.

**Expected:**

- [ ] **Beat 1** — flashAt белая вспышка в точке merge (normal merge effect).
- [ ] **Beat 2** — Phaser cinematic ~3s:
  - радиальные particles (golden #fbbf24 + white + cyan #67e8f9), ~70 штук
  - 3 концентрических расширяющихся rings (golden glow)
  - camera zoom 1.0 → 1.08 → 1.0
- [ ] **Beat 3** — DOM modal:
  - L1 frog SVG centered
  - gold drop-shadow вокруг frog
  - pulse scale 1.0↔1.05 каждые 1.5s
  - title «Вы создали Капитана» (gold)
  - subtitle «Космос открыт. Готовы исследовать?»
  - CTA «В космос →» (pink #ec4899)
- [ ] Tap CTA → modal fade-out 400ms.
- [ ] **Beat 4** — L1 frog появляется на текущей локации (addFrogToLocation).
- [ ] **Beat 5** — Star Map открывается автоматически.
- [ ] `__captainBirthState()` показывает:
  - `captainBirthSeen: true`
  - `hasCosmosUnlocked: true`
  - `discoveredLevels` содержит 19

---

## Scenario B — Replay protection (повторный L18+L18)

**Цель:** убедиться что cinematic НЕ повторяется на последующих L18 merge'ах.

**Setup:** после Scenario A; **НЕ** reset'ить.

**Steps:**

1. Закрой Star Map (вернись на любую farm локацию).
2. Cheat ещё пару L18 → merge.

**Expected:**

- [ ] Beat 1 flash происходит (normal merge effect).
- [ ] **НЕТ** Beat 2 cinematic (никаких particles/rings/camera zoom).
- [ ] **НЕТ** модалки.
- [ ] **НЕТ** автоматического Star Map opening.
- [ ] `hasCosmosUnlocked` по-прежнему `true` (markCosmosUnlocked idempotent).
- [ ] `captainBirthSeen` по-прежнему `true`.

---

## Scenario C — Legacy migration (uplifted save)

**Цель:** проверить что старый сейв с открытым cosmos но без captainBirthSeen
ключа корректно мигрирует.

**Setup:** имитируй uplifted save:

```js
localStorage.setItem(
  'frog_evolution_discovered',
  JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19])
)
localStorage.removeItem('frog_evolution_captain_birth_seen')
location.reload()
```

**Expected:**

- [ ] После reload `__captainBirthState()` показывает `captainBirthSeen: true`
      (legacy inferred через persistence.loadCaptainBirthSeen()).
- [ ] `localStorage['frog_evolution_captain_birth_seen'] === 'true'`
      (single-shot migration write).
- [ ] При L18+L18 — **НЕТ** cinematic (как Scenario B).

---

## Scenario D — Server sync (persistence + hydrate)

**Цель:** проверить что captainBirthSeen уходит на сервер и приходит обратно.

**Setup:** после Scenario A (с прошедшим cinematic).

**Steps:**

1. Wait ~5-6 секунд (SAVE_THROTTLE_MS).
2. DevTools → Network → найди `PUT /game/state` → проверь Request payload.
3. Частично очисти localStorage:
   ```js
   localStorage.removeItem('frog_evolution_captain_birth_seen')
   location.reload()
   ```

**Expected:**

- [ ] Payload (или cosmic JSON blob внутри) содержит
      `captainBirthSeen: true`.
- [ ] После reload (server fetch завершится) `__captainBirthState()`
      снова показывает `captainBirthSeen: true` (server-hydrated).
- [ ] `localStorage['frog_evolution_captain_birth_seen']` снова `'true'`
      (sync writeback из cosmic blob).

---

## Scenario E — Dismiss via backdrop click

**Цель:** проверить что click на backdrop поведёт себя так же как CTA tap
(per CONTEXT.md design — backdrop ≡ CTA для exit).

**Setup:** `__resetCaptainBirth()` → fresh cinematic.

**Steps:**

1. Trigger cinematic через L18+L18 либо `__triggerCaptainBirth()`.
2. Дождись модалки.
3. Click на dark area вокруг модалки (НЕ на CTA button).

**Expected:**

- [ ] Modal fade-out 400ms.
- [ ] **Beat 4** — L1 frog spawn (такое же поведение как при CTA tap).
- [ ] **Beat 5** — Star Map открывается.
- [ ] Backdrop click функционально эквивалентен CTA tap.

---

## Scenario F — Cinematic timing + cliclability

**Цель:** UX polish check (тайминги, hover/tap, z-index, mobile safe-area).

**Setup:** `__triggerCaptainBirth()` (без reset — просто визуально проверить).

**Expected:**

- [ ] Beat 2 длится ~3 секунды (particle spawn → camera zoom-out complete).
- [ ] Frog SVG в modal действительно pulse'ит scale 1.0↔1.05 каждые 1.5s.
- [ ] CTA button НЕ растягивается на весь экран (inline-block, max-width:100%).
- [ ] Tap на CTA сразу отвечает (без iOS double-tap-zoom delay благодаря
      `touchAction: manipulation`).
- [ ] Modal находится поверх HUD (z-index 200 — закрывает SerumBar,
      Cosmic Hub buttons, ActiveBonusesBar).
- [ ] Phaser cinematic depth 9000 — particles/rings поверх frogs/boxes.
- [ ] На вертикальной ориентации (iPhone-ish) modal не выходит за safe area.

---

## i18n verification

```bash
cd client && npm run check-translations
```

**Expected:** PASS, RU/EN/ES parity, captain.birth.{title,subtitle,cta}
присутствуют в каждой локали.

Spot check переключения языка в DevTools во время модалки:

- [ ] **RU:** «Вы создали Капитана» / «Космос открыт. Готовы исследовать?» / «В космос →»
- [ ] **EN:** «You Created the Captain» / «The cosmos is open. Ready to explore?» / «To Cosmos →»
- [ ] **ES:** «Has Creado al Capitán» / «El cosmos está abierto. ¿Listo para explorar?» / «Al Cosmos →»

(Финальные строки см. в `client/src/i18n/{ru,en,es}.json` под ключом `captain.birth`.)

---

## Build chain

```bash
cd client
npx tsc --noEmit   # PASS — TS clean
npm run build      # vite build PASS
npm run check-bundle 2>&1 | tail -10  # bundle delta vs baseline
```

**Expected:**

- [ ] tsc clean (0 errors).
- [ ] vite build clean.
- [ ] bundle delta < +6 KB gzip (small: 1 effect file + 1 modal + 3 i18n strings
      + controller). Cap из Phase 24 budget: +20 KB.

---

## Regression sanity (адаптировано из Phase 22/23)

- [ ] Cosmos gate behavior не сломан — `hasCosmosUnlocked` после A === true,
      Star Map controls видимы.
- [ ] Other modals (DiscoveryModal, RareCrateModal, WelcomeBackModal,
      WelcomeModal Phase 23) не пересекаются с CaptainBirthModal по z-index.
- [ ] OnboardingController flow (Phase 23) продолжает работать после
      cinematic — например Beat 4 «локация открыта» celebration по-прежнему
      срабатывает.
- [ ] frog.container.alpha не tween'ится cinematic'ом
      (memory feedback_frog_container_alpha; particles/rings = отдельные GameObjects).
- [ ] Никаких Lottie зависимостей в bundle (CSS keyframes + Phaser tweens только;
      memory feedback_animations).

---

## Reporting

При обнаружении регрессии:

1. Запиши scenario letter + step.
2. Прикрепи `__captainBirthState()` snapshot.
3. DevTools Console errors (если есть).
4. Network payload для D-сценария.

PASS критерий: все 6 сценариев + i18n + build chain без unchecked checkboxes.
