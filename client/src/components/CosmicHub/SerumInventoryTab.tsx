// Phase 25-02: visual restyle (Tailwind color utilities → inline styles)
// Phase 22: SerumInventoryTab — упрощённый.
// Один тип серума per element (без секций common/rare/epic/legendary).
// Boxes section остаётся (для открытия боксов).

import { useState, useRef, useLayoutEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import type { BoxData } from '../../store/cosmic/types'
import { ELEMENT_TINT, ELEMENT_BOTTLE_FILTER } from './ElementGrid'
import {
  ELEMENT_TO_CATEGORY,
  BONUS_PER_CATEGORY,
  MINI_BONUS_PER_CATEGORY,
  type BonusKey,
} from '../../utils/archetypeBonuses'
import { hapticImpact } from '../../utils/telegram'
import {
  PINK_BADGE_STYLE,
  GOLD,
  TEXT_DIM,
  EMPTY_STATE_TEXT_STYLE,
} from './_styles'

const CascadeRevealModal = lazy(() => import('./CascadeRevealModal'))

// BonusKey → ключ лейбла в i18n (hud.bonus.*).
const BONUS_LABEL_KEY: Record<BonusKey, string> = {
  boxDropSpeed: 'boxSpeed',
  tractorGold: 'tractorGold',
  offlineCap: 'offlineCap',
  serumDrop: 'serumDrop',
  flatGold: 'gold',
}

function fmtPct(v: number): string {
  return (v * 100).toFixed(1).replace(/\.0$/, '')
}

/** Эффект серума стихии: что даёт носитель (full = после вознесения, mini = на ферме). */
function serumEffect(
  element: Element,
  t: (k: string) => string,
): { label: string; full: string; mini: string } {
  const cat = ELEMENT_TO_CATEGORY[element]
  const full = BONUS_PER_CATEGORY[cat]
  const mini = MINI_BONUS_PER_CATEGORY[cat]
  return {
    label: t(`hud.bonus.${BONUS_LABEL_KEY[full.key]}`),
    full: fmtPct(full.amount),
    mini: fmtPct(mini.amount),
  }
}

interface Props {
  onClose: () => void
}

export function SerumInventoryTab({ onClose }: Props) {
  const { t } = useTranslation()
  const serums = useGameStore((s) => s.serums)
  const allBoxes = useGameStore((s) => s.boxes)
  const carriers = useGameStore((s) => s.carriers)
  const ascendedCarriers = useGameStore((s) => s.ascendedCarriers)
  const setSerumDragActive = useGameStore((s) => s.setSerumDragActive)
  const [selected, setSelected] = useState<Element | null>(null)
  const [activeBox, setActiveBox] = useState<BoxData | null>(null)
  // При открытии меню скроллим блок в самый низ (по просьбе — описания внизу).
  const scrollRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // Носителей на поле по стихиям (лягушка под сывороткой = «серум есть»).
  const carrierCountByElement = {} as Record<Element, number>
  for (const c of carriers)
    carrierCountByElement[c.element] = (carrierCountByElement[c.element] ?? 0) + 1

  // Стихии, по которым показываем описание: серум в инвентаре, ИЛИ носитель на
  // поле, ИЛИ вознесённый носитель (= «уже получали этот серум»).
  const knownElements = ELEMENTS.filter(
    (e) =>
      (serums[e] ?? 0) > 0 ||
      carriers.some((c) => c.element === e) ||
      ascendedCarriers.some((a) => a.element === e),
  )

  // Unopened boxes sorted newest first, grouped by element
  const boxes = allBoxes
    .filter((b) => !b.opened)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)

  const boxesByElement: Partial<Record<Element, BoxData[]>> = {}
  for (const box of boxes) {
    if (!boxesByElement[box.element]) boxesByElement[box.element] = []
    boxesByElement[box.element]!.push(box)
  }
  const elementsWithBoxes = ELEMENTS.filter(
    (el) => (boxesByElement[el]?.length ?? 0) > 0,
  )

  const handleBoxTap = (element: Element) => {
    const elementBoxes = boxesByElement[element]
    if (!elementBoxes?.length) return
    hapticImpact('light')
    setActiveBox(elementBoxes[0])
  }

  const handleCascadeComplete = () => {
    setActiveBox(null)
  }

  const handleSerumTap = (element: Element) => {
    if (selected !== element) {
      hapticImpact('light')
      setSelected(element)
      return
    }
    hapticImpact('light')
    setSelected(null)
    setSerumDragActive(true, { element })
    eventBus.emit('cosmic:select-serum', { element })
    onClose()
  }

  if (knownElements.length === 0 && boxes.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3"
        style={{ color: TEXT_DIM }}
      >
        <img
          src="/genBottle.svg"
          alt="serum"
          style={{ height: 96, width: 'auto', opacity: 0.4 }}
        />
        <p style={{ ...EMPTY_STATE_TEXT_STYLE, paddingLeft: 24, paddingRight: 24 }}>
          {t('cosmic_hub.serums_empty')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="flex flex-col gap-4 px-3 py-3 overflow-y-auto h-full"
      >
        {/* Boxes section — first */}
        {elementsWithBoxes.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2">
              {elementsWithBoxes.map((element) => {
                const count = boxesByElement[element]!.length
                const tint = ELEMENT_TINT[element]
                return (
                  <button
                    key={element}
                    type="button"
                    onClick={() => handleBoxTap(element)}
                    className="relative aspect-square flex flex-col items-center justify-center gap-1"
                    style={{
                      borderRadius: 12,
                      border: `2px solid ${tint}`,
                      background: 'rgba(255,255,255,0.06)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                      touchAction: 'manipulation',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 flex items-center justify-center"
                      style={{
                        ...PINK_BADGE_STYLE,
                        background: GOLD,
                        color: '#1a2e1a',
                        fontSize: 11,
                        padding: '0 6px',
                      }}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                    <span style={{ fontSize: 26, lineHeight: 1 }}>🎁</span>
                    <span
                      className="truncate w-full text-center px-1"
                      style={{ fontSize: 9, color: TEXT_DIM }}
                    >
                      {element.slice(0, 4)}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Divider when both sections visible */}
        {elementsWithBoxes.length > 0 && knownElements.length > 0 && (
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />
        )}

        {/* Серумы — строка на стихию: слева слот, справа что/где даёт.
            Показываем если серум в инвентаре ИЛИ есть носитель на поле/вознесённый. */}
        {knownElements.length > 0 && (
          <section className="flex flex-col gap-2">
            {knownElements.map((element) => {
              const count = serums[element] ?? 0
              const onField = carrierCountByElement[element] ?? 0
              const isSelected = selected === element
              const tint = ELEMENT_TINT[element]
              const fx = serumEffect(element, t)
              const canApply = count > 0
              return (
                <div
                  key={element}
                  onClick={canApply ? () => handleSerumTap(element) : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 10,
                    borderRadius: 12,
                    border: `2px solid ${tint}`,
                    background: 'rgba(255,255,255,0.05)',
                    boxShadow: isSelected
                      ? `0 0 0 2px ${tint}, inset 0 1px 0 rgba(255,255,255,0.06)`
                      : 'inset 0 1px 0 rgba(255,255,255,0.06)',
                    transform: isSelected ? 'scale(1.01)' : undefined,
                    cursor: canApply ? 'pointer' : 'default',
                    touchAction: 'manipulation',
                  }}
                >
                  {/* Слева — слот с сывороткой */}
                  <div
                    className="relative flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      border: `2px solid ${tint}`,
                      background: 'rgba(0,0,0,0.35)',
                    }}
                  >
                    {count > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 flex items-center justify-center"
                        style={{ ...PINK_BADGE_STYLE, fontSize: 11, padding: '0 6px' }}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                    <img
                      src="/genBottle.svg"
                      alt={element}
                      style={{
                        height: 40,
                        width: 'auto',
                        filter: ELEMENT_BOTTLE_FILTER[element],
                        opacity: count > 0 ? 1 : 0.5,
                        pointerEvents: 'none',
                      }}
                    />
                  </div>

                  {/* Справа — описание: что и где даёт */}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div
                      className="ff-display"
                      style={{ fontSize: 14, color: '#fff', textTransform: 'capitalize' }}
                    >
                      {element}
                    </div>
                    <div style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>
                      +{fx.full}% {fx.label}
                    </div>
                    <div style={{ fontSize: 10.5, color: TEXT_DIM, lineHeight: 1.3 }}>
                      После вознесения · +{fx.mini}% пока на ферме
                    </div>
                    {onField > 0 && (
                      <div style={{ fontSize: 10.5, color: tint, fontWeight: 600 }}>
                        Носителей на поле: {onField}
                      </div>
                    )}
                    {canApply && (
                      <div style={{ fontSize: 10, color: TEXT_DIM, fontStyle: 'italic' }}>
                        {isSelected ? 'нажми ещё раз — применить' : 'нажми чтобы выбрать'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </div>

      {activeBox && (
        <Suspense fallback={null}>
          <CascadeRevealModal
            box={activeBox}
            onComplete={handleCascadeComplete}
          />
        </Suspense>
      )}
    </>
  )
}
