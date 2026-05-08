// Phase 14: переиспользуемый компонент 4×4 grid с 16 элементами для одной rarity-секции.
// Каждая cell отображает: tint dot (locked TINT TABLE) + count badge.
// onClick → onSelect(element, rarity) при count > 0; disabled cell → no-op.

import { useTranslation } from 'react-i18next'
import { ELEMENTS, type Element, type Rarity } from '../../store/cosmic/types'
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

interface Props {
  rarity: Rarity
  counts: Record<Element, number>  // serums[element][rarity] для всех 16 elements
  onSelect: (element: Element, rarity: Rarity) => void
  // Phase 14 (SERUM-11): desktop drag-start callback. Mobile (touch) → ignored.
  onPointerDragStart?: (
    element: Element,
    rarity: Rarity,
    startX: number,
    startY: number,
  ) => void
}

export function ElementGrid({ rarity, counts, onSelect, onPointerDragStart }: Props) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-4 gap-2">
      {ELEMENTS.map((el) => {
        const count = counts[el] ?? 0
        const active = count > 0
        return (
          <button
            key={el}
            disabled={!active}
            onPointerDown={(e) => {
              if (!active) return
              // Mobile / touch → tap path (onClick) handles это.
              if (e.pointerType === 'touch') return
              e.preventDefault()  // отменяет text-selection
              onPointerDragStart?.(el, rarity, e.clientX, e.clientY)
            }}
            onClick={() => {
              if (!active) return
              hapticImpact('light')
              onSelect(el, rarity)
            }}
            className={
              `relative aspect-square rounded-lg border-2 flex items-center justify-center
               ${active
                 ? 'bg-white/5 hover:bg-white/10 active:scale-95 transition'
                 : 'border-white/10 bg-white/5 opacity-30 cursor-default'
              }`
            }
            style={{ borderColor: active ? ELEMENT_TINT[el] : undefined }}
            aria-label={t(`cosmic_hub.elements.${el}`)}
            title={t(`cosmic_hub.elements.${el}`)}
          >
            {/* Tint dot — основной visual */}
            <div
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: ELEMENT_TINT[el] }}
            />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white
                             text-xs font-bold rounded-full min-w-[1.25rem] h-5
                             flex items-center justify-center px-1">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
