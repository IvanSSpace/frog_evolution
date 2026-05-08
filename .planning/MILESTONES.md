# Milestones — Frog Evolution

## v1.0 — Локализация + Настройки + Редкие боксы + Уникальные планеты ✅ COMPLETE
**Period:** 2026-05-06 → 2026-05-08
**Status:** 8/8 phases, 26/26 plans, 100% complete

### Фазы
1. **i18n Setup** — мультиязычность RU/EN/ES, переводы лягушек
2. **Settings Modal** — полноэкранная панель с табами (Бестиарий / Настройки / Музыка)
3. **Bestiary** — карточки 24 лягушек, силуэты для неоткрытых
4. **Number Format** — переключатель формата денег (1.5K vs 1,500)
5. **Rare Crate** — золотой бокс + слот-машина для редкой лягушки
6. **Rare Box Rework** — пересмотр механики (не дроп, а порог обычных)
7. **Unique Planet Animations & Textures** — уникальные анимации/текстуры для 450 планет, +10 новых компонентов, 9 архетипов с sub-variants, 6 новых universal modifiers, 100% uniqueness
8. **Full Planet Uniqueness** — финализация уникальности 1000 планет (3 axes: анимации, текстуры, звук), 96+ animation components, theme pools ≥14, звуковые модуляции pitch/voicing/detune/cutoff

### Ключевые достижения
- 1000 планет в planetMap.json (16 main + 984 BG)
- 88+ атомарных анимаций кликов с sound-style таблицей
- 100% уникальность анимаций и текстур всех планет
- Полная локализация UI на RU/EN/ES
- Стабильная инфраструктура для endgame-расширения

---

## v2.0 — Cosmic Frogs System ✅ COMPLETE
**Period:** 2026-05-08 → 2026-05-08
**Status:** 10/10 phases (Phase 9-19; Phase 10 skipped, Phase 20 deferred), 40/40 plans, 100% complete
**Phases:** 9-19 (Phase 20 = pre-release safety net deferred to prod-cutover)

### Goal
Endgame-расширение через систему элементных лягушек: сыворотки с космо-планет, 16 элементов × 4 редкости × 24 уровня = 1536 ячеек коллекции, gacha-style открытие с slot-machine drama.

### Фазы

| Phase | Name | Status |
|-------|------|--------|
| 9 | Refactor anim primitives (BLOCKING) | complete |
| 10 | Performance HUD (mini) | skipped (по решению пользователя) |
| 11 | CosmicSlice store + Cosmic Hub shell | complete |
| 12 | FrogElementOverlay (dormant + pool + cap) | complete |
| 13 | Element awakened tiers | complete |
| 14 | Сыворотки tab + tap-to-select DnD | complete |
| 15 | Boxes — cascade + slot-machine + skip + bulk | complete |
| 16 | Ship + travel + mission (1-ship navigation) | complete |
| 17 | Carrier evolution + feed + ceiling + merge | complete |
| 18 | Бестиарий 2.0 (1536 cells, virtualized) | complete |
| 19 | Balance + tutorial + toggles + i18n polish | complete |
| 20 | Pre-release safety net (INFRA-01..06 + PERF-04) | deferred |

### Final v2.0 metrics (closure 2026-05-08)

- **Bundle main index.js:** 196 KB (v1.0 baseline) → 229.24 KB gzip (Phase 19 final)
- **Total bundle delta vs v1.0:** +33.24 KB / 50 KB cap (66% used)
- **Lazy chunks:** CosmicHubModal (14.22 KB) + SerumSlotMachine (2.06 KB) + CascadeRevealModal (1.81 KB) + 4 location-music chunks
- **Bestiary:** 1536 unique cells (16 elements × 4 rarities × 24 levels) virtualized via @tanstack/react-virtual
- **i18n parity:** 286 unique keys × 3 locales (RU/EN/ES) verified by `npm run check-translations`
- **Monte Carlo balance:** pityHard25Breaches=0, gap.max=25, avgLegendary effective ≈6% over 100K iterations
- **Total REQ coverage v2.0:** 119/119 requirements mapped (Phase 11..19 covered all in-scope)
- **STORAGE_VERSION:** 19 (final v2.0)
- **Test suites:** 5 (`tsx` + node:assert): rarityRoll 11 + slice 11 + slice.openBox 9 + cosmicSettings 5 + carrierEvolution Monte Carlo 4 = 40 unit tests

### Ключевые достижения v2.0
- Замкнутый коллекционный мета-loop (acquire serum → apply → feed → stabilize → merge above ceiling → bestiary unlock → milestone reward)
- Pity-driven gacha (locked weights 50/35/12/3 + soft 15/20 + hard 25 guarantees + Monte Carlo verified)
- Slot-machine reveal drama (1.2-9.5s rarity-locked durations + skip + element fingerprint particles + bulk-open)
- 1-ship navigation model (travel formula + 4 daily missions + 3 mini-clickers + investigatePlanet atomic transaction)
- Carrier evolution (hidden ceiling pre-determined at first feed + S-bucket guaranteed merge + 30% dispose recovery)
- Virtualized bestiary 2.0 (DOM ≤30 cells одновременно for 1536 entries; rarity/element filter + sort + show-locked toggle + CSS-based awakened preview modal + milestone rewards 10/24/96/576)
- Progressive UX disclosure (sentinel flags hasFirstFeed/hasFirstMission/hasOpenedAnyBox + 4-step tutorial overlay first-box/serum/feed/stabilize)
- Visible progressive pity counter (hidden/dots/exact reveal at 0/3/5 opened boxes — Genshin-style transparency)
- Settings ergonomics: 4 toggles (instantBoxes WIRED + reducedEffects PARTIAL + calmFarmMode TODO + numberFormat existing)
- Build hygiene scripts: sim-balance + check-translations + check-bundle + verify-uniqueness:anim/texture/sound
- Colorblind-safe palette (Okabe-Ito + Krzywinski 16 distinct hues; mechanical/desert collision fixed in Phase 19-06 audit)

### Out of scope для v2.0 (deferred)
- Phase 10 (Performance HUD) — skipped per user decision
- Phase 20 (Pre-release safety net): INFRA-01..06 incremental migrations + PERF-04 adaptive throttle + scene shutdown discipline — deferred до prod-cutover
- L25-командир и unlock-логика (всё открыто в dev-mode сейчас)
- Сюжетные квесты главных рас (будущий milestone)
- Реальные audio эффекты (sound-style остаются как mental model)
- Multiplayer / серверная синхронизация
- Settings consumer wiring: calmFarmMode → FrogOverlayManager (Phase 20 patch)
- Settings consumer wiring: reducedEffects → awakened presets dispatcher (Phase 20 patch)
- Manual FPS smoke на real Android (60/50/30 targets, see SMOKE_TEST.md)
