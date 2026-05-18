# Phase 27: Contacts + Messages + Relationships foundation — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** Inline brainstorm (no spec file per memory `feedback_superpowers_workflow`)

<domain>
## Phase Boundary

Phase 27 builds **foundation для relationship-driven космической gameplay**: new «Контакты» 📡 tab in Cosmic Hub (7-я вкладка), per-race linear message chain progression (scripted intro + templated middle), reply UX driving relationship score (1-10 scale), global pending cap (3 items), inline world events embedded в chain.

Phase 27 = foundation only. Phase 28 wires real quest mechanic под already-existing «Согласиться» reply buttons. Phase 29 = advanced diplomacy (branching replies, faction effects).

</domain>

<decisions>
## Implementation Decisions

### Tab — new «Контакты» 📡 (7-й в Cosmic Hub)
- Position: after «Инвентарь» (Phase 26). Tab id `'contacts'`.
- Icon: 📡 (или 💬 — planner picks). Label: i18n `cosmic_hub.tab_contacts`.
- Cosmos-gated: visible только после L18+L18 unlock (reuse `useCosmosUnlocked()` hook).
- Locked state aware (same pattern as other 6 tabs).

### Contacts list view (default tab content)
- Vertical list 10 races (from `config/races.ts` order).
- Per row: race emoji icon + race name (i18n `races.<id>.name`) + relationship tier indicator + unread dot (если pending для этой расы).
- Tap row → opens race detail screen (in-tab swap, not modal — match existing CosmicHub UX).
- Reuse Phase 25 `_styles.ts` design tokens (DARK_CARD_STYLE, PINK accents).

### Race detail screen
- Back arrow → returns to contacts list.
- Header: race emoji + name.
- Lore block: affinity + home planet name + personality short text (i18n races.<id>.personality).
- **Relationship bar**: progress bar 1-10 + tier label («враждебный»/«прохладный»/«нейтральный»/«дружелюбный»/«союзник») + numeric value.
- Tier color: red (1-2) → orange (3-4) → yellow (5-6) → green (7-8) → cyan (9-10).
- **Current pending interaction** (if any from this race):
  - For `msg` type: read-only text + «Понятно» button (auto-consumes на mount если single msg).
  - For `dialog`/`quest_hook` type: 2 buttons «Поддержать» / «Отказать», each with delta annotation («+1» / «-1»).
  - For `event` type: NOT shown in detail (auto-applied at queue pull time с toast).
- Если pending нет: показывает «Ожидание сообщения» / «Все сообщения прочитаны».

### Relationship system
- Scale: 1-10 integer (1 = ненависть, 10 = дружелюбие).
- 5 tiers: 1-2 враждебный, 3-4 прохладный, 5-6 нейтральный, 7-8 дружелюбный, 9-10 союзник.
- **Initial value**: 2 (low threshold per user request — все стартуют с подозрения).
- Clamped to [1, 10] на all delta applications.
- Persistence: server-syncable (cosmic blob).

### Chain config — `client/src/game/config/raceChains.ts`
- Linear array per race, ~10-15 items each.
- ChainItem discriminated union:
  ```ts
  type ChainItem =
    | { type: 'msg', text_key: string }
    | { type: 'dialog', text_key: string, accept_delta: number, refuse_delta: number }
    | { type: 'quest_hook', text_key: string, quest_id: string, accept_delta: number, refuse_delta: number }
    | { type: 'event', target: RaceId | 'self', delta: number, text_key: string }
  ```
- Hybrid scripted + templated structure: first 3-5 items per race = scripted intro arc (lore reveal, personality establishment); items 6-15 = templated patterns (quest_hook / dialog / event mixed).
- Each race chain is unique narrative arc fitting its personality (Огнечервы = aggressive demands, Кристаллозиды = patient/cold, etc.).
- For Phase 27: all 10 race chains должны быть defined с at least 10 items each.

### Pending engine (queue logic)
- State: `cosmic.pendingItems: PendingItem[]` (cap 3 global).
- `PendingItem = { id: string, raceId: RaceId, chainStep: number, item: ChainItem }`.
- **Pull rule**: when `pendingItems.length < 3`, engine pulls next chain step из race с **lowest progress** (chainProgress[raceId]). Tie-break: alphabetical raceId.
- **`event` type**: auto-applied at pull time — relationship delta applied immediately to `target` race, toast notification fires («Огнечервы недовольны: -1»), NOT pushed to inbox. Chain advances by 1.
- **Other types**: pushed to inbox, awaits user resolution.
- After user resolves (accept/refuse/acknowledge): item popped from `pendingItems`, chainProgress[raceId]++, relationship updated, next pull triggered automatically.
- **Cosmos-gated**: engine ticks только когда `useCosmosUnlocked() === true`. Pre-cosmos = engine idle, no first contact yet.
- **First-contact dependency**: engine pulls для расы только если `firstContactsSeen[raceId] === true` (Phase 26 flag). До first contact — race chain dormant.

### Reply UX
- «Поддержать» button: applies `accept_delta` (default +1), pops item, advances chain.
- «Отказать» button: applies `refuse_delta` (default -1), pops item, advances chain.
- «Понятно» button (для `msg` type): no delta change, just pops + advances.
- Animation: brief flash on relationship change + tier indicator pulses if tier changed.
- Pink CTA style (reuse `_styles.ts` PINK_CTA_STYLE).

### Quest hooks (stub в Phase 27)
- `quest_hook` ChainItem accepted = relationship +1 (`accept_delta`), no actual quest started.
- `quest_id` field reserved для Phase 28 wiring.
- UI shows hint text (i18n `cosmic_hub.contacts.quest_stub` = «Запрос принят. Детали скоро прояснятся.») on accept — sets expectation that quest mechanic coming.
- Phase 28 will wire `quest_id` → actual quest activation + tracker UI.

### Event ChainItem (inline world events)
- Auto-applied при queue pull (no user interaction).
- Fires toast notification using i18n `cosmos.event.notification` template («{{raceName}} {{description}}: {{delta}} к отношениям»).
- Examples в chain config:
  - `{ type: 'event', target: 'fireworms', delta: -1, text_key: 'cosmos.event.solar_flare_fireworms' }`
  - `{ type: 'event', target: 'self', delta: -1, text_key: 'cosmos.event.failed_pact_self' }` (own race penalized)
- 'self' target = same race as chain owner.
- Toast pattern: reuse existing toast system (если есть) or simple top-screen banner Phase 27 implements.

### State shape (additions to cosmic slice)
```ts
type RaceId = 'crystalloids' | 'gasouls' | ... // 10 races from Phase 26

interface CosmicState {
  // ... existing Phase 22-26 fields ...

  // Phase 27 additions:
  raceRelationships: Record<RaceId, number>      // 1-10, default 2
  chainProgress: Record<RaceId, number>          // current step per race, default 0
  pendingItems: PendingItem[]                    // global queue, cap 3
}

interface PendingItem {
  id: string              // uuid for React key + persistence
  raceId: RaceId
  chainStep: number       // index in race chain
  item: ChainItem
  createdAt: number       // timestamp for ordering (optional)
}
```

### Persistence + server sync
- localStorage keys:
  - `frog_evolution_race_relationships` (Record)
  - `frog_evolution_chain_progress` (Record)
  - `frog_evolution_pending_items` (array, serialize chain item refs by raceId+chainStep)
- Server sync через existing `gameSync.ts` cosmic blob — extend serializer/deserializer.
- Defensive load: unknown raceIds skipped, malformed pendingItems dropped с log.

### i18n
- Keys structure:
  - `cosmic_hub.tab_contacts` — tab label
  - `cosmic_hub.contacts.empty_state` — «Ожидание сообщения»
  - `cosmic_hub.contacts.all_read` — «Все сообщения прочитаны»
  - `cosmic_hub.contacts.tier.<1..5>` — 5 tier labels
  - `cosmic_hub.contacts.support` — «Поддержать»
  - `cosmic_hub.contacts.refuse` — «Отказать»
  - `cosmic_hub.contacts.acknowledge` — «Понятно»
  - `cosmic_hub.contacts.relationship_label` — «Отношение»
  - `cosmic_hub.contacts.quest_stub` — Phase 28 wiring hint
  - `cosmos.event.notification` — toast template
  - `races.<id>.chain.<step>.<field>` — message texts (~10-15 per race × 10 races = ~100-150 chain text keys total)
    - For `msg`/`dialog`/`quest_hook`: `.text` field
    - For `event`: `.description` field
  - `cosmos.event.<event_key>` — event text keys (~3-5 unique events reused across races)
- Total ~150 keys × 3 locales = ~450 entries.
- All locales (RU/EN/ES) MUST stay in parity (existing `scripts/check-translations.cjs` validates).

### Cliclability
- All buttons `type="button"` + `touchAction: manipulation`.
- z-index hierarchy: CosmicHub modal stays at 100 (existing); contacts tab inherits.
- stopPropagation on race rows (prevent backdrop close).
- Race detail back button: `onClick={(e) => { e.stopPropagation(); switchToList() }}`.

### Animations (per memory `feedback_animations`)
- NO Lottie. CSS keyframes для UI transitions (tier pulse, toast slide-in). Phaser tweens NOT needed (contacts tab = DOM-only).
- NEVER tween alpha on frog.container (memory `feedback_frog_container_alpha`) — not applicable to DOM contacts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 26 foundation (race data, state, visual)
- `client/src/game/config/races.ts` — 10 races, RaceId union, lore fields
- `client/src/store/cosmic/types.ts` — cosmic slice types (PlanetInhabitant, firstContactsSeen)
- `client/src/store/cosmic/slice.ts` — cosmic actions
- `client/src/store/persistence.ts` — localStorage save/load patterns
- `client/src/api/gameSync.ts` — server sync cosmic blob serialization

### Cosmic Hub (Phase 25 restyle + Phase 26 Inventory tab)
- `client/src/components/CosmicHub/CosmicHubModal.tsx` — tab strip + content renderer (extend для 7-й tab)
- `client/src/components/CosmicHub/InventoryTab.tsx` — Phase 26 example for new tab pattern
- `client/src/components/CosmicHub/_styles.ts` — shared design tokens (PINK, DARK_CARD_STYLE, SECTION_HEADER_STYLE, PINK_CTA_STYLE)

### i18n
- `client/src/i18n/{ru,en,es}.json` — current 402 keys × 3 locales
- `scripts/check-translations.cjs` — parity verification

### Cosmos gate
- `client/src/utils/cosmosGate.ts` — `useCosmosUnlocked()` hook

### Dev helpers pattern
- `client/src/utils/devRaces.ts` — Phase 26 dev helpers (extend with Phase 27 helpers: `__addPending`, `__resetRelationships`, `__advanceChain`, etc.)

### Workspace rules
- `/Users/shar/Documents/frog_evolution/CLAUDE.md` — orchestrator delegation rules (sub-agents for code edits)
- `/Users/shar/Documents/frog_evolution/frog_obsidian/Glossary/` — terminology (Раса, Первый контакт, Обитаемая планета, etc.)

</canonical_refs>

<specifics>
## Specific Ideas

- **Tab order in CosmicHubModal**: ship / boxes / bestiary / carriers / shop / inventory / **contacts** (7-я).
- **Initial relationship value**: 2 (per user — low threshold by default).
- **Pending cap**: 3 GLOBAL (across all races).
- **Pull priority**: lowest chainProgress[raceId] первый, tie-break alphabetical.
- **First contact integration**: chain не движется для расы до first contact (firstContactsSeen[raceId] = true).
- **No chat-log history** (per user feedback): race detail = только текущий pending + lore + relationship. Прошлые сообщения не накапливаются в UI.
- **Toast system**: если уже есть в codebase — reuse. Если нет — simple absolute-positioned banner с auto-dismiss 3 sec, CSS keyframe fadeIn/fadeOut.
- **Event narrative tone**: matches each race personality (Огнечервы losing → aggressive tone; Кристаллозиды losing → cold/disappointed tone).

</specifics>

<deferred>
## Deferred Ideas (NOT in Phase 27)

- **Real quest mechanic** — Phase 28 wires `quest_id` field to actual quest activation, quest log UI, quest tracker. Phase 27 = stub only.
- **Branching reply choices** (3+ options per dialog) — Phase 29 advanced diplomacy.
- **Faction effects** — Phase 29 (helping race X angers race Y).
- **Treaty / alliance mechanics** — Phase 30+.
- **Chat history scrollback** — explicit user feedback: not needed; only current pending + relationship state.
- **Neglect mechanic** — pending cap of 3 prevents this case naturally (player must clear queue to progress). No separate timer-based decay.
- **Reply text variants** — only 2 buttons (Поддержать / Отказать) с fixed text. Race-specific reply phrasing = Phase 29.
- **Per-race custom intro arcs** — Phase 27 ships with ~10-15 items per race. Future expansion = Phase 30+.

</deferred>

---

*Phase: 27-contacts-messages-relationships*
*Context gathered: 2026-05-18 via inline brainstorm (orchestrator + user)*
