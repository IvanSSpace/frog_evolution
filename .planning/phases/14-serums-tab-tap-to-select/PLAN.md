---
phase: 14-serums-tab-tap-to-select
plan: 00
type: execute
wave: planning
depends_on:
  - 11-cosmicslice-cosmic-hub-shell
  - 12-frog-element-overlay-dormant
  - 13-element-awakened-tiers
autonomous: true
requirements:
  - SERUM-02
  - SERUM-03
  - SERUM-04
  - SERUM-05
  - SERUM-06
  - SERUM-07
  - SERUM-08
  - SERUM-09
  - SERUM-10
  - SERUM-11
  - UX-07

phase_goal: |
  Functional Сыворотки tab with inventory grid + tap-to-select primary flow that
  applies a serum to an eligible frog with auto-pause of magnet/merge, snap radius,
  haptic feedback, undo toast, and desktop pointer-event DnD as secondary mode.
  After this phase the player can use serums (boxes still come from dev-panel; real
  boxes arrive in Phase 15).

source_artifact_audit:
  goal_coverage:
    - "Functional Сыворотки tab with inventory" → Plan 14-02 (SerumsTab UI + 4 sections)
    - "Tap-to-select primary flow" → Plan 14-03 (selection mode + EventBus + apply)
    - "Auto-pause of magnet/merge" → Plan 14-03 (serumDragActive subscriber in MainScene)
    - "Snap radius / haptic feedback" → Plan 14-03 (snap tap radius + haptics on hover)
    - "Undo toast" → Plan 14-04 (success toast with action handler)
    - "Desktop pointer-event DnD secondary" → Plan 14-04 (custom Pointer Events + ghost)
  req_coverage:
    SERUM-02: Plan 14-02 (UI 4 sections by rarity)
    SERUM-03: Plan 14-03 (tap-to-select primary apply)
    SERUM-04: Plan 14-03 (snap radius 80px)
    SERUM-05: Plan 14-03 (drop zone glow + haptic medium / red outline + error)
    SERUM-06: Plan 14-01 + 14-03 (serumDragActive flag + MainScene auto-pause)
    SERUM-07: Plan 14-03 (mis-tap toast)
    SERUM-08: Plan 14-01 (eligibility table common→L1, rare→L7, epic→L13, legendary→L19)
    SERUM-09: Plan 14-03 (2s tween apply)
    SERUM-10: Plan 14-04 (undo toast 4s)
    SERUM-11: Plan 14-04 (desktop Pointer Events DnD secondary)
    UX-07: Plan 14-03 + 14-04 (haptic on every key action)
  context_coverage:
    "Tap-to-select primary": Plan 14-03 (tap is primary; pointer-events DnD is secondary)
    "Custom Pointer Events (no react-dnd)": Plan 14-04 (raw addEventListener pointermove/up)
    "Auto-pause magnet/merge": Plan 14-03 (MainScene reads serumDragActive)
    "Hard cap 4 visible overlay": already enforced by FrogOverlayManager (Phase 12) — no change
  unplanned_items: []
---

# Phase 14 — Сыворотки tab + tap-to-select DnD apply

> **Master plan для Phase 14.** Этот файл — индекс. Конкретные задачи находятся
> в `14-01-PLAN.md` … `14-04-PLAN.md`. Запускать через `/gsd-execute-phase 14`.

## Goal

Реализовать **полноценный flow применения сыворотки**: SerumsTab показывает
инвентарь (4 секции по rarity), tap на сыворотку → ферма входит в selection
mode → подсветка eligible лягушек → tap на eligible → 2-сек pulse → carrier
создан в `cosmicSlice.carriers`. Magnet и merge паузятся во время выбора. Mis-tap
выдаёт error toast. Optional undo toast 4 сек после применения. Desktop DnD
secondary mode через custom Pointer Events.

После Phase 14 carrier'ы создаются через нормальный UX-путь (а не только
dev-helper'ом из Phase 12-13).

## Context (что уже есть)

- **Phase 11 (готово):** `cosmicSlice` с serums Record + carriers array, eventBus
  `'cosmic:toast'` + grouped toast subscriber в `App.tsx`, lazy CosmicHubModal,
  SerumsTab stub.
- **Phase 12 (готово):** `FrogOverlayManager` подписан на `carriers` через
  `useGameStore.subscribe` — добавление carrier автоматически рисует overlay.
  Hard cap 4 visible enforced by manager.
- **Phase 13 (готово):** awakened tier presets + `burstEffect` + `mergeEffect`.
  Tier выбирается из `carrier.rarity` (dormant tier для свежесозданного carrier
  — мы создаём с `rarity` = серум rarity, ⇒ overlay сразу awakened-tier).
  *Уточнение:* для соответствия CARRIER-01..02 (carrier dormant) рисуем
  pulse-anim 2 сек + tier rises через progressive feed в Phase 17. Phase 14
  создаёт carrier с `rarity` = серум rarity напрямую (overlay сразу tier-визуал).
- **MainScene:** `frogs: FrogData[]` с `id: string`, `level: number`. Magnet
  логика в `updateMagnets`/`spawnMagnet`, gated через `magnetEnabled`. Merge —
  `findMergeTarget`/`performMerge`. `eventBus.emit('cosmic:toast', ...)`.
- **utils/telegram.ts:** `hapticImpact('light'|'medium'|'heavy')`,
  `hapticNotification('error'|'success')`, `hapticSelection()`. Новый
  `utils/haptic.ts` НЕ нужен — переиспользуем существующие.

## Plans (4 plan'а, 3 wave'а)

| Plan | Wave | Тема | Tasks | Файлы |
|------|------|------|-------|-------|
| 14-01 | 1 | Foundation: types, eligibility utility, store actions | 3 | 3 modified |
| 14-02 | 1 | SerumsTab UI: 4 секции + ElementGrid + select | 2 | 2 created + 1 modified |
| 14-03 | 2 | MainScene selection mode + apply 2s pulse + mis-tap | 3 | 1 created + 1 modified |
| 14-04 | 3 | Undo toast + Desktop Pointer Events DnD + dev helpers + i18n + verify | 3 | ≤6 modified |

### Wave Structure (parallelism)

```
Wave 1: 14-01 (store/util) ║ 14-02 (UI) — нет file conflicts
        ↓
Wave 2: 14-03 (MainScene + apply) — depends on 14-01 actions + 14-02 select event
        ↓
Wave 3: 14-04 (polish) — depends on 14-03 selection mode
```

**Файловые конфликты (исключают параллелизм):**
- 14-01 modifies `cosmic/slice.ts`, `cosmic/types.ts` — только foundation
- 14-02 creates `SerumsTab.tsx` rewrite + `ElementGrid.tsx` — не trogает store
- 14-03 modifies `MainScene.ts` (новые приватные методы), creates
  `utils/serumEligibility.ts` (если не сделан в 14-01 — мы его кладём в 14-01)
- 14-04 modifies `MainScene.ts` (Pointer Events DnD) — sequential after 14-03
  (overlap files_modified ⇒ wave +1)

## Architecture Mandates

### Eligibility table (locked, REQ SERUM-08)

| Rarity | Required level | Required location |
|--------|-----------|---------------|
| common | L1 | Болото |
| rare | L7 | Лес |
| epic | L13 | Континент |
| legendary | L19 | Планета |

**Дополнительно:** `frog` НЕ должен уже быть carrier (т.е. `carriers.find(c => c.frogId === frog.id) === undefined`).

### Selection mode lifecycle

```
[Закрыто Cosmic Hub] OR [тап на серум]
   |
   v
SerumsTab onTapSerum(element, rarity)
   ├─ count ≤ 0 → return (visual disabled)
   └─ count > 0 →
       1. eventBus.emit('cosmic:select-serum', { element, rarity })
       2. setSerumDragActive(true) — store
       3. close CosmicHub modal (UX: не оставлять modal поверх)
       4. hapticImpact('light')

MainScene.subscribe(serumDragActive=true)
   ├─ pause magnet (флаг checked в spawnMagnet/updateMagnets call sites)
   ├─ pause merge (флаг checked в performMerge / onFrogTapped)
   ├─ для каждого frog где isEligible(frog, element, rarity, carriers) →
   │    нарисовать зелёный halo (Phaser.Graphics в frog.container, depth -1)
   └─ override frog tap handler — вместо merge/coin → applySerum или mis-tap

frog tapped (с активным serum):
   ├─ eligible → applySerum(frog, element, rarity)
   │    ├─ 2-сек tween: scale 1 → 1.15 → 1, ease 'Sine.easeInOut', yoyo
   │    ├─ paral burstEffect(scene, container, element) at midpoint (1с)
   │    ├─ removeSerum(element, rarity, 1)
   │    ├─ addCarrier({ frogId, element, rarity, feedCount: 0, stabilized: false, level })
   │    ├─ hapticNotification('success')
   │    ├─ setSerumDragActive(false) — закрывает selection
   │    └─ eventBus.emit('cosmic:toast', { type: 'serum-applied', msg: 'Применена',
   │         action: { label: 'Откатить', onClick: () => undoApply(...) } })
   └─ mis-tap (frog не eligible):
        ├─ red outline pulse 200ms
        ├─ hapticNotification('error')
        └─ eventBus.emit('cosmic:toast', { type: 'generic',
             msg: t('serums.mis_tap_msg', { level: required, location: req_loc }) })
        — selection mode остаётся active, юзер может попробовать другую лягушку

Cancel selection (тап вне frog'и в free space):
   └─ setSerumDragActive(false) → manager автоматически снимает halo'ы
```

### Snap radius (REQ SERUM-04)

Tap-to-select не использует snap radius напрямую (юзер должен попасть в самого
frog). Но при desktop DnD (Plan 14-04) — radius используется чтобы pointer
рядом с лягушкой считался "над лягушкой": `Phaser.Math.Distance.Between(pointer, frog) < 80 * DPR`.

### Auto-pause магнита/мерджа (SERUM-06)

В `MainScene.update()` обернуть magnet spawn/update в:
```ts
if (!useGameStore.getState().serumDragActive) {
  // ...existing magnet logic...
}
```

В `onFrogTapped(frog, ...)`:
```ts
if (useGameStore.getState().serumDragActive) {
  // вызвать selection-mode handler вместо обычного merge/coin
  return this.handleSerumTap(frog, tapX, tapY)
}
// ...existing merge/coin logic...
```

### CosmicSlice новые actions (SERUM-06, SERUM-09)

```ts
// types.ts:
export interface CosmicSlice {
  ...existing...
  serumDragActive: boolean  // SERUM-06
  selectedSerum: { element: Element; rarity: Rarity } | null  // payload в момент selection
}

// slice.ts:
setSerumDragActive: (active: boolean, payload?: { element: Element; rarity: Rarity } | null) => void
applySerum: (frogId: string, element: Element, rarity: Rarity, level: number) => void
  // - decrement serums[element][rarity] на 1 (use existing removeSerum semantics)
  // - addCarrier({ frogId, element, rarity, feedCount: 0, stabilized: false, level })
  // - setSerumDragActive(false)
  // (CarrierData уже имеет optional level — Phase 12 отметил как Phase 17 use)
```

**carriers shape:** Phase 11/12/13 shipped as `CarrierData[]` (array). Не меняем
на Record — слишком инвазивно, manager уже подписан на reference equality
(`state.carriers !== lastSnapshot`). Поиск carrier по frogId — `find`, O(n) при
n ≤ 30 frogs OK.

### Eligible frog highlight

В MainScene класс `SerumSelectionLayer`:
- На `serumDragActive=true`: для каждого `isEligible(...)` frog добавить
  `Phaser.GameObjects.Graphics` (зелёный halo с lineStyle + сoftpulse via
  yoyo tween scale 1.0↔1.1, repeat -1).
- На `serumDragActive=false`: уничтожить все graphics, kill tweens.
- Cleanup в `MainScene.shutdown()` (REQ INFRA-06).

**Не используем `compHaloFlash`** — он принимает `AnimSys` и предназначен для
StarMap planet effects. Простая standalone Graphics эффективнее.

### Bundle delta cap

Phase 13 baseline = **209.45 KB gzip**. Phase 14 cap = **+20 KB gzip**.
Реалистичная цель: **+8-15 KB** (UI 4 секции + selection mode + DnD layer).

## Success Criteria (Phase-level, проверяется в 14-04)

1. **tsc clean, build passed**, bundle delta ≤ +20 KB gzip vs Phase 13 baseline (209.45 KB).
2. **SerumsTab показывает inventory** с 4 секциями. При пустом inventory — placeholder «Нет сывороток. Откроется в Phase 15.»
3. **Dev**: `__addSerum('fire', 'common', 1)` → открыть Cosmic Hub → таб
   «Сыворотки» → tap на cell `fire/common` → ферма видит зелёный halo на L1 frog'ах.
4. **Tap на L1 frog** (не carrier) → 2-сек pulse animation → carrier created →
   element overlay появляется (через FrogOverlayManager Phase 12) → toast «Применена».
5. **Tap на L2+ frog** во время selection → red outline pulse + error toast
   «Эта сыворотка работает только на L{N} лягушку».
6. **Magnet** не спавнится во время selection mode (`magnetSpawnMs` не
   накапливается). **Merge** не происходит при тапе/драге frog'и.
7. **Cancel selection** (тап в пустое место) → magnet/merge возобновляются,
   зелёные halo'ы скрываются.
8. **Undo toast** (если включено) — тап на «Откатить» → carrier удалён, серум
   возвращён в inventory.
9. **Desktop**: drag-mouse-down на серуме → ghost element следует за курсором,
   drop на eligible frog → applies; drop в пустое место → returns.
10. **Haptics:** `light` на select serum, `medium` на valid hover (DnD),
    `error` на mis-tap, `success` на apply.

## Threat Model (security_enforcement enabled)

### Trust Boundaries

| Boundary | Описание |
|----------|----------|
| React → Phaser | Tap event из SerumsTab вызывает store action; Phaser scene субскрайбится через `useGameStore.subscribe` |
| Phaser → React | `eventBus.emit('cosmic:toast', ...)` доставляет message в App.tsx render layer |
| localStorage → store | persisted `serums`, `carriers` могут быть подделаны |

### STRIDE Threat Register

| ID | Категория | Component | Disposition | Mitigation |
|----|-----------|-----------|-------------|------------|
| T-14-01 | **Tampering** | `cosmicSlice.serums` | mitigate | Phase 11 уже валидирует Record shape при load; `applySerum` reads `serums[element][rarity]` через type-safe getter; если value < 1 → no-op (existing `removeSerum` clamps на 0) |
| T-14-02 | **Tampering** | `selectedSerum` payload может приходить из mod'нутого client | mitigate | `applySerum` повторно валидирует `isEligible(frog, element, rarity, carriers)` перед mutation — single source of truth, не верит payload |
| T-14-03 | **Spoofing** | Mock `frogId` в applySerum (создание carrier'a без живой лягушки на сцене) | accept | Single-player local game, нет economic value. `FrogOverlayManager` тихо skip'нет carrier без matching frog (Phase 12 поведение). |
| T-14-04 | **Denial of Service** | Spam tap во время selection → memory leak от halo Graphics | mitigate | `SerumSelectionLayer.cleanup()` обязан killTweensOf + destroy; debounce reactive subscribe (mark dirty + apply на next tick); tested через 100-tap stress в smoke |
| T-14-05 | **Information Disclosure** | Logging `selectedSerum` в console | accept | Inventory не secret в single-player. Dev logs gated `import.meta.env.DEV` (Phase 12 pattern). |
| T-14-06 | **Repudiation** | Случайно применил серум → нет undo | mitigate | SERUM-10: undo toast 4 сек с `onClick: undoApply` (см. Plan 14-04) |
| T-14-07 | **Elevation of Privilege** | Skip 2s pulse чтобы быстрее crafting → no economic gain | accept | Single-player; pulse — UX, не gating. Мerge тоже не gated в v1.0. |

## Plan Index

См. отдельные файлы:

- `14-01-PLAN.md` — Foundation: types extension, eligibility utility, store actions
- `14-02-PLAN.md` — SerumsTab UI: 4 sections + ElementGrid + select EventBus
- `14-03-PLAN.md` — MainScene selection mode + apply 2s pulse + mis-tap
- `14-04-PLAN.md` — Undo toast + desktop Pointer Events DnD + dev helpers + i18n + verify

## Verification Strategy

Phase 14 верифицируется в плане 14-04 (последний task = full verify):

- `tsc --noEmit` → 0 errors
- `vite build` → success, bundle delta ≤ +20 KB gzip
- Manual smoke (REQ SERUM-02..11): dev-add fire/common, открыть Сыворотки, tap
  на серум, tap на L1 frog → carrier created. Tap на L2 → mis-tap toast.
- Manual smoke (UX-07): haptic light/medium/error/success на ключевых событиях
  (доказывается через `console.log` mock в `getTelegramWebApp().HapticFeedback`)
- Manual smoke (SERUM-06): magnet/merge замораживаются во время selection.
- Manual smoke (SERUM-11): desktop mouse drag → ghost → drop на eligible frog.

## Output

После завершения каждого plan'а — записать
`.planning/phases/14-serums-tab-tap-to-select/14-NN-SUMMARY.md` с:
- Что реализовано (REQ-IDs ✓ / ◑ / ✗)
- Bundle delta gzip (cumulative от Phase 13 baseline 209.45 KB)
- Atomic commits в формате `phase-14: <action>` (conventional)
- Smoke checklist results
- Open issues / known limitations

После Phase 14 — обновить `STATE.md` row 14 с finals.
