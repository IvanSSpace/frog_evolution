import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TintedFrog } from './TintedFrog'
import { useGameStore, ENTITY_CAP } from '../../store/gameStore'
import {
  FROG_LEVELS,
  getFrogPrice,
  getTargetIncomePerSec,
  getFrogPath,
} from '../../game/config/frogs'
import {
  getEvolutionCost,
  getEvolutionBonusPercent,
  isEvolutionUnlockedForLocation,
  countEvolutionsInLocation,
  LOCATION_GATE_THRESHOLD,
} from '../../game/config/evolution'
import { hapticNotification } from '../../utils/telegram'
import { eventBus } from '../../store/eventBus'
import { fmt } from '../../utils/formatting'
import { useModalLock } from '../../utils/modalLock'
import { useCosmosUnlocked } from '../../utils/cosmosGate'

type TabId = 'buy' | 'evolve'

type Props = { onClose: () => void }

export function FrogShopModal({ onClose }: Props) {
  useModalLock()
  const { t } = useTranslation()
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('buy')
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
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: '0 16px 4px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop relative"
        style={{
          width: '100%',
          maxWidth: 380,
          height: '75vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#15803d', letterSpacing: 1.5 }}
          >
            {t('frog_shop.title')}
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

        <div className="flex gap-2 px-3 pt-2 flex-shrink-0">
          <TabButton active={tab === 'buy'} onClick={() => setTab('buy')}>
            Купить
          </TabButton>
          <TabButton active={tab === 'evolve'} onClick={() => setTab('evolve')}>
            Эволюция
          </TabButton>
        </div>

        {tab === 'buy' ? (
          <div
            ref={scrollRef}
            className="flex flex-col gap-3 p-3 overflow-y-auto"
          >
            {[...FROG_LEVELS].reverse().map((cfg, idx) => {
              const level = FROG_LEVELS.length - idx
              const unlocked = hasUnlockAll || discoveredLevels.includes(level)
              return cfg.availableInShop && unlocked ? (
                <FrogCard key={level} level={level} onResult={showToast} />
              ) : null
            })}
          </div>
        ) : (
          <EvolveTab onResult={showToast} />
        )}

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

  return (
    <div className="ff-card px-2.5 py-2 flex items-center gap-2.5">
      <div
        className="w-12 h-12 flex-shrink-0 flex items-center justify-center p-1 rounded-xl"
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

function EvolveTab({ onResult }: { onResult: (msg: string) => void }) {
  const cosmosUnlocked = useCosmosUnlocked()
  const frogTiers = useGameStore((s) => s.frogTiers)

  if (!cosmosUnlocked) {
    return (
      <div
        className="flex flex-col items-center justify-center p-6 text-center"
        style={{ color: '#365314', minHeight: 240 }}
      >
        <div className="ff-display text-lg mb-2" style={{ color: '#15803d' }}>
          Эволюция закрыта
        </div>
        <div className="ff-body text-sm" style={{ color: '#4d7c0f' }}>
          Откроется после первого слияния двух лягушек 18-го уровня (открытие
          космоса).
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto">
      {[0, 1, 2].map((groupIdx) => (
        <EvolveGroupSection
          key={groupIdx}
          groupIdx={groupIdx}
          frogTiers={frogTiers}
          onResult={onResult}
        />
      ))}
    </div>
  )
}

function EvolveGroupSection({
  groupIdx,
  frogTiers,
  onResult,
}: {
  groupIdx: number
  frogTiers: number[]
  onResult: (msg: string) => void
}) {
  const unlocked = isEvolutionUnlockedForLocation(frogTiers, groupIdx)
  const groupLevels = [1, 2, 3]
    .map((n) => groupIdx * 6 + n)
    .concat([4, 5, 6].map((n) => groupIdx * 6 + n))
  const locName = ['Болото', 'Лес', 'Континент'][groupIdx] ?? ''

  if (!unlocked) {
    const prevIdx = groupIdx - 1
    const prevDone = countEvolutionsInLocation(frogTiers, prevIdx)
    const prevLocName = ['Болото', 'Лес', 'Континент'][prevIdx] ?? ''
    const prevUnlocked = isEvolutionUnlockedForLocation(frogTiers, prevIdx)
    return (
      <div
        className="ff-card px-3 py-3 text-center"
        style={{ color: '#365314', opacity: 0.85 }}
      >
        <div className="ff-display text-sm" style={{ color: '#15803d' }}>
          {locName} — эволюция закрыта
        </div>
        <div className="ff-body text-xs mt-1" style={{ color: '#4d7c0f' }}>
          {prevUnlocked ? (
            <>
              Нужно {LOCATION_GATE_THRESHOLD} эволюций на локации «{prevLocName}
              » (сделано {prevDone}/{LOCATION_GATE_THRESHOLD}).
            </>
          ) : (
            <>Сначала разблокируйте эволюцию на «{prevLocName}».</>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {groupLevels
        .slice()
        .reverse()
        .map((level) => (
          <EvolveCard key={level} level={level} onResult={onResult} />
        ))}
    </>
  )
}

function formatCooldown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function EvolveCard({
  level,
  onResult,
}: {
  level: number
  onResult: (msg: string) => void
}) {
  const { t } = useTranslation()
  const gold = useGameStore((s) => s.gold)
  const essence = useGameStore((s) => s.essence)
  const mutagen = useGameStore((s) => s.mutagen)
  const tier = useGameStore((s) => s.frogTiers[level - 1] ?? 0)
  const cooldownEnd = useGameStore((s) => s.frogTierCooldowns[level - 1] ?? 0)
  const upgradeFrogTier = useGameStore((s) => s.upgradeFrogTier)
  const cfg = FROG_LEVELS[level - 1]
  const frogName = t(`frogs.${level}`)
  const isMax = tier >= 2
  const nextTier = Math.min(2, tier + 1)
  const {
    gold: goldCost,
    essence: essenceCost,
    mutagen: mutagenCost,
  } = getEvolutionCost(level, tier)
  const bonusPct = getEvolutionBonusPercent(level, nextTier)
  const currentPath = getFrogPath(level, tier)
  const nextPath = getFrogPath(level, nextTier)

  // Tick раз в секунду пока кулдаун активен — компонент перерендерится.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (cooldownEnd <= now) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [cooldownEnd, now])

  const cdRemaining = Math.max(0, cooldownEnd - now)
  const onCooldown = cdRemaining > 0
  const canAffordGold = gold >= goldCost
  const canAffordEssence = essence >= essenceCost
  const canAffordMutagen = mutagen >= mutagenCost
  const canAfford = canAffordGold && canAffordEssence && canAffordMutagen
  const disabled = isMax || onCooldown || !canAfford

  const handleEvolve = () => {
    const r = upgradeFrogTier(level)
    if (r.ok) {
      hapticNotification('success')
      // Pokemon-style церемония: старая форма → вспышка → новая (tier до апгрейда
      // = `tier`, после = `nextTier`; пути/бонус захвачены на этом рендере).
      eventBus.emit('frog:evolution-ceremony', {
        level,
        newTier: nextTier,
        oldPath: currentPath,
        newPath: nextPath,
        tint: cfg.tint,
        name: frogName,
        bonusPct,
      })
    } else {
      hapticNotification('error')
      if (r.reason === 'noGold') onResult('Недостаточно слизи')
      else if (r.reason === 'noEssence') onResult('Недостаточно 💠')
      else if (r.reason === 'noMutagen') onResult('Недостаточно 🧬 мутагена')
      else if (r.reason === 'maxTier') onResult('Максимальный уровень')
      else if (r.reason === 'cooldown') onResult('Кулдаун ещё активен')
      else if (r.reason === 'locked') onResult('Локация эволюции закрыта')
      else if (r.reason === 'cosmosLocked') onResult('Эволюция закрыта')
    }
  }

  return (
    <div className="ff-card px-2.5 py-2 flex items-center gap-2.5">
      <div
        className="w-12 h-12 flex-shrink-0 flex items-center justify-center p-1 rounded-xl"
        style={{
          background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
          border: '2px solid #4d7c0f',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6)',
        }}
      >
        <TintedFrog
          path={currentPath}
          tint={cfg.tint}
          alt={frogName}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {!isMax && (
        <>
          <span
            className="ff-display text-lg flex-shrink-0"
            style={{ color: '#365314' }}
          >
            →
          </span>
          <div
            className="w-12 h-12 flex-shrink-0 flex items-center justify-center p-1 rounded-xl"
            style={{
              background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
              border: '2px solid #4d7c0f',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6)',
              opacity: 0.5,
            }}
          >
            <TintedFrog
              path={nextPath}
              tint={cfg.tint}
              alt={`${frogName} t${nextTier}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </>
      )}

      <div className="flex-1 min-w-0">
        <div className="ff-display text-sm text-emerald-900 leading-tight">
          {frogName}
        </div>
        <div className="ff-body text-[10px] text-emerald-800 font-bold leading-tight">
          Тир {tier}
          {isMax ? ' (MAX)' : ` → ${nextTier}`}
          {!isMax && (
            <span style={{ color: '#15803d', marginLeft: 4 }}>
              +{bonusPct}%
            </span>
          )}
        </div>
        {onCooldown && (
          <div
            className="ff-body text-[10px] font-bold leading-tight"
            style={{ color: '#b45309' }}
          >
            ⏱ {formatCooldown(cdRemaining)}
          </div>
        )}
      </div>

      <button
        onClick={handleEvolve}
        disabled={disabled}
        className={`ff-btn text-xs flex-shrink-0 ${
          isMax
            ? 'ff-btn-grey'
            : onCooldown
              ? 'ff-btn-grey'
              : canAfford
                ? 'ff-btn-yellow'
                : 'ff-btn-red'
        }`}
        style={{
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
          minWidth: 84,
        }}
      >
        {isMax ? (
          'MAX'
        ) : onCooldown ? (
          '⏱'
        ) : (
          <span className="flex flex-col items-center leading-tight gap-0.5">
            <span>
              {fmt(goldCost)}{' '}
              <img
                src="/goo.svg"
                style={{
                  width: '0.9em',
                  height: '0.9em',
                  display: 'inline-block',
                  verticalAlign: 'middle',
                }}
                alt=""
              />
            </span>
            {essenceCost > 0 && <span>💠 {essenceCost}</span>}
            {mutagenCost > 0 && (
              <span style={{ color: canAffordMutagen ? undefined : '#dc2626' }}>
                🧬 {mutagenCost}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  )
}
