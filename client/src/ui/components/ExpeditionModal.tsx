import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Virtuoso } from 'react-virtuoso'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { useModalLock } from '../../utils/modalLock'
import { fmt } from '../../utils/formatting'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import {
  ELEMENT_TINT,
  ELEMENT_BOTTLE_FILTER,
} from '../../components/CosmicHub/ElementGrid'
import {
  getActiveExpeditions,
  recallExpedition,
  continueExpedition,
  claimExpedition,
  getShips,
  upgradeShip,
  type ExpeditionView,
  type ShipView,
  type ShipUpg,
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

// SYNC с server/src/expedition/config.ts (SHIP_UPG_COSTS / SHIP_UPG_MAX).
// Нужно для оптимистичного апгрейда (мгновенный UI без round-trip).
const SHIP_UPG_MAX = 5
const SHIP_UPG_COSTS = [50_000, 200_000, 800_000, 3_200_000, 12_800_000]
const SHIP_UPG_KEYS: (keyof ShipUpg)[] = [
  'corpus',
  'armor',
  'engine',
  'scanner',
]
function upgCostsFor(upg: ShipUpg): Record<string, number | null> {
  return Object.fromEntries(
    SHIP_UPG_KEYS.map((k) => [
      k,
      upg[k] >= SHIP_UPG_MAX ? null : SHIP_UPG_COSTS[upg[k]],
    ]),
  )
}

// Per-ship upgrade stats — player-facing meta.
const STAT_META: {
  key: keyof ShipUpg
  icon: string
  name: string
  desc: string
}[] = [
  { key: 'corpus', icon: '❤️', name: 'Корпус', desc: 'Прочность (макс HP)' },
  { key: 'armor', icon: '🛡', name: 'Броня', desc: 'Меньше урона и риска' },
  { key: 'engine', icon: '⚡', name: 'Двигатель', desc: 'Больше золота' },
  { key: 'scanner', icon: '🍀', name: 'Сканер', desc: 'Больше находок' },
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

// Bold the loot amount (+N) inside a report line so "what we got" stands out.
function highlightLoot(text: string): ReactNode[] {
  return text.split(/(\+\d+)/g).map((part, i) =>
    /^\+\d+$/.test(part) ? (
      <strong key={i} style={{ fontWeight: 800 }}>
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

function InvSlot({
  icon,
  count,
  tint,
  filter,
}: {
  icon: string
  count: number
  tint: string
  filter?: string
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        width: 52,
        height: 60,
        borderRadius: 10,
        border: `2px solid ${tint}`,
        background: 'rgba(10,10,15,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          background: '#10b981',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          borderRadius: 99,
          minWidth: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
        }}
      >
        {fmt(count)}
      </span>
      <img
        src={icon}
        alt=""
        style={{ height: 30, width: 'auto', filter, pointerEvents: 'none' }}
      />
    </div>
  )
}

function ShipInventory({ loot }: { loot: ExpeditionView['loot'] }) {
  const serumSlots = ELEMENTS.filter((e) => (loot.serums[e] ?? 0) > 0)
  return (
    <div className="flex-shrink-0">
      <div className="text-[11px] text-[#5a7a2a] mb-1">🎒 Инвентарь</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <InvSlot icon="/goo.svg" count={loot.gold} tint="#d9a441" />
        {serumSlots.map((e: Element) => (
          <InvSlot
            key={e}
            icon="/genBottle.svg"
            count={loot.serums[e]}
            tint={ELEMENT_TINT[e]}
            filter={ELEMENT_BOTTLE_FILTER[e]}
          />
        ))}
      </div>
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

  const gold = useGameStore((s) => s.gold)

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

  // Снаряжение: уходим в Phaser-сцену (выбор экипажа + анимация запуска).
  // Закрываем модалку, чтобы сцена была видна; App переоткроет на launch/cancel.
  const openDeck = (ship: ShipView) => {
    const minL = (ship.id - 1) * 6 + 1
    const maxL = ship.id * 6
    eventBus.emit('shipdeck:open', {
      shipId: ship.id,
      location: ship.id,
      minL,
      maxL,
      demo: DEMO_TEMPO,
    })
    handleClose()
  }

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

  const onClaim = async () => {
    if (!activeExp) return
    setBusy(true)
    try {
      const res = await claimExpedition(activeExp.id)
      const serums = Object.entries(res.loot.serums)
        .map(([k, v]) => `${k}×${v}`)
        .join(', ')
      setClaimMsg(
        res.shipLost
          ? 'Корабль потерян — лут не доставлен.'
          : `Доставлено: ${res.loot.gold} золота${serums ? ', слизь: ' + serums : ''}.`,
      )
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось забрать лут')
    } finally {
      setBusy(false)
    }
  }

  // Оптимистичный апгрейд: мгновенно бампаем уровень/HP/цену/голд, сервер
  // подтверждает (синхрон голда) или откат при ошибке. Без refresh → без лага.
  const onUpgrade = (shipId: number, stat: keyof ShipUpg) => {
    const ship = ships.find((s) => s.id === shipId)
    if (!ship) return
    const cost = ship.upgCosts[stat]
    if (cost == null || gold < cost) return

    const prevShips = ships
    const prevGold = gold
    const nextUpg = { ...ship.upg, [stat]: ship.upg[stat] + 1 }
    const optimistic: ShipView = {
      ...ship,
      upg: nextUpg,
      maxHp: 100 + nextUpg.corpus * 40, // SYNC deriveShip (без экипажа)
      upgCosts: upgCostsFor(nextUpg),
    }
    setShips(ships.map((s) => (s.id === shipId ? optimistic : s)))
    useGameStore.setState({ gold: prevGold - cost })

    void upgradeShip(shipId, stat)
      .then((res) => {
        useGameStore.setState({ gold: Number(res.gold) })
      })
      .catch((e) => {
        setShips(prevShips)
        useGameStore.setState({ gold: prevGold })
        setError(e instanceof Error ? e.message : 'Не удалось улучшить')
      })
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

  return createPortal(
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
          bottom: 'env(safe-area-inset-bottom, 0px)',
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
            background: 'linear-gradient(180deg, #f5fbe9 0%, #d9eeb6 100%)',
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
          <div className="flex-1 flex flex-col min-h-0 px-3 py-3 gap-3">
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

            {/* Idle ship → stats + upgrades + launch */}
            {!loading && selectedShip && !activeExp && (
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
                {claimMsg && (
                  <p className="text-[#2f7d32] font-semibold text-xs text-center">
                    {claimMsg}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm flex-shrink-0">
                  <span className="font-semibold text-[#3a5214]">
                    🛠 {selectedShip.name} — в ангаре
                  </span>
                  <span className="text-[#5a7a2a]">
                    ❤️ {selectedShip.maxHp} HP
                  </span>
                </div>

                {STAT_META.map((m) => {
                  const lvl = selectedShip.upg[m.key]
                  const cost = selectedShip.upgCosts[m.key]
                  const isMax = cost === null
                  const canAfford = !isMax && gold >= (cost ?? 0)
                  return (
                    <div
                      key={m.key}
                      className="ff-card p-3 flex items-center gap-3"
                    >
                      <div className="text-2xl flex-shrink-0">{m.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="ff-display text-sm text-emerald-900 leading-tight">
                          {m.name}{' '}
                          <span className="text-emerald-700">
                            ур.{lvl}/{selectedShip.maxUpg}
                          </span>
                        </div>
                        <div className="ff-body text-[11px] text-emerald-800">
                          {m.desc}
                        </div>
                      </div>
                      <button
                        onClick={() => void onUpgrade(selectedShip.id, m.key)}
                        disabled={isMax || !canAfford || busy}
                        className={`ff-btn text-xs ${
                          isMax
                            ? 'ff-btn-grey'
                            : canAfford
                              ? 'ff-btn-green'
                              : 'ff-btn-red'
                        }`}
                      >
                        {isMax ? (
                          'макс'
                        ) : (
                          <>
                            {fmt(cost ?? 0)}{' '}
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
                })}

                <button
                  className="ff-btn ff-btn-green py-3 text-base flex-shrink-0 mt-1"
                  disabled={busy}
                  onClick={() => openDeck(selectedShip)}
                >
                  {busy ? 'Запуск…' : '🚀 Снарядить экипаж'}
                </button>
              </div>
            )}

            {/* Flying ship → expedition view */}
            {!loading && selectedShip && activeExp && (
              <>
                {claimMsg && (
                  <p className="text-[#2f7d32] font-semibold text-xs text-center flex-shrink-0">
                    {claimMsg}
                  </p>
                )}

                {/* HP */}
                <div className="flex-shrink-0">
                  <div className="flex justify-between text-[11px] text-[#5a7a2a] mb-1">
                    <span>❤️ Здоровье корабля</span>
                    <span>
                      {activeExp.hp}/{activeExp.maxHp}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 5,
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
                </div>

                <div className="flex items-center justify-between text-sm flex-shrink-0">
                  <span className="font-semibold text-[#3a5214]">
                    {PHASE_LABEL[activeExp.phase]}
                  </span>
                  <span className="text-[#5a7a2a] tabular-nums">
                    ⏱ {fmtCountdown(flightSec * 1000)}
                  </span>
                </div>

                <ShipInventory loot={activeExp.loot} />

                {/* Journal — виртуализирован (react-virtuoso) */}
                <div
                  className="flex-1 min-h-0"
                  style={{
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
                    style={{ height: '100%' }}
                    data={visibleJournal}
                    followOutput="auto"
                    initialTopMostItemIndex={Math.max(
                      0,
                      visibleJournal.length - 1,
                    )}
                    components={{
                      Header: () => <div style={{ height: 8 }} />,
                      Footer: () => <div style={{ height: 8 }} />,
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
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  {activeExp.canRecall && (
                    <button
                      className="ff-btn ff-btn-grey flex-1 py-3"
                      onClick={() => onRecall()}
                    >
                      ↩︎ Вернуться
                    </button>
                  )}
                  {activeExp.phase === 'returning' && !activeExp.canClaim && (
                    <button
                      className="ff-btn ff-btn-green flex-1 py-3"
                      onClick={() => onContinue()}
                      title="Отменить возврат и лететь дальше"
                    >
                      🚀 Продолжить ({fmtCountdown(returnMs)} до базы)
                    </button>
                  )}
                  {(activeExp.canClaim || activeExp.phase === 'lost') && (
                    <button
                      className="ff-btn ff-btn-green flex-1 py-3"
                      disabled={busy}
                      onClick={() => void onClaim()}
                    >
                      {activeExp.phase === 'lost'
                        ? 'Принять потерю'
                        : '📦 Забрать лут'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
