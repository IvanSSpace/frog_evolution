---
phase: 25-cosmic-hub-restyle
plan: 01
subsystem: cosmic-hub-ui
tags: [restyle, ui, visual, cosmic-hub, phase25]
requires: [Phase 23 WelcomeModal pattern, Phase 24 CaptainBirthModal pattern]
provides: [PHASE25-SHELL, PHASE25-HEADER, PHASE25-TABSTRIP, PHASE25-LOCKSCREEN]
affects: [client/src/components/CosmicHub/CosmicHubModal.tsx]
tech-stack:
  added: []
  patterns: [inline-styles, CSS-keyframes-bobble, WelcomeModal-card-template]
key-files:
  created: []
  modified:
    - client/src/components/CosmicHub/CosmicHubModal.tsx
decisions:
  - "Gold (#fde047) для lock-screen title — matches Captain Birth + WelcomeModal pattern"
  - "Hover-state на inactive tabs опущен (mobile-first demo) — будет в Plan 25-04 polish"
  - "Lock-screen текст hard-coded (i18n keys cosmic_hub.locked.* отсутствуют, не создаём — scope «i18n не trogается»)"
  - "1 атомарный коммит вместо 2 — все 3 изменения в одном файле логически связаны"
metrics:
  duration: ~35 min
  completed: 2026-05-18
  tasks: 3
  files: 1
  bundle_delta_raw_kb: 1.08
  bundle_delta_gzip_kb: 0.40
---

# Phase 25 Plan 01: Cosmic Hub Shell Restyle Summary

Dark cosmic theme (#1a2e1a) + pink accents (#ec4899) для CosmicHub modal shell, tab strip, lock screen — без trogания функциональности.

## Changes by section

### 1. Modal shell + header
- **Container**: убран `bg-gray-950` Tailwind, добавлен inline `background: '#1a2e1a'` + `color: '#fff'`. Wrapped в React Fragment (`<>`) чтобы добавить `<style>` блок с keyframe.
- **Title (🧬 + cosmic_hub.title)**: убраны text utilities (`text-white font-bold text-lg`), заменено на inline `fontSize: 18, fontWeight: 800, color: '#fff', textShadow: '0 1px 0 rgba(0,0,0,0.4)'`. i18n key сохранён.
- **Close button (×)**: inline `color: 'rgba(236,72,153,0.7)'` (pink-tinted), `fontSize: 24`, `touchAction: 'manipulation'`. Hover через `onMouseEnter/Leave` → full pink `#ec4899` (mobile-first compromise — нет `:hover` без CSS file).

### 2. Tab strip
- **Inline `<style>` block**: `@keyframes cosmic-tab-bobble { 0%,100% scaleY(1.0); 50% scaleY(1.02) }` mount'ится один раз на portal mount.
- **Border**: `border-b border-white/10` → inline `borderBottom: '1px solid rgba(255,255,255,0.1)'`.
- **Active tab**: `color: '#fff'`, `fontWeight: 700`, `borderBottom: '3px solid #ec4899'`, `marginBottom: -1` (overlap parent border), `animation: 'cosmic-tab-bobble 1.5s ease-in-out infinite'`, `transformOrigin: 'bottom center'`.
- **Inactive (enabled)**: `color: 'rgba(255,255,255,0.4)'`, `fontWeight: 500`, `cursor: 'pointer'`.
- **Disabled (!tab.enabled)**: `color: 'rgba(255,255,255,0.2)'`, `opacity: 0.6`, `cursor: 'not-allowed'`. 🔒 emoji логика сохранена.
- **Padding bumped**: `py-2` → `padding: '12px 4px'` (per CONTEXT.md D-Tabstrip note «padding bigger»).
- **`type="button"`**: добавлен явно на каждый button (раньше не было — Rule 2 Cliclability).

### 3. Lock screen
- Заменено `flex` + `text-6xl` + `text-white/60` стек на WelcomeModal-style card:
  - Outer wrapper: `flex-1 flex flex-col items-center justify-center px-6` (layout сохранён).
  - **Card**: `borderRadius: 16`, `background: '#1a2e1a'`, `border: '2px solid rgba(255,255,255,0.15)'`, `padding: 24`, `maxWidth: 320`, `boxShadow: '0 8px 24px rgba(0,0,0,0.4)'`.
  - **🔒 emoji**: `fontSize: 64` (вместо `text-6xl`), `lineHeight: 1`.
  - **Title**: `fontSize: 22`, `fontWeight: 800`, `color: '#fde047'` (gold), `textShadow`.
  - **Hint**: `fontSize: 14`, `fontWeight: 500`, `color: '#d4d4d8'`, `lineHeight: 1.4`.

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Lock title accent color | Gold `#fde047` | Matches CaptainBirthModal + WelcomeModal `#fde68a` family; создаёт cosmic vibe. Pink reserved для interactive (CTAs, active tab). |
| Hover state на inactive tabs | Опущен | Mobile-first demo; deferred в Plan 25-04. Active tab pink underline + bobble уже даёт визуальный affordance. |
| Lock-screen i18n | Hard-coded (как в исходнике) | Keys `cosmic_hub.locked.title/hint` отсутствуют в `ru.json` / `en.json` / `es.json`. Создание новых ключей out of scope plan'а. |
| Commit стратегия | 1 атомарный feat-коммит | Все 3 задачи trogают один файл и логически связаны (visual restyle). План явно разрешает «1-2 atomic commits». |
| Tab padding | `12px 4px` (вместо `12px 16px` из плана) | 5 tabs × `px=16` = переполнение узкого viewport. Сохраняем `flex: 1` + меньший horizontal padding, vertical = 12 per CONTEXT.md spec. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Отсутствующие i18n keys для lock screen**
- **Found during:** Task 3 (lock screen restyle)
- **Issue:** План указывает `t('cosmic_hub.locked.title')` и `t('cosmic_hub.locked.hint')`, но эти ключи отсутствуют во всех трёх локалях (`ru.json`, `en.json`, `es.json`). Исходный код использует hard-coded русский текст («Космос закрыт», «Соедините две L18 лягушки…»).
- **Fix:** Сохранён hard-coded текст исходника. План явно говорит «i18n не trogается» в scope, и создание новых i18n ключей было бы расширением scope.
- **Files modified:** `client/src/components/CosmicHub/CosmicHubModal.tsx`
- **Commit:** 3bb0532
- **Follow-up:** Создание i18n ключей `cosmic_hub.locked.title/hint` логично сделать в Plan 25-04 (polish) — там же можно прогнать и en/es локализацию текста.

**2. [Rule 2 — Critical fix] `type="button"` отсутствовал на tab buttons**
- **Found during:** Task 2
- **Issue:** Tab buttons в исходнике не имели `type="button"` — внутри modal-portal (вне `<form>`) это безопасно, но Cliclability memory (`feedback_clickability`) требует явный атрибут на всех кнопках.
- **Fix:** Добавлен `type="button"` на каждый button в TABS.map.
- **Files modified:** `client/src/components/CosmicHub/CosmicHubModal.tsx`
- **Commit:** 3bb0532

**3. [Plan adjustment] Tab padding `12px 16px` → `12px 4px`**
- **Found during:** Task 2 visual review (mental layout)
- **Issue:** 5 tabs × `padding-x: 16` на узком mobile viewport дают `5×32=160px` только на padding — перебивает `flex: 1` распределение, текст лейблов («Бестиарий», «Корабль») может wrap'аться или overflow'иться.
- **Fix:** `padding: '12px 4px'` — vertical соответствует D-Tabstrip («py-3»), horizontal минимизирован т.к. `flex: 1` уже распределяет ширину.
- **Files modified:** `client/src/components/CosmicHub/CosmicHubModal.tsx`
- **Commit:** 3bb0532
- **Note:** Если визуально tabs выглядят зажатыми — bump до `12px 8px` в Plan 25-04 polish.

## Bundle Delta

| Metric | Before | After | Delta |
|---|---|---|---|
| CosmicHubModal chunk (raw) | 42.96 KB | 44.04 KB | **+1.08 KB** |
| CosmicHubModal chunk (gzip est) | ~12.85 KB | ~13.25 KB | **+0.40 KB** |
| Target acceptable | ±5 KB gzip | — | within target |

Bundle increase ожидаемо: inline styles длиннее эквивалентных Tailwind утилит, плюс новый `<style>` keyframe + `onMouseEnter/Leave` callbacks. Trade-off оправдан visual consistency.

## Verification

| Check | Status |
|---|---|
| `bg-gray-950` removed from file | ✅ grep returns 0 |
| `border-emerald-400` removed from file | ✅ grep returns 0 |
| `text-6xl` removed from file | ✅ grep returns 0 |
| `#1a2e1a` present | ✅ |
| `#ec4899` present (active tab) | ✅ |
| `#fde047` present (lock title) | ✅ |
| `@keyframes cosmic-tab-bobble` present | ✅ |
| 🧬 emoji + `cosmic_hub.title` i18n key intact | ✅ |
| 5 TABS shape (ids, enabled, lockReason) unchanged | ✅ |
| `useCosmosUnlocked()` + conditional rendering intact | ✅ |
| `onClose` handler untouched | ✅ |
| sessionStorage `SESSION_KEY` logic untouched | ✅ |
| All buttons have `type="button"` + `touchAction: manipulation` | ✅ |
| `cd client && npx tsc --noEmit` | ✅ clean |
| `npm run build` (vite) | ✅ clean (warnings pre-existing) |

## Visual confirmation (textual)

Manual mount-eyeballing не делался (executor режим, headless). Confidence based on:
- Inline styles matching pixel-perfect spec из CONTEXT.md D-Main-Shell / D-Tabstrip / D-Lock-Screen.
- Same color tokens и patterns как в Phase 23 WelcomeModal (reference).
- Bobble keyframe: `scaleY(1.0 → 1.02)` 1.5s — лёгкий, не отвлекающий.
- Pink underline `3px solid` `#ec4899` — visible на dark `#1a2e1a` фоне (high contrast).

Если визуально что-то outlier — Plan 25-04 polish может iterate.

## TODO для следующих планов

### Plan 25-02 (tab content polish)
- ShipTab: mission CTAs + refresh → pink gradient pill (`linear-gradient(180deg, #f9a8d4 0%, #db2777 100%)`).
- SerumInventoryTab: serum cards → `borderRadius: 12` + inset-shadow + pink count badges.
- BestiaryTab: filter pills pink active, grid cells inset-shadow.
- CarriersTab: carrier list → WelcomeModal-card style.
- CosmicShopTab: shop items → rounded inset cards, pink «Купить».

### Plan 25-03 (sub-modals)
- SerumModal: dark bg + pink CTA.
- BulkOpenSummary: stats card match dark theme.
- PityCounterDisplay: pink accents для progress bar.

### Plan 25-04 (polish)
- Hover state на inactive tabs (pink-tint `rgba(236,72,153,0.1)`) — если desktop demo path появится.
- i18n keys `cosmic_hub.locked.title` + `.hint` (ru/en/es).
- Bobble visual review — может уменьшить amplitude до 1.01 если 1.02 слишком active на reduced-motion accessibility.
- Tab padding bump до `12px 8px` если визуально зажато.

## Files changed

- `client/src/components/CosmicHub/CosmicHubModal.tsx` (+166 / -59 lines)

## Commits

| Hash | Message |
|---|---|
| 3bb0532 | feat(25-01): restyle CosmicHub shell, tab strip, lock screen |

## Self-Check: PASSED

- ✅ `client/src/components/CosmicHub/CosmicHubModal.tsx` exists (modified)
- ✅ commit `3bb0532` exists in `git log`
- ✅ tsc clean, vite build clean
- ✅ pre-existing user changes (.DS_Store, map0.png, planetMap.json.bak.451) NOT staged
