# Performance Audit — Phase 22-27 (React + Phaser) — 2026-05-18

**Scope:** React components + Zustand store + Phaser hot paths added in Phase 22-27 (cosmos unlock, race overlays, contacts/messages/relationships).

**Approach:** CONSERVATIVE. NO architectural changes, NO function-signature changes on shared utilities. Only inline-safe optimizations (`useCallback`, `React.memo`, granular selectors). Risky observations are documented for manual review, not applied.

**Gates after every commit:** `vitest 174 PASS`, `tsc --noEmit` clean. Baseline before first edit also confirmed 174 PASS / tsc clean.

---

## TL;DR

| Class | Count |
| ----- | ----- |
| SAFE fixes APPLIED (atomic commits) | 2 |
| RISKY fixes DOCUMENTED (not applied) | 5 |
| INFO-ONLY observations | 6 |

All applied fixes are reference-equality stabilization (no functional change). No file moved, no signature touched.

---

## Applied SAFE Fixes

### Fix #1 — Stable `dismissToast` ref via `useCallback`

**Commit:** `c8fa551 perf(contacts): stable dismissToast ref via useCallback`

**File:** `client/src/components/Contacts/eventToastController.tsx`

**Before**
```tsx
const dismissToast = (id: string) => {
  setQueue((prev) => prev.filter((t) => t.id !== id))
}
```
This was an inline arrow function recreated on every render of the controller. `EventToast` keys its auto-dismiss `useEffect` on `[id, onDismiss]` — so every time the controller re-rendered (each new toast arriving, each existing toast dismissing), every mounted toast tore down its `setTimeout` pair and created new ones. Effective behavior: the visible 3-second countdown on already-on-screen toasts was *restarting* whenever a sibling toast appeared.

**After**
```tsx
const dismissToast = useCallback((id: string) => {
  setQueue((prev) => prev.filter((t) => t.id !== id))
}, [])
```
Stable reference; auto-dismiss timers run uninterrupted regardless of sibling churn.

**Why SAFE:**
- No signature change.
- Pure ref-stability optimization.
- The fix doubles as a subtle correctness improvement (auto-dismiss timing).
- vitest 174 PASS, tsc clean post-fix.

---

### Fix #2 — `React.memo` on `EventToast`

**Commit:** `f05b5df perf(contacts): wrap EventToast in React.memo`

**File:** `client/src/components/Contacts/EventToast.tsx`

**Rationale:** With `onDismiss` now stable (Fix #1), every prop of `EventToast` is stable per instance for its full lifetime (`id`, `raceId`, `delta`, `textKey`, `onDismiss`). Without memo, every queue change in the controller forced every mounted toast through a virtual-DOM diff. With memo, only the changed/new toast renders.

**Why SAFE:**
- No external signature change (export remains `EventToast`).
- `EventToast` is pure (renders only from props + local `fadingOut` `useState`).
- vitest 174 PASS, tsc clean post-fix.

---

## RISKY Findings (documented, NOT applied)

### R1 — `useGameStore.subscribe(listener)` with no selector — 8 call sites

**Pattern:**
```ts
useGameStore.subscribe((state) => {
  // diff field manually
})
```

**Locations:**
- `client/src/store/gameStore.ts:449` — cosmic auto-persist (16 fields diffed manually)
- `client/src/game/scenes/main/FrogInteraction.ts:79` — serum selection
- `client/src/game/effects/FrogOverlayManager.ts:65` — carrier overlay sync
- `client/src/game/effects/ElementAuraOverlay.ts:57` — **15 instances** (one per element, mounted in MainScene.createElementAuras)
- `client/src/game/scenes/starmap/shipController.ts:69`
- `client/src/game/scenes/starmap/rendering/planetRenderer.ts:54`
- `client/src/api/gameSync.ts:356`

**Issue:** Every `set()` on `useGameStore` walks every subscriber list. With ~23 subscribers (especially the 15 `ElementAuraOverlay` instances), each `addGold` call (which can fire many times per second at high income) walks all 23 callbacks. Each callback IS cheap (single ref-compare against cached snapshot), but the *fan-out* is wasteful — most callbacks are looking at the same field (`state.carriers`).

**Why RISKY to fix inline:**
- The canonical fix is `subscribeWithSelector` middleware on the store, which is a single-file change but it touches the whole game state surface. The current `createCosmicSlice` factory writes through a typed `SetFn`/`GetFn` pair (not the middleware shape).
- A safer half-measure would be a shared module-level "carriers" change broadcaster (one subscribe, fan-out to N listeners). That's structural — moves logic across files.
- Game is actively developed — change of subscribe semantics could surface latent bugs in existing controllers.

**Recommended for a dedicated future plan:** Add `subscribeWithSelector` middleware, then convert all 8 sites to selector-form. Estimate: 1 plan, 1 wave, contained.

---

### R2 — `saveCosmicSlice` writes localStorage on EVERY tracked field change

**File:** `client/src/store/gameStore.ts:449-518`

**Issue:** The auto-persist subscriber writes the full cosmic blob (`JSON.stringify` of ~22 fields including `pendingItems`, `serums`, `chainProgress`, `raceRelationships`, `boxes`, `carriers`, `crew`, `bestiaryBitset`, `tutorialState`, etc.) every time ANY one of the diffed fields changes. There is no throttle/debounce.

Most fields change discretely (user-initiated), but during burst situations (e.g. resolving 3 pending items in succession, or the `triggerPendingPull` engine cascade which can mutate `raceRelationships` + `chainProgress` + `pendingItems` in one tick) multiple sequential `set()` calls each trigger a fresh JSON serialization + localStorage write of the entire blob.

**Magnitude check:** The cosmic blob is multi-KB JSON. `JSON.stringify` for ~22 nested fields on every discrete state mutation, plus `localStorage.setItem` (sync I/O), can introduce ~1-5ms hitches per mutation burst.

**Why RISKY to fix inline:**
- A debounce (e.g. 250ms trailing) on `saveCosmicSlice` requires graceful flush on `visibilitychange`/`beforeunload` to avoid losing the tail mutation. Skipping the flush is a data-loss bug.
- Server sync (`api/gameSync.ts:356`) also reads through this path; throttling here needs verification that gameSync is unaffected.
- Already-shipped Phase 27 reload-correctness tests (`pendingItems` persist + reload) would need to be re-verified against the debounced path.

**Recommended:** Plan-sized work. Wrap `saveCosmicSlice` in a trailing-debounce (250-500ms) with `flushSync` on unload events. Audit `gameSync.startSync` to ensure server-sync still operates correctly.

---

### R3 — `CosmicHubModal.TABS` array rebuilt every render

**File:** `client/src/components/CosmicHub/CosmicHubModal.tsx:72-125`

The 7-entry `TABS` array (each with `label: t('cosmic_hub.tab_...')`) is constructed inline in the component body. `t()` itself is reasonably cheap, but every render re-runs 7 lookups and allocates 7 objects + an array. Tab buttons also receive inline `onClick={() => tab.enabled && setActiveTab(tab.id)}` arrows.

**Why RISKY (or rather: low ROI to fix):**
- CosmicHubModal is lazy-loaded and only mounted while open.
- The component re-renders when one of `hasFirstFeed`/`hasFirstMission`/`cosmosUnlocked`/`activeTab` changes — none of these are per-frame.
- Wrapping `TABS` in `useMemo([t, hasFirstFeed, hasFirstMission])` is technically safe, but: the `t` function ref from `react-i18next` IS stable across renders, and `useMemo` here would save sub-millisecond allocations per modal-state-change.
- **Verdict:** Not worth the diff. Documented for completeness.

---

### R4 — `RelationshipBar` re-subscribes eventBus on every `raceId` prop change

**File:** `client/src/components/CosmicHub/contacts/RelationshipBar.tsx:38-58`

```tsx
useEffect(() => {
  eventBus.on('contacts:relationship-delta', handler)
  return () => eventBus.off('contacts:relationship-delta', handler)
}, [raceId])
```

Subscribes/unsubscribes from `eventBus` on every `raceId` change. In normal usage `raceId` changes when the user navigates between race detail views — infrequent. But if a parent re-renders and somehow passes a new (referentially equal) raceId string, no churn happens (deps array uses Object.is on string).

**Why this is INFO-only, not a real issue:** Strings compare by value with Object.is. The effect is correctly memoized. Listed only because a casual reader might worry. **Not a finding** — included for transparency.

---

### R5 — `MainScene.update()` allocates `frogById` Map per frame in `ElementAuraOverlay.tick`

**File:** `client/src/game/effects/ElementAuraOverlay.ts:73-74`

```ts
const frogs = this.getFrogs()
const frogById = new Map(frogs.map((f) => [f.id, f]))
```

Each `tick()` (called from `MainScene.update` for all 15 aura instances per frame) allocates a fresh Map + iterates all frogs. With ~15 frogs × 15 instances × 60fps = 13,500 map operations per second.

**Why RISKY to fix inline:**
- Sharing a `frogById` Map across the 15 auras would require a per-frame builder owned by MainScene + threaded into each `tick()` call — change to the controller's `tick()` signature.
- Caching the Map inside the overlay and invalidating on dirty would tie the Map to `lastCarriersSnapshot` semantics, but it must also be invalidated when frogs spawn/despawn (independent of carriers). That's a new invariant — easy to get wrong.
- Game runs at 60fps; the absolute cost (~13.5k ops/s of Map.set on a ~15-entry collection) is small (<1ms/frame on modern devices) but visible on low-end phones.

**Recommended:** Worth a dedicated Phaser-side optimization pass: shared `frogById` cache on MainScene, rebuilt only on spawn/remove. Estimate: 1 plan, careful test.

---

## INFO-ONLY Observations (no action recommended)

### I1 — `Header.tsx` re-renders on every gold tick

`useGameStore((s) => s.gold)` + `incomePerSec` selectors re-render the entire Header every time gold changes (which can be every ~16ms at high income from `MainScene.update`'s `bgIncomeAccum`). The Header DOM is small and `Object.values(serums).reduce(...)` is 16 iterations — trivial. Splitting into Gold/Serum/Income sub-components is the canonical fix but architectural. **Leave.**

### I2 — `MainScene.update()` per-frame allocations

`store.locationFrogs.forEach(...)` runs every frame for background-income tick + depth-sort iterates ALL frogs+boxes every frame. Standard Phaser game loop; not a leak; no per-frame allocations besides the closures Phaser already amortizes. **Leave.**

### I3 — `LocationStack.LocationButton` not memoized

Inline `onClick={() => handleSelect(loc.id)}` causes all buttons to re-render on parent re-render. Refactoring requires splitting `onClick` into stable `handleSelect + id` props — signature change. The ~5 buttons rendered are fast. **Leave.**

### I4 — `ContactsTab` renders 10-row list with no row memoization

Each row recomputes tier color/label per render. Negligible (10 rows × ~5 derivations). **Leave.**

### I5 — `InventoryTab` 16-cell serum grid

Same as above — 16 cells, trivial derivations. **Leave.**

### I6 — `CosmicHubModal` `useEffect` deps eslint-disable

```tsx
useEffect(() => {
  const active = TABS.find((tab) => tab.id === activeTab)
  if (active && !active.enabled) {
    // ...
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [hasFirstFeed, hasFirstMission])
```

Intentionally excludes `TABS` (recreated each render). Correct as-is — alternative `useMemo(TABS, ...)` would make this honest but doesn't change behavior. **Leave.**

---

## Phaser-Side Notes (defensive checks)

The audit also walked Phaser hot paths in `MainScene`, `MergeController`, `BoxController`, `FrogSpawner`, `StarMapScene`, `raceGlow`, `FirstContactEffect`. Findings:

- **No GameObject leaks.** All controllers have `destroy()`/`shutdown()` paths and `eventBus.off` symmetric with `on`. `RaceGlowController.destroy` iterates and tears down each overlay group; `FirstContactEffect` swaps `activeHandler` on re-install to avoid HMR doubles; `StarMapScene.shutdown` calls `tweens.killAll()` + `time.removeAllEvents()`.
- **No per-frame Phaser allocations in StarMapScene.update** (delegated to `CoordinatesHUDController`, which is a thin per-frame field-writer).
- **Texture-gen caches** (`ensureGlowTexture` in raceGlow, `ensureTexture` in FirstContactEffect) correctly check `scene.textures.exists` before re-generating. No leaks.
- **`MergeController.spawnVortexParticles`** creates 12 circles per merge with onUpdate tweens. Acceptable burst cost; tweens self-destroy on complete.

No safe inline Phaser fixes identified — the patterns all follow existing Phase 20/21 refactor conventions.

---

## Validation Trail

| Step | Result |
| ---- | ------ |
| Baseline `vitest run` before any edit | 174 PASS / 1 skipped |
| Baseline `tsc --noEmit` | Clean |
| After Fix #1 (useCallback) `vitest` | 174 PASS |
| After Fix #1 `tsc` | Clean |
| After Fix #2 (React.memo) `vitest` | 174 PASS |
| After Fix #2 `tsc` | Clean |

Worktree branch: `worktree-agent-a2f1c8a34e4da7380` (auto-checked at startup; HEAD on per-agent ref — never on protected).

---

## Self-Check

- [x] `client/src/components/Contacts/eventToastController.tsx` — FOUND, modified, committed (c8fa551)
- [x] `client/src/components/Contacts/EventToast.tsx` — FOUND, modified, committed (f05b5df)
- [x] `vitest` 174 PASS after every commit
- [x] `tsc` clean after every commit
- [x] NO edits to `.planning/STATE.md` or `.planning/ROADMAP.md`
- [x] Worktree HEAD verified non-protected before each commit

## Self-Check: PASSED
