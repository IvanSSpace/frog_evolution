# Phase 25 — Smoke Test (Cosmic Hub restyle)

Дата: 2026-05-18
Phase: 25-cosmic-hub-restyle (4 plans complete)

**Scope:** Visual restyle всего CosmicHub под единый app design language
(dark cosmic `#1a2e1a` + pink `#ec4899` accents + WelcomeModal-style cards
+ 3D inset-shadow CTAs). Затрагивает 9 файлов:

- `CosmicHubModal.tsx` (shell + tab strip + lock screen) — Plan 25-01
- `ShipTab.tsx` / `SerumInventoryTab.tsx` / `BestiaryTab.tsx` /
  `CarriersTab.tsx` / `CarrierInfoCard.tsx` / `CosmicShopTab.tsx` — Plan 25-02
- `SerumModal.tsx` / `BulkOpenSummary.tsx` / `PityCounterDisplay.tsx` — Plan 25-03

Plus shared `_styles.ts` design tokens module (created Plan 25-02).

**Что НЕ trogается (по scope CONTEXT.md):**

- CascadeRevealModal animations
- bestiary/ subdir (FilterPills, BestiaryCell, BestiaryGrid, BestiaryDetailModal — Phase 18 territory)
- i18n keys (visual-only phase; check-translations 337/337 baseline preserved)
- Store actions, props, eventBus, ship/box/carrier slices logic

**Manual QA scenarios:** A–F.

**Dev helpers (DEV builds only):**

- `__triggerCaptainBirth()` — force play cinematic чтобы быстро открыть cosmos (Phase 24)
- `__resetCaptainBirth()` / `__resetOnboarding()` — reset для fresh-save scenarios
- `__giveFrog(level)` / `devCarriers.*` / `__unlockAllLocations()` —
  существующие helpers (Phase 17/18/22/24) для cheat'а frogs/carriers/locations
- `__bestiaryCount()` — sanity-check bestiary virtualization после restyle (Phase 18 helper)

---

## Preconditions

```bash
cd /Users/shar/Documents/frog_evolution/frog_evolution_code/client
npm run dev
```

1. Открыть http://localhost:5173 (vite-assigned port).
2. DevTools → Console.
3. На fresh save (Scenario A): `localStorage.clear(); location.reload()`.
4. Для unlocked-state scenarios (B–F): trigger cosmos через `__triggerCaptainBirth()`
   → CTA «В космос →» → CosmicHub становится доступным.

---

## Scenario A — Lock screen (cosmos закрыт)

**Цель:** проверить dark cosmic lock card до открытия cosmos.

**Setup:**

```js
localStorage.clear()
location.reload()
```

Дождись loading screen → ready. НЕ trigger captain birth.

**Steps:**

1. Открыть CosmicHub из нижней панели (🧬 icon если доступен до cosmos unlock — иначе через debug UI).

**Expected:**

- [ ] Shell фон — dark cosmic `#1a2e1a` (НЕ старый `bg-gray-950` черный).
- [ ] Header показывает 🧬 + title «Cosmic Hub» (i18n `cosmic_hub.title`)
      белым, fontWeight 800, с лёгким textShadow.
- [ ] Close button (×) — pink-tinted `rgba(236,72,153,0.7)` в дефолте,
      hover → full pink `#ec4899` (desktop).
- [ ] Lock card по центру модалки:
  - dark `#1a2e1a` bg
  - 2px `rgba(255,255,255,0.15)` border
  - borderRadius 16, padding 24, maxWidth 320
  - box-shadow `0 8px 24px rgba(0,0,0,0.4)`
- [ ] 🔒 emoji 64px (НЕ старый `text-6xl`), lineHeight 1.
- [ ] Lock title — gold `#fde047`, fontSize 22, fontWeight 800, textShadow.
- [ ] Hint text — dim `#d4d4d8`, fontSize 14, lineHeight 1.4.
- [ ] Tap × → modal закрывается без crash + console errors.

---

## Scenario B — Tab strip (cosmos открыт)

**Цель:** проверить pink underline + bobble keyframe + disabled state на tab strip.

**Setup:**

```js
// быстрый cosmos unlock через Phase 24 helper:
__triggerCaptainBirth()
// → дождись модалки → tap «В космос →» → Star Map opens
// → закрой Star Map → открой CosmicHub (🧬 nav button)
```

**Steps:**

1. CosmicHub открывается → видим 5 tabs.

**Expected:**

- [ ] 5 tabs visible: 🚀 Корабль / 🧪 Серумы / 🐸 Бестиарий / 👥 Носители / 🛍️ Магазин.
- [ ] Active tab (default или session-restored) имеет:
  - color `#fff`, fontWeight 700
  - pink underline `3px solid #ec4899`
  - анимация `cosmic-tab-bobble 1.5s ease-in-out infinite`
    (scaleY 1.0 ↔ 1.02, лёгкий «дышащий» bobble, не отвлекающий)
- [ ] Inactive enabled tabs — `rgba(255,255,255,0.4)`, fontWeight 500,
      cursor pointer.
- [ ] Disabled tabs (если carriers пуст, например): `rgba(255,255,255,0.2)`,
      opacity 0.6, cursor not-allowed, 🔒 emoji rendered.
- [ ] Tap на disabled tab → НЕ переключается. Tooltip (через `title`) показывает lockReason.
- [ ] Tap на enabled inactive → переключение мгновенное, новый tab получает
      pink underline + bobble animation начинается с подхвата keyframe.
- [ ] sessionStorage сохраняет `cosmic_hub_active_tab` — refresh страницы
      → тот же tab активен после reopen CosmicHub.
- [ ] padding tabs `12px 4px` — `flex: 1` ровно распределяет ширину,
      лейблы не overflow'ятся на 320px viewport.
- [ ] Все tab buttons имеют `type="button"`.

---

## Scenario C — Ship + Серумы tabs (Plan 25-02 content)

**Цель:** проверить mission CTAs + dark cards в первых двух tabs.

**Setup:** cosmos unlocked (см. Scenario B). На Ship tab.

**Steps:**

1. ShipTab default.
2. Mission CTA «Открыть карту» visible.
3. Switch к 🧪 Серумы tab.

**Expected (ShipTab):**

- [ ] Mission CTA «Открыть карту» — pink gradient pill
      (`linear-gradient(180deg, #f9a8d4 0%, #db2777 100%)`), 999 radius,
      inset highlight + drop shadow (LocationStack-style 3D).
- [ ] State pill card (текущий ship state) — `DARK_CARD_STYLE`:
      borderRadius 12, `rgba(255,255,255,0.06)` bg, 1px white/10% border,
      inset highlight.
- [ ] Empty state (если нет боксов в transit) — dim text `rgba(255,255,255,0.4)`,
      центрирован.
- [ ] Box rows (если есть боксы): dark glass cards, compact padding 8px 12px.
- [ ] «Открыть» button per box — pink CTA mini variant (`PINK_CTA_MINI_STYLE`)
      когда atHome; opacity 0.5 + cursor not-allowed когда in transit.
- [ ] Section header «📦 Боксы» — fontWeight 700, uppercase, letterSpacing,
      textShadow.
- [ ] Tap «Открыть карту» → FlightConfirmDialog или Star Map opens —
      функциональность intact.

**Expected (SerumInventoryTab — Серумы):**

- [ ] 4-col grid из box cells + serum cells:
  - borderRadius 12, 2px tint border, dark glass `rgba(255,255,255,0.06)` bg,
    inset shadow для 3D feel.
- [ ] Box count badge — **gold** `#fde047` pill с dark text `#1a2e1a`
      (отличает boxes от серумов visually).
- [ ] Serum count badge — **pink** `#ec4899` pill с white text + inset highlight.
- [ ] Empty state (если пусто) — dim text по центру.
- [ ] Selected serum: outline + scale 1.07 (logic preserved).
- [ ] Drag серум → carrier на MainScene → drop работает (если drag possible
      из этого view) — функциональность intact.

---

## Scenario D — Бестиарий + Носители tabs (Plan 25-02 content)

**Цель:** Bestiary location tabs pink + Carriers WelcomeModal-style cards.

**Setup:** cosmos unlocked. Несколько frogs/carriers cheat'нуты:
`__giveFrog(5)` × 2-3 + `devCarriers.add({element: 'fire', level: 5})`
если нужно carriers entries.

**Steps:**

1. Switch к 🐸 Бестиарий tab.
2. Switch к 👥 Носители tab.

**Expected (BestiaryTab top-level — НЕ subdir):**

- [ ] Container фон — transparent (наследует `#1a2e1a` shell). НЕ `bg-gray-950`.
- [ ] Global counter «N / 1536 открыто» — dim white-60% main + dim-40% suffix,
      с bottom white-10% border.
- [ ] Location tabs (Болото / Лес / Континент / Планета):
  - Active — `2px solid #ec4899` underline (pink, **consistent с shell tab strip**),
    color #fff, fontWeight 700.
  - Inactive — `rgba(255,255,255,0.4)`, fontWeight 500.
- [ ] Virtualized grid (внутри `bestiary/` subdir): scroll smooth,
      DOM check — ≤30 cells (Phase 18 virtualization preserved).
- [ ] Tap any discovered cell → BestiaryDetailModal opens (Phase 18 modal,
      **НЕ trogался** Plan 25-02). Visual может выглядеть несоответствующе
      dark cosmic theme — это **known TODO** для Phase 26 polish, НЕ блокер.
- [ ] FilterPills (rarity + element search + sort) — Phase 18 component,
      НЕ trogался. Если визуально outlier с pink/dark — **known TODO Phase 26**.

**Expected (CarriersTab + CarrierInfoCard):**

- [ ] Empty state (если carriers нет) — dim center text + hint mini-text dimmer.
- [ ] Count header «N носителей» — dim white-d4d4d8.
- [ ] CarrierInfoCard:
  - `DARK_CARD_STYLE`: borderRadius 12, dark glass bg, 1px white/10% border, inset highlight.
  - Element swatch — добавлен inset shadow для 3D depth.
  - Element name — fontWeight 600 + white solid.
  - Level badge L{N} — neutral white/10% mini pill (`MINI_BADGE_STYLE`).
  - Dispose button — pink CTA mini variant (`PINK_CTA_MINI_STYLE`),
    visual matches остальные pink CTAs.
- [ ] Tap dispose → DisposeConfirmModal opens — функциональность intact.
- [ ] CeilingDisplay (если рендерится) — sane visual без emerald-разрыва.

---

## Scenario E — Космический Магазин tab (Plan 25-02 content)

**Цель:** dark item cards + pink «Купить» CTA + цветные currency values.

**Setup:** cosmos unlocked. Достаточно essence/серумов чтобы хоть один item был affordable
(`devCarriers.giveEssence(1000)` если helper есть; иначе grind).

**Steps:**

1. Switch к 🛍️ Магазин tab.

**Expected:**

- [ ] Currency header: эссенция value цветная **gold** `#fde047`,
      серум value цветная **pink** `#ec4899` — quick visual scan балансов.
- [ ] 6 shop items (perma + consumable per Phase 22):
  - Каждая item card `DARK_CARD_STYLE` + conditional pink border `rgba(236,72,153,0.35)`
    если affordable; white/10% если нет.
  - borderRadius 12, padding adequate, glass dark bg.
- [ ] Cost pills внутри cards:
  - Essence cost — gold tint (`#fde047` text + gold border).
  - Серум cost — pink tint (`#ec4899` text + pink border).
- [ ] Element pickers (`<select>` для targetable items): dark glass
      `rgba(255,255,255,0.06)` bg + white/15% border. Native dropdown
      options inline `background: #1a2e1a` (Firefox/Chrome match; Safari
      может игнорить native option styling — **known minor issue**).
- [ ] «Купить» CTA — `PINK_CTA_STYLE` (pink gradient pill).
- [ ] Disabled «Купить» (insufficient currency) — `DISABLED_CTA_OVERRIDES`:
      opacity 0.5 + cursor not-allowed.
- [ ] Tap «Купить» affordable item → currency списывается, item count/perma flag
      обновляется в UI, no crash + no console errors.
- [ ] Skip-transit warning (для consumable_skip_transit) — gold-tinted dim text.
- [ ] Phase 22 cosmic shop functionality intact:
  - perma flags persist через reload
  - consumable counts increment correctly
  - element-targetable items apply к выбранному элементу

---

## Scenario F — Sub-modals + PityCounterDisplay (Plan 25-03)

**Цель:** SerumModal + BulkOpenSummary + PityCounter pink/dark visual + intact functionality.

**Setup:**

- Несколько серумов в inventory + хотя бы один carrier на main scene
  (для SerumModal flow).
- ≥5 боксов в inventory для BulkOpenSummary `Открыть все`.
- Несколько opened boxes за сессию для PityCounter reveal state.

**Steps:**

1. **SerumModal:** На SerumInventoryTab → tap any серум → SerumModal opens
   (или drag серум → carrier через apply flow).
2. **BulkOpenSummary:** Накопить ≥5 боксов (через devCarriers/`__giveBoxes`
   если helper exists, либо grind drops) → BoxesTab/Ship — «Открыть все».
3. **PityCounter:** footer на BoxesTab/SerumsTab после open box action.

**Expected (SerumModal):**

- [ ] Backdrop — `rgba(0,0,0,0.6)` + `backdropFilter: blur(2px)`,
      click outside → modal closes (Rule 2 fix Plan 25-03 — раньше backdrop
      отсутствовал).
- [ ] Inner modal — dark `#1a2e1a` bg, 2px white-15% border, borderRadius 16,
      drop shadow `0 8px 24px rgba(0,0,0,0.4)`.
- [ ] Header:
  - 🧪 icon 40px (уменьшен с 48px)
  - Title «Сыворотки» — fontSize 18, fontWeight 800, white solid + textShadow
    (НЕ старый emerald-green `ff-display`).
  - Subtle pink-tinted gradient overlay top→transparent для accent.
  - Bottom white-10% border (НЕ старый `border-bottom: 3px dashed`).
- [ ] Close button (36×36 circle) — pink-outlined, hover → full pink `#ec4899`.
- [ ] Apply flow работает: select carrier → серум applies → carrier feeds → modal closes.
- [ ] z-index hierarchy: backdrop=99, modal=100, above shell (z=50).
- [ ] stopPropagation на inner div — tap внутри content НЕ закрывает modal.

**Expected (BulkOpenSummary):**

- [ ] Backdrop — `rgba(0,0,0,0.7)` + blur 2px (упрощён с radial-gradient).
- [ ] **NEW** Card container — `#1a2e1a` bg, 2px white-15% border, borderRadius 16,
      padding 24, maxWidth 360. Содержимое больше НЕ плавает на голом backdrop.
- [ ] Title «Результаты» — gold `#fde047`, fontWeight 800, letterSpacing 1.5, glow textShadow.
- [ ] SummaryRow rows:
  - Inset card pattern: `rgba(255,255,255,0.06)` bg, 1px white/10% border,
    inset highlight, borderRadius 12, padding 10px 14px.
  - Left element circle (28×28) — element tint color sustained, opacity-reduced shadow.
  - Element name label + textShadow.
  - **Right count badge** — pink pill `#ec4899` + white text + inset highlight
    (раньше был element-tint pill).
- [ ] Close CTA — `PINK_CTA_STYLE` pink gradient pill.
- [ ] Legendary glow boxShadow — gated `hasLegendary=false` в Phase 22
      (rarity removed). Infrastructure готова: если Phase 26+ rarity вернёт,
      legendary results получат gold radial glow + bulkSummaryGlow keyframe.
- [ ] **i18n fix verified** (Rule 1 Plan 25-03): element names локализованы —
      `«Огонь»` / `«Лёд»` / etc вместо raw `'cosmic_hub.elements.${row.element}'`
      raw string.
- [ ] Close → modal closes, boxes очищены из inventory, UI consistent
      (no leftover modals, scroll restored).

**Expected (PityCounterDisplay):**

- [ ] **opened < 3** (hidden state) — footer не рендерится (Phase 19 spec).
- [ ] **opened ∈ [3, 5)** (dots state) — footer показывает:
  - Container: `rgba(0,0,0,0.4)` bg, 1px `rgba(255,255,255,0.1)` top border.
  - Dim text label.
  - 3 dot indicators (8×8px `<span>` divs, НЕ старые text emoji ●○):
    - Filled — pink `#ec4899` + glow shadow.
    - Empty — `rgba(255,255,255,0.15)` + inset shadow.
- [ ] **opened ≥ 5** (exact state):
  - Text labels — neutral `#d4d4d8`, fontWeight 600.
  - Legendary text — pink `#ec4899`, fontWeight 800 (raised from gold).
  - **NEW progress bar** — 4px thin track + pink gradient fill
    `linear-gradient(90deg, #f9a8d4 0%, #ec4899 100%)`,
    width = `(pity.legendary / 25) * 100%`, smooth transition 300ms,
    glow shadow `0 0 6px rgba(236,72,153,0.5)`.
- [ ] Phase 19 reveal logic preserved: 3 distinct render branches verified.
- [ ] Reduce-motion: bobble + progress transition могут быть слегка яркими для
      `prefers-reduced-motion` users — **known minor TODO** для Phase 26 polish.

---

## Cliclability checklist (cross-cutting)

(memory `feedback_clickability`)

- [ ] Все buttons в shell + tabs + sub-modals имеют `type="button"` явно.
- [ ] `touchAction: 'manipulation'` на main CTAs + close buttons + tab buttons —
      нет iOS double-tap zoom delay.
- [ ] Backdrop click → close (SerumModal + BulkOpenSummary) — work.
- [ ] stopPropagation на inner modal divs — tap внутри content НЕ закрывает modal.
- [ ] z-index hierarchy:
  - CosmicHubModal shell — 50
  - SerumModal backdrop — 99, modal — 100
  - BulkOpenSummary — 200
  - Hierarchy не overlap'ится с HUD/SerumBar/ActiveBonusesBar (которые выше).
- [ ] Sub-modals открываются поверх shell (z-index ≥ 51 satisfied).

---

## Build chain (regression)

```bash
cd /Users/shar/Documents/frog_evolution/frog_evolution_code/client
npx tsc --noEmit
npm run build
```

**Expected:**

- [ ] `tsc --noEmit` — clean, 0 TypeScript errors.
- [ ] `vite build` — clean, pre-existing warnings only.
- [ ] No new runtime warnings при mount CosmicHub (DevTools Console).

**Bundle delta check (cumulative Phase 25 vs Phase 24 baseline):**

```bash
ls -la client/dist/assets/ | grep -E "(index|CosmicHub)"
```

Сравнить с Phase 24 baseline (`index.js gzip ≈ 199.88 KB`, `CosmicHubModal chunk gzip ≈ 12.85 KB`):

- Plan 25-01 delta: +0.40 KB gzip (CosmicHubModal chunk)
- Plan 25-02 delta: +0.31 KB gzip (cumulative)
- Plan 25-03 delta: +0.27 KB gzip (cumulative)
- **Phase 25 cumulative gzip delta: ≈ +0.98 KB** (well within ±5 KB cap per CONTEXT.md).

---

## i18n parity

```bash
cd /Users/shar/Documents/frog_evolution/frog_evolution_code/client
npm run check-translations
```

**Expected:**

- [ ] 337/337 keys × 3 locales (RU/EN/ES) PASS — НЕ менялось в Phase 25
      (visual-only phase).
- [ ] Все existing `cosmic_hub.*` keys остались untouched в RU/EN/ES.
- [ ] BulkOpenSummary показывает локализованные element names (Plan 25-03 Rule 1 fix:
      backtick template literal вместо single-quote literal).

**Spot-check переключение языка в DevTools:**

- [ ] **RU:** Корабль / Серумы / Бестиарий / Носители / Магазин
- [ ] **EN:** Ship / Serums / Bestiary / Carriers / Shop (или соответствующие
      ключи в `cosmic_hub.tabs.*`)
- [ ] **ES:** соответствующие испанские локализованные tab labels.

(Финальные строки см. в `client/src/i18n/{ru,en,es}.json` под ключом
`cosmic_hub.tabs.*` + `cosmic_hub.elements.*`.)

**Known deferred:** i18n keys `cosmic_hub.locked.title` + `cosmic_hub.locked.hint`
для lock screen — hard-coded в Plan 25-01 (scope «i18n не trogается»);
deferred TODO для Phase 26 polish если нужна локализация lock screen текста.

---

## Regression sanity (адаптировано из Phase 22/23/24)

- [ ] **Phase 22 cosmos gate**: `hasCosmosUnlocked` определяет shell content
      (lock screen pre-unlock, tab strip post-unlock). Functionality intact.
- [ ] **Phase 22 cosmic shop**: perma flags persist через reload, consumable
      counts increment, currency списывается (UI обновляется live).
- [ ] **Phase 23 onboarding**: Welcome/Beat2/Beat3/Beat4 flows работают —
      Beat 4 «локация открыта» celebration после первого L18+L18 — НЕ
      пересекается с CosmicHub mount по z-index.
- [ ] **Phase 24 captain birth**: `__triggerCaptainBirth()` → cinematic
      → CTA «В космос →» (pink) → Star Map auto-open. Functionality intact.
- [ ] **Phase 18 bestiary**: virtualized grid DOM cells ≤30, scroll smooth,
      FilterPills functional (filter logic + sort), BestiaryDetailModal opens.
- [ ] **Phase 17 carriers**: feedCarrier/disposeCarrier/mergeCarriers actions
      intact; CarrierInfoCard визуальный restyle не trogает level/element/name
      bindings.
- [ ] **Phase 16 ship**: missionState transitions, mission CTAs trigger
      FlightConfirmDialog correctly.
- [ ] **Phase 15 boxes + slot machine + cascade reveal**:
  - BoxesTab inventory renders cards
  - «Открыть» triggers SerumSlotMachine (rarity-locked durations preserved)
  - CascadeRevealModal — **НЕ trogался** Phase 25 (out of scope per CONTEXT.md),
    cascade timeline intact.
- [ ] **Phase 19 pity counter**: hidden/dots/exact reveal at opened=0/3/5
      preserved.
- [ ] **frog.container.alpha не tween'ится** Phase 25 changes — visual
      restyle ограничен tabs/modals/cards, MainScene frogs не trogаются
      (memory `feedback_frog_container_alpha`).
- [ ] **Никаких Lottie зависимостей** в bundle — CSS keyframes (bobble +
      bulkSummaryGlow) + Phaser tweens только (memory `feedback_animations`).

---

## Reporting

При обнаружении регрессии или visual mismatch:

1. Запиши scenario letter + step.
2. File path + line (если визуальный glitch — какой компонент).
3. DevTools Console errors / warnings.
4. Compared screenshot если возможно (текущий vs design intent из CONTEXT.md).
5. Browser + viewport size (mobile portrait / desktop 1080p / etc.).

PASS критерий: все 6 сценариев + cliclability + build chain + i18n parity +
regression sanity без unchecked checkboxes.

**Known minor TODOs deferred для Phase 26 polish (не блокеры):**

- `cosmic_hub.locked.title/hint` i18n keys (hard-coded в Plan 25-01).
- `bestiary/FilterPills.tsx` restyle (pink-active pill state).
- `bestiary/BestiaryCell.tsx` review compat с dark cosmic shell.
- `bestiary/BestiaryDetailModal.tsx` restyle (Phase 18 territory).
- Hover state на inactive shell + bestiary location tabs (desktop demo path).
- Tab padding tweak (12px 4px → 12px 8px если визуально зажато).
- CosmicShopTab `<select>` Safari native fallback (custom dropdown).
- CarrierInfoCard dispose visual destructive-warning variant (если UX feedback).
- `prefers-reduced-motion` media query на bobble + progress bar transitions.
- Bundle: split CosmicHubModal chunk dynamically если >50 KB.
