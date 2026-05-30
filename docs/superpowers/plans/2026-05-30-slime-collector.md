# Slime Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework offline goo income into a server-held, manually-collected collector building (fill states + on-field "Собрать").

**Architecture:** Server stops auto-granting offline income; it accumulates the capped offline gap into `collectorPendingMs` on `GET /game/state` and exposes a `POST /game/collector/collect` endpoint that converts the buffer to gold. Client stores `collectorPendingMs`/`collectorCapMs`, the collector building swaps texture by fill, and a Phaser "Собрать" label collects. WelcomeBackModal is removed.

**Tech Stack:** Fastify + Prisma (Postgres) server; React + Zustand + Phaser 3 client.

**Spec:** `docs/superpowers/specs/2026-05-30-slime-collector-design.md`

**Concurrency note:** Other agents edit this repo concurrently. Before each task, re-read the target file; after editing shared files (`gameStore.ts`, `gameSync.ts`, `BuildingsController.ts`, `App.tsx`) run `git status` and rebase before pushing.

---

## File map

- `server/prisma/schema.prisma` — add `collectorPendingMs` to GameState.
- `server/src/routes/gameState.ts` — accumulate pending on GET (no auto-gold); add collect route.
- `server/src/config/economy.ts` — already has `getGooCollectorCapMs`; reuse.
- `client/src/api/collector.ts` — NEW: `collectCollector()` POST.
- `client/src/store/gameStore.ts` — `collectorPendingMs`, `collectorCapMs` + setter.
- `client/src/api/gameSync.ts` — read new fields; drop `server:welcome-back` emit (already removed earlier — verify).
- `client/src/game/scenes/main/BuildingsController.ts` — real fill-state texture + collect via endpoint (replace preview).
- `client/src/App.tsx` — remove `WelcomeBackModal` usage.
- `client/src/ui/components/WelcomeBackModal.tsx` — delete file.
- `client/src/i18n/ru.json` — update `shop.gooCollector.*` copy.

---

## Task 1: Server — DB field

**Files:**
- Modify: `server/prisma/schema.prisma` (model GameState, after `lastSessionAt`)

- [ ] **Step 1: Add the column**

In `model GameState`, add:
```prisma
  collectorPendingMs Int      @default(0) @map("collector_pending_ms")
```

- [ ] **Step 2: Create migration**

Run: `cd server && npm run prisma:add-migration slime_collector_pending`
Expected: new migration dir under `server/prisma/migrations/`, `prisma generate` runs.

- [ ] **Step 3: Commit**
```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(collector): add collectorPendingMs to GameState"
```

---

## Task 2: Server — accumulate pending on GET (stop auto-gold)

**Files:**
- Modify: `server/src/routes/gameState.ts` (the `GET /game/state` offline block, ~lines 31-56)

- [ ] **Step 1: Replace the offline-income block**

Find the block computing `offlineIncome` and updating `gold`. Replace from `const elapsedMs = ...` through the `return { ... }` with:
```ts
      const elapsedMs = Date.now() - state.lastSessionAt.getTime()
      const capMs = getGooCollectorCapMs(gooCollectorLevel)
      // Накопление в буфере коллектора (не в золото). Капаем оффлайн-разрыв,
      // ограничиваем общим capMs. Золото НЕ трогаем — игрок собирает вручную.
      const prevPending = state.collectorPendingMs ?? 0
      const pendingMs = Math.min(prevPending + Math.max(0, elapsedMs), capMs)

      state = await prisma.gameState.update({
        where: { userId: request.user.id },
        data: { collectorPendingMs: pendingMs, lastSessionAt: new Date() },
      })

      return {
        ...state,
        gold: state.gold.toString(),
        collectorPendingMs: pendingMs,
        collectorCapMs: capMs,
        elapsedMs, // raw — для совместимости (box drops calc уже удалён, но поле безвредно)
      }
```
Also update the early `if (!state)` return (new GameState) to include the new fields:
```ts
        return {
          ...state,
          gold: state.gold.toString(),
          collectorPendingMs: 0,
          collectorCapMs: 0,
          elapsedMs: 0,
        }
```
Remove the now-unused `offlineIncome`/`offlineMs`/`earnedSec` lines.

- [ ] **Step 2: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: 0 errors (if `getGooCollectorCapMs` import already present — it is).

- [ ] **Step 3: Commit**
```bash
git add server/src/routes/gameState.ts
git commit -m "feat(collector): accumulate offline income into collector buffer (no auto-gold)"
```

---

## Task 3: Server — collect endpoint

**Files:**
- Modify: `server/src/routes/gameState.ts` (add a new route in the same plugin function)

- [ ] **Step 1: Add the route**

After the `GET /game/state` handler (and before the `PUT /game/state` handler), add:
```ts
  app.post(
    '/game/collector/collect',
    { preHandler: [app.authenticate] },
    async (request) => {
      const state = await prisma.gameState.findUnique({
        where: { userId: request.user.id },
      })
      if (!state) return { collected: '0', gold: '0' }

      const pendingMs = state.collectorPendingMs ?? 0
      const collected = BigInt(
        Math.floor((pendingMs / 1000) * state.incomePerSec),
      )
      const updated = await prisma.gameState.update({
        where: { userId: request.user.id },
        data: { gold: state.gold + collected, collectorPendingMs: 0 },
      })
      return {
        collected: collected.toString(),
        gold: updated.gold.toString(),
      }
    },
  )
```

- [ ] **Step 2: Typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**
```bash
git add server/src/routes/gameState.ts
git commit -m "feat(collector): POST /game/collector/collect endpoint"
```

---

## Task 4: Client — store fields

**Files:**
- Modify: `client/src/store/gameStore.ts`

- [ ] **Step 1: Add state + setter to the store interface**

Near `incomePerSec` / `setIncomePerSec`, add to the interface:
```ts
  collectorPendingMs: number
  collectorCapMs: number
  setCollector: (pendingMs: number, capMs: number) => void
```

- [ ] **Step 2: Add defaults + setter to the store body**

In the `create(...)` initial object, near `incomePerSec: 0`, add:
```ts
  collectorPendingMs: 0,
  collectorCapMs: 0,
  setCollector: (pendingMs, capMs) =>
    set({ collectorPendingMs: pendingMs, collectorCapMs: capMs }),
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd client && npx tsc --noEmit` → 0 errors.
```bash
git add client/src/store/gameStore.ts
git commit -m "feat(collector): store collectorPendingMs/collectorCapMs"
```

---

## Task 5: Client — read fields on sync; ensure no welcome-back goo

**Files:**
- Modify: `client/src/api/gameSync.ts` (the GET load block ~line 161)

- [ ] **Step 1: Apply fields to store**

In the load block where `useGameStore.setState({ gold: goldNum, ... })` runs, read the new fields from the response (`data`) and set them:
```ts
      useGameStore.getState().setCollector(
        typeof data.collectorPendingMs === 'number' ? data.collectorPendingMs : 0,
        typeof data.collectorCapMs === 'number' ? data.collectorCapMs : 0,
      )
```

- [ ] **Step 2: Verify the welcome-back/offline emit is gone**

Run: `grep -n "server:welcome-back\|offlineIncome" client/src/api/gameSync.ts`
Expected: no `eventBus.emit('server:welcome-back'...)` and no offline-income apply. If present, remove it.

- [ ] **Step 3: Typecheck + commit**

Run: `cd client && npx tsc --noEmit` → 0 errors.
```bash
git add client/src/api/gameSync.ts
git commit -m "feat(collector): load collector buffer on sync"
```

---

## Task 6: Client — collect API

**Files:**
- Create: `client/src/api/collector.ts`

- [ ] **Step 1: Write the API**
```ts
import { apiJson } from './client'

export async function collectCollector(): Promise<{
  collected: string
  gold: string
}> {
  return apiJson('/game/collector/collect', { method: 'POST' })
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd client && npx tsc --noEmit` → 0 errors.
```bash
git add client/src/api/collector.ts
git commit -m "feat(collector): collectCollector API"
```

---

## Task 7: Client — collector building fill states + real collect

**Files:**
- Modify: `client/src/game/scenes/main/BuildingsController.ts`

This replaces the preview logic. `bld_collector` picks its texture from fill on `show()`, the "Собрать" label appears only when `collectorPendingMs > 0`, and tapping it calls the endpoint, adds gold, zeroes the buffer, and swaps to `collector_empty`.

- [ ] **Step 1: Texture-by-fill helper**

Add a module helper:
```ts
function collectorTextureKey(fill: number): string {
  if (fill > 0.8) return 'bld_collector_full'
  if (fill < 0.2) return 'bld_collector_empty'
  return 'bld_collector'
}
```
(`bld_collector` is the normal texture; empty/full already preloaded.)

- [ ] **Step 2: In `show()`, set the collector texture by fill**

Where the collector sprite (`b.key === 'bld_collector'`) is created, after computing fill from the store, set its texture:
```ts
      if (b.key === 'bld_collector') {
        const st = useGameStore.getState()
        const fill = st.collectorCapMs > 0 ? st.collectorPendingMs / st.collectorCapMs : 0
        const key = collectorTextureKey(fill)
        if (key !== b.key) {
          const dw = sp.displayWidth
          sp.setTexture(key)
          sp.setDisplaySize(dw, dw * (sp.height / sp.width))
        }
        if (st.collectorPendingMs > 0) this.buildCollectLabel(sp)
      }
```
(Import `useGameStore` at top if not present.)

- [ ] **Step 3: Replace the preview collect handler with the real one**

In the "Собрать" hit handler (the `hit.on('pointerdown', ...)`), replace the preview body with:
```ts
    hit.on('pointerdown', async () => {
      if (this.collecting) return
      this.collecting = true
      hit.destroy(); this.collectHit = null
      scene.tweens.add({ targets: cont, alpha: 0, scaleX: 0.9, scaleY: 0.9, duration: 220, ease: 'Quad.easeIn',
        onComplete: () => { cont.destroy(); if (this.collectLabel === cont) this.collectLabel = null } })
      sp.disableInteractive()
      this.swapBuilding(sp, 'bld_collector_empty')
      try {
        const res = await collectCollector()
        useGameStore.getState().setCollector(0, useGameStore.getState().collectorCapMs)
        useGameStore.setState({ gold: Number(res.gold) })
      } catch (e) {
        console.error('[collector] collect failed', e)
      } finally {
        this.collecting = false
      }
    })
```
Add imports at top: `import { collectCollector } from '../../../api/collector'` and ensure `useGameStore` imported.

- [ ] **Step 4: Typecheck**

Run: `cd client && npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**
```bash
git add client/src/game/scenes/main/BuildingsController.ts
git commit -m "feat(collector): fill-state textures + real collect on Собрать"
```

---

## Task 8: Client — remove WelcomeBackModal

**Files:**
- Modify: `client/src/App.tsx`
- Delete: `client/src/ui/components/WelcomeBackModal.tsx`

- [ ] **Step 1: Remove usage in App.tsx**

Remove: the `import { WelcomeBackModal }` line; the `welcomeBack` state (`useState`); the `onWelcomeBack` handler + `eventBus.on/off('server:welcome-back', ...)`; the `{welcomeBack && <WelcomeBackModal .../>}` render.

- [ ] **Step 2: Delete the component file**
```bash
git rm client/src/ui/components/WelcomeBackModal.tsx
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd client && npx tsc --noEmit` → 0 errors.
```bash
git add client/src/App.tsx
git commit -m "feat(collector): remove WelcomeBackModal (replaced by on-field collector)"
```

---

## Task 9: Client — shop copy

**Files:**
- Modify: `client/src/i18n/ru.json` (`shop.gooCollector` block ~line 78)

- [ ] **Step 1: Update copy**

Update `shop.gooCollector.offline` (and `.name` if desired) to describe collector capacity, e.g. `"offline": "ёмкость коллектора: {{hours}} ч"`. Keep placeholders intact and JSON valid.

- [ ] **Step 2: Commit**
```bash
git add client/src/i18n/ru.json
git commit -m "tweak(i18n): gooCollector copy = collector capacity"
```

---

## Verification (manual UAT)

- [ ] Start server (`cd server && npm run dev`) + client; apply migration.
- [ ] With `gooCollector` level ≥ 1, set `lastSessionAt` in the past (or wait) → reopen → collector sprite shows non-empty, "Собрать" visible.
- [ ] Tap "Собрать" → gold increases by buffer amount, sprite → empty, label fades, buffer resets.
- [ ] Reopen app → buffer accumulates again from offline gap, capped at capHours.
- [ ] Level 0 collector: never fills, no "Собрать".
- [ ] Open/close Склад several times → field stays clickable (input-leak fix holds).
