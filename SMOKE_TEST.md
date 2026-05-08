# Frog Evolution — Smoke Test Checklist

Manual smoke checklist for visual + behavioural verification across phases.
Last updated: Phase 19 (2026-05-08).

---

## Phase 19-06 — Visual audit (UX-02, UX-03)

### Two-axis visualization (UX-02)

Цель: rarity = форма/glow/border, element = hue. Проверить consistency
в каждом из этих UI surfaces:

- [ ] **SerumsTab (Phase 14):** sections common/rare/epic/legendary
      отображают 4 разных rarity styles (border thickness, glow). Внутри
      каждой section — 16 element tints через hue.
- [ ] **BoxesTab (Phase 15):** боксы из разных archetype-планет показывают
      element-specific particle style (fire-particles vs ice-flakes,
      ELEMENT_TINTS-driven).
- [ ] **BestiaryTab (Phase 18):** 4 location tabs × 24 levels × 16 elements.
      Cell color = ELEMENT_TINTS[element]; cell border = rarity-specific
      style. Locked cells gray.
- [ ] **CarrierInfoCard (Phase 17):** showed rarity дифференцирует по
      форме/glow/border, element — по hue.
- [ ] **SlotMachine (Phase 15):** finalized rarity reveal flash —
      rarity-specific (грей/блю/violet/gold) + element-specific particles.

### Colorblind-safe palette (UX-03)

Цель: Okabe-Ito + Krzywinski tints distinguishable for protanopia /
deuteranopia / tritanopia.

- [ ] Просмотреть Бестиарий 4 локации — все 16 element-tints различимы
      в normal vision.
- [ ] (Optional) Использовать Sim Daltonism / Color Oracle на macOS для
      simulation. 16 tints должны оставаться distinguishable хотя бы по
      saturation/luminance даже при protanopia/deuteranopia simulation.
- [x] **Phase 19-06 hex collision audit:** mechanical was 0xfde68a (collision
      с desert), changed to 0xfdd87a. Verified zero collisions via
      `node scripts/verify_tint_uniqueness.cjs`-style inline check.
- [x] elementTints.ts header содержит audit timestamp + comment про
      Okabe-Ito compliance.

### i18n round-trip (I18N-02, I18N-03)

- [x] `npm run check-translations` exits 0 (286 keys × 3 locales parity)
- [ ] Switch language RU → EN → ES в Settings; визуально подтвердить что:
      - Cosmic Hub все 4 таба переведены
      - Tooltips переведены (TutorialOverlay, CrewIndicator, FlightConfirmDialog)
      - Error toasts переведены (mis-tap serum, crew exhausted, etc.)
      - Success toasts переведены (mission complete, scout returned, box opened)

Acceptance этого раздела: все checkbox'ы выполнены manual'но перед
Phase 19 close.

---

## Phase 19-07 — Settings consumer wiring audit

Phase 19-04 added state + UI; consumer wiring verified ниже.

### calmFarmMode → FrogOverlayManager (UX-04)

`grep "calmFarmMode\|getCalmFarmMode" client/src/game/effects/` returns N lines.
Smoke: enable toggle → лягушки на ферме теряют ауру/idle particles.

**Status:** TODO — toggle persists в localStorage, но FrogOverlayManager
does not yet read it. Patch для post-release или Phase 20.

### reducedEffects → awakened presets dispatcher / StabilizationModal (UX-05)

`grep "reducedEffects\|getReducedEffects" client/src/components/` returns ≥1
line in `StabilizationModal.tsx` (phase 17 reveal слот skipped if reduced).
Phase 19-04 unified the localStorage key через `getReducedEffects()` в
cosmicSettings.

**Status:** PARTIALLY WIRED — StabilizationModal reads `getReducedEffects()`
для skip slot anim. Awakened presets dispatcher (Phase 13) ещё не clamp'ит
tier. Patch для post-release или Phase 20.

### openBoxesInstantly → SerumSlotMachine (UX-06)

`grep "instantBoxes\|getInstantBoxes" client/src/components/CosmicHub/` returns
≥1 line. Smoke: enable toggle → opening legendary box завершается за ~1с
(не 9-10c).

**Status:** WIRED (Phase 15) — `getInstantBoxes()` читается в `SerumSlotMachine.tsx`
для timing. Verified by existing Phase 15 implementation.

---

## Phase 19-07 — Final smoke (FPS + tutorial + pity UI)

### FPS targets (PERF-01)

- [ ] **Desktop Chrome:**
      - DevTools Performance → record 30s session
      - 4 carriers + farming + Cosmic Hub open → average FPS ≥ 60
- [ ] **Mid-tier Android (если доступно):**
      - Open Telegram WebApp / direct browser
      - 4 carriers + 30s farm → average FPS ≥ 50
- [ ] **Low-tier Android (если доступно):**
      - 30 FPS minimum threshold

### Tutorial overlay full sequence (UX-08)

- [ ] Clear localStorage → reload → verify no overlays
- [ ] Send first scout → mission complete → first openBox → видим first-box overlay
- [ ] tap CTA → reload → НЕ показывается снова
- [ ] Repeat для first-serum, first-feed, first-stabilize

### Pity counter UI (UX-01)

- [ ] openedCount = 0 → footer hidden
- [ ] openedCount = 3 → footer shows DotIndicator с правильным fill
- [ ] openedCount = 5 → footer shows exact «До rare/epic/legendary через N»
- [ ] Numbers consistent с pity counter actual values

### Bundle health (PERF-05, PERF-07)

- [x] Production build clean — see `dist/assets/index-*.js` and `CosmicHubModal-*.js`
      separate chunks
- [ ] `node client/scripts/check-bundle-delta.cjs` exits 0 (delta ≤ 50 KB cap)
