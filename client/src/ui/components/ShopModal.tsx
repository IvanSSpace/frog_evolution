import { useTranslation } from 'react-i18next'
import {
  useGameStore,
  getUpgradeCost,
  getDropIntervalMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getCrateLevel,
  getRareBoxThreshold,
  UPGRADE_CONFIG,
} from '../../store/gameStore'
import { hapticNotification } from '../../utils/telegram'
import { fmt } from '../../utils/formatting'

type Props = { onClose: () => void }

export function ShopModal({ onClose }: Props) {
  const { t } = useTranslation()
  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        top: 54,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop"
        style={{
          width: '100%',
          maxWidth: 380,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="relative flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#dc2626', letterSpacing: 1.5 }}
          >
            {t('shop.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('settings_modal.close')}
            className="ff-tile w-9 h-9 text-lg"
            style={{
              ['--ff-tile-from' as never]: '#fca5a5',
              ['--ff-tile-to' as never]: '#dc2626',
              ['--ff-tile-border' as never]: '#7f1d1d',
              color: '#fff',
            }}
          >
            {t('settings_modal.close')}
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
      {isBoloto && <DropSpeedCard />}
      {isBoloto && <CrateQualityCard />}
      {isBoloto && <MagnetCard />}
      {isBoloto && <RareBoxSpeedCard />}
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

function UpgradeCard({
  icon,
  title,
  effect,
  level,
  maxLevel,
  cost,
  isMax,
  canAfford,
  onBuy,
}: GenericCardProps) {
  const { t } = useTranslation()
  useGameStore((s) => s.numberFormat) // subscribe to format changes
  return (
    <div className="ff-card p-3 flex items-center gap-3">
      <div
        className="flex-shrink-0 w-14 h-14 flex items-center justify-center text-3xl rounded-2xl"
        style={{
          background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
          border: '2px solid #4d7c0f',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>
          {icon}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="ff-display text-base text-emerald-900 leading-tight">
          {title}
        </div>
        <div className="ff-body text-xs text-emerald-800 mt-0.5 font-bold leading-tight">
          {effect}
        </div>
        <div className="ff-body text-[10px] text-emerald-700 font-bold mt-0.5">
          {t('shop.level', { current: level, max: maxLevel })}
        </div>
      </div>

      <button
        onClick={onBuy}
        disabled={isMax || !canAfford}
        className={`ff-btn text-sm ${
          isMax ? 'ff-btn-grey' : canAfford ? 'ff-btn-green' : 'ff-btn-red'
        }`}
      >
        {isMax ? (
          t('shop.max')
        ) : (
          <>
            {fmt(cost)}{' '}
            <img
              src="/goo.svg"
              style={{
                width: '1.1em',
                height: '1.1em',
                display: 'inline-block',
                verticalAlign: 'middle',
              }}
              alt=""
            />
          </>
        )}
      </button>
    </div>
  )
}

function DropSpeedCard() {
  const { t } = useTranslation()
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
      title={t('shop.drop_speed.name')}
      effect={isMax ? `${cur}s` : `${cur}s → ${next}s`}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() =>
        void buyUpgrade('dropSpeed').then((ok) =>
          hapticNotification(ok ? 'success' : 'error'),
        )
      }
    />
  )
}

function TractorCard() {
  const { t } = useTranslation()
  const level = useGameStore((s) => s.upgrades.tractor)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const cfg = UPGRADE_CONFIG.tractor
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('tractor', level)
  const canAfford = gold >= cost
  const hours = cfg.capHours[level]
  const nextHours = isMax ? hours : cfg.capHours[level + 1]
  const cur =
    level === 0
      ? t('shop.tractor.not_bought')
      : t('shop.tractor.offline', { hours })
  const next = isMax ? '' : `${nextHours}h`
  return (
    <UpgradeCard
      icon="🚜"
      title={t('shop.tractor.name')}
      effect={isMax ? cur : `${cur} → ${next}`}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() =>
        void buyUpgrade('tractor').then((ok) =>
          hapticNotification(ok ? 'success' : 'error'),
        )
      }
    />
  )
}

function MagnetCard() {
  const { t } = useTranslation()
  const level = useGameStore((s) => s.upgrades.magnet)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const cfg = UPGRADE_CONFIG.magnet
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('magnet', level)
  const canAfford = gold >= cost
  const interval = (getMagnetSpawnInterval(level) / 1000).toFixed(0)
  const duration = (getMagnetDuration(level) / 1000).toFixed(0)
  const nextInterval = isMax
    ? interval
    : (getMagnetSpawnInterval(level + 1) / 1000).toFixed(0)
  const nextDuration = isMax
    ? duration
    : (getMagnetDuration(level + 1) / 1000).toFixed(0)
  const cur =
    level === 0
      ? t('shop.magnet.not_bought')
      : t('shop.magnet.effect', { interval, duration })
  const next = isMax
    ? ''
    : t('shop.magnet.effect', {
        interval: nextInterval,
        duration: nextDuration,
      })
  return (
    <UpgradeCard
      icon="🧲"
      title={t('shop.magnet.name')}
      effect={isMax ? cur : `${cur} → ${next}`}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() =>
        void buyUpgrade('magnet').then((ok) =>
          hapticNotification(ok ? 'success' : 'error'),
        )
      }
    />
  )
}

function CrateQualityCard() {
  const { t } = useTranslation()
  const level = useGameStore((s) => s.upgrades.crateQuality)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const cfg = UPGRADE_CONFIG.crateQuality
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('crateQuality', level)
  const canAfford = gold >= cost
  const curFrogLevel = getCrateLevel(level)
  const nextFrogLevel = isMax ? curFrogLevel : getCrateLevel(level + 1)
  const curName = t(`frogs.${curFrogLevel}`)
  const nextName = t(`frogs.${nextFrogLevel}`)
  const effect = isMax
    ? t('shop.crate.boxes', { name: curName })
    : level === 0
      ? t('shop.crate.boxes_first', { from: curName, to: nextName })
      : `${curName} → ${nextName}`
  return (
    <UpgradeCard
      icon="📦"
      title={t('shop.crate.name')}
      effect={effect}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() =>
        void buyUpgrade('crateQuality').then((ok) =>
          hapticNotification(ok ? 'success' : 'error'),
        )
      }
    />
  )
}

function RareBoxSpeedCard() {
  const { t } = useTranslation()
  const level = useGameStore((s) => s.upgrades.rareBoxSpeed)
  const gold = useGameStore((s) => s.gold)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  useGameStore((s) => s.numberFormat)
  const cfg = UPGRADE_CONFIG.rareBoxSpeed
  const isMax = level >= cfg.maxLevel
  const cost = isMax ? 0 : getUpgradeCost('rareBoxSpeed', level)
  const canAfford = gold >= cost
  const curCount = getRareBoxThreshold(level)
  const nextCount = isMax ? curCount : getRareBoxThreshold(level + 1)
  const effect = isMax
    ? t('shop.rare_box_speed.effect', { count: curCount })
    : `${t('shop.rare_box_speed.effect', { count: curCount })} → ${nextCount}`
  return (
    <UpgradeCard
      icon="✨"
      title={t('shop.rare_box_speed.name')}
      effect={effect}
      level={level}
      maxLevel={cfg.maxLevel}
      cost={cost}
      isMax={isMax}
      canAfford={canAfford}
      onBuy={() =>
        void buyUpgrade('rareBoxSpeed').then((ok) =>
          hapticNotification(ok ? 'success' : 'error'),
        )
      }
    />
  )
}
