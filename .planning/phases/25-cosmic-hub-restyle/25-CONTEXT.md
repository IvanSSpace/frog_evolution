# Phase 25: Cosmic Hub restyle — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** PRD Express Path (`frog_obsidian/Design Notes/2026-05-18-cosmic-hub-restyle.md`)

<domain>
## Phase Boundary

Visual restyle CosmicHub под единый app design language. Только visual — функциональность tab'ов не trogается. **Demo-build качество, ~6 часов.**

**Restyle охватывает:**
1. `CosmicHubModal.tsx` shell (header, tab strip, close button)
2. Lock screen (когда `!cosmosUnlocked`)
3. 5 tab content polishes: ShipTab, SerumInventoryTab, BestiaryTab, CarriersTab, CosmicShopTab
4. Sub-modals: SerumModal, BulkOpenSummary, PityCounterDisplay

**Не трогаем:** функциональность, layout/flow, i18n, Phaser-embedded элементы (StarMapHUD, ConfettiBurst), CascadeRevealModal animations.

</domain>

<decisions>
## Implementation Decisions

### Design Language (target)

**Цветовая палитра:**
- Primary pink: `#ec4899` (CTAs, active states, focus)
- Pink gradient: `linear-gradient(180deg, #f9a8d4 0%, #db2777 100%)` (CTA buttons)
- Dark cosmic bg: `#1a2e1a` (solid, как WelcomeModal Phase 23)
- Border subtle: `rgba(255,255,255,0.15)` 2px
- Title gold: `#fde047` (accent для headers)
- Body text white: `#fff`, dim `#d4d4d8`, very-dim `rgba(255,255,255,0.4)`

**Buttons (3D inset-shadow):**
```css
boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 0 rgba(0,0,0,0.3)'
borderRadius: 999  /* pill */ ИЛИ 12  /* card-like */
padding: '10px 20px'
fontWeight: 800
textShadow: '0 1px 0 rgba(0,0,0,0.4)'
```

**Cards:**
- `borderRadius: 12`
- `background: rgba(255,255,255,0.06)` или `#243d24` (slightly lighter than bg)
- `border: 1px solid rgba(255,255,255,0.1)`

### Main shell (CosmicHubModal.tsx)

- Background: solid `#1a2e1a` (вместо `bg-gray-950`)
- Header:
  - 🧬 emoji + title с textShadow
  - Title font 18px weight 800
  - Close button: pink-tinted (rgba(236,72,153,0.7) → 1 on hover)
- Tab strip:
  - Active tab: pink underline `3px solid #ec4899` + slight bobble scale 1.0↔1.02 (CSS keyframes)
  - Inactive: `rgba(255,255,255,0.4)` text
  - Disabled: 🔒 emoji + `rgba(255,255,255,0.2)` opacity
  - Hover: pink-tinted bg `rgba(236,72,153,0.1)`
  - Padding bigger: `py-3` вместо `py-2`

### Lock screen redesign

WelcomeModal-style card:
- Dark card `#1a2e1a` + 2px border `rgba(255,255,255,0.15)`
- 🔒 emoji 64px (вместо 6xl)
- Title 22px weight 800 gold `#fde047`
- Hint 14px weight 500 white/dim
- Card max-width 320, centered, padding 24

### Tab content polish (light pass)

Каждый tab — quick polish, не rebuild:
- **ShipTab**: rounded buttons (mission CTAs, refresh) → pink gradient pill
- **SerumInventoryTab**: serum cards → rounded 12, inset-shadow, pink count badges
- **BestiaryTab**: filter pills pink active, grid cells inset-shadow
- **CarriersTab**: carrier list cards → match WelcomeModal-card style
- **CosmicShopTab**: shop items → rounded inset cards, pink "Купить" buttons

### Sub-modals

- **SerumModal**: dark bg, pink CTA
- **BulkOpenSummary**: stats card match dark theme
- **PityCounterDisplay**: pink accents для progress bar, dark bg

### Tailwind cleanup approach

Не убирать Tailwind целиком — оставить layout utilities (`flex`, `grid`, `gap-N`, `px-N`, `py-N`). Заменить только цвет/border/text utilities на inline styles. Это минимизирует diff size.

### Cliclability (memory `feedback_clickability`)
- Все buttons `type="button"`
- z-index 50+ (modal уже z-50)
- stopPropagation на inner cards если interactive
- touchAction: manipulation на buttons

### Claude's Discretion
- Точный dark bg shade (`#1a2e1a` baseline, может попробовать gradient `linear-gradient(180deg, #0c1e0c, #1a2e1a)`)
- Active tab style (underline vs pill bg vs both)
- Gold vs pink для title accent (header emoji bg)
- Tab strip layout (current grid vs scrollable horizontal)
- Sub-modal restyle depth (light pass vs deeper)

</decisions>

<canonical_refs>
## Canonical References

### Design Spec
- `frog_obsidian/Design Notes/2026-05-18-cosmic-hub-restyle.md` — Полный design (палитра + style patterns + scope)

### Design language references
- `frog_evolution_code/client/src/components/Onboarding/WelcomeModal.tsx` — dark card + pink CTA pattern (Phase 23 latest)
- `frog_evolution_code/client/src/ui/components/LocationStack.tsx` — pink gradient + inset-shadow button pattern
- `frog_evolution_code/client/src/ui/components/FrogShopModal.tsx` — pastel-green modal pattern (для reference)
- `frog_evolution_code/client/src/ui/components/SettingsModal.tsx` — pastel-green modal pattern
- `frog_evolution_code/client/src/components/Captain/CaptainBirthModal.tsx` — Phase 24 cosmic-themed modal (gold/pink)

### Files to restyle (scope)
- `frog_evolution_code/client/src/components/CosmicHub/CosmicHubModal.tsx` (main shell)
- `frog_evolution_code/client/src/components/CosmicHub/ShipTab.tsx`
- `frog_evolution_code/client/src/components/CosmicHub/SerumInventoryTab.tsx`
- `frog_evolution_code/client/src/components/CosmicHub/BestiaryTab.tsx`
- `frog_evolution_code/client/src/components/CosmicHub/CarriersTab.tsx`
- `frog_evolution_code/client/src/components/CosmicHub/CosmicShopTab.tsx`
- `frog_evolution_code/client/src/components/CosmicHub/SerumModal.tsx`
- `frog_evolution_code/client/src/components/CosmicHub/BulkOpenSummary.tsx`
- `frog_evolution_code/client/src/components/CosmicHub/PityCounterDisplay.tsx`

### Planning Context
- `.planning/STATE.md`
- `.planning/ROADMAP.md` — Phase 25 entry, deps Phase 24

</canonical_refs>

<specifics>
## Specific Ideas

- **Не убирать Tailwind**: оставить layout utilities (`flex`, `grid`, `gap`, padding), заменить только цвет/text/border utilities inline styles.
- **Inline style approach**: per WelcomeModal pattern — inline styles вместо separate CSS files (легче iterate).
- **CSS keyframes**: только для bobble на active tab (1.0↔1.02, 1.5s loop). Без Lottie.
- **Reuse pulse pattern**: для active tab — тот же подход что LocationStack pulse glow (box-shadow + bobble).
- **Sub-modal restyle minimum**: только color/border/text fixes, не rebuild structure.
- **i18n keys не trogаем** — только visual.
- **Bundle delta acceptable**: +2-5 KB gzip (inline styles vs Tailwind classes).

</specifics>

<deferred>
## Deferred Ideas

- Tab strip horizontal scroll если узкий viewport (на demo не критично)
- Custom animations beyond bobble (sparkle на active tab, ripple на click — Phase 26+)
- Phaser-embedded HUD restyle (StarMapHUD имеет свой стиль, separate phase если нужно)
- CascadeRevealModal animations cleanup (working, не trogаем)
- Light theme variant
- Compact mode для landscape
- Tab strip как pills вместо underline (decided: underline + bobble)
- Replace ALL Tailwind с inline styles — не стоит, только color/text утилиты

</deferred>

---

*Phase: 25-cosmic-hub-restyle*
*Context gathered: 2026-05-18 via PRD Express Path*
