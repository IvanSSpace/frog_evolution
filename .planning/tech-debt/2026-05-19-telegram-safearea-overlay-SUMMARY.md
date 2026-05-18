---
type: tech-debt
subsystem: client/debug
tags: [dev-tools, telegram, ui, fullscreen, safe-area]
key-files:
  created:
    - client/src/components/Debug/TelegramSafeAreaDebugOverlay.tsx
  modified:
    - client/src/App.tsx
    - client/src/vite-env.d.ts
decisions:
  - Overlay is DEV-only with double-guard (mount-site + component-internal `import.meta.env.DEV`) so Vite tree-shakes both the JSX and the imported module body out of the production bundle — verified by grepping `dist/assets/*.js` for identifier and label strings.
  - Real `safeAreaInset.top/bottom` values are preferred when Telegram provides them (Bot API 8.0+); fallback to hardcoded approximate values (`statusBar 44px`, `homeIndicator 34px`, `close/more buttons 36x36 at top:12 / right:8/52`) on older clients or in browser dev.
  - Toggle exposed only on `window.__toggleTgSafeAreaDebug` (no UI button) — overlay is a debugging aid, not a user-facing feature; default OFF.
  - `pointer-events: none` on the container (not just the boxes) so absolutely-positioned children inherit and cannot inadvertently block game interaction (memory feedback_clickability).
  - z-index 9999 — above game (~50), CosmicHub modal (~100), FirstContact modal (~200). Ensures debug boxes always visible regardless of which UI is open.
metrics:
  duration: ~20 minutes
  completed: 2026-05-19
---

# Tech Debt: Telegram Safe-Area Debug Overlay

**One-liner:** DEV-only visual overlay that draws semi-transparent red boxes at Telegram WebApp close / more / status bar / home indicator positions to help size and position game HUD without overlap.

## What Changed

### `client/src/components/Debug/TelegramSafeAreaDebugOverlay.tsx` (new)

- Exports `TelegramSafeAreaDebugOverlay` (component) and `installTelegramSafeAreaDebugHelper` (window helper installer).
- Renders 4 fixed-position boxes (60% opacity red, 2px dashed dark-red border), each with a top-left text label: `TG CLOSE`, `TG MORE`, `STATUS BAR`, `HOME INDICATOR`.
- Box positions: `statusBar` reads `Telegram.WebApp.safeAreaInset.top` when present (fallback 44px); `homeIndicator` reads `safeAreaInset.bottom` (fallback 34px); close/more buttons centred in the TG-chrome zone between `safeAreaInset.top` and `contentSafeAreaInset.top` when both available, else fallback `top: 12px`.
- Container `position: fixed; inset: 0; zIndex: 9999; pointerEvents: 'none'`.
- Visibility state lives on `window.__tgSafeAreaDebug` (a small `{ visible, subscribers }` object) so the same toggle drives all mounted instances; `useDebugVisible()` hook subscribes via React `useState` + a per-mount sync callback.
- Tree-shake guard: `if (!import.meta.env.DEV) return null` after the only hook call, so Vite DCE strips the body in production.

### `client/src/App.tsx`

- Added import of overlay + installer.
- Inside the existing DEV `useEffect` (where `installQuestDevHelpers` etc. live), call `installTelegramSafeAreaDebugHelper()` and add its cleanup to the return.
- At the end of the JSX tree, render `{import.meta.env.DEV && <TelegramSafeAreaDebugOverlay />}`.

### `client/src/vite-env.d.ts`

- Extended `TelegramWebApp` interface with optional `safeAreaInset` and `contentSafeAreaInset` fields (`{top, right, bottom, left}` each, Bot API 8.0+).

## Usage

```
// DevTools console (DEV only):
window.__toggleTgSafeAreaDebug()      // toggle visibility
window.__tgSafeAreaDebug              // inspect { visible, subscribers }
```

Boxes are pure visual — they do not block taps. Game and modal interaction remains fully functional with overlay ON.

## Verification

- `tsc --noEmit` clean.
- `eslint` clean on all three changed files.
- `vitest run` — 22 files / 198 tests pass, 1 skipped (no regressions).
- `vite build` succeeded. Production tree-shaking verified:

```bash
grep -l "TelegramSafeAreaDebugOverlay\|toggleTgSafeAreaDebug\|tgSafeAreaDebug\|TG CLOSE\|TG MORE\|STATUS BAR\|HOME INDICATOR" dist/assets/*.js
# (no matches — exit 1)
```

## Deviations from Plan

- **[Rule 1 — Bug] Fixed hooks-of-rules violation.** Initial draft had `if (!import.meta.env.DEV) return null` before `useDebugVisible()` call, which violates React's rule-of-hooks (conditional hook). Moved the hook call before the early return; `useDebugVisible` itself handles DEV gating internally. Functionally identical (DEV is build-time constant) but ESLint-clean.
- **[Rule 1 — Bug] Fixed TS literal-type narrowing.** `FALLBACK as const` caused `let closeTop = FALLBACK.closeButton.top` to infer as literal `12`, blocking later `closeTop = Math.max(0, ...)` reassignment with `TS2322`. Added explicit `: number` annotation on the `let` declaration.

No architectural changes; no auth gates; plan executed otherwise as written.

## Commits

- `c4d1a2d`: chore(types): extend TelegramWebApp with safeAreaInset/contentSafeAreaInset
- `5da99c8`: feat(debug): DEV-only Telegram safe-area visual overlay component
- `e76f351`: feat(app): mount Telegram safe-area debug overlay (DEV only)

## Self-Check: PASSED

- [x] `client/src/components/Debug/TelegramSafeAreaDebugOverlay.tsx` exists
- [x] `client/src/App.tsx` modified — mount + helper install
- [x] `client/src/vite-env.d.ts` modified — typing extension
- [x] 4 boxes rendered (TG CLOSE, TG MORE, STATUS BAR, HOME INDICATOR)
- [x] Each box: 60% opacity red background, dashed dark-red border, label
- [x] z-index 9999, pointer-events: none on container
- [x] `window.__toggleTgSafeAreaDebug` installed in DEV (verified in source)
- [x] Default state OFF (initial `visible: false`)
- [x] Production bundle: zero matches for `TelegramSafeAreaDebugOverlay` / label strings in `dist/assets/*.js`
- [x] `tsc --noEmit` clean
- [x] `vite build` successful
- [x] `vitest run` — 198 passed / 1 skipped, no regressions
- [x] `eslint` clean on all changed files
- [x] 3 atomic commits (c4d1a2d, 5da99c8, e76f351)
- [x] No STATE.md / ROADMAP.md edits
