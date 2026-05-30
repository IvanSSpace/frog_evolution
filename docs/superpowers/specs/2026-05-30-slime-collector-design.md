# Slime Collector — Design Spec

**Date:** 2026-05-30
**Status:** Approved (design), pending implementation plan

## Goal

Rework the existing offline goo income into a **visible, manually-collected
collector building**. Instead of the server silently adding offline income to
gold (and a "while you were away" modal), the income accumulates in a collector
that the player sees fill up and collects by hand from the field.

## Current behavior (being replaced)

- `GET /game/state` (server) computes offline income capped by
  `gooCollector` level (`capHours`) and **auto-adds it to `gold`**, returns
  `offlineIncome`.
- Client emits `server:welcome-back` → `WelcomeBackModal` shows the earned
  amount.
- `bld_collector` building (`/builds/collector.png`) is purely decorative.

## New behavior

Offline income is **not** auto-granted. It accumulates server-side as a
pending buffer (capped). The player collects it from the field via a "Собрать"
label above the collector building. The collector sprite reflects fill level.

### Resource & capacity
- Same resource as today: gold (no new currency).
- Capacity is **time-based**, from the existing `gooCollector` upgrade:
  `capMs = getGooCollectorCapMs(level)` (`capHours` 2h→6h, level 0–8).
  Upgrading `gooCollector` = bigger collector. No new upgrade entry.
- Fill fraction: `fill = pendingMs / capMs` (0 when `capMs === 0`, i.e. level 0).

### Filling
- **Offline only.** Accumulates the gap between sessions, capped at `capMs`.
  Online time does not add (mirrors today's `lastSessionAt` model).

### Collecting
- A Phaser **"Собрать"** label floats above the `bld_collector` sprite in the
  buildings zone, shown only when `pendingMs > 0`.
- Tap → `POST /game/collector/collect` → server moves buffer to gold, returns
  collected amount + new gold. Client adds gold, resets fill, sprite → empty,
  haptic + small FX.

### Sprite states (by fill)
- `fill < 0.20` → `collector_empty.png`
- `0.20 ≤ fill ≤ 0.80` → `collector.png`
- `fill > 0.80` → `collector_full.png`

(Assets already in `public/builds/`: `collector_empty.png`, `collector.png`,
`collector_full.png`.)

## Server changes (`server/`)

1. **DB / Prisma migration:** `GameState` += `collectorPendingMs Int @default(0)`.
2. **`GET /game/state`:** replace the auto-add block. Compute
   `pendingMs = min(collectorPendingMs + (now - lastSessionAt), capMs)`;
   persist `collectorPendingMs = pendingMs`, `lastSessionAt = now`.
   Do **not** modify `gold`. Return `collectorPendingMs` and `collectorCapMs`.
   `offlineIncome` field is dropped or returned as informational only (no
   longer applied).
3. **`POST /game/collector/collect`:** `collected = floor(pendingMs/1000 *
   incomePerSec)`; `gold += collected`; `collectorPendingMs = 0`. Return
   `{ collected, gold }`. Guard: pendingMs <= capMs already enforced on read.

## Client changes (`client/`)

1. **Store (`gameStore`):** add `collectorPendingMs`, `collectorCapMs`; derive
   `collectorFill` and `collectorPendingGold = floor(pendingMs/1000 *
   incomePerSec)`. Setter from sync.
2. **`gameSync` GET:** read `collectorPendingMs`/`collectorCapMs` into store.
   Stop treating offline income as auto-gold; stop emitting `server:welcome-back`.
3. **Collect API:** `collectCollector()` calls `POST /game/collector/collect`,
   applies returned gold, zeroes pending.
4. **`BuildingsController`:** for `bld_collector`, pick texture by fill on
   `show()` and after collect; add a "Собрать" interactive Phaser Text above the
   sprite, visible only when `pendingMs > 0`; tap → `collectCollector()` + reset
   sprite to empty + haptic.
5. **Remove `WelcomeBackModal`:** delete the modal component usage in `App.tsx`
   (import, `welcomeBack` state, `onWelcomeBack` listener, render). Remove the
   `server:welcome-back` event (or leave the type unused).
6. **Shop:** update `gooCollector` card copy to describe collector capacity
   (i18n `shop.gooCollector.*`).

## Edge cases / decisions
- Collector level 0 (`capMs === 0`): never fills; "Собрать" hidden; sprite
  stays `collector_empty`.
- "Собрать" hidden when `pendingMs === 0` (not shown disabled).
- `incomePerSec` for the gold conversion is taken server-side at collect time
  (authoritative), mirrored client-side for the displayed estimate only.
- Buildings zone scrolls; the "Собрать" label is parented to the same
  container/zone as the building sprites so it scrolls with them.

## Out of scope (YAGNI)
- No new "slime" currency.
- No online (real-time) accrual.
- No collector modal (collect is on-field).
- No auto-collect of the collector (manual only).

## Risks
- Full-stack + DB migration; touches `server/` (Prisma, route) and several
  `client/` files.
- **Concurrency:** other agents are actively editing this repo
  (`MainScene.ts`, `BuildingsController.ts`). Coordinate / re-check before
  editing shared files.
