# i18n Key Audit Report — 2026-05-18

## Scope

Audited `client/src/i18n/{ru,en,es}.json` (562 keys × 3 locales) against
all source under `client/src/**/*.{ts,tsx,js,jsx}` (310 files, ~46k LOC).

## Method

1. Flattened RU as canonical key set (RU=EN=ES parity verified — 562 each).
2. For each key: regex search across corpus for literal occurrence.
3. For dead candidates: secondary check for template patterns (`t(\`prefix.${var}\`)`).
4. Cross-checked by extracting all `t('...')` / `i18nKey="..."` / `i18next.t('...')` /
   `contentKey:` / `labelKey:` / `lockReason:` / `text_key:` literals from the corpus
   and intersecting with key set to find orphans (refs without keys).

## Templates that hide direct grep hits (resolved)

| Template literal in code                                  | Keys it covers                                                     | Source file                                              |
| ---                                                       | ---                                                                | ---                                                      |
| `` t(`frogs.${level}`) ``                                 | `frogs.1` .. `frogs.24` (24 keys)                                  | DiscoveryModal/ShopModal/FrogShopModal/RareCrateModal/SettingsModal |
| `` t(`locations.${loc.id}`) ``                            | `locations.1`,`2`,`3`,`4`,`6` (5 keys; `5` absent because skipped) | LocationStack/SettingsModal                              |
| `` t(`cosmic_hub.elements.${el}`) ``                      | `cosmic_hub.elements.*` (18 keys, full element set)                | CosmicShopTab/InventoryTab/BoxesTab/ElementGrid/CascadeRevealModal/CarrierInfoCard/BulkOpenSummary |
| `` t(`hud.bonus.category.${cat}`) ``                      | `hud.bonus.category.{fire,water,stone,shadow,other}` (5)           | HUD/ActiveBonusesTooltip                                 |
| `` t(`cosmic_shop.items.${id}.title|desc`) ``             | `cosmic_shop.items.*.title|desc` (12 keys, 6 items × 2)            | CosmicHub/CosmicShopTab                                  |
| `` t(`cosmic_hub.bestiary.milestone_${threshold}`) ``     | `milestone_10/24/96/576`                                           | CosmicHub/bestiary/MilestoneToast                        |
| `` t(`cosmic_hub.bestiary.sound_style_${rarity}`) ``      | `sound_style_{common,epic,legendary,rare}`                         | CosmicHub/bestiary/BestiaryDetailModal                   |
| `` t(`rarity.${box.bonusRarity}`) ``                      | `rarity.{common,epic,legendary,rare}`                              | CosmicHub/BoxesTab                                       |
| `` `${activeStep.contentKey}.title|body` `` (Tutorial)    | `tutorial.first_{box,feed,serum,stabilize}.{title,body}` (8 keys)  | Tutorial/TutorialOverlay + tutorialSteps                 |
| `cosmic_hub.contacts.tier.1..5` (TIER_KEYS in raceChains) | `cosmic_hub.contacts.tier.{1,2,3,4,5}`                             | game/config/raceChains.ts                                |

All keys behind these templates are ALIVE.

## DEAD keys — safe to delete (verified)

Total: **64 keys** removed × 3 locales = **192 lines removed**.

### Group A — outside cosmic_hub/cosmos/races namespaces (no agent overlap)

- `frog_shop.income_unit`
- `settings.sounds_stub`
- `ship.arrived_toast`
- `ship.investigate`
- `ship.investigate_tooltip_capped`
- `ship.investigate_tooltip_transit`
- `mission.box_received_toast`
- `mission.defend_flash`
- `mission.defend_label`
- `mission.hotspot_label`
- `mission.intro_warmup`
- `mission.rhythm_label`
- `mission.rhythm_tap_button`
- `mission.skip`
- `mission.time_left`
- `mission.title_defend`
- `mission.title_hotspot`
- `mission.title_rhythm`

Mission namespace (12 keys) is fully legacy — gameplay for hotspot/defend/rhythm
missions was removed; only `cosmic_hub.lock_first_mission` and ship/crew copy remain.

### Group B — `cosmic_hub.*` defunct features (verified — no refs in code)

Phase 22 carrier-stabilized removal residue (per `eventBus.ts:72` comment
"Phase 22: carrier-stabilized removed"):

- `cosmic_hub.carrier.ceiling_high`
- `cosmic_hub.carrier.ceiling_label`
- `cosmic_hub.carrier.ceiling_low`
- `cosmic_hub.carrier.ceiling_mid`
- `cosmic_hub.carrier.dispose.body`
- `cosmic_hub.carrier.dispose.toast_no_recovery`
- `cosmic_hub.carrier.dispose.toast_recovered`
- `cosmic_hub.carrier.dispose.warning`
- `cosmic_hub.carrier.feed_fail`
- `cosmic_hub.carrier.merge_blocked_stabilized`
- `cosmic_hub.carrier.merge_blocked_unstabilized`
- `cosmic_hub.carrier.progress_stabilized`
- `cosmic_hub.carrier.stabilize.a_high`
- `cosmic_hub.carrier.stabilize.b_mid`
- `cosmic_hub.carrier.stabilize.c_low`
- `cosmic_hub.carrier.stabilize.modal_label`
- `cosmic_hub.carrier.stabilize.rolling`
- `cosmic_hub.carrier.stabilize.s_top`
- `cosmic_hub.carrier.stabilize.tap_to_dismiss`
- `cosmic_hub.carrier.stabilize.title`

Old serum-shaping UI (replaced by `cosmic_hub.bestiary.location_*`):

- `cosmic_hub.serums.location_continent`
- `cosmic_hub.serums.location_forest`
- `cosmic_hub.serums.location_puddle`
- `cosmic_hub.serums.location_swamp`
- `cosmic_hub.serums.mis_tap_msg`
- `cosmic_hub.serums.undo_hint`

Old serum rarity-section breakdown (replaced by `cosmic_hub.serums_empty`
+ new tab layout):

- `cosmic_hub.serums.section_common`
- `cosmic_hub.serums.section_count`
- `cosmic_hub.serums.section_empty`
- `cosmic_hub.serums.section_epic`
- `cosmic_hub.serums.section_legendary`
- `cosmic_hub.serums.section_rare`

Old placeholder copy (replaced by `cosmic_hub.boxes.empty_placeholder` etc.):

- `cosmic_hub.bestiary_placeholder`
- `cosmic_hub.boxes_placeholder`
- `cosmic_hub.scouts_placeholder`
- `cosmic_hub.serums_placeholder`

Other:

- `cosmic_hub.bulk.summary_row` (only `summary_title` and `summary_close` used now)
- `cosmic_hub.crew_tired` (crew warning copy never wired)
- `cosmic_hub.tab_boxes` (BoxesTab uses `cosmic_hub.tab_carriers`)
- `cosmic_hub.tab_scouts` (no scouts UI surfaced)
- `cosmic_hub.toast_grouped` (only `cosmic_hub.toast_*` used now is none — see deletion)
- `cosmic_hub.toast_open_box`
- `cosmic_hub.toast_scout_returned`
- `cosmic_hub.toast_scout_returned_plural`
- `cosmic_hub.slot.tap_to_skip` (only `cosmic_hub.slot.skip` is used)

### Group C — `cosmos.*` dead

- `cosmos.first_contact.subtitle_template` (FirstContactModal uses static `cosmos.first_contact.subtitle` — wait, JSON has `subtitle_template` only; modal uses `.title` and `.cta`)

## ORPHANS — code refs missing in JSON

| Key                                  | Referenced in                                    | Action                                  |
| ---                                  | ---                                              | ---                                     |
| `cosmic_hub.serums.already_carrier`  | `client/src/game/scenes/main/FrogInteraction.ts:215, 358` (via `i18next.t`) | **Add key to RU/EN/ES** (REAL ORPHAN)   |
| `fixture.msg.0..9`, `fixture.dlg.2`, `fixture.evt.6` | `client/src/game/contacts/pendingEngine.test.ts` | False positive — test fixtures, no i18n action needed |
| `tutorial.first_box`, `tutorial.first_feed`, `tutorial.first_serum`, `tutorial.first_stabilize` | `tutorialSteps.ts` contentKey base | False positive — prefix only, `.title`/`.body` keys exist |

## Flagged for OTHER agent (not deleting)

Per task scope: do NOT touch keys in `races.*.chain.*` (owned by race chain
expansion agent).

The 10 keys `races.{cometfolk,crystalloids,fireworms,forestcores,gasouls,liquidoids,mechanidons,plasmaspirits,tenebrians,timeweavers}.chain.6.description`
are referenced NOWHERE in code. The race chain at step 6 is an `event` variant
whose `text_key` references `cosmos.event.*` (5 reusable strings), NOT the
race's own `chain.6.description`. The `chain.6.description` keys appear to be
either:
  - vestigial design notes that should be removed alongside the race chain
    schema update, OR
  - reserved for future use (legend/description tooltip).

**Recommendation for race chain agent:** confirm intent; if vestigial, delete
all 10 atomically.

## Action plan — APPLIED

Applied in three commits with parity verified after each:

1. Commit `chore(i18n): remove 18 dead non-cosmic keys`
   — Group A (non-cosmic): 18 keys × 3 = 54 lines + empty `mission` container.
   — Parity: 562 → 544.
2. Commit `chore(i18n): remove 46 dead cosmic_hub/cosmos keys`
   — Group B + C: 46 keys × 3 = 138 lines + empty `stabilize` container.
   — Parity: 544 → 498.
3. Commit `fix(i18n): add missing cosmic_hub.serums.already_carrier key`
   — Orphan fixed: added to RU/EN/ES.
   — Parity: 498 → 499.

After each commit: `node client/scripts/check-translations.cjs` reported OK.
`vitest run`: 142/142 pass throughout.

## Final state

**499 keys** per locale (RU = EN = ES). Down from 562.

Net change: **-63 keys × 3 = 189 fewer JSON lines** (plus 2 empty container blocks pruned).
