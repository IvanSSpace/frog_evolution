---
phase: 27-contacts-messages-relationships
plan: 01
subsystem: ui-foundation
tags: [zustand, typescript, i18n, persistence, server-sync, discriminated-union, relationship-system]

# Dependency graph
requires:
  - phase: 26-cosmos-races-foundation
    provides: |
      RaceId union (10 races), ALL_RACE_IDS array, makeInitialCosmicSlice pattern с per-race iteration,
      firstContactsSeen defensive load template (loadCosmicSlice + gameSync.snapshotForSave/loadGameState),
      cosmic blob server-sync infrastructure, eventBus typed payloads, _styles.ts design tokens.
provides:
  - "ChainItem discriminated union (msg | dialog | quest_hook | event) — exported from game/config/raceChains.ts"
  - "PendingItem interface (id/raceId/chainStep/item/createdAt) — global pending queue payload type"
  - "RACE_CHAINS: Record<RaceId, readonly ChainItem[]> skeleton (10 empty arrays — Plan 27-02 fills data)"
  - "Relationship constants: RELATIONSHIP_MIN=1, RELATIONSHIP_MAX=10, INITIAL_RELATIONSHIP=2, CHAIN_PENDING_CAP=3"
  - "RelationshipTier union (hostile/cool/neutral/friendly/ally) + getRelationshipTier(value) helper (clamps via Math.floor + min/max)"
  - "TIER_COLORS map (CSS hex, NOT Phaser hex — DOM-only consumed by RelationshipBar in Plan 27-04)"
  - "TIER_I18N_KEYS map (cosmic_hub.contacts.tier.1..5)"
  - "CosmicSlice extended with raceRelationships/chainProgress/pendingItems (initial: 2 per race / 0 per race / [])"
  - "loadCosmicSlice defensive load для всех 3 новых полей (clamp + shape validation + unknown-raceId drop)"
  - "gameStore subscribe + saveCosmicSlice payload includes new fields (auto-persist on change)"
  - "gameSync.snapshotForSave + loadGameState cosmic blob includes new fields (cross-device sync)"
  - "i18n RU/EN/ES parity skeleton: cosmic_hub.tab_contacts + cosmic_hub.contacts.* (11 keys) + cosmos.event.notification (15 new keys per locale, 402→417)"
affects:
  - "Plan 27-02 (chain data fill: RACE_CHAINS arrays + per-race races.<id>.chain.<step>.* i18n keys)"
  - "Plan 27-03 (pending engine: pulls from RACE_CHAINS[raceId][chainProgress], writes pendingItems, applies relationship deltas)"
  - "Plan 27-04 (UI: tab strip + race detail + RelationshipBar reads TIER_COLORS/TIER_I18N_KEYS via getRelationshipTier)"
  - "Plan 27-05 (toast system: consumes cosmos.event.notification template)"
  - "Plan 27-06 (smoke + finalize)"

# Tech tracking
tech-stack:
  added: []  # no new deps; reuses zustand/i18next/typescript
  patterns:
    - "Plan 27-01: extend cosmic slice через 3-step ритуал (CosmicSlice + makeInitialCosmicSlice + loadCosmicSlice defensive + gameStore subscribe payload + gameSync.cosmic blob) — mirror Phase 26-01 firstContactsSeen template"
    - "Discriminated union для ChainItem (4 variants) с item-type stripping в defensive load (knownTypes Set)"
    - "RACE_CHAINS skeleton built через typed `for` loop (Object.fromEntries теряет literal-key TS typing — pattern из RACES_BY_ID в races.ts)"
    - "ALL_RACE_IDS_LOCAL hardcode в raceChains.ts (избегаем циклическую deps types.ts → races.ts → raceChains.ts → types.ts)"
    - "TIER_COLORS — CSS hex (#ef4444 etc), NOT Phaser hex (0xef4444) — contacts tab DOM-only"
    - "Defensive load для pendingItems: shape-validate каждую entry (id:string + knownRaceId + non-negative chainStep + knownType), strip invalid silently"

key-files:
  created:
    - "client/src/game/config/raceChains.ts — ChainItem union + PendingItem + RACE_CHAINS skeleton + 4 relationship constants + RelationshipTier + getRelationshipTier + TIER_COLORS + TIER_I18N_KEYS (11 exports, 161 LOC)"
  modified:
    - "client/src/store/cosmic/types.ts — CosmicSlice + 3 fields, makeInitialCosmicSlice seeds defaults, INITIAL_RELATIONSHIP import"
    - "client/src/store/persistence.ts — loadCosmicSlice defensive load для raceRelationships (clamp [1,10] int) + chainProgress (non-negative int) + pendingItems (4-knownType + knownRaceId shape filter)"
    - "client/src/store/gameStore.ts — subscribe change-detection OR clause + saveCosmicSlice payload (3 new fields)"
    - "client/src/api/gameSync.ts — snapshotForSave cosmic blob + loadGameState hydrate (3 new fields, cross-device sync)"
    - "client/src/i18n/ru.json — cosmic_hub.tab_contacts + cosmic_hub.contacts.* + cosmos.event.notification (15 keys)"
    - "client/src/i18n/en.json — same parity (Contacts/hostile.../Queue.../...)"
    - "client/src/i18n/es.json — same parity (Contactos/hostil.../Cola.../...)"

key-decisions:
  - "ALL_RACE_IDS_LOCAL hardcoded в raceChains.ts вместо import — избегаем циклическую dependency через cosmic/types.ts (types → raceChains → types loop)"
  - "Defensive load клампит relationship score через Math.max(MIN, Math.min(MAX, Math.floor(v))) — три безопасных операции вместо ad-hoc clamp; одновременно дробные → integer + границы enforced"
  - "TIER_COLORS — CSS hex (DOM RelationshipBar в Plan 27-04), НЕ Phaser hex — contacts tab полностью DOM (per CONTEXT cliclability section)"
  - "RACE_CHAINS skeleton via typed `for` loop (mirror RACES_BY_ID в races.ts) — Object.fromEntries теряет TS literal-key typing"
  - "Defensive load для pendingItems strip'ит entries с неизвестными type'ами (knownTypes Set) — forward-compat для будущих ChainItem variants без break старых клиентов"
  - "i18n tier лейблы хранятся в cosmic_hub.contacts.tier.{1..5} (numeric keys, не tier-name keys) — TIER_I18N_KEYS map делает translation surface stable если внутренние tier-id'шки переименуются"
  - "CHAIN_PENDING_CAP=3 NOT enforced в defensive load (forward-compat если cap raised в будущем) — engine Plan 27-03 enforce'ит при pull, persisted array can technically exceed без crash"

patterns-established:
  - "Pattern: новый pending-engine state field — defensive load shape-validate'ит каждую entry в массиве (id:string + знакомый raceId + non-negative integer chainStep + знакомый item.type), strip'ит invalid silently без log spam"
  - "Pattern: server-sync новых cosmic fields — snapshotForSave добавляет в cosmic blob, loadGameState if-in hydrate'ит, loadCosmicSlice defensive load валидирует на следующем boot — defense-in-depth"
  - "Pattern: relationship constant exports — single source of truth в raceChains.ts (RELATIONSHIP_MIN/MAX/INITIAL/CAP) consumed by types.ts seed + persistence clamp + engine логика Plan 27-03"

requirements-completed:
  - PHASE27-RELATIONSHIP-STATE
  - PHASE27-RELATIONSHIP-TIERS
  - PHASE27-CHAIN-CONFIG
  - PHASE27-PERSISTENCE
  - PHASE27-SERVER-SYNC

# Metrics
duration: 10m
completed: 2026-05-18
---

# Phase 27 Plan 01: Foundation — types + state + persistence + i18n skeleton Summary

**ChainItem discriminated union + 3 cosmic state fields (raceRelationships=2 per race, chainProgress=0 per race, pendingItems=[]) wired through Zustand store + localStorage defensive load + gameSync cross-device blob + RU/EN/ES i18n skeleton (15 keys per locale, 402→417 PARITY).**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-18T12:37:49Z
- **Completed:** 2026-05-18T12:48:06Z
- **Tasks:** 3
- **Files modified:** 7 (1 created + 6 modified)

## Accomplishments

- `raceChains.ts` ships с полным foundation API surface (11 exports): ChainItem union, PendingItem, 4 numeric constants, RelationshipTier + helper, 2 maps (CSS colors + i18n keys), RACE_CHAINS skeleton
- CosmicSlice + 3 new fields seamlessly persisted (localStorage + server cosmic blob) с defensive load клампящим/strip'ящим invalid input
- RU/EN/ES i18n skeleton ready: tier лейблы (враждебный/cool/neutral/friendly/ally — локализованы), action buttons (Поддержать/Refuse/Apoyar), tab label, event notification template, parity 417/417/417
- Полный build chain green: tsc clean, eslint clean, check-translations 0 missing / 0 extra, vitest 104 PASS / 0 FAIL (3 pre-existing Phase 22 suite-import failures unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: race chain types + relationship constants + RACE_CHAINS skeleton** — `85305ee` (feat)
2. **Task 2: cosmic state + persistence + server sync** — `0d3e658` (feat)
3. **Task 3: i18n RU/EN/ES skeleton (tab_contacts + contacts.* + cosmos.event.notification)** — `03ae8c7` (feat)
4. **Post-Task-2 prettier autofix** — `476bbe7` (style) [Rule 1 deviation, см. ниже]

## Files Created/Modified

- `client/src/game/config/raceChains.ts` (NEW, 161 LOC) — ChainItem union + PendingItem + RACE_CHAINS skeleton + relationship constants + tier mapping + colors + i18n key map
- `client/src/store/cosmic/types.ts` — CosmicSlice extended с 3 полями, makeInitialCosmicSlice seeds INITIAL_RELATIONSHIP per race + chainProgress=0 per race + pendingItems=[]
- `client/src/store/persistence.ts` — defensive load всех 3 новых полей в loadCosmicSlice (mirror firstContactsSeen pattern)
- `client/src/store/gameStore.ts` — subscribe change-detection + saveCosmicSlice payload extended
- `client/src/api/gameSync.ts` — snapshotForSave cosmic blob + loadGameState hydrate (cross-device sync)
- `client/src/i18n/ru.json` — +15 keys (cosmic_hub.tab_contacts + cosmic_hub.contacts.{8 string keys + 5 tier subkeys} + cosmos.event.notification)
- `client/src/i18n/en.json` — same parity
- `client/src/i18n/es.json` — same parity

## Decisions Made

- **ALL_RACE_IDS_LOCAL hardcoded в raceChains.ts** — единственный способ избежать циклическую dependency `cosmic/types.ts ← raceChains.ts ← cosmic/types.ts (PendingItem уже импортируется types'ами для CosmicSlice; race id list должен жить здесь без обратного импорта)`. Compile-time check `readonly RaceId[]` ловит drift если RaceId расширится.
- **Defensive load клампит через Math.max(MIN, Math.min(MAX, Math.floor(v)))** — три операции в правильном порядке: дробные → integer (Math.floor) → нижняя граница (Math.max) → верхняя граница (Math.min). Корректно handle'ит negative + dubble + overflow.
- **TIER_COLORS — CSS hex (#ef4444…) НЕ Phaser hex (0xef4444…)** — contacts tab полностью DOM (per CONTEXT cliclability + memory feedback_animations). Phaser RaceGlowController остаётся отдельно (Phase 26-03), здесь — отдельное colorspace.
- **RACE_CHAINS skeleton via IIFE typed `for` loop** — mirror RACES_BY_ID pattern. Object.fromEntries возвращает `Record<string, ChainItem[]>`, теряя TS literal-key narrowing. Typed loop сохраняет `Record<RaceId, readonly ChainItem[]>`.
- **CHAIN_PENDING_CAP=3 NOT enforced в defensive load** — forward-compat: если cap raised в будущем (Phase 29+), старый persisted array длиной 4-5 не должен truncate'нуться при load. Engine Plan 27-03 enforce'ит на pull (`while pendingItems.length < CAP`).
- **i18n tier labels — `cosmic_hub.contacts.tier.{1..5}` (numeric subkeys)** — TIER_I18N_KEYS map делает абстракцию: tier id 'hostile' → key 'cosmic_hub.contacts.tier.1'. Если внутренние tier id'шки переименуются (e.g. 'враждебный' → 'enemy'), i18n структура остаётся stable.
- **knownTypes Set('msg','dialog','quest_hook','event') в pendingItems defensive load** — forward-compat: Plan 27-03 может добавить 5-й type variant, defensive load strip'ит unknown (не crash); update knownTypes set требуется в той же фазе чтобы новый variant persisted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Multi-line import не соответствовал prettier formatting**
- **Found during:** post-Task-2 build chain validation (`npx eslint`)
- **Issue:** Multi-line `import { RELATIONSHIP_MIN, RELATIONSHIP_MAX } from '...'` в persistence.ts срабатывал prettier/prettier правило (короткие named imports должны быть single-line)
- **Fix:** Collapsed 4-line import (`import {\n  A,\n  B,\n} from '...'`) → single-line `import { A, B } from '...'`
- **Files modified:** `client/src/store/persistence.ts`
- **Verification:** `npx eslint <files>` exit 0 (no issues), `npx tsc --noEmit` exit 0
- **Committed in:** `476bbe7` (separate style commit per execute-plan protocol — never amend prior task commit)

---

**Total deviations:** 1 auto-fixed (1 prettier formatting bug)
**Impact on plan:** Trivial style-only fix. No semantic change to types, state, или persistence behavior. Caught by build chain validation (eslint) which плана не вызывал явно — деяние правил GSD executor (run full build chain after final task).

## Issues Encountered

None — plan executed exactly as written. All 3 task acceptance gates passed first try (tsc clean, file existence + grep counts матчат, parity validator green). Only post-completion eslint surfaced one prettier autofix, обработан per Rule 1.

## User Setup Required

None — no external service configuration, no env vars, no manual UI/UX verification (this plan adds types/state/i18n keys only; UI ships в Plan 27-04).

## Validation Results

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `cd client && npx tsc --noEmit` | exit 0, 0 errors |
| ESLint | `cd client && npx eslint src/game/config/raceChains.ts src/store/cosmic/types.ts src/store/persistence.ts src/store/gameStore.ts src/api/gameSync.ts` | "No issues found" |
| i18n parity | `cd client && node scripts/check-translations.cjs` | 417 ru / 417 en / 417 es PASS (0 missing / 0 extra; 402 baseline + 15 new keys per locale) |
| Vitest | `cd client && npx vitest run` | 104 PASS / 0 FAIL (3 pre-existing Phase 22 suite-import failures unchanged) |
| Acceptance grep gates (Task 1) | 7/7 (ChainItem/PendingItem/RACE_CHAINS/INITIAL/CAP/getTier/TIER_COLORS+I18N_KEYS) | PASS |
| Acceptance grep gates (Task 2) | raceRelationships in 4 files (types:6/persistence:6/gameSync:3/gameStore:2) | PASS |
| Acceptance smoke (Task 3) | tab_contacts/support/tier.1/acknowledge/quest_stub/pending_count/cosmos.event.notification — non-empty strings в RU/EN/ES | PASS |

## Self-Check: PASSED

Files verified to exist:
- FOUND: `client/src/game/config/raceChains.ts` (NEW)
- FOUND: `client/src/store/cosmic/types.ts` (modified)
- FOUND: `client/src/store/persistence.ts` (modified)
- FOUND: `client/src/store/gameStore.ts` (modified)
- FOUND: `client/src/api/gameSync.ts` (modified)
- FOUND: `client/src/i18n/ru.json` / `en.json` / `es.json` (modified)

Commits verified to exist в `git log --oneline`:
- FOUND: `85305ee` feat(27-01): race chain types + relationship constants + RACE_CHAINS skeleton
- FOUND: `0d3e658` feat(27-01): cosmic state + persistence + server sync for relationships/chainProgress/pendingItems
- FOUND: `03ae8c7` feat(27-01): i18n skeleton for cosmic_hub.tab_contacts + contacts.* + cosmos.event.notification (RU/EN/ES parity)
- FOUND: `476bbe7` style(27-01): collapse multi-line raceChains import to single line per prettier

## Next Plan Readiness

**Ready для Plan 27-02 (chain data fill):**
- `RACE_CHAINS` skeleton ждёт data fill — Plan 27-02 заменяет 10 empty arrays на ~10-15 items per race
- i18n RU/EN/ES будут расширены ~150 keys (races.<id>.chain.<step>.{text|description} + cosmos.event.<event_key>)
- ChainItem variants готовы — Plan 27-02 пишет mix scripted intro (5 items per race) + templated middle (5-10 items)

**Ready для Plan 27-03 (pending engine):**
- `pendingItems: []` + `chainProgress[id] = 0` + `raceRelationships[id] = 2` per race seed готов
- CHAIN_PENDING_CAP=3 constant exported для engine pull-rule
- `applyAccept`/`applyRefuse`/`applyEvent` actions Plan 27-03 будут писать в новые state fields

**Ready для Plan 27-04 (UI tab + race detail):**
- `cosmic_hub.tab_contacts` лейбл + `cosmic_hub.contacts.*` keys готовы
- getRelationshipTier + TIER_COLORS + TIER_I18N_KEYS — single import surface для RelationshipBar
- CosmicTab union ещё не расширен 'contacts' literal — Plan 27-04 добавит (out of scope этого плана; types.ts touched на 3 поля + не touchnut CosmicTab чтобы не ломать tabs persistence в 27-01)

**Ready для Plan 27-05 (toast):**
- `cosmos.event.notification` template с 3-placeholder ({{raceName}}/{{description}}/{{delta}}) готов в RU/EN/ES

**No blockers.** Все 5 REQ-IDs (PHASE27-RELATIONSHIP-STATE/RELATIONSHIP-TIERS/CHAIN-CONFIG/PERSISTENCE/SERVER-SYNC) — ✓ ready для marking.

---
*Phase: 27-contacts-messages-relationships*
*Completed: 2026-05-18*
