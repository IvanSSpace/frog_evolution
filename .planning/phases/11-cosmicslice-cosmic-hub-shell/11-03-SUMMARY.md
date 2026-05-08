---
phase: 11-cosmicslice-cosmic-hub-shell
plan: 03
type: execute
wave: 3
status: complete
completed_at: 2026-05-08
requirements: [COSMIC-HUB-04, COSMIC-HUB-05, COSMIC-HUB-06]
---

# Phase 11 Plan 03: Badge + Toast + i18n — Summary

Финализация Phase 11: реактивный badge на 🧬 (читает `boxes` из store), toast subscriber с multi-grouping за 1-секундное окно, i18n строки RU/EN/ES.

## Что сделано

1. **Reactive badge** в `BottomBar.tsx`:
   - Selector `useGameStore(s => s.boxes.filter(b => !b.opened).length)` пере-рендерит компонент при любом `addBox`/`openBox`.
   - При старте: 0 (boxes пустые).
2. **Toast infrastructure** в `App.tsx`:
   - Subscriber на `cosmic:toast` event (eventBus typed Phase 11-01).
   - Multi-grouping: 1-секундное sliding window, payloads буферятся, после window — один grouped toast с суммой `count`.
   - Action-кнопка в grouped toast — только если все события имеют одинаковый `action.label` (иначе ambiguity → action убирается).
   - Auto-hide через 4 сек.
   - `CosmicToast` компонент: bottom-center над BottomBar (z-index 60), кнопка action + "×".
3. **i18n RU/EN/ES** — секция `cosmic_hub` с 14 ключами:
   - `title`, `tab_scouts`, `tab_boxes`, `tab_serums`, `tab_bestiary`
   - `*_placeholder` × 4 для stub-табов
   - `toast_scout_returned`, `toast_scout_returned_plural`, `toast_open_box`, `toast_grouped`, `crew_tired`

## Ключевые решения

- **Sliding window grouping** (`clearTimeout` + `setTimeout` на каждый emit) вместо fixed window — лучшая UX: если события идут плотно, ждём дольше; если разрозненные — реагируем быстрее. COSMIC-HUB-06 формально требует grouping, sliding window — это тоже grouping.
- **Action de-duplication** — grouped toast показывает action только если ВСЕ events согласованы. Иначе "Открыть бокс" висит над agg-toast где половина — про скаутов.
- **Два таймера** (`toastTimerRef` для grouping window, `toastHideTimerRef` для auto-hide) — раздельны, чтобы можно было показывать второй grouped toast без задержки если первый уже скрылся.
- **Inline стили на `CosmicToast`** вместо Tailwind utility — Tailwind v3 может не подхватить кастомные `bottom-24` точно при наличии `13%` BottomBar; чище через inline `bottom: 'calc(13% + 16px)'`.

## Артефакты

| Path | Provides |
|------|----------|
| `client/src/ui/components/BottomBar.tsx` | Reactive badge selector reading `boxes` |
| `client/src/App.tsx` | `cosmic:toast` subscriber + multi-grouping + `CosmicToast` component |
| `client/src/i18n/{ru,en,es}.json` | `cosmic_hub.*` (14 keys) |

## Bundle stats (Wave 3 final)

| Chunk | Raw | Gzip | vs Phase 9 baseline |
|-------|-----|------|---------------------|
| `index-*.js` (main) | 711.01 KB | **205.34 KB** | +2.07 KB |
| `CosmicHubModal-*.js` | 2.91 KB | **0.98 KB** | new (separate chunk ✓) |
| **Total Cosmic delta** | — | **+3.05 KB gzip** | well under 15 KB cap ✓ |

CosmicHubModal — отдельный Vite chunk благодаря `React.lazy(() => import(...))`.

## REQ coverage Phase 11 (полный список)

- **SERUM-01** — 16 × 4 serums (64 ячейки) инициализированы в `makeInitialCosmicSlice()` ✓
- **COSMIC-HUB-01** — иконка 🧬 в BottomBar (Plan 02) ✓
- **COSMIC-HUB-02** — fullscreen modal с 4 табами ✓
- **COSMIC-HUB-03** — stub-табы Scouts/Boxes/Serums/Bestiary ✓
- **COSMIC-HUB-04** — reactive badge на 🧬 ✓
- **COSMIC-HUB-05** — toast subscriber через eventBus ✓
- **COSMIC-HUB-06** — multi-grouping в 1-секундном окне ✓
- **COSMIC-HUB-07** — sessionStorage persist последнего активного таба ✓
- **PERF-07** — отдельный Vite chunk через React.lazy ✓

## Phase 12 dependencies (что Phase 12 получает)

- `useGameStore().serums[element][rarity]` — read/write через `addSerum`/`removeSerum`
- `eventBus.emit('cosmic:toast', { type, msg, action })` — UI отображает автоматически
- `CosmicHubModal` — Phase 12 заполняет содержимое табов вместо stubs
- `STORAGE_VERSION = 16` — auto-wipe старых сейвов при apparent inconsistency

## Verify

- `npx tsc --noEmit` — clean
- `npm run build` — clean, отдельный CosmicHubModal chunk
- 14 cosmic_hub keys × 3 locales = 42 переводов, все совпадают по структуре
- Reactive badge selector компилируется без warnings

## Auto-approve checkpoint

Plan содержал `type="checkpoint:human-verify"` task. Согласно user-инструкции "Mode: yolo (без подтверждений)" — auto-approved per executor auto_mode_detection rules. Manual verify steps (запуск `npm run dev`, тап по 🧬, переключение табов, проверка sessionStorage и `localStorage[frog_evolution_storage_version] === '16'`) пользователь может выполнить независимо — все code-level проверки пройдены.
