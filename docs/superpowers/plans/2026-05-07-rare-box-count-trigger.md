# Rare Box Count-Based Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить таймерный триггер мега-боксов на счётчик открытых обычных боксов, ограничить механику локацией 1 (Болото), добавить прогресс-бар в хедер.

**Architecture:** Удаляем `rareBoxProgressMs` и время-based логику из update(). Добавляем `boxOpenCount` — счётчик инкрементируется в `onBoxTapped` только при открытии обычного бокса на Болоте; при достижении порога (`getRareBoxThreshold(level)`) спавним мега-бокс и сбрасываем счётчик. Прогресс (0..1) пишется в gameStore (`rareBoxProgress`) по паттерну существующего `boxProgress`. В Header добавляется `✨`-полоска рядом с `📦`-полоской, видна только на Болоте. Конфиг в gameStore меняем с `intervalMs` (мс) на `counts` (штуки боксов). ShopModal и i18n обновляем под новый формат.

**Tech Stack:** TypeScript, Phaser 3 (MainScene), Zustand (gameStore), React + react-i18next (ShopModal).

---

## Карта изменений

| Файл | Что меняется |
|------|-------------|
| `client/src/store/gameStore.ts` | `intervalMs` → `counts`, `getRareBoxIntervalMs` → `getRareBoxThreshold`, добавить `rareBoxProgress` |
| `client/src/game/scenes/MainScene.ts` | `rareBoxProgressMs` → `boxOpenCount`, логика update() и onBoxTapped(), `setRareBoxProgress` |
| `client/src/ui/components/Header.tsx` | Добавить `RareBoxProgress` компонент рядом с `BoxProgress` |
| `client/src/ui/components/ShopModal.tsx` | `RareBoxSpeedCard` — показывает боксы вместо секунд, скрыта вне Болота |
| `client/src/i18n/ru.json` | `shop.rare_box_speed.effect`: `"{{sec}}с"` → `"{{count}} боксов"` |
| `client/src/i18n/en.json` | `"every {{sec}}s"` → `"every {{count}} boxes"` |
| `client/src/i18n/es.json` | `"cada {{sec}}s"` → `"cada {{count}} cajas"` |

---

## Task 1: Обновить конфиг и экспортируемую функцию в gameStore

**Files:**
- Modify: `client/src/store/gameStore.ts`

Пороги (30 - 1.5×level, округлено):

| Level | Threshold |
|-------|-----------|
| 0 | 30 |
| 1 | 29 |
| 2 | 27 |
| 3 | 26 |
| 4 | 24 |
| 5 | 23 |
| 6 | 21 |
| 7 | 20 |
| 8 | 18 |
| 9 | 17 |
| 10 | 15 |

- [ ] **Step 1: Заменить `intervalMs` на `counts` в `UPGRADE_CONFIG.rareBoxSpeed`**

В `client/src/store/gameStore.ts` найти блок `rareBoxSpeed:` и заменить полностью:

```typescript
rareBoxSpeed: {
    maxLevel: 10,
    // counts[i] = порог открытий обычных боксов для появления мега-бокса на уровне i
    // база 30, максимум 15 (шаг -1.5 за уровень, округлено)
    counts: [30, 29, 27, 26, 24, 23, 21, 20, 18, 17, 15],
    costs: [
      50_000,
      150_000,
      750_000,
      3_800_000,
      18_000_000,
      90_000_000,
      450_000_000,
      1_500_000_000,
      6_000_000_000,
      20_000_000_000,
    ],
  },
```

- [ ] **Step 2: Заменить `getRareBoxIntervalMs` на `getRareBoxThreshold` и добавить `rareBoxProgress` в стор**

Найти функцию `getRareBoxIntervalMs` (~строка 108) и заменить:

```typescript
export function getRareBoxThreshold(upgradeLevel: number): number {
  const arr = UPGRADE_CONFIG.rareBoxSpeed.counts
  return arr[Math.min(upgradeLevel, arr.length - 1)]
}
```

В интерфейс `GameState` (~строка 340, рядом с `boxProgress`) добавить:

```typescript
rareBoxProgress: number
setRareBoxProgress: (v: number) => void
```

В тело `useGameStore` (~строка 457, рядом с `boxProgress: 0`) добавить:

```typescript
rareBoxProgress: 0,
setRareBoxProgress: (v) => set({ rareBoxProgress: v }),
```

- [ ] **Step 3: Проверить TypeScript**

```bash
cd /Users/shar/Documents/frog_evolution/frog_evolution_code/client && npx tsc --noEmit 2>&1
```

Ожидание: ошибки будут — `getRareBoxIntervalMs` ещё используется в других файлах. Это нормально, починим в следующих задачах.

- [ ] **Step 4: Commit**

```bash
git add client/src/store/gameStore.ts
git commit -m "refactor: rareBoxSpeed config intervalMs→counts, getRareBoxIntervalMs→getRareBoxThreshold"
```

---

## Task 2: Переписать логику MainScene — счётчик вместо таймера

**Files:**
- Modify: `client/src/game/scenes/MainScene.ts`

**Что конкретно меняем:**
1. Убрать поле `rareBoxProgressMs` (~строка 74) — добавить `boxOpenCount`
2. Заменить импорт `getRareBoxIntervalMs` → `getRareBoxThreshold`
3. Убрать сброс `rareBoxProgressMs` в двух местах (строки 226 и 413) — заменить на `boxOpenCount = 0`
4. В `onBoxTapped`: добавить инкремент счётчика после обработки обычного бокса
5. В `update()`: удалить всю блок-секцию с `rareBoxProgressMs`

- [ ] **Step 1: Обновить импорт в MainScene.ts**

Найти строку с импортом `getRareBoxIntervalMs` (~строка 2):

```typescript
import { useGameStore, getDropIntervalMs, getMagnetSpawnInterval, getMagnetDuration, getMagnetMergesPerCycle, getCrateLevel, getLocationById, getRareBoxThreshold } from '../../store/gameStore'
```

(убрать `getRareBoxIntervalMs`, добавить `getRareBoxThreshold`)

- [ ] **Step 2: Заменить поле класса `rareBoxProgressMs` на `boxOpenCount`**

Найти строку `private rareBoxProgressMs = 0` (~строка 74) и заменить:

```typescript
private boxOpenCount = 0
```

- [ ] **Step 3: Обновить сброс счётчиков при очистке локации**

В `clearLocationObjects()` (~строка 226) найти:
```typescript
this.boxProgressMs = 0
this.rareBoxProgressMs = 0
```
И заменить на:
```typescript
this.boxProgressMs = 0
this.boxOpenCount = 0
useGameStore.getState().setRareBoxProgress(0)
```

В `onLocationChanged` completion callback (~строка 413) найти:
```typescript
this.boxProgressMs = 0
this.rareBoxProgressMs = 0
```
И заменить на:
```typescript
this.boxProgressMs = 0
this.boxOpenCount = 0
useGameStore.getState().setRareBoxProgress(0)
```

- [ ] **Step 4: Добавить инкремент счётчика в `onBoxTapped`**

В `onBoxTapped()` (~строка 1220) найти блок сразу после `if (box.isRare) { ... return }`:

```typescript
    if (box.isRare) {
      eventBus.emit('rareCrate:opened', { x, y, minLevel: 1, maxLevel: MAX_LEVEL })
      return
    }

    // Считаем открытые обычные боксы → мега-бокс каждые N открытий (только на Болоте)
    const storeForCount = useGameStore.getState()
    if (storeForCount.currentLocation === 1) {
      this.boxOpenCount++
      const threshold = getRareBoxThreshold(storeForCount.upgrades.rareBoxSpeed)
      if (this.boxOpenCount >= threshold && this.canSpawnBox()) {
        this.spawnBox(true)
        this.boxOpenCount = 0
        storeForCount.setRareBoxProgress(0)
      } else {
        storeForCount.setRareBoxProgress(Math.min(this.boxOpenCount / threshold, 1))
      }
    }

    // Спавн лягушки. На Болоте (loc 1) применяется crateQuality, на других локациях — minLevel.
    this.time.delayedCall(0, () => {
```

- [ ] **Step 5: Удалить таймерный блок мега-бокса из `update()`**

Найти и удалить (~строки 1534–1540):

```typescript
    // Редкий бокс (интервал зависит от апгрейда rareBoxSpeed)
    const rareIntervalMs = getRareBoxIntervalMs(store.upgrades.rareBoxSpeed)
    this.rareBoxProgressMs += delta
    if (this.rareBoxProgressMs >= rareIntervalMs && this.canSpawnBox()) {
      this.spawnBox(true)
      this.rareBoxProgressMs = 0
    }
```

Удалить весь этот блок полностью (6 строк).

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/shar/Documents/frog_evolution/frog_evolution_code/client && npx tsc --noEmit 2>&1
```

Ожидание: ошибки только в ShopModal (следующая задача).

- [ ] **Step 7: Commit**

```bash
git add client/src/game/scenes/MainScene.ts
git commit -m "feat: rare box now triggers on box-open count, swamp-only"
```

---

## Task 3: Обновить ShopModal — показывать боксы вместо секунд

**Files:**
- Modify: `client/src/ui/components/ShopModal.tsx`

- [ ] **Step 1: Обновить импорт в ShopModal**

Найти строку импорта (~строка 6):
```typescript
import {
  useGameStore,
  getUpgradeCost,
  getDropIntervalMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getCrateLevel,
  getRareBoxIntervalMs,    // ← убрать
  getRareBoxThreshold,     // ← добавить
  UPGRADE_CONFIG,
} from '../../store/gameStore'
```

- [ ] **Step 2: Обновить `RareBoxSpeedCard` и скрыть вне Болота**

Заменить функцию `RareBoxSpeedCard` (~строка 243) целиком:

```tsx
function RareBoxSpeedCard() {
  const { t } = useTranslation()
  const level = useGameStore((s) => s.upgrades.rareBoxSpeed)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  useGameStore((s) => s.numberFormat)
  const cfg = UPGRADE_CONFIG.rareBoxSpeed
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('rareBoxSpeed', level)
  const canAfford = gold >= cost
  const curCount = getRareBoxThreshold(level)
  const nextCount = isMax ? curCount : getRareBoxThreshold(level + 1)
  const effect = isMax
    ? t('shop.rare_box_speed.effect', { count: curCount })
    : `${t('shop.rare_box_speed.effect', { count: curCount })} → ${nextCount}`
  return (
    <UpgradeCard
      icon="✨"
      title={t('shop.rare_box_speed.name')}
      effect={effect}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() => hapticNotification(buyUpgrade('rareBoxSpeed') ? 'success' : 'error')}
    />
  )
}
```

- [ ] **Step 3: Переместить `RareBoxSpeedCard` в Болото-блок в `ShopCards`**

Найти функцию `ShopCards` (~строка 61) и заменить:

```tsx
function ShopCards() {
  const currentLocation = useGameStore((s) => s.currentLocation)
  const isBoloto = currentLocation === 1
  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto">
      {isBoloto && <DropSpeedCard />}
      {isBoloto && <CrateQualityCard />}
      {isBoloto && <MagnetCard />}
      {isBoloto && <RareBoxSpeedCard />}
      <TractorCard />
    </div>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/shar/Documents/frog_evolution/frog_evolution_code/client && npx tsc --noEmit 2>&1
```

Ожидание: 0 ошибок.

- [ ] **Step 5: Commit**

```bash
git add client/src/ui/components/ShopModal.tsx
git commit -m "feat: ShopModal shows box count for rare box upgrade, swamp-only"
```

---

## Task 4: Обновить i18n (ru / en / es)

**Files:**
- Modify: `client/src/i18n/ru.json`
- Modify: `client/src/i18n/en.json`
- Modify: `client/src/i18n/es.json`

- [ ] **Step 1: Обновить `ru.json`**

Найти секцию `shop.rare_box_speed` и заменить `effect`:

```json
"rare_box_speed": {
  "name": "Мега-бокс",
  "effect": "каждые {{count}} боксов"
}
```

- [ ] **Step 2: Обновить `en.json`**

```json
"rare_box_speed": {
  "name": "Mega Crate",
  "effect": "every {{count}} boxes"
}
```

- [ ] **Step 3: Обновить `es.json`**

```json
"rare_box_speed": {
  "name": "Mega caja",
  "effect": "cada {{count}} cajas"
}
```

- [ ] **Step 4: TypeScript check + финальная проверка**

```bash
cd /Users/shar/Documents/frog_evolution/frog_evolution_code/client && npx tsc --noEmit 2>&1
```

Ожидание: 0 ошибок.

- [ ] **Step 5: Commit**

```bash
git add client/src/i18n/ru.json client/src/i18n/en.json client/src/i18n/es.json
git commit -m "i18n: rare_box_speed effect shows box count instead of seconds"
```

---

## Task 5: Прогресс-бар мега-бокса в Header

**Files:**
- Modify: `client/src/ui/components/Header.tsx`

Добавить `✨`-полоску рядом с существующей `📦`-полоской. Видна только на Болоте (loc 1). Заполняется по мере открытия боксов от 0 до 100%.

- [ ] **Step 1: Добавить подписку на `rareBoxProgress` и компонент `RareBoxProgress` в `Header.tsx`**

Открыть `client/src/ui/components/Header.tsx`. Добавить подписку на новое поле рядом с `boxProgress`:

```tsx
const rareBoxProgress = useGameStore((s) => s.rareBoxProgress)
```

Добавить новый компонент в конец файла:

```tsx
function RareBoxProgress({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100)
  const isReady = pct >= 100
  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`text-2xl leading-none ${isReady ? 'animate-pulse' : ''}`}>✨</div>
      <div className="ff-progress-track w-24 h-2.5">
        <div
          className="ff-progress-fill"
          style={{
            width: `${pct}%`,
            background: isReady
              ? 'linear-gradient(90deg, #fcd34d, #f59e0b)'
              : 'linear-gradient(90deg, #c4b5fd, #8b5cf6)',
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Показать обе полоски в Header**

Найти блок `<div className="justify-self-end">` и заменить:

```tsx
<div className="justify-self-end flex flex-col items-end gap-2">
  {showBoxProgress && <BoxProgress progress={boxProgress} waiting={boxWaiting} />}
  {showBoxProgress && <RareBoxProgress progress={rareBoxProgress} />}
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/shar/Documents/frog_evolution/frog_evolution_code/client && npx tsc --noEmit 2>&1
```

Ожидание: 0 ошибок.

- [ ] **Step 4: Commit**

```bash
git add client/src/ui/components/Header.tsx client/src/store/gameStore.ts
git commit -m "feat: add rare box progress bar to header"
```

---

## Self-Review

**Spec coverage:**
- ✅ Мега-боксы только на Болоте — `boxOpenCount` инкрементируется только при `currentLocation === 1`, `spawnBox(true)` тоже только там
- ✅ Триггер — количество открытий, не время — `rareBoxProgressMs` удалён, `update()` очищен
- ✅ Базово: 30 открытий — `counts[0] = 30`
- ✅ Макс уровень: 15 открытий — `counts[10] = 15`
- ✅ Карточка апгрейда показывает "каждые N боксов" — `RareBoxSpeedCard` обновлён
- ✅ Карточка видна только на Болоте — `{isBoloto && <RareBoxSpeedCard />}`
- ✅ Группа боксов (AOE открытие) — каждый бокс в группе вызывает `onBoxTapped` отдельно → правильно инкрементирует
- ✅ Сброс при смене локации — `boxOpenCount = 0` и `setRareBoxProgress(0)` в обоих местах сброса
- ✅ Прогресс-бар в Header — `RareBoxProgress` компонент, видим только на Болоте, заполняется 0→100% по мере открытий, пульсирует когда готов, золотой цвет на 100%
