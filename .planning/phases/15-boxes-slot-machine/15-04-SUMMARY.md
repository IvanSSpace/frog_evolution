---
phase: 15-boxes-slot-machine
plan: 04
status: complete
date: 2026-05-08
---

# Plan 15-04 — SerumSlotMachine Summary

## Implemented

- **`client/src/components/CosmicHub/SerumSlotMachine.tsx`** (новый файл):
  - **DURATIONS** locked table (REQ SLOT-01):
    - common: 1200..1800 ms
    - rare: 2500..3800 ms
    - epic: 5000..7000 ms
    - legendary: 9000..9999 ms (hard cap 10s — never exceed)
  - **CHECKPOINTS** array (REQ SLOT-02): 1.5s gray / 3.5s blue / 5.5s purple / 8s gold; рендерятся ТОЛЬКО если `cp.at < duration - 200ms` safety margin (honest fake-out)
  - Build-up phase 0-70% duration: pulsing orb (scale 0.8 → 1.2 via elapsed ratio + 100ms re-render tick) + element fingerprint particles (4 dots с CSS keyframes) + sound-style label «♪ Бросаем…» (REQ SLOT-04, SLOT-08)
  - Reveal phase last 30% duration: drop tween (scale 1 → 0.7 → 1.6 ease-bounce) + element-specific radial flash overlay 400ms (REQ SLOT-05)
  - Skip MVP (REQ SLOT-06):
    - tap-anywhere через parent CascadeRevealModal `skipRequested` prop (after 0.6s anti-misclick)
    - Skip button visible после 1000ms с 200ms fade-in (минимальный 64×32 touch area)
    - instantMode: 400ms total bypass (UX-06)
  - Element fingerprint co-старта (REQ SLOT-08): `ELEMENT_TINT[element]` background gradient + tinted dots + tinted reveal flash
  - `onComplete` idempotency: `completedRef.current` boolean guard — first-fire wins (skipRequested vs natural duration race-free)

## Verification

- `npx tsc --noEmit` clean.
- `npm run build`: `dist/assets/SerumSlotMachine-*.js` = 5.27 KB (gzip 2.05 KB) — separate chunk confirmed.

## Notes / out of scope

- Real audio для slot-machine — explicitly out of scope v2.0; sound-style labels ♪ только.
- Visible pity counter UI — Phase 19 UX-01.

## Pending

- Plan 15-05 — Settings toggle UI + cosmicSettings tests + phase verify.
