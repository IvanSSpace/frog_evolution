// 2026-05-23: Переделано — раньше это был bestiary collection, теперь —
// подробный breakdown источников дохода. Показывает игроку откуда у него
// доход и какие активные эффекты применены.

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

const TOTAL_MAX_EVOLUTION_PCT = 200 // см. evolution.ts BONUS_PERCENT sum

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

  const evolutionRows: Array<{ level: number; tier: number; pct: number }> = []
  for (let level = 1; level <= 18; level++) {
    const tier = frogTiers[level - 1] ?? 0
    for (let t = 1; t <= tier; t++) {
      evolutionRows.push({
        level,
        tier: t,
        pct: getEvolutionBonusPercent(level, t),
      })
    }
  }
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
          className="flex-1 overflow-y-auto ff-no-scrollbar px-4 py-4 space-y-3"
          style={{ color: '#365314' }}
        >
          {/* HERO — общий доход */}
          <HeroIncome
            finalIncomePerSec={finalIncomePerSec}
            baseIncomePerSec={incomePerSec}
            multiplier={totalMultiplier}
          />

          {/* SOURCES grid */}
          <SectionHeader emoji="🐸" title="Источники дохода" />
          <div className="grid grid-cols-1 gap-2">
            <StatTile
              emoji="🐸"
              label="Лягушки на поле"
              value={`+${fmtRate(baseIncomeFromFrogs)}/сек`}
            />
            {l18AbsoluteBonusPerSec > 0 && (
              <StatTile
                emoji="👑"
                label="Капитан"
                value={`+${fmtRate(l18AbsoluteBonusPerSec)}/сек`}
                hint="Постоянная награда за 1-й L18+L18 (= 2× дохода L18-лягушки)"
                accentBg="linear-gradient(180deg, #fef3c7 0%, #fcd34d 100%)"
                accentBorder="#b45309"
              />
            )}
          </div>

          {/* ACTIVE EFFECTS */}
          <SectionHeader emoji="⏱" title="Активные эффекты" />
          {tempFraction > 0 && temporaryIncomeBuff ? (
            <TempBuffCard
              percent={tempBuffPct}
              remainingMs={temporaryIncomeBuff.until - now}
            />
          ) : (
            <EmptyHint text="Нет активных эффектов. Слей две лягушки 18-го уровня — получишь 6-часовой бафф к доходу." />
          )}

          {/* EVOLUTION */}
          <SectionHeader
            emoji="🧬"
            title="Эволюция"
            rightLabel={
              evolutionTotalPct > 0
                ? `+${evolutionTotalPct.toString().replace(/\.0$/, '')}%`
                : '+0%'
            }
            rightAccent="#15803d"
          />
          {evolutionRows.length === 0 ? (
            <EmptyHint text="Эволюция не прокачана. Открой космос (L18+L18) и качай во вкладке «Лягушки»." />
          ) : (
            <div className="ff-card p-3">
              <ProgressBar
                value={evolutionProgressPct}
                color="#15803d"
                bg="#dcfce7"
                label={`${evolutionTotalPct.toString().replace(/\.0$/, '')}% / ${TOTAL_MAX_EVOLUTION_PCT}%`}
              />
              <div className="mt-3 flex flex-col gap-2">
                {LOCATION_RANGES.map(([min, max], idx) => {
                  const rows = evolutionRows.filter(
                    (r) => r.level >= min && r.level <= max,
                  )
                  if (rows.length === 0) return null
                  const locTotal = rows.reduce((sum, r) => sum + r.pct, 0)
                  return (
                    <div key={idx}>
                      <div
                        className="flex items-center justify-between mb-1"
                        style={{ color: '#15803d' }}
                      >
                        <span
                          className="ff-display text-xs"
                          style={{ letterSpacing: 0.5 }}
                        >
                          {LOCATION_EMOJIS[idx]} {LOCATION_NAMES[idx]}
                        </span>
                        <span
                          className="ff-body text-xs"
                          style={{ fontWeight: 700 }}
                        >
                          +{locTotal.toString().replace(/\.0$/, '')}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {rows.map((r) => (
                          <EvolutionPill
                            key={`${r.level}_${r.tier}`}
                            level={r.level}
                            tier={r.tier}
                            pct={r.pct}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* L18 MERGE COUNTER */}
          {l18MergesCount > 0 && (
            <>
              <SectionHeader emoji="⚔️" title="L18+L18 merges" />
              <StatTile
                emoji="⚔️"
                label="Совершено мерджей"
                value={`${l18MergesCount}`}
                hint="Каждый merge даёт +1 эссенцию и 6-часовой бафф к доходу."
              />
            </>
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
    .toFixed(3)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #166534 0%, #15803d 45%, #166534 100%)',
        border: '3px solid #14532d',
        boxShadow:
          '0 0 0 2px rgba(255,255,255,0.18) inset, 0 4px 0 rgba(20,83,45,0.5)',
        color: '#fff',
        textShadow: '0 1px 0 rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="ff-display text-xs"
          style={{ letterSpacing: 1, opacity: 0.9 }}
        >
          ТЕКУЩИЙ ДОХОД
        </span>
        {hasMultiplier && (
          <span
            className="ff-body text-[11px] px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.28)',
              border: '1px solid rgba(255,255,255,0.45)',
              fontWeight: 700,
            }}
          >
            ×{multiplierStr}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="ff-display tabular-nums"
          style={{
            fontSize: 32,
            lineHeight: 1.05,
          }}
        >
          +{fmtRate(finalIncomePerSec)}
        </span>
        <span className="ff-body text-sm" style={{ opacity: 0.85 }}>
          слизь/сек
        </span>
      </div>
      {hasMultiplier && (
        <div
          className="ff-body text-[11px] mt-1"
          style={{ opacity: 0.85 }}
        >
          База: {fmtRate(baseIncomePerSec)}/сек
        </div>
      )}
    </div>
  )
}

function SectionHeader({
  emoji,
  title,
  rightLabel,
  rightAccent,
}: {
  emoji: string
  title: string
  rightLabel?: string
  rightAccent?: string
}) {
  return (
    <div className="flex items-center justify-between mt-1 mb-1">
      <span
        className="ff-display text-sm flex items-center gap-1.5"
        style={{ color: '#15803d', letterSpacing: 0.8 }}
      >
        <span style={{ fontSize: 16 }}>{emoji}</span>
        {title.toUpperCase()}
      </span>
      {rightLabel && (
        <span
          className="ff-body text-sm tabular-nums"
          style={{ color: rightAccent ?? '#15803d', fontWeight: 700 }}
        >
          {rightLabel}
        </span>
      )}
    </div>
  )
}

function StatTile({
  emoji,
  label,
  value,
  hint,
  accentBg,
  accentBorder,
}: {
  emoji: string
  label: string
  value: string
  hint?: string
  accentBg?: string
  accentBorder?: string
}) {
  return (
    <div
      className="ff-card p-2.5 flex items-center gap-2.5"
      style={
        accentBg
          ? {
              background: accentBg,
              borderColor: accentBorder ?? '#7c5c2a',
            }
          : undefined
      }
    >
      <div
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl"
        style={{
          background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
          border: '2px solid #4d7c0f',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
          fontSize: 22,
        }}
      >
        <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>
          {emoji}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="ff-body text-xs font-bold"
            style={{ color: '#365314' }}
          >
            {label}
          </span>
          <span
            className="ff-display text-sm tabular-nums whitespace-nowrap"
            style={{ color: '#15803d', fontWeight: 700 }}
          >
            {value}
          </span>
        </div>
        {hint && (
          <div
            className="ff-body text-[10px] mt-0.5 leading-tight"
            style={{ color: '#4d7c0f' }}
          >
            {hint}
          </div>
        )}
      </div>
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
      className="rounded-2xl p-3 relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #f3e8ff 0%, #d8b4fe 100%)',
        border: '3px solid #6d28d9',
        boxShadow:
          '0 0 0 2px #faf5ff inset, 0 0 12px rgba(168,85,247,0.35)',
        color: '#3b0764',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl"
          style={{
            background: 'linear-gradient(180deg, #ede9fe 0%, #c4b5fd 100%)',
            border: '2px solid #6d28d9',
            fontSize: 26,
          }}
        >
          ⏱
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="ff-display text-sm"
            style={{ color: '#581c87', letterSpacing: 0.3 }}
          >
            Бафф к доходу
          </div>
          <div
            className="ff-display text-2xl tabular-nums leading-tight"
            style={{ color: '#6d28d9', fontWeight: 700 }}
          >
            +{percent.toString().replace(/\.0$/, '')}%
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div
            className="ff-body text-[10px]"
            style={{ color: '#6b21a8' }}
          >
            ОСТАЛОСЬ
          </div>
          <div
            className="ff-display text-base tabular-nums"
            style={{ color: '#3b0764', fontWeight: 700 }}
          >
            {formatCountdown(remainingMs)}
          </div>
        </div>
      </div>
    </div>
  )
}

function EvolutionPill({
  level,
  tier,
  pct,
}: {
  level: number
  tier: number
  pct: number
}) {
  return (
    <span
      className="ff-body text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
      style={{
        background: tier === 2 ? '#a7f3d0' : '#dcfce7',
        border: `1px solid ${tier === 2 ? '#15803d' : '#4d7c0f'}`,
        color: '#15803d',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      L{level}·t{tier}
      <span style={{ color: '#365314', fontWeight: 800 }}>+{pct}%</span>
    </span>
  )
}

function ProgressBar({
  value,
  color,
  bg,
  label,
}: {
  value: number
  color: string
  bg: string
  label: string
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="ff-body text-[10px]" style={{ color: '#4d7c0f' }}>
          ПРОГРЕСС
        </span>
        <span
          className="ff-body text-[10px] tabular-nums"
          style={{ color: '#15803d', fontWeight: 700 }}
        >
          {label}
        </span>
      </div>
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: bg, border: '1px solid rgba(54,83,20,0.2)' }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
            transition: 'width 300ms ease-out',
          }}
        />
      </div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      className="ff-card p-3 text-center"
      style={{
        background: 'linear-gradient(180deg, #fefce8 0%, #fef9c3 100%)',
        borderStyle: 'dashed',
      }}
    >
      <div
        className="ff-body text-xs italic leading-snug"
        style={{ color: '#65a30d' }}
      >
        {text}
      </div>
    </div>
  )
}
