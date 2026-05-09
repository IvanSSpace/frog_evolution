# Architecture Patterns — Cosmic Frogs System (v2.0)

**Domain:** Telegram WebApp idle merge-clicker — endgame-расширение
**Researched:** 2026-05-08
**Stack baseline:** React 19 + Phaser 4.1 + Zustand 5 + Vite + Tailwind 3 + mitt eventBus
**Целевая платформа:** Telegram WebApp на mobile (Android/iOS), DPR 1-3, 60 FPS target

> Все рекомендации привязаны к существующему коду: ссылки на `MainScene.ts`, `StarMapScene.ts`,
> `gameStore.ts`, `eventBus.ts`. Принципы DRY и переиспользования инфраструктуры — приоритет.

---

## 1. Phaser overlay для лягушек (80 элементных анимаций × 16 frogs)

### 1.1. Архитектурное решение

**Вердикт:** element-overlay рендерится **внутри Phaser** как дочерний контейнер `FrogData.container`, **НЕ через React/DOM поверх canvas**.

**Почему не React/DOM поверх canvas:**
- 16 элементных оверлеев = 16 `<div>` поверх canvas с собственным `requestAnimationFrame`
  на каждый — деструктивно для Telegram WebView (особенно WebView WKWebView на iOS,
  где DOM-композиция не GPU-accelerated так же агрессивно как Canvas).
- Координаты лягушек меняются каждый кадр (drag, idle wander, magnet attraction —
  см. `MainScene.ts:596-599`, `:1472`). Синк DOM-overlay → Phaser координат через
  `.getBoundingClientRect()` каждый кадр = layout thrash.
- В Phaser уже стоит инфраструктура для tween/destroy/depth-management — не дублировать
  это в React.

**Как именно:** новый класс `FrogElementOverlay` владеет одним Phaser-контейнером,
прикреплённым через `FrogData.container.add(overlayContainer)`. Все элементы
(particles, glow, idle loop) живут внутри.

### 1.2. API и структура

```typescript
// client/src/game/effects/FrogElementOverlay.ts
import Phaser from 'phaser'

export type ElementId =
  | 'fire' | 'ice' | 'water' | 'forest' | 'toxic' | 'plasma'
  | 'shadow' | 'crystal' | 'desert' | 'gas' | 'ring' | 'binary'
  | 'arcane' | 'mechanical' | 'war' | 'void'

export type ElementTier = 'dormant' | 'common' | 'rare' | 'epic' | 'legendary'

export interface FrogElementOverlayConfig {
  element: ElementId
  tier: ElementTier
  // Базовый радиус эффекта вокруг лягушки в физических пикселях.
  // Привязан к sys.size в текущем коде; для frog ≈ 30 * DPR
  radius: number
  // Кэш-ключ для пула. Один FrogElementOverlay переиспользуется
  // через .reset(element, tier) — не destroy/create
  cacheKey: string
}

export class FrogElementOverlay {
  readonly container: Phaser.GameObjects.Container
  private element: ElementId
  private tier: ElementTier
  private timers: Phaser.Time.TimerEvent[] = []
  private graphics: Phaser.GameObjects.Graphics[] = []
  private isVisible = true       // off-screen culling
  private idleAccumMs = 0
  private currentIntervalMs = 0  // динамический throttle

  constructor(scene: Phaser.Scene, cfg: FrogElementOverlayConfig) { /* ... */ }

  setTier(tier: ElementTier): void  // dormant/common/rare/epic/legendary
  setElement(element: ElementId): void
  pause(): void                      // при magnet/merge/drag
  resume(): void
  // Вызывается из MainScene.update(); throttle через accumulator
  update(delta: number, fps: number): void
  // Возврат в pool: останавливает timer'ы, очищает graphics, не destroy()
  release(): void
  destroy(): void
}
```

### 1.3. Кэширование particles: один Graphics vs separate

**Решение:** **гибрид по tier'у.**

| Tier | Технология | Обоснование |
|------|-----------|-------------|
| dormant | 1 общий `Graphics` (one circle, 1 tween) | Минимум draw calls. У всех 16 лягушек — простой статичный glow. ≤16 draw calls. |
| common (tier 1) | 1 `Graphics` + 3-4 эфемерных `Arc` particles | Лёгкие частицы, lifespan 600-1000ms. Recreate ≤2/sec на frog. |
| rare (tier 2) | Phaser `ParticleEmitter` с пулом | ParticleEmitter уже пулирует частицы внутри (см. Phaser 4.1 docs). 1 emitter на frog → 16 emitters total с culling. |
| epic / legendary | ParticleEmitter + 1-2 сложных `Graphics` (lightning, beam) | Дорогие компоненты — но их max 4-6 на сцене одновременно (legendary редкий). |

**Текущий код уже использует похожий паттерн в StarMapScene** —
см. `compFlash`, `compRing`, `compSparkle` (`StarMapScene.ts:1056-1156`).
Все они создают `this.add.graphics()` или `this.add.circle()` с tween до alpha:0
+ destroy. Для **idle-loop** это слишком дорого (на каждый цикл — destroy+create).
Поэтому для FrogElementOverlay переписываем под **переиспользуемые объекты**:

```typescript
// Вместо `this.add.circle().destroy()` каждый цикл:
// 1) создаём один раз в init,
// 2) в idle tick перезапускаем tween на тех же объектах
private idleLoop(): void {
  for (const g of this.graphics) {
    g.setAlpha(1).setScale(0.5)
    this.scene.tweens.add({
      targets: g,
      scale: 1.3,
      alpha: 0,
      duration: 800,
      onComplete: () => { g.setAlpha(1).setScale(0.5) }, // reset, не destroy
    })
  }
}
```

### 1.4. Throttling idle-loop'ов (60 → 30 fps на mobile)

**Принцип:** не использовать `Phaser.Time.TimerEvent` per-frog (16 таймеров — это
fine, но они стартуют синхронно после spawn → 16 одновременных tween'ов в одном
кадре = burst CPU). Вместо этого — **stagger** + **adaptive interval**:

```typescript
// MainScene.update() передаёт delta + текущий fps в каждый overlay
private fpsEstimate = 60
private fpsAccum = 0
private fpsFrames = 0

update(time: number, delta: number) {
  // EMA fps (как в StarMapScene.ts hudFps)
  this.fpsAccum += 1000 / delta
  this.fpsFrames++
  if (this.fpsFrames >= 30) {
    this.fpsEstimate = this.fpsAccum / this.fpsFrames
    this.fpsAccum = 0; this.fpsFrames = 0
  }

  for (const f of this.frogs) {
    if (f.elementOverlay) f.elementOverlay.update(delta, this.fpsEstimate)
  }
}
```

Внутри `FrogElementOverlay.update()`:

```typescript
update(delta: number, fps: number) {
  if (!this.isVisible) return  // off-screen — skip
  this.idleAccumMs += delta

  // Adaptive interval: при 30fps → idle reset раз в 2× реже
  const baseInterval = 2000  // dormant
  const fpsFactor = fps < 45 ? 2 : 1   // hard cutoff
  if (this.idleAccumMs >= baseInterval * fpsFactor) {
    this.idleAccumMs = 0
    this.spawnIdleBurst()
  }
}
```

### 1.5. LOD и culling

**Когда лягушек много (16 на сцене):**
- На текущей локации (visible) — все 16 имеют overlay, но stagger spawn (по 2-3
  frame между активациями).
- На других локациях лягушек нет (см. `MainScene.spawnLocationFrogs`,
  `clearField` `:209-246` — поле очищается). Поэтому **overlay всегда ≤16, не 64**.

**Когда tab свёрнут (`document.hidden`):**

```typescript
// В MainScene.create() или index.ts
document.addEventListener('visibilitychange', () => {
  const fn = document.hidden ? 'pause' : 'resume'
  for (const f of this.frogs) f.elementOverlay?.[fn]()
})
```

Phaser сам останавливает рендер при `visibilitychange`, но idle-loop таймеры
продолжают тикать — поэтому **explicit pause** обязателен.

**Когда Cosmic Hub modal открыт (поверх Phaser):**
- Через event bus `eventBus.emit('cosmicHub:open')` — все overlay'и переходят в
  `dormant` tier (минимальный glow), чтобы за прозрачным фоном модалки они не
  мерцали. Это аналог тому, как `MagnetToggle` исчезает при `starmap:open`
  (`App.tsx:438-501`).

### 1.6. Жизненный цикл overlay

```
spawnFrog(level) →
  spawnFrog._init() →
    if (frog.element) {
      const overlay = ElementOverlayPool.acquire(scene, element, tier)
      frog.container.add(overlay.container)
      frog.elementOverlay = overlay
    }

removeFrog(frog) →
  if (frog.elementOverlay) {
    ElementOverlayPool.release(frog.elementOverlay)
    frog.elementOverlay = null
  }
  frog.container.destroy()  // overlay.container НЕ destroy — он в пуле
```

**Pool API:**

```typescript
// client/src/game/effects/elementOverlayPool.ts
class ElementOverlayPool {
  private free: Map<string, FrogElementOverlay[]> = new Map()
  acquire(scene: Phaser.Scene, element: ElementId, tier: ElementTier): FrogElementOverlay
  release(overlay: FrogElementOverlay): void
  drain(): void  // при смене сцены — destroy все
}
```

Это **DRY pattern** — повторяет то, что Phaser ParticleEmitter делает для частиц,
но на уровень выше для целых overlay-композиций.

---

## 2. React DnD на mobile (Telegram WebApp)

### 2.1. HTML5 drag-n-drop в Telegram WebApp

**HIGH confidence — НЕ работает надёжно на touch.**

Подтверждение:
- Mobile browsers don't support html5 drag and drop natively
  ([drag-drop-touch-js polyfill exists for this reason](https://github.com/drag-drop-touch-js/dragdroptouch))
- Telegram WebView это WKWebView (iOS) / Android System WebView — наследуют те же
  ограничения.
- Существующий MainScene использует **Phaser native input drag** (`body.on('dragstart' / 'drag' / 'dragend')`,
  см. `MainScene.ts:549-650`) — это работает, потому что Phaser сам нормализует
  touch/mouse в Pointer events.

### 2.2. Архитектурное решение для DnD сыворотки React → Phaser canvas

**Hybrid подход.** Drag начинается в React (Cosmic Hub modal), а после первой
точки движения **передаётся в Phaser MainScene** через event bus + global pointer
listener.

**Почему не react-dnd / dnd-kit:**
- Drop target — это Phaser canvas, не DOM. react-dnd ожидает DOM target — не
  подходит.
- dnd-kit требует registered Droppable — DOM-only API.
- Custom Pointer Events дают полный контроль и интегрируются с тем, что уже есть
  в MainScene.

**Сценарий:**

```
1. User тапает на slot сыворотки в Cosmic Hub modal (React)
   → onPointerDown emits 'serum:dragstart' с метаданными {serumId, element, tier}
   → modal закрывается с CSS opacity transition (НЕ unmount — сохраняется state)
   → spawnется ghost-element <img> в position:fixed следующий за pointer

2. User двигает палец → 'serum:dragmove' через document pointermove
   → ghost-element обновляет style.transform (translate3d) через RAF

3. User отпускает палец над лягушкой на Phaser canvas
   → 'serum:dragend' с pointer координатами в DOM
   → конвертируем DOM coords → Phaser scene coords:
       const rect = canvas.getBoundingClientRect()
       const sceneX = (e.clientX - rect.left) * dpr  // см. game/index.ts:29 для DPR
       const sceneY = (e.clientY - rect.top) * dpr
   → MainScene.findFrogAt(sceneX, sceneY) → если есть и element-eligible:
       MainScene.applySerum(frog, serumPayload)

4. Если drop вне валидной зоны:
   → ghost-element анимирует возврат к origin (modal slot position)
   → modal opacity restore → 1
   → 'serum:dragcancel'
```

### 2.3. Конкретный API DnD-слоя

```typescript
// client/src/ui/dnd/SerumDragController.ts
export interface SerumDragPayload {
  serumId: string         // UUID сыворотки
  element: ElementId
  tier: ElementTier
  iconPath: string        // для ghost
}

export class SerumDragController {
  private static instance: SerumDragController
  private ghostEl: HTMLElement | null = null
  private payload: SerumDragPayload | null = null
  private startX = 0; private startY = 0
  private moved = false

  static start(payload: SerumDragPayload, e: React.PointerEvent): void
  // Внутренние:
  private onPointerMove = (e: PointerEvent) => { /* update ghost */ }
  private onPointerUp = (e: PointerEvent) => { /* dispatch to scene */ }
  private dispatchDrop(clientX: number, clientY: number): void
}
```

**Event bus contract:**

```typescript
// добавления в eventBus.ts:
'serum:dragstart': { payload: SerumDragPayload }
'serum:dragmove':  { x: number; y: number }
'serum:dragend':   { sceneX: number; sceneY: number; payload: SerumDragPayload }
'serum:dragcancel': void

// MainScene слушает 'serum:dragstart' и сразу делает:
'frog:pause-magnet-merge': void   // см. MainScene.ts magnets array
'frog:resume-magnet-merge': void
```

### 2.4. Magnet/merge auto-pause

В текущем `MainScene.update()`:

```typescript
// добавить в начало:
if (this.serumDragActive) {
  // не двигаем магнит, не считаем merge proximity, не процессим dropSpeed
  return
}
```

Установка флага:

```typescript
eventBus.on('serum:dragstart', () => { this.serumDragActive = true })
eventBus.on('serum:dragend', () => { this.serumDragActive = false })
eventBus.on('serum:dragcancel', () => { this.serumDragActive = false })
```

Уже сейчас MainScene имеет `isLocationTransitioning` флаг с похожей семантикой
(`MainScene.ts:286-287`) — повторяем тот же паттерн.

### 2.5. Cross-domain DnD (HTML overlay → game canvas) — best practices

| Pitfall | Mitigation |
|---------|------------|
| `pointermove` теряется при выходе ghost за границы окна | Использовать `setPointerCapture(pointerId)` на ghost-element |
| iOS прерывает gesture при scroll | `touch-action: none` на ghost + body во время drag (`document.body.style.touchAction = 'none'`) |
| Phaser canvas perehat'ил pointer-event | Канвас не должен препятствовать — у нас он не получает события до dragend (ghost поверх) |
| Tap по канвасу во время drag = ложный merge | `serumDragActive` блокирует MainScene.input |
| Telegram swipe-to-close в момент drag | Уже отключено `tg.disableVerticalSwipes()` (`utils/telegram.ts:27`) |
| Memory leak ghost-element | На dragend/cancel — удаление из DOM + null payload |

---

## 3. State management для большого инвентаря

### 3.1. Размеры данных

| Стор-сегмент | Кол-во записей | Размер per-record (JSON) | Total |
|--------------|---------------|--------------------------|-------|
| Сыворотки активные (в инвентаре) | ~100 (peak ~200) | ~120 байт | ~24 KB |
| Carrier-frogs (на 4 локациях) | ≤16 × 4 = 64 | ~80 байт | ~5 KB |
| Бестиарий v2.0 progress | 1536 boolean (24 levels × 16 elements × 4 rarity) | 1 bit (закодировано) | **192 байта** компактно, ~2 KB как JSON object, **~30 KB** как `Record<string, true>` с длинными ключами |
| Pity counters | 3 × 16 elements = 48 чисел | 4 байта | ~200 байт |
| Активные expedition | ≤16 одновременно | ~100 байт | ~2 KB |
| История expedition | ~1000 (накопится за месяцы) | ~80 байт | ~80 KB |

**Total активный стейт без истории: ~35 KB JSON.** Безопасно для localStorage
(~5 MB hard limit per origin, [reference](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).

### 3.2. localStorage vs IndexedDB

**Решение:** **localStorage оставляем для активного стейта; IndexedDB ТОЛЬКО если
истории expedition превысит 100 KB**.

Текущий код использует localStorage с **versioned key pattern** (`STORAGE_VERSION = 15`,
`gameStore.ts:150`). При несовместимости конфигов — wipe + reset на defaults
(`gameStore.ts:155-164`).

| Аспект | localStorage | IndexedDB |
|--------|-------------|-----------|
| Sync API | ✅ | ❌ async |
| Размер | ≤5 MB на origin (Telegram limit ~5 MB per user) | сотни MB |
| Сложность кода | минимум | wrapper + transaction handling |
| Подходит для current scope | ✅ | overkill |

**Когда переходить на IndexedDB:**
- Если история expedition действительно > 100 KB
- Если **бестиарий 2.0** хранит метаданные (когда открыто, на какой лягушке) → +2-3 поля per-cell × 1536 cells = ~150 KB
- Прибавление телеметрии (для аналитики гача-баланса)

Сейчас — `localStorage` достаточно. Добавить IndexedDB позже как pure миграцию,
если разрастётся.

### 3.3. Структурирование gameStore для cosmic-системы

**Один store-файл vs несколько.** Текущий `gameStore.ts` уже 16.5 KB и handle'ит
upgrades + frogs + boxes + locations + magnets + format + sessions. Добавление
cosmic-системы целиком сюда увеличит до ~30 KB и ухудшит DX.

**Рекомендация: НЕ создавать второй Zustand store**. Несколько Zustand store'ов
не имеют автоматического шаринга — придётся вручную координировать. Вместо этого:

1. Оставить **один store** `useGameStore`, добавить туда подмодуль `cosmic`.
2. Вынести **большие конфиги** (16 elements × 4 tiers × 24 levels = таблица 1536
   шаблонов) в отдельный `client/src/game/cosmic/cosmicConfig.ts` — статика.
3. Persistence-функции вынести в отдельные файлы по доменам:
   `client/src/store/persistence/cosmic.ts`.

```typescript
// gameStore.ts (расширение)
interface CosmicState {
  // Сыворотки (инвентарь)
  serums: Serum[]
  addSerum: (s: Serum) => void
  removeSerum: (id: string) => void

  // Активные миссии скаутов
  expeditions: Expedition[]
  startExpedition: (frogLevel: number, planetId: string) => boolean
  completeExpedition: (id: string) => RewardBox

  // Бокс-инвентарь (готовые к открытию)
  pendingBoxes: PendingBox[]

  // Carrier-state per-frog (16 типов × 4 локации = max 64 записи)
  carriers: Record<string, CarrierState>  // ключ: `${locationId}_${frogLevel}`
  applySerum: (frogId: string, serumId: string) => boolean

  // Pity счётчики (видимые игроку)
  pity: PityCounters

  // Бестиарий 2.0 — компактное представление
  bestiaryBitset: Uint8Array  // 192 байта = 1536 бит

  // Открытое состояние Cosmic Hub UI
  cosmicHubTab: 'scouts' | 'boxes' | 'serums' | 'bestiary' | null
  setCosmicHubTab: (tab: CosmicState['cosmicHubTab']) => void
}

interface GameState extends /* существующее */, CosmicState {}
```

### 3.4. Бестиарий — bitset вместо object

**1536 ячеек × `Record<string, true>` =** длинные ключи (~20 байт each) + JSON
overhead = **~30 KB**.

**1536 ячеек × `Uint8Array(192)` =** 192 байта raw, ~250 байт base64 в JSON.

```typescript
// client/src/game/cosmic/bestiaryBitset.ts
const BITSET_SIZE = 192  // 1536 / 8

export function bestiaryIndex(level: number, element: number, rarity: number): number {
  // level: 0..23, element: 0..15, rarity: 0..3
  return level * 64 + element * 4 + rarity  // 24 * 16 * 4 = 1536
}

export function isUnlocked(bitset: Uint8Array, idx: number): boolean {
  return ((bitset[idx >> 3] >> (idx & 7)) & 1) === 1
}

export function setUnlocked(bitset: Uint8Array, idx: number): void {
  bitset[idx >> 3] |= 1 << (idx & 7)
}

// Для localStorage: ArrayBuffer → base64
export function bitsetToString(bs: Uint8Array): string {
  let s = ''
  for (const b of bs) s += String.fromCharCode(b)
  return btoa(s)
}
export function bitsetFromString(s: string): Uint8Array {
  const bin = atob(s); const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
```

Это сэкономит 28+ KB и даёт O(1) lookup. UI рендерит сетку 24×64 cells =
1536 div'ов — нужно виртуализировать (см. §4.4).

### 3.5. React subscription pattern

Текущий код использует:
- `useGameStore((s) => s.discoveredLevels)` — selectors (рекомендация Zustand)
- `useGameStore.getState()` для не-React контекстов (Phaser scenes,
  `MainScene.ts:151`)

Для Cosmic Hub:

```typescript
// CosmicHubModal.tsx — использует selectors
const tab = useGameStore((s) => s.cosmicHubTab)
const serums = useGameStore((s) => s.serums)

// SerumsTab — выборочно
const serumsByElement = useMemo(() => groupBy(serums, 'element'), [serums])
```

Для **частых полей** (например, expedition timer обновляется ~раз в секунду),
держать таймер вне Zustand:

```typescript
// Не: setExpedition({...state, remainingMs: -1000})  // re-render всей tree
// Да: useExpeditionTimer(id) — local state с RAF, возвращает remainingMs
```

---

## 4. Cascade reveal performance

### 4.1. Решение: гибрид React + Phaser

**Чисто React:** удобно для контента (icons, numbers, layout), но эффекты
slot-machine + 3D-переходы — слабый GPU acceleration в WebView.
**Чисто Phaser:** избыточно — text rendering, scrolling layouts в Phaser неудобны.

**Рекомендация:** разделить по компонентам:

| Component | React | Phaser |
|-----------|-------|--------|
| Карточка бокса | ✅ | |
| Анимация открытия (rip-flash, частицы) | | ✅ — в overlay scene |
| Cascade reveal список (монеты → ресурсы → сыворотка) | ✅ — sequential mount + CSS transition | |
| **Slot-machine спин** | ✅ — уже сделан в `RareCrateModal.tsx` | |
| Slot-machine drama particles (vibration, glow) | ✅ — CSS keyframes для tier 1-3 | ✅ — для tier 4 (legendary, длинный) |
| Финальная карточка сыворотки | ✅ | |

### 4.2. Cascade orchestration через React state machine

В `RareCrateModal.tsx` уже есть простой машина: `'spinning' | 'result'`.
Расширяем для cascade:

```typescript
// CrateOpenModal.tsx
type Phase =
  | 'idle'
  | 'opening-flash'   // 200ms — общая вспышка
  | 'coins-reveal'    // 600ms — монеты прилетают
  | 'coins-collect'   // 400ms — улетают в Header
  | 'resources-reveal' // 600ms
  | 'resources-collect'
  | 'serum-buildup'   // 300ms — энергия концентрируется
  | 'serum-spin'      // tier-зависимая длительность 1.2-14с
  | 'serum-result'
  | 'closed'

const [phase, setPhase] = useState<Phase>('idle')

useEffect(() => {
  // Автопереход через сценарий — таймеры с cleanup
  const timeline = [
    { phase: 'opening-flash' as Phase, ms: 0 },
    { phase: 'coins-reveal' as Phase, ms: 200 },
    { phase: 'coins-collect' as Phase, ms: 800 },
    { phase: 'resources-reveal' as Phase, ms: 1200 },
    { phase: 'resources-collect' as Phase, ms: 1800 },
    { phase: 'serum-buildup' as Phase, ms: 2300 },
    { phase: 'serum-spin' as Phase, ms: 2600 },
  ]
  const timers = timeline.map(({ phase, ms }) => setTimeout(() => setPhase(phase), ms))
  return () => timers.forEach(clearTimeout)
}, [])
```

Это **state machine, не tween chain** — простой, debug-friendly, можно skip
(`onSkipTap` → setPhase('serum-spin') и уменьшить таймауты).

### 4.3. Slot-machine drama (tier-зависимая длительность)

Уже есть **базовая slot-machine** в `RareCrateModal.tsx:13-15`:

```typescript
const SPIN_DURATION = 2200  // фикс
```

**Расширение для serum slot-machine:**

```typescript
// client/src/ui/components/SerumSlotMachine.tsx
interface Props {
  tier: ElementTier  // дикий → длинный спин для legendary
  elements: ElementId[]  // pool элементов на reel
  finalIndex: number
  onComplete: () => void
}

const TIER_DURATIONS: Record<ElementTier, number> = {
  dormant: 1200,
  common: 1800,
  rare: 4000,
  epic: 7500,
  legendary: 14000,
}

const TIER_CHECKPOINTS: Record<ElementTier, number[]> = {
  dormant: [],
  common: [1500],            // 1 flash
  rare: [1500, 3500],
  epic: [1500, 3500, 5500],
  legendary: [1500, 3500, 5500, 8000, 11000],
}
```

Каждый checkpoint — короткая вспышка (CSS keyframes) + haptic medium. Это
поднимает anticipation. В коде:

```typescript
useEffect(() => {
  if (phase !== 'serum-spin') return
  const checkpoints = TIER_CHECKPOINTS[tier]
  const flashTimers = checkpoints.map(t =>
    setTimeout(() => triggerFlash(), t)
  )
  return () => flashTimers.forEach(clearTimeout)
}, [phase, tier])
```

### 4.4. Виртуализация бестиария (1536 ячеек)

24 × 64 grid = 1536 cells. Чистый рендер — медленно (особенно reflow при
открытии/закрытии).

**Рекомендация:** виртуализировать **по строкам** (24 строки фиксированной
высоты — простой row virtualization, не надо react-virtuoso).

```typescript
// BestiaryV2Tab.tsx
const ROW_HEIGHT = 80
const COL_COUNT = 64  // 16 elements × 4 rarity

function BestiaryGrid() {
  const [scrollTop, setScrollTop] = useState(0)
  const containerH = 600 // viewport
  const totalH = 24 * ROW_HEIGHT

  const startRow = Math.floor(scrollTop / ROW_HEIGHT)
  const endRow = Math.min(24, Math.ceil((scrollTop + containerH) / ROW_HEIGHT) + 1)

  // Рендерим только видимые строки + buffer
  const rows = []
  for (let i = startRow; i < endRow; i++) {
    rows.push(<BestiaryRow key={i} level={i + 1} />)
  }

  return (
    <div onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{ height: totalH, position: 'relative' }}>
        <div style={{ position: 'absolute', top: startRow * ROW_HEIGHT, width: '100%' }}>
          {rows}
        </div>
      </div>
    </div>
  )
}
```

Достаточно: видимых ~8 рядов одновременно × 64 ячейки = 512 cells = норм.

---

## 5. Bundle size

### 5.1. Текущая ситуация

- v1.0 финал: **~203 kB gzipped** (см. `ROADMAP.md:124` Phase 8 delta +7.21 kB)
- Cap для v2.0: **+50 kB delta**, всего 253 kB

### 5.2. Что добавляет v2.0

| Часть | Estimate (gzipped) | Технология экономии |
|-------|---------------------|---------------------|
| 80 element-overlay рецептов | +12-18 kB | DRY pool из 8-12 базовых компонентов (см. §6) |
| Cosmic Hub UI (4 таба) | +8-12 kB | lazy import: `const CosmicHub = lazy(() => import('./CosmicHub'))` |
| Slot-machine drama | +3 kB | Переиспользует RareCrateModal infrastructure |
| Bestiary 2.0 grid (1536 cells) | +2 kB | Чистый рендер + виртуализация — без либ |
| Cosmic config (16 × 4 × 24) | +4-6 kB | Хранить как compact array, не object-of-objects |
| DnD layer | +2 kB | Без библиотек (Pointer Events native) |
| Translations (RU/EN/ES × ~80 строк) | +3 kB | i18n уже подключен |
| **Итого** | **+34-46 kB** | в пределах cap |

### 5.3. Code splitting strategy

```typescript
// App.tsx
const CosmicHubModal = lazy(() => import('./ui/components/CosmicHubModal'))

// При первом открытии Cosmic Hub:
<Suspense fallback={null}>
  {cosmicHubOpen && <CosmicHubModal onClose={...} />}
</Suspense>
```

Cosmic Hub и весь его код (4 таба, ~10-15 KB) **не грузится** до первого открытия
— игрок проходит первые часы без cosmic-функционала.

**Ещё кандидаты на lazy:**
- `SerumSlotMachine` — отдельный chunk (загружается при открытии бокса)
- `BestiaryV2Tab` — chunk при первом переходе на таб

### 5.4. Shared particle pool

**Сейчас:** 96 animation components в `StarMapScene` (`StarMapScene.ts:1056-1156`).
Многие из них (compFlash, compRing, compSparkle, compConfetti) **подходят для
elemental overlay**.

**Решение:** вынести 8-12 базовых компонентов в **shared module**
`client/src/game/effects/anim/` → импортируется и в StarMapScene и в
FrogElementOverlay. Это не уменьшает bundle (компоненты были и так), но
**избегает дублирования** при добавлении новых elemental components в v2.0.

```typescript
// client/src/game/effects/anim/index.ts
export { runRing } from './ring'
export { runSparkle } from './sparkle'
export { runFlash } from './flash'
// ...

// StarMapScene и FrogElementOverlay оба импортируют из этого модуля
```

См. подробнее §6.

---

## 6. Reusing existing infrastructure

### 6.1. Какие из 96 components в StarMapScene переиспользовать

После анализа `StarMapScene.ts:1055-1156` (`runAnimComponent` switch),
следующие компоненты применимы для **elemental frog overlay** напрямую:

| Component | Element fit | Refactor cost |
|-----------|------------|---------------|
| `compRing` (#0) | универсальный glow | low — переиспользовать |
| `compMultiRing` (#1) | rare+ tier glow | low |
| `compSparkle` (#2) | crystal, ice, plasma | low |
| `compFlash` (#3) | universal awakening burst | low |
| `compLightning` (#4) | plasma, war, mechanical | low |
| `compHaloFlash` (#11) | legendary всех элементов | low |
| `compFireworks` (#67) | celebration (legendary spawn) | low |
| `compToxicCloud` (#21) | toxic | low |
| `compFlameTongues` (#50) | fire | low |
| `compFrostExplode` (#60) | ice | low |
| `compPlasmaArc` (#87) | plasma | low |
| `compLavaErupt` (#18) | fire (epic) | low |
| `compBubbleStream` (#86) | water | low |
| `compIceWisps` (#74) | ice | low |
| `compBloomPetals` (#19) | forest | low |
| `compChimeRing` (#76) | crystal, arcane | low |
| `compPlasmaArc` (#87) | plasma | low |
| `compShieldRipple` (#66) | shadow, void | low |

Это **18 компонентов уже existing** — только нужно extract из StarMapScene.

### 6.2. План рефакторинга

**Phase 1 (NOT optional, делаем сразу при старте v2.0):** extract **shared
animation primitives** в `client/src/game/effects/anim/`.

```typescript
// client/src/game/effects/anim/types.ts
export interface AnimContext {
  scene: Phaser.Scene
  parent: Phaser.GameObjects.Container
  // Целевая система. Для StarMap = Race/BgSystem (size, color, accent),
  // для FrogElementOverlay = что-то типа { size, color, accent } interface
  target: AnimTarget
  rng: () => number
}

export interface AnimTarget {
  size: number
  color: number    // hex
  accent: number   // hex secondary
}

// client/src/game/effects/anim/ring.ts
export function runRing(ctx: AnimContext, opts?: { duration?: number; loop?: boolean }) { /* ... */ }
```

**Затем:**
- StarMapScene вызывает `runRing(ctx, ...)` вместо `this.compRing(...)`
- FrogElementOverlay вызывает те же функции

**Pros:**
- DRY: одна реализация для StarMap-tap и frog-element-overlay
- Bundle: code shared, нет дубликата
- Тестируемость: можно вынести unit-тесты на pure функции

**Cons:**
- Рефакторинг StarMapScene (6430 строк, 96 методов) — большой PR
- Нужно сохранить **strict animation signature** (`08-02-PLAN.md` упоминает
  uniqueness verification 1000/1000) — после рефакторинга все signatures
  должны остаться идентичны (verify-uniqueness script всё валидирует)

### 6.3. Разделение pool'ов

| Pool | Компонентов | Использование |
|------|------------|---------------|
| `anim/shared/*` | 18 базовых | StarMap-clicks + Frog-overlay |
| `anim/starmap-only/*` | 78 специфичных | StarMap-only (compMagneticField, compConstellation, compWormhole — слишком крупные для frog overlay) |
| `anim/frog-only/*` | 12 новых | Frog-specific (idle-loop oriented, не one-shot) |

Frog-only компоненты — **переиспользуемые с reset()** вместо одноразовых:

```typescript
// frog-only/elementGlow.ts
export class ElementGlowFx {
  constructor(ctx: AnimContext) { /* create graphics once */ }
  start(): void
  pause(): void
  setIntensity(t: number): void  // 0..1, для tier
  destroy(): void
}
```

---

## 7. Storage и migration

### 7.1. Текущий versioning pattern

```typescript
// gameStore.ts:150
const STORAGE_VERSION = 15

// При несовпадении:
if (ver !== STORAGE_VERSION) {
  localStorage.removeItem(UPGRADES_KEY)
  localStorage.removeItem(PURCHASES_KEY)
  // ...
}
```

**Стратегия:** **wipe-on-mismatch**, не миграция. Подходит для альфа/бета.
Для v2.0 — оставляем тот же pattern.

### 7.2. Новые ключи для cosmic-системы

```typescript
// gameStore.ts (расширения)
const COSMIC_SERUMS_KEY = 'frog_evolution_cosmic_serums'
const COSMIC_EXPEDITIONS_KEY = 'frog_evolution_cosmic_expeditions'
const COSMIC_BOXES_KEY = 'frog_evolution_cosmic_boxes'
const COSMIC_CARRIERS_KEY = 'frog_evolution_cosmic_carriers'
const COSMIC_PITY_KEY = 'frog_evolution_cosmic_pity'
const COSMIC_BESTIARY_KEY = 'frog_evolution_cosmic_bestiary'  // base64 bitset
```

**Bump `STORAGE_VERSION = 16`** при добавлении cosmic-полей. Старые сохранения
очистятся автоматически (это OK — playtest, не prod).

### 7.3. Когда понадобится миграция

Только когда **выйдем в Telegram production**. До этого момента:
- bump VERSION → wipe → resave
- Никакой ETL логики

После prod:
```typescript
// Псевдокод миграции
function migrate(from: number, to: number, raw: any): any {
  const migrators: Record<string, (d: any) => any> = {
    '15->16': (d) => ({ ...d, cosmic: { serums: [], expeditions: [] } }),
    '16->17': (d) => ({ ...d, cosmic: { ...d.cosmic, pity: defaultPity() } }),
  }
  let cur = raw
  for (let v = from; v < to; v++) {
    cur = migrators[`${v}->${v+1}`]?.(cur) ?? cur
  }
  return cur
}
```

Не делаем это сейчас — overengineering для playtest stage.

### 7.4. Сыворотка-инвентарь — отдельный ключ

Да, **отдельный** (`COSMIC_SERUMS_KEY`). Причины:
- Чтение/запись инвентаря частое (open box, drag-apply, feed) — отдельный JSON
  ускоряет JSON.parse/stringify (не парсим всё сохранение).
- Размер ~24 KB peak — отдельный ключ ниже limit'a (5 MB total).
- Автономно тестируется/wipe'ается.

---

## 8. Конкретные рекомендации

### 8.1. ElementOverlay API — финальный

```typescript
// client/src/game/effects/FrogElementOverlay.ts
export class FrogElementOverlay {
  // Construction:
  static acquire(scene: Phaser.Scene, cfg: FrogElementOverlayConfig): FrogElementOverlay
  release(): void  // вернуть в pool

  // Mutation:
  setTier(tier: ElementTier): void
  setElement(element: ElementId): void
  pause(): void
  resume(): void

  // Lifecycle:
  update(delta: number, fps: number): void
  destroy(): void

  // Inspection:
  readonly element: ElementId
  readonly tier: ElementTier
  readonly container: Phaser.GameObjects.Container
}
```

**Использование в `MainScene.spawnFrog`:**

```typescript
private spawnFrog(x: number, y: number, level: number): FrogData {
  // ... существующий код создаёт container, body
  const carrier = useGameStore.getState().getCarrierForFrog(level, this.currentLocation)
  if (carrier) {
    const overlay = FrogElementOverlay.acquire(this, {
      element: carrier.element,
      tier: carrier.tier,
      radius: 30 * DPR,
      cacheKey: `${carrier.element}_${carrier.tier}`,
    })
    container.add(overlay.container)
    frog.elementOverlay = overlay
  }
  return frog
}

// MainScene.update():
update(time: number, delta: number) {
  // существующий код...
  for (const f of this.frogs) {
    f.elementOverlay?.update(delta, this.fpsEstimate)
  }
}

// MainScene.removeFrog():
private removeFrog(frog: FrogData) {
  frog.elementOverlay?.release()  // → pool, не destroy
  // ... остальной код
}
```

### 8.2. gameStore структура для cosmic — финальная

```typescript
// client/src/game/cosmic/types.ts
export interface Serum {
  id: string         // uuid()
  element: ElementId
  tier: ElementTier
  ceiling: number    // 1..5 (скрытый потолок tier'а)
  createdAt: number  // ms timestamp
}

export interface Expedition {
  id: string
  frogLevel: number       // какую отправили
  planetId: string        // куда
  startedAt: number
  durationMs: number      // 5min..30min
  status: 'in-progress' | 'returning' | 'mini-game-pending' | 'completed'
}

export interface PendingBox {
  id: string
  expeditionId: string
  guaranteedTier: ElementTier  // baseline; final пересчитывается из весов 35/40/20/5
  createdAt: number
}

export interface CarrierState {
  frogId: string         // location:level — primary key
  element: ElementId
  tier: ElementTier
  ceiling: number
  appliedAt: number
  lastFedAt?: number
  feedCount: number
  // Если carrier стабилизировался на ceiling — true
  stabilized: boolean
}

export interface PityCounters {
  // Per-element или global? Используем global (упрощение)
  commonStreak: number    // 3 common→guarantee rare+
  noEpicCount: number     // 10 без epic→guarantee epic+
  noLegendaryCount: number // 25 без legendary→guarantee legendary+
}
```

**В `gameStore.ts`:**

```typescript
interface CosmicSlice {
  serums: Serum[]
  expeditions: Expedition[]
  pendingBoxes: PendingBox[]
  carriers: Record<string, CarrierState>  // key: `${locId}_${level}`
  pity: PityCounters
  bestiaryBitset: Uint8Array

  // Actions
  serumAdd: (s: Serum) => void
  serumRemove: (id: string) => void
  expeditionStart: (frogLevel: number, planetId: string, durationMs: number) => string
  expeditionTick: (id: string) => Expedition['status']
  expeditionComplete: (id: string) => PendingBox
  boxOpen: (id: string) => Serum   // применяет pity, weights, sub-tier
  carrierApply: (locId: number, level: number, serumId: string) => boolean
  carrierFeed: (locId: number, level: number, foodFrogId: number) => 'leveled-up' | 'no-change'
  bestiaryMark: (level: number, element: ElementId, tier: ElementTier) => boolean
}
```

### 8.3. EventBus или direct store calls?

**Текущая практика в коде:**
- Cross-component события (Phaser ↔ React) → `eventBus`
  (`MainScene.ts:560` `eventBus.emit('frog:pickup', ...)`)
- Изменения state → `useGameStore.getState().method(...)`
  (`MainScene.ts:151`)
- React components читают state → `useGameStore((s) => s.field)`

**Рекомендация для cosmic:**

| Сценарий | Через что |
|----------|-----------|
| Drag сыворотки начат (UI → MainScene) | `eventBus` — нужна координация физических действий |
| Открыть box (UI → store) | direct store call → React reactive |
| Carrier applied (store → MainScene для overlay setup) | `eventBus.emit('carrier:applied', { frogId })` + MainScene обновляет overlay |
| Bestiary unlocked (store → notification UI) | `eventBus.emit('bestiary:unlocked', { ... })` |
| Expedition tick (store → UI таймер) | direct store + selector с RAF (см. §3.5) |
| Drop точка определена (Phaser → store + UI close) | `eventBus.emit('serum:applied', ...)` → React listener закрывает modal, store обновляется |

**Принцип:** **store = state, eventBus = events**. Если данные меняются и
React/Phaser должны узнать → store. Если это одноразовый stimulus (анимация
запустилась, drag начался) → eventBus.

### 8.4. Cosmic Hub modal — структура файлов

```
client/src/ui/components/cosmic/
├── CosmicHubModal.tsx         # fullscreen modal с табами (entry point, lazy)
├── tabs/
│   ├── ScoutsTab.tsx          # активные миссии
│   ├── BoxesTab.tsx           # готовые к открытию + cascade reveal
│   ├── SerumsTab.tsx          # инвентарь, drag-source
│   └── BestiaryV2Tab.tsx      # 1536 cells grid (виртуализирован)
├── shared/
│   ├── SerumIcon.tsx          # tinted icon с glow
│   ├── BoxIcon.tsx
│   └── PityCounter.tsx        # видимые счётчики
└── slot-machine/
    ├── SerumSlotMachine.tsx   # tier-зависимая длительность
    └── checkpointFlashes.ts   # CSS keyframes
```

```
client/src/game/cosmic/
├── cosmicConfig.ts            # 16 elements × 4 tiers × 24 levels (статика)
├── boxOpening.ts              # box→serum logic с pity, weights
├── carrierFeed.ts             # feed-эволюция rolls
├── bestiaryBitset.ts          # bit ops + base64
├── types.ts                   # ElementId, ElementTier, Serum, etc.
└── eligibility.ts             # rules: common→L1, rare→L7, epic→L13, legendary→L19
```

```
client/src/game/effects/
├── anim/                      # NEW: shared primitives (см. §6)
│   ├── shared/
│   ├── starmap/
│   └── frog/
├── FrogElementOverlay.ts      # NEW: per-frog overlay
├── elementOverlayPool.ts      # NEW
└── NebulaBackground.ts        # existing
```

```
client/src/store/persistence/
├── upgrades.ts                # extracted from gameStore.ts
├── cosmic.ts                  # NEW: cosmic state persistence
└── version.ts                 # STORAGE_VERSION management
```

### 8.5. Phase ordering recommendations

Из 7 active требований в `PROJECT.md`, рекомендуемый порядок:

| Order | Phase topic | Why first |
|-------|-------------|-----------|
| 1 | Shared anim primitives extract (§6) | Foundation — без этого следующие phases дублируют код |
| 2 | FrogElementOverlay + pool | Core визуал — viewable feedback быстро |
| 3 | gameStore cosmic slice + types | Data layer для UI |
| 4 | Cosmic Hub UI shell + 4 пустых таба | Navigation, lazy loading установлен |
| 5 | Сыворотки tab + DnD apply | Минимально-играбельный loop без миссий |
| 6 | Box opening + slot-machine drama | Источник сывороток |
| 7 | Скаут-экспедиции + mini-clicker mission | Источник боксов |
| 8 | Бестиарий 2.0 grid | Late — нужны все остальные данные |

Это порядок **bottom-up**: каждая phase даёт основу для следующей.

---

## 9. Patterns to Follow

### Pattern 1: Pool — переиспользование вместо destroy/create

**Когда:** объект создаётся часто, имеет одинаковый shape, expensive.
**Применение:** `FrogElementOverlay`, particles в Phaser ParticleEmitter (built-in).

```typescript
// effects/elementOverlayPool.ts
const free: Map<string, FrogElementOverlay[]> = new Map()

export function acquire(scene: Phaser.Scene, key: string, factory: () => FrogElementOverlay): FrogElementOverlay {
  const pool = free.get(key)
  if (pool && pool.length > 0) return pool.pop()!.reset()
  return factory()
}

export function release(overlay: FrogElementOverlay): void {
  overlay.pause()
  const list = free.get(overlay.cacheKey) ?? []
  list.push(overlay)
  free.set(overlay.cacheKey, list)
}
```

### Pattern 2: Versioned localStorage с wipe-on-mismatch

```typescript
// gameStore.ts — уже применено
const VERSION_KEY = 'frog_evolution_storage_version'
const STORAGE_VERSION = 16

if (parseInt(localStorage.getItem(VERSION_KEY) ?? '0', 10) !== STORAGE_VERSION) {
  // wipe всех frog_evolution_* keys
  localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION))
}
```

### Pattern 3: Event bus для Phaser↔React, store для state

См. §8.3.

### Pattern 4: Compact state representation для bestiary

Bitset вместо Record. См. §3.4.

### Pattern 5: Tier-gated complexity — больше эффектов только на rare+

Не давать все 80 анимаций. По tier:

```
dormant:    1 простой glow (1 graphics, 1 tween)
common:     1 glow + 3-4 partial particles
rare:       2 glow + ParticleEmitter (5-8 particles)
epic:       3 layers + lightning/beam компонент
legendary:  всё + checkpoint flashes + screen-shake hint
```

Большинство frog'ов будут common/rare → лёгкие. Epic/legendary редкие → можно
тратить больше GPU.

---

## 10. Anti-Patterns to Avoid

### Anti-Pattern 1: DOM-overlay на каждую лягушку

**Что:** 16 `<div>` поверх Phaser canvas с CSS-анимациями элементов.
**Почему плохо:**
- Layout reflow при движении лягушки → 16 boundingClientRect calls/frame
- iOS WKWebView ограниченная композитинг
- Sync с Phaser координатами всегда отстаёт на 1 frame
**Вместо:** Phaser-native overlay container (см. §1).

### Anti-Pattern 2: Один большой gameStore на 30 KB

**Что:** добавить все cosmic-методы прямо в `gameStore.ts`.
**Почему плохо:**
- DX страдает (search, jump-to-definition)
- Все persistence-функции в одном файле — сложно тестировать
**Вместо:** разделить persistence в `client/src/store/persistence/cosmic.ts`,
конфиги в `client/src/game/cosmic/cosmicConfig.ts`. Store остаётся центром
координации, но импортирует из доменных модулей.

### Anti-Pattern 3: react-dnd / dnd-kit для drop в Phaser canvas

**Что:** установить react-dnd, обернуть слот сыворотки в DragSource, обернуть
канвас в DropTarget.
**Почему плохо:**
- DropTarget требует DOM event → канвас "глотает" события (Phaser слушает их сам)
- Workarounds (transparent overlay div) ломают gesture recognition
**Вместо:** custom Pointer Events controller (см. §2).

### Anti-Pattern 4: Каждое открытие бокса — destroy+create slot machine

**Что:** spinning reel `<img>` элементы создавать при каждом открытии бокса,
unmount при закрытии.
**Почему плохо:**
- Создание 20 reel items каждый раз — мелкий GC pressure
- Анимации не плавные при первом запуске (cold compositor)
**Вместо:** один SerumSlotMachine компонент с `key={openSession}` — React
переиспользует node tree.

### Anti-Pattern 5: localStorage запись каждый tick экспедиции

**Что:** при каждом decrement timer'a — `localStorage.setItem(EXPEDITIONS_KEY, ...)`.
**Почему плохо:**
- Localstorage sync API blocks main thread ~5-50ms при больших объектах
- 16 expeditions × ежесекундный tick = 16 writes/sec
**Вместо:** хранить только `startedAt` + `durationMs`, `remainingMs` вычислять
на лету. Записывать только при start/complete.

### Anti-Pattern 6: Дублирование anim-компонентов в FrogElementOverlay

**Что:** скопировать `compRing`, `compFlash` из StarMapScene и переписать под
overlay-API.
**Почему плохо:**
- Bundle +дубликат
- 96 strict signatures в `verify_anim_uniqueness_strict.cjs` — придётся хранить
  дублированные signatures
- При баге надо чинить в двух местах
**Вместо:** extract в `effects/anim/shared/` (§6.2).

---

## 11. Scalability Considerations

| Concern | At alpha (now) | At beta (200 testers) | At prod (10K+ DAU) |
|---------|---------------|----------------------|--------------------|
| localStorage size | ~35 KB | ~50 KB | ~80 KB (если история длинная) |
| Bundle size | 203 + 35 KB = 238 KB | 250 KB | 250 KB (cap) |
| FPS на mid-tier Android | 60 (16 frogs + overlay) | 50-60 | 45-60 (нужны mobile profilings) |
| State sync server | none | none | Server-side only для expedition timers (anti-cheat) |
| Pity counters | client-only | client-only | server-validated |

**Сейчас (alpha):** ничего не оптимизируем под scale. Server sync для
cosmic-системы выходит за scope v2.0 (`PROJECT.md:53`).

---

## 12. Performance Budget

Целевые ориентиры для v2.0:

| Metric | Budget | Verification |
|--------|--------|--------------|
| Frame time на mid-tier Android (Pixel 4a equiv) | ≤16.6ms (60 FPS) p50 | Manual play-test + StarMapScene HUD `data.fps` (см. `App.tsx:181`) |
| Frame time на iPhone 11+ | ≤16.6ms (60 FPS) | Manual |
| Cosmic Hub open → first paint | ≤300ms | Performance.mark на open emit |
| Box open → slot start | ≤200ms (cascade reveal быстрый) | Performance.mark |
| Drag сыворотки → ghost follow | ≤32ms (≤2 frames) | Manual + PointerEvent timestamps |
| Bundle gzip delta | ≤+50 kB | `vite build` size output |
| localStorage write peak | ≤100KB single write | Profile in DevTools Network |
| Idle CPU usage с 16 overlay | ≤25% on mid-tier Android | DevTools Performance |

---

## Sources

- [Phaser ParticleEmitter docs](https://docs.phaser.io/api-documentation/class/gameobjects-particles-particleemitter) — particles pooled and recycled
- [drag-drop-touch polyfill](https://github.com/drag-drop-touch-js/dragdroptouch) — confirms HTML5 DnD doesn't work on touch
- [Storage quotas (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — localStorage 5-10 MiB
- [LocalStorage vs IndexedDB (RxDB)](https://rxdb.info/articles/indexeddb-max-storage-limit.html) — IndexedDB for >100 KB datasets
- [Telegram Mini Apps storage](https://core.telegram.org/bots/webapps) — 5 MB per user
- [dnd-kit](https://docs.dndkit.com) / [pragmatic-drag-and-drop](https://atlassian.design/components/pragmatic-drag-and-drop) — modern React DnD options (но не подходят для Phaser drop target — see §2.2)
- Existing codebase:
  - `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/game/scenes/MainScene.ts` (drag system, magnets, location transitions)
  - `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/game/scenes/StarMapScene.ts` (96 animation components, theme pools)
  - `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/store/gameStore.ts` (Zustand pattern, versioned persistence)
  - `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/store/eventBus.ts` (mitt event types)
  - `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/ui/components/RareCrateModal.tsx` (existing slot-machine pattern)
  - `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/game/effects/NebulaBackground.ts` (Phaser shader/effect pattern)
  - `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/game/index.ts` (Phaser bootstrap, DPR config, scene transitions)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|-----------|--------|
| Phaser overlay strategy | HIGH | Подтверждено на текущем `StarMapScene` коде + Phaser docs |
| DnD на Telegram WebApp | HIGH | HTML5 DnD на touch не работает — подтверждено polyfill'ом и docs |
| localStorage limits | HIGH | MDN + многочисленные источники |
| Bundle size estimate | MEDIUM | Зависит от реальных рефакторингов (extract anim primitives — может уменьшить или увеличить) |
| FPS budget на mid-tier Android | MEDIUM | Нет профилирования на реальном устройстве — нужно playtest |
| Cascade reveal в React (без Phaser) | HIGH | RareCrateModal уже работает по тому же принципу |
| Bitset для бестиария | HIGH | Стандартная техника, размеры просчитаны |
| EventBus vs store split | HIGH | Уже применяется в текущей кодовой базе |
| Pool pattern для overlay | MEDIUM | Не применяется в текущем коде на этом уровне (только Phaser ParticleEmitter built-in) — рекомендация на основе документированных best practices |
