import { useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import {
  ELEMENTS,
  RARITIES,
  type Element,
  type Rarity,
} from '../../store/cosmic/types'
import type { BoxData } from '../../store/cosmic/types'
import { ELEMENT_TINT, ELEMENT_BOTTLE_FILTER } from './ElementGrid'
import { hapticImpact } from '../../utils/telegram'

const CascadeRevealModal = lazy(() => import('./CascadeRevealModal'))

const RARITY_LOCATION: Record<Rarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

interface Props {
  onClose: () => void
}

const RARITY_BG: Record<Rarity, string> = {
  common: 'rgba(10, 10, 15, 0.72)',
  rare: 'rgba(10, 10, 15, 0.72)',
  epic: 'rgba(10, 10, 15, 0.72)',
  legendary: 'rgba(10, 10, 15, 0.72)',
}

const ORDERED_RARITIES: readonly Rarity[] = [
  'legendary',
  'epic',
  'rare',
  'common',
]

export function SerumInventoryTab({ onClose }: Props) {
  const { t } = useTranslation()
  const serums = useGameStore((s) => s.serums)
  const allBoxes = useGameStore((s) => s.boxes)
  const setSerumDragActive = useGameStore((s) => s.setSerumDragActive)
  const setCurrentLocation = useGameStore((s) => s.setCurrentLocation)
  const [selected, setSelected] = useState<`${Element}:${Rarity}` | null>(null)
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

  const totalSerumCount = RARITIES.reduce((sum, r) => {
    return sum + ELEMENTS.reduce((es, e) => es + (serums[e][r] ?? 0), 0)
  }, 0)

  const handleBoxTap = (element: Element) => {
    const elementBoxes = boxesByElement[element]
    if (!elementBoxes?.length) return
    hapticImpact('light')
    setActiveBox(elementBoxes[0])
    // CascadeRevealModal рендерится поверх (z-index 200), SerumModal не закрываем
  }

  const handleCascadeComplete = () => {
    setActiveBox(null)
  }

  const handleSerumTap = (element: Element, rarity: Rarity) => {
    const key = `${element}:${rarity}` as const
    if (selected !== key) {
      hapticImpact('light')
      setSelected(key)
      return
    }
    hapticImpact('light')
    setSelected(null)
    setCurrentLocation(RARITY_LOCATION[rarity])
    setSerumDragActive(true, { element, rarity })
    eventBus.emit('cosmic:select-serum', { element, rarity })
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
                const hasBonusRarity = boxesByElement[element]!.some(
                  (b) => b.bonusRarity,
                )
                return (
                  <button
                    key={element}
                    onClick={() => handleBoxTap(element)}
                    className="relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 active:scale-95 transition"
                    style={{
                      borderColor: tint,
                      backgroundColor: 'rgba(10, 10, 15, 0.72)',
                      boxShadow: hasBonusRarity
                        ? `0 0 8px ${tint}88`
                        : undefined,
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

        {/* Serums sections — by rarity */}
        {ORDERED_RARITIES.map((rarity) => {
          const nonZeroCells: { element: Element; count: number }[] = []
          for (const el of ELEMENTS) {
            const count = serums[el][rarity] ?? 0
            if (count > 0) nonZeroCells.push({ element: el, count })
          }
          if (nonZeroCells.length === 0) return null

          return (
            <section key={rarity} className="flex flex-col gap-2">
              <div className="grid grid-cols-4 gap-2">
                {nonZeroCells.map(({ element, count }) => {
                  const key = `${element}:${rarity}` as const
                  const isSelected = selected === key
                  return (
                    <button
                      key={element}
                      onClick={() => handleSerumTap(element, rarity)}
                      className="relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 active:scale-95 transition"
                      style={{
                        borderColor: ELEMENT_TINT[element],
                        backgroundColor: RARITY_BG[rarity],
                        outline: isSelected
                          ? `2px solid ${ELEMENT_TINT[element]}`
                          : undefined,
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
          )
        })}
      </div>

      {/* CascadeRevealModal поверх SerumModal (z-index 200 > 100) */}
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
