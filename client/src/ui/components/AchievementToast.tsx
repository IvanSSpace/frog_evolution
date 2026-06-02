// AchievementToast — красивое уведомление об ачивке (окно сверху, slide-down).
//
// Слушает eventBus 'achievement:unlocked' {id} → резолвит def из config →
// показывает тост (иконка, «Достижение!», заголовок, описание, +N⭐) с блеском
// и авто-скрытием. Стек нескольких. Тап — закрыть сразу.
//
// Авто-триггер: вотчер раз в ~1.5с сверяет pendingIds() (достигнутые, не забранные)
// с persisted-набором «уже показанных». Новые → эмит 'achievement:unlocked'.
// При самом первом запуске (ключа нет) текущие pending помечаются показанными
// БЕЗ тоста — чтобы не было флуда у существующих игроков.
//
// Mounted один раз в App.tsx. i18n: строки RU-хардкод (как config ачивок) — follow-up.

import { useEffect, useState } from 'react'
import { eventBus } from '../../store/eventBus'
import { achievementById } from '../../game/achievements/config'
import { useAchievementsStore } from '../../store/achievementsStore'

const AUTO_HIDE_MS = 4500
const WATCH_INTERVAL_MS = 1500
const NOTIFIED_KEY = 'achievements.notified'

interface ToastEntry {
  key: number
  icon: string
  title: string
  desc: string
  reward: number
}

function loadNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveNotified(s: Set<string>): void {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

export function AchievementToast() {
  const [entries, setEntries] = useState<ToastEntry[]>([])

  // Показ тоста по событию.
  useEffect(() => {
    const handler = ({ id }: { id: string }) => {
      const def = achievementById(id)
      if (!def) return
      const key = Date.now() + Math.random()
      setEntries((prev) => [
        ...prev,
        {
          key,
          icon: def.icon,
          title: def.title,
          desc: def.desc,
          reward: def.reward,
        },
      ])
      window.setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.key !== key))
      }, AUTO_HIDE_MS)
    }
    eventBus.on('achievement:unlocked', handler)
    return () => eventBus.off('achievement:unlocked', handler)
  }, [])

  // Авто-вотчер: новые claimable → эмит. Первый запуск — seed без тоста.
  useEffect(() => {
    const seeded = localStorage.getItem(NOTIFIED_KEY) != null
    const notified = loadNotified()
    if (!seeded) {
      // Помечаем текущие pending как уже показанные (анти-флуд для старых сейвов).
      for (const id of useAchievementsStore.getState().pendingIds())
        notified.add(id)
      saveNotified(notified)
    }
    const tick = () => {
      const pending = useAchievementsStore.getState().pendingIds()
      let changed = false
      for (const id of pending) {
        if (!notified.has(id)) {
          notified.add(id)
          changed = true
          eventBus.emit('achievement:unlocked', { id })
        }
      }
      if (changed) saveNotified(notified)
    }
    const t = window.setInterval(tick, WATCH_INTERVAL_MS)
    return () => window.clearInterval(t)
  }, [])

  if (entries.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes ach-drop { 0%{transform:translateY(-120%) scale(.9);opacity:0}
          60%{transform:translateY(8%) scale(1.02);opacity:1}
          100%{transform:translateY(0) scale(1);opacity:1} }
        @keyframes ach-shine { 0%{transform:translateX(-120%)} 100%{transform:translateX(220%)} }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--ui-top-offset, 0px) + var(--tg-chrome-pad, 0px) + 10px)',
          left: 0,
          right: 0,
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {entries.map((e) => (
          <div
            key={e.key}
            onClick={() =>
              setEntries((prev) => prev.filter((x) => x.key !== e.key))
            }
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              width: 'min(92vw, 360px)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 16,
              border: '2px solid #f6c945',
              background:
                'linear-gradient(135deg, #2a2410 0%, #3a2f12 55%, #221d0c 100%)',
              boxShadow:
                '0 6px 24px rgba(0,0,0,0.45), 0 0 18px rgba(246,201,69,0.35)',
              overflow: 'hidden',
              position: 'relative',
              animation: 'ach-drop 480ms cubic-bezier(.2,.8,.25,1)',
            }}
          >
            {/* Блик-проход */}
            <span
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '40%',
                background:
                  'linear-gradient(100deg, transparent, rgba(255,255,255,0.28), transparent)',
                transform: 'translateX(-120%)',
                animation: 'ach-shine 1100ms ease-out 280ms',
                pointerEvents: 'none',
              }}
            />
            {/* Иконка */}
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                background:
                  'radial-gradient(circle at 35% 30%, #fff3c4, #f6c945 70%)',
                boxShadow: '0 0 10px rgba(246,201,69,0.6)',
              }}
            >
              {e.icon}
            </div>
            {/* Текст */}
            <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  color: '#f6c945',
                  textTransform: 'uppercase',
                }}
              >
                🏆 Достижение
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {e.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {e.desc}
              </div>
            </div>
            {/* Награда */}
            <div
              style={{
                flexShrink: 0,
                fontSize: 14,
                fontWeight: 800,
                color: '#f6c945',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              +{e.reward}⭐
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
