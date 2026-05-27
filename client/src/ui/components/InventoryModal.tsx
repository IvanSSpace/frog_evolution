import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore'
import { useModalLock } from '../../utils/modalLock'
import { fmt } from '../../utils/formatting'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import {
  ELEMENT_TINT,
  ELEMENT_BOTTLE_FILTER,
} from '../../components/CosmicHub/ElementGrid'

type Props = { onClose: () => void }

const ROUTE_RARITIES: {
  key: 'common' | 'rare' | 'epic'
  name: string
  tint: string
}[] = [
  { key: 'common', name: 'обычный', tint: '#94a3b8' },
  { key: 'rare', name: 'редкий', tint: '#60a5fa' },
  { key: 'epic', name: 'эпический', tint: '#c084fc' },
]

// Слот инвентаря: иконка + бейдж + тултип по клику (всегда раскрывается ВНИЗ).
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
  label: string
}) {
  const [tip, setTip] = useState(false)
  return (
    <div
      onClick={() => setTip((t) => !t)}
      style={{
        flexShrink: 0,
        width: 52,
        height: 56,
        borderRadius: 10,
        border: `2px solid ${tint}`,
        background: 'rgba(10,10,15,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
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
      {emoji ? (
        <span style={{ fontSize: 28 }}>{emoji}</span>
      ) : (
        <img
          src={icon}
          alt=""
          style={{ height: 30, width: 'auto', filter, pointerEvents: 'none' }}
        />
      )}
      {tip && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            setTip(false)
          }}
          style={{
            position: 'absolute',
            top: '110%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 190,
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

function Section({
  title,
  children,
  empty,
}: {
  title: string
  children: React.ReactNode
  empty: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="ff-display text-sm text-emerald-900">{title}</div>
      {empty ? (
        <div className="ff-body text-[12px] text-emerald-800/70">
          Пока пусто.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">{children}</div>
      )}
    </div>
  )
}

export function InventoryModal({ onClose }: Props) {
  useModalLock()
  const [closing, setClosing] = useState(false)

  const gold = useGameStore((s) => s.gold)
  const serums = useGameStore((s) => s.serums)
  const mutagen = useGameStore((s) => s.mutagen)
  const routes = useGameStore((s) => s.routes)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

  const serumSlots = ELEMENTS.filter((e) => (serums[e] ?? 0) > 0)
  const routeSlots = ROUTE_RARITIES.filter((r) => (routes?.[r.key] ?? 0) > 0)
  const hasCosmic = mutagen > 0 || routeSlots.length > 0

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
            background: 'linear-gradient(180deg, #f5fbe9 0%, #d9eeb6 100%)',
            border: '4px solid #4d6b1f',
            boxShadow: '0 0 0 3px #f7ffe0 inset',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0"
            style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
          >
            <div className="flex-1 ff-display text-base text-emerald-900">
              🎒 Инвентарь
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
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-4 py-3">
            <Section title="💰 Валюта" empty={false}>
              <InvSlot
                icon="/goo.svg"
                count={Number(gold)}
                tint="#d9a441"
                label="💰 Золото (слизь) — основная валюта. Тратится в магазинах и на прокачку."
              />
            </Section>

            <Section title="🌌 Космический лут" empty={!hasCosmic}>
              {mutagen > 0 && (
                <InvSlot
                  emoji="🧬"
                  count={mutagen}
                  tint="#a855f7"
                  label="🧬 Мутаген — редкий космо-лут. Нужен для эволюции лягушек (вместе с эссенцией)."
                />
              )}
              {routeSlots.map((r) => (
                <InvSlot
                  key={r.key}
                  emoji="🗺️"
                  count={routes[r.key]}
                  tint={r.tint}
                  label={`🗺️ Звёздный маршрут (${r.name}) — это миссия. Редкость = сложность прохождения.`}
                />
              ))}
            </Section>

            <Section title="🧪 Сыворотки" empty={serumSlots.length === 0}>
              {serumSlots.map((e: Element) => (
                <InvSlot
                  key={e}
                  icon="/genBottle.svg"
                  count={serums[e]}
                  tint={ELEMENT_TINT[e]}
                  filter={ELEMENT_BOTTLE_FILTER[e]}
                  label={`🧪 Сыворотка «${e}» — превращает лягушку в носителя стихии «${e}».`}
                />
              ))}
            </Section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
