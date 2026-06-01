// ConveyorModal — прокачка конвейера фабрики (Loc2) за gold.
//
// Открывается тапом по зданию-фабрике (frog_factory2loc): BuildingsController
// (Чанк 1) должен задать opens:'conveyor' → eventBus 'building:open' {modal:'conveyor'}
// → App открывает эту модалку. Сейчас единственная прокачка — скорость выпуска L7
// (conveyorSpeed). Эффект (реальный интервал) читает конвейер в scenes/main/*
// через геттер conveyorIntervalMs (Чанк 1).
//
// i18n: TODO — хардкод-RU, как EctoDronerModal; нужен общий i18n-проход.

import {
  useGameStore,
  LOC2_UPGRADE_META,
  loc2UpgradeCost,
  conveyorIntervalMs,
} from '../../store/gameStore'
import { useModalLock } from '../../utils/modalLock'
import { fmt } from '../../utils/formatting'

type Props = { onClose: () => void }

export function ConveyorModal({ onClose }: Props) {
  useModalLock()
  const gold = useGameStore((s) => s.gold)
  const level = useGameStore((s) => s.loc2Upgrades.conveyorSpeed)
  const buyConveyorSpeed = useGameStore((s) => s.buyConveyorSpeed)

  const meta = LOC2_UPGRADE_META.conveyorSpeed
  const isMax = level >= meta.maxLevel
  const cost = loc2UpgradeCost('conveyorSpeed', level)
  const affordable = !isMax && gold >= cost
  const curMs = conveyorIntervalMs(level)
  const nextMs = isMax ? curMs : conveyorIntervalMs(level + 1)

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
            style={{ color: '#b45309', letterSpacing: 1.5 }}
          >
            Конвейер
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
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          {/* Инфо */}
          <div className="ff-card flex items-center gap-3 p-3">
            <span style={{ fontSize: 26 }}>🏭</span>
            <div className="flex-1 min-w-0">
              <div
                className="ff-display text-sm"
                style={{ color: 'var(--ff-text-light)' }}
              >
                Скорость производства
              </div>
              <div
                className="ff-display"
                style={{ fontSize: 11, color: 'var(--ff-text-dim)' }}
              >
                Выпуск лягушки L7 раз в {(curMs / 1000).toFixed(1)}с
                {!isMax && ` → ${(nextMs / 1000).toFixed(1)}с`}
              </div>
              {/* Пипсы уровня */}
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {Array.from({ length: meta.maxLevel }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 14,
                      height: 5,
                      borderRadius: 3,
                      background:
                        i < level ? '#d97706' : 'rgba(217,119,6,0.22)',
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={buyConveyorSpeed}
              disabled={!affordable}
              aria-label={isMax ? 'Максимум' : `Купить за ${cost} золота`}
              className="ff-tile flex-shrink-0"
              style={{
                touchAction: 'manipulation',
                minWidth: 64,
                height: 40,
                padding: '0 8px',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                opacity: affordable ? 1 : 0.5,
                ['--ff-tile-from' as never]: '#fcd34d',
                ['--ff-tile-to' as never]: '#d97706',
                ['--ff-tile-border' as never]: '#78350f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              {isMax ? 'MAX' : `🪙 ${fmt(cost)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
