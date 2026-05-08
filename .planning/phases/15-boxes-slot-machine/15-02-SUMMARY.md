---
phase: 15-boxes-slot-machine
plan: 02
status: complete
date: 2026-05-08
---

# Plan 15-02 — BoxesTab UI Summary

## Implemented

- **`client/src/components/CosmicHub/BoxesTab.tsx`** — переписан с Phase 11 stub до полного functional UI:
  - Empty state placeholder (i18n `cosmic_hub.boxes.empty_placeholder`)
  - Box cards: element-tinted dot (`ELEMENT_TINT[element]`), planet name «С {{planet}}», bonus badge (если bonusRarity — rare/epic/legendary), tap-to-open hint
  - Sort: createdAt DESC (новые первыми) + filter !opened
  - При `boxes.length >= 5` — «Открыть все ({{count}})» button с handleOpenAll
  - Lazy mount of `CascadeRevealModal` + `BulkOpenSummary` (Suspense fallback null)
  - `onClose` prop closes Cosmic Hub при tap на box / open-all (UX: full-screen modal)
- **`client/src/components/CosmicHub/CosmicHubModal.tsx`** — pass `onClose` to BoxesTab.
- i18n keys (Plan 15-05 финализирует): `cosmic_hub.boxes.{empty_placeholder, from_planet, tap_to_open, open_all}` + `rarity.*`.

## Deviations

- **Auto-merge с Plan 15-05:** Plan 15-02 в строгой формулировке — placeholder для open-all (`console.warn`); я сразу реализовал handleOpenAll потому что соответствующий BulkOpenSummary создаётся параллельно (Wave 3+4 объединены).
- **Checkpoint skip:** human-verify checkpoint автоматически skip'нут (yolo mode + «Не запускай dev. Build+tsc»). Visual verify откладывается на runtime smoke.

## Verification

- `npx tsc --noEmit` clean.
- `npm run build` success — BoxesTab уходит в main bundle, CascadeRevealModal/BulkOpenSummary lazy.
- 3 i18n локали имеют все Phase 15 boxes keys.

## Pending (next plans)

- Plans 15-03/15-04 параллельно: CascadeRevealModal + SerumSlotMachine (here merged into single commit).
- Plan 15-05: SettingsModal toggle + bundle verify + phase summary.
