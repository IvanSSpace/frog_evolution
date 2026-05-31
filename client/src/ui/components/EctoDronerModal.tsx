import { useGameStore } from '../../store/gameStore'
import { useModalLock } from '../../utils/modalLock'

type Props = { onClose: () => void }

// Заглушка-строка будущей прокачки ecto-дрона.
function SoonRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div
      className="ff-card flex items-center gap-3 p-3"
      style={{ opacity: 0.75 }}
    >
      <span style={{ fontSize: 26 }}>{icon}</span>
      <div className="flex-1">
        <div className="ff-display text-sm" style={{ color: 'var(--ff-text-light)' }}>
          {title}
        </div>
        <div className="ff-display" style={{ fontSize: 11, color: 'var(--ff-text-dim)' }}>
          {desc}
        </div>
      </div>
      <span
        className="ff-display"
        style={{
          fontSize: 11,
          color: '#c77dff',
          border: '2px solid #9d4edd',
          borderRadius: 8,
          padding: '2px 8px',
        }}
      >
        Скоро
      </span>
    </div>
  )
}

export function EctoDronerModal({ onClose }: Props) {
  useModalLock()
  const ectoplasm = useGameStore((s) => s.ectoplasm)

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
          style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#7b2cbf', letterSpacing: 1.5 }}
          >
            Дроны-сборщики
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

        {/* Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto ff-no-scrollbar px-4 py-3 flex flex-col gap-3"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          {/* Дрон + баланс */}
          <div className="ff-card flex items-center gap-3 p-3">
            <img
              src="/drone_loc2.png"
              alt=""
              style={{ height: 56, width: 'auto', objectFit: 'contain' }}
            />
            <div className="flex-1">
              <div className="ff-display text-sm" style={{ color: 'var(--ff-text-light)' }}>
                Дрон-сборщик
              </div>
              <div className="ff-display" style={{ fontSize: 11, color: 'var(--ff-text-dim)' }}>
                Летает по полю и собирает эктоплазму
              </div>
            </div>
            <div
              className="ff-display"
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#c77dff',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Эктоплазма"
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle at 35% 30%, #e0aaff, #9d4edd 70%)',
                  boxShadow: '0 0 4px #9d4edd',
                  display: 'inline-block',
                }}
              />
              {ectoplasm}
            </div>
          </div>

          {/* Будущая прокачка */}
          <div
            className="ff-display"
            style={{ fontSize: 12, color: 'var(--ff-text-dim)', marginTop: 4 }}
          >
            Прокачка
          </div>
          <SoonRow icon="⚡" title="Скорость сбора" desc="Дрон летает быстрее" />
          <SoonRow icon="🛸" title="Больше дронов" desc="+1 дрон-сборщик" />
          <SoonRow icon="💜" title="Ценность слизи" desc="Больше эктоплазмы за сбор" />
        </div>
      </div>
    </div>
  )
}
