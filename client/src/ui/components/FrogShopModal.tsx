import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TintedFrog } from './TintedFrog'
import { useGameStore, ENTITY_CAP } from '../../store/gameStore'
import {
  FROG_LEVELS,
  getFrogPrice,
  getTargetIncomePerSec,
} from '../../game/config/frogs'
import { hapticNotification } from '../../utils/telegram'
import { rarityForLevel, rarityClass } from '../../utils/frogRarity'
import { fmt } from '../../utils/formatting'
import { useModalLock } from '../../utils/modalLock'

type Props = { onClose: () => void }

export function FrogShopModal({ onClose }: Props) {
  useModalLock()
  const { t } = useTranslation()
  const [toast, setToast] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  const discoveredLevels = useGameStore((s) => s.discoveredLevels)
  const hasUnlockAll = useGameStore((s) =>
    s.devFlags.includes('unlock_all_frogs'),
  )

  // Mark все текущие discoveredLevels как «виденные» в shop → badge на 🐸 пропадёт.
  // Empty deps = одиночный вызов на mount; повторное открытие модалки сбросит свежие drops.
  const markFrogShopSeen = useGameStore((s) => s.markFrogShopSeen)
  useEffect(() => {
    markFrogShopSeen()
  }, [markFrogShopSeen])

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad) + 6px) 12px calc(9vh + env(safe-area-inset-bottom, 0px) + 6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop relative"
        style={{
          width: '100%',
          maxWidth: 380,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex items-center justify-between px-4 pt-2 pb-2"
          style={{ borderBottom: '1px solid rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-xl"
            style={{ color: '#15803d', letterSpacing: 1.5 }}
          >
            {t('frog_shop.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('settings_modal.close')}
            className="ff-tile w-8 h-8 text-base"
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

        {/* Эволюция (старый %-функционал) убрана — теперь в центре эволюции (Loc3). */}
        <div ref={scrollRef} className="flex flex-col gap-3 p-3 overflow-y-auto">
          {[...FROG_LEVELS].reverse().map((cfg, idx) => {
            const level = FROG_LEVELS.length - idx
            const unlocked = hasUnlockAll || discoveredLevels.includes(level)
            return cfg.availableInShop && unlocked ? (
              <FrogCard key={level} level={level} onResult={showToast} />
            ) : null
          })}
        </div>

        {toast && (
          <div
            className="ff-display absolute left-1/2 -translate-x-1/2 px-4 py-2 text-white text-sm whitespace-nowrap pointer-events-none"
            style={{
              bottom: 12,
              background: 'linear-gradient(180deg, #f87171 0%, #b91c1c 100%)',
              border: '3px solid #7f1d1d',
              borderBottomWidth: 5,
              borderRadius: 14,
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 0 rgba(0,0,0,0.3)',
              textShadow: '0 2px 0 rgba(0,0,0,0.45)',
              animation: 'ffPop 220ms cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

function FrogCard({
  level,
  onResult,
}: {
  level: number
  onResult: (msg: string) => void
}) {
  const { t } = useTranslation()
  const purchases = useGameStore((s) => s.frogPurchases[level - 1] ?? 0)
  const gold = useGameStore((s) => s.gold)
  const entityCount = useGameStore((s) => s.entityCount)
  const buyFrog = useGameStore((s) => s.buyFrog)
  useGameStore((s) => s.numberFormat) // subscribe to format changes

  const cfg = FROG_LEVELS[level - 1]
  const cost = getFrogPrice(level, purchases)
  const canAfford = gold >= cost
  const capFull = entityCount >= ENTITY_CAP
  const frogName = t(`frogs.${level}`)

  const handleBuy = async () => {
    const r = await buyFrog(level)
    if (r.ok) {
      hapticNotification('success')
    } else {
      hapticNotification('error')
      if (r.reason === 'capFull')
        onResult(t('frog_shop.cap_full', { cap: ENTITY_CAP }))
      else if (r.reason === 'noGold') onResult(t('frog_shop.no_gold'))
    }
  }

  const rarity = rarityForLevel(level)
  return (
    <div
      className={`ff-card ff-rarity ${rarityClass(rarity)} px-2.5 py-2 flex items-center gap-2.5`}
    >
      <div
        className="ff-rarity-icon w-12 h-12 flex-shrink-0 flex items-center justify-center p-1 rounded-xl"
        style={{
          background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
          border: '2px solid #4d7c0f',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6)',
        }}
      >
        <TintedFrog
          path={cfg.path}
          tint={cfg.tint}
          alt={frogName}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="ff-display text-sm text-emerald-900 leading-tight">
          {frogName}
        </div>
        <div className="ff-body text-[10px] text-emerald-800 font-bold leading-tight">
          {t('frog_shop.bought')}{' '}
          <span className="tabular-nums">{purchases}</span>
          {' · '}
          {t('frog_shop.income')}{' '}
          <span className="tabular-nums">{getTargetIncomePerSec(level)}</span>{' '}
          <img
            src="/goo.svg"
            style={{
              width: '1em',
              height: '1em',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}
            alt=""
          />
          /s
        </div>
      </div>

      <button
        onClick={handleBuy}
        disabled={!canAfford || capFull}
        className={`ff-btn text-xs flex-shrink-0 ${
          capFull ? 'ff-btn-grey' : canAfford ? 'ff-btn-yellow' : 'ff-btn-red'
        }`}
        style={{
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
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
      </button>
    </div>
  )
}
