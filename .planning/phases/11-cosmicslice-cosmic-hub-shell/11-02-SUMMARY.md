---
phase: 11-cosmicslice-cosmic-hub-shell
plan: 02
type: execute
wave: 2
status: complete
completed_at: 2026-05-08
requirements: [COSMIC-HUB-01, COSMIC-HUB-02, COSMIC-HUB-03, COSMIC-HUB-07, PERF-07]
---

# Phase 11 Plan 02: Cosmic Hub UI Shell — Summary

UI каркас Cosmic Hub: 🛍️ → 🧬 в BottomBar, lazy-loaded fullscreen modal с 4 stub-табами, sessionStorage persist последнего активного таба. Modal — отдельный Vite chunk.

## Что сделано

1. **`BottomBar.tsx`** — заменил `<Tile emoji="🛍️">` на `<Tile emoji="🧬" onClick={onOpenCosmicHub}>`. Tile.badge расширен до `number | boolean` (number → показывает число, boolean → "!"). Добавлен `onOpenCosmicHub?: () => void` в `BottomBarProps`.
2. **Создал директорию `client/src/components/CosmicHub/`** + 5 файлов:
   - `CosmicHubModal.tsx` — fullscreen modal, default-export для React.lazy
   - `ScoutsTab.tsx`, `BoxesTab.tsx`, `SerumsTab.tsx`, `BestiaryTab.tsx` — 4 stub-таба с эмодзи + i18n placeholder
3. **`App.tsx`** — добавлен `lazy(() => import('./components/CosmicHub/CosmicHubModal'))`, `cosmicHubOpen` state, `<Suspense fallback={null}>` обёртка, prop `onOpenCosmicHub` передан в `<BottomBar>`.
4. **sessionStorage persist** — `cosmic_last_tab` сохраняется при каждом `setActiveTab`; повторное открытие восстанавливает таб.

## Ключевые решения

- **`CosmicTab` валидация при load** в `getInitialTab()` — только 4 значения; иначе fallback `'scouts'` (T-11-05 mitigation).
- **`document.body.style.overflow` восстанавливается из `prev`** в cleanup, а не пустой строкой — устойчивость к вложенным modal (если когда-то понадобится).
- **`useTranslation()` внутри компонента** — TABS array объявлен внутри функции компонента (не на уровне модуля) — пере-рендерит при смене языка.
- **`Suspense fallback={null}`** — избегаем flash контента: пользователь видит как modal появляется только когда chunk полностью загружен.

## Артефакты + chunk

| Path | Provides |
|------|----------|
| `client/src/ui/components/BottomBar.tsx` | 🧬 tile, `onOpenCosmicHub` prop, `badge: number \| boolean` |
| `client/src/components/CosmicHub/CosmicHubModal.tsx` | Default-export fullscreen modal с 4 табами |
| `client/src/components/CosmicHub/{Scouts,Boxes,Serums,Bestiary}Tab.tsx` | Placeholder вкладки |
| `client/src/App.tsx` | `cosmicHubOpen` state, lazy import, Suspense |

**Chunk size после Wave 2:**
- `dist/assets/CosmicHubModal-C3DyXeOr.js` = 2.91 KB raw / **0.98 KB gzip** (отдельный chunk ✓)
- `dist/assets/index-DCuWVUUL.js` = 707.46 KB raw / 204.24 KB gzip (Wave 1 baseline 204.07 KB → +0.17 KB)

## Verify

- `npx tsc --noEmit` — clean
- `npm run build` — clean, CosmicHubModal chunk выделен отдельно
- `grep "🧬" src/ui/components/BottomBar.tsx` — найдено
- `grep "React.lazy\|cosmicHubOpen" src/App.tsx` — найдено (lazy import + state)
- `grep "cosmic_last_tab" src/components/CosmicHub/CosmicHubModal.tsx` — найдено

## Следующий шаг

**Plan 03 (Wave 3):** reactive badge на 🧬 (читает `boxes.filter(!opened).length`), toast subscriber + multi-grouping (COSMIC-HUB-06), i18n строки RU/EN/ES для cosmic_hub.*
