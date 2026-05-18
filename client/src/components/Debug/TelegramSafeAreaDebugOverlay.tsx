// DEV-only визуальный overlay показывающий где Telegram WebApp UI кнопки
// (close + more menu) и системные safe-area зоны находятся в fullscreen
// режиме. Помогает позиционировать game HUD чтобы он не залезал под TG chrome.
//
// Tree-shaking: компонент целиком обёрнут в `if (!import.meta.env.DEV) return null`,
// Vite вырезает мёртвый код production bundle'а. Mounted в App.tsx тоже под
// `import.meta.env.DEV` gate чтобы import выпиливался полностью.
//
// Toggle:
//   - DevTools console: window.__toggleTgSafeAreaDebug() — toggle visibility
//   - DevTools console: window.__tgSafeAreaDebug — inspect current state
// Default: OFF (придётся включить вручную).
//
// Cliclability checklist (memory feedback_clickability):
//   - pure visual overlay, нет buttons
//   - pointer-events: none — game interaction НЕ блокируется
//   - z-index 9999 — выше всего (game ~50, CosmicHub ~100, FirstContact ~200)
//
// Memory feedback_frog_container_alpha — N/A: это DOM overlay, не Phaser.
// Memory feedback_animations — нет анимаций; pure static боксы.

import { useEffect, useState } from 'react'
import { getTelegramWebApp } from '../../utils/telegram'

// Fallback значения когда Telegram WebApp недоступен или contentSafeAreaInset
// не пришёл (старые клиенты). Approximate — реальные значения варьируются
// по платформе/девайсу.
const FALLBACK = {
  // Telegram fullscreen header buttons (top-right corner)
  closeButton: { top: 12, right: 8, width: 36, height: 36 },
  moreMenu: { top: 12, right: 52, width: 36, height: 36 },
  // iOS notch / Android status bar typical
  statusBar: { top: 0, left: 0, right: 0, height: 44 },
  // iOS home indicator
  homeIndicator: { bottom: 0, left: 0, right: 0, height: 34 },
} as const

// Глобальный mutable state — toggleable через window helper. Делим между
// instance'ами (если бы overlay был mounted в нескольких местах) через
// простой event'less polling: компонент сам checks `__tgSafeAreaDebug.visible`
// на каждом render и держит local React state в sync через subscribe pattern.
interface DebugState {
  visible: boolean
  subscribers: Set<() => void>
}

function getOrCreateState(): DebugState {
  const w = window as unknown as { __tgSafeAreaDebug?: DebugState }
  if (!w.__tgSafeAreaDebug) {
    w.__tgSafeAreaDebug = {
      visible: false,
      subscribers: new Set(),
    }
  }
  return w.__tgSafeAreaDebug
}

function notify(): void {
  const s = getOrCreateState()
  for (const fn of s.subscribers) fn()
}

export function installTelegramSafeAreaDebugHelper(): () => void {
  if (!import.meta.env.DEV) return () => {}
  const s = getOrCreateState()
  const w = window as unknown as Record<string, unknown>
  w.__toggleTgSafeAreaDebug = () => {
    s.visible = !s.visible
    notify()
    // eslint-disable-next-line no-console
    console.log(`[dev] TG safe-area overlay: ${s.visible ? 'ON' : 'OFF'}`)
    return s.visible
  }
  return () => {
    delete w.__toggleTgSafeAreaDebug
    // Не чистим __tgSafeAreaDebug сам — там сидят subscribers других mount'ов.
  }
}

function useDebugVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => {
    if (!import.meta.env.DEV) return false
    return getOrCreateState().visible
  })

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const s = getOrCreateState()
    const sync = () => setVisible(s.visible)
    s.subscribers.add(sync)
    // Re-sync на mount — state мог измениться до subscribe.
    sync()
    return () => {
      s.subscribers.delete(sync)
    }
  }, [])

  return visible
}

interface BoxProps {
  label: string
  style: React.CSSProperties
}

function DebugBox({ label, style }: BoxProps) {
  return (
    <div
      style={{
        position: 'fixed',
        background: 'rgba(239, 68, 68, 0.6)', // red-500 @ 60% opacity
        border: '2px dashed rgba(127, 29, 29, 0.95)', // red-900 dashed
        boxSizing: 'border-box',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 4,
          fontSize: 10,
          lineHeight: '12px',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontWeight: 700,
          color: '#fff',
          textShadow: '0 0 2px rgba(0,0,0,0.9)',
          letterSpacing: '0.02em',
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export function TelegramSafeAreaDebugOverlay() {
  // Hooks ДОЛЖНЫ быть до early-return (rules-of-hooks). `useDebugVisible`
  // сам возвращает false когда не в DEV, плюс mount-site в App.tsx обёрнут
  // `import.meta.env.DEV` → в production компонент даже не рендерится, и
  // Vite tree-shake'ит body через DCE.
  const visible = useDebugVisible()
  if (!import.meta.env.DEV) return null
  if (!visible) return null

  // Real safe-area inset из Telegram (если доступен). Используем для status bar
  // top height — это самое полезное value (close/more positions относительно
  // top-right стабильны).
  const tg = getTelegramWebApp()
  const contentTop = tg?.contentSafeAreaInset?.top
  const safeTop = tg?.safeAreaInset?.top

  // Status bar height: предпочитаем разницу safeAreaInset.top - contentSafeAreaInset.top
  // (system chrome height) ИЛИ просто safeAreaInset.top, ИЛИ fallback.
  const statusBarHeight =
    typeof safeTop === 'number' && safeTop > 0
      ? safeTop
      : FALLBACK.statusBar.height

  // Bottom safe area из safeAreaInset.bottom если есть.
  const safeBottom = tg?.safeAreaInset?.bottom
  const homeIndicatorHeight =
    typeof safeBottom === 'number' && safeBottom > 0
      ? safeBottom
      : FALLBACK.homeIndicator.height

  // Если contentSafeAreaInset.top отдан — close/more кнопки сидят между
  // safeAreaInset.top и contentSafeAreaInset.top (TG chrome зона).
  // Top offset для top-right buttons: середина TG chrome зоны минус половина
  // высоты кнопки, минимум FALLBACK.closeButton.top.
  let closeTop: number = FALLBACK.closeButton.top
  if (typeof contentTop === 'number' && typeof safeTop === 'number') {
    const chromeMid = safeTop + (contentTop - safeTop) / 2
    closeTop = Math.max(0, chromeMid - FALLBACK.closeButton.height / 2)
  }

  return (
    <div
      // Контейнер pointer-events:none — гарантия что вся группа не блокирует.
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <DebugBox
        label="STATUS BAR"
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: statusBarHeight,
        }}
      />
      <DebugBox
        label="TG MORE"
        style={{
          top: closeTop,
          right: FALLBACK.moreMenu.right,
          width: FALLBACK.moreMenu.width,
          height: FALLBACK.moreMenu.height,
        }}
      />
      <DebugBox
        label="TG CLOSE"
        style={{
          top: closeTop,
          right: FALLBACK.closeButton.right,
          width: FALLBACK.closeButton.width,
          height: FALLBACK.closeButton.height,
        }}
      />
      <DebugBox
        label="HOME INDICATOR"
        style={{
          bottom: 0,
          left: 0,
          right: 0,
          height: homeIndicatorHeight,
        }}
      />
    </div>
  )
}
