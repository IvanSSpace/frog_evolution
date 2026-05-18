---
phase: 25-cosmic-hub-restyle
plan: 02
subsystem: cosmic-hub-ui
tags: [restyle, ui, visual, cosmic-hub, phase25, tab-content]
requires: [PHASE25-SHELL (Plan 25-01)]
provides:
  - PHASE25-TAB-SHIP
  - PHASE25-TAB-SERUMS
  - PHASE25-TAB-BESTIARY
  - PHASE25-TAB-CARRIERS
  - PHASE25-TAB-SHOP
affects:
  - client/src/components/CosmicHub/ShipTab.tsx
  - client/src/components/CosmicHub/SerumInventoryTab.tsx
  - client/src/components/CosmicHub/BestiaryTab.tsx
  - client/src/components/CosmicHub/CarriersTab.tsx
  - client/src/components/CosmicHub/CarrierInfoCard.tsx
  - client/src/components/CosmicHub/CosmicShopTab.tsx
tech-stack:
  added: []
  patterns:
    - inline-styles
    - shared-design-tokens (_styles.ts)
    - WelcomeModal-card-template
    - LocationStack-pink-pill
key-files:
  created:
    - client/src/components/CosmicHub/_styles.ts
  modified:
    - client/src/components/CosmicHub/ShipTab.tsx
    - client/src/components/CosmicHub/SerumInventoryTab.tsx
    - client/src/components/CosmicHub/BestiaryTab.tsx
    - client/src/components/CosmicHub/CarriersTab.tsx
    - client/src/components/CosmicHub/CarrierInfoCard.tsx
    - client/src/components/CosmicHub/CosmicShopTab.tsx
decisions:
  - "Создан shared _styles.ts module вместо inline-копий констант в каждом файле (DRY)"
  - "CosmicShopTab: выбран чистый dark cosmic theme (НЕ pastel-green) для consistency со shell"
  - "Carrier dispose button: pink CTA mini variant вместо сохранения rose outline"
  - "Box count badge в SerumInventoryTab: gold (#fde047) — дифференцирует boxes от серумов (pink)"
  - "Currency values в ShopTab header цветные (essence=gold, serum=pink) — visual scanability"
  - "2 атомарных коммита: Task 1 отдельно, Task 2 + 3 в одном (4 файла одного visual pass)"
metrics:
  duration: ~5 min
  completed: 2026-05-18
  tasks: 3
  files: 7 (1 created + 6 modified)
  bundle_delta_raw_kb: 1.10
  bundle_delta_gzip_kb: 0.31
---

# Phase 25 Plan 02: Cosmic Hub Tab Content Restyle Summary

Polish 5 tab contents (Ship/SerumInventory/Bestiary/Carriers/Shop) — Tailwind color utilities заменены inline styles на shared design tokens; dark cards + pink gradient CTAs из LocationStack pattern.

## Changes by section

### 1. Shared design tokens (`_styles.ts` — NEW)

Создан общий module с 9 design tokens чтобы не дублировать константы в 6 файлах:

- **Colors:** `PINK` `#ec4899`, `PINK_LIGHT` `#f9a8d4`, `PINK_DARK` `#db2777`, `GOLD` `#fde047`, `TEXT_DIM` `#d4d4d8`, `TEXT_VERY_DIM` `rgba(255,255,255,0.4)`
- **Patterns:**
  - `DARK_CARD_STYLE` — borderRadius 12 + rgba(255,255,255,0.06) bg + 1px white/10% border + inset shadow
  - `PINK_CTA_STYLE` — linear-gradient(180deg, #f9a8d4 → #db2777) + 999 radius + inset+drop shadow (LocationStack pattern)
  - `PINK_CTA_MINI_STYLE` — same но 6px 12px padding + 12px fontSize
  - `DISABLED_CTA_OVERRIDES` — opacity 0.5 + cursor not-allowed
  - `PINK_BADGE_STYLE` — 999 pill, pink bg, inset shadow
  - `SECTION_HEADER_STYLE` / `SECTION_HEADER_LG_STYLE` — bold + textShadow
  - `EMPTY_STATE_TEXT_STYLE` — dim center-aligned
  - `MINI_BADGE_STYLE` — neutral white/10% pill

### 2. ShipTab.tsx

- **Mission CTA «Открыть карту»**: `bg-emerald-600 hover:bg-emerald-700` → `PINK_CTA_STYLE` (pink gradient pill + inset shadow).
- **State pill card**: `bg-white/5 rounded-lg border border-white/10` → `DARK_CARD_STYLE`.
- **Empty state**: `text-white/60` → `TEXT_VERY_DIM` + `EMPTY_STATE_TEXT_STYLE`.
- **Box rows**: `bg-white/5 rounded-lg ... border` → `DARK_CARD_STYLE` (с уменьшенным padding 8px 12px для compact list).
- **«Открыть» button**: `bg-amber-500 ... cursor-pointer` / `bg-gray-700 ... cursor-not-allowed` → `PINK_CTA_STYLE` mini + `DISABLED_CTA_OVERRIDES` для not-atHome.
- **Section header «📦 Боксы»**: `text-xs text-white/60 uppercase tracking-wide` → `SECTION_HEADER_STYLE`.
- **Transit ETA text**: inline `fontSize: 13, color: TEXT_DIM`.

### 3. SerumInventoryTab.tsx

- **Box cells** (4-col grid):
  - `rounded-lg border-2 bg [tinted]` → inline `borderRadius: 12, border: 2px solid {tint}, background: rgba(255,255,255,0.06), inset shadow`.
  - Count badge: `bg-amber-500` → gold pill (`#fde047` + dark text `#1a2e1a` для contrast).
- **Serum cells**: same dark glass background + tint border.
  - Count badge: `bg-emerald-500` → `PINK_BADGE_STYLE` (pink pill с inset shadow).
- **Empty state**: `text-white/60` → `TEXT_DIM` + `EMPTY_STATE_TEXT_STYLE` (центрирован).
- Selected outline + 1.07 scale — сохранён без изменений (logic).

### 4. BestiaryTab.tsx (top-level only)

**ОСТОРОЖНО:** `bestiary/` subdir НЕ trogался (Phase 18 virtualized grid + FilterPills). Проверка: `git status` на subdir — clean.

- **Container**: `bg-gray-950` → `background: transparent` (inherits #1a2e1a shell — фон уже корректный).
- **Global counter**: `text-white/60`/`text-white/40` → inline `TEXT_DIM`/`TEXT_VERY_DIM` + bottom border.
- **Location tabs**: `border-emerald-400` active → `2px solid #ec4899` (pink underline, matches shell tab strip pattern!).
  - Inactive: `text-white/40` → `TEXT_VERY_DIM`.
  - Active: `text-white` → `#fff`.
- Filter bar (`FilterPills`), grid (`BestiaryGrid`), detail modal — НЕ trogались.

### 5. CarriersTab.tsx + CarrierInfoCard.tsx

- **CarriersTab empty state**: `text-white/50` / `text-white/30` → `EMPTY_STATE_TEXT_STYLE` + `TEXT_VERY_DIM` hint.
- **CarriersTab count header**: `text-white/50` → inline `color: TEXT_DIM`.
- **CarrierInfoCard container**: `rounded-md border border-white/10 bg-gray-900/60 p-3` → `DARK_CARD_STYLE`.
- **Element swatch**: добавлен inset shadow для 3D feel.
- **Element name**: `text-white/90 font-semibold` → inline `#fff` + `fontWeight: 600`.
- **Level badge L{N}**: `text-white/70 text-xs` → `MINI_BADGE_STYLE` (neutral white/10% pill).
- **Dispose button**: `text-rose-400 border-rose-400/30` → `PINK_CTA_MINI_STYLE` (pink gradient mini).

### 6. CosmicShopTab.tsx

- **Currency header**: эссенция значение цветное (`GOLD`), серум значение цветное (`PINK`) — quick visual scan.
- **6 Item cards**: `border-emerald-500/40 bg-gray-900` / `border-white/10 bg-gray-950 opacity-60` → `DARK_CARD_STYLE` с conditional pink border (`rgba(236,72,153,0.35)`) когда affordable, white/10% когда нет.
- **Cost pills**: `bg-purple-900/40 text-purple-200` / `bg-amber-900/40 text-amber-200` → tinted pills (`GOLD` для essence + gold border, `PINK` для serum + pink border).
- **Element pickers (selects)**: `bg-gray-800` → inline dark glass `rgba(255,255,255,0.06)` + white/15% border. `<option>` inline `background: #1a2e1a` (Firefox/Chrome native dropdown bg).
- **«Купить» CTA**: `bg-emerald-600 hover:bg-emerald-500` / `bg-gray-700 cursor-not-allowed` → `PINK_CTA_STYLE` + `DISABLED_CTA_OVERRIDES`.
- Skip-transit warning: `text-amber-300/70` → inline `rgba(253,224,71,0.7)` (gold-tinted dim).

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Shared `_styles.ts` module | ✅ создан | DRY across 6 файлов; уменьшает bundle delta (1 копия констант vs 6); легко iterate цветовую палитру в одном месте. План явно разрешает «MAY извлечь». |
| CosmicShopTab фон/тема | Dark cosmic (НЕ pastel-green variant) | Consistency со shell (#1a2e1a) + другими tabs. Pastel-green создал бы visual disconnect между shop и rest of hub. |
| Carrier dispose button цвет | Pink CTA mini variant | Plan указывает «pink CTA mini variant». Rose outline был приятный, но pink более consistent с design language. Если нужна destructive-warning visual — Plan 25-04 polish может iterate (red-pink variant). |
| SerumInventory box badge цвет | Gold (`#fde047`) | Pink badges уже у серумов; gold отличает boxes (loot) от серумов (currency). Plus matches Plan 25-01 lock-title gold pattern. |
| Shop currency values цвет | Inline color: gold/pink | Усиливает associate: essence=gold, serum=pink. Quick scan: пользователь сразу видит баланс. |
| Commit стратегия | 2 атомарных коммита (Task1 / Task2+3) | Task 1 = 2 файла + новый shared module = очерченная unit. Task 2 + 3 = 4 файла одного visual pass (tab content polish list/cards/cta). |
| Bestiary FilterPills + BestiaryCell + BestiaryGrid | НЕ trogаются | План явно говорит «отложить в Plan 25-04 polish». bestiary/ subdir — Phase 18 deep work с rarity-tints, virtualization etc. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — DRY refactor] Создан `_styles.ts` shared module**
- **Found during:** Task 1 planning
- **Issue:** Constants `PINK_CTA_STYLE`, `DARK_CARD_STYLE`, color tokens нужны были бы в 6 файлах. Дублирование = пытка для будущих changes (если palette меняется — 6 правок). Plan явно разрешает: «Executor MAY извлечь эти константы».
- **Fix:** Создан `client/src/components/CosmicHub/_styles.ts` с 9 экспортами.
- **Files modified:** `client/src/components/CosmicHub/_styles.ts` (new, 87 lines)
- **Commit:** 8758922

**2. [Verify check artifact] `grep "linear-gradient" ShipTab.tsx` returns 0 — expected vs actual**
- **Found during:** Task 1 verify
- **Issue:** Plan verification checks `grep -c "linear-gradient" ShipTab.tsx >= 1`. После DRY refactor линейный градиент находится в импортированном `PINK_CTA_STYLE`, а сам literal `linear-gradient` присутствует в `_styles.ts`, не в `ShipTab.tsx`.
- **Fix:** N/A — это artifact verify check, не bug. Доказательство правильности: `grep -c "linear-gradient" client/src/components/CosmicHub/_styles.ts` = 1 + `grep -c "PINK_CTA_STYLE" ShipTab.tsx` = 4 (1 import + 3 usages).
- **Files modified:** none
- **Note:** Visual rendering identical: компонент использует style объект который содержит gradient string. CSS computed style на runtime будет иметь linear-gradient.

### Out-of-scope discoveries

Никаких — все 6 файлов restyled чисто; pre-existing user changes (.DS_Store, map0.png, planetMap.json.bak.451) не stage'ились (как указано в task brief).

Plan 25-03 agent параллельно зафиксировал свои файлы (SerumModal/BulkOpenSummary/PityCounterDisplay) — коммит `d889f53` между моими Task1 и Task2+3 коммитами. Конфликтов нет (разные файлы).

## Bundle Delta

| Metric | Plan 25-01 baseline | Plan 25-02 after | Delta |
|---|---|---|---|
| CosmicHubModal chunk (raw) | 44.04 KB | 45.14 KB | **+1.10 KB** |
| CosmicHubModal chunk (gzip) | ~13.25 KB | 13.56 KB | **+0.31 KB** |
| Target acceptable | +2-3 KB gzip (ideal), ≤+5 KB | — | **well within target** |

Bundle increase минимальный благодаря `_styles.ts` shared module (1 копия констант). Если бы не было shared module — каждый из 6 файлов нёс бы ~400 байт дублированных констант, что добавило бы ~2 KB raw.

## Verification

| Check | Status |
|---|---|
| `bg-emerald-*`/`bg-gray-9*`/`bg-blue-5*` removed from Task1 files | ✅ grep returns 0 |
| `bg-emerald-*`/`bg-gray-9*`/`bg-blue-5*` removed from Task3 files | ✅ grep returns 0 |
| BestiaryTab no Tailwind color utils on top-level | ✅ |
| `bestiary/` subdir NOT modified | ✅ `git status client/src/components/CosmicHub/bestiary/` clean |
| `_styles.ts` exports linear-gradient via PINK_CTA_STYLE | ✅ |
| `PINK_CTA_STYLE` used in ShipTab, CosmicShopTab, CarrierInfoCard | ✅ |
| `DARK_CARD_STYLE` used in ShipTab, CarrierInfoCard, CosmicShopTab | ✅ |
| `#ec4899` (pink) present in BestiaryTab location tabs active | ✅ |
| `#fde047` (gold) present in SerumInventoryTab box badges + ShopTab currency | ✅ |
| All buttons have `type="button"` + `touchAction: manipulation` | ✅ |
| Drag-drop state (`setSerumDragActive`) untouched | ✅ |
| Store actions untouched (`purchaseShopItem`, `removeCarrier`, `openBox`) | ✅ |
| i18n keys untouched | ✅ |
| `cd client && npx tsc --noEmit` | ✅ clean |
| `cd client && npm run build` (vite) | ✅ clean (warnings pre-existing) |
| Pre-existing user changes NOT staged | ✅ (.DS_Store, map0.png, planetMap.json.bak.451) |

## Visual confirmation (textual)

Manual mount-eyeballing не делался (executor режим, headless). Confidence based on:

- **Color tokens identical** к Plan 25-01 + matches CONTEXT.md spec (`#1a2e1a` фон, `#ec4899` pink, `#fde047` gold).
- **PINK_CTA gradient** воспроизводит LocationStack pattern (180deg gradient + inset+drop shadow для 3D feel).
- **DARK_CARD pattern** воспроизводит WelcomeModal pattern (subtle background + 1px white/10% border + inset 1px shadow).
- **BestiaryTab pink underline** (2px) consistent с shell tab strip (Plan 25-01: 3px pink underline на shell tabs).
- **Shop currency icons** (💠/🧪) сохранены, только цвет values изменился.

Если визуально что-то outlier — Plan 25-04 polish может iterate (особенно: SerumInventoryTab grid cells на mobile portrait — есть риск что 12px borderRadius + 2px tint border выглядят слишком "fat").

## Known visual inconsistencies для Plan 25-04 polish

1. **bestiary/FilterPills.tsx** — Phase 18 component, pink-active pill restyle отложен. Visual может смотреться несоответствующе на BestiaryTab (filter bar остался Tailwind emerald-themed). Plan 25-04 (или Phase 26) — restyle FilterPills с pink-active state.
2. **bestiary/BestiaryCell.tsx** — virtualized cells использует rarityStyles.ts. Если визуально clashes с dark cosmic shell — Plan 25-04 review.
3. **CosmicShopTab `<select>` element-picker dropdown native styling** — Firefox/Chrome native dropdowns подчиняются user-agent CSS. Inline option background `#1a2e1a` помогает но Safari ignore'ит. Если выглядит outlier — Plan 25-04 переход на custom dropdown (но это functionality change, не polish — может потребоваться отдельный план).
4. **CarrierInfoCard dispose button label** — может быть слишком "playful" для destructive action. Если UX feedback указывает на необходимость warning visual — Plan 25-04 polish: rose tint вариант (pink → desaturated red).
5. **ShipTab «Открыть» бокс button mini variant size** — может выглядеть зажато на узких mobile viewport. Альтернатива: full-width button под each box card. Plan 25-04 review.

## TODO для следующих планов

### Plan 25-03 (sub-modals)
✅ DONE — параллельно завершён (commit `d889f53`):
- SerumModal: dark bg + pink CTA
- BulkOpenSummary: stats card match dark theme
- PityCounterDisplay: pink accents для progress bar

### Plan 25-04 (polish)
- bestiary/FilterPills.tsx restyle (pink-active pill state)
- bestiary/BestiaryCell.tsx — review compat с dark cosmic shell
- Hover states на inactive shell + bestiary location tabs (desktop demo path)
- i18n keys `cosmic_hub.locked.title/hint` (deferred from Plan 25-01)
- Tab padding tweak в shell (если 12px 4px зажат)
- CosmicShopTab `<select>` Safari native fallback
- CarrierInfoCard dispose visual (если UX feedback указывает на destructive warning)
- Bundle: split CosmicHubModal chunk dynamically если >50 KB

## Files changed

- `client/src/components/CosmicHub/_styles.ts` (+87 lines, NEW)
- `client/src/components/CosmicHub/ShipTab.tsx` (+102/-43 lines)
- `client/src/components/CosmicHub/SerumInventoryTab.tsx` (+50/-23 lines)
- `client/src/components/CosmicHub/BestiaryTab.tsx` (+54/-19 lines)
- `client/src/components/CosmicHub/CarriersTab.tsx` (+24/-9 lines)
- `client/src/components/CosmicHub/CarrierInfoCard.tsx` (+34/-12 lines)
- `client/src/components/CosmicHub/CosmicShopTab.tsx` (+138/-46 lines)

Net: +489 lines / −152 lines = +337 net (inline styles длиннее эквивалентных Tailwind утилит; trade-off оправдан consistency).

## Commits

| Hash | Message |
|---|---|
| 8758922 | feat(25-02): restyle ShipTab + SerumInventoryTab (Task 1) |
| 5851289 | feat(25-02): restyle BestiaryTab + CarriersTab + CosmicShopTab (Tasks 2 & 3) |

## Self-Check: PASSED

- ✅ `client/src/components/CosmicHub/_styles.ts` exists (created)
- ✅ `client/src/components/CosmicHub/ShipTab.tsx` modified
- ✅ `client/src/components/CosmicHub/SerumInventoryTab.tsx` modified
- ✅ `client/src/components/CosmicHub/BestiaryTab.tsx` modified
- ✅ `client/src/components/CosmicHub/CarriersTab.tsx` modified
- ✅ `client/src/components/CosmicHub/CarrierInfoCard.tsx` modified
- ✅ `client/src/components/CosmicHub/CosmicShopTab.tsx` modified
- ✅ commit `8758922` exists in `git log`
- ✅ commit `5851289` exists in `git log`
- ✅ `bestiary/` subdir untouched (git status clean)
- ✅ tsc clean, vite build clean (pre-existing warnings only)
- ✅ pre-existing user changes NOT staged (.DS_Store, map0.png, planetMap.json.bak.451)
- ✅ Parallel Plan 25-03 agent's changes (SerumModal/BulkOpenSummary/PityCounterDisplay) NOT touched
