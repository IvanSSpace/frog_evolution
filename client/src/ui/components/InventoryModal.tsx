import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore'
import { useModalLock } from '../../utils/modalLock'
import { fmt } from '../../utils/formatting'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import {
  ELEMENT_TINT,
  ELEMENT_BOTTLE_FILTER,
} from '../../components/CosmicHub/ElementGrid'
import { eventBus } from '../../store/eventBus'
import { hapticImpact } from '../../utils/telegram'

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
  onApply,
}: {
  icon?: string
  emoji?: string
  count: number
  tint: string
  filter?: string
  label: string
  onApply?: () => void
}) {
  const [tip, setTip] = useState(false)
  return (
    <div
      onClick={() => (onApply ? onApply() : setTip((t) => !t))}
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

// Пустой слот — тех же размеров, без содержимого (заполняет сетку).
function EmptySlot() {
  return (
    <div
      style={{
        flexShrink: 0,
        width: 52,
        height: 56,
        borderRadius: 10,
        border: '2px dashed rgba(77,107,31,0.35)',
        background: 'rgba(77,107,31,0.06)',
      }}
    />
  )
}

export function InventoryModal({ onClose }: Props) {
  useModalLock()

  const gold = useGameStore((s) => s.gold)
  const serums = useGameStore((s) => s.serums)
  const mutagen = useGameStore((s) => s.mutagen)
  const routes = useGameStore((s) => s.routes)
  const setSerumDragActive = useGameStore((s) => s.setSerumDragActive)

  const handleClose = onClose

  const serumSlots = ELEMENTS.filter((e) => (serums[e] ?? 0) > 0)
  const routeSlots = ROUTE_RARITIES.filter((r) => (routes?.[r.key] ?? 0) > 0)

  // Единая сетка слотов: золото + мутаген + маршруты + сыворотки. Без разделов.
  const filled: React.ReactNode[] = [
    <InvSlot
      key="gold"
      icon="/goo.svg"
      count={Number(gold)}
      tint="#d9a441"
      label="💰 Золото (слизь) — основная валюта. Тратится в магазинах и на прокачку."
    />,
  ]
  if (mutagen > 0) {
    filled.push(
      <InvSlot
        key="mutagen"
        emoji="🧬"
        count={mutagen}
        tint="#a855f7"
        label="🧬 Мутаген — редкий космо-лут. Нужен для эволюции лягушек (вместе с эссенцией)."
      />,
    )
  }
  routeSlots.forEach((r) => {
    filled.push(
      <InvSlot
        key={`route-${r.key}`}
        emoji="🗺️"
        count={routes[r.key]}
        tint={r.tint}
        label={`🗺️ Звёздный маршрут (${r.name}) — это миссия. Редкость = сложность прохождения.`}
      />,
    )
  })
  serumSlots.forEach((e: Element) => {
    filled.push(
      <InvSlot
        key={`serum-${e}`}
        icon="/genBottle.svg"
        count={serums[e]}
        tint={ELEMENT_TINT[e]}
        filter={ELEMENT_BOTTLE_FILTER[e]}
        label={`🧪 Сыворотка «${e}» — превращает лягушку в носителя стихии «${e}».`}
        onApply={() => {
          hapticImpact('light')
          setSerumDragActive(true, { element: e })
          eventBus.emit('cosmic:select-serum', { element: e })
          onClose()
        }}
      />,
    )
  })
  // Добиваем пустыми слотами до полной сетки (минимум 4 ряда по 5).
  const MIN_SLOTS = 20
  const total = Math.max(MIN_SLOTS, Math.ceil(filled.length / 5) * 5)
  const emptyCount = total - filled.length

  return createPortal(
    <div
      onClick={handleClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
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
        {/* Header — как у Shop/FrogShop */}
        <div
          className="relative flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-2xl"
            style={{ color: '#16a34a', letterSpacing: 1 }}
          >
            🎒 Инвентарь
          </h2>
          <button
            onClick={handleClose}
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

        {/* Body — единая сетка слотов (как ячейки инвентаря). */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
            }}
          >
            {filled}
            {Array.from({ length: emptyCount }).map((_, i) => (
              <EmptySlot key={`empty-${i}`} />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
