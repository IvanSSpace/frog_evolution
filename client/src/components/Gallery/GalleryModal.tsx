// 2026-05-23: Переделано — раньше это был bestiary collection, теперь —
// подробный breakdown источников дохода. Показывает игроку откуда у него
// доход и какие активные эффекты применены.
// 2026-05-24: Упрощено для читаемости — крупнее шрифты, плоский список,
// убраны мелкие L·t pills (теперь только итог по локации).

import { useEffect, useState } from 'react'
import {
  useGameStore,
  activeTemporaryBuffFraction,
} from '../../store/gameStore'
import {
  getEvolutionBonusPercent,
  getEvolutionBonusFraction,
} from '../../game/config/evolution'
import { fmtRate } from '../../utils/formatting'
import { useModalLock } from '../../utils/modalLock'

interface GalleryModalProps {
  onClose: () => void
}

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const LOCATION_NAMES = ['Болото', 'Лес', 'Континент']
const LOCATION_EMOJIS = ['🟢', '🌲', '🏝️']
const LOCATION_RANGES: Array<[number, number]> = [
  [1, 6],
  [7, 12],
  [13, 18],
]

const TOTAL_MAX_EVOLUTION_PCT = 200

export function GalleryModal({ onClose }: GalleryModalProps) {
  useModalLock()
  const incomePerSec = useGameStore((s) => s.incomePerSec)
  const l18AbsoluteBonusPerSec = useGameStore((s) => s.l18AbsoluteBonusPerSec)
  const l18MergesCount = useGameStore((s) => s.l18MergesCount)
  const frogTiers = useGameStore((s) => s.frogTiers)
  const temporaryIncomeBuff = useGameStore((s) => s.temporaryIncomeBuff)
  useGameStore((s) => s.numberFormat)

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!temporaryIncomeBuff || temporaryIncomeBuff.until <= now) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [temporaryIncomeBuff, now])

  const evolutionFraction = getEvolutionBonusFraction(frogTiers)
  const tempFraction = activeTemporaryBuffFraction(temporaryIncomeBuff, now)
  const totalMultiplier = 1 + evolutionFraction + tempFraction
  const finalIncomePerSec = incomePerSec * totalMultiplier
  const baseIncomeFromFrogs = Math.max(
    0,
    incomePerSec - l18AbsoluteBonusPerSec,
  )

  // Подсчёт эволюции — только итог per location, без per-L·t pills.
  const evolutionByLocation = LOCATION_RANGES.map(([min, max]) => {
    let total = 0
    for (let level = min; level <= max; level++) {
      const tier = frogTiers[level - 1] ?? 0
      for (let t = 1; t <= tier; t++) {
        total += getEvolutionBonusPercent(level, t)
      }
    }
    return total
  })
  const evolutionTotalPct = Math.round(evolutionFraction * 1000) / 10
  const evolutionProgressPct = Math.min(
    100,
    (evolutionTotalPct / TOTAL_MAX_EVOLUTION_PCT) * 100,
  )
  const tempBuffPct = Math.round(tempFraction * 1000) / 10

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
            Доходы
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ff-tile w-9 h-9 text-lg flex-shrink-0"
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

        <div
          className="flex-1 overflow-y-auto ff-no-scrollbar px-4 py-4 space-y-4"
          style={{ color: '#365314' }}
        >
          {/* HERO — текущий доход */}
          <HeroIncome
            finalIncomePerSec={finalIncomePerSec}
            baseIncomePerSec={incomePerSec}
            multiplier={totalMultiplier}
          />

          {/* SOURCES */}
          <Section title="Источники">
            <Row
              emoji="🐸"
              label="Лягушки"
              value={`+${fmtRate(baseIncomeFromFrogs)}/сек`}
            />
            {l18AbsoluteBonusPerSec > 0 && (
              <Row
                emoji="👑"
                label="Капитан"
                value={`+${fmtRate(l18AbsoluteBonusPerSec)}/сек`}
              />
            )}
          </Section>

          {/* BUFF — show if active */}
          {tempFraction > 0 && temporaryIncomeBuff && (
            <Section title="Активный бафф">
              <TempBuffCard
                percent={tempBuffPct}
                remainingMs={temporaryIncomeBuff.until - now}
              />
            </Section>
          )}

          {/* EVOLUTION */}
          <Section
            title="Эволюция"
            rightLabel={`+${evolutionTotalPct.toString().replace(/\.0$/, '')}%`}
          >
            {evolutionTotalPct === 0 ? (
              <Hint text="Качай во вкладке «Лягушки» после открытия космоса." />
            ) : (
              <div className="ff-card p-3 flex flex-col gap-3">
                <ProgressBar
                  value={evolutionProgressPct}
                  label={`${evolutionTotalPct.toString().replace(/\.0$/, '')}% / ${TOTAL_MAX_EVOLUTION_PCT}%`}
                />
                <div className="flex flex-col gap-1.5">
                  {LOCATION_RANGES.map((_range, idx) => {
                    const total = evolutionByLocation[idx]
                    if (total === 0) return null
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between"
                      >
                        <span
                          className="ff-body text-sm font-bold"
                          style={{ color: '#365314' }}
                        >
                          {LOCATION_EMOJIS[idx]} {LOCATION_NAMES[idx]}
                        </span>
                        <span
                          className="ff-display text-sm tabular-nums"
                          style={{ color: '#15803d', fontWeight: 700 }}
                        >
                          +{total.toString().replace(/\.0$/, '')}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Section>

          {/* L18 MERGE COUNTER */}
          {l18MergesCount > 0 && (
            <Section title="L18+L18">
              <Row
                emoji="⚔️"
                label="Мерджей совершено"
                value={`${l18MergesCount}`}
              />
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function HeroIncome({
  finalIncomePerSec,
  baseIncomePerSec,
  multiplier,
}: {
  finalIncomePerSec: number
  baseIncomePerSec: number
  multiplier: number
}) {
  const hasMultiplier = multiplier > 1
  const multiplierStr = multiplier
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)',
        border: '3px solid #14532d',
        boxShadow:
          '0 0 0 2px rgba(255,255,255,0.18) inset, 0 4px 0 rgba(20,83,45,0.5)',
        color: '#fff',
        textShadow: '0 1px 0 rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="ff-display"
        style={{ fontSize: 13, letterSpacing: 1, opacity: 0.9 }}
      >
        ТЕКУЩИЙ ДОХОД
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span
          className="ff-display tabular-nums"
          style={{ fontSize: 36, lineHeight: 1 }}
        >
          +{fmtRate(finalIncomePerSec)}
        </span>
        <span className="ff-body" style={{ fontSize: 14, opacity: 0.9 }}>
          /сек
        </span>
      </div>
      {hasMultiplier && (
        <div
          className="ff-body mt-2 flex items-center gap-2"
          style={{ fontSize: 13, opacity: 0.92 }}
        >
          <span
            className="ff-display px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: '1px solid rgba(255,255,255,0.4)',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            ×{multiplierStr}
          </span>
          <span>База: {fmtRate(baseIncomePerSec)}/сек</span>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  rightLabel,
  children,
}: {
  title: string
  rightLabel?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <span
          className="ff-display"
          style={{
            fontSize: 14,
            color: '#15803d',
            letterSpacing: 0.5,
          }}
        >
          {title}
        </span>
        {rightLabel && (
          <span
            className="ff-display tabular-nums"
            style={{
              fontSize: 14,
              color: '#15803d',
              fontWeight: 700,
            }}
          >
            {rightLabel}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Row({
  emoji,
  label,
  value,
}: {
  emoji: string
  label: string
  value: string
}) {
  return (
    <div className="ff-card px-3 py-2.5 flex items-center gap-3">
      <span
        style={{
          fontSize: 24,
          filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))',
        }}
      >
        {emoji}
      </span>
      <span
        className="ff-body font-bold flex-1"
        style={{ fontSize: 14, color: '#365314' }}
      >
        {label}
      </span>
      <span
        className="ff-display tabular-nums whitespace-nowrap"
        style={{ fontSize: 15, color: '#15803d', fontWeight: 700 }}
      >
        {value}
      </span>
    </div>
  )
}

function TempBuffCard({
  percent,
  remainingMs,
}: {
  percent: number
  remainingMs: number
}) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: 'linear-gradient(180deg, #f3e8ff 0%, #d8b4fe 100%)',
        border: '3px solid #6d28d9',
        boxShadow: '0 0 0 2px #faf5ff inset',
        color: '#3b0764',
      }}
    >
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 28 }}>⏱</span>
        <div className="flex-1">
          <div
            className="ff-display tabular-nums leading-tight"
            style={{ fontSize: 22, color: '#6d28d9', fontWeight: 700 }}
          >
            +{percent.toString().replace(/\.0$/, '')}%
          </div>
          <div
            className="ff-body"
            style={{ fontSize: 12, color: '#581c87' }}
          >
            к доходу
          </div>
        </div>
        <div className="text-right">
          <div
            className="ff-body"
            style={{ fontSize: 11, color: '#6b21a8' }}
          >
            ОСТАЛОСЬ
          </div>
          <div
            className="ff-display tabular-nums"
            style={{ fontSize: 16, color: '#3b0764', fontWeight: 700 }}
          >
            {formatCountdown(remainingMs)}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgressBar({
  value,
  label,
}: {
  value: number
  label: string
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span
          className="ff-body"
          style={{ fontSize: 12, color: '#4d7c0f' }}
        >
          Прогресс
        </span>
        <span
          className="ff-body tabular-nums"
          style={{ fontSize: 12, color: '#15803d', fontWeight: 700 }}
        >
          {label}
        </span>
      </div>
      <div
        className="w-full h-3 rounded-full overflow-hidden"
        style={{
          background: '#dcfce7',
          border: '1px solid rgba(54,83,20,0.2)',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #15803d 0%, #16a34a 100%)',
            transition: 'width 300ms ease-out',
          }}
        />
      </div>
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return (
    <div
      className="ff-card p-3"
      style={{
        background: 'linear-gradient(180deg, #fefce8 0%, #fef9c3 100%)',
        borderStyle: 'dashed',
      }}
    >
      <div
        className="ff-body italic leading-snug"
        style={{ fontSize: 13, color: '#65a30d' }}
      >
        {text}
      </div>
    </div>
  )
}
