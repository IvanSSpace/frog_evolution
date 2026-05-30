import { useState, type ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useModalLock } from '../../utils/modalLock'
import { AutoCollectCard, MagnetCard } from './ShopModal'

type DronerTab = 'charge' | 'buy'

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="ff-btn text-sm flex-1"
      style={{
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        opacity: active ? 1 : 0.55,
        ['--ff-btn-from' as never]: active ? '#4ade80' : '#cbd5e1',
        ['--ff-btn-to' as never]: active ? '#16a34a' : '#64748b',
        ['--ff-btn-border' as never]: active ? '#14532d' : '#334155',
      }}
    >
      {children}
    </button>
  )
}

type Props = { onClose: () => void }

// Строка заряда одного дрона: иконка + имя + горизонтальный бар + %.
function ChargeRow({
  icon,
  name,
  battery,
}: {
  icon: string
  name: string
  battery: number
}) {
  const active = battery >= 0
  const pct = active ? Math.round(battery) : 0
  return (
    <div className="ff-card flex items-center gap-3 p-3">
      <img
        src={icon}
        alt=""
        style={{ height: 38, width: 'auto', objectFit: 'contain' }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="ff-display text-sm mb-1"
          style={{ color: 'var(--ff-text-light)' }}
        >
          {name}
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 99,
            background: 'rgba(7,13,17,0.7)',
            overflow: 'hidden',
            border: '1px solid var(--ff-line)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 99,
              background:
                'linear-gradient(90deg, #86f25a 0%, #5fd83a 100%)',
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>
      <div
        className="ff-display tabular-nums text-sm flex-shrink-0"
        style={{ color: active ? '#86f25a' : 'var(--ff-text-dim)', minWidth: 44, textAlign: 'right' }}
      >
        {active ? `${pct}%` : '—'}
      </div>
    </div>
  )
}

export function DronerModal({ onClose }: Props) {
  useModalLock()
  const droneBattery = useGameStore((s) => s.droneBattery)
  const magnetBattery = useGameStore((s) => s.magnetBattery)
  const [tab, setTab] = useState<DronerTab>('charge')

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
          height: '75vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header — как FrogShop/Inventory */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#15803d', letterSpacing: 1.5 }}
          >
            Дроны
          </h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
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

        {/* Tabs */}
        <div className="flex gap-2 px-3 pt-2 flex-shrink-0">
          <TabButton active={tab === 'charge'} onClick={() => setTab('charge')}>
            Заряд
          </TabButton>
          <TabButton active={tab === 'buy'} onClick={() => setTab('buy')}>
            Прокачка
          </TabButton>
        </div>

        {/* Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto ff-no-scrollbar px-4 py-3 flex flex-col gap-3"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          {tab === 'charge' ? (
            <>
              <ChargeRow
                icon="/goo_collector_icon.png"
                name="Дрон-сборщик"
                battery={droneBattery}
              />
              <ChargeRow
                icon="/magnet_drone_icon.png"
                name="Магнит-дрон"
                battery={magnetBattery}
              />
            </>
          ) : (
            <>
              <AutoCollectCard />
              <MagnetCard />
              <MagnetCard upgradeKey="magnet2" titleSuffix="Лес" />
              <MagnetCard upgradeKey="magnet3" titleSuffix="Континент" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
