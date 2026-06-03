// FireLevelsModal — настройка уровня горения зелёного огня монумента (Loc3, тест).
// Открывается по building:open {modal:'fireLevels'} (монумент — Чанк 1 задаёт
// opens:'fireLevels'). Выбор уровня → setFireLevel → Loc3LottieTest применяет
// CSS-фильтр ко всем огням. Без персиста.

import { useModalLock } from '../../utils/modalLock'
import {
  FIRE_LEVELS,
  FIRE_COUNT,
  FIRE_NAMES,
  getFireLevel,
  setFireLevel,
  useFireLevel,
} from './fireLevels'

type Props = { onClose: () => void }

export function FireLevelsModal({ onClose }: Props) {
  useModalLock()
  useFireLevel() // подписка на смену уровней

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
          width: 'min(100%, 380px)',
          marginInline: 'auto',
          maxHeight: 'calc(100dvh - var(--ui-top-offset) - var(--tg-chrome-pad) - 9vh)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 pt-3 pb-2"
          style={{ borderBottom: '1px solid rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-xl"
            style={{ color: '#3fae44', letterSpacing: 1.5 }}
          >
            Огонь монумента
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
            Уровень горения каждого огня (слабое → кислотное)
          </div>
          {Array.from({ length: FIRE_COUNT }).map((_f, fire) => {
            const cur = getFireLevel(fire)
            return (
              <div key={fire} className="flex flex-col gap-1">
                <div className="ff-display text-xs text-[#4a6b3a]">
                  🔥 {FIRE_NAMES[fire] ?? `Огонь ${fire + 1}`}
                </div>
                <div className="flex gap-2">
                  {FIRE_LEVELS.map((lvl) => {
                    const active = lvl.id === cur
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setFireLevel(fire, lvl.id)}
                        style={{ touchAction: 'manipulation' }}
                        className={`flex-1 flex flex-col items-center gap-1 rounded-xl px-2 py-2 border-2 ${
                          active
                            ? 'border-[#3f8a2e] bg-[#d4eeb8]'
                            : 'border-transparent bg-[#dceecb]'
                        }`}
                      >
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: `radial-gradient(circle at 35% 30%, #ffffff55, ${lvl.swatch} 70%)`,
                            boxShadow: `0 0 8px ${lvl.swatch}`,
                          }}
                        />
                        <span className="ff-display text-[10px] text-[#1f3a17]">
                          {lvl.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
