# Phase 28: Quests — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** Inline brainstorm (no spec file per memory `feedback_superpowers_workflow`)

<domain>
## Phase Boundary

Phase 28 wires реальную quest mechanic под existing `quest_hook` ChainItem stubs из Phase 27 race chains. Adds new tab 📜 «Квесты» (8-я в Cosmic Hub) с active quest tracker UI. Quest acceptance triggered автоматически когда player tap'ает «Поддержать» на quest_hook в Contacts tab → quest появляется в Quests tab → progress tracks через existing eventBus events → reward popup при completion.

</domain>

<decisions>
## Implementation Decisions

### Tab — «Квесты» 📜 (8-я в Cosmic Hub)
- Position: после «Контакты» (Phase 27). Tab id `'quests'`.
- Icon: 📜 (или 🗺️). Label: i18n `cosmic_hub.tab_quests`.
- Cosmos-gated: visible после L18+L18 unlock (наследует Phase 22 gate).
- Tab strip уже на 7 entries — Phase 28 делает 8-й; mobile-first нужно проверить fitting (Phase 27 SUMMARY отмечал tab strip уже tight).

### Quest types (4)

#### 📦 Доставка
- Target: collect `N` серум одного element OR gold amount
- Examples:
  - «Принеси 5 fire серум» → progress increments on `cosmos:box-opened` event с element matching
  - «Накопи 1B gold» → progress checks current gold
- Reward: `essence` (range 1-5 based на quest difficulty)

#### 🔍 Разведка
- Target: visit K planets OR complete N ship missions
- Examples:
  - «Посети 10 planets» → progress increments on `starmap:planet-select` event
  - «Заверши 3 миссии» → progress increments on `cosmos:mission-complete` event
- Reward: серум random element (1-3 count)

#### ⚡ Мерж
- Target: merge to level LX OR N merges total OR merge L18+L18
- Examples:
  - «Создай лягушку L15» → progress checks `discoveredLevels.includes(15)`
  - «Сделай 50 merges» → progress increments on `frog:merged` event
- Reward: gold lumpsum (10M-500M based на difficulty)

#### 🤝 Дипломатия
- Target: raise relationship с расой X до tier Y
- Examples:
  - «Подними отношения с Кристаллозидами до 7 (дружелюбный)» → progress = current relationship
- Reward: +1 relationship + permanent bonus (TBD — может быть +1% gold income, +1 cosmic shop discount, etc.)

### Active quest cap
- **Cap 5 global** across all races (not per-race).
- New quest_hook accepts при cap reached → блокируется (race пропускает quest_hook item OR delays pending).
- UI feedback: notification «Достигнут лимит активных квестов»

### Quest activation flow
- Auto-activate when player tap'ает «Поддержать» на quest_hook ChainItem в Phase 27 Contacts tab
- Source: `quest_id` field в quest_hook ChainItem → lookup в `config/quests.ts` для quest data → push в `activeQuests`
- Если cap reached → quest_hook resolve как dialog (+1 relationship only, no quest activation), toast «Лимит активных квестов»

### Quest completion flow
- Auto-detect progress reach target value
- Reward applied immediately (gold/essence/серум/relationship)
- Quest moves из `activeQuests` в `completedQuests` (history)
- Toast / mini-modal «Квест выполнен! Награда: ...»

### Manual cancel
- Button «Отказаться» на quest card в Quests tab
- Penalty: relationship -1 с race-owner'ом quest'а
- Confirmation dialog для prevent accidental cancel

### Quest data — `client/src/game/config/quests.ts`
```ts
type QuestType = 'delivery' | 'exploration' | 'merge' | 'diplomacy'

type QuestTarget =
  | { kind: 'serum_count', element: Element, value: number }
  | { kind: 'gold_amount', value: number }
  | { kind: 'planets_visited', value: number }
  | { kind: 'missions_complete', value: number }
  | { kind: 'merge_to_level', level: number }
  | { kind: 'merge_count', value: number }
  | { kind: 'raise_relationship', raceId: RaceId, tier: number }

type QuestReward =
  | { kind: 'essence', value: number }
  | { kind: 'serum', element: Element | 'random', count: number }
  | { kind: 'gold', value: number }
  | { kind: 'relationship_and_bonus', raceId: RaceId, bonus_id: string }

interface QuestConfig {
  id: QuestId  // matches quest_id из Phase 27 raceChains
  raceId: RaceId  // owner race
  type: QuestType
  target: QuestTarget
  reward: QuestReward
  description_key: string  // i18n key
  difficulty: 'easy' | 'medium' | 'hard'
}

QUESTS: Record<QuestId, QuestConfig>
```

Phase 27 chains имеют ~60 quest_id stubs (20 base × 3 variants _b/_c). Phase 28 должен заполнить QuestConfig для каждого.

### State shape (cosmic slice extension)

```ts
interface ActiveQuest {
  id: string  // unique runtime id
  questId: QuestId  // matches config
  raceId: RaceId
  type: QuestType
  target: QuestTarget
  progress: number  // current count
  startedAt: number
}

interface CompletedQuest {
  id: string
  questId: QuestId
  raceId: RaceId
  completedAt: number
  rewardClaimed: QuestReward
}

cosmic.activeQuests: ActiveQuest[]  // cap 5
cosmic.completedQuests: CompletedQuest[]  // history, possibly capped (e.g. last 50)
```

### Progress tracking — eventBus hooks
- `frog:merged` → increment merge_count quests, check merge_to_level quests
- `cosmos:box-opened` → increment serum_count quests (по element)
- `starmap:planet-select` → increment planets_visited quests
- `cosmos:mission-complete` → increment missions_complete quests
- `contacts:relationship-delta` → check raise_relationship quests
- Gold amount quests → polling (или check on gold-changed event)

### Quest tracker UI (Quests tab)
- Header: «Активные квесты: 3/5»
- List of quest cards:
  - Race emoji + race name + quest type icon
  - Description text (i18n key)
  - Progress bar (current / target)
  - Reward preview (icon + value)
  - «Отказаться» secondary button (if user wants)
- Empty state: «Нет активных квестов. Открой Контакты чтобы принять.»
- Below: «Выполненные квесты» collapsible — list completedQuests с reward summary

### Persistence + server sync
- localStorage keys: `frog_evolution_active_quests`, `frog_evolution_completed_quests`
- Server sync через existing cosmic blob `gameSync.snapshotForSave/restoreFromSnapshot`
- Defensive load: unknown questId skipped, malformed progress clamped, completedQuests capped at last 100

### i18n
- Keys structure:
  - `cosmic_hub.tab_quests` — tab label
  - `cosmic_hub.quests.header_active` — «Активные квесты: {{current}}/{{cap}}»
  - `cosmic_hub.quests.empty_state` — «Нет активных квестов»
  - `cosmic_hub.quests.completed_header` — «Выполненные»
  - `cosmic_hub.quests.cap_reached` — «Лимит квестов: примите позже»
  - `cosmic_hub.quests.cancel_confirm` — «Отказаться? Отношения с {{race}} упадут на 1»
  - `cosmic_hub.quests.reward_popup_title` — «Квест выполнен!»
  - `cosmic_hub.quests.type.{delivery,exploration,merge,diplomacy}` — type labels
  - `quests.<id>.description` — per-quest description (~60 keys)
  - `quests.<id>.short` — short label for card (~60 keys)
- Total ~140 keys × 3 locales = ~420 entries.

### Cliclability
- All buttons `type="button"` + `touchAction: manipulation`
- z-index hierarchy: Cosmic Hub modal 100 (existing); reward popup modal 150
- stopPropagation на quest cards (prevent backdrop close)
- Confirm dialog для cancel = standalone modal

### Animations
- NO Lottie. CSS keyframes для:
  - Progress bar fill transition (smooth interpolation)
  - Quest card pulse при completion (before reward popup)
  - Reward popup slide-in
- Phaser tweens NOT needed (Quests = DOM-only).

</decisions>

<canonical_refs>
## Canonical References

### Phase 27 foundation (quest_hook source)
- `client/src/game/config/raceChains.ts` — 200 ChainItem с `quest_hook` entries (~60 unique quest_id)
- `client/src/store/cosmic/types.ts` — ChainItem types
- `client/src/store/cosmic/slice.ts` — `resolveAccept` action (need extension: trigger quest activation)
- `client/src/store/eventBus.ts` — Phase 27 events ('contacts:relationship-delta', 'contacts:event-applied')

### Cosmic Hub
- `client/src/components/CosmicHub/CosmicHubModal.tsx` — tab strip (8-й tab wiring)
- `client/src/components/CosmicHub/ContactsTab.tsx` — Phase 27 pattern reference
- `client/src/components/CosmicHub/_styles.ts` — design tokens

### Existing eventBus events for progress hooks
- `frog:merged` — needs verification (check current name)
- `cosmos:box-opened` — Phase 22 box flow
- `starmap:planet-select` — Phase 22 popovers
- `cosmos:mission-complete` — Phase 22 ship missions
- `contacts:relationship-delta` — Phase 27

### Race + relationship data
- `client/src/game/config/races.ts` — 10 races
- Phase 27 state: `raceRelationships`, `chainProgress`

### Workspace rules
- `/Users/shar/Documents/frog_evolution/CLAUDE.md` — orchestrator delegation
- `/Users/shar/Documents/frog_evolution/frog_obsidian/Glossary/` — terminology

</canonical_refs>

<specifics>
## Specific Ideas

- **Quest difficulty tiers**: easy = ~5 progress / quick reward; medium = ~25; hard = ~100. Mapped to quest_id base/_b/_c suffixes (base = easy, _b = medium, _c = hard).
- **Reward magnitudes — placeholder, балансировка later**:
  - essence: easy=1, medium=3, hard=5
  - серум: easy=1, medium=2, hard=3
  - gold: easy=10M, medium=100M, hard=500M
  - diplomacy bonus: TBD per quest
- **Tab 8 fit**: на mobile-first viewport — нужно проверить tab strip rendering. Если overflow — consider scroll-strip или icon-only tabs.
- **Reward popup**: модальный + closeable + auto-dismiss 5s (TBD). Reuse pattern из Phase 26 FirstContactModal.
- **Empty state CTA**: «Открой Контакты чтобы принять квест» — линк на Contacts tab.

</specifics>

<deferred>
## Deferred Ideas (NOT в Phase 28)

- **Quest chain dependencies** (quest A unlocks quest B) — Phase 29+
- **Time-limited daily quests** — Phase 30+ (не fits player-paced design Phase 27)
- **Multi-step quests** (sub-objectives) — Phase 29+
- **Boss quests / raid mechanic** — TBD
- **Quest sharing / co-op** — out of scope
- **Quest cosmetic rewards** (skins, badges) — Phase 30+
- **Reward auto-claim button** — все rewards auto-applied; manual claim not needed
- **Quest decline без penalty** — на Phase 28 принципы (decline = penalty); soft-decline для Phase 29

</deferred>

---

*Phase: 28-quests*
*Context gathered: 2026-05-18 via inline brainstorm (orchestrator + user)*
