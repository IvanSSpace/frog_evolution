# Phase 26: Cosmos races foundation — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** PRD Express Path (`frog_obsidian/Design Notes/2026-05-18-cosmos-races-foundation.md`)

<domain>
## Phase Boundary

Foundation для multi-phase космической экспансии. **Phase 26 реализует ТОЛЬКО:**
1. Data model для 10 рас (config/races.ts с lore/affinity/personality)
2. 30 обитаемых планет (1 home + 2 colonies per race) — отмечены в planetMap
3. Visual race indicators на Star Map (color glow + icon на habitable planets)
4. Cosmos gate — habitable planets visible только после cosmos unlock
5. **Inventory tab** в Cosmic Hub (essence + серум per element + placeholders для artifacts/relationships)
6. First contact narrative event при first habitable planet visit

**Phase 27** — quest mechanics (отдельно)
**Phase 28** — communications inbox (отдельно)
**Phase 29** — relationships + diplomacy (отдельно)

**Scope target:** ~15-20 часов. Demo-build качество.

**Out of scope:** quest mechanics, message generation, response system, relationship effects, combat/boss planets, artifacts, race-specific events.

</domain>

<decisions>
## Implementation Decisions

### 10 Races (полный лор)

| # | RaceId | Название | Affinity | Тип жизни | Личность | Home planet |
|---|---|---|---|---|---|---|
| 1 | `crystalloids` | Кристаллозиды | Crystal | Кремниевая жизнь, кристаллические друзы | Холодные, мудрые, медленные | «Силикасос» |
| 2 | `gasouls` | Газо-облака | Gas | Газовая форма, поют резонансами | Бесформенные, поэтичные | «Звукоплав» |
| 3 | `mechanidons` | Механидоны | Mechanical | Гибрид био+машина | Структурированные, рациональные | «Калибр-нейрон» |
| 4 | `fireworms` | Огнечервы | Fire | Плазменные тела в звёздах | Воинственные, прямолинейные | «Раскал» |
| 5 | `liquidoids` | Жидко-сферы | Water | Амебоидная жидкая жизнь | Торговцы, гибкие | «Текум» |
| 6 | `tenebrians` | Тенебрисы | Shadow | Anti-matter, между измерений | Мистики, наблюдатели | «Невидь» |
| 7 | `plasmaspirits` | Плазма-духи | Plasma | Плазменные сущности | Импульсивные, кочевники | «Молниелов» |
| 8 | `forestcores` | Лесо-кореня | Forest | Грибная-корневая | Древние, спокойные | «Корнемир» |
| 9 | `timeweavers` | Время-ткачи | Void | Вне-временные существа | Эзотерики, философы | «Парадокс» |
| 10 | `cometfolk` | Кометники | Binary | Кометно-облачные путешественники | Дружелюбные, открытые | «Странь» |

### Race Data Model

```ts
// client/src/game/config/races.ts

export type RaceId =
  | 'crystalloids' | 'gasouls' | 'mechanidons' | 'fireworms'
  | 'liquidoids' | 'tenebrians' | 'plasmaspirits' | 'forestcores'
  | 'timeweavers' | 'cometfolk'

export interface RaceConfig {
  id: RaceId
  name: string              // localized name key path (i18n)
  affinity: Element         // archetype affinity (matches existing 16 elements)
  homeColor: number         // Phaser hex color (для glow / icon)
  iconPath: string          // /races/{id}.svg path (placeholder если asset нет)
  personality: string       // i18n key для personality flavor text
  communicationStyle: string // i18n key для стиля общения
  loreShort: string         // i18n key для краткого описания (3-4 sentences)
}

export const RACES: readonly RaceConfig[] = [
  { id: 'crystalloids', ..., affinity: 'crystal', homeColor: 0x67e8f9, ... },
  // ... 10 entries
]

export const RACES_BY_ID: Record<RaceId, RaceConfig> = ...
```

### 30 Habitable Planets

**Распределение:** 1 home + 2 colonies × 10 рас = 30 habitable planets total.

```ts
interface PlanetInhabitant {
  raceId: RaceId
  role: 'home' | 'colony'
}

// Существующий planetMap.json расширяется:
interface Planet {
  ... existing fields ...
  inhabitant?: PlanetInhabitant  // undefined = uninhabited (970 planets)
}
```

**Selection process для Phase 26:**
- Из 1000 procedural planets выбрать 30 deterministically (seed-based) или handpicked
- Каждый race получает 1 home planet (помечена `role: 'home'`)
- Каждый race получает 2 colony planets (помечены `role: 'colony'`)
- Selection criteria: affinity match (fire-race planets с fire archetype, например)
- Distribution: home planets distributed evenly across map, colonies near home

### Visual indicators (Star Map)

- **Habitable planets:** race color glow вокруг planet sprite (radius +6px, alpha 0.5)
- **Home planets:** additional pulsing gold halo (#fde047) + race icon overlay
- **Colony planets:** small race icon overlay, без pulse
- **Uninhabited (970):** unchanged visual
- **Tooltip / popover на hover:** race name + role indicator

### Cosmos Gate

- Habitable planets visible **только после cosmos unlock** (`useCosmosUnlocked()`)
- До unlock — те же planets выглядят как обычные uninhabited
- После unlock — visual «активируется», icons и glow появляются
- First habitable planet visit triggers narrative event

### Inventory Tab

**Новый таб 🎒 в CosmicHubModal.tsx:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎒 Инвентарь

ВАЛЮТЫ
  💎 Эссенция: {essence}
  💩 Слизь: {gold}        (только если показывает sense — TBD)

СЫВОРОТКИ
  🔥 Fire: {serums.fire}
  💧 Water: {serums.water}
  ... (все 16 архетипов в grid 4×4)

АРТЕФАКТЫ
  (placeholder — пусто, развивается в Phase 27+)

ОТНОШЕНИЯ С РАСАМИ
  (placeholder — список 10 рас с "?" значениями)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Tab всегда visible после cosmos unlock
- Reuse design tokens из Phase 25 restyle (dark `#1a2e1a` + pink #ec4899)
- Read-only display (no clicks нужны в Phase 26)
- Scrollable если контента много

### First Contact Event

**Trigger:** первое посещение habitable planet (любой).

**Visual:**
- Phaser cinematic light burst (reuse `CaptainBirthEffect` подход, smaller scale)
- DOM modal: «Первый контакт с {race name}»
- Race icon + lore text
- CTA «Понятно» → close

**State:** `firstContactsSeen: Record<RaceId, boolean>` — gates per-race first contact. Не повторяется.

### i18n Keys (RU/EN/ES)

Namespace: `races.{raceId}.*`:
- `name` — "Кристаллозиды" / "Crystalloids" / "Cristaloides"
- `lore_short` — описание 3-4 предложения
- `personality` — keywords
- `communication_style` — style description
- `home_planet_name` — название home planet

Namespace: `cosmic_hub.inventory.*`:
- `tab_label` — "Инвентарь"
- `section_currencies` — "Валюты"
- `section_serums` — "Сыворотки"
- `section_artifacts` — "Артефакты"
- `section_relationships` — "Отношения с расами"
- `placeholder_empty` — "пока пусто"
- `currency_essence` / `currency_gold`

Namespace: `cosmos.first_contact.*`:
- `title` — "Первый контакт"
- `cta` — "Понятно"
- (race-specific text — re-use `races.{id}.lore_short`)

### State Management

**В gameStore (или новый cosmic.races slice):**
```ts
// Phase 26 placeholder state
firstContactsSeen: Record<RaceId, boolean>  // default all false
// Phase 29 будет добавлять:
// raceRelationships: Record<RaceId, number>  // 0-100, default 50
```

**Persistence:** server-syncable (важная meta-state для cross-device).

### Cliclability (memory `feedback_clickability`)

- Inventory tab tab-button `type="button"`
- First contact modal — backdrop click closes, inner card stopPropagation
- CTA `type="button"`
- z-index modal 200 (above HUD)
- touchAction: manipulation

### Visual Language (Reuse)

- Phase 25 design tokens: `#1a2e1a` dark bg, `#ec4899` pink accents, `#fde047` gold
- WelcomeModal pattern для first contact modal (centered, dark card, pink CTA)
- _styles.ts shared tokens из CosmicHub
- Race color от affinity element (fire = #ef4444, crystal = #67e8f9, etc.)
- No Lottie (memory `feedback_animations`) — CSS keyframes + Phaser tweens
- Не tween frog.container.alpha (memory `feedback_frog_container_alpha`)

### Claude's Discretion

- Race icon placeholder strategy (если user не предоставил 10 visuals — inline SVG placeholder с race color + emoji)
- Selection algorithm для 30 habitable planets (deterministic seed vs handpicked)
- Inventory tab layout precision (grid sizing для 16 серум)
- First contact modal exact copy / timing
- Race color exact hex values
- Star Map glow rendering approach (Phaser shader / sprite overlay / Graphics)

</decisions>

<canonical_refs>
## Canonical References

### Design Spec
- `frog_obsidian/Design Notes/2026-05-18-cosmos-races-foundation.md` — Полный design 10 рас + 30 planets + Inventory tab + Phase plan

### Related Glossary
- `frog_obsidian/Glossary/Звёздная карта.md` — Star Map current state
- `frog_obsidian/Glossary/Открытие космоса.md` — cosmos gate (Phase 22)
- `frog_obsidian/Glossary/Космический магазин.md` — Cosmic Hub tabs context

### Codebase Touchpoints
- `frog_evolution_code/client/src/game/config/` — new races.ts config
- `frog_evolution_code/client/src/game/data/planetMap.json` — extend planets с inhabitant field
- `frog_evolution_code/client/src/game/scenes/starmap/` — Star Map visuals (planetRenderer, popovers)
- `frog_evolution_code/client/src/game/scenes/StarMapScene.ts` — main scene
- `frog_evolution_code/client/src/components/CosmicHub/CosmicHubModal.tsx` — add Inventory tab
- `frog_evolution_code/client/src/components/CosmicHub/` — new InventoryTab.tsx
- `frog_evolution_code/client/src/components/CosmicHub/_styles.ts` — reuse Phase 25 design tokens
- `frog_evolution_code/client/src/components/FirstContact/` — new FirstContactModal.tsx
- `frog_evolution_code/client/src/store/gameStore.ts` — firstContactsSeen state
- `frog_evolution_code/client/src/store/eventBus.ts` — new event `cosmos:first-contact`
- `frog_evolution_code/client/src/store/cosmic/types.ts` — RaceId type, PlanetInhabitant
- `frog_evolution_code/client/src/i18n/{ru,en,es}.json` — races.*, cosmic_hub.inventory.*, cosmos.first_contact.*
- `frog_evolution_code/client/src/utils/cosmosGate.ts` — useCosmosUnlocked hook (reuse)

### Planning Context
- `.planning/STATE.md`
- `.planning/ROADMAP.md` — Phase 26 entry
- `.planning/phases/25-cosmic-hub-restyle/25-04-SUMMARY.md` — design tokens reference

</canonical_refs>

<specifics>
## Specific Ideas

- **Race icons fallback:** если user не предоставил 10 visuals — inline SVG placeholder с race-color background + emoji от affinity (fire = 🔥, water = 💧, etc.). Можно заменить asset'ами позже.
- **Habitable planet selection:** algorithm — для каждой race берём 3 random planets с matching archetype (deterministic seed на basis race.id для reproducibility). Если matching planets < 3 — fallback на random.
- **Star Map glow:** Phaser sprite overlay с radial gradient texture. Reuse `ConfettiBurst.ts` texture pattern.
- **First contact deduplication:** один modal queue если игрок visits multiple habitable planets quickly. Per-race flag prevents repeat.
- **Inventory tab data:** read-only computed from existing state (essence, serums, ...). No new state нужен кроме `firstContactsSeen` и race ownership на планеты.
- **Race color sourced from affinity:** существующая `elementMapping.ts` имеет element colors — reuse.

</specifics>

<deferred>
## Deferred Ideas

- Quest mechanics (Phase 27)
- Communication inbox / messages (Phase 28)
- Relationship state effects (Phase 29 — placeholder в Phase 26)
- Race-specific events / interactions
- Combat/boss planets
- Artifacts system
- Race-specific quest types
- Cinematic per-race first contact (если будет animation overload — sequence simple)
- Cross-race relationships / wars
- Race ship visuals / fleet behaviour

</deferred>

---

*Phase: 26-cosmos-races-foundation*
*Context gathered: 2026-05-18 via PRD Express Path*
