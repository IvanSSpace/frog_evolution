---
phase: 16-ship-travel-mission
plan: 02
subsystem: ship-visual
tags: [phase-16, ship, phaser, starmap, sprite, particles]
status: complete
completed: 2026-05-08
---

# Phase 16 Plan 02: ShipSprite + StarMapScene Summary

ShipSprite Phaser-native класс (Container + Graphics + ParticleEmitter trail) + интеграция в StarMapScene через store-subscribe + arrival flow toast в App.tsx.

## REQ Coverage

| REQ | Status | Notes |
|-----|--------|-------|
| SHIP-02 | ✓ | ShipSprite — Phaser Container + Graphics ракетка + ParticleEmitter trail |
| SHIP-04 | ✓ | setDocked() — orbit offset 30+ px справа от планеты, rotation=0 |
| SHIP-05 | ✓ | startTransit() — Linear ease tween + trail.stop() на t > 0.95 |
| SHIP-06 | ✓ | redirect()/syncFromState() для mid-flight pivots |
| SHIP-09 | ◑ | Visual часть готова (transit anim); textual countdown в ShipTab (Plan 16-03) |
| SHIP-10 | ✓ | App.tsx subscribe на 'cosmic:ship-arrived' → cosmic:toast с label «Изучить» |

## Files

**Created:**
- `client/src/game/effects/ShipSprite.ts` — 221 lines: setDocked, startTransit, redirect, syncFromState, destroy. Trail texture генерируется лениво (TEX_KEY '__ship_trail_dot' 4×4 white circle). Position broadcast throttled @ 96ms.

**Modified:**
- `client/src/game/scenes/StarMapScene.ts` — +97 lines: ship field + setupShipSprite + applyShipState + teardownShipSprite (вызывается на SHUTDOWN/DESTROY events) + cosmic:request-flight emit в handlePlanetPress
- `client/src/App.tsx` — +24 lines: subscriber на 'cosmic:ship-arrived' → emit cosmic:toast с action.onClick → emit 'cosmic:start-mission'

## Atomic Commits

- `b049e5d` phase-16: add ShipSprite Phaser-native ship visual + trail + transit tween
- `9a2bbf1` phase-16: integrate ship into StarMapScene with store subscribe + cleanup
- `3671729` phase-16: subscribe to cosmic:ship-arrived in App.tsx → arrival toast

## Verification

- tsc clean, build success
- ShipSprite: setupShipSprite → ensureShipExists → spawn в home planet coords (DPR-multiplied)
- DPR convention: ShipSprite оперирует в DPR-multiplied units (matches scene); store-side latestShipPos нормализуется обратно в DPR=1 base
- Bundle: index 214.11 KB gzip → +2.52 KB vs Phase 14 baseline (211.59)

## Open Issues

- Ship visible только когда StarMap открыт (decoupled scene). ShipTab (Plan 16-03) даёт textual state offline.
- ParticleEmitter texture создаётся лениво при первом transit. Если scene shutdown ↔ restart многократно — texture cache persists (Phaser shared TextureManager — это expected).

## Decisions

1. **Phaser 4 particles API**: используется `scene.add.particles(x, y, texture, config)` (новый API; Phaser 3.55 deprecated). Verified via `phaser@^4.1.0` в package.json.
2. **No worldContainer**: StarMapScene не имеет worldContainer pattern — ShipSprite добавляется к scene root с depth 1500. Camera захватывает всё через standard pan/zoom.
3. **JSON-sig dedup**: `applyShipState` использует JSON.stringify сравнение для dedup — избегает re-tween на identical state.
