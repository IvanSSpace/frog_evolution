import {
  useGameStore,
  getUpgradeCost,
  getDropIntervalMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getCrateLevel,
  UPGRADE_CONFIG,
} from '../../store/gameStore'
import { FROG_LEVELS } from '../../game/config/frogs'
import { hapticNotification } from '../../utils/telegram'
import { fmt } from '../../utils/formatting'

type Props = { onClose: () => void }

export function ShopModal({ onClose }: Props) {
  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'auto', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop"
        style={{ width: '100%', maxWidth: 380, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Шапка панели */}
        <div className="relative flex items-center justify-between px-5 pt-4 pb-3"
             style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}>
          <h2 className="ff-display ff-stroke-white text-3xl"
              style={{ color: '#dc2626', letterSpacing: 1.5 }}>
            ПРОКАЧКА
          </h2>
          <button
            onClick={onClose}
            aria-label="закрыть"
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

        <ShopCards />
      </div>
    </div>
  )
}

function ShopCards() {
  const currentLocation = useGameStore((s) => s.currentLocation)
  const isBoloto = currentLocation === 1
  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto">
      {/* Болото-only апгрейды (бокс-дропы и магнит) */}
      {isBoloto && <DropSpeedCard />}
      {isBoloto && <CrateQualityCard />}
      {isBoloto && <MagnetCard />}
      {/* Трактор работает на любой локации */}
      <TractorCard />
    </div>
  )
}

type GenericCardProps = {
  icon: string
  title: string
  effect: string
  level: number
  maxLevel: number
  cost: number
  isMax: boolean
  canAfford: boolean
  onBuy: () => void
}

function UpgradeCard({ icon, title, effect, level, maxLevel, cost, isMax, canAfford, onBuy }: GenericCardProps) {
  return (
    <div className="ff-card p-3 flex items-center gap-3">
      {/* Иконка в светло-зелёном квадрате */}
      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center text-3xl rounded-2xl"
           style={{
             background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
             border: '2px solid #4d7c0f',
             boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
           }}>
        <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>{icon}</span>
      </div>

      {/* Текст */}
      <div className="flex-1 min-w-0">
        <div className="ff-display text-base text-emerald-900 leading-tight">{title}</div>
        <div className="ff-body text-xs text-emerald-800 mt-0.5 font-bold leading-tight">{effect}</div>
        <div className="ff-body text-[10px] text-emerald-700 font-bold mt-0.5">
          Lvl {level} / {maxLevel}
        </div>
      </div>

      {/* Кнопка покупки */}
      <button
        onClick={onBuy}
        disabled={isMax || !canAfford}
        className={`ff-btn text-sm ${
          isMax ? 'ff-btn-grey' : canAfford ? 'ff-btn-green' : 'ff-btn-red'
        }`}
      >
        {isMax ? 'MAX' : `${fmt(cost)} 💩`}
      </button>
    </div>
  )
}

function DropSpeedCard() {
  const level = useGameStore((s) => s.upgrades.dropSpeed)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const cfg = UPGRADE_CONFIG.dropSpeed
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('dropSpeed', level)
  const canAfford = gold >= cost
  const cur = (getDropIntervalMs(level) / 1000).toFixed(1)
  const next = isMax ? cur : (getDropIntervalMs(level + 1) / 1000).toFixed(1)
  return (
    <UpgradeCard
      icon="📦"
      title="Скорость дропа"
      effect={isMax ? `${cur}с` : `${cur}с → ${next}с`}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() => hapticNotification(buyUpgrade('dropSpeed') ? 'success' : 'error')}
    />
  )
}

function TractorCard() {
  const level = useGameStore((s) => s.upgrades.tractor)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const cfg = UPGRADE_CONFIG.tractor
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('tractor', level)
  const canAfford = gold >= cost
  const hours = cfg.capHours[level]
  const nextHours = isMax ? hours : cfg.capHours[level + 1]
  const cur = level === 0 ? 'не куплен' : `${hours} ч офлайн`
  const next = isMax ? '' : `${nextHours} ч`
  return (
    <UpgradeCard
      icon="🚜"
      title="Трактор"
      effect={isMax ? cur : `${cur} → ${next}`}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() => hapticNotification(buyUpgrade('tractor') ? 'success' : 'error')}
    />
  )
}

function MagnetCard() {
  const level = useGameStore((s) => s.upgrades.magnet)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const cfg = UPGRADE_CONFIG.magnet
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('magnet', level)
  const canAfford = gold >= cost
  const interval = getMagnetSpawnInterval(level)
  const duration = getMagnetDuration(level)
  const nextInterval = isMax ? interval : getMagnetSpawnInterval(level + 1)
  const nextDuration = isMax ? duration : getMagnetDuration(level + 1)
  const cur = level === 0
    ? 'не куплен'
    : `раз в ${(interval / 1000).toFixed(0)}с / ${(duration / 1000).toFixed(0)}с`
  const next = isMax ? '' : `${(nextInterval / 1000).toFixed(0)}с / ${(nextDuration / 1000).toFixed(0)}с`
  return (
    <UpgradeCard
      icon="🧲"
      title="Магнит"
      effect={isMax ? cur : `${cur} → ${next}`}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() => hapticNotification(buyUpgrade('magnet') ? 'success' : 'error')}
    />
  )
}

function CrateQualityCard() {
  const level = useGameStore((s) => s.upgrades.crateQuality)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const cfg = UPGRADE_CONFIG.crateQuality
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('crateQuality', level)
  const canAfford = gold >= cost
  const curFrogLevel = getCrateLevel(level)
  const nextFrogLevel = isMax ? curFrogLevel : getCrateLevel(level + 1)
  const curName = FROG_LEVELS[curFrogLevel - 1]?.name ?? `L${curFrogLevel}`
  const nextName = FROG_LEVELS[nextFrogLevel - 1]?.name ?? `L${nextFrogLevel}`
  const effect = isMax
    ? `Боксы: ${curName}`
    : level === 0
      ? `Боксы: Фрогги → ${nextName}`
      : `${curName} → ${nextName}`
  return (
    <UpgradeCard
      icon="📦"
      title="Качество боксов"
      effect={effect}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() => hapticNotification(buyUpgrade('crateQuality') ? 'success' : 'error')}
    />
  )
}
