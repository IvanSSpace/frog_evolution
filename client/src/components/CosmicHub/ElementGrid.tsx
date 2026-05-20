// Phase 22: 4×4 grid с 16 элементами.
// Phase 14: переиспользуемый компонент для SerumTab (одна секция без rarity).
// Каждая cell отображает: tint border + bottle icon + count badge.
// onClick → onSelect(element) при count > 0; disabled cell → no-op.

import { useTranslation } from 'react-i18next'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import { hapticImpact } from '../../utils/telegram'

/** TINT TABLE из REQUIREMENTS.md (locked palette, colorblind-safe). */
export const ELEMENT_TINT: Record<Element, string> = {
  fire: '#fb923c',
  ice: '#a5f3fc',
  water: '#38bdf8',
  forest: '#4ade80',
  toxic: '#86efac',
  plasma: '#fde047',
  shadow: '#6b7280',
  crystal: '#ddd6fe',
  desert: '#fde68a',
  gas: '#fdba74',
  ring: '#c4b5fd',
  binary: '#fca5a5',
  arcane: '#a78bfa',
  mechanical: '#fde68a',
  war: '#dc2626',
  void: '#1f2937',
}

// SVG бутылочка genBottle.svg изначально зелёная (~hue 130°).
// hue-rotate сдвигает цвет жидкости под каждый элемент.
export const ELEMENT_BOTTLE_FILTER: Record<Element, string> = {
  fire: 'hue-rotate(-106deg) saturate(1.6)',
  ice: 'hue-rotate(61deg) saturate(0.9) brightness(1.1)',
  water: 'hue-rotate(69deg) saturate(1.1)',
  forest: 'hue-rotate(12deg)',
  toxic: 'hue-rotate(15deg) brightness(1.1)',
  plasma: 'hue-rotate(-82deg) saturate(1.8)',
  shadow: 'saturate(0) brightness(0.8)',
  crystal: 'hue-rotate(120deg) saturate(0.5) brightness(1.3)',
  desert: 'hue-rotate(-82deg) brightness(1.2)',
  gas: 'hue-rotate(-100deg) saturate(1.1) brightness(1.15)',
  ring: 'hue-rotate(122deg) saturate(0.7) brightness(1.2)',
  binary: 'hue-rotate(-130deg) saturate(0.8) brightness(1.25)',
  arcane: 'hue-rotate(130deg) saturate(1.2)',
  mechanical: 'hue-rotate(-82deg) saturate(0.9) brightness(1.2)',
  war: 'hue-rotate(-130deg) saturate(2) brightness(0.9)',
  void: 'saturate(0) brightness(0.25)',
}

interface Props {
  counts: Record<Element, number> // serums[element] для всех 16 elements
  onSelect: (element: Element) => void
  // Phase 14 (SERUM-11): desktop drag-start callback. Mobile (touch) → ignored.
  onPointerDragStart?: (
    element: Element,
    startX: number,
    startY: number,
  ) => void
}

export function ElementGrid({
  counts,
  onSelect,
  onPointerDragStart,
}: Props) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-4 gap-2">
      {ELEMENTS.map((el) => {
        const count = counts[el] ?? 0
        const active = count > 0
        return (
          <button
            key={el}
            type="button"
            disabled={!active}
            onPointerDown={(e) => {
              if (!active) return
              // Mobile / touch → tap path (onClick) handles это.
              if (e.pointerType === 'touch') return
              e.preventDefault() // отменяет text-selection
              onPointerDragStart?.(el, e.clientX, e.clientY)
            }}
            onClick={() => {
              if (!active) return
              hapticImpact('light')
              onSelect(el)
            }}
            className={`relative aspect-square rounded-lg border-2 flex items-center justify-center
               ${
                 active
                   ? 'bg-white/5 hover:bg-white/10'
                   : 'border-white/10 bg-white/5 opacity-30 cursor-default'
               }`}
            style={{ borderColor: active ? ELEMENT_TINT[el] : undefined }}
            aria-label={t(`cosmic_hub.elements.${el}`)}
            title={t(`cosmic_hub.elements.${el}`)}
          >
            <img
              src="/genBottle.svg"
              alt={el}
              style={{
                height: 36,
                width: 'auto',
                filter: ELEMENT_BOTTLE_FILTER[el],
                pointerEvents: 'none',
              }}
            />
            {count > 0 && (
              <span
                className="absolute -top-1 -right-1 bg-emerald-500 text-white
                             text-xs font-bold rounded-full min-w-[1.25rem] h-5
                             flex items-center justify-center px-1"
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
