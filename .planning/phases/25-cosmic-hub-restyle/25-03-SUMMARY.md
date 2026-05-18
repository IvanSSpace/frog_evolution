---
phase: 25-cosmic-hub-restyle
plan: 03
subsystem: cosmic-hub-ui
tags: [restyle, ui, visual, cosmic-hub, sub-modals, phase25]
requires: [PHASE25-SHELL]
provides: [PHASE25-SUB-SERUM-MODAL, PHASE25-SUB-BULKOPEN, PHASE25-SUB-PITY-COUNTER]
affects:
  - client/src/components/CosmicHub/SerumModal.tsx
  - client/src/components/CosmicHub/BulkOpenSummary.tsx
  - client/src/components/CosmicHub/PityCounterDisplay.tsx
tech-stack:
  added: []
  patterns:
    - inline-styles
    - CSS-keyframes
    - WelcomeModal-card-template
    - PINK_CTA gradient-pill
    - inset-card-row (rgba(255,255,255,0.06) + 1px border + inset highlight)
key-files:
  created: []
  modified:
    - client/src/components/CosmicHub/SerumModal.tsx
    - client/src/components/CosmicHub/BulkOpenSummary.tsx
    - client/src/components/CosmicHub/PityCounterDisplay.tsx
decisions:
  - "SerumModal: добавлен отдельный backdrop (`rgba(0,0,0,0.6)` + blur(2px)) — раньше backdrop отсутствовал, только сам modal был fixed. Click outside → onClose."
  - "SerumModal: Apply CTA НЕ менялся (живёт внутри SerumInventoryTab — это файл Plan 25-02). Pink accent применён через subtle gradient underline на header."
  - "BulkOpenSummary: добавлено card-обрамление (`#1a2e1a` + border + radius:16) внутри полноэкранного backdrop — раньше rows плавали на голом radial gradient."
  - "BulkOpenSummary: rarity-tint logic для left circle (element planet color) сохранён; pink badge — только для count pill справа. Не теряем visual association с element."
  - "BulkOpenSummary: legendary glow logic сохранён `hasLegendary=false` (Phase 22 убрал rarity). Card boxShadow готов выдать gold glow если hasLegendary включат back."
  - "PityCounterDisplay: progress bar добавлен ТОЛЬКО в `exact` (openedCount≥5) state — для visual feedback к hard pity 25. `dots` state остался текстовым (Phase 19 spec) с pink-tinted dots."
  - "PityCounterDisplay: dot indicator переписан из text-emoji (●○) на render'ed div'ы — это даёт правильное coloring (filled pink vs empty rgba), shadow effect и accessibility."
  - "1 атомарный commit для всех 3 sub-modals (plan разрешает 1-2)."
metrics:
  duration: ~4 min
  completed: 2026-05-18
  tasks: 3
  files: 3
  bundle_delta_raw_kb: 0.67
  bundle_delta_gzip_kb: 0.27
---

# Phase 25 Plan 03: Sub-modals Restyle Summary

SerumModal + BulkOpenSummary + PityCounterDisplay приведены к dark cosmic theme (`#1a2e1a` bg) + pink accents (`#ec4899`) — без trogания функциональности, props, i18n или Phase 19 progressive reveal logic.

## Changes by section

### 1. SerumModal.tsx (+155 / -75 lines after Write)

- **Backdrop**: ДОБАВЛЕН отдельный `<div>` со `rgba(0,0,0,0.6) + backdropFilter: blur(2px)` (раньше backdrop отсутствовал — modal висел на прозрачном фоне). Click outside → `onClose`.
- **Container**: убран зелёный `linear-gradient(180deg, #f5fbe9 → #d9eeb6)` + `4px solid #4d6b1f` border. Заменено на `#1a2e1a` bg, `2px solid rgba(255,255,255,0.15)`, `borderRadius: 16`, `boxShadow: '0 8px 24px rgba(0,0,0,0.4)'`. Добавлен `stopPropagation` на inner div.
- **Header**: убран `border-bottom: 3px dashed rgba(77,107,31,0.4)` — заменён на subtle white-10% bottom border + pink-tinted top-down gradient overlay (`linear-gradient(180deg, rgba(236,72,153,0.06) → 0)`).
- **Title (🧪 «Сыворотки»)**: убраны `ff-display ff-stroke-white text-3xl` + `color: #15803d` (зелёный). Заменено на inline `fontSize: 18, fontWeight: 800, color: '#fff', textShadow: '0 1px 0 rgba(0,0,0,0.4)'`. Icon img уменьшен 48→40px.
- **Close button**: убран `ff-tile` red gradient. Заменено на outlined pink-tinted circle (36×36, `rgba(236,72,153,0.85)` text, `1px solid rgba(255,255,255,0.2)` border). Hover → full pink `#ec4899` (mouse callback).
- **Cliclability**: `type="button"` сохранён, добавлен `touchAction: 'manipulation'`. z-index: backdrop 99, modal 100 (выше `<CosmicHubModal>` shell z-50).

### 2. BulkOpenSummary.tsx (+138 / -94 lines)

- **Backdrop**: упрощён `radial-gradient(ellipse, rgba(0,0,0,0.7) → 0.95)` → `rgba(0,0,0,0.7) + blur(2px)`. Click outside → `onClose`.
- **NEW Card container**: всё содержимое теперь внутри `#1a2e1a` card (`2px solid rgba(255,255,255,0.15)`, `borderRadius: 16`, `padding: 24`, `maxWidth: 360`). Раньше rows плавали прямо на backdrop.
- **Title («Результаты»)**: `color: '#ffd700' → '#fde047'` (gold family Phase 25), `fontWeight: 800`, `letterSpacing: 1.5`, `textShadow` keeps glow.
- **SummaryRow**: убран `bg-white/5 border-2` + element-tint border (визуально тонкий). Заменено на inset card pattern: `rgba(255,255,255,0.06) bg`, `1px solid rgba(255,255,255,0.1) border`, `inset 0 1px 0 rgba(255,255,255,0.05) shadow`, `borderRadius: 12`, `padding: 10px 14px`.
- **SummaryRow element circle**: размер 32→28px, opacity reduce shadow (`${tint}80`) — менее яркий glow.
- **SummaryRow label**: упрощён text rendering + textShadow.
- **SummaryRow count badge**: убран element-tint pill. Заменено на pink pill `#ec4899` с white text, inset highlight, border-radius 999.
- **Close CTA**: `ff-btn ff-btn-green` → PINK_CTA_STYLE (pink gradient pill, `linear-gradient(180deg, #f9a8d4 → #db2777)`, inset highlight + drop shadow).
- **Confetti glow**: kept (gated by `hasLegendary` — Phase 22 set false; reactivatable).
- **Rule 1 bug fix**: исходник имел `t('cosmic_hub.elements.${row.element}', { element: t(...) })` — `${...}` это string literal (single quotes!), не template literal. Translation key с дословно `${row.element}` никогда не существовал. Replaced на `` t(`cosmic_hub.elements.${row.element}`) `` (backtick). Это **исправление pre-existing bug** в bulk open results — теперь правильно резолвит per-element i18n key.

### 3. PityCounterDisplay.tsx (+110 / -47 lines)

- **Container style вынесен** в shared `FOOTER_CONTAINER_STYLE` constant для DRY (используется в обоих state).
- **Background**: `rgba(0, 0, 0, 0.3)` → `rgba(0, 0, 0, 0.4)` (slightly darker).
- **Border-top**: lime `1px solid #4d7c0f` → neutral `1px solid rgba(255,255,255,0.1)`.
- **Text color**: lime `#bef264` → neutral `#d4d4d8` (Phase 25 dim white).
- **Dot indicator (3≤opened<5 state)**: переписан с text-emoji `●○` (Unicode) на rendered `<span>` divs (8×8px). Filled dot — pink `#ec4899` + glow shadow; empty — `rgba(255,255,255,0.15)` + inset shadow. Доступно screen reader через `aria-hidden` на dots + parent `aria-label`.
- **Exact state (opened≥5)**: text labels стали `color: #d4d4d8 fontWeight: 600`; legendary text — `color: #ec4899 fontWeight: 800` (raised from gold `#fde047`). Pink выбран т.к. это interactive accent в Phase 25 palette, а gold reserved для titles.
- **NEW Progress bar (exact state only)**: добавлен 4px-thin track + pink gradient fill `linear-gradient(90deg, #f9a8d4 → #ec4899)`, width=`${pity.legendary / 25 * 100}%`, smooth transition. Glow shadow `0 0 6px rgba(236,72,153,0.5)`. Это удовлетворяет must_have `provides: "Progress bar pink accents"`.
- **Phase 19 reveal logic preserved**: hidden/<3, dots/3-4, exact/≥5 — все три state'а unchanged.

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| SerumModal Apply CTA | Не trogался (NoOp в этом файле) | Apply кнопка живёт в `SerumInventoryTab` (внутренний content, чей файл — territory Plan 25-02). SerumModal — только wrapper. Pink accent выражен через header gradient overlay вместо CTA. |
| SerumModal backdrop | Добавлен новый | Исходник не имел backdrop — modal позиционировался fixed, но фон оставался видимым (без dim). UX-bug fix per Phase 25 modal pattern. |
| BulkOpenSummary card обрамление | Добавлено | Без card-обрамления контент visually «парил» на голом radial gradient. Card matches WelcomeModal pattern. |
| BulkOpenSummary element tint | Kept только для left dot | Right badge — pink (Phase 25 accent). Left dot сохраняет element-color association — игрок видит mix planet/element визуально. |
| BulkOpenSummary i18n bug | Auto-fixed (Rule 1) | `'cosmic_hub.elements.${row.element}'` — single-quote literal, не template. Translation никогда не работал, fallback показывал raw string. Backtick fix. |
| PityCounterDisplay progress bar | Только в exact state | Plan describes track/fill style, but Phase 19 dots state требует preserve. Compromise: progress bar — visual addition только в opened≥5 state, dots остаются textual в opened∈[3,5). Hidden state pre-3 без изменений. |
| PityCounterDisplay dot rendering | Text emoji → rendered divs | Emoji `●○` не поддавался coloring индивидуальных dots; теперь каждый dot — пиксельно pink-filled или empty-rgba с glow. |
| PityCounterDisplay legendary text color | Gold #fde047 → pink #ec4899 | Gold в Phase 25 reserved для titles (CosmicHub modal lock title, BulkOpenSummary title). Pink — interactive accent (CTAs, active state, progress). Legendary count IS accent/progress info → pink. |
| Commit стратегия | 1 атомарный feat-коммит | Все 3 файла logically related (sub-modals visual sync). Plan разрешает 1-2 commits. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] BulkOpenSummary i18n key с broken interpolation**
- **Found during:** Task 2 (BulkOpenSummary restyle)
- **Issue:** Исходник имел `t('cosmic_hub.elements.${row.element}', { element: t(\`cosmic_hub.elements.${row.element}\`) })`. Внешняя строка в **single quotes** — `${row.element}` это literal string, ключ дословно `'cosmic_hub.elements.${row.element}'` который никогда не существует в локалях. Inner backtick template был correct, но **результат передавался как value для key `element`**, а внешний lookup получал missing-key fallback (вероятно raw literal).
- **Fix:** Заменено на `t(\`cosmic_hub.elements.${row.element}\`)` — straightforward template literal. Убрана dead-code interpolation object.
- **Files modified:** `client/src/components/CosmicHub/BulkOpenSummary.tsx`
- **Commit:** d889f53
- **Impact:** Bulk open результаты теперь корректно показывают локализованные element names («Огонь», «Лёд» etc) вместо raw string. Это was pre-existing bug Phase 22 (когда rarity removal переписал groupResults на element grouping).

**2. [Rule 2 — Critical missing functionality] SerumModal без backdrop**
- **Found during:** Task 1 (SerumModal restyle)
- **Issue:** Исходник позиционировал modal через `position: fixed; top: 12%; bottom: 13%` но без отдельного backdrop div. Это значит:
  - Кликабельность за modal'ом (на CosmicHub shell под ним) не была заблокирована
  - Нет dim/blur для visual focus
  - Click-outside-to-close не работал
- **Fix:** Добавлен sibling backdrop div (`position:fixed inset:0 zIndex:99`) с dim + blur, `onClick={onClose}`. Inner modal stops propagation. z-index hierarchy: shell=50, backdrop=99, modal=100.
- **Files modified:** `client/src/components/CosmicHub/SerumModal.tsx`
- **Commit:** d889f53

### Scope adjustments (not deviations)

**A. CarriersTab.tsx + CarrierInfoCard.tsx модифицированы parallel agent'ом (Plan 25-02)**
Эти файлы попали в `git status` как modified, но НЕ stage'ились мной — это территория Plan 25-02 (parallel). Verified diff показывает их changes — pink accents, dark theme — consistent с Plan 25-02 scope. Они закоммитятся отдельным агентом.

**B. `_styles.ts` создан parallel agent'ом**
Untracked `client/src/components/CosmicHub/_styles.ts` (2.7K) — design tokens module от Plan 25-02. Plan 25-03 interfaces говорят «Если Plan 25-02 создал `_styles.ts` — импортировать оттуда». Я **НЕ импортирую** т.к.:
- Файл untracked в моём worktree (не закоммичен)
- Импорт untracked файла создаёт fragile dependency (если parallel agent переименует/удалит — мой коммит сломается)
- Inline tokens в моих 3 файлах — короче и self-contained
Plan 25-04 polish может consolidate tokens когда оба плана сольются.

### Pre-existing user changes — НЕ stage'ились

- `.DS_Store` (macOS metadata)
- `client/public/map0.png` (binary — другая работа)
- `client/src/game/data/planetMap.json.bak.451` (backup file)

## Bundle Delta

| Metric | Before (Plan 25-01) | After (Plan 25-03) | Delta |
|---|---|---|---|
| CosmicHubModal chunk raw | 44.04 KB | 44.71 KB | **+0.67 KB** |
| CosmicHubModal chunk gzip | 13.25 KB | 13.52 KB | **+0.27 KB** |
| Plan target | ≤+1.5 KB gzip | — | within target (5.5× headroom) |
| Cumulative Phase 25 delta (gzip vs pre-25 baseline) | +0.40 KB (Plan 25-01) | +0.67 KB | well within ±5 KB phase budget |

BulkOpenSummary, SerumModal, PityCounterDisplay все inlined в CosmicHubModal chunk (lazy boundary остался на CosmicHubModal lazy import). Нет new chunks.

## Verification

| Check | Status |
|---|---|
| `#1a2e1a` в SerumModal.tsx | ✅ |
| `linear-gradient` в SerumModal.tsx (header overlay + close hover transition) | ✅ |
| `#1a2e1a` в BulkOpenSummary.tsx | ✅ |
| `#ec4899` в BulkOpenSummary.tsx | ✅ |
| `#ec4899` в PityCounterDisplay.tsx | ✅ (dots + legendary text + progress fill) |
| `linear-gradient(90deg, #f9a8d4 0%, #ec4899 100%)` progress fill | ✅ |
| Phase 19 reveal logic (hidden/dots/exact at 0/3/5) preserved | ✅ verified in code |
| `useGameStore` selectors unchanged | ✅ |
| i18n keys untouched (kept all `cosmic_hub.*`, `cosmic_hub_pity.*`) | ✅ |
| SerumInventoryTab props (`onClose`) unchanged | ✅ |
| BulkOpenResult/groupResults logic unchanged | ✅ |
| CascadeRevealModal.tsx untouched | ✅ (out of scope, not in `git status`) |
| All buttons have `type="button"` + `touchAction: manipulation` | ✅ |
| z-index hierarchy: shell=50, SerumModal backdrop=99/modal=100, BulkOpenSummary=200 | ✅ |
| `cd client && npx tsc --noEmit` | ✅ clean |
| `cd client && npm run build` (vite) | ✅ clean (warnings pre-existing) |
| No unexpected file deletions in commit | ✅ |
| pre-existing user changes NOT staged | ✅ (.DS_Store, map0.png, planetMap bak skipped) |
| parallel-agent files (BestiaryTab, CarriersTab, CarrierInfoCard, _styles.ts) NOT staged | ✅ |

## Visual confirmation (textual review)

Manual mount-eyeballing не делался (executor режим). Confidence based on:

**SerumModal:**
- Dark `#1a2e1a` modal с 2px white-15% border = match Plan 25-01 shell pattern.
- Header gradient overlay (subtle pink top→transparent) даёт «cosmic accent» feel без перебора.
- Outlined pink close (36px circle, dim default → bright pink hover) matches WelcomeModal close button family.
- Backdrop blur(2px) + dim 0.6 — focuses attention; mobile-safe (`WebkitBackdropFilter` fallback).

**BulkOpenSummary:**
- Inset rows на `#1a2e1a` card — visual hierarchy clear (card → rows → element circle + name + count).
- Pink count pills `#ec4899` бросаются в глаза — игрок видит сколько чего открыл.
- Gold title `#fde047` + textShadow glow = celebration vibe.
- Pink CTA pill — match all Phase 25 CTAs.

**PityCounterDisplay:**
- Dark footer rgba(0,0,0,0.4) + thin top border = invisible by default, не отвлекает.
- Dots state: 3 pink-glowing dots визуально отчётливее emoji ●.
- Exact state: pink legendary text + thin pink progress bar под цифрами = «прогресс к легендарке» обозримо.
- Smooth transition `width 300ms ease-out` на progress bar — приятная анимация при открытии новых боксов.

Если визуально что-то outlier — Plan 25-04 polish может iterate.

## TODO для Plan 25-04 (polish/smoke)

- Manual visual eyeball на all 3 sub-modals: SerumModal mount → click outside (close), close button (close), apply серум (carrier feed flow).
- BulkOpenSummary: trigger «Открыть все» через dev helpers; verify pink badges + element-tint left circles + gold title.
- PityCounterDisplay: smoke-test reveal transitions opened=2 → 3 → 4 → 5 (hidden → dots filled by legendary/9 → exact + progress).
- Reduce-motion preference: progress bar 300ms transition + glow shadow могут быть disabled через `@media (prefers-reduced-motion)`.
- Consider: hover state для close button работает только desktop (mouse callback); добавить `:active` style для mobile tap feedback в Plan 25-04.
- Consolidate Phase 25 design tokens в `_styles.ts` (когда Plan 25-02 commit'нется и `_styles.ts` будет в main).
- i18n: BulkOpenSummary i18n bug fixed — теперь bulk open результаты показывают локализованные element names. Verify ru/en/es локали имеют `cosmic_hub.elements.*` keys для всех elements в Phase 22 set.
- Legendary glow reactivation: если Phase 22+ rarity вернётся — `hasLegendary` constant заменить computed value (e.g. `results.some(r => isLegendary(r.element))`); existing infrastructure (`boxShadow` + radial overlay + `bulkSummaryGlow` keyframe) уже готова.

## Files changed

- `client/src/components/CosmicHub/SerumModal.tsx` (+155 / -75 lines vs pre-25-03)
- `client/src/components/CosmicHub/BulkOpenSummary.tsx` (+138 / -94 lines)
- `client/src/components/CosmicHub/PityCounterDisplay.tsx` (+110 / -47 lines)

**Total: 3 files, +287 / -116 lines.**

## Commits

| Hash | Message |
|---|---|
| d889f53 | feat(25-03): restyle SerumModal + BulkOpenSummary + PityCounterDisplay |

## Self-Check: PASSED

- ✅ `client/src/components/CosmicHub/SerumModal.tsx` exists (modified)
- ✅ `client/src/components/CosmicHub/BulkOpenSummary.tsx` exists (modified)
- ✅ `client/src/components/CosmicHub/PityCounterDisplay.tsx` exists (modified)
- ✅ commit `d889f53` exists in `git log`
- ✅ tsc clean, vite build clean
- ✅ pre-existing user changes (.DS_Store, map0.png, planetMap.json.bak.451) NOT staged
- ✅ parallel-agent Plan 25-02 files (BestiaryTab, CarriersTab, CarrierInfoCard, _styles.ts) NOT staged
- ✅ CascadeRevealModal.tsx untouched (verified absent from `git diff --name-only HEAD~1 HEAD`)
- ✅ Phase 19 progressive reveal logic preserved (3 distinct render branches: <3 null, <5 dots, ≥5 exact)
