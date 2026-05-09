# Frog Evolution — Pre-Launch Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить все блокирующие баги и добавить минимально необходимый polish перед публикацией Telegram Mini App.

**Architecture:** Фикс серверной потери данных → UX-полировка (загрузка, туториал, пустые кнопки) → деплой.

**Tech Stack:** Fastify + Prisma + PostgreSQL, React 19 + Zustand + Phaser 3, Telegram Mini App SDK, react-i18next.

---

## Обзор проблем

### Критические (блокируют публикацию)

| # | Проблема | Файл |
|---|----------|------|
| 1 | **Data loss**: сервер не сохраняет `rareBoxSpeed` — при каждой загрузке апгрейд сбрасывается в 0 | `server/src/routes/gameState.ts` |
| 2 | **Нет загрузочного экрана** — игра начинается до завершения auth + loadGameState, пользователь видит мерцание | `client/src/App.tsx` |
| 3 | **Мёртвые кнопки** в BottomBar (🎨 🎁 🛍️) показывают badge "!" но ничего не делают — выглядит сломанным | `client/src/ui/components/BottomBar.tsx` |

### Важные (желательно до публикации)

| # | Проблема | Файл |
|---|----------|------|
| 4 | **Нет туториала** — новый игрок не знает что делать (нет подсказок при первом запуске) | новый компонент |
| 5 | **Нет карты для 4-й локации (Космос)** — `map4.webp` отсутствует, используется fallback | `client/public/map4.webp` |

### Деплой (отдельный чеклист)

| # | Задача |
|---|--------|
| 6 | Задеплоить backend на Render, DB на Neon, client на Vercel, настроить webhook |

---

## Task 1: Фикс сервера — rareBoxSpeed не сохраняется

**Files:**
- Modify: `server/src/routes/gameState.ts` — `UpgradesPayload` + `sanitizeUpgrades`

**Проблема:** `UpgradesPayload` и `sanitizeUpgrades` не включают `rareBoxSpeed`. При PUT `/game/state` поле отбрасывается, при GET возвращается `0`. Каждый перезапуск сбрасывает апгрейд.

- [ ] **Step 1: Обновить интерфейс и sanitize в `gameState.ts`**

```typescript
// server/src/routes/gameState.ts

interface UpgradesPayload {
  dropSpeed: number
  tractor: number
  magnet: number
  crateQuality: number
  rareBoxSpeed: number  // ← добавить
}

// в sanitizeUpgrades добавить строку:
function sanitizeUpgrades(obj: unknown): UpgradesPayload {
  const o = (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  }
  return {
    dropSpeed: num(o.dropSpeed),
    tractor: num(o.tractor),
    magnet: num(o.magnet),
    crateQuality: num(o.crateQuality),
    rareBoxSpeed: num(o.rareBoxSpeed),  // ← добавить
  }
}
```

- [ ] **Step 2: Проверить TypeScript**

```bash
cd server && npx tsc --noEmit
```
Ожидание: 0 ошибок.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/gameState.ts
git commit -m "fix: server now persists rareBoxSpeed upgrade"
```

---

## Task 2: Загрузочный экран

**Files:**
- Modify: `client/src/App.tsx` — добавить state `isLoading`
- Modify: `client/src/ui/components/LoadingScreen.tsx` — новый компонент

**Проблема:** Сейчас `App` рендерит UI сразу, не дожидаясь `authenticate()` + `loadGameState()`. Пользователь видит мерцание состояния.

- [ ] **Step 1: Создать `LoadingScreen.tsx`**

```tsx
// client/src/ui/components/LoadingScreen.tsx
export function LoadingScreen() {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #1a2e0a 0%, #2d4a15 100%)',
      }}
    >
      <div style={{ fontSize: 72, lineHeight: 1 }}>🐸</div>
      <div
        className="ff-display ff-stroke-white"
        style={{ color: '#86efac', fontSize: 28, marginTop: 16, letterSpacing: 2 }}
      >
        FROG EVOLUTION
      </div>
      <div
        style={{
          marginTop: 32, width: 120, height: 6,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 3, overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, #4ade80, #22c55e)',
            animation: 'ff-loading-bar 1.4s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes ff-loading-bar {
          0%   { width: 0%; margin-left: 0% }
          50%  { width: 60%; margin-left: 20% }
          100% { width: 0%; margin-left: 100% }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Добавить `isLoading` state в `App.tsx`**

Найти в `App.tsx` строку `const [shopOpen, setShopOpen] = useState(false)` и добавить выше:

```tsx
const [isLoading, setIsLoading] = useState(true)
```

В `useEffect` заменить блок `authenticate().then(...)`:

```tsx
authenticate().then(async (result) => {
  if (result.mode !== 'failed') {
    const loaded = await loadGameState()
    if (loaded) startSync()
  }
  setIsLoading(false)
})
```

В JSX в начале `return` добавить:

```tsx
if (isLoading) return <LoadingScreen />
```

- [ ] **Step 3: Добавить import LoadingScreen в `App.tsx`**

```tsx
import { LoadingScreen } from './ui/components/LoadingScreen'
```

- [ ] **Step 4: TypeScript check**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx client/src/ui/components/LoadingScreen.tsx
git commit -m "feat: add loading screen while auth+state loads"
```

---

## Task 3: Убрать мёртвые кнопки из BottomBar

**Files:**
- Modify: `client/src/ui/components/BottomBar.tsx`

**Проблема:** Кнопки 🎨 (косметика), 🎁 (подарки), 🛍️ (магазин монет) показывают badge "!" и не реагируют на нажатия. Это сигнализирует о сломанном UI. Решение: скрыть или заменить на `disabled` без badge.

- [ ] **Step 1: Убрать нефункциональные кнопки из BottomBar**

Заменить центральную секцию:

```tsx
{/* Центр — действия */}
<div className="flex gap-2 items-center">
  <Tile emoji="⬆️" skin="green" onClick={onOpenShop} />
</div>
```

Три нерабочие кнопки (🎨, 🎁, 🛍️) убрать полностью до реализации их функциональности.

- [ ] **Step 2: TypeScript check**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/ui/components/BottomBar.tsx
git commit -m "fix: remove placeholder BottomBar buttons with broken badges"
```

---

## Task 4: Минимальный туториал (первый запуск)

**Files:**
- Create: `client/src/ui/components/TutorialOverlay.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/store/gameStore.ts` — добавить флаг `tutorialDone`
- Modify: `client/src/i18n/ru.json`, `en.json`, `es.json`

**Цель:** Новый игрок (первый запуск, `tutorialDone === false`) видит 3 подсказки по шагам:
1. "Нажми на коробку, чтобы получить лягушку!" → стрелка на поле
2. "Слей двух одинаковых лягушек вместе!" → стрелка на поле  
3. "Лягушки зарабатывают монеты сами!" → стрелка на хедер

- [ ] **Step 1: Добавить `tutorialDone` в gameStore**

В интерфейс стора добавить:
```typescript
// в interface GameState
tutorialDone: boolean

// в дефолтный стейт:
tutorialDone: false,

// в persist/loadFromLocalStorage — дефолт:
tutorialDone: parsed.tutorialDone ?? false,

// экшн:
completeTutorial: () => set({ tutorialDone: true }),
```

- [ ] **Step 2: Добавить i18n ключи**

В `ru.json`:
```json
"tutorial": {
  "step1": "Нажми на коробку, чтобы получить лягушку!",
  "step2": "Перетащи одинаковых лягушек друг на друга!",
  "step3": "Лягушки зарабатывают 💩 сами — апгрейди быстрее!",
  "skip": "Пропустить",
  "next": "Далее",
  "done": "Играть!"
}
```

В `en.json`:
```json
"tutorial": {
  "step1": "Tap the box to get a frog!",
  "step2": "Drag two identical frogs together to merge!",
  "step3": "Frogs earn 💩 automatically — upgrade to earn faster!",
  "skip": "Skip",
  "next": "Next",
  "done": "Play!"
}
```

В `es.json`:
```json
"tutorial": {
  "step1": "¡Toca la caja para obtener una rana!",
  "step2": "¡Arrastra dos ranas iguales para fusionarlas!",
  "step3": "¡Las ranas ganan 💩 solas — mejora para ganar más rápido!",
  "skip": "Omitir",
  "next": "Siguiente",
  "done": "¡Jugar!"
}
```

- [ ] **Step 3: Создать `TutorialOverlay.tsx`**

```tsx
// client/src/ui/components/TutorialOverlay.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'

const STEPS = ['step1', 'step2', 'step3'] as const

export function TutorialOverlay() {
  const { t } = useTranslation()
  const completeTutorial = useGameStore((s) => s.completeTutorial)
  const [step, setStep] = useState(0)

  const isLast = step === STEPS.length - 1

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: '18%', pointerEvents: 'auto',
      }}
      onClick={() => isLast ? completeTutorial() : setStep(s => s + 1)}
    >
      <div
        className="ff-panel ff-pop"
        style={{ width: '90%', maxWidth: 340, padding: '20px 24px', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }}>
          {step === 0 ? '📦' : step === 1 ? '🔀' : '💰'}
        </div>
        <p className="ff-body" style={{ fontSize: 16, color: '#1a2e0a', fontWeight: 700, marginBottom: 16 }}>
          {t(`tutorial.${STEPS[step]}`)}
        </p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === step ? '#16a34a' : '#d1d5db',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ff-btn ff-btn-grey text-sm flex-1" onClick={completeTutorial}>
            {t('tutorial.skip')}
          </button>
          <button
            className="ff-btn ff-btn-green text-sm flex-1"
            onClick={() => isLast ? completeTutorial() : setStep(s => s + 1)}
          >
            {isLast ? t('tutorial.done') : t('tutorial.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Подключить в `App.tsx`**

```tsx
// добавить import:
import { TutorialOverlay } from './ui/components/TutorialOverlay'

// добавить в subscribes из useGameStore:
const tutorialDone = useGameStore((s) => s.tutorialDone)

// добавить в JSX после LoadingScreen:
{!tutorialDone && <TutorialOverlay />}
```

- [ ] **Step 5: TypeScript check**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add client/src/ui/components/TutorialOverlay.tsx client/src/App.tsx \
        client/src/store/gameStore.ts \
        client/src/i18n/ru.json client/src/i18n/en.json client/src/i18n/es.json
git commit -m "feat: add 3-step tutorial overlay for first-time users"
```

---

## Task 5: Карта для 4-й локации (Космос)

**Files:**
- Add: `client/public/map4.webp`
- Verify: `client/src/game/scenes/MainScene.ts` — `mapKeyForLocation(4)` должен вернуть `map4`

**Проблема:** `map4.webp` отсутствует. Когда игрок попадает на локацию 4 (Космос), фон либо сломан, либо fallback.

- [ ] **Step 1: Проверить как подставляется карта**

```bash
grep -n "mapKeyForLocation\|map4\|map3" client/src/game/scenes/MainScene.ts | head -10
```

- [ ] **Step 2: Создать map4.webp**

Нужно создать/раздобыть изображение тёмного космоса (звёзды, планеты) размером ~800×1200px и сохранить как `client/public/map4.webp`. Можно использовать:
- Midjourney/DALL-E: "dark space background, stars, nebula, planets, game background, 800x1200"
- Или временно скопировать `map3.webp` как заглушку: `cp client/public/map3.webp client/public/map4.webp`

- [ ] **Step 3: Commit**

```bash
git add client/public/map4.webp
git commit -m "feat: add map4 background for Space location"
```

---

## Task 6: Деплой

**Следовать существующему чеклисту:** `frog_obsidian/Frog Evolution/Повестка/Деплой — план.md`

- [ ] **Step 1: Создать Telegram бота через @BotFather**
  - `/newbot` → получить токен
  - Сохранить как `TELEGRAM_BOT_TOKEN`

- [ ] **Step 2: Создать БД на Neon.tech**
  - Новый проект → скопировать Connection String с `?sslmode=require`

- [ ] **Step 3: Сгенерировать JWT_SECRET**
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] **Step 4: Запушить код на GitHub**
  ```bash
  git remote add origin https://github.com/<user>/frog-evolution.git
  git push -u origin main
  ```

- [ ] **Step 5: Задеплоить backend на Render.com**
  - New Web Service → Docker → подключить репо
  - Env vars: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV=production`
  - Скопировать URL бекенда после деплоя

- [ ] **Step 6: Задеплоить client на Vercel**
  - Подключить репо → папка `client`
  - Env var: `VITE_API_URL=https://<render-url>.onrender.com`
  - Скопировать URL клиента после деплоя

- [ ] **Step 7: Настроить webhook Telegram**
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<render-url>.onrender.com/telegram/webhook"
  ```
  Ожидание: `{"ok":true}`

- [ ] **Step 8: Настроить Mini App в BotFather**
  - `/newapp` → вставить URL Vercel клиента
  - Или `/setmenubutton` для кнопки в боте

- [ ] **Step 9: Добавить keep-alive на cron-job.org**
  - `GET https://<render-url>.onrender.com/health` каждые 14 минут

- [ ] **Step 10: Проверка**
  ```bash
  curl https://<render-url>.onrender.com/health
  curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
  ```

---

## Итоговый приоритет

| Задача | Приоритет | Время |
|--------|-----------|-------|
| Task 1: rareBoxSpeed на сервере | 🔴 Критично | 10 мин |
| Task 2: Загрузочный экран | 🟠 Важно | 20 мин |
| Task 3: Убрать мёртвые кнопки | 🟠 Важно | 5 мин |
| Task 4: Туториал | 🟡 Желательно | 40 мин |
| Task 5: map4.webp | 🟡 Желательно | 15 мин |
| Task 6: Деплой | 🔴 Необходимо | 60 мин |
