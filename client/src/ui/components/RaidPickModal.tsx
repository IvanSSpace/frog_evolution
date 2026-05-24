// RaidPickModal — выбор жертвы для рейда.
//
// Свайп-карусель из N ботов. Каждая карточка показывает:
//   - аватар + имя бота
//   - 3 чана со слизью (slime per location)
//   - превью отряда (deck на loc1)
//   - кнопка АТАКОВАТЬ → emit 'battle:start' с bot.id
//
// MVP: bots пересоздаются при каждом open модалки. Server-PvP заменит.

import { useEffect, useMemo, useRef, useState } from 'react'
import { fmt } from '../../utils/formatting'
import { hapticNotification, hapticSelection } from '../../utils/telegram'
import { useModalLock } from '../../utils/modalLock'
import { eventBus } from '../../store/eventBus'
import { TintedFrog } from './TintedFrog'
import { FROG_LEVELS, getFrogPath } from '../../game/config/frogs'
import { CLASS_META, getWarriorConfig } from '../../game/config/warriors'
import { generateBotPool, type BotData } from '../../game/config/bots'

type Props = { onClose: () => void }

export function RaidPickModal({ onClose }: Props) {
  useModalLock()
  // Пул ботов фиксируется на момент открытия модалки.
  const bots = useMemo(() => generateBotPool(5), [])
  const [idx, setIdx] = useState(0)
  const [dragDx, setDragDx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const lockedAxis = useRef<'x' | 'y' | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const prev = () => setIdx((i) => Math.max(0, i - 1))
  const next = () => setIdx((i) => Math.min(bots.length - 1, i + 1))

  const beginDrag = (x: number, y: number) => {
    startX.current = x
    startY.current = y
    lockedAxis.current = null
    setDragDx(0)
    setIsDragging(true)
  }
  const updateDrag = (x: number, y: number): boolean => {
    if (startX.current === null || startY.current === null) return false
    const dx = x - startX.current
    const dy = y - startY.current
    if (lockedAxis.current === null) {
      const total = Math.abs(dx) + Math.abs(dy)
      if (total < 6) return false
      lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (lockedAxis.current === 'y') return false
    setDragDx(dx)
    return true
  }
  const endDrag = () => {
    const dx = dragDx
    setIsDragging(false)
    setDragDx(0)
    startX.current = null
    startY.current = null
    const wasHorizontal = lockedAxis.current === 'x'
    lockedAxis.current = null
    if (!wasHorizontal) return
    const w = viewportRef.current?.clientWidth ?? 0
    const threshold = Math.max(40, w * 0.18)
    if (dx > threshold) prev()
    else if (dx < -threshold) next()
  }

  useEffect(() => {
    // На случай ESC закрытия — cleanup pointer state
    return () => {
      startX.current = null
      startY.current = null
    }
  }, [])

  const handleAttack = () => {
    const bot = bots[idx]
    if (!bot) return
    hapticNotification('success')
    eventBus.emit('battle:start', { locationId: 1, botId: bot.id })
    onClose()
  }

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: '0 16px 4px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop"
        style={{
          width: '100%',
          maxWidth: 420,
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-2xl"
            style={{ color: '#dc2626', letterSpacing: 1.5 }}
          >
            ВЫБОР ЖЕРТВЫ
          </h2>
          <button
            onClick={onClose}
            aria-label="close"
            className="ff-tile w-9 h-9 text-lg"
            style={{
              ['--ff-tile-from' as never]: '#fca5a5',
              ['--ff-tile-to' as never]: '#dc2626',
              ['--ff-tile-border' as never]: '#7f1d1d',
              color: '#fff',
            }}
          >
            ✕
          </button>
        </div>

        {/* Carousel */}
        <div
          ref={viewportRef}
          className="relative flex-1 min-h-0"
          onTouchStart={(e) => {
            const t = e.touches[0]
            if (t) beginDrag(t.clientX, t.clientY)
          }}
          onTouchMove={(e) => {
            const t = e.touches[0]
            if (t) updateDrag(t.clientX, t.clientY)
          }}
          onTouchEnd={endDrag}
          onTouchCancel={endDrag}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') return
            ;(e.target as Element).setPointerCapture?.(e.pointerId)
            beginDrag(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse') return
            if (!isDragging) return
            updateDrag(e.clientX, e.clientY)
          }}
          onPointerUp={(e) => {
            if (e.pointerType === 'mouse') return
            endDrag()
          }}
          onPointerCancel={(e) => {
            if (e.pointerType === 'mouse') return
            endDrag()
          }}
          style={{ overflow: 'hidden', touchAction: 'pan-y' }}
        >
          <div
            style={{
              display: 'flex',
              height: '100%',
              transform: `translate3d(calc(-${idx * 100}% + ${dragDx}px), 0, 0)`,
              transition: isDragging
                ? 'none'
                : 'transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)',
              willChange: 'transform',
            }}
          >
            {bots.map((bot) => (
              <div
                key={bot.id}
                style={{
                  flex: '0 0 100%',
                  minWidth: 0,
                  padding: '12px 16px',
                  boxSizing: 'border-box',
                  overflowY: 'auto',
                }}
                className="ff-no-scrollbar"
              >
                <BotCard bot={bot} />
              </div>
            ))}
          </div>

          {/* Arrows */}
          <button
            onClick={prev}
            disabled={idx === 0}
            aria-label="prev"
            className="ff-tile"
            style={{
              position: 'absolute',
              left: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 36,
              height: 36,
              ['--ff-tile-from' as never]: '#a7f3d0',
              ['--ff-tile-to' as never]: '#34d399',
              ['--ff-tile-border' as never]: '#065f46',
              color: '#fff',
              fontSize: 20,
              opacity: idx === 0 ? 0.4 : 1,
              pointerEvents: idx === 0 ? 'none' : 'auto',
              zIndex: 2,
            }}
          >
            ‹
          </button>
          <button
            onClick={next}
            disabled={idx === bots.length - 1}
            aria-label="next"
            className="ff-tile"
            style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 36,
              height: 36,
              ['--ff-tile-from' as never]: '#a7f3d0',
              ['--ff-tile-to' as never]: '#34d399',
              ['--ff-tile-border' as never]: '#065f46',
              color: '#fff',
              fontSize: 20,
              opacity: idx === bots.length - 1 ? 0.4 : 1,
              pointerEvents: idx === bots.length - 1 ? 'none' : 'auto',
              zIndex: 2,
            }}
          >
            ›
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {bots.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === idx ? 12 : 8,
                height: 8,
                borderRadius: 4,
                background: i === idx ? '#16a34a' : 'rgba(54,83,20,0.25)',
                transition: 'width 200ms ease',
              }}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex justify-center"
          style={{ borderTop: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <button
            onClick={() => {
              hapticSelection()
              handleAttack()
            }}
            className="ff-btn ff-btn-red text-base flex-1"
            style={{ maxWidth: 280, padding: '12px 20px' }}
          >
            ⚔ АТАКОВАТЬ
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bot card ──────────────────────────────────────────────────────────────

function BotCard({ bot }: { bot: BotData }) {
  const totalSlime = bot.vats.reduce((sum, v) => sum + v.slime, 0)
  return (
    <div className="flex flex-col gap-3 px-2">
      {/* Header: avatar + name + total */}
      <div className="ff-card p-3 flex items-center gap-3">
        <div
          style={{
            fontSize: 36,
            lineHeight: 1,
            width: 52,
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
            border: '3px solid #4d7c0f',
            borderRadius: 12,
          }}
        >
          {bot.avatar}
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <div
            className="ff-display"
            style={{ fontSize: 18, color: '#15803d', lineHeight: 1.1 }}
          >
            {bot.name}
          </div>
          <div
            className="ff-body tabular-nums"
            style={{ fontSize: 13, color: '#365314' }}
          >
            Всего слизи: <b>{fmt(totalSlime)}</b> 💧
          </div>
        </div>
      </div>

      {/* Vats per location */}
      <div className="ff-card p-3 flex flex-col gap-2">
        <div className="ff-display text-sm" style={{ color: '#15803d' }}>
          Чаны
        </div>
        {(['Болото', 'Лес', 'Континент'] as const).map((locName, locIdx) => (
          <div
            key={locName}
            className="flex items-center justify-between text-sm"
          >
            <span style={{ color: '#365314', fontWeight: 700 }}>
              {locName}
            </span>
            <span
              className="tabular-nums"
              style={{ color: '#15803d', fontWeight: 700 }}
            >
              💧 {fmt(bot.vats[locIdx].slime)}
            </span>
          </div>
        ))}
      </div>

      {/* Deck preview — отряд на loc1 (что встретим первым) */}
      <div className="ff-card p-3 flex flex-col gap-2">
        <div className="ff-display text-sm" style={{ color: '#15803d' }}>
          Воины на Болоте ({bot.decks[0].length})
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 6,
          }}
        >
          {bot.decks[0].map((entry, i) => {
            const cfg = FROG_LEVELS[entry.level - 1]
            const wcfg = getWarriorConfig(entry.level)
            const cls = wcfg ? CLASS_META[wcfg.class] : null
            return (
              <div
                key={i}
                className="relative"
                style={{
                  aspectRatio: '1',
                  background: 'linear-gradient(180deg, #fefdf3 0%, #f5e9b8 100%)',
                  border: '2px solid #7c5c2a',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TintedFrog
                  path={getFrogPath(entry.level, 0)}
                  tint={cfg.tint}
                  alt={`L${entry.level}`}
                  style={{ width: '70%', height: '70%' }}
                />
                {cls && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 1,
                      right: 1,
                      fontSize: 9,
                      lineHeight: 1,
                    }}
                  >
                    {cls.emoji}
                  </span>
                )}
                <span
                  style={{
                    position: 'absolute',
                    bottom: 1,
                    left: 2,
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#365314',
                  }}
                >
                  L{entry.level}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Свайп hint */}
      <div
        className="ff-body text-center text-xs"
        style={{ color: '#65a30d', fontStyle: 'italic' }}
      >
        свайп для следующего противника →
      </div>
    </div>
  )
}
