---
phase: 24-captain-creation-cinematic
plan: 05
subsystem: captain-birth-cinematic
tags: [dev-helpers, smoke-test, finalize, i18n, roadmap, state]
type: execute
wave: 4
depends_on: ["24-01", "24-02", "24-03", "24-04"]
provides:
  - "window.__triggerCaptainBirth / __resetCaptainBirth / __captainBirthState (DEV-only)"
  - "SMOKE_TEST_24.md — 6 manual QA scenarios (A-F)"
  - "Phase 24 closure: ROADMAP plan list + STATE Performance Metrics + REQ coverage 17/17"
requires:
  - "Plans 24-01..24-04 (state, Phaser effect, DOM modal, MergeController/controller/App mount)"
affects:
  - "client/src/App.tsx (DEV bootstrap useEffect, +installCaptainBirthDevHelpers + cleanup)"
  - ".planning/ROADMAP.md (Phase 24 entry финализирован)"
  - ".planning/STATE.md (Phase 24 row + Performance Metrics section)"
tech_stack_added: []
patterns:
  - "DEV-gated window helpers через `installX()` pattern (mirror Phase 23 OnboardingDevHelpers / Phase 18 BestiaryDevHelpers)"
  - "MainScene cam center read через local `as unknown as { __mainScene?: ... }` cast (без глобального declare — избегает конфликта с devCarriers/OnboardingController)"
key_files_created:
  - "client/src/utils/captainBirthDevHelpers.ts"
  - ".planning/phases/24-captain-creation-cinematic/SMOKE_TEST_24.md"
  - ".planning/phases/24-captain-creation-cinematic/24-05-SUMMARY.md"
key_files_modified:
  - "client/src/App.tsx"
  - ".planning/ROADMAP.md"
  - ".planning/STATE.md"
decisions:
  - "Dev helpers wired в DEV bootstrap useEffect (рядом с Bestiary/Onboarding) — НЕ в production captainBirthController effect"
  - "__triggerCaptainBirth НЕ модифицирует state (replay-safe); полный re-test через __resetCaptainBirth"
  - "i18n parity = no-op в Task 2 (337/337 уже PASS после Plans 24-01..04 bootstrap); i18n/index.ts НЕ модифицирован"
  - "Bundle delta: +3.79 KB gzip (cap +20 KB ✓) — main index.js 199.88 KB gzip"
metrics:
  duration_human: "~50 min"
  completed_date: "2026-05-18"
  commits: 2
  files_created: 3
  files_modified: 3
  bundle_delta_gzip_kb: 3.79
  bundle_cap_kb: 20
  i18n_keys_total: 337
  smoke_scenarios: 6
  req_coverage: "17/17 PHASE24-*"
---

# Phase 24 Plan 24-05: Finalize (Dev Helpers + SMOKE_TEST + ROADMAP/STATE) Summary

**One-liner:** Phase 24 закрыт — 3 DEV window helpers для cinematic smoke testing, SMOKE_TEST_24.md с 6 scenarios A-F, ROADMAP/STATE финализированы с bundle delta +3.79 KB gzip и REQ coverage 17/17.

---

## Что сделано

### Task 1 — `captainBirthDevHelpers.ts` + App.tsx wire (commit `ce0b9e8`)

Создан `client/src/utils/captainBirthDevHelpers.ts` (105 lines):

- **`__triggerCaptainBirth()`** — force-играет cinematic. Эмитит
  `captain:birth-start` в `(window.__mainScene.cameras.main.centerX/Y)`,
  fallback `(200, 300)`. НЕ модифицирует state — replay-safe; для full
  re-test нужен `__resetCaptainBirth()`.
- **`__resetCaptainBirth()`** — `saveCaptainBirthSeen(false)` +
  `useGameStore.setState({ captainBirthSeen: false })` + `window.location.reload()`.
  Cinematic снова сыграет на следующем L18+L18 или через `__triggerCaptainBirth`.
- **`__captainBirthState()`** — snapshot
  `{captainBirthSeen, hasCosmosUnlocked, currentLocation, discoveredLevels}`,
  print через `console.table` (flat fields) + отдельный `console.info`
  (discovered array). Returns snapshot.

`App.tsx`:

- import + call `installCaptainBirthDevHelpers()` в DEV bootstrap useEffect
  (рядом с `installBestiaryDevHelpers()` / `installOnboardingDevHelpers()`).
- Cleanup в return ветке effect'а удаляет 3 window keys.

**TS subtlety:** глобальный `declare global { interface Window { __mainScene?: unknown } }`
сломал бы типизацию в `devCarriers.ts` / `OnboardingController.tsx` / `MainScene.ts`
(они используют более узкие типы `DevMainScene` / `MainScene`). Поэтому
MainScene ref читается через local cast: `window as unknown as { __mainScene?: MainSceneCameraRef }`.

### Task 2 — i18n parity + SMOKE_TEST_24.md (часть commit'а `de04083`)

**i18n parity:** `npm run check-translations` → `OK: all 337 keys present in RU/EN/ES`.
Все 3 ключа `captain.birth.{title,subtitle,cta}` × 3 locales уже на месте
после Plans 24-01..04 bootstrap. **`client/src/i18n/index.ts` НЕ модифицирован**
(в `files_modified` frontmatter плана был оставлен как possible-change; в нашей
реализации no-op).

**`SMOKE_TEST_24.md` (259 lines):**

- 6 scenarios A-F (требование плана было «5-6», поставили 6 как min):
  - **A** — Fresh save, first L18+L18 (full 5-beat cinematic от Beat 1 flash до Beat 5 Star Map)
  - **B** — Replay protection (повторный L18+L18 → НЕТ cinematic)
  - **C** — Legacy migration (uplifted save с discovered[19] → captainBirthSeen inferred + persisted)
  - **D** — Server sync (PUT /game/state payload + reload hydrate writeback)
  - **E** — Dismiss via backdrop click (≡ CTA tap per CONTEXT.md design)
  - **F** — Cinematic timing + cliclability (3s Beat 2, pulse 1.5s, z-index 200, touchAction)
- i18n verification section (check-translations + RU/EN/ES spot checks)
- Build chain section (tsc + vite + check-bundle)
- Regression sanity section (cosmos gate, other modals, OnboardingController, frog.container.alpha invariant, no Lottie)
- Reporting protocol (scenario letter + step + snapshot + console errors + network payload)

Pattern закопирован с `SMOKE_TEST_23.md` (numbered scenarios + `[ ]` checkboxes + dev helper callouts + i18n + build chain).

### Task 3 — ROADMAP + STATE finalize (часть commit'а `de04083`)

**`.planning/ROADMAP.md`:**

- Заменил `**Requirements**: TBD` на `**Requirements:** PHASE24-STATE, …, PHASE24-FINALIZE` (17 REQ IDs).
- Заменил `Plans: 0 plans` + TBD placeholder на список 5 plans с `[x]` checkmarks.
- Добавил **Outcome** paragraph: «5-beat cinematic при первом L18+L18 normal merge.
  Idempotent via captainBirthSeen (server-syncable, legacy-migrated). Bundle delta
  +3.79 KB gzip (cap +20 KB). i18n RU/EN/ES parity. Dev helpers …»
- Обновил `Last updated: 2026-05-18 — Phase 24 complete (5 plans)`.

**`.planning/STATE.md`:**

- Frontmatter: `current_phase 23→24`, `completed_phases 2→3`, `total_plans 31→36`,
  `completed_plans 19→24`, `percent 61→67`, `last_updated 2026-05-18T23:30:00Z`.
- Phase Progress table: новая строка для Phase 24 (после Phase 23) с полной outcome-карточкой
  (waves, plans, REQ count, дизайн pattern reuse, bundle delta, key files, idempotency story).
- Новая секция **«Phase 24 (closed) — Performance Metrics»** в конце файла:
  - wave-by-wave таблица (5 plans, 11 commits total, 6 created + 14 modified, +3.79 KB gzip)
  - REQ coverage line (17/17 PHASE24-*)
  - outcome paragraph
  - **Plan 24-05 Decisions Logged** (8 пунктов — install location, replay-safe trigger,
    MainScene cast pattern, snapshot table layout, i18n no-op, SMOKE pattern reuse,
    backdrop≡CTA, ROADMAP finalize)

---

## Verification

```bash
cd client
npx tsc --noEmit                    # TypeScript compilation completed (0 errors)
npm run check-translations          # OK: all 337 keys present in RU/EN/ES
npm run build                       # ✓ built in 4.11s
npm run check-bundle                # OK: Bundle delta 3.79KB within cap 50KB
```

**Bundle measurement:**

- Baseline (v1.0): 196.00 KB gzip
- Phase 24 final main `index-BknaZWD5.js`: 199.88 KB gzip
- **Delta vs Phase 23 (≈198.65 KB gzip): +1.23 KB gzip** (delta only Phase 24 contributions)
- **Delta vs v1.0 baseline: +3.79 KB gzip** (cap 50 KB; well under +20 KB Phase 24 target)
- Lazy `CosmicHubModal-CIWq-G0i.js` chunk preserved (12.84 KB gzip)

**Manual DEV helper smoke (Console):**

```js
__captainBirthState()      // console.table snapshot
__triggerCaptainBirth()    // emits captain:birth-start in cam center
__resetCaptainBirth()      // clears flag + reload
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Global `__mainScene` declare break ломал TS типизацию в devCarriers/OnboardingController/MainScene**
- **Found during:** Task 1 (после первого `tsc --noEmit`).
- **Issue:** Глобальное объявление `interface Window { __mainScene?: unknown }` в `captainBirthDevHelpers.ts` (как написано в плане Action A) сделало тип `__mainScene` глобально `unknown`, что сломало `devCarriers.ts` (calls `.spawnFrog`, `.performMerge`, `.cameras.main`), `OnboardingController.tsx` (uses `MainScene` type), `MainScene.ts` (assigns `this`). 28 TS errors.
- **Fix:** Убрал `__mainScene` из глобального `declare`, оставил только `__triggerCaptainBirth/__resetCaptainBirth/__captainBirthState`. MainScene ref читаю через local cast `window as unknown as { __mainScene?: MainSceneCameraRef }` — pattern идентичный `OnboardingController.tsx:94` и `devCarriers.ts:113`.
- **Files modified:** `client/src/utils/captainBirthDevHelpers.ts`.
- **Commit:** `ce0b9e8` (исправлено до commit'а — единый file state).

### Tracking-only (no code change)

**2. [Plan no-op] `client/src/i18n/index.ts` не модифицирован**
- Plan frontmatter `files_modified` listed `i18n/index.ts` как possible-change. На execution: `check-translations` уже показал 337/337 PASS, `tsc` чист. Файл не нужно трогать. Документировано в SUMMARY.md и в STATE.md decisions log.

### Threat Flags

None. Phase 24 не добавляет network endpoints, auth paths, file access patterns, или schema changes за пределами того что Plan 24-01 уже зарегистрировал (`captainBirthSeen` field в cosmic JSON blob — уже в server-sync контракте через `loadGameState/syncGameState`).

---

## Auth Gates

None.

---

## Open Knobs (для playtest closure)

Playtest должен подтвердить или скорректировать:

- **Beat 2 cinematic duration (~3s)** — `CaptainBirthEffect.ts` использует timeline
  particles + 3 rings + camera zoom. Если ощущается «слишком долго / слишком коротко»,
  тюнить через timeline durations в effect.
- **Particle count (~70 golden/white/cyan)** — балансировать density vs mobile FPS
  на bottom-end devices. Если frame drops наблюдаются на iOS Safari, уменьшить count
  или отключить cyan tint.
- **Modal на маленьких экранах (iPhone SE-ish)** — frog SVG + title + subtitle + CTA
  стек по vertical; на 320×568 может задеть safe area. Manual smoke Scenario F item
  «не выходит за safe area» — критерий для accept.
- **Backdrop dismiss intent** — Scenario E проверяет что click на backdrop = CTA tap
  (per CONTEXT.md). Если playtest показывает что игроки ожидают «закрыть = пропустить
  без open Star Map», это design change → отдельный plan.
- **Beat 5 auto Star Map** — если игрок ещё не on farm location (например в Cosmic Hub
  во время L18+L18 cheat path), auto-open Star Map может быть jarring. Production
  path (через normal play) гарантирует он на farm, но dev triggers могут вызвать
  edge case.

---

## Phase 24 Closure

| Aspect | Value |
|--------|-------|
| Total plans | 5 (24-01 .. 24-05) |
| Total commits | 11 (feat × 7 + docs × 4) |
| Files created | 6 (CaptainBirthEffect, CaptainBirthModal + CSS, captainBirthController, captainBirthDevHelpers, SMOKE_TEST_24) |
| Files modified | 14 (gameStore, persistence, gameSync, eventBus, MainScene, MergeController, App, i18n × 3, ROADMAP, STATE, 24-X-SUMMARY × 5, captain.css) |
| Bundle delta gzip | +3.79 KB (cap +20 KB ✓; cap +50 KB v1.0 baseline ✓) |
| i18n keys | 337/337 RU/EN/ES PASS |
| REQ coverage | 17/17 PHASE24-* ✓ |
| Vitest | inherits Phase 23 baseline (97/97) — Phase 24 не добавил unit specs (event-driven cinematic тестируется через SMOKE) |
| TSC | clean |
| Vite build | clean (4.11s) |
| SMOKE scenarios | 6 (A-F) |

**Status:** ✅ Phase 24 готов к close (status: complete) в planning workflow.

---

## Self-Check: PASSED

- [x] `client/src/utils/captainBirthDevHelpers.ts` exists
- [x] `client/src/App.tsx` contains `installCaptainBirthDevHelpers` (2 matches: import + call)
- [x] `.planning/phases/24-captain-creation-cinematic/SMOKE_TEST_24.md` exists (259 lines)
- [x] `.planning/ROADMAP.md` Phase 24 entry shows 5 plans + 17 PHASE24-* requirements
- [x] `.planning/STATE.md` contains Phase 24 row + Performance Metrics section
- [x] commit `ce0b9e8` present in git log (`feat(24-05): captain birth dev helpers + App wire`)
- [x] commit `de04083` present in git log (`docs(24-05): SMOKE_TEST_24 + finalize Phase 24 in ROADMAP/STATE`)
- [x] tsc clean, check-translations 337/337 PASS, vite build clean, bundle delta +3.79 KB within cap
