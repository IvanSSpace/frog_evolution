---
phase: 16-ship-travel-mission
plan: 00
type: execute
wave: planning
depends_on:
  - 11-cosmicslice-cosmic-hub-shell
  - 14-serums-tab-tap-to-select
  - 15-boxes-cascade-slot-machine
autonomous: true
requirements:
  - SHIP-01
  - SHIP-02
  - SHIP-03
  - SHIP-04
  - SHIP-05
  - SHIP-06
  - SHIP-07
  - SHIP-08
  - SHIP-09
  - SHIP-10
  - CREW-01
  - CREW-02
  - CREW-03
  - CREW-04
  - CREW-05
  - CREW-06
  - CREW-07
  - CREW-08
  - MISSION-01
  - MISSION-02
  - MISSION-03
  - MISSION-04
  - MISSION-05
  - MISSION-06
  - MISSION-07
  - MISSION-08
  - UX-09

phase_goal: |
  1 ship на StarMap с полной navigation-механикой (dock/transit/redirect),
  crew daily limit (4 миссии/день, midnight reset), mini-clicker миссии при
  «Изучении» планеты с 3 типами challenges, выдача бокса с element от архетипа
  планеты с rarity-bonus от mission score. Прогрессивное disclosure табов
  Cosmic Hub. После Phase 16 основной игровой loop замыкается полностью:
  ship → mission → box → serum (Phase 14/15) → carrier (Phase 14, dormant tier).

source_artifact_audit:
  goal_coverage:
    - "1 ship visual + state machine (docked/transit)" → Plan 16-01 + 16-02
    - "Travel time formula (~1.5s..120s по distFromHome)" → Plan 16-01
    - "Tap planet → confirm dialog → start transit" → Plan 16-02 + 16-03
    - "Transit anim + redirect mid-flight" → Plan 16-02
    - "Arrival toast + «Изучить» CTA" → Plan 16-03 + 16-04
    - "ShipTab UI с состоянием + crew indicator" → Plan 16-03
    - "Mini-clicker mission overlay (3 типа)" → Plan 16-04
    - "Crew daily limit + midnight reset" → Plan 16-03
    - "Box generation (element from archetype + bonusRarity)" → Plan 16-04
    - "Progressive disclosure" → Plan 16-05
  req_coverage:
    SHIP-01: Plan 16-01 (типы ShipState + cosmicSlice.ship + ship action)
    SHIP-02: Plan 16-02 (ShipSprite Phaser Sprite + ParticleEmitter trail)
    SHIP-03: Plan 16-01 (travelTimeMs formula util)
    SHIP-04: Plan 16-02 (dock visual — sprite остаётся на орбите)
    SHIP-05: Plan 16-02 (linear interpolation transit + trail off на t>0.95)
    SHIP-06: Plan 16-01 + 16-02 (sendShipTo redirect path: новый таймер из current pos)
    SHIP-07: Plan 16-03 (FlightConfirmDialog при тапе на planet)
    SHIP-08: Plan 16-03 (если ship docked у этой planet — без confirm, [Изучить] active)
    SHIP-09: Plan 16-03 (transit timer countdown в ShipTab + arrival overlay на StarMap)
    SHIP-10: Plan 16-02 + 16-03 (arrival toast «Прибыли на NAME» с CTA)
    CREW-01: Plan 16-01 (ship + crew state в cosmicSlice)
    CREW-02: Plan 16-01 (DAILY_CAP константа = 4 в config + slice)
    CREW-03: Plan 16-01 (resetCrewIfNewDay action — Phase 11 уже определил, расширим if needed)
    CREW-04: Plan 16-04 (consumeMissionCredit при investigate)
    CREW-05: Plan 16-03 (Изучить disabled при cap reached + tooltip)
    CREW-06: Plan 16-03 (crew indicator UI «N/4 миссий ⏱ до 14:32»)
    CREW-07: Plan 16-03 (tap на indicator → tooltip explanation)
    CREW-08: Plan 16-04 (pity counter растёт ТОЛЬКО при consume — не при flight)
    MISSION-01: Plan 16-04 (mini-clicker overlay при tap [Изучить])
    MISSION-02: Plan 16-04 (3 типа random per mission: rhythm/defend/hotspot)
    MISSION-03: Plan 16-04 (score → bonusRarity multiplier perfect/good/fail)
    MISSION-04: Plan 16-04 (Skip button с 1с)
    MISSION-05: Plan 16-04 (mission complete → addBox + toast)
    MISSION-06: Plan 16-04 (box.element = elementFromPlanet(archetype) — Phase 12 util)
    MISSION-07: Plan 16-04 (consume 1 credit при investigate)
    MISSION-08: Plan 16-04 (fullscreen overlay с ship+planet на фоне)
    UX-09: Plan 16-05 (progressive tab gating + dev-mode unlock all)
  context_coverage:
    "Re-use StarMap для planet pick (locked decision)": Plan 16-02 (ship rendered внутри StarMapScene; tap planet → emit cosmic:request-flight; FlightConfirmDialog в React layer)
    "Phaser-native (не DOM)": Plan 16-02 (ShipSprite extends Phaser.GameObjects)
    "EventBus = events, store = state (mandate 4.10)": Plan 16-02 (eventBus.emit на arrival; store обновляется через arriveShipAt)
    "Hard cap visible: ship singleton, не входит в 4-overlay limit": Plan 16-02 (ship — отдельная Phaser сущность, не использует elementOverlayPool)
    "Bundle delta cap +50 KB gzip cumulative от v1.0 baseline": Plan 16-05 (verify) — этап 16 цель ≤ +40 KB gzip vs Phase 15 baseline
    "Storage incremental migration": Plan 16-01 (bump STORAGE_VERSION; добавить migration в store init для новых полей crew + ship)
  unplanned_items: []
---

# Phase 16 — Ship + Travel + Mission (1-ship navigation model)

> **Master plan для Phase 16.** Этот файл — индекс. Конкретные задачи находятся
> в `16-01-PLAN.md` … `16-05-PLAN.md`. Запускать через `/gsd-execute-phase 16`.

## Goal

Реализовать **полную ship+travel+mission механику**:

1. **1 ship** на StarMap visual (ракетка с particle-trail) с state docked/transit
2. **Travel time** = `distance / WORLD_DIAGONAL × 120s` (1.5-120s range)
3. **Crew daily limit** = 4 миссии/день, midnight локальный reset
4. **Tap planet** на StarMap → confirm dialog «Лететь сюда (~Xs)?»
5. **Ship arrives** → toast «Прибыли на NAME [Изучить]» (без auto-mission)
6. **«Изучить»** → mini-clicker mission overlay (10-30s) → bonus к rarity → бокс
7. **3 mission types** (random per «Изучить»): rhythm-tap, defend, hot-spot
8. **Mission scoring** → bonusRarity:
   - Perfect (100%): +15% rare-bonus
   - Good (60-99%): +5%
   - Fail/skip: no bonus
9. **Progressive disclosure (UX-09)**: на dev-mode — все табы unlocked.
   Sentinel flags зашиты для Phase 17/19 polish.

После Phase 16 + интеграция с 14+15 даёт **первый fully-playable v2.0
milestone** (per ROADMAP independent shippability).

## Context (что уже есть)

- **Phase 11 (готово):** `cosmicSlice.ship: ShipState | null`,
  `cosmicSlice.crew: { missionsToday, lastResetDay }`. Actions
  `consumeMissionCredit()`, `resetCrewIfNewDay()` уже определены в slice (но
  не используются — Phase 16 wires up). `BoxData[]` + `addBox()` тоже готовы;
  логика open в Phase 15.
- **Phase 12 (готово):** `elementFromPlanet(archetype, mainRaceType)` в
  `client/src/game/effects/elements/elementMapping.ts` — используем для
  определения box.element при mission complete (MISSION-06).
- **Phase 14 (planned):** SerumsTab + apply flow. Carriers создаются.
- **Phase 15 (planned):** `addBox(box: BoxData)` action. CascadeRevealModal
  при тапе по box. Mission complete просто кладёт box в inventory; cascade
  играется при тапе по box в BoxesTab.
- **StarMapScene.ts** (6430→5859 lines after Phase 9): уже emit'ит
  `'starmap:planet-tapped'` event при тапе по planet (line ~824).
  Phase 16 добавляет subscriber «request-flight» который перехватывает тап
  *когда ship-mode active* (Cosmic Hub открыт ИЛИ ship state существует).
- **eventBus** (`client/src/store/eventBus.ts`): уже типизирован для
  `'starmap:open' | 'starmap:close' | 'starmap:planet-tapped'`. Phase 16
  добавит `'cosmic:request-flight' | 'cosmic:flight-confirm' |
  'cosmic:flight-cancel' | 'cosmic:ship-arrived' | 'cosmic:start-mission' |
  'cosmic:mission-complete'`.
- **planetMap.json** (1000 планет, x/y/distFromHome): источник координат для
  travel time + name resolution. WORLD_SIZE = 7000 в DPR-units, всё в одном
  координатном пространстве.

## Plans (5 plan'ов, 5 wave'ов)

| Plan | Wave | Тема | Tasks | Файлы |
|------|------|------|-------|-------|
| 16-01 | 1 | Foundation: types + travel utils + actions расширения + STORAGE bump | 3 | 4 modified |
| 16-02 | 2 | ShipSprite + StarMapScene integration + arrival flow | 3 | 1 created + 2 modified |
| 16-03 | 3 | ShipTab UI + FlightConfirmDialog + crew indicator + i18n | 3 | 3 created + 3 modified |
| 16-04 | 4 | MissionOverlay + 3 mini-clicker variants + box generation | 3 | 4 created + 2 modified |
| 16-05 | 5 | Progressive disclosure (UX-09) + verify + dev helpers + i18n final | 2 | 4 modified |

### Wave Structure (sequential — file conflicts force serial)

```
Wave 1: 16-01 (cosmic/types.ts, cosmic/slice.ts, gameStore.ts, eventBus.ts)
        ↓
Wave 2: 16-02 (ShipSprite.ts NEW, StarMapScene.ts mod, eventBus subscribers in App)
        ↓
Wave 3: 16-03 (ShipTab.tsx renamed from ScoutsTab, FlightConfirmDialog NEW, CrewIndicator NEW, locales × 3)
        ↓
Wave 4: 16-04 (MissionOverlay NEW + 3 mission components NEW, App.tsx wiring, slice action investigate)
        ↓
Wave 5: 16-05 (CosmicHubModal.tsx tab gating, store sentinel flags, locales final, verify script)
```

**Файловые конфликты (исключают параллелизм):**
- 16-01 модифицирует `cosmic/types.ts` + `cosmic/slice.ts` + `gameStore.ts` (foundation)
- 16-02 модифицирует `StarMapScene.ts` (ship rendering hook); 16-03 НЕ трогает StarMapScene → но 16-03 зависит от eventBus сигналов из 16-02
- 16-03 модифицирует `cosmic/slice.ts` opens conflict с 16-01 если бы был параллелен; force serial
- 16-04 потребляет `addBox` из Phase 15 + sigaction `investigatePlanet` (новый, добавляется в 16-01? — НЕТ, чтобы не блокировать testing 16-01..03 без mission). **Решение**: `investigatePlanet` action создаётся в 16-04 plan (slice mod), что вызывает file conflict со 16-03 → форс sequential 16-03 → 16-04.

## Architecture Mandates

### Ship state model (REQ SHIP-01)

```ts
// cosmic/types.ts — РАСШИРЯЕМ существующий ShipState (Phase 11 уже создал плейсхолдер).
export interface ShipStateDocked {
  state: 'docked'
  planetId: string
}

export interface ShipStateTransit {
  state: 'transit'
  fromPlanetId: string  // planetId источник (для отрисовки старта траектории)
  toPlanetId: string
  startedAt: number     // unix ms
  arrivesAt: number     // unix ms
  // Mid-flight redirect: при изменении target — обновляем from = current world pos snapshot.
  // Чтобы не хранить snapshot — redirect перевычисляет startedAt = now(),
  // arrivesAt = now() + travelTimeMs(currentPos, newTarget). fromPlanetId оставляем
  // для имени в UI («В пути от X к Y»); фактическая точка старта вычисляется
  // ShipSprite через current world position.
}

export type ShipState = ShipStateDocked | ShipStateTransit
```

**Backward compat:** Phase 11 ShipState имел поля `dockedAt?, from?, to?, startedAt?, arrivesAt?` — этот плейсхолдер мы заменяем на discriminated union. Storage migration: при load старых v16 saves — если `cosmicSlice.ship` имеет старый shape ИЛИ null — заменить на `null` (re-init на следующий feed). Migration в `gameStore` init logic.

**Initial value:** при первом v2.0 запуске `ship = null`. Когда player первый раз открывает StarMap или ShipTab — auto-spawn `{ state: 'docked', planetId: 'home' }` (через action `ensureShipExists()`).

### CrewState (REQ CREW-01..03)

Phase 11 уже определил:
```ts
crew: {
  missionsToday: number  // 0-4
  lastResetDay: string   // 'YYYY-MM-DD' локальная дата (toLocaleDateString)
}
```

**Phase 16 уточнения:**
- Phase 11 использует `new Date().toISOString().slice(0, 10)` — UTC. Это **bug**, потому что reset должен быть по локальному времени (CREW-03). Phase 16 fix: переключить на локальный `YYYY-MM-DD` через `getLocalDateString()` util.
- `DAILY_CAP = 4` константа в `client/src/game/data/missionConfig.ts` (новый файл) — рядом с другими game constants.

### Travel time formula (REQ SHIP-03)

```ts
// client/src/game/data/missionConfig.ts (NEW)
export const WORLD_SIZE = 7000  // совпадает с StarMapScene.ts:38 (DPR=1)
export const WORLD_DIAGONAL = Math.SQRT2 * WORLD_SIZE * 2  // ≈ 19798
export const TRAVEL_MS_FOR_DIAGONAL = 120_000  // 2 минуты для самого далёкого
export const TRAVEL_MS_MIN = 1_500  // floor для близких

export function travelTimeMs(distance: number): number {
  const ratio = Math.min(distance / WORLD_DIAGONAL, 1)
  return Math.max(TRAVEL_MS_MIN, ratio * TRAVEL_MS_FOR_DIAGONAL)
}

export function planetDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}
```

`distFromHome` в planetMap.json НЕ используется — мы считаем distance от **текущей** позиции ship (которая может быть != home), значит need full euclidean.

### CosmicSlice новые actions (Phase 16)

```ts
// cosmic/slice.ts — добавляем:
export interface CosmicSliceActions {
  ...existing...

  // Phase 16: Ship navigation
  ensureShipExists(): void
    // Если state.ship === null — set { state: 'docked', planetId: 'home' }

  sendShipTo(toPlanetId: string): void
    // - резолвим coords toPlanet из planetMap
    // - если ship.state === 'docked' и planetId === toPlanetId → no-op
    // - если ship.state === 'docked' → calc distance(dockedPlanet, toPlanet)
    //                                  → set ship = transit с fromPlanetId=docked, started=now,
    //                                    arrives=now+travelTimeMs
    // - если ship.state === 'transit' (REDIRECT, SHIP-06) → calc distance(currentWorldPos, toPlanet)
    //   currentWorldPos взять из ShipSprite.getWorldPosition() через store-side helper
    //   (мы храним latestShipPos: { x, y } в slice как transient cached value, обновляется
    //    каждым tick StarMapScene). См. ShipSprite.ts архитектура ниже.

  arriveShipAt(planetId: string): void
    // вызывается из ShipSprite.update когда t >= 1.0:
    // 1. set ship = { state: 'docked', planetId }
    // 2. eventBus.emit('cosmic:ship-arrived', { planetId })

  investigatePlanet(planetId: string, missionResult: 'perfect' | 'good' | 'fail'): void
    // Atomic transaction (одно set()):
    // 1. guard: ship.state !== 'docked' OR ship.planetId !== planetId → no-op
    // 2. consumeMissionCredit() → false → no-op (caller проверяет up-front, но belt-and-suspenders)
    // 3. compute bonusRarity = 0.15 if 'perfect' else 0.05 if 'good' else 0
    // 4. resolve element = elementFromPlanet(archetype, mainRaceType) || 'fire' (fallback)
    // 5. addBox({ id: cuid(), element, opened: false, sourceArchetype: archetype, bonusRarity })
    //    — поле bonusRarity опциональное, читается Phase 15 при box open.
    // 6. emit('cosmic:toast', { type: 'box-received', msg: 'Получен ящик KEPLER',
    //      action: { label: 'Открыть', onClick: openBoxesTab } })

  setShipPosition(x: number, y: number): void  // transient — кеш latestShipPos для redirect calc
}
```

`bonusRarity` поле в `BoxData` — расширение в `cosmic/types.ts` (optional number, default 0). Phase 15 при slot-machine roll учтёт его как `effectiveRarityRoll = baseRoll + bonusRarity` (если поле есть). Phase 15 plan может быть ещё не написан — наша работа лишь storiage поля; integration пишется в Phase 15 если он стартует после.

### ShipSprite (REQ SHIP-02, SHIP-04, SHIP-05)

```ts
// client/src/game/effects/ShipSprite.ts (NEW, ~150 lines)
import Phaser from 'phaser'

export interface ShipSpriteOpts {
  scene: Phaser.Scene
  initialPosition: { x: number; y: number }
}

export class ShipSprite {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container  // root, depth ~1500
  private body: Phaser.GameObjects.Graphics        // ракетка-triangle
  private trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private currentTween: Phaser.Tweens.Tween | null = null

  // Cached current state for redirect calc.
  public state: 'docked' | 'transit' = 'docked'
  public worldPos: { x: number; y: number }

  constructor(opts: ShipSpriteOpts) { ... }

  setDocked(planetPos: { x: number; y: number }): void {
    // 1. kill currentTween if any
    // 2. снять trail (destroy/release)
    // 3. position container near planetPos (orbit offset 30 px)
    // 4. rotation = 0 (или slow rotation вокруг planet — optional polish)
    // 5. state = 'docked'
  }

  startTransit(from: { x: number; y: number }, to: { x: number; y: number }, durationMs: number): void {
    // 1. snap container to from
    // 2. compute angle = atan2(to.y - from.y, to.x - from.x); container.rotation = angle
    // 3. activate trail particles (createEmitter с tint = 0xfde047, lifespan ~600ms)
    // 4. tween container x/y → to.x, to.y over durationMs (linear ease, manual t calc OK)
    // 5. на onUpdate: store.setShipPosition(container.x, container.y) (throttled @ 6 frames)
    // 6. на onComplete: emit('cosmic:ship-arrived', ...) — но фактический arriveShipAt вызывает
    //    consumer (ScoutsTab/StarMap subscriber). ИЛИ ShipSprite напрямую вызывает store.arriveShipAt,
    //    если предзнает planetId. **Решение:** ShipSprite принимает onArrive callback в opts;
    //    StarMapScene передаёт `() => useGameStore.getState().arriveShipAt(toPlanetId)`.
    // 7. trail.stop() при t > 0.95
  }

  redirect(newTo: { x: number; y: number }, newDurationMs: number, onArrive: () => void): void {
    // вызывается при sendShipTo во время transit:
    // 1. kill currentTween, сохрани currentWorldPos
    // 2. startTransit(currentWorldPos, newTo, newDurationMs) с новым onArrive
  }

  destroy(): void { ... }  // killAllTweens + destroy container + trail (REQ INFRA-06)
}
```

### StarMap integration (REQ SHIP-07)

`StarMapScene.ts`:

1. В `create()`: создать `ShipSprite` instance, inject в scene container с depth ~1500 (выше планет, ниже UI).
2. Subscribe на `useGameStore.subscribe(state => state.cosmicSlice.ship, onShipChange)`:
   - `state === 'docked'` → ship.setDocked(planetCoords(planetId))
   - `state === 'transit'` → ship.startTransit(planetCoords(fromPlanetId), planetCoords(toPlanetId), duration)
3. Modify `handlePlanetPress(sys)` — после existing emit `'starmap:planet-tapped'`:
   ```ts
   const cosmicHubOpen = useGameStore.getState().cosmicHubOpen  // флаг в gameStore (новый, Phase 16)
   if (cosmicHubOpen || isShipMode) {
     eventBus.emit('cosmic:request-flight', { planetId: sys.id })
     return  // не играем regular tap-anim
   }
   // ...existing animation logic
   ```
4. Cleanup в `shutdown()`: ship.destroy() + unsubscribe.

**Альтернатива cosmicHubOpen флагу:** просто всегда emit 'cosmic:request-flight' в придачу к 'starmap:planet-tapped' — а App-level subscriber решает, открыт ли Cosmic Hub, и показывает ли confirm dialog. Это cleaner, без new store flag.

**Финал решение:** Always emit `'cosmic:request-flight'` параллельно с tap-anim. React-side subscriber (в `App.tsx`) проверяет `cosmicHubOpen` state из useState и показывает FlightConfirmDialog только если открыт. Это держит StarMapScene чистым (нет store coupling нового флага).

### ShipTab UI (renamed from ScoutsTab)

**Решение по rename:** оставить файл как `ScoutsTab.tsx` ИЛИ переименовать. Lock decision: **переименовать** в `ShipTab.tsx` (Phase 11 был placeholder; чище для будущих чтений).

- `client/src/components/CosmicHub/ShipTab.tsx` (renamed from ScoutsTab.tsx — git rename)
- `CosmicHubModal.tsx` import path change `./ScoutsTab` → `./ShipTab`, label key `cosmic_hub.tab_scouts` → `cosmic_hub.tab_ship`, icon `🚀` остаётся.
- i18n keys: добавить `cosmic_hub.tab_ship` ('Корабль' / 'Ship' / 'Nave'), оставить `cosmic_hub.tab_scouts` помеченным deprecated (но не удалить — другие места могут ссылаться; cleanup в Phase 19).
- `cosmicSlice.lastActiveTab` — type `CosmicTab = 'scouts' | 'boxes' | 'serums' | 'bestiary'`. **Phase 16 решение:** оставить string literal 'scouts' (не trobать enum; rename только UI label, чтобы не делать full migration). Future Phase 19 polish сменит ID при necessity.

**ShipTab content:**
1. Header: «Корабль» + ship state pill:
   - `docked` → «Пристыкован у NAME»
   - `transit` → «В пути → NAME (0:42)»
2. Crew indicator card: «Сегодня: 2/4 миссий ⏱ до утра 14:32»
3. Action buttons:
   - «Открыть карту» → `eventBus.emit('starmap:open')` + close Cosmic Hub
   - «Изучить планету» (only docked + credits available) → trigger MissionOverlay
4. Empty state (no ship yet — ship === null): «Корабль пока не построен. Полети куда-нибудь, чтобы найти ресурсы.» + кнопка «Открыть карту»

### MissionOverlay (REQ MISSION-01..08)

```tsx
// client/src/components/MissionOverlay/MissionOverlay.tsx (NEW)
interface Props {
  planetId: string
  onComplete: (result: 'perfect' | 'good' | 'fail') => void
  onSkip: () => void
}

// State machine: 'intro' (1с warm-up) → 'active' → 'done'
// Random select missionType из 3х в useState.
// Visual: fullscreen overlay, gradient bg, ship icon + planet preview из planetMap.
// Skip button visible с 1с (active state), wrapped в setTimeout 1000ms.
```

3 mini-clicker components (single file, internal subcomponents):
- `RhythmTapMission.tsx` — N=15+random*15 кликов за 30с. На каждый tap — counter++. Score = clamp(taps/N, 0, 1).
- `DefendMission.tsx` — 3 «вспышки» в случайных точках за 15с (interval ~5с). Каждая live 1с. Tap в окно живой вспышки = +1. Score = hits/3.
- `HotSpotMission.tsx` — 5 точек последовательно (каждая 4с window). Игрок ищет/тапает. Score = found/5.

**Score → result (MISSION-03):**
- `score >= 1.0` → 'perfect' (+15% bonusRarity)
- `score >= 0.6` → 'good' (+5%)
- `score < 0.6` → 'fail' (no bonus)

**Skip path (MISSION-04):**
- onSkip → result = 'fail' (auto-complete, no bonus)

**Box generation (MISSION-05, MISSION-06):**
В обработчике onComplete (в App.tsx или Cosmic Hub container):
```ts
const planet = findPlanetById(planetId)
const archetype = planet.kind === 'main' ? planet.type : planet.archetype
const mainRaceType = planet.kind === 'main' ? planet.type : undefined
useGameStore.getState().investigatePlanet(planetId, result)
// (slice action handles addBox + toast internally)
```

### Progressive disclosure (UX-09)

В `cosmicSlice` добавить sentinel flags (Phase 16):
```ts
hasFirstFeed: boolean      // gates Корабль (Phase 17 будет toggle при первом feed)
hasFirstMission: boolean   // gates Боксы (toggle при первой completed mission)
hasOpenedAnyBox: boolean   // gates Бестиарий visualization (Phase 17/18 toggle)
```

**Phase 16 dev-mode**: всё true по умолчанию через DEV-only init helper:
```ts
// gameStore.ts init или App.tsx mount:
if (import.meta.env.DEV) {
  useGameStore.setState((s) => ({
    cosmicSlice: {
      ...s.cosmicSlice,
      hasFirstFeed: true,
      hasFirstMission: true,
      hasOpenedAnyBox: true,
    },
  }))
}
```

Production v2.0: реальная progressive logic в Phase 19. Phase 16 заводит флаги.

CosmicHubModal gating logic:
```tsx
const TABS = [
  { id: 'ship', label: t('cosmic_hub.tab_ship'), icon: '🚀',
    enabled: hasFirstFeed || import.meta.env.DEV },
  { id: 'boxes', label: t('cosmic_hub.tab_boxes'), icon: '🎁',
    enabled: hasFirstMission || import.meta.env.DEV },
  { id: 'serums', label: t('cosmic_hub.tab_serums'), icon: '🧪',
    enabled: true },
  { id: 'bestiary', label: t('cosmic_hub.tab_bestiary'), icon: '📖',
    enabled: hasOpenedAnyBox || import.meta.env.DEV },
]
```

Disabled таб: gray-out + tooltip «Открывается после первой миссии».

### Bundle delta cap

Phase 15 baseline (предполагается, ещё не shipped) — для consistency используем
**Phase 13 baseline 209.45 KB gzip** + Phase 14 estimate +15 KB + Phase 15 estimate +20 KB ≈ **244 KB**. Phase 16 cap = **+40 KB gzip** vs Phase 15 baseline. Реалистично:
- ShipSprite + StarMap mods: +5 KB
- ShipTab + FlightConfirmDialog + CrewIndicator: +6 KB
- MissionOverlay + 3 missions: +10 KB
- i18n + slice extensions + sentinel: +3 KB
- Total: ~24 KB (within +40 KB cap, оставляем запас)

## Success Criteria (Phase-level, проверяется в 16-05)

1. **tsc clean, build passed**, bundle delta ≤ +40 KB gzip vs Phase 15 baseline.
2. **Открыть Cosmic Hub → таб Корабль** показывает текущее состояние ship (или
   placeholder «Корабль не построен»). Если auto-spawn ship at home — показывает «Пристыкован у HOME».
3. **Тап на planet на StarMap (когда Cosmic Hub открыт)** → FlightConfirmDialog
   с информацией о планете и travel time. Confirm → ship стартует transit.
4. **Visual transit**: ракетка движется linear от home к target, ParticleEmitter
   trail активен, rotation по vector. Trail stop на t>0.95.
5. **Redirect**: тап на новую planet во время transit → новый таймер от
   current world pos. Старый tween убит, новый старт. No penalty.
6. **На arrival** — toast «Прибыли на NAME [Изучить]». ShipTab показывает
   «Пристыкован у NAME». Кнопка [Изучить] enabled.
7. **«Изучить»** → MissionOverlay overlay с одним из 3 типов (random) → completion
   → бокс добавлен в `cosmicSlice.boxes` с element от archetype, mission credit
   consumed, toast «Получен ящик NAME».
8. **После 4-й mission** → «Изучить» disabled, tooltip с countdown до 00:00.
   Корабль может летать как обычно (только consume на mission).
9. **Daily reset**: симулировать смену дня (mock Date) → missionsToday = 0.
10. **Progressive disclosure**: prod build + clean save → только Сыворотки +
    Бестиарий unlocked. Dev-mode → all unlocked.

## Threat Model (security_enforcement enabled)

### Trust Boundaries

| Boundary | Описание |
|----------|----------|
| React → Phaser | FlightConfirmDialog confirm → store.sendShipTo → StarMapScene subscriber → ShipSprite |
| Phaser → React | ShipSprite onArrive → store.arriveShipAt → eventBus.emit('cosmic:ship-arrived') → ShipTab/Toast |
| localStorage → store | persisted `ship`, `crew`, `boxes` могут быть подделаны mod'ом |
| User input → mission | Mission overlay принимает touch/click events; результат влияет на bonusRarity → economic value |

### STRIDE Threat Register

| ID | Категория | Component | Disposition | Mitigation |
|----|-----------|-----------|-------------|------------|
| T-16-01 | **Tampering** | localStorage `cosmicSlice.crew.missionsToday` (мод поставит 0) | accept | Single-player local game без monetization. Pity counter тоже local (см. T-19-N в Phase 19). Не крепим — economic value минимальна. |
| T-16-02 | **Tampering** | localStorage `cosmicSlice.ship` (мод поставит docked у дальней planet без transit) | mitigate | `arriveShipAt` валидирует что ship.state === 'transit' перед dock; `sendShipTo` валидирует что planetId существует в planetMap. Migration на load перепроверяет shape. |
| T-16-03 | **Spoofing** | Mock `cosmic:ship-arrived` event из dev tools (skip transit) | accept | Dev tools = local exploit, no leaderboard. По производственным метрикам — игрок может сократить только свой own gameplay. |
| T-16-04 | **Tampering** | Mission score boost через mock `onComplete('perfect')` от React DevTools | mitigate | `investigatePlanet` верит результату caller'а (single-player), но требует ship.state === 'docked' && planetId match → нельзя получить box без `sendShipTo` flow. Crew credit consume — guard. |
| T-16-05 | **Denial of Service** | Spam «Изучить» tap → race condition с одним credit | mitigate | `investigatePlanet` атомарно проверяет credit + decrements + addBox в одном `set()`. UI button disabled во время mission overlay (single overlay). |
| T-16-06 | **Information Disclosure** | Console log `cosmicSlice.ship` в dev mode | accept | Не secret (single-player). Gated `import.meta.env.DEV` (Phase 12 pattern). |
| T-16-07 | **Repudiation** | Игрок жалуется «не получил бокс» — нет audit log | accept | Single-player, no support tickets. localStorage = source of truth. |
| T-16-08 | **Elevation of Privilege** | Mod `hasFirstMission = true` → bypass progressive disclosure | accept | Cosmetic gating (UX). Не gate'ит экономику. |
| T-16-09 | **Tampering** | Race condition: ship.startTransit + одновременный sendShipTo → 2 tweens | mitigate | ShipSprite.startTransit kill'ит current tween первым делом. State обновляется через single store action (transactional set). |
| T-16-10 | **Denial of Service** | ShipSprite tween leak при scene shutdown | mitigate | `ShipSprite.destroy()` killAllTweens + destroy container + null trail. Вызывается в `StarMapScene.shutdown()` (REQ INFRA-06 conventions). |

## Plan Index

См. отдельные файлы:

- `16-01-PLAN.md` — Foundation: types extension, travel utils, store actions, STORAGE migration
- `16-02-PLAN.md` — ShipSprite + StarMapScene integration + arrival flow
- `16-03-PLAN.md` — ShipTab UI + FlightConfirmDialog + CrewIndicator + i18n round 1
- `16-04-PLAN.md` — MissionOverlay + 3 mini-clickers + investigatePlanet action + box generation
- `16-05-PLAN.md` — Progressive disclosure + dev helpers + i18n final + verify

## Verification Strategy

Phase 16 верифицируется в плане 16-05 (последний task = full verify):

- `tsc --noEmit` → 0 errors
- `vite build` → success, bundle delta ≤ +40 KB gzip vs Phase 15 baseline
- Manual smoke (REQ SHIP-01..10): открыть Cosmic Hub → ship docked at home
  → tap planet on map → confirm → transit → redirect → arrival → docked.
- Manual smoke (REQ CREW-01..08): make 4 missions → 5th disabled → tooltip
  countdown. Mock new day → reset.
- Manual smoke (REQ MISSION-01..08): trigger «Изучить» → 3 mission types
  random — verify все 3 спавнятся в dev помощником `__forceMissionType('rhythm')`.
  Score perfect → bonusRarity = 0.15 в next addBox.
- Manual smoke (UX-09): production build (DEV=false) → fresh save → only
  Сыворотки + Бестиарий tabs visible. После flag toggle in dev panel — Корабль и Боксы появляются.

## Output

После завершения каждого plan'а — записать
`.planning/phases/16-ship-travel-mission/16-NN-SUMMARY.md` с:
- Что реализовано (REQ-IDs ✓ / ◑ / ✗)
- Bundle delta gzip (cumulative от Phase 15 baseline)
- Atomic commits в формате `phase-16: <action>` (conventional)
- Smoke checklist results
- Open issues / known limitations

После Phase 16 — обновить `STATE.md` row 16 с finals.
