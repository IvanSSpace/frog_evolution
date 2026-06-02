// FireLevelsModal — настройка уровня горения зелёного огня монумента (Loc3, тест).
// Открывается по building:open {modal:'fireLevels'} (монумент — Чанк 1 задаёт
// opens:'fireLevels'). Выбор уровня → setFireLevel → Loc3LottieTest применяет
// CSS-фильтр ко всем огням. Без персиста.

import { useModalLock } from '../../utils/modalLock'
import { FIRE_LEVELS, setFireLevel, useFireLevel } from './fireLevels'

type Props = { onClose: () => void }

export function FireLevelsModal({ onClose }: Props) {
  useModalLock()
  const level = useFireLevel()

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
        padding: '0 16px 4px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop"
        style={{
          width: '100%',
          maxWidth: 380,
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '1px solid rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#3fae44', letterSpacing: 1.5 }}
          >
            Огонь монумента
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ff-tile w-9 h-9 text-lg"
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

        {/* Body — уровни */}
        <div
          className="flex-1 min-h-0 overflow-y-auto ff-no-scrollbar px-4 py-3 flex flex-col gap-2"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            className="ff-display"
            style={{ fontSize: 12, color: 'var(--ff-text-dim)' }}
          >
            Уровень горения (слабое → кислотное)
          </div>
          {FIRE_LEVELS.map((lvl) => {
            const active = lvl.id === level
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setFireLevel(lvl.id)}
                style={{ touchAction: 'manipulation' }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 border-2 ${
                  active
                    ? 'border-[#3f8a2e] bg-[#d4eeb8]'
                    : 'border-transparent bg-[#dceecb]'
                }`}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 30%, #ffffff55, ${lvl.swatch} 70%)`,
                    boxShadow: `0 0 8px ${lvl.swatch}`,
                    flexShrink: 0,
                  }}
                />
                <span className="ff-display text-sm flex-1 text-left text-[#1f3a17]">
                  {lvl.name}
                </span>
                {active && (
                  <span className="ff-display text-xs text-[#2d6a1f]">✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
