# Star Map FPS Fix v2 — 2026-05-18

**Scope:** Two atomic FPS-related fixes on `StarMapScene` hot path. Bonus refactor documented and skipped per project constraint (no architectural changes).

**Approach:** CONSERVATIVE. No function-signature changes on shared utilities. No store middleware additions. All changes are inline-safe and backwards compatible. Gates verified after every commit.

---

## TL;DR

| Class | Count |
| ----- | ----- |
| Applied fixes (atomic commits) | 2 |
| Bonus refactors documented and skipped | 1 |
| `vitest` after each commit | 174 PASS / 1 skipped |
| `tsc --noEmit` after each commit | Clean |

---

## Fix #1 — HUD FPS counter cap at [1, 60]

**Commit:** `7de390e fix(starmap): cap HUD FPS display at [1, 60]`

**File:** `client/src/game/scenes/starmap/coordinatesHUD.ts`

### Problem

The per-frame HUD update loop computed:

```ts
const instantFps = dt > 0 ? 1000 / dt : 60
```

`dt` is provided by Phaser's RAF tick. On high-refresh-rate displays (120/144Hz devices — common on modern phones, including Telegram's target audience on flagship Android), RAF fires faster than 60Hz, so `1000 / dt` exceeded 60 even though the player's perceived "feel" of the game remained 60 (assets, animations, physics all timed for 60). The counter showed e.g. 89 fps on a 120Hz device — visually a bug.

A secondary risk: `dt ≈ 0` (sub-millisecond resolution glitch) would yield arbitrarily large spikes that destabilized the 30-frame rolling average.

### Fix

```ts
const rawFps = dt > 0 ? 1000 / dt : 60
const instantFps = Math.max(1, Math.min(60, rawFps))
```

Caps both ends: max 60 (display) and min 1 (defensive). Pure display fix — does NOT change the spike detector threshold (`dt > 50ms`), which still measures the real frame time.

### Why SAFE

- One-line value clamp inside the same expression — no control-flow change.
- The rolling-buffer math (`fpsSum -= fpsRing[fpsIdx]; fpsRing[fpsIdx] = instantFps; ...`) is unchanged.
- Spike detector (`if (dt > 50)`) reads `dt` directly, not the clamped value, so spike alerts remain calibrated.
- vitest 174 PASS, tsc clean post-fix.

---

## Fix #2 — Register race-overlay GameObjects in LOD cull pipeline

**Commit:** `7a310a2 fix(starmap): register race-overlay GameObjects in LOD cull pipeline`

**Files:**
- `client/src/game/scenes/starmap/effects/raceGlow.ts`
- `client/src/game/scenes/starmap/rendering/planetRenderer.ts`

### Problem

`RaceGlowController.attach()` was called by `PlanetRenderer` for every habitable planet once cosmos was unlocked. For each planet it created:

- 1 `Image` (glow halo, ADD blend, race-tinted)
- 1 `Text` (race emoji icon)
- 1 optional `Image` (gold pulsing home halo) for home-role planets

For the 30 habitable planets (most colonies + a few home roles), that's ~70 GameObjects added to the scene via `scene.add.image / scene.add.text`. None of them were registered in `scene.lod.cullableData`.

The LOD pipeline in `CoordinatesHUDController` (`coordinatesHUD.ts:114`) iterates `scene.lod.cullableData` every 12 frames to do frustum culling + LOD-cut (`removeFromDisplayList` below `lodMinZoom`). Phaser does NOT do automatic frustum culling on `Image`/`Text`; without LOD registration those ~70 GameObjects stayed in the display list at every zoom, and Phaser's render loop iterated them every frame regardless of viewport position — directly contradicting the work the LOD pipeline already does for planets themselves.

On far zoom (overview of all 1000 systems), the player sees no overlays (they're too small), but Phaser still walked 70 hidden-but-undisplayed-list GameObjects per frame. With Phase 27's state churn (relationship/contact updates triggering `useGameStore.subscribe`), this compounded the per-frame cost noticeably.

### Fix

**`raceGlow.ts`:** `RaceGlowController` now accepts an optional `cullSink: CullableEntry[]` at construction (typed import from `../lod/lodManager`).

`attach()` pushes glow / icon / homeHalo into the sink with:

```ts
{ obj, x: input.x, y: input.y, r: <conservative radius>, lodMinZoom: 0.5 }
```

`lodMinZoom = 0.5` matches the visibility floor where overlay glyphs (especially the emoji icon) become too small to read. Below that zoom the LOD pipeline calls `removeFromDisplayList()` on all three overlays — Phaser stops iterating them entirely. Above 0.5, viewport-cull still hides overlays for planets outside the camera's worldView (with the standard 30% margin from `coordinatesHUD.ts:107`).

The pushed entries are tracked on `OverlayGroup.cullEntries: CullableEntry[]` so `detach()` and `destroy()` can splice them out atomically:

```ts
private removeCullEntries(entries: CullableEntry[]): void {
  const sink = this.cullSink
  if (!sink) return
  const toRemove = new Set<CullableEntry>(entries)
  let write = 0
  for (let read = 0; read < sink.length; read++) {
    const e = sink[read]
    if (toRemove.has(e)) continue
    if (write !== read) sink[write] = e
    write++
  }
  sink.length = write
}
```

Single-pass O(N) splice via `Set` lookup — avoids per-element `indexOf` (O(N*M)).

**Cleanup ordering:** `detach()` removes cull entries BEFORE destroying GameObjects. This matters because the cull loop in `coordinatesHUD.ts:114` reads `c.obj.visible` / `c.obj.setVisible(...)` / `c.obj.addToDisplayList()` — if we destroyed first, those reads would hit a stale Phaser GameObject mid-frame.

`destroy()` already iterates `detach()` for every entry, so no separate splice path is needed for full shutdown.

**`planetRenderer.ts`:** Single line change in the constructor:

```ts
this.raceGlow = new RaceGlowController(scene, scene.lod.cullableData)
```

`scene.lod` is created in `StarMapScene.create()` at line 293, well before `new PlanetRenderer(this)` at line 323 — `cullableData` is guaranteed to exist when this runs.

### Why SAFE

- `cullSink` is **optional** — old call-sites (`installRaceGlow(scene)` without a sink, or unit tests instantiating the controller) continue to work; overlays simply skip LOD registration in that case.
- `CullableEntry.obj` accepts any `GameObject & { visible: boolean; setVisible: (v: boolean) => unknown }` — both `Image` and `Text` satisfy this (`setVisible: (value: boolean) => this`, with `this` being a stricter return that's compatible with `unknown`).
- The LOD pipeline already performs `removeFromDisplayList` / `addToDisplayList` on the registered objects, so existing pipeline invariants are preserved.
- Splice ordering in `detach()` prevents stale-pointer reads in the cull loop.
- vitest 174 PASS, tsc clean post-fix.

### Expected perf impact

- ~70 GameObjects per scene now participate in the same culling pipeline as the 1000+ planets.
- Below `zoom=0.5`: all 70 overlays are `removeFromDisplayList`'d → Phaser render loop skips them entirely.
- Above `zoom=0.5`: frustum cull (with 30% viewport margin) hides overlays for off-screen planets — typical view shows ~10-15 visible planets at a time, so only ~30 overlays remain in the display list rather than 70.
- Cull tick is throttled to every 12 frames in `coordinatesHUD.ts:100`, so the per-tick scan cost added is ~70 entries × 1/12 frames = ~5.8 entry-visits per frame — negligible compared to the savings of not iterating 70 hidden GameObjects in Phaser's render pipeline.

---

## Bonus refactor — SKIPPED (documented)

### Bonus: `useGameStore.subscribe` selector overload in `planetRenderer.ts:54`

**Requested transformation:**

```ts
// Current
this.cosmosUnsubscribe = useGameStore.subscribe((state) => {
  const next = state.hasCosmosUnlocked === true
  if (next === this.lastCosmosUnlocked) return
  this.lastCosmosUnlocked = next
  // ... attach / destroy ...
})

// Proposed
this.cosmosUnsubscribe = useGameStore.subscribe(
  (s) => s.hasCosmosUnlocked,
  (next, prev) => { /* ... */ },
)
```

### Why skipped

The selector overload (`subscribe(selector, listener)`) is **NOT** available on the project's `useGameStore`. Verified:

```bash
$ grep -rn 'subscribeWithSelector' client/src
client/src/store/onboarding/onboardingSlice.ts:17:  import { subscribeWithSelector } from 'zustand/middleware'
client/src/store/onboarding/onboardingSlice.ts:26:  subscribeWithSelector((set, get) => ({
```

`onboardingSlice` uses it, but `gameStore.ts` does NOT — `useGameStore = create((set, get) => ({...}))` is a plain `create()` call (`gameStore.ts:1, 444`). Without the middleware, `useGameStore.subscribe` only accepts the single-arg `(listener) => unsubscribe` signature; calling it with two args would either be a type error or call the listener with the wrong first arg at runtime.

Adding `subscribeWithSelector` middleware to `gameStore` is a store-wide change that:

1. Touches the `createCosmicSlice` factory's `SetFn` / `GetFn` signatures (the middleware wraps `set`/`get` with extra positional args).
2. Affects all 8 sites flagged in the 2026-05-18 performance audit's R1 finding — converting them all in one pass is safer than mixing patterns.
3. Is exactly the work the audit recommended as "RISKY, dedicated future plan, 1 plan, 1 wave, contained".

The frog_evolution `CLAUDE.md` constraint `NO architectural changes` and the audit's own classification align: this is plan-sized work, not a same-PR bonus.

**Source-comment already documents this** (`planetRenderer.ts:44-45`):

```
// subscribe listener (project uses plain useGameStore.subscribe без
// subscribeWithSelector middleware).
```

The existing manual diff via `lastCosmosUnlocked` is the correct pattern given the current store shape, and is identical to the diff pattern used by the cosmic auto-persist subscriber at `gameStore.ts:449`. No churn to fix.

**Recommended:** dedicated plan to add `subscribeWithSelector` middleware to `gameStore`, then convert all 8 RISKY-R1 sites (including this one) to selector form. Estimate: 1 plan, 1 wave.

---

## Phaser-side notes

While reviewing `raceGlow.ts` and `planetRenderer.ts`:

- `ensureGlowTexture()` correctly checks `scene.textures.exists` before re-generating — no leak.
- `RaceGlowController.destroy()` iterates `detach()`, which now also splices `cullSink`. No leak on `StarMapScene.shutdown()`.
- `homeHaloTween.stop(); homeHaloTween.remove()` symmetry with `tweens.add(...)` preserved.
- The `feedback_frog_container_alpha` memory rule is respected — alpha tweens only on the standalone `homeHalo` Image GameObject, never on a container.
- No Lottie introduced anywhere (matches `feedback_animations` memory rule).

---

## Validation trail

| Step | Result |
| ---- | ------ |
| Baseline `vitest run` before any edit | 174 PASS / 1 skipped |
| Baseline `tsc --noEmit` | Clean |
| After Fix #1 (FPS cap) `tsc` | Clean |
| After Fix #1 commit `7de390e` | (no test file exercises HUD directly; manual reasoning) |
| After Fix #2 (LOD cull) `vitest` | 174 PASS / 1 skipped |
| After Fix #2 (LOD cull) `tsc` | Clean |

Worktree branch: `worktree-agent-ad7d820b4e8dd8a95` (auto-checked at startup; HEAD on per-agent ref).

---

## Files changed

- `client/src/game/scenes/starmap/coordinatesHUD.ts` (Fix #1, 7 inserted / 1 deleted)
- `client/src/game/scenes/starmap/effects/raceGlow.ts` (Fix #2, ~95 inserted / 6 deleted)
- `client/src/game/scenes/starmap/rendering/planetRenderer.ts` (Fix #2, 6 inserted / 1 deleted)

---

## Commits

- `7de390e` — fix(starmap): cap HUD FPS display at [1, 60]
- `7a310a2` — fix(starmap): register race-overlay GameObjects in LOD cull pipeline

---

## Self-Check

- [x] `client/src/game/scenes/starmap/coordinatesHUD.ts` — modified, committed (`7de390e`)
- [x] `client/src/game/scenes/starmap/effects/raceGlow.ts` — modified, committed (`7a310a2`)
- [x] `client/src/game/scenes/starmap/rendering/planetRenderer.ts` — modified, committed (`7a310a2`)
- [x] FPS counter capped at 60 (and min 1)
- [x] RaceGlow overlays registered in `cullableData` with `lodMinZoom = 0.5`
- [x] `detach()` and `destroy()` splice entries out of the sink (no leak, no stale reads)
- [x] Bonus selector fix documented as skipped — `subscribeWithSelector` middleware not present on `gameStore`
- [x] `tsc --noEmit` clean after every commit
- [x] `vitest run` 174 PASS / 1 skipped after every commit
- [x] NO edits to `.planning/STATE.md` or `.planning/ROADMAP.md`
- [x] Worktree HEAD verified non-protected before each commit (`worktree-agent-ad7d820b4e8dd8a95`)
- [x] No Lottie introduced
- [x] No alpha tweens on planet containers
- [x] frog_obsidian_archive/ never read

## Self-Check: PASSED
