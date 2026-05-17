# SMOKE_TEST Phase 23 — Onboarding Flow

Дата: 2026-05-18
Phase: 23-onboarding-flow (6 plans complete)

Manual приёмка soft 4-beat onboarding. Запускается на свежем localStorage
или через `__resetOnboarding()` dev helper.

---

## Preconditions

```bash
cd client && npm run dev
```

1. Открыть http://localhost:5173 (или vite-assigned port).
2. DevTools → Console.
3. Подготовить два сценария local storage:
   - **Fresh:** Clear all `frog_evolution_*` keys (либо `__resetOnboarding()` после первого boot).
   - **Mid-game:** Сейв уже прошедшего Welcome / Beat 2 (для regression check'а).

## Dev helpers (DEV-only)

В Console доступно:

- `__resetOnboarding()` — wipe state + reload (Welcome re-shows).
- `__skipOnboarding()` — mark все flags + locations celebrated.
- `__triggerBeat2()` — force-reset firstBoxTapSeen + fake firstBoxSpawned (DOM label only).
- `__triggerBeat4(locationId)` — force-trigger celebration для {2, 3, 6}.
- `__onboardingState()` — console.table snapshot + return object.

---

## Scenario A — Beat 1: Welcome modal

1. `__resetOnboarding()` → page reloads.
2. Modal появляется по центру:
   - [ ] Pastel gradient bg (lake-blue → swamp-green).
   - [ ] Title «Frog Evolution» (font-weight 900, textShadow).
   - [ ] Subtitle «Тапай лягушек. Соединяй одинаковых. Открывай мир.»
   - [ ] L1 frog SVG bobbing (scale 1.0 ↔ 1.05, ~1.5s loop).
   - [ ] Pink CTA «Начать».
   - [ ] Backdrop dim ~rgba(0,0,0,0.6).
3. Click backdrop → [ ] НИЧЕГО (single-action design).
4. Click CTA «Начать»:
   - [ ] Fade-out ~400ms.
   - [ ] Modal disappears.
   - [ ] `__onboardingState()` показывает `welcomeSeen: true`.
5. F5 reload → [ ] modal НЕ появляется (persisted).
6. **i18n EN:** в Settings переключить на EN → `__resetOnboarding()` → CTA «Start», subtitle «Tap frogs. Merge same. Discover the world.»
7. **i18n ES:** ES → reset → CTA «Empezar», subtitle «Toca ranas. Junta iguales. Descubre el mundo.»

## Scenario B — Beat 2: Tap-hint pulse

1. `__resetOnboarding()` → reload → click «Начать».
2. Дождаться первого падения бокса (несколько секунд idle).
3. Через ~300ms после landing:
   - [ ] Pink pulsing ring появляется вокруг бокса (radius ≈ box.width * 0.7).
   - [ ] Tween: alpha 0.4 ↔ 0.9, scale 1.0 ↔ 1.15, ~800ms yoyo.
   - [ ] DOM label «Тапни 👆» под рингом.
4. Если бокс продолжает двигаться (gravity drop) → [ ] ring треккает позицию.
5. Tap по боксу:
   - [ ] Ring fade-out ~300ms.
   - [ ] Label fade-out.
   - [ ] Box opens normally.
   - [ ] `__onboardingState()` показывает `firstBoxTapSeen: true`.
6. Следующий бокс упадёт БЕЗ ring (state seen).
7. **Alt path:** reset → не тапать бокс ~5с → [ ] ring + label auto-fade.
8. **DOM-only test:** `__triggerBeat2()` → label «Тапни 👆» показывается без реального бокса (ring требует BoxController, не появится).

## Scenario C — Beat 3: Merge demo

1. `__resetOnboarding()` → reload → pass Welcome → дать упасть 2 боксам и тапнуть оба.
   - Workaround при медленном RNG: использовать existing dev helpers `__giveFrog(1)` x2 если они доступны (см. `installBestiaryDevHelpers`).
2. 2 L1 frogs на поле → [ ] триггерится merge demo:
   - [ ] 2 pulsing rings вокруг обеих frogs (radius меньше box ring).
   - [ ] Ghost-frog (semi-transparent ~alpha 0.5) — копия одной frog.
   - [ ] Ghost движется по arc curve source → target (~1200ms).
   - [ ] При arrival — small burst (fade + scale).
   - [ ] Loop повторяется до 3 раз с pause ~800ms.
   - [ ] DOM label «Перетащи одну на другую» между frogs.
3. Drag frog на другую → merge:
   - [ ] Ghost demo cancels (no more loops).
   - [ ] Rings destroy.
   - [ ] Real merge success.
   - [ ] Toast «Готово! Дальше мерджи всё подряд» (slide-up снизу).
   - [ ] Toast auto-hide ~3с.
   - [ ] `__onboardingState()` показывает `firstMergeSeen: true`.
4. **Cancel-on-drag:** reset → reach state с 2 L1 frogs → начать drag реальной frog →
   - [ ] Ghost cancels mid-animation.
   - [ ] Rings остаются (помогают завершить).
   - [ ] Отпустить без merge → ghost НЕ restart'ит (cancel sticky).
5. **Auto-dismiss:** reset → 2 L1 frogs → НЕ мерджить ~8с →
   - [ ] Demo fades.
   - [ ] `firstMergeSeen` → true.
6. **i18n EN:** label "Drag one onto another", toast "Done! Now merge everything".
7. **i18n ES:** label «Arrastra una sobre la otra», toast «¡Listo! Ahora junta todo».

## Scenario D — Beat 4: Location unlock (Болото L7)

1. `__resetOnboarding()` → можно `__skipOnboarding()` чтобы пропустить beats 1-3.
2. Достичь L7 (или `__triggerBeat4(2)` для force-trigger).
3. При unlock:
   - [ ] Phaser confetti burst в центре canvas (green/yellow particles).
   - [ ] LocationStack button «🌿» (Болото) появляется с pulse + glow #ec4899 + bobble scale 1.0 ↔ 1.1.
   - [ ] DOM toast снизу «Болото открыто! Тапни иконку чтобы перейти».
   - [ ] Toast slide-up animation.
4. Подождать ~7с → [ ] toast auto-fade, но [ ] pulse продолжается до tap.
5. Tap «🌿» в LocationStack:
   - [ ] Pulse stops.
   - [ ] Location transition trigger.
   - [ ] `__onboardingState()` показывает `locationsCelebrated[2]: true`.
6. `__triggerBeat4(2)` повторно → [ ] ничего (helper сбрасывает flag, но если повторить
   БЕЗ helper'а — celebration не пройдёт, потому что guard в OnboardingController).

## Scenario E — Beat 4 для Лес (L13) + Star Map (cosmos sentinel)

1. `__triggerBeat4(3)` → [ ] confetti palette (зелёно-коричневая) + toast «Лес открыто! Тапни иконку чтобы перейти».
2. Tap «🌲» (Лес) в LocationStack → [ ] pulse stops, transition.
3. `__triggerBeat4(6)` → [ ] cyan/violet palette + toast «Звёздная карта открыто! Тапни иконку чтобы перейти».
4. Tap «✨» (Star Map) → [ ] pulse stops.
5. `__onboardingState()` → `locationsCelebrated: { 2: true, 3: true, 6: true }`.

## Scenario F — Full flow end-to-end

1. `__resetOnboarding()` → reload.
2. Пройти весь онбординг organically:
   - Welcome → CTA «Начать».
   - Tap-hint → tap первый box.
   - Merge demo → drag merge → success toast.
   - Progress до L7 → Beat 4 (Болото) → tap location.
   - Progress до L13 → Beat 4 (Лес) → tap location.
   - Progress до L18 + L18 → Beat 4 (cosmos) → tap Star Map.
3. F5 reload в любой момент → [ ] не повторяет уже passed beats.
4. State persistent (`__onboardingState()` после F5 = до F5).

## Scenario G — i18n parity

1. `cd client && npm run check-translations` → [ ] PASS (RU/EN/ES 334+ keys).
2. Manually switch i18n RU → EN → ES → `__resetOnboarding()` → [ ] все texts корректны.

## Scenario H — Build chain

1. `cd client && npx tsc --noEmit` → [ ] clean (0 errors).
2. `cd client && npm run build` → [ ] success (vite + tsc).
3. `cd client && npx vitest run src/store/onboarding/` → [ ] PASS (8 tests из 23-01).
4. Bundle delta vs baseline → [ ] within ~10KB budget (Phase 23 adds Phaser
   ring/ghost/confetti + 3 React overlays — see Plan 23-05 SUMMARY).

---

## Acceptance criteria

- Все 4 beats работают independently и в полном flow.
- State persisted per-device (localStorage `frog_evolution_onboarding`).
- i18n RU/EN/ES parity (`check-translations` PASS).
- Никаких console errors / warnings.
- Cliclability: все interactions не блокированы overlay'ями.
- Mobile viewport-safe (375px tested manually).
- Build chain green (tsc + vite + vitest).
