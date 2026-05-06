# Plan 05-01 Summary

## What was built
- Extended eventBus with `rareCrate:opened` and `rareCrate:claim` typed events
- Added golden rare crate spawning in MainScene (60s timer, gold tint, 1.25x scale)
- Rare crate tap emits `rareCrate:opened` event instead of spawning frog directly
- MainScene listens to `rareCrate:claim` to spawn frog at canvas center

## Key files
- `client/src/store/eventBus.ts` — 2 new event types
- `client/src/game/scenes/MainScene.ts` — rare crate logic

## Self-Check: PASSED
