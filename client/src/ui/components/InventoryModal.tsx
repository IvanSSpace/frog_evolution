import { useLayoutEffect, useRef, useState } from 'react'
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

const SERUM_INFO: Record<Element, { name: string; farm: string; ascend: string; expedition: string; mission: string }> = {
  fire:    { name: 'Огонь',    farm: 'ускоряет появление боксов', ascend: 'мгновенно выдаёт запас слизи (~30 минут дохода)', expedition: 'экспедиция завершается быстрее — корабль раньше возвращается с лутом', mission: 'повышает урон отряда' },
  plasma:  { name: 'Плазма',   farm: 'ускоряет появление боксов', ascend: 'мгновенно несколько боксов', expedition: 'повышает шанс редких находок', mission: 'увеличивает скорость атаки' },
  water:   { name: 'Вода',     farm: 'повышает доход дрона сборщика', ascend: 'небольшой постоянный бонус к доходу локации', expedition: '+золото в добыче', mission: 'регенерация здоровья' },
  forest:  { name: 'Лес',      farm: 'повышает доход дрона сборщика', ascend: 'пачка слизи', expedition: 'больше редкого лута (серумы, мутаген)', mission: 'дополнительная жизнь' },
  gas:     { name: 'Газ',      farm: 'повышает доход дрона сборщика', ascend: 'добавляет событие в текущую экспедицию', expedition: 'экипаж дольше держится → больше событий', mission: 'урон по площади' },
  crystal: { name: 'Кристалл', farm: 'увеличивает запас offline-дохода', ascend: 'шанс получить эссенцию', expedition: 'гарантированный минимум лута даже при неудаче', mission: 'щит на старте' },
  ring:    { name: 'Кольцо',   farm: 'увеличивает запас offline-дохода', ascend: 'навсегда повышает предел offline-дохода', expedition: 'снижает потери от опасных событий', mission: 'броня — меньше входящего урона' },
  binary:  { name: 'Бинар',    farm: 'повышает шанс дропа сыворотки', ascend: 'ролл на редкое: мутаген, эссенция или редкий бокс', expedition: 'больше редких событий и серума в добыче', mission: 'удача (лучше дроп) и шанс двойной награды' },
  ice:     { name: 'Лёд',      farm: '+базовый доход слизи', ascend: 'сбрасывает кулдауны (эволюция, корабль)', expedition: 'снижает кулдаун повторной отправки корабля', mission: 'замедляет врагов' },
  toxic:   { name: 'Яд',       farm: '+базовый доход слизи', ascend: 'бонусный дроп', expedition: 'отпугивает опасные события (меньше потерь)', mission: 'урон ядом по площади' },
  desert:  { name: 'Пустыня',  farm: '+базовый доход слизи', ascend: 'временный бонус к дальности корабля', expedition: 'открывает дальние планеты / +находка', mission: 'увеличивает радиус подбора лута' },
}

const ROUTE_RARITIES: {
  key: 'common' | 'rare' | 'epic'
  name: string
  tint: string
}[] = [
  { key: 'common', name: 'обычный', tint: '#94a3b8' },
  { key: 'rare', name: 'редкий', tint: '#60a5fa' },
  { key: 'epic', name: 'эпический', tint: '#c084fc' },
]

// Слот инвентаря: иконка + бейдж + тултип по клику (раскрывается ВНИЗ).
// Первый клик ВСЕГДА открывает тултип; применение (серум) — кнопкой внутри.
// Тултип горизонтально сдвигается если слот у края экрана (иначе не виден).
function InvSlot({
  icon,
  emoji,
  count,
  tint,
  filter,
  label,
  onApply,
  isOpen,
  onToggle,
}: {
  icon?: string
  emoji?: string
  count: number
  tint: string
  filter?: string
  label: string
  onApply?: () => void
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div
      onClick={() => onToggle()}
      style={{
        flexShrink: 0,
        width: 52,
        height: 56,
        borderRadius: 10,
        border: `2px solid ${tint}`,
        background: isOpen ? 'rgba(40,40,55,0.9)' : 'rgba(10,10,15,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
        boxShadow: isOpen ? `0 0 0 2px ${tint}, 0 0 10px ${tint}aa` : undefined,
        transform: isOpen ? 'translateY(-2px)' : undefined,
        transition: 'box-shadow .15s, background .15s, transform .15s',
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
      {isOpen && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          style={{
            position: 'absolute',
            top: '110%',
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
            zIndex: 30,
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            pointerEvents: 'auto',
          }}
        >
          {label}
          {onApply && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
                onApply()
              }}
              style={{
                marginTop: 7,
                width: '100%',
                padding: '5px 0',
                borderRadius: 6,
                border: `1px solid ${tint}`,
                background: tint,
                color: '#0b1320',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Применить
            </button>
          )}
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

  const [showSerums, setShowSerums] = useState(false)
  const [openTip, setOpenTip] = useState<string | null>(null)

  // При раскрытии «Про сыворотки» скроллим тело модалки в самый низ —
  // блок справки появляется под сеткой слотов. rAF — чтобы блок успел отрисоваться.
  const bodyRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!showSerums) return
    const el = bodyRef.current
    if (!el) return
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(id)
  }, [showSerums])

  const gold = useGameStore((s) => s.gold)
  const serums = useGameStore((s) => s.serums)
  const mutagen1 = useGameStore((s) => s.mutagen1)
  const mutagen2 = useGameStore((s) => s.mutagen2)
  const mutagen3 = useGameStore((s) => s.mutagen3)
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
      isOpen={openTip === 'gold'}
      onToggle={() => setOpenTip((prev) => (prev === 'gold' ? null : 'gold'))}
    />,
  ]
  // Три tier'а мутагена — отдельные слоты, каждый со своей иконкой /gens/genN.png.
  const mutagenTiers: { tier: 1 | 2 | 3; count: number; range: string }[] = [
    { tier: 1, count: mutagen1, range: 'L1-6' },
    { tier: 2, count: mutagen2, range: 'L7-12' },
    { tier: 3, count: mutagen3, range: 'L13-18' },
  ]
  for (const { tier, count, range } of mutagenTiers) {
    if (count <= 0) continue
    const id = `mutagen${tier}`
    filled.push(
      <InvSlot
        key={id}
        icon={`/gens/gen${tier}.png`}
        count={count}
        tint="#a855f7"
        label={`🧬 Мутаген-${tier} — для эволюции лягушек ${range}. Космо-лут.`}
        isOpen={openTip === id}
        onToggle={() => setOpenTip((prev) => (prev === id ? null : id))}
      />,
    )
  }
  routeSlots.forEach((r) => {
    const id = `route-${r.key}`
    filled.push(
      <InvSlot
        key={id}
        emoji="🗺️"
        count={routes[r.key]}
        tint={r.tint}
        label={`🗺️ Звёздный маршрут (${r.name}) — это миссия. Редкость = сложность прохождения.`}
        isOpen={openTip === id}
        onToggle={() => setOpenTip((prev) => (prev === id ? null : id))}
      />,
    )
  })
  serumSlots.forEach((e: Element) => {
    const id = `serum-${e}`
    filled.push(
      <InvSlot
        key={id}
        icon="/genBottle.svg"
        count={serums[e]}
        tint={ELEMENT_TINT[e]}
        filter={ELEMENT_BOTTLE_FILTER[e]}
        label={`🧪 Сыворотка «${e}» — превращает лягушку в носителя стихии «${e}».`}
        isOpen={openTip === id}
        onToggle={() => setOpenTip((prev) => (prev === id ? null : id))}
        onApply={() => {
          hapticImpact('light')
          setSerumDragActive(true, { element: e })
          eventBus.emit('cosmic:select-serum', { element: e })
          onClose()
        }}
      />,
    )
  })
  // Добиваем пустыми слотами до полной сетки (минимум 7 рядов по 4).
  const MIN_SLOTS = 28
  const total = Math.max(MIN_SLOTS, Math.ceil(filled.length / 4) * 4)
  const emptyCount = total - filled.length

  return (
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
            📦 Склад
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

        {/* Body — сетка слотов всегда, справка по сывороткам раскрывается снизу. */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 52px)',
              gap: 10,
              justifyContent: 'center',
            }}
          >
            {filled}
            {Array.from({ length: emptyCount }).map((_, i) => (
              <EmptySlot key={`empty-${i}`} />
            ))}
          </div>
          {showSerums && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginTop: 14,
                borderTop: '2px dashed rgba(77,107,31,0.3)',
                paddingTop: 12,
              }}
            >
              <p style={{ fontSize: 12, color: '#365314', lineHeight: 1.5, margin: 0 }}>
                Сыворотка применяется на лягушку 1 уровня → она становится носителем стихии.
                Баф работает пока лягушка на ферме, а также когда берёшь её в экипаж экспедиции или миссии.
              </p>
              {ELEMENTS.filter((e) => (serums[e] ?? 0) > 0).length === 0 ? (
                <p style={{ fontSize: 13, color: '#365314', textAlign: 'center', marginTop: 12 }}>
                  У тебя пока нет сывороток. Открывай космо-боксы и выполняй квесты.
                </p>
              ) : (
                ELEMENTS.filter((e) => (serums[e] ?? 0) > 0).map((e) => (
                  <div
                    key={e}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: `2px solid ${ELEMENT_TINT[e]}`,
                      background: `${ELEMENT_TINT[e]}18`,
                    }}
                  >
                    <img
                      src="/genBottle.svg"
                      alt=""
                      style={{ height: 32, width: 'auto', filter: ELEMENT_BOTTLE_FILTER[e], flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>
                        {SERUM_INFO[e].name}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                        <div style={{ fontSize: 11, color: '#365314' }}>
                          <span style={{ fontWeight: 700, color: '#15803d' }}>🌱 Ферма: </span>{SERUM_INFO[e].farm}
                        </div>
                        <div style={{ fontSize: 11, color: '#365314' }}>
                          <span style={{ fontWeight: 700, color: '#15803d' }}>🧬 Соединение 18+18: </span>{SERUM_INFO[e].ascend}
                        </div>
                        <div style={{ fontSize: 11, color: '#365314' }}>
                          <span style={{ fontWeight: 700, color: '#15803d' }}>🚀 Экспедиция: </span>{SERUM_INFO[e].expedition}
                        </div>
                        <div style={{ fontSize: 11, color: '#365314' }}>
                          <span style={{ fontWeight: 700, color: '#15803d' }}>🎮 Миссия: </span>{SERUM_INFO[e].mission}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Кнопка справки по сывороткам — тоглит аккордеон снизу */}
        <div style={{ padding: '0 16px 12px' }}>
          <button
            type="button"
            className="ff-btn"
            style={{ width: '100%' }}
            onClick={() => setShowSerums((v) => !v)}
          >
            {showSerums ? '🧪 Про сыворотки ▴' : '🧪 Про сыворотки ▾'}
          </button>
        </div>
      </div>
    </div>
  )
}
