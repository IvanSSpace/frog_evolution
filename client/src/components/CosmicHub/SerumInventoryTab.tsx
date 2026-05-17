// Phase 22: SerumInventoryTab — упрощённый.
// Один тип серума per element (без секций common/rare/epic/legendary).
// Boxes section остаётся (для открытия боксов).

import { useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import type { BoxData } from '../../store/cosmic/types'
import { ELEMENT_TINT, ELEMENT_BOTTLE_FILTER } from './ElementGrid'
import { hapticImpact } from '../../utils/telegram'

const CascadeRevealModal = lazy(() => import('./CascadeRevealModal'))

interface Props {
  onClose: () => void
}

export function SerumInventoryTab({ onClose }: Props) {
  const { t } = useTranslation()
  const serums = useGameStore((s) => s.serums)
  const allBoxes = useGameStore((s) => s.boxes)
  const setSerumDragActive = useGameStore((s) => s.setSerumDragActive)
  const [selected, setSelected] = useState<Element | null>(null)
  const [activeBox, setActiveBox] = useState<BoxData | null>(null)

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

  // Phase 22: flat serum count
  const totalSerumCount = ELEMENTS.reduce((sum, e) => sum + (serums[e] ?? 0), 0)

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

  if (totalSerumCount === 0 && boxes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/60">
        <img
          src="/genBottle.svg"
          alt="serum"
          style={{ height: 96, width: 'auto', opacity: 0.4 }}
        />
        <p className="text-sm text-center px-6">
          {t('cosmic_hub.serums_empty')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-3 py-3 overflow-y-auto h-full">
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
                    className="relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 active:scale-95 transition"
                    style={{
                      borderColor: tint,
                      backgroundColor: 'rgba(10, 10, 15, 0.72)',
                    }}
                  >
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
                      {count > 99 ? '99+' : count}
                    </span>
                    <span style={{ fontSize: 26, lineHeight: 1 }}>🎁</span>
                    <span className="text-[9px] text-white/60 truncate w-full text-center px-1">
                      {element.slice(0, 4)}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Divider when both sections visible */}
        {elementsWithBoxes.length > 0 && totalSerumCount > 0 && (
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />
        )}

        {/* Serums section — one per element, flat */}
        {totalSerumCount > 0 && (
          <section className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2">
              {ELEMENTS.map((element) => {
                const count = serums[element] ?? 0
                if (count === 0) return null
                const isSelected = selected === element
                const tint = ELEMENT_TINT[element]
                return (
                  <button
                    key={element}
                    type="button"
                    onClick={() => handleSerumTap(element)}
                    className="relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 active:scale-95 transition"
                    style={{
                      borderColor: tint,
                      backgroundColor: 'rgba(10, 10, 15, 0.72)',
                      outline: isSelected ? `2px solid ${tint}` : undefined,
                      outlineOffset: 2,
                      transform: isSelected ? 'scale(1.07)' : undefined,
                    }}
                  >
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
                      {count > 99 ? '99+' : count}
                    </span>
                    <img
                      src="/genBottle.svg"
                      alt={element}
                      style={{
                        height: 44,
                        width: 'auto',
                        filter: ELEMENT_BOTTLE_FILTER[element],
                        pointerEvents: 'none',
                      }}
                    />
                    <span className="text-[9px] text-white/60 truncate w-full text-center px-1">
                      {element.slice(0, 4)}
                    </span>
                  </button>
                )
              })}
            </div>
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
