---
date: 2026-05-18
type: tech-debt
subsystem: i18n
tags: [i18n, dead-code, cleanup, translations]
key-files:
  modified:
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json
  created:
    - .planning/tech-debt/2026-05-18-i18n-audit-REPORT.md
metrics:
  keys_before: 562
  keys_after: 499
  keys_removed: 64
  keys_added: 1
  parity_check: pass
  vitest: 142/142
  tsc: clean
---

# i18n Key Audit Summary

## One-liner

Removed 64 dead i18n keys (mission.*, ship.investigate*, cosmic_hub.carrier
stabilize residue, obsolete placeholder/tab/toast copy), added 1 missing
orphan (`cosmic_hub.serums.already_carrier`); 562 → 499 keys per locale
with RU/EN/ES parity preserved.

## What was done

1. **Audit method:** Flattened RU as canonical key set (562 keys). For each
   key, regex-searched `client/src/**/*.{ts,tsx,js,jsx}` (310 files, ~46k LOC)
   for direct literal matches. Cross-checked dead candidates against template
   patterns (`` t(`prefix.${var}`) ``) to avoid false positives. Reverse-pass:
   extracted all `t('...')` / `i18nKey="..."` / `i18next.t('...')` /
   `contentKey:` / `labelKey:` / `lockReason:` / `text_key:` literals to find
   orphans (refs without keys).

2. **Templates identified (kept keys ALIVE):**
   - `t(\`frogs.\${level}\`)` — 24 keys
   - `t(\`locations.\${loc.id}\`)` — 5 keys
   - `t(\`cosmic_hub.elements.\${el}\`)` — 18 keys
   - `t(\`hud.bonus.category.\${cat}\`)` — 5 keys
   - `t(\`cosmic_shop.items.\${id}.title|desc\`)` — 12 keys
   - `t(\`cosmic_hub.bestiary.milestone_\${threshold}\`)` — 4 keys
   - `t(\`cosmic_hub.bestiary.sound_style_\${rarity}\`)` — 4 keys
   - `t(\`rarity.\${box.bonusRarity}\`)` — 4 keys
   - `` `${activeStep.contentKey}.title|body` `` (Tutorial) — 8 keys
   - `cosmic_hub.contacts.tier.1..5` via TIER_KEYS const — 5 keys

3. **Deletions applied in 2 commits + 1 fix commit:**

   | Group  | Commit hash | Keys | Locales | Lines  |
   | ---    | ---         | ---  | ---     | ---    |
   | A: non-cosmic                                                                       | `2587e4e` | 18  | 3 | -57 (+empty `mission` container)   |
   | B+C: cosmic_hub.* + cosmos.*                                                        | `8b01ce7` | 46  | 3 | -141 (+empty `stabilize` container) |
   | Orphan fix: `cosmic_hub.serums.already_carrier`                                     | `1171826` | +1  | 3 | +3                                  |
   | **Total**                                                                           |           | -63 |   | -195                                |

4. **Translation parity verified after each commit:**
   `node client/scripts/check-translations.cjs` → `OK: all <N> keys present in RU/EN/ES`

5. **Vitest:** 142 passing, 1 skipped throughout. **tsc:** clean.

## Flagged for OTHER agent — NOT deleted

`races.{10 races}.chain.6.description` (10 keys) — referenced NOWHERE in
code. The chain step 6 is an `event` variant whose `text_key` points to
`cosmos.event.*` (5 reusable strings), so `chain.6.description` is never
looked up. These keys appear vestigial.

**Recommendation:** race chain expansion agent should confirm intent and
delete atomically if vestigial. Audit deliberately did not touch
`races.*.chain.*` per task scope.

## Orphan refs that are NOT real orphans

- `fixture.msg.0..9`, `fixture.dlg.2`, `fixture.evt.6` — test-only fixtures
  in `client/src/game/contacts/pendingEngine.test.ts`. Not real i18n keys
  (mock data for the chain engine test harness).
- `tutorial.first_box`, `tutorial.first_feed`, `tutorial.first_serum`,
  `tutorial.first_stabilize` — base `contentKey` strings used to derive
  `.title` / `.body` lookups in `TutorialOverlay.tsx`. Prefix only;
  matching `.title` and `.body` keys all present in JSON.

## Deviations

None — task executed exactly as planned.

## Files changed

- `client/src/i18n/ru.json` (-194 lines net)
- `client/src/i18n/en.json` (-194 lines net)
- `client/src/i18n/es.json` (-194 lines net)
- `.planning/tech-debt/2026-05-18-i18n-audit-REPORT.md` (new)
- `.planning/tech-debt/2026-05-18-i18n-audit-SUMMARY.md` (this file)

## Self-Check: PASSED

- All committed files exist
- Parity check passes (499 × 3)
- Vitest passes (142/142)
- TypeScript compiles clean
- All 3 commits visible in git log
