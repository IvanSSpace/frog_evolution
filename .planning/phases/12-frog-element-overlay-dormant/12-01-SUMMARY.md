---
phase: 12-frog-element-overlay-dormant
plan: 01
type: execute
wave: 1
status: complete
completed_at: 2026-05-08
requirements: [ELEMENT-01, ELEMENT-02, ELEMENT-03, ELEMENT-04, ELEMENT-05, ELEMENT-06, ELEMENT-07, ELEMENT-08, ELEMENT-12, PERF-02, PERF-03, PERF-06, PERF-09, I18N-01]
tags: [phaser, overlay, pool, perf-budget, i18n]
metrics:
  tasks_committed: 3
  files_created: 7
  files_modified: 5
  bundle_delta_gzip_kb: 2.53
  bundle_delta_cap_kb: 20.0
  duration_min: ~25
key_files:
  created:
    - client/src/game/effects/elements/types.ts
    - client/src/game/effects/elements/elementTints.ts
    - client/src/game/effects/elements/elementMapping.ts
    - client/src/game/effects/elements/dormantPresets.ts
    - client/src/game/effects/FrogElementOverlay.ts
    - client/src/game/effects/elementOverlayPool.ts
    - client/src/game/effects/FrogOverlayManager.ts
    - client/src/utils/devCarriers.ts
  modified:
    - client/src/game/scenes/MainScene.ts
    - client/src/store/cosmic/types.ts
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json
    - client/src/main.tsx
provides:
  - "FrogElementOverlay (Phaser Container) с attach/detach/setVisible/dispose API"
  - "elementOverlayPool singleton (acquire/release/drainAll/totalActive/totalPooled)"
  - "FrogOverlayManager — sync cosmicSlice.carriers + hard cap 4 + viewport culling каждые 6 кадров"
  - "ELEMENT_TINTS (16) + ARCHETYPE_TO_ELEMENT (12) + MAIN_RACE_TO_ELEMENT (6 ключей → 4 exclusives)"
  - "16 dormant idle-эффектов через Phase 9 primitives с минимальной интенсивностью"
  - "48 i18n строк (16 elements × 3 locales), все ≤12 chars"
  - "window.__addDevCarrier / __listFrogIds / __clearDevCarriers / __listDevCarriers (DEV-only, tree-shaken в prod)"
---

# Phase 12 Plan 01: FrogElementOverlay (dormant tier + pool + hard cap) — Summary

Установлен визуальный фундамент carrier-системы Cosmic Frogs: каждая carrier-лягушка
получает Phaser-native overlay (tint лягушки + орб над головой + одна idle-частица
раз в ~3 секунды) на dormant tier. Pool с acquire/release semantics избегает
destroy/create на каждый carrier-add/remove. Hard cap 4 visible + viewport
culling каждые 6 кадров обеспечивают PERF-02/03 budget headroom для Phase 13
awakened tiers.

## Что сделано

### Task 1 — Element constants + i18n (commit `39acfd5`)

- `elements/types.ts`: `ElementTier` (пока только `'dormant'`), `OverlayPresetParams`, `OverlayLifecycle`, re-export `Element`/`Rarity`/`ELEMENTS`.
- `elements/elementTints.ts`: 16 hex tint per ELEMENT-03 TINT TABLE (colorblind-safe Okabe-Ito + Krzywinski).
- `elements/elementMapping.ts`: `ARCHETYPE_TO_ELEMENT` (12 BG entries), `MAIN_RACE_TO_ELEMENT` (6 ключей → 4 exclusives), `elementFromPlanet()`, `archetypeForElement()` (reverse lookup для dormant presets).
- i18n RU/EN/ES: добавлен под-объект `cosmic_hub.elements` с 16 ключами, все ≤12 chars (48 строк суммарно).

### Task 2 — Overlay class + pool + 16 dormant presets (commit `d4238c8`)

- `dormantPresets.ts`: `scheduleDormantIdle(scene, container, element, opts?)` → `OverlayLifecycle`. Для каждого из 16 elements замаплен primitive из `effects/anim/shared/`:
  - fire→`compFlameTongues`, ice→`compIceWisps`, water→`compRipple`, forest→`compBloomPetals`, toxic→`compToxicCloud`, plasma→`compPlasmaArc`, shadow→`compHaloFlash`, crystal→`compCrystalShatter`, desert→`compSandSwirl`, gas→`compChromaShift`, ring→`compChimeRing`, binary→`compEchoWave`, arcane→`compStarBurst`, mechanical→`compConfetti`, war→`compFlash` (special signature без sys), void→`compBubbleStream`.
  - Минимальная интенсивность: `sys.size = 6`, `brightness = 0.4`, throttle interval по умолчанию 3000ms (`opts.throttle` для будущей Phase 20 INFRA-05 wiring).
  - Try/catch вокруг primitive вызова — крах одного preset не ломает сцену.
- `FrogElementOverlay`: Phaser Container с малым circle-орбом над головой (offset −32, radius 4, depth 50). attach() reparent'ит overlay внутрь host frog container, применяет tint к body, сохраняя prev tint для detach() restore. dispose() уничтожает container с children=true.
- `elementOverlayPool`: singleton ElementOverlayPool. acquire/release без destroy/create; drainAll() при scene shutdown.

### Task 3 — Manager + MainScene wiring + FrogData.id + dev helper (commit `44ce8b6`)

- `FrogOverlayManager`:
  - Subscribe на `useGameStore` carriers (reference equality — addCarrier/removeCarrier создают новый array).
  - `tick()` ➔ если dirty, `syncCarriers()`; каждые 6 кадров `applyCulling()`.
  - `syncCarriers`: пересечение carriers ↔ live frogs, валидация element ∈ ELEMENTS (T-12-01 mitigation), сортировка по distance to camera centre, top-4, release лишних, acquire новых.
  - `applyCulling`: `cam.worldView.contains(host.x, host.y)` → setVisible.
  - `dispose()`: unsubscribe + release всех + drainAll pool.
- `CarrierData.level?: number` опционально добавлено (для будущей Phase 17 эволюции).
- `MainScene.ts`:
  - `FrogData.id: string` (новое поле, генерируется в spawnFrog: `frog-${Date.now()}-${random6}`).
  - `private overlayManager: FrogOverlayManager | null = null`.
  - `create()`: создаём manager после `spawnLocationFrogs()`. В DEV — `window.__mainScene = this`.
  - `update()`: tick'аем manager в конце.
  - `destroy()`: dispose manager.
  - **Location transitions**: dispose manager в `onLocationChanged` ДО reparent старых лягушек в `oldContainer` (иначе `oldContainer.destroy(true)` уничтожил бы overlay containers, оставив pool с висячими ссылками). Re-create manager в `onComplete` после возврата лягушек в scene root. Также dispose+recreate в `clearField()` snap-cleanup.
  - `spawnFrog`: `overlayManager?.markDirty()` после push'а — re-sync если новая лягушка совпадает с существующим carrier.
- `devCarriers.ts`: `window.__addDevCarrier`, `__clearDevCarriers`, `__listDevCarriers`, `__listFrogIds` (DEV-only, gated by `import.meta.env.DEV` → tree-shaken в prod).
- `main.tsx`: `import './utils/devCarriers'` (side-effect для DEV).

### Task 4 — Smoke checkpoint (auto-approved per yolo mode)

Plan содержал `type="checkpoint:human-verify"` с `<resume-signal>yolo: auto-approve</resume-signal>`. Auto-approve per executor auto_mode_detection rules. Manual smoke (`npm run dev` + DevTools console) пользователь может выполнить независимо — все code-level и build-level проверки прошли.

## Bundle delta vs Phase 11 baseline

| Chunk | Phase 11 baseline gzip | Phase 12 gzip | Δ |
|-------|------------------------|---------------|---|
| `index-*.js` (main) | 205.34 KB | **207.87 KB** | **+2.53 KB** |
| `CosmicHubModal-*.js` | 0.98 KB | 0.98 KB | 0 |
| **Total Phase 12 delta** | — | — | **+2.53 KB gzip** (cap +20 KB ✓) |

Чанки `phaser`, `tone`, `vendor`, audio assets — без изменений.

Бюджет Phase 12 (≤+20 KB) использован на 12.7%. Остаток ~17.5 KB переходит в Phase 13 budget headroom для awakened tiers.

## REQ coverage table (14 requirements)

| REQ-ID | Coverage | Status | Notes |
|--------|----------|--------|-------|
| ELEMENT-01 | 16 elements в `ELEMENT_TINTS` | ✓ full | Task 1 |
| ELEMENT-02 | `ARCHETYPE_TO_ELEMENT` (12 entries) | ✓ full | Task 1 |
| ELEMENT-03 | TINT TABLE matches REQUIREMENTS exactly | ✓ full | Task 1 |
| ELEMENT-04 | 16 dormant анимаций (1/5 = 20% от 80) | ◑ partial | Phase 13 добавит 64 awakened (4 tiers × 16) — by design |
| ELEMENT-05 | `FrogElementOverlay extends/uses` Phaser Container, не DOM | ✓ full | Task 2 |
| ELEMENT-06 | `elementOverlayPool.acquire/release` без destroy/create per frame | ✓ full | Task 2 |
| ELEMENT-07 | `HARD_CAP_VISIBLE=4` + `CULL_FRAME_INTERVAL=6` | ✓ full | Task 3 |
| ELEMENT-08 | `throttle?` opt-in в `scheduleDormantIdle` + TODO Phase 20 INFRA-05 | ◑ stub | Hook present; full adaptive wiring deferred к Phase 20 |
| ELEMENT-12 | 4 exclusive elements в `MAIN_RACE_TO_ELEMENT` | ✓ full (mapping) | Main race миссии — Phase 16; mapping готов |
| PERF-02 | HARD_CAP_VISIBLE=4 — невозможно превысить через store | ✓ full | Task 3 |
| PERF-03 | viewport culling каждые 6 кадров | ✓ full | Task 3 |
| PERF-06 | tween count ≤60 budget при 4 visible (по design) | ✓ full (code-level) | Каждый dormant preset делает 1-8 tweens на тик; 4 × ≤8 = ≤32 ≤ 60 ✓ |
| PERF-09 | sanity benchmark — no FPS regression | ◑ partial | Code-level OK; full real-device benchmark deferred к Phase 13 (после awakened tiers — иначе тестируем не финальный воркер) |
| I18N-01 | 16 × 3 = 48 строк, все ≤12 chars | ✓ full | Task 1 verify-step prouva через node script |

**Summary:** 11 ✓ full, 3 ◑ partial (ELEMENT-04 by design — 64 awakened in Phase 13; ELEMENT-08 hook готов, full wiring к Phase 20; PERF-09 full benchmark deferred к Phase 13).

## Public API surface (для Phase 13+)

```typescript
// effects/elements/types.ts
export type ElementTier  // = 'dormant' (Phase 13 расширяет)
export interface OverlayLifecycle { dispose: () => void }

// effects/elements/elementTints.ts
export const ELEMENT_TINTS: Record<Element, number>  // 16 hex

// effects/elements/elementMapping.ts
export const ARCHETYPE_TO_ELEMENT: Record<string, Element>
export const MAIN_RACE_TO_ELEMENT: Record<string, Element>
export function elementFromPlanet(archetype, mainRaceType): Element | null
export function archetypeForElement(element): string

// effects/elements/dormantPresets.ts
export function scheduleDormantIdle(scene, container, element, opts?): OverlayLifecycle

// effects/FrogElementOverlay.ts
export class FrogElementOverlay {
  constructor(scene)
  attach(host, body, frogId, element): void
  detach(): void
  setVisible(v): void
  dispose(): void
  // readonly: container, element, tier, hostFrogId
}

// effects/elementOverlayPool.ts
export const elementOverlayPool: ElementOverlayPool
// .acquire(scene, element) → FrogElementOverlay
// .release(overlay)
// .drainAll()
// .totalActive, .totalPooled

// effects/FrogOverlayManager.ts
export class FrogOverlayManager {
  constructor(scene, getFrogs)
  tick(): void
  markDirty(): void
  dispose(): void
  // readonly: activeCount, poolStats
}
```

## Phase 13 dependencies (что Phase 13 получает)

- Overlay infrastructure готова: достаточно расширить `ElementTier` до `'dormant'|'common'|'rare'|'epic'|'legendary'` и добавить awakened presets рядом с `dormantPresets.ts` (например `awakenedPresets.ts`).
- Pool/manager — уже инфраструктурно готовы поддерживать любой tier (FrogElementOverlay.tier поле есть).
- 64 awakened animations можно добавлять файл-за-файлом без изменения core API.
- Bundle headroom: ≤17.5 KB gzip осталось из +20 KB cap.

## Known issues / Deferred

- **PERF-09 full real-device benchmark** — deferred к Phase 13 (после awakened tiers, чтобы тестировать финальный воркер; сейчас benchmark был бы по dormant only).
- **ELEMENT-04** — 64/80 анимаций отсутствуют (awakened tiers Phase 13 by design).
- **ELEMENT-08 throttle full wiring** — hook есть (`opts.throttle` на `scheduleDormantIdle`), но никто пока не передаёт adaptive factor. Phase 20 INFRA-05 свяжет с PerfHUD.
- **Smoke test через `npm run dev`** — не выполнен (yolo mode + executor inhibits interactive commands). Все code-level/build-level гарантии пройдены; manual smoke остаётся на пользователе.

## Verify outputs

```
$ cd client && npx tsc --noEmit
TypeScript compilation completed   ← clean (0 errors)

$ cd client && npm run build
✓ built in 4.56s
dist/assets/index-Cs_O9TrR.js  718.16 kB │ gzip: 207.87 kB
                                                  ← +2.53 KB vs 205.34 baseline ✓
```

i18n verify (48/48):
```
$ node -e "...const k=[16 elements]; for ru,en,es: assert e[x] exists && length<=12"
i18n OK 48/48
```

16 dormant presets verify:
```
$ grep '16 dormant presets OK' check.js → output: 16 dormant presets OK
```

## Self-Check

Verifying all created files and commits exist on disk and in git history.

| Artifact | Status |
|----------|--------|
| `client/src/game/effects/elements/types.ts` | FOUND |
| `client/src/game/effects/elements/elementTints.ts` | FOUND |
| `client/src/game/effects/elements/elementMapping.ts` | FOUND |
| `client/src/game/effects/elements/dormantPresets.ts` | FOUND |
| `client/src/game/effects/FrogElementOverlay.ts` | FOUND |
| `client/src/game/effects/elementOverlayPool.ts` | FOUND |
| `client/src/game/effects/FrogOverlayManager.ts` | FOUND |
| `client/src/utils/devCarriers.ts` | FOUND |
| commit `39acfd5` (Task 1) | FOUND |
| commit `d4238c8` (Task 2) | FOUND |
| commit `44ce8b6` (Task 3) | FOUND |

## Self-Check: PASSED

## Auto-approve checkpoint

Plan содержал `type="checkpoint:human-verify"` task. Согласно user-инструкции "Mode: yolo (без подтверждений)" + `<resume-signal>yolo: auto-approve` в plan — auto-approved per executor auto_mode_detection rules. Manual smoke steps (запуск `npm run dev`, тап по 🧬 → window.__addDevCarrier(...) → визуальный осмотр overlay над лягушкой) пользователь может выполнить независимо.
