import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { useModalLock } from '../../utils/modalLock'
import { hapticImpact } from '../../utils/telegram'
import { FROG_LEVELS } from '../../game/config/frogs'

// Лягушка с правильным тинтом: как preload на поле — меняем ТОЛЬКО белый fill
// (#ffffff/#fff) на tint, цветные детали (корона/узоры) остаются.
function TintedFrog({ level, size }: { level: number; size: number }) {
  const cfg = FROG_LEVELS[level - 1]
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (!cfg) return
    fetch(cfg.path)
      .then((r) => r.text())
      .then((txt) => {
        if (!alive) return
        const tintHex = '#' + cfg.tint.toString(16).padStart(6, '0')
        const recolored = txt
          .replace(/fill:\s*#ffffff/gi, `fill:${tintHex}`)
          .replace(/fill="#ffffff"/gi, `fill="${tintHex}"`)
          .replace(/fill="#fff"/gi, `fill="${tintHex}"`)
        setSrc('data:image/svg+xml;utf8,' + encodeURIComponent(recolored))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [level, cfg])
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      {src && (
        <img
          src={src}
          alt=""
          style={{ width: size, height: size, objectFit: 'contain' }}
        />
      )}
    </div>
  )
}

type Props = { onClose: () => void }

// Центр эволюции (Loc3): выбираешь лягушку с поля континента → запускаешь её
// эволюцию (помещается в капсулу, таймер, потом анлок уникальной механики).
export function EvolutionModal({ onClose }: Props) {
  useModalLock()
  // Лягушки СО ВСЕХ локаций (эволюция доступна любому уровню). Считаем по уровням.
  const locationFrogs = useGameStore((s) => s.locationFrogs)
  const counts = new Map<number, number>()
  for (const arr of locationFrogs) {
    for (const lvl of arr ?? []) counts.set(lvl, (counts.get(lvl) ?? 0) + 1)
  }
  const levels = [...counts.keys()].sort((a, b) => a - b)

  const start = (level: number) => {
    hapticImpact('medium')
    eventBus.emit('evolution:start', { level })
    onClose()
  }

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: '0 12px calc(9vh + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop"
        style={{
          width: '100%',
          maxWidth: 380,
          maxHeight: 'calc(100dvh - var(--ui-top-offset) - var(--tg-chrome-pad) - 9vh)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex items-center justify-between px-4 pt-3 pb-2"
          style={{ borderBottom: '1px solid rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-xl"
            style={{ color: '#16a34a', letterSpacing: 1.5 }}
          >
            Центр эволюции
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ff-tile w-8 h-8 text-base"
            style={{
              touchAction: 'manipulation',
              ['--ff-tile-from' as never]: '#fca5a5',
              ['--ff-tile-to' as never]: '#dc2626',
              ['--ff-tile-border' as never]: '#7f1d1d',
              color: '#fff',
            }}
          >
            ✕
          </button>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto ff-no-scrollbar px-4 py-3 flex flex-col gap-3"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            className="ff-display"
            style={{ fontSize: 12, color: 'var(--ff-text-dim)' }}
          >
            Выбери лягушку — она эволюционирует в капсуле. Что откроется — узнаешь
            по завершении. 🔮
          </div>

          {/* Временная кнопка: мгновенно завершить активную эволюцию (тест). */}
          <button
            type="button"
            onClick={() => {
              hapticImpact('medium')
              eventBus.emit('evolution:finish')
              onClose()
            }}
            className="ff-card flex items-center justify-center gap-2 p-2"
            style={{
              touchAction: 'manipulation',
              cursor: 'pointer',
              color: '#fbbf24',
            }}
          >
            ⚡ Завершить эволюцию мгновенно (тест)
          </button>

          {levels.length === 0 && (
            <div
              className="ff-display text-sm text-center py-6"
              style={{ color: 'var(--ff-text-dim)' }}
            >
              Нет лягушек — вырасти их сначала.
            </div>
          )}

          {levels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => start(level)}
              className="ff-card flex items-center gap-3 p-3"
              style={{ touchAction: 'manipulation', cursor: 'pointer' }}
            >
              <TintedFrog level={level} size={44} />
              <div className="flex-1 text-left">
                <div
                  className="ff-display text-sm"
                  style={{ color: 'var(--ff-text-light)' }}
                >
                  Лягушка L{level}
                </div>
                <div
                  className="ff-display"
                  style={{ fontSize: 11, color: 'var(--ff-text-dim)' }}
                >
                  всего: {counts.get(level)}
                </div>
              </div>
              <span
                className="ff-display"
                style={{
                  fontSize: 13,
                  color: '#16a34a',
                  border: '2px solid #16a34a',
                  borderRadius: 8,
                  padding: '4px 10px',
                }}
              >
                Эволюция →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
