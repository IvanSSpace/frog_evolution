import { useState, type ReactNode } from 'react'
import { useGameStore, UPGRADE_CONFIG, getUpgradeCost } from '../../store/gameStore'
import { droneCapacity } from '../../game/config/upgrades'
import { useModalLock } from '../../utils/modalLock'
import { hapticImpact, hapticNotification } from '../../utils/telegram'
import { AutoCollectCard, MagnetCard, UpgradeCard } from './ShopModal'

// Карточка покупки слотов дронов (ёмкость). База 2, докупаешь до 8.
function DroneSlotsCard() {
  const level = useGameStore((s) => s.upgrades.droneSlots)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const cfg = UPGRADE_CONFIG.droneSlots
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('droneSlots', level)
  const cap = droneCapacity(level)
  return (
    <UpgradeCard
      icon={<span style={{ fontSize: 26 }}>🛖</span>}
      title="Слоты дронов"
      theme="drone"
      effect={isMax ? `${cap} слотов (макс)` : `${cap} → ${cap + 1} слотов`}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={gold >= cost}
      onBuy={() =>
        void buyUpgrade('droneSlots').then((ok) =>
          hapticNotification(ok ? 'success' : 'error'),
        )
      }
    />
  )
}

// Строка распределения одного типа: иконка + имя + −/счётчик/+.
function DistributionRow({
  icon,
  name,
  count,
  canAdd,
  onAdd,
  onSub,
}: {
  icon: string
  name: string
  count: number
  canAdd: boolean
  onAdd: () => void
  onSub: () => void
}) {
  const btn = (enabled: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    opacity: enabled ? 1 : 0.35,
    pointerEvents: enabled ? 'auto' : 'none',
  })
  return (
    <div className="flex items-center gap-3">
      <img src={icon} alt="" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
      <div className="ff-display text-sm flex-1" style={{ color: 'var(--ff-text-light)' }}>
        {name}
      </div>
      <button
        className="ff-tile text-lg"
        style={btn(count > 0)}
        onClick={() => {
          onSub()
          hapticImpact('light')
        }}
        aria-label="Убрать"
      >
        −
      </button>
      <div
        className="ff-display tabular-nums text-lg text-center"
        style={{ minWidth: 24, color: '#86f25a' }}
      >
        {count}
      </div>
      <button
        className="ff-tile text-lg"
        style={btn(canAdd)}
        onClick={() => {
          onAdd()
          hapticImpact('light')
        }}
        aria-label="Добавить"
      >
        +
      </button>
    </div>
  )
}

// Распределение слотов между сборщиками и магнитами (бесплатно).
function DroneDistribution() {
  const collectors = useGameStore((s) => s.upgrades.collectorDrones)
  const magnets = useGameStore((s) => s.upgrades.magnetDrones)
  const slots = useGameStore((s) => s.upgrades.droneSlots)
  const setDist = useGameStore((s) => s.setDroneDistribution)
  const cap = droneCapacity(slots)
  const used = collectors + magnets
  const free = cap - used
  return (
    <div className="ff-card p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="ff-display text-sm" style={{ color: 'var(--ff-text-light)' }}>
          Распределение слотов
        </div>
        <div
          className="ff-display tabular-nums text-sm"
          style={{ color: free > 0 ? '#86f25a' : 'var(--ff-text-dim)' }}
        >
          {used}/{cap}
        </div>
      </div>
      <DistributionRow
        icon="/goo_collector_icon.webp"
        name="Сборщики"
        count={collectors}
        canAdd={free > 0}
        onAdd={() => setDist(collectors + 1, magnets)}
        onSub={() => setDist(collectors - 1, magnets)}
      />
      <DistributionRow
        icon="/magnet_drone_icon.webp"
        name="Магниты"
        count={magnets}
        canAdd={free > 0}
        onAdd={() => setDist(collectors, magnets + 1)}
        onSub={() => setDist(collectors, magnets - 1)}
      />
    </div>
  )
}

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
  // Цвет по уровню заряда: 0%=красный → 50%=жёлтый → 100%=зелёный (hue 0..120).
  const hue = (Math.max(0, Math.min(100, pct)) / 100) * 120
  const fillColor = `hsl(${hue}, 80%, 48%)`
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
              background: fillColor,
              transition: 'width 0.3s, background 0.3s',
            }}
          />
        </div>
      </div>
      <div
        className="ff-display tabular-nums text-sm flex-shrink-0"
        style={{ color: active ? fillColor : 'var(--ff-text-dim)', minWidth: 44, textAlign: 'right' }}
      >
        {active ? `${pct}%` : '—'}
      </div>
    </div>
  )
}

export function DronerModal({ onClose }: Props) {
  useModalLock()
  const droneBatteries = useGameStore((s) => s.droneBatteries)
  const magnetBatteries = useGameStore((s) => s.magnetBatteries)
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
          style={{ borderBottom: '1px solid rgba(77,107,31,0.4)' }}
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
              {droneBatteries.length === 0 && magnetBatteries.length === 0 && (
                <div
                  className="ff-display text-sm text-center py-6"
                  style={{ color: 'var(--ff-text-dim)' }}
                >
                  Нет активных дронов
                </div>
              )}
              {droneBatteries.map((b, i) => (
                <ChargeRow
                  key={`d${i}`}
                  icon="/goo_collector_icon.webp"
                  name={
                    droneBatteries.length > 1
                      ? `Дрон-сборщик ${i + 1}`
                      : 'Дрон-сборщик'
                  }
                  battery={b}
                />
              ))}
              {magnetBatteries.map((b, i) => (
                <ChargeRow
                  key={`m${i}`}
                  icon="/magnet_drone_icon.webp"
                  name={
                    magnetBatteries.length > 1
                      ? `Магнит-дрон ${i + 1}`
                      : 'Магнит-дрон'
                  }
                  battery={b}
                />
              ))}
            </>
          ) : (
            <>
              <DroneSlotsCard />
              <DroneDistribution />
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
