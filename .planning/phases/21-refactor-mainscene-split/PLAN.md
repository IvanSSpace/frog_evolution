---
phase: 21-refactor-mainscene-split
plan: master
type: overview
status: pending
depends_on: [20-refactor-starmap-split]
total_plans: 1
goal: Split MainScene.ts (2708 LOC, 88KB) into domain-specific controllers, mirroring the StarMap refactor pattern.
---

# Phase 21 — Refactor MainScene Split

## Контекст

`src/game/scenes/MainScene.ts` — 2708 LOC, второй по размеру монолит после StarMap.

Содержит ~50 методов, охватывающих:
- Spawn/animate лягушек (~400 LOC)
- Merge + carrier merge + feed (~600 LOC, с known cross-location bug)
- Box spawn + tap (~400 LOC)
- Magnet system (~150 LOC)
- Location transition / clearField (~340 LOC)
- Auto-poop drops (~150 LOC)
- Tap/drag handlers + serum interaction (~200 LOC)

## Goal

Разбить на контроллеры по доменам с атомарными коммитами. Поведение НЕ должно измениться.

После всех wave'ов:
- MainScene.ts ≤ 600 LOC (orchestrator)
- 5-6 controller-классов в `src/game/scenes/main/`
- TS zero errors, lint clean, tests green

## Strategy — 5 waves

| Wave | Module | Methods | Risk | LOC removal |
|---|---|---|---|---|
| 21-01 | FrogSpawner | spawnFrog, spawnLocationFrogs, startIdleAnim, scheduleNextDash, performDash, removeFrog, spiralFrogTo, rebindCarriers | 🟢 low | ~450 |
| 21-02 | MergeController | performMerge, performCarrierMerge, performFeed, playCrossLocationFlyAway, findMergeTarget, findClosestSameLevelPair, hasMergeablePair, spawnVortexParticles, flashAt, spawnFloatingText, locationName | 🟡 medium | ~600 |
| 21-03 | BoxController + PoopController | canSpawnBox, spawnBox, startBoxIdleAnim, onBoxTapped, spawnAutoPoop | 🟡 medium | ~550 |
| 21-04 | MagnetController | spawnMagnet, removeMagnet, updateMagnets | 🟢 low | ~150 |
| 21-05 | LocationTransition + Interaction cleanup | clearField (huge), onFrogTapped, handleSerumTap, applySerumToFrog, emitMisTapToast, findFrogAt, clientToWorld, randomFieldPos, subscribeSerumState | 🟡 medium | ~600 |

## Pattern

Same as Wave 4 of StarMap split:
- Each module is a class with `(scene: MainScene)` constructor
- Methods become public class methods
- Scene fields touched by extracted methods are promoted from `private` to package-public (no modifier) with documenting comment
- StarMap precedent: `src/game/scenes/starmap/*.ts` already established this pattern

## Critical constraints

1. **Behavior must NOT change** — pure code move
2. **Atomic commits per wave** — 5 commits expected
3. **TS zero errors maintained** between commits
4. **Manual smoke test** after Wave 5: tap frog, drop poop, merge frogs, transition location, magnet pickup, box drop, carrier serum apply + feed + merge

## Out of scope

- Fixing the cross-location merge bug (known issue, separate task — though tests in `mergeCarriers.test.ts` already lock down slice contract)
- Performance optimizations
- Visual changes
- Splitting MainScene's `update()` loop into per-domain ticks
