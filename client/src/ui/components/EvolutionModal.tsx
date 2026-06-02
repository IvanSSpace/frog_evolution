import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { useModalLock } from '../../utils/modalLock'
import { hapticImpact } from '../../utils/telegram'
import { FROG_LEVELS } from '../../game/config/frogs'

// На поле тинт лягушки запекается в рантайме (preload меняет fill #fff на tint).
// Статичный SVG белый → в модалке красим силуэт через CSS mask цветом tint.
const tintHex = (n: number) => '#' + n.toString(16).padStart(6, '0')

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
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '1px solid rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#16a34a', letterSpacing: 1.5 }}
          >
            Центр эволюции
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
              <div
                style={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  backgroundColor: tintHex(FROG_LEVELS[level - 1]?.tint ?? 0xffffff),
                  WebkitMaskImage: `url(${FROG_LEVELS[level - 1]?.path})`,
                  maskImage: `url(${FROG_LEVELS[level - 1]?.path})`,
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                }}
              />
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
