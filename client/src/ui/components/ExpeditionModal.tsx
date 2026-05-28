import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { useModalLock } from '../../utils/modalLock'
import { fmt } from '../../utils/formatting'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import {
  ELEMENT_TINT,
  ELEMENT_BOTTLE_FILTER,
} from '../../components/CosmicHub/ElementGrid'
import { getFrogPath, configForLevel } from '../../game/config/frogs'
import { ELEMENT_TINTS } from '../../game/effects/elements/elementTints'
import { TintedFrog } from './TintedFrog'

// Phaser-стиль multiply tint: (a * b) / 255 per channel. Для carrier-лягушки
// финальный цвет = level_tint × element_tint (как Phaser body.setTint MULTIPLY).
function multiplyTint(a: number, b: number): number {
  const ar = (a >> 16) & 0xff
  const ag = (a >> 8) & 0xff
  const ab = a & 0xff
  const br = (b >> 16) & 0xff
  const bg = (b >> 8) & 0xff
  const bb = b & 0xff
  const r = Math.floor((ar * br) / 255)
  const g = Math.floor((ag * bg) / 255)
  const bl = Math.floor((ab * bb) / 255)
  return (r << 16) | (g << 8) | bl
}
import {
  getActiveExpeditions,
  recallExpedition,
  continueExpedition,
  reviveExpedition,
  claimExpedition,
  getShips,
  type ExpeditionView,
  type ShipView,
} from '../../api/expedition'

type Props = { onClose: () => void }

// Real tempo: журнальные часы = реальное время полёта (00:07 = 7-я минута).
const DEMO_TEMPO = false

const PHASE_LABEL: Record<ExpeditionView['phase'], string> = {
  outbound: '🚀 В полёте',
  returning: '↩︎ Возвращается домой',
  arrived: '🛬 Пришвартовался',
  lost: '💀 Корабль потерян',
}

const CAT_COLOR: Record<string, string> = {
  loot: '#ffd24a',
  hazard: '#ff5d6c',
  departure: '#6ec1ff',
  arrival: '#6ec1ff',
  return: '#6ec1ff',
}

// Звёздные маршруты — редкость = цвет + сложность.
const ROUTE_RARITIES: {
  key: 'common' | 'rare' | 'epic'
  name: string
  tint: string
}[] = [
  { key: 'common', name: 'обычный', tint: '#94a3b8' },
  { key: 'rare', name: 'редкий', tint: '#60a5fa' },
  { key: 'epic', name: 'эпический', tint: '#c084fc' },
]

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

const isMoving = (e: ExpeditionView) =>
  e.phase === 'outbound' || e.phase === 'returning'

// Bold loot (+N) and damage (−N) amounts inside a report line so "what changed"
// stands out. Урон (−N) красим в красный, лут (+N) — жирным.
function highlightLoot(text: string): ReactNode[] {
  return text.split(/([+−]\d+)/g).map((part, i) => {
    if (/^\+\d+$/.test(part)) {
      return (
        <strong key={i} style={{ fontWeight: 800 }}>
          {part}
        </strong>
      )
    }
    if (/^−\d+$/.test(part)) {
      return (
        <strong key={i} style={{ fontWeight: 800, color: '#ff5d6c' }}>
          {part}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// Компактный слот инвентаря: иконка + бейдж + тултип по клику (подробности).
function InvSlot({
  icon,
  emoji,
  count,
  tint,
  filter,
  label,
}: {
  icon?: string
  emoji?: string
  count: number
  tint: string
  filter?: string
  label?: string
}) {
  const [tip, setTip] = useState(false)
  return (
    <div
      onClick={() => label && setTip((t) => !t)}
      style={{
        flexShrink: 0,
        width: 40,
        height: 44,
        borderRadius: 8,
        border: `2px solid ${tint}`,
        background: 'rgba(10,10,15,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: label ? 'pointer' : undefined,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: -5,
          right: -5,
          background: '#10b981',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          borderRadius: 99,
          minWidth: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 3px',
        }}
      >
        {fmt(count)}
      </span>
      {emoji ? (
        <span style={{ fontSize: 22 }}>{emoji}</span>
      ) : (
        <img
          src={icon}
          alt=""
          style={{ height: 24, width: 'auto', filter, pointerEvents: 'none' }}
        />
      )}
      {tip && label && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            setTip(false)
          }}
          style={{
            position: 'absolute',
            top: '112%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 180,
            maxWidth: '60vw',
            background: '#131a2e',
            color: '#e8ecf6',
            border: `1px solid ${tint}`,
            borderRadius: 8,
            padding: '7px 9px',
            fontSize: 11,
            lineHeight: 1.35,
            zIndex: 20,
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            pointerEvents: 'auto',
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

function ShipInventory({ loot }: { loot: ExpeditionView['loot'] }) {
  const serumSlots = ELEMENTS.filter((e) => (loot.serums[e] ?? 0) > 0)
  return (
    <div className="flex gap-1.5 overflow-x-auto flex-shrink-0">
      <InvSlot
        icon="/goo.svg"
        count={loot.gold}
        tint="#d9a441"
        label="💰 Золото — основная валюта (слизь). Тратится в магазинах и на прокачку."
      />
      {loot.mutagen > 0 && (
        <InvSlot
          emoji="🧬"
          count={loot.mutagen}
          tint="#a855f7"
          label="🧬 Мутаген — редкий космо-лут. Нужен для эволюции лягушек (вместе с эссенцией)."
        />
      )}
      {ROUTE_RARITIES.filter((r) => (loot.routes?.[r.key] ?? 0) > 0).map(
        (r) => (
          <InvSlot
            key={r.key}
            emoji="🗺️"
            count={loot.routes[r.key]}
            tint={r.tint}
            label={`🗺️ Звёздный маршрут (${r.name}) — это миссия. Редкость = сложность прохождения.`}
          />
        ),
      )}
      {serumSlots.map((e: Element) => (
        <InvSlot
          key={e}
          icon="/genBottle.svg"
          count={loot.serums[e]}
          tint={ELEMENT_TINT[e]}
          filter={ELEMENT_BOTTLE_FILTER[e]}
          label={`🧪 Сыворотка «${e}» — превращает лягушку в носителя стихии «${e}».`}
        />
      ))}
    </div>
  )
}

export function ExpeditionModal({ onClose }: Props) {
  useModalLock()
  const [closing, setClosing] = useState(false)
  const [ships, setShips] = useState<ShipView[]>([])
  const [exps, setExps] = useState<ExpeditionView[]>([])
  const [selectedShipId, setSelectedShipId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  // Журнал: авто-скролл только когда внизу; иначе кнопка «↓ новое».
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [hasNew, setHasNew] = useState(false)
  const prevLenRef = useRef(0)
  const prevShipRef = useRef<number | null>(null)

  // Снаряжение экипажа (React-блок в idle-ангаре): лягушки + анимация запуска.
  const locationFrogs = useGameStore((s) => s.locationFrogs)
  const carriers = useGameStore((s) => s.carriers)
  const [selectedCrew, setSelectedCrew] = useState<Set<number>>(new Set())
  const [launchPhase, setLaunchPhase] = useState<
    'idle' | 'boarding' | 'shaking' | 'liftoff'
  >('idle')
  const [launchKind, setLaunchKind] = useState<'mission' | 'cosmos' | null>(null)

  // Сброс выбора при смене корабля.
  useEffect(() => {
    setSelectedCrew(new Set())
    setLaunchPhase('idle')
    setLaunchKind(null)
  }, [selectedShipId])

  const selectedShip = ships.find((s) => s.id === selectedShipId) ?? null
  const activeExp = selectedShip?.activeExpeditionId
    ? (exps.find((e) => e.id === selectedShip.activeExpeditionId) ?? null)
    : null

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

  const refresh = useCallback(async () => {
    try {
      const [shipsRes, expsRes] = await Promise.all([
        getShips(),
        getActiveExpeditions(),
      ])
      setShips(shipsRes.ships)
      setExps(expsRes.expeditions)
      setSelectedShipId((prev) =>
        prev && shipsRes.ships.some((s) => s.id === prev)
          ? prev
          : (shipsRes.ships[0]?.id ?? null),
      )
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка связи с базой')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Poll + tick while any ship is in motion.
  useEffect(() => {
    if (!exps.some(isMoving)) return
    const poll = window.setInterval(() => void refresh(), 2500)
    const tick = window.setInterval(() => setNowTs(Date.now()), 1000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
  }, [exps, refresh])

  // When the selected ship's return is up, refresh to unlock claim.
  useEffect(() => {
    if (
      activeExp?.phase === 'returning' &&
      activeExp.arrivalAt &&
      new Date(activeExp.arrivalAt).getTime() <= nowTs
    ) {
      void refresh()
    }
  }, [activeExp, nowTs, refresh])


  // Оптимистично: мгновенно меняем фазу локально, сервер подтверждает/откат.
  const onRecall = () => {
    if (!activeExp || activeExp.phase !== 'outbound') return
    const id = activeExp.id
    const prev = exps
    const now = Date.now()
    const returnSec = activeExp.outboundSec / 3 // SYNC returnSpeedMultiplier
    setExps(
      exps.map((e) =>
        e.id === id
          ? {
              ...e,
              phase: 'returning' as const,
              recalledAt: new Date(now).toISOString(),
              arrivalAt: new Date(now + returnSec * 1000).toISOString(),
              canRecall: false,
              canClaim: false,
            }
          : e,
      ),
    )
    void recallExpedition(id)
      .then(() => refresh())
      .catch((e) => {
        setExps(prev)
        setError(e instanceof Error ? e.message : 'Не удалось отозвать')
      })
  }

  const onContinue = () => {
    if (!activeExp || activeExp.phase !== 'returning') return
    const id = activeExp.id
    const prev = exps
    const now = Date.now()
    const recalledMs = activeExp.recalledAt
      ? new Date(activeExp.recalledAt).getTime()
      : now
    const newStarted = new Date(
      new Date(activeExp.startedAt).getTime() + (now - recalledMs),
    ).toISOString()
    setExps(
      exps.map((e) =>
        e.id === id
          ? {
              ...e,
              phase: 'outbound' as const,
              startedAt: newStarted,
              recalledAt: null,
              arrivalAt: null,
              canRecall: true,
              canClaim: false,
            }
          : e,
      ),
    )
    void continueExpedition(id)
      .then(() => refresh())
      .catch((e) => {
        setExps(prev)
        setError(e instanceof Error ? e.message : 'Не удалось продолжить')
      })
  }

  const onRevive = async () => {
    if (!activeExp) return
    setBusy(true)
    try {
      await reviveExpedition(activeExp.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось воскресить')
    } finally {
      setBusy(false)
    }
  }

  const onClaim = async () => {
    if (!activeExp) return
    setBusy(true)
    try {
      const res = await claimExpedition(activeExp.id)
      // 2026-05-28: применяем лут в локальный store. Server-side роут
      // /claim уже добавил gold/serums/mutagen игроку в DB; раньше клиент
      // про это не знал — refresh() тянет только ships+expeditions, не
      // game state — и инвентарь продолжал показывать старые цифры до
      // следующего полного loadGameState. ClaimResp.loot — дельта (что
      // именно зачислено), мирорим её локально → состояние совпадает с DB.
      if (!res.shipLost) {
        const s = useGameStore.getState()
        if (res.loot.gold > 0) s.addGold(res.loot.gold)
        for (const [el, n] of Object.entries(res.loot.serums)) {
          if (n > 0) s.addSerum(el as Element, n)
        }
        if (res.loot.mutagen > 0) {
          useGameStore.setState((st) => ({
            mutagen: st.mutagen + res.loot.mutagen,
          }))
        }
      }
      const serums = Object.entries(res.loot.serums)
        .map(([k, v]) => `${k}×${v}`)
        .join(', ')
      const mut = res.loot.mutagen > 0 ? `, 🧬×${res.loot.mutagen}` : ''
      setClaimMsg(
        res.shipLost
          ? 'Корабль потерян — лут не доставлен.'
          : `Доставлено: ${res.loot.gold} золота${serums ? ', сыворотки: ' + serums : ''}${mut}.`,
      )
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось забрать лут')
    } finally {
      setBusy(false)
    }
  }

  const hpPct =
    activeExp && activeExp.maxHp > 0
      ? Math.round((activeExp.hp / activeExp.maxHp) * 100)
      : 0
  const hpColor = hpPct > 50 ? '#4ad295' : hpPct > 25 ? '#ffd24a' : '#ff5d6c'
  const returnMs = activeExp?.arrivalAt
    ? new Date(activeExp.arrivalAt).getTime() - nowTs
    : 0

  const elapsedSec = activeExp
    ? (nowTs - new Date(activeExp.startedAt).getTime()) / 1000
    : 0
  // Таймер полёта: тикает на outbound, замирает на возврате/прибытии (фиксируется
  // outboundSec на момент отзыва — возврат не «доливает» время полёта).
  const flightSec =
    activeExp && activeExp.phase === 'outbound'
      ? elapsedSec
      : (activeExp?.outboundSec ?? 0)
  const visibleJournal = activeExp
    ? activeExp.phase === 'arrived' || activeExp.phase === 'lost'
      ? activeExp.journal
      : activeExp.journal.filter((l) => l.revealSec <= elapsedSec)
    : []

  // Новое сообщение пока листаем вверх → показать «↓ новое». При смене корабля
  // сбрасываем (другой журнал).
  const visLen = visibleJournal.length
  useEffect(() => {
    if (prevShipRef.current !== selectedShipId) {
      prevShipRef.current = selectedShipId
      prevLenRef.current = visLen
      setHasNew(false)
      return
    }
    if (visLen > prevLenRef.current && !atBottom) setHasNew(true)
    prevLenRef.current = visLen
  }, [visLen, selectedShipId, atBottom])

  const jumpToBottom = () => {
    virtuosoRef.current?.scrollToIndex({
      index: Math.max(0, visLen - 1),
      behavior: 'smooth',
    })
    setHasNew(false)
  }

  return createPortal(
    <>
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        pointerEvents: 'auto',
        background: 'transparent',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad))',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 151,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          className={closing ? 'ff-slide-up' : 'ff-slide-down'}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            background: '#E8F5D2',
            border: '4px solid #4d6b1f',
            boxShadow: '0 0 0 3px #f7ffe0 inset',
          }}
        >
          {/* Header — табы кораблей слева + закрыть справа (без заголовка). */}
          <div
            className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0"
            style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
          >
            <div
              className="flex-1 flex items-center gap-1.5 overflow-x-auto"
              style={{ pointerEvents: 'auto' }}
            >
              {!loading &&
                ships.map((s) => {
                  const e = s.activeExpeditionId
                    ? exps.find((x) => x.id === s.activeExpeditionId)
                    : null
                  const icon = e
                    ? e.phase === 'lost'
                      ? '💀'
                      : e.phase === 'returning'
                        ? '↩︎'
                        : e.phase === 'arrived'
                          ? '🛬'
                          : '🚀'
                    : '🛠'
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedShipId(s.id)}
                      className={`ff-btn text-xs py-2 px-3 flex-shrink-0 ${
                        s.id === selectedShipId ? 'ff-btn-green' : 'ff-btn-grey'
                      }`}
                    >
                      {icon} {s.name}
                    </button>
                  )
                })}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Закрыть"
              className="ff-tile w-10 h-10 text-xl flex-shrink-0"
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

          {/* Body */}
          <div className="flex-1 flex flex-col min-h-0 px-3 py-2 gap-2">
            {loading && (
              <p className="text-center text-[#3a5214]">Связь с базой…</p>
            )}

            {error && !loading && (
              <div className="text-center text-red-700 text-sm">
                {error}
                <div>
                  <button
                    className="ff-btn ff-btn-grey mt-2 px-4 py-1 text-sm"
                    onClick={() => void refresh()}
                  >
                    Повторить
                  </button>
                </div>
              </div>
            )}

            {/* No ships → buy prompt */}
            {!loading && ships.length === 0 && !error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                <div className="text-6xl">🚀</div>
                <p className="text-[#3a5214] text-sm max-w-[260px]">
                  У тебя пока нет космического корабля. Купи его в магазине
                  прокачки → вкладка «🚀 Космос» (откроется после Леса).
                </p>
              </div>
            )}

            {/* Idle ангар — React-блок: корабль + лягушки + запуск (с анимацией). */}
            {!loading && selectedShip && !activeExp && (
              <ShipDeckBlock
                ship={selectedShip}
                locationFrogs={locationFrogs}
                carriers={carriers}
                selectedCrew={selectedCrew}
                setSelectedCrew={setSelectedCrew}
                launchPhase={launchPhase}
                setLaunchPhase={setLaunchPhase}
                launchKind={launchKind}
                setLaunchKind={setLaunchKind}
                onClose={handleClose}
                busy={busy}
              />
            )}

            {/* Flying ship → expedition view */}
            {!loading && selectedShip && activeExp && (
              <>
                {claimMsg && (
                  <p className="text-[#2f7d32] font-semibold text-xs text-center flex-shrink-0">
                    {claimMsg}
                  </p>
                )}

                {/* Компактная шапка: фаза · таймер · HP, ниже — HP-бар + лут */}
                <div className="flex items-center justify-between flex-shrink-0">
                  <span className="font-semibold text-sm text-[#3a5214]">
                    {PHASE_LABEL[activeExp.phase]}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-[#5a7a2a] tabular-nums">
                    <span>⏱ {fmtCountdown(flightSec * 1000)}</span>
                    <span>
                      ❤️ {activeExp.hp}/{activeExp.maxHp}
                    </span>
                  </span>
                </div>

                {/* HP бар */}
                <div
                  className="flex-shrink-0"
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: '#cbe0a0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${hpPct}%`,
                      height: '100%',
                      transition: 'width .3s',
                      background: hpColor,
                    }}
                  />
                </div>

                {/* Инвентарь — компактная строка тайлов */}
                <ShipInventory loot={activeExp.loot} />

                {/* Journal — виртуализирован (react-virtuoso) */}
                <div
                  className="flex-1 min-h-0"
                  style={{
                    position: 'relative',
                    background:
                      'radial-gradient(ellipse at top,#0f3d18,#072810)',
                    border: '2px solid #1f5a2a',
                    borderRadius: 6,
                    overflow: 'hidden',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <Virtuoso
                    key={selectedShipId ?? 0}
                    ref={virtuosoRef}
                    style={{ height: '100%' }}
                    data={visibleJournal}
                    followOutput="auto"
                    atBottomStateChange={(b) => {
                      setAtBottom(b)
                      if (b) setHasNew(false)
                    }}
                    initialTopMostItemIndex={Math.max(
                      0,
                      visibleJournal.length - 1,
                    )}
                    components={{
                      Header: () => <div style={{ height: 8 }} />,
                      // Отступ снизу ≈ высота одного сообщения: новое сообщение
                      // появляется с воздухом под ним, не впритык к краю.
                      Footer: () => <div style={{ height: 28 }} />,
                    }}
                    itemContent={(_i, l) => (
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          padding: '1px 12px',
                          color: CAT_COLOR[l.category] ?? '#7CFC7C',
                        }}
                      >
                        <span
                          style={{
                            opacity: 0.7,
                            flexShrink: 0,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {l.time}
                        </span>
                        <span>{highlightLoot(l.text)}</span>
                      </div>
                    )}
                  />
                  {hasNew && !atBottom && (
                    <button
                      onClick={jumpToBottom}
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#4ad295',
                        color: '#06240f',
                        border: 'none',
                        borderRadius: 999,
                        padding: '5px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                      }}
                    >
                      ↓ Новое сообщение
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div
                  className="flex gap-2 flex-shrink-0"
                  style={{ marginTop: -2 }}
                >
                  {activeExp.canRecall && (
                    <button
                      className="ff-btn ff-btn-grey flex-1 py-2 text-sm"
                      onClick={() => onRecall()}
                    >
                      ↩︎ Вернуться
                    </button>
                  )}
                  {activeExp.phase === 'returning' && !activeExp.canClaim && (
                    <button
                      className="ff-btn ff-btn-green flex-1 py-2 text-sm"
                      onClick={() => onContinue()}
                      title="Отменить возврат и лететь дальше"
                    >
                      🚀 Продолжить ({fmtCountdown(returnMs)} до базы)
                    </button>
                  )}
                  {activeExp.canRevive && (
                    <>
                      <button
                        className="ff-btn ff-btn-green flex-1 py-2 text-sm"
                        disabled={busy}
                        onClick={() => void onRevive()}
                      >
                        🔧 Воскресить ({fmt(activeExp.reviveCost)})
                      </button>
                      <button
                        className="ff-btn ff-btn-red flex-1 py-2 text-sm"
                        disabled={busy}
                        onClick={() => void onClaim()}
                      >
                        Принять потерю
                      </button>
                    </>
                  )}
                  {activeExp.canClaim && !activeExp.canRevive && (
                    <button
                      className="ff-btn ff-btn-green flex-1 py-2 text-sm"
                      disabled={busy}
                      onClick={() => void onClaim()}
                    >
                      📦 Забрать лут
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    </>,
    document.body,
  )
}

// ─── Снаряжение экипажа: корабль + сетка лягушек + анимация запуска ─────────

interface ShipDeckBlockProps {
  ship: ShipView
  locationFrogs: number[][]
  carriers: ReadonlyArray<{ frogId: string; element: Element; level: number }>
  selectedCrew: Set<number>
  setSelectedCrew: (next: Set<number>) => void
  launchPhase: 'idle' | 'boarding' | 'shaking' | 'liftoff'
  setLaunchPhase: (p: 'idle' | 'boarding' | 'shaking' | 'liftoff') => void
  launchKind: 'mission' | 'cosmos' | null
  setLaunchKind: (k: 'mission' | 'cosmos' | null) => void
  onClose: () => void
  busy: boolean
}

const MAX_CREW = 6

function ShipDeckBlock(props: ShipDeckBlockProps) {
  const {
    ship,
    locationFrogs,
    carriers,
    selectedCrew,
    setSelectedCrew,
    launchPhase,
    setLaunchPhase,
    launchKind,
    setLaunchKind,
    onClose,
    busy,
  } = props

  // Лягушки текущего корабля + jitter раскладки (стабильный per-frog seed).
  const frogList = useMemo(() => {
    const minL = (ship.id - 1) * 6 + 1
    const maxL = ship.id * 6
    const all = locationFrogs[ship.id - 1] ?? []
    const poolByLevel = new Map<number, Element[]>()
    for (const c of carriers) {
      const lvl = c.level ?? 1
      if (lvl < minL || lvl > maxL) continue
      const arr = poolByLevel.get(lvl) ?? []
      arr.push(c.element)
      poolByLevel.set(lvl, arr)
    }
    return all
      .filter((lvl) => lvl >= minL && lvl <= maxL)
      .map((lvl) => {
        const pool = poolByLevel.get(lvl)
        const element = pool && pool.length ? pool.shift() : undefined
        return { level: lvl, element }
      })
  }, [ship.id, locationFrogs, carriers])

  // Refs на DOM лягушек и корабль — для анимации «запрыгивания».
  const shipRef = useRef<HTMLDivElement>(null)
  const frogRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const canLaunch = selectedCrew.size >= 1 && launchPhase === 'idle' && !busy

  const toggle = (idx: number) => {
    if (launchPhase !== 'idle') return
    const next = new Set(selectedCrew)
    if (next.has(idx)) next.delete(idx)
    else if (next.size < MAX_CREW) next.add(idx)
    setSelectedCrew(next)
  }

  const startLaunch = (kind: 'mission' | 'cosmos') => {
    if (!canLaunch) return
    setLaunchKind(kind)
    setLaunchPhase('boarding')
  }

  // Анимация запуска: boarding (350мс на лягушку с интервалом) → shake (360мс) → liftoff (750мс).
  useEffect(() => {
    if (launchPhase !== 'boarding') return
    const ids = [...selectedCrew]
    const totalBoardMs = ids.length * 160 + 350
    const t = window.setTimeout(() => setLaunchPhase('shaking'), totalBoardMs)
    return () => window.clearTimeout(t)
  }, [launchPhase, selectedCrew])

  useEffect(() => {
    if (launchPhase !== 'shaking') return
    const t = window.setTimeout(() => setLaunchPhase('liftoff'), 360)
    return () => window.clearTimeout(t)
  }, [launchPhase, setLaunchPhase])

  useEffect(() => {
    if (launchPhase !== 'liftoff') return
    const t = window.setTimeout(() => {
      // Эмитим событие запуска и закрываем модалку.
      const crew = [...selectedCrew].map((i) => frogList[i].level)
      if (launchKind === 'mission') {
        eventBus.emit('survivor:choose-mission', { crew, shipId: ship.id })
      } else if (launchKind === 'cosmos') {
        eventBus.emit('shipdeck:launch', { shipId: ship.id, crew, demo: DEMO_TEMPO })
      }
      onClose()
    }, 750)
    return () => window.clearTimeout(t)
  }, [launchPhase, selectedCrew, launchKind, frogList, ship.id, onClose])

  // Стиль корабля по фазе (тряска / взлёт).
  const shipAnim =
    launchPhase === 'shaking'
      ? 'ff-ship-shake 60ms linear 6 alternate'
      : undefined
  const shipTransform =
    launchPhase === 'liftoff' ? 'translateY(-120vh) scale(1.18)' : undefined

  return (
    <div
      className="flex-1 flex flex-col gap-2 px-3 py-3 overflow-hidden"
      style={{ position: 'relative' }}
    >
      <div className="flex items-center justify-between text-sm flex-shrink-0">
        <span className="font-semibold text-[#3a5214]">
          🛠 {ship.name} — в ангаре
        </span>
        <span className="text-[#5a7a2a]">❤️ {ship.maxHp} HP</span>
      </div>

      {/* Корабль в центре. */}
      <div
        ref={shipRef}
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 8,
          transition:
            launchPhase === 'liftoff'
              ? 'transform 750ms cubic-bezier(.55,.06,.68,.19)'
              : undefined,
          transform: shipTransform,
          animation: shipAnim,
        }}
      >
        <img
          src="/spaceShip.webp"
          alt="ship"
          style={{ width: 'min(40vw, 160px)', height: 'auto', pointerEvents: 'none' }}
        />
      </div>

      <div className="text-center text-xs text-[#5a7a2a] flex-shrink-0">
        Экипаж: {selectedCrew.size}/{MAX_CREW}
      </div>

      {/* Сетка лягушек (с jitter). Скрываем после liftoff. */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          justifyItems: 'center',
          alignContent: 'flex-start',
          padding: 6,
          overflow: 'hidden',
          opacity: launchPhase === 'liftoff' ? 0 : 1,
          transition: 'opacity 250ms',
        }}
      >
        {frogList.length === 0 && (
          <div className="text-xs text-[#5a7a2a] py-4 self-center">
            Нет лягушек L{(ship.id - 1) * 6 + 1}–L{ship.id * 6} для этого корабля
          </div>
        )}
        {frogList.map((entry, idx) => {
          const sel = selectedCrew.has(idx)
          const tint = entry.element ? ELEMENT_TINT[entry.element] : 'transparent'
          // boarding: летим к кораблю. delay по порядку выбора.
          let boardStyle: React.CSSProperties = {}
          if (sel && launchPhase !== 'idle') {
            const order = [...selectedCrew].indexOf(idx)
            // Вычисляем смещение к кораблю.
            const frogEl = frogRefs.current.get(idx)
            const shipEl = shipRef.current
            if (frogEl && shipEl) {
              const fr = frogEl.getBoundingClientRect()
              const sr = shipEl.getBoundingClientRect()
              const dx = sr.left + sr.width / 2 - (fr.left + fr.width / 2)
              const dy = sr.top + sr.height / 2 - (fr.top + fr.height / 2)
              boardStyle = {
                transform: `translate(${dx}px, ${dy}px) scale(0.1)`,
                opacity: 0,
                transition: `transform 320ms cubic-bezier(.55,.06,.68,.19) ${order * 160}ms, opacity 200ms ${order * 160 + 120}ms`,
              }
            }
          }
          return (
            <div
              key={idx}
              ref={(el) => {
                if (el) frogRefs.current.set(idx, el)
                else frogRefs.current.delete(idx)
              }}
              onClick={() => toggle(idx)}
              style={{
                width: 52,
                height: 60,
                borderRadius: 10,
                border: sel
                  ? '3px solid #16a34a'
                  : entry.element
                    ? `3px solid ${tint}`
                    : '2px solid rgba(77,107,31,0.4)',
                background: entry.element ? `${tint}22` : 'rgba(255,255,255,0.4)',
                transform: sel ? 'scale(1.05)' : undefined,
                transition: 'border-color .12s, transform .12s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: launchPhase === 'idle' ? 'pointer' : 'default',
                padding: 4,
                ...boardStyle,
              }}
            >
              {/* Tinted SVG: replace #ffffff → level_tint (× element_tint multiply
                  если носитель). Сохраняет внутренние детали (короны/узоры/маски). */}
              <TintedFrog
                path={getFrogPath(entry.level, 0)}
                tint={
                  entry.element
                    ? multiplyTint(
                        configForLevel(entry.level).tint,
                        ELEMENT_TINTS[entry.element],
                      )
                    : configForLevel(entry.level).tint
                }
                alt={`L${entry.level}`}
                style={{ height: 40, width: 'auto', pointerEvents: 'none' }}
              />
            </div>
          )
        })}
      </div>

      {/* Кнопки запуска. */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          className={`ff-btn flex-1 py-3 text-sm ${canLaunch ? 'ff-btn-red' : 'ff-btn-grey'}`}
          disabled={!canLaunch}
          onClick={() => startLaunch('mission')}
        >
          ⚔️ На миссию
        </button>
        <button
          className={`ff-btn flex-1 py-3 text-sm ${canLaunch ? 'ff-btn-green' : 'ff-btn-grey'}`}
          disabled={!canLaunch}
          onClick={() => startLaunch('cosmos')}
        >
          🚀 В космос
        </button>
      </div>
    </div>
  )
}
